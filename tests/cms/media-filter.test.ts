import { describe, it, expect } from 'vitest'

import {
  DEFAULT_MEDIA_QUERY, filterSortMedia, groupByMediaState, isMediaQueryActive, matchesMediaQuery,
  normalizeSearch,
  type MediaFacts, type MediaQuery,
} from '@/lib/cms/media-filter'

/* El módulo es puro: recibe los datos ya resueltos, así que el test los arma a
   mano en vez de montar el store. */
const facts = (over: Partial<MediaFacts> = {}): MediaFacts =>
  ({ name: 'file.webp', ts: 1_000, size: 100, isVideo: false, ...over })

const q = (over: Partial<MediaQuery> = {}): MediaQuery => ({ ...DEFAULT_MEDIA_QUERY, ...over })

const names = (list: MediaFacts[], query: MediaQuery) =>
  filterSortMedia(list, (f) => f, query).map((f) => f.name)

describe('normalizeSearch', () => {
  it('ignora acentos y mayúsculas', () => {
    expect(normalizeSearch('  Ilustración ')).toBe('ilustracion')
  })
})

describe('matchesMediaQuery', () => {
  it('busca por subcadena del nombre, sin acentos', () => {
    const f = facts({ name: 'Retrato Montaña.webp' })
    expect(matchesMediaQuery(f, q({ search: 'montana' }))).toBe(true)
    expect(matchesMediaQuery(f, q({ search: 'MONTAÑA' }))).toBe(true)
    expect(matchesMediaQuery(f, q({ search: 'paisaje' }))).toBe(false)
  })

  it('una búsqueda vacía no descarta nada', () => {
    expect(matchesMediaQuery(facts(), q({ search: '   ' }))).toBe(true)
  })

  it('separa imágenes de animaciones', () => {
    const img = facts({ isVideo: false })
    const vid = facts({ isVideo: true })
    expect(matchesMediaQuery(img, q({ kind: 'image' }))).toBe(true)
    expect(matchesMediaQuery(vid, q({ kind: 'image' }))).toBe(false)
    expect(matchesMediaQuery(vid, q({ kind: 'video' }))).toBe(true)
    expect(matchesMediaQuery(img, q({ kind: 'all' }))).toBe(true)
  })

  it('el tipo y el texto se aplican juntos, no alternativamente', () => {
    const vid = facts({ name: 'intro.webm', isVideo: true })
    expect(matchesMediaQuery(vid, q({ kind: 'image', search: 'intro' }))).toBe(false)
  })
})

describe('filterSortMedia', () => {
  const list = [
    facts({ name: 'medio.webp', ts: 2_000, size: 500 }),
    facts({ name: 'viejo.webp', ts: 1_000, size: 900 }),
    facts({ name: 'nuevo.webp', ts: 3_000, size: 100 }),
  ]

  it('ordena por fecha en los dos sentidos', () => {
    expect(names(list, q({ sortBy: 'date', sortDir: 'desc' }))).toEqual(['nuevo.webp', 'medio.webp', 'viejo.webp'])
    expect(names(list, q({ sortBy: 'date', sortDir: 'asc' }))).toEqual(['viejo.webp', 'medio.webp', 'nuevo.webp'])
  })

  it('ordena por peso en los dos sentidos', () => {
    expect(names(list, q({ sortBy: 'size', sortDir: 'desc' }))).toEqual(['viejo.webp', 'medio.webp', 'nuevo.webp'])
    expect(names(list, q({ sortBy: 'size', sortDir: 'asc' }))).toEqual(['nuevo.webp', 'medio.webp', 'viejo.webp'])
  })

  it('la fecha desconocida (0) queda al final en "más nuevo primero"', () => {
    const withUnknown = [...list, facts({ name: 'sinfecha.webp', ts: 0 })]
    expect(names(withUnknown, q({ sortBy: 'date', sortDir: 'desc' })).at(-1)).toBe('sinfecha.webp')
  })

  it('filtra y ordena en la misma pasada', () => {
    const mixed = [
      facts({ name: 'reel.webm', ts: 5_000, isVideo: true }),
      facts({ name: 'reel-portada.webp', ts: 1_000 }),
      facts({ name: 'reel-alterno.webp', ts: 9_000 }),
    ]
    expect(names(mixed, q({ search: 'reel', kind: 'image', sortBy: 'date', sortDir: 'desc' })))
      .toEqual(['reel-alterno.webp', 'reel-portada.webp'])
  })

  it('no muta la lista original', () => {
    const original = [...list]
    filterSortMedia(list, (f) => f, q({ sortBy: 'size', sortDir: 'asc' }))
    expect(list).toEqual(original)
  })
})

describe('isMediaQueryActive', () => {
  it('distingue "no hay nada" de "la búsqueda no encontró nada"', () => {
    expect(isMediaQueryActive(q())).toBe(false)
    expect(isMediaQueryActive(q({ search: '  ' }))).toBe(false)
    expect(isMediaQueryActive(q({ sortBy: 'size', sortDir: 'asc' }))).toBe(false)
    expect(isMediaQueryActive(q({ search: 'a' }))).toBe(true)
    expect(isMediaQueryActive(q({ kind: 'video' }))).toBe(true)
  })
})

describe('groupByMediaState', () => {
  const rows = [
    { n: 'a', st: 'used' }, { n: 'b', st: 'trash' }, { n: 'c', st: 'unused' },
    { n: 'd', st: 'used' }, { n: 'e', st: 'unused' },
  ]

  it('ordena sin usar → en uso → basurero', () => {
    expect(groupByMediaState(rows, (r) => r.st).map((r) => r.st))
      .toEqual(['unused', 'unused', 'used', 'used', 'trash'])
  })

  it('conserva el orden previo dentro de cada grupo (sort estable)', () => {
    expect(groupByMediaState(rows, (r) => r.st).map((r) => r.n))
      .toEqual(['c', 'e', 'a', 'd', 'b'])
  })

  it('acepta el vocabulario del picker vía `order`', () => {
    const picker = [{ st: 'usado' }, { st: 'sin usar' }, { st: 'usado' }]
    expect(groupByMediaState(picker, (r) => r.st, ['sin usar', 'usado']).map((r) => r.st))
      .toEqual(['sin usar', 'usado', 'usado'])
  })

  it('manda al final un estado desconocido', () => {
    const mixed = [{ st: 'otro' }, { st: 'used' }, { st: 'unused' }]
    expect(groupByMediaState(mixed, (r) => r.st).map((r) => r.st))
      .toEqual(['unused', 'used', 'otro'])
  })

  it('no muta la lista original', () => {
    const src = [{ st: 'trash' }, { st: 'unused' }]
    groupByMediaState(src, (r) => r.st)
    expect(src.map((r) => r.st)).toEqual(['trash', 'unused'])
  })
})

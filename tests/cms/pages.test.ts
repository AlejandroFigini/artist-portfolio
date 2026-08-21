import { describe, it, expect, vi } from 'vitest'

/* `lib/cms/pages` importa `sumSizes` de `lib/cms/store`, que es un módulo
   'use client' con estado y localStorage. Acá solo interesa la agrupación, así
   que se stubea el tamaño. */
vi.mock('@/lib/cms/store', () => ({
  sumSizes: (arr: { size?: number | null }[]) => arr.reduce((n, e) => n + (e.size ?? 0), 0),
}))

const { buildPageTree, getPageAndSectionInfo } = await import('@/lib/cms/pages')

const entry = (key: string, section: string, src: string, size = 10) => ({ key, section, src, size })

const pageById = (tree: ReturnType<typeof buildPageTree>, id: string) => {
  const p = tree.find((x) => x.id === id)
  if (!p) throw new Error(`page ${id} not found`)
  return p
}

describe('buildPageTree', () => {
  it('coloca los contenedores de /contact en su propia página', () => {
    const tree = buildPageTree([entry('contact.hero.bg', 'Contact', '/a.webp')])
    expect(pageById(tree, 'contact').count).toBe(1)
    expect(pageById(tree, 'feed').count).toBe(0)
  })

  it('reconoce las claves de Site Configuration aunque lleven sufijo posicional', () => {
    const tree = buildPageTree([
      entry('settings.appleIconUrl#0', 'Otros', '/icon.png'),
      entry('settings.faviconUrl', 'Site Configuration', '/fav.png'),
    ])
    expect(pageById(tree, 'config').count).toBe(2)
    expect(pageById(tree, 'feed').count).toBe(0)
  })

  it('manda al Feed lo que no pertenece a una página dedicada', () => {
    const tree = buildPageTree([entry('char#a1', 'Characters', '/c.webp')])
    expect(pageById(tree, 'feed').count).toBe(1)
  })

  it('repetido dentro de una página → una tarjeta con todos sus contenedores', () => {
    const src = '/shared.webp'
    const tree = buildPageTree([
      entry('char#a1', 'Characters', src),
      entry('illustration#0', 'Illustrations', src),
      entry('anim#0', 'Animations', src),
    ])
    const feed = pageById(tree, 'feed')
    expect(feed.count).toBe(1)
    expect(feed.entries).toHaveLength(1)
    expect(feed.entries[0].occs.map((o) => o.key)).toEqual(['char#a1', 'illustration#0', 'anim#0'])
    expect(feed.reused).toBe(2)
    // El tamaño se cuenta una sola vez, no una por contenedor.
    expect(feed.size).toBe(10)
  })

  it('repetido en dos páginas → aparece en cada una, con sus propios contenedores', () => {
    const src = '/shared.webp'
    const tree = buildPageTree([
      entry('char#a1', 'Characters', src),
      entry('contact.hero.bg', 'Contact', src),
    ])
    const feed = pageById(tree, 'feed')
    const contact = pageById(tree, 'contact')
    expect(feed.count).toBe(1)
    expect(contact.count).toBe(1)
    expect(feed.entries[0].occs.map((o) => o.key)).toEqual(['char#a1'])
    expect(contact.entries[0].occs.map((o) => o.key)).toEqual(['contact.hero.bg'])
    // Compartido entre páginas no es "reutilizado dentro de la página".
    expect(feed.reused).toBe(0)
    expect(contact.reused).toBe(0)
  })
})

describe('getPageAndSectionInfo', () => {
  it('resuelve la página de un contenedor de contacto', () => {
    expect(getPageAndSectionInfo({ key: 'contact.social.anim#0', section: 'Contact' }).page)
      .toBe('Contact (/contact)')
  })

  it('cae al Feed cuando la sección no es de una página dedicada', () => {
    expect(getPageAndSectionInfo({ key: 'proj#x', section: 'Projects' }).page).toBe('Feed (/)')
  })
})

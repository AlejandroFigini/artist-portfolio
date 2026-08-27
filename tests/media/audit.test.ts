import { describe, expect, it } from 'vitest'
import {
  auditMedia,
  IncompleteListingError,
  type AuditAsset,
  type AuditInput,
  type CmsIndex,
} from '@/lib/media-audit'

const CLOUD = 'https://res.cloudinary.com/demo/image/upload/v1'

function asset(publicId: string, over: Partial<AuditAsset> = {}): AuditAsset {
  return {
    public_id: publicId,
    secure_url: `${CLOUD}/${publicId}.webp`,
    resource_type: 'image',
    format: 'webp',
    bytes: 1000,
    folder: publicId.split('/').slice(0, -1).join('/'),
    tags: ['state:en-uso'],
    state: 'used',
    ...over,
  }
}

const EMPTY_INDEX: CmsIndex = { usedContent: {}, unused: [], trash: [], mediaMeta: {} }

function run(over: Partial<AuditInput> = {}) {
  return auditMedia({
    rows: [],
    listing: { resources: [], complete: true },
    index: EMPTY_INDEX,
    localAssetExists: () => false,
    ...over,
  })
}

describe('auditMedia — completitud de la lectura', () => {
  it('aborta si el listado de Cloudinary vino incompleto, aunque traiga recursos', () => {
    expect(() =>
      run({ listing: { resources: [asset('portfolio/en-uso/a')], complete: false } }),
    ).toThrow(IncompleteListingError)
  })

  it('clasifica normalmente con un listado VACÍO pero completo', () => {
    /* Es el estado real después de vaciar Cloudinary. Antes se abortaba por
       `resources.length === 0` y el caso en que TODO está roto era el único
       que no reportaba nada. */
    const rows = [
      { key: 'hero.img', value: `${CLOUD}/portfolio/en-uso/a.webp` },
      { key: 'about.img', value: `${CLOUD}/portfolio/en-uso/b.webp` },
      { key: 'proj#1::cover', value: `${CLOUD}/portfolio/sin-usar/c.webp` },
    ]
    const r = run({ rows })

    expect(r.missing).toHaveLength(3)
    expect(r.matching).toHaveLength(0)
    expect(r.counts['missing-cloudinary']).toBe(3)
    expect(r.deadKeys.sort()).toEqual(['about.img', 'hero.img', 'proj#1::cover'])
  })
})

describe('auditMedia — referencias vs assets', () => {
  it('cuenta como sincronizada solo la coincidencia exacta de URL', () => {
    const a = asset('portfolio/en-uso/a')
    const r = run({
      rows: [{ key: 'hero.img', value: a.secure_url }],
      listing: { resources: [a], complete: true },
    })

    expect(r.matching.map((m) => m.cloudinaryId)).toEqual(['portfolio/en-uso/a'])
    expect(r.missing).toHaveLength(0)
    expect(r.stale).toHaveLength(0)
  })

  it('repara la URL muerta cuando hay UN solo asset con ese nombre', () => {
    const moved = asset('portfolio/sin-usar/a')
    const r = run({
      rows: [{ key: 'hero.img', value: `${CLOUD}/portfolio/en-uso/a.webp` }],
      listing: { resources: [moved], complete: true },
    })

    expect(r.stale).toHaveLength(1)
    expect(r.repairs).toEqual([{ key: 'hero.img', url: moved.secure_url }])
    expect(r.matching).toHaveLength(0)
  })

  it('NO adivina cuando dos assets comparten nombre: la referencia queda rota', () => {
    /* Este es el falso negativo que hacía pasar por "synced" a una referencia
       muerta: el mapa por nombre base se quedaba con el primer asset y no
       chequeaba ambigüedad, así que cualquier URL con ese nombre matcheaba. */
    const r = run({
      rows: [{ key: 'hero.img', value: `${CLOUD}/portfolio/basurero/a.webp` }],
      listing: {
        resources: [asset('portfolio/en-uso/a'), asset('portfolio/sin-usar/a')],
        complete: true,
      },
    })

    expect(r.matching).toHaveLength(0)
    expect(r.repairs).toHaveLength(0)
    expect(r.missing).toHaveLength(1)
    expect(r.findings.find((f) => f.kind === 'missing-cloudinary')?.detail).toContain('ambiguo')
    // Ambiguo NO es purgable: el archivo existe, lo que falta es decidir cuál.
    expect(r.deadKeys).toHaveLength(0)
  })

  it('no confunde dos contenedores distintos que apuntan al mismo nombre', () => {
    const a = asset('portfolio/en-uso/a')
    const r = run({
      rows: [
        { key: 'hero.img', value: a.secure_url },
        { key: 'about.img', value: `${CLOUD}/portfolio/basurero/a.webp` },
      ],
      listing: { resources: [a], complete: true },
    })

    // El exacto matchea; el otro se reporta como reparable, no como sincronizado.
    expect(r.matching.map((m) => m.url)).toEqual([a.secure_url])
    expect(r.stale.map((s) => s.url)).toEqual([`${CLOUD}/portfolio/basurero/a.webp`])
  })
})

describe('auditMedia — lo que la web muestra y el índice no', () => {
  it('detecta el contenedor que vive en cms_data pero falta en el índice', () => {
    /* La auditoría vieja comparaba contra `used_content`, no contra `cms_data`:
       un contenedor fuera del índice era invisible aunque la web lo pintara. */
    const a = asset('portfolio/en-uso/a')
    const r = run({
      rows: [{ key: 'hero.img', value: a.secure_url }],
      listing: { resources: [a], complete: true },
    })

    expect(r.findings.filter((f) => f.kind === 'index-drift')).toHaveLength(1)
    expect(r.nextUsed['hero.img'].src).toBe(a.secure_url)
    expect(r.indexChanged).toBe(true)
  })

  it('audita también las rutas locales /uploads/ y las marca fantasma si no existen', () => {
    const r = run({
      rows: [
        { key: 'hero.img', value: '/uploads/vivo.webp' },
        { key: 'about.img', value: '/uploads/muerto.webp' },
      ],
      localAssetExists: (p) => p === '/uploads/vivo.webp',
    })

    expect(r.ghostKeys).toEqual(['about.img'])
    expect(r.missing.map((m) => m.url)).toEqual(['/uploads/muerto.webp'])
  })

  it('no marca fantasma a los campos de TEXTO del índice', () => {
    const index: CmsIndex = {
      ...EMPTY_INDEX,
      usedContent: {
        'char#1::name': {
          key: 'char#1::name', label: 'Name', section: 'Characters', kind: 'text',
          src: 'Lucia', name: 'Lucia', size: null, original: false,
        },
      },
    }
    const r = run({ index })

    expect(r.findings.filter((f) => f.kind === 'ghost')).toHaveLength(0)
    expect(r.nextUsed['char#1::name']).toBeDefined()
  })
})

describe('auditMedia — huérfanos', () => {
  it('lo que está en el índice como sin-usar no es huérfano', () => {
    const a = asset('portfolio/sin-usar/a', { tags: ['state:sin-usar'], state: 'unused' })
    const r = run({
      listing: { resources: [a], complete: true },
      index: { ...EMPTY_INDEX, unused: [{ src: a.secure_url, name: 'a.webp' }] },
    })

    expect(r.orphaned).toHaveLength(0)
    expect(r.matching.map((m) => m.state)).toEqual(['unused'])
  })

  it('lo que no conoce ni cms_data ni el índice sí es huérfano', () => {
    const a = asset('portfolio/sin-usar/suelto', { tags: ['state:sin-usar'], state: 'unused' })
    const r = run({ listing: { resources: [a], complete: true } })

    expect(r.orphaned.map((o) => o.publicId)).toEqual(['portfolio/sin-usar/suelto'])
  })
})

describe('auditMedia — balance comparable con Cloudinary', () => {
  it('cuenta ARCHIVOS sincronizados, no referencias: un archivo en tres contenedores es uno', () => {
    /* Era el origen del "repositorio 208 / 220 sincronizados": `matching`
       llevaba una fila por contenedor, así que un archivo reusado inflaba la
       cifra y no se podía comparar con el total del repositorio. */
    const a = asset('portfolio/en-uso/a')
    const r = run({
      rows: [
        { key: 'hero.img', value: a.secure_url },
        { key: 'about.img', value: a.secure_url },
        { key: 'proj#x', value: a.secure_url },
      ],
      listing: { resources: [a], complete: true },
    })

    expect(r.matching).toHaveLength(1)
    expect(r.matching[0].uses).toBe(3)
    expect(r.checked).toBe(3) // las referencias se siguen contando aparte
  })

  it('pesa las dos puntas sobre los originales y separa lo que no puede medir', () => {
    const a = asset('portfolio/en-uso/a', { bytes: 1500 })
    const b = asset('portfolio/sin-usar/b', { bytes: 2500, tags: ['state:sin-usar'], state: 'unused' })
    const r = run({
      rows: [{ key: 'hero.img', value: a.secure_url }],
      listing: { resources: [a, b], complete: true },
      index: {
        ...EMPTY_INDEX,
        unused: [{ key: 'old.img', src: b.secure_url, size: 0 }],
      },
    })

    expect(r.cloudinaryAssets).toBe(2)
    expect(r.cloudinaryBytes).toBe(4000)
    expect(r.indexedFiles).toBe(2)
    // El peso sale del listado de Cloudinary aunque el índice traiga size 0.
    expect(r.indexedBytes).toBe(4000)
    expect(r.indexedUnknown).toBe(0)
  })

  it('no suma como 0 los archivos sin tamaño: los cuenta aparte', () => {
    const r = run({
      index: {
        ...EMPTY_INDEX,
        trash: [{ key: 'gone.img', src: '/uploads/local-a.webp' }],
      },
      localAssetExists: () => true,
    })

    expect(r.indexedFiles).toBe(1)
    expect(r.indexedBytes).toBe(0)
    expect(r.indexedUnknown).toBe(1)
  })
})

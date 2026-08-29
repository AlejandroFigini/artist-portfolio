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
    /* `indexedFiles` cuenta lo que el PANEL muestra hoy, que es lo que el admin
       compara contra Cloudinary. `a` lo referencia un contenedor pero el índice
       todavía no lo registró: eso es `index-drift`, se repara, y hasta entonces
       la cifra del panel tiene que quedar corta — que es justamente el síntoma
       del que se parte. */
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
    expect(r.indexedFiles).toBe(1)
    // El peso sale del listado de Cloudinary aunque el índice traiga size 0.
    expect(r.indexedBytes).toBe(2500)
    expect(r.indexedUnknown).toBe(0)
    expect(r.balance.balanced).toBe(false)
    expect(r.balance.match.used).toBe(false)
    expect(r.balance.match.unused).toBe(true)
  })

  it('con el índice al día las dos puntas dan exactamente lo mismo', () => {
    const a = asset('portfolio/en-uso/a', { bytes: 1500 })
    const b = asset('portfolio/sin-usar/b', { bytes: 2500, tags: ['state:sin-usar'], state: 'unused' })
    const c = asset('portfolio/basurero/c', { bytes: 700, tags: ['state:basurero'], state: 'trash' })
    const r = run({
      rows: [{ key: 'hero.img', value: a.secure_url }],
      listing: { resources: [a, b, c], complete: true },
      index: {
        ...EMPTY_INDEX,
        usedContent: {
          'hero.img': {
            key: 'hero.img', label: 'Hero', section: 'Home', kind: 'image',
            src: a.secure_url, name: 'a.webp', size: 1500, original: false,
          },
        },
        unused: [{ src: b.secure_url, size: 2500 }],
        trash: [{ src: c.secure_url, size: 700 }],
      },
    })

    expect(r.balance.balanced).toBe(true)
    expect(r.balance.cloudinary).toEqual(r.balance.panel)
    expect(r.matching).toHaveLength(3)
    expect(r.stateDrift).toHaveLength(0)
    expect(r.orphaned).toHaveLength(0)
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

describe('auditMedia — el veredicto es una comparación de conjuntos', () => {
  /* Los casos que la auditoría vieja daba por "todo sincronizado". Cada uno es
     dos números distintos: no puede volver a pasar por bueno. */

  it('detecta el archivo que el panel muestra en sin-usar y Cloudinary tiene en en-uso', () => {
    /* El bug reportado. `expected = referenced ? "used" : r.state` volvía la
       condición `r.state !== r.state` para todo asset no referenciado, así que
       este archivo no producía un solo hallazgo. */
    const a = asset('portfolio/en-uso/a', { bytes: 1000, tags: ['state:en-uso'], state: 'used' })
    const r = run({
      listing: { resources: [a], complete: true },
      index: { ...EMPTY_INDEX, unused: [{ src: a.secure_url, size: 1000 }] },
    })

    expect(r.stateDrift).toHaveLength(1)
    expect(r.stateDrift[0].cloudinaryId).toBe('portfolio/en-uso/a')
    expect(r.matching).toHaveLength(0)
    expect(r.balance.balanced).toBe(false)
    expect(r.balance.match.used).toBe(false)
    expect(r.balance.match.unused).toBe(false)
    // El índice manda para sin-usar/basurero: se corrige el tag, no el panel.
    expect(r.drift).toEqual([{ url: a.secure_url, state: 'unused' }])
  })

  it('nunca da balanceado si un apartado tiene un archivo de más', () => {
    const a = asset('portfolio/sin-usar/a', { bytes: 1000, tags: ['state:sin-usar'], state: 'unused' })
    const extra = asset('portfolio/sin-usar/extra', { bytes: 400, tags: ['state:sin-usar'], state: 'unused' })
    const r = run({
      listing: { resources: [a, extra], complete: true },
      index: { ...EMPTY_INDEX, unused: [{ src: a.secure_url, size: 1000 }] },
    })

    expect(r.balance.cloudinary.unused.files).toBe(2)
    expect(r.balance.panel.unused.files).toBe(1)
    expect(r.balance.balanced).toBe(false)
    // Y la reparación lo adopta, así que la próxima corrida SÍ cierra.
    expect(r.adopted).toBe(1)
    expect(r.nextUnused.map((e) => e.src)).toContain(extra.secure_url)
  })

  it('el peso lo pone Cloudinary: un tamaño viejo en el índice no descuadra nada', () => {
    const a = asset('portfolio/sin-usar/a', { bytes: 1000, tags: ['state:sin-usar'], state: 'unused' })
    const r = run({
      listing: { resources: [a], complete: true },
      /* El índice guarda un tamaño viejo. Antes ese número era el que pintaba la
         barra lateral y nadie lo contrastaba nunca contra Cloudinary. */
      index: { ...EMPTY_INDEX, unused: [{ src: a.secure_url, size: 999999 }] },
    })

    expect(r.balance.panel.unused.bytes).toBe(1000)
    expect(r.balance.cloudinary.unused.bytes).toBe(1000)
    expect(r.balance.balanced).toBe(true)
  })

  it('el CV y demás media de ajustes van a su propia fila, no descuadran en-uso', () => {
    /* Era el 140 vs 141: el CV está en `portfolio/en-uso` y NUNCA entra a
       `used_content` (el picker lo excluye a propósito). */
    const cv = asset('portfolio/en-uso/cv', { bytes: 2000, resource_type: 'raw', format: 'pdf' })
    const img = asset('portfolio/en-uso/a', { bytes: 1000 })
    const r = run({
      rows: [
        { key: 'settings.cvUrl', value: cv.secure_url },
        { key: 'hero.img', value: img.secure_url },
      ],
      listing: { resources: [cv, img], complete: true },
      index: {
        ...EMPTY_INDEX,
        usedContent: {
          'hero.img': {
            key: 'hero.img', label: 'Hero', section: 'Home', kind: 'image',
            src: img.secure_url, name: 'a.webp', size: 1000, original: false,
          },
        },
      },
    })

    expect(r.balance.cloudinary.used).toEqual({ files: 1, bytes: 1000 })
    expect(r.balance.cloudinary.settings).toEqual({ files: 1, bytes: 2000 })
    expect(r.balance.panel.settings).toEqual({ files: 1, bytes: 2000 })
    expect(r.balance.balanced).toBe(true)
    expect(r.orphaned).toHaveLength(0)
  })

  it('saca de en-uso lo que ningún contenedor referencia y lo baja a sin-usar', () => {
    /* `used_content` no tenía quién lo limpiara: una entrada cuyo contenedor se
       vació seguía sumando a la barra lateral para siempre. */
    const a = asset('portfolio/en-uso/a', { bytes: 1000 })
    const r = run({
      rows: [],
      listing: { resources: [a], complete: true },
      index: {
        ...EMPTY_INDEX,
        usedContent: {
          'hero.img': {
            key: 'hero.img', label: 'Hero', section: 'Home', kind: 'image',
            src: a.secure_url, name: 'a.webp', size: 1000, original: false,
          },
        },
      },
    })

    expect(Object.keys(r.nextUsed)).toHaveLength(0)
    expect(r.nextUnused.map((e) => e.src)).toEqual([a.secure_url])
    expect(r.findings.some((f) => f.kind === 'index-drift')).toBe(true)
  })
})

describe('auditMedia — una reparación alcanza', () => {
  /* La garantía que se le pide al sistema: correr la auditoría, aplicar lo que
     dice, y que la segunda corrida dé balanceado. Sin esto el admin repara,
     vuelve a comparar y sigue viendo diferencias — que es como empezó todo. */

  const STATE_TAG: Record<string, string> = {
    used: 'state:en-uso', unused: 'state:sin-usar', trash: 'state:basurero',
  }

  /** Reaplica sobre el listado los tags que el informe pide alinear. */
  function applyDrift(resources: AuditAsset[], drift: { url: string; state: string }[]): AuditAsset[] {
    const byUrl = new Map(drift.map((d) => [d.url.split('?')[0], d.state]))
    return resources.map((r) => {
      const next = byUrl.get(r.secure_url.split('?')[0])
      if (!next) return r
      return { ...r, tags: [STATE_TAG[next]], state: next as AuditAsset['state'] }
    })
  }

  it('converge en UNA pasada partiendo de un índice roto de todas las formas a la vez', () => {
    const inUse = asset('portfolio/en-uso/hero', { bytes: 1200 })
    // Cloudinary lo tiene en en-uso; el panel lo muestra en sin-usar.
    const misfiled = asset('portfolio/en-uso/misfiled', { bytes: 800 })
    // Existe en Cloudinary y el panel no lo tiene en ningún apartado.
    const unknown = asset('portfolio/sin-usar/unknown', { bytes: 300, tags: ['state:sin-usar'], state: 'unused' })
    // El índice lo da por en uso y ningún contenedor lo referencia.
    const orphanUsed = asset('portfolio/en-uso/dropped', { bytes: 500 })
    // Media de ajustes: en uso, fuera de la galería.
    const cv = asset('portfolio/en-uso/cv', { bytes: 2000, resource_type: 'raw', format: 'pdf' })

    const resources = [inUse, misfiled, unknown, orphanUsed, cv]
    const rows = [
      { key: 'hero.img', value: inUse.secure_url },
      { key: 'settings.cvUrl', value: cv.secure_url },
    ]
    const index: CmsIndex = {
      usedContent: {
        'hero.img': {
          key: 'hero.img', label: 'Hero', section: 'Home', kind: 'image',
          src: inUse.secure_url, name: 'hero.webp', size: 1200, original: false,
        },
        'gone.img': {
          key: 'gone.img', label: 'Gone', section: 'Home', kind: 'image',
          src: orphanUsed.secure_url, name: 'dropped.webp', size: 500, original: false,
        },
      },
      unused: [{ src: misfiled.secure_url, size: 800 }],
      trash: [],
      mediaMeta: {},
    }

    const first = run({ rows, listing: { resources, complete: true }, index })
    expect(first.balance.balanced).toBe(false)

    // Se aplica lo que el informe pide: índice nuevo + tags alineados.
    const second = auditMedia({
      rows,
      listing: { resources: applyDrift(resources, first.drift), complete: true },
      index: {
        usedContent: first.nextUsed,
        unused: first.nextUnused,
        trash: first.nextTrash,
        mediaMeta: {},
      },
      localAssetExists: () => false,
    })

    expect(second.balance.balanced).toBe(true)
    expect(second.balance.cloudinary).toEqual(second.balance.panel)
    expect(second.stateDrift).toHaveLength(0)
    expect(second.orphaned).toHaveLength(0)
    expect(second.drift).toHaveLength(0)
    expect(second.adopted).toBe(0)
    // Los cinco archivos quedan contados una sola vez, en el apartado correcto.
    expect(second.matching).toHaveLength(5)
    expect(second.balance.panel.used.files).toBe(1)
    expect(second.balance.panel.unused.files).toBe(3)
    expect(second.balance.panel.settings.files).toBe(1)
  })
})

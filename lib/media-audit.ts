import type { MediaState } from '@/lib/storage'

/* Clasificación pura DB ↔ Cloudinary.
   Sin I/O: recibe lo ya leído (filas de `cms_data`, listado de Cloudinary,
   índice de `cms_state`) y devuelve el veredicto + las reparaciones a aplicar.
   Vive fuera del route handler para poder testearla sin base ni credenciales,
   que es exactamente lo que impedía cubrir los casos que se rompían en prod. */

export type AuditAsset = {
  public_id: string
  secure_url: string
  resource_type: string
  format: string
  bytes: number
  folder: string
  tags: string[]
  state: MediaState | null
}

/* Un listado incompleto NO es un listado vacío. `complete` es la única forma de
   distinguir "Cloudinary no tiene nada" de "la lectura falló a la mitad", y de
   eso depende si clasificar es seguro o destructivo. */
export type AuditListing = { resources: AuditAsset[]; complete: boolean }

export type CmsRow = { key: string; value: string }

export type UsedEntry = {
  key: string; label: string; section: string; kind: 'image' | 'video' | 'text'
  src: string; name: string; size: number | null; original: boolean; ts?: number; type?: string
}
export type LooseEntry = { key?: string; src?: string; dataUrl?: string; [k: string]: unknown }
export type MediaMetaRow = { name?: string; size?: number; type?: string; ts?: number; label?: string; section?: string }

export type CmsIndex = {
  usedContent: Record<string, UsedEntry>
  unused: LooseEntry[]
  trash: LooseEntry[]
  mediaMeta: Record<string, MediaMetaRow>
}

export type Finding = {
  kind: 'url-stale' | 'state-drift' | 'untagged' | 'orphan-cloudinary' | 'missing-cloudinary' | 'index-drift' | 'ghost'
  key?: string
  url?: string
  publicId?: string
  detail: string
  fixedTo?: string
}

/* Vistas para el panel de auditoría: las mismas conclusiones, agrupadas por lo
   que el admin necesita ver. No agregan lógica, sólo forma. */
export type AuditViews = {
  /* Un archivo por fila, NO una por contenedor: `uses` dice en cuántos
     contenedores está. Contar referencias hacía que "sincronizados" superara
     al total del repositorio (220 vs 208) y las dos cifras no se pudieran
     comparar con lo que reporta Cloudinary. */
  matching: { url: string; name: string; state: string; cloudinaryId: string; uses: number }[]
  stale: { url: string; name: string; state: string; section: string; cloudinaryId: string; fixedTo: string }[]
  missing: { url: string; name: string; state: string; section: string }[]
  orphaned: { url: string; publicId: string; resourceType: string; format: string; bytes: number; folder: string }[]
  stateDrift: { url: string; name: string; state: string; section: string; cloudinaryId: string; actualFolder: string; expectedFolder: string }[]
}

export type AuditReport = AuditViews & {
  checked: number
  cloudinaryAssets: number
  /* Bytes de los assets ORIGINALES que Cloudinary lista. No coincide con el
     total de la consola de Cloudinary y no tiene por qué: ahí también entran
     las variantes derivadas (los recortes que genera cada transformación) y
     los backups, que el CMS ni conoce ni administra. Esta es la cifra
     comparable contra el peso del repositorio. */
  cloudinaryBytes: number
  /** Archivos ÚNICOS que el índice del panel sostiene (no referencias). */
  indexedFiles: number
  /** Bytes que el índice cree tener. `indexedUnknown` son los que no sabe pesar. */
  indexedBytes: number
  indexedUnknown: number
  findings: Finding[]
  counts: Record<string, number>
  /** `cms_data` que apunta a una URL muerta pero con el asset vivo en otro lado. */
  repairs: { key: string; url: string }[]
  /** Tags de estado a alinear en Cloudinary. */
  drift: { url: string; state: MediaState }[]
  /** Contenedores con ruta local muerta (`/uploads/...`). */
  ghostKeys: string[]
  /** Contenedores con URL de Cloudinary sin asset detrás y sin candidato. */
  deadKeys: string[]
  /** Cuántas URLs distintas sostiene algún contenedor. 0 con contenido en el
   *  índice es la señal de que algo salió mal, no de que no haya nada. */
  referencedSrcCount: number
  nextUsed: Record<string, UsedEntry>
  nextUnused: LooseEntry[]
  nextTrash: LooseEntry[]
  indexChanged: boolean
}

export type AuditInput = {
  rows: CmsRow[]
  listing: AuditListing
  index: CmsIndex
  /** Existencia de una ruta `/uploads/...`. Inyectado: fs en local, `false`
   *  cuando el almacenamiento real es Cloudinary. */
  localAssetExists: (relPath: string) => boolean
}

/** Identidad de una URL para comparar: sin query ni fragmento. */
export function srcKey(v: string): string {
  return (v || '').split('?')[0].split('#')[0]
}

/** Un valor de `cms_data` que apunta a un archivo (no texto, no color, no fecha). */
export function isMediaValue(v: unknown): v is string {
  return typeof v === 'string' && (v.includes('res.cloudinary.com') || v.startsWith('/uploads/'))
}

/** Nombre de archivo del public_id, sin carpeta ni extensión. Es lo único estable
 *  entre una URL vieja (con la carpeta adentro) y el asset ya movido. */
export function basenameOf(publicIdOrUrl: string): string {
  const last = srcKey(publicIdOrUrl).split('/').pop() || ''
  return last.replace(/\.[a-zA-Z0-9]+$/, '').toLowerCase()
}

/** Carpeta visual que corresponde a un estado. Etiqueta legible, no mecanismo. */
const FOLDER_BY_STATE: Record<MediaState, string> = {
  used: 'portfolio/en-uso', unused: 'portfolio/sin-usar', trash: 'portfolio/basurero',
}

export class IncompleteListingError extends Error {
  constructor() {
    super('El listado de Cloudinary está incompleto: lectura no concluyente, se aborta')
    this.name = 'IncompleteListingError'
  }
}

export function auditMedia({ rows, listing, index, localAssetExists }: AuditInput): AuditReport {
  /* Único motivo para abortar. Un listado VACÍO pero completo es un dato válido
     —es el estado real después de vaciar Cloudinary— y clasificarlo es correcto:
     todas las referencias están rotas y hay que poder verlo. Lo que nunca se
     puede clasificar es un listado del que no se sabe si está entero. */
  if (!listing.complete) throw new IncompleteListingError()

  const resources = listing.resources
  const refs = rows.filter((r) => typeof r.value === 'string' && r.value.includes('res.cloudinary.com'))

  const byUrl = new Map(resources.map((r) => [srcKey(r.secure_url), r]))
  const byBasename = new Map<string, AuditAsset[]>()
  for (const r of resources) {
    const b = basenameOf(r.public_id)
    if (!byBasename.has(b)) byBasename.set(b, [])
    byBasename.get(b)!.push(r)
  }

  const findings: Finding[] = []
  // Un asset puede estar referenciado por varios contenedores (refcount).
  const referenced = new Set<string>()
  const repairs: { key: string; url: string }[] = []
  const deadKeys: string[] = []

  const { mediaMeta } = index
  const metaOf = (url: string): MediaMetaRow => mediaMeta[srcKey(url)] || mediaMeta[url] || {}
  const nameOf = (url: string, key?: string): string => {
    const mm = metaOf(url)
    return mm.label || mm.name || decodeURIComponent(srcKey(url).split('/').pop() || '') || key || ''
  }
  const sectionOf = (url: string): string => metaOf(url).section || ''

  /* Indexado por URL: el mismo archivo puede estar en varios contenedores y
     acá se cuenta UNA vez. */
  const matchingByUrl = new Map<string, AuditViews['matching'][number]>()
  const addMatch = (url: string, row: Omit<AuditViews['matching'][number], 'uses'>) => {
    const id = srcKey(url)
    const prev = matchingByUrl.get(id)
    if (prev) { prev.uses += 1; return }
    matchingByUrl.set(id, { ...row, uses: 1 })
  }
  const stale: AuditViews['stale'] = []
  const missing: AuditViews['missing'] = []

  for (const { key, value } of refs) {
    const clean = srcKey(value)
    const hit = byUrl.get(clean)
    if (hit) {
      referenced.add(hit.public_id)
      addMatch(value, { url: value, name: nameOf(value, key), state: 'used', cloudinaryId: hit.public_id })
      continue
    }
    /* La URL guardada no existe en Cloudinary. Buscar el mismo archivo en otra
       carpeta: es exactamente el daño que dejaba el rename al mover de estado.
       Con más de un candidato NO se elige: dos assets distintos con el mismo
       nombre no son el mismo archivo, y adivinar acá es lo que hacía pasar por
       "sincronizada" a una referencia muerta. */
    const candidates = byBasename.get(basenameOf(clean)) || []
    if (candidates.length === 1) {
      const target = candidates[0]
      referenced.add(target.public_id)
      findings.push({
        kind: 'url-stale', key, url: value, publicId: target.public_id,
        detail: `el asset existe en ${target.public_id}, la DB apunta a una URL muerta`,
        fixedTo: target.secure_url,
      })
      repairs.push({ key, url: target.secure_url })
      stale.push({
        url: value, name: nameOf(value, key), state: 'used', section: sectionOf(value),
        cloudinaryId: target.public_id, fixedTo: target.secure_url,
      })
    } else {
      const detail = candidates.length === 0
        ? 'no existe ningún asset con ese nombre en Cloudinary'
        : `${candidates.length} candidatos con el mismo nombre: ambiguo, requiere decisión manual`
      findings.push({ kind: 'missing-cloudinary', key, url: value, detail })
      /* Sólo es purgable si NO hay ningún archivo con ese nombre. Con varios
         candidatos el archivo probablemente exista y lo que falta es decidir
         cuál: vaciar el contenedor ahí destruye la referencia en vez de
         resolverla. Se reporta, no se toca. */
      if (candidates.length === 0) deadKeys.push(key)
      missing.push({ url: value, name: nameOf(value, key), state: 'used', section: sectionOf(value) })
    }
  }

  /* Estado esperado: referenciado ⇒ used. El tag solo decide sin-usar vs basurero
     para los NO referenciados.
     `hasStateTag` distingue "tiene tag" de "se dedujo de la carpeta": los assets
     subidos antes de que el estado viviera en tags no tienen ninguno y hay que
     escribirles el que corresponde (backfill), aunque su estado deducido ya sea
     el correcto. Mientras no se haga, conviven los dos mecanismos. */
  const drift: { url: string; state: MediaState }[] = []
  const stateDrift: AuditViews['stateDrift'] = []
  for (const r of resources) {
    const hasStateTag = r.tags.some((t) => t.startsWith('state:'))
    const expected: MediaState | null = referenced.has(r.public_id) ? 'used' : r.state

    if (!expected) {
      findings.push({ kind: 'orphan-cloudinary', publicId: r.public_id, url: r.secure_url, detail: 'no referenciado y sin tag ni carpeta que lo clasifique' })
      continue
    }
    if (!hasStateTag) {
      findings.push({
        kind: 'untagged', publicId: r.public_id, url: r.secure_url,
        detail: `sin tag de estado; se deduce ${expected} (${referenced.has(r.public_id) ? 'referenciado' : 'por carpeta'})`,
      })
      drift.push({ url: r.secure_url, state: expected })
      continue
    }
    if (r.state !== expected) {
      findings.push({
        kind: 'state-drift', publicId: r.public_id, url: r.secure_url,
        detail: `referenciado por un contenedor pero marcado como ${r.state ?? 'sin estado'}`,
      })
      drift.push({ url: r.secure_url, state: expected })
      stateDrift.push({
        url: r.secure_url, name: nameOf(r.secure_url), state: expected, section: sectionOf(r.secure_url),
        cloudinaryId: r.public_id,
        actualFolder: r.state ? FOLDER_BY_STATE[r.state] : r.folder || '—',
        expectedFolder: FOLDER_BY_STATE[expected],
      })
    }
  }

  /* ---- Índice del CMS (cms_state) ----------------------------------------
     La regla adoptada: un asset referenciado por al menos un valor de `cms_data`
     está EN USO, punto. Si además figura en `unused`/`trash`, el índice se
     contradice a sí mismo: el panel lo ofrece como descartable mientras un
     contenedor lo está mostrando, y vaciar la papelera después destruiría los
     bytes. El tag de Cloudinary ya se alinea arriba; acá se alinea el índice.
     Se toma la URL FINAL (después de la reparación de `url-stale`), si no se
     compararía contra una URL que este mismo run está por reescribir. */
  const fixedByKey = new Map(repairs.map((r) => [r.key, r.url]))
  const referencedSrcs = new Set<string>()
  const refByKey = new Map<string, string>()
  for (const r of rows) {
    if (!isMediaValue(r.value)) continue
    const url = fixedByKey.get(r.key) || r.value
    /* Los archivos de AJUSTES (CV, favicon, icono de buscador) cuentan como
       referenciados —no se pueden descartar— pero NO son contenido de galería:
       no van al índice de la biblioteca. Sin esta distinción esta reparación
       metía el CV en `used_content`, que es justo lo que el picker excluye. */
    referencedSrcs.add(srcKey(url))
    if (r.key.startsWith('settings.')) continue
    refByKey.set(r.key, url)
  }

  const { usedContent, unused: unusedList, trash: trashList } = index
  const entrySrc = (e: LooseEntry) => srcKey((e.src || e.dataUrl || '') as string)

  // 1) Lo referenciado no puede estar en sin-usar ni en papelera.
  const nextUnused = unusedList.filter((e) => !referencedSrcs.has(entrySrc(e)))
  const nextTrash = trashList.filter((e) => !referencedSrcs.has(entrySrc(e)))
  for (const e of [...unusedList, ...trashList]) {
    if (!referencedSrcs.has(entrySrc(e))) continue
    findings.push({
      kind: 'index-drift', url: entrySrc(e),
      detail: 'figura como descartable en el índice pero un contenedor lo está usando',
    })
  }

  /* 2) Lo referenciado tiene que estar en `used_content`, si no desaparece del
        panel. Sacarlo de `unused` sin agregarlo acá lo volvería invisible. */
  const nextUsed: Record<string, UsedEntry> = { ...usedContent }
  for (const [key, url] of refByKey) {
    if (nextUsed[key] && srcKey(nextUsed[key].src) === srcKey(url)) continue
    const mm = metaOf(url)
    const fileName = decodeURIComponent(srcKey(url).split('/').pop() || '')
    const isVideo = /\.(webm|mp4|mov|m4v)$/i.test(fileName) || url.includes('/video/upload/')
    findings.push({
      kind: 'index-drift', key, url,
      detail: nextUsed[key] ? 'el índice apunta a otra URL que el contenedor' : 'un contenedor lo usa pero no figura en el índice',
    })
    nextUsed[key] = {
      key,
      label: mm.label || nextUsed[key]?.label || fileName,
      section: mm.section || nextUsed[key]?.section || '',
      kind: isVideo ? 'video' : 'image',
      src: url,
      name: mm.name || fileName,
      size: mm.size ?? nextUsed[key]?.size ?? null,
      original: nextUsed[key]?.original ?? false,
      ts: mm.ts ?? nextUsed[key]?.ts,
      type: mm.type ?? nextUsed[key]?.type,
    }
  }

  /* ---- 3) Fantasmas: lo que la web muestra y no existe en ningún lado ------
     El requisito es que la web y Cloudinary coincidan. Una entrada del índice o
     una referencia de `cms_data` que apunta a bytes inexistentes rompe eso: el
     panel la cuenta como contenido real y no hay archivo detrás. */
  const assetExists = (raw: string): boolean => {
    const clean = srcKey(raw)
    if (!clean) return false
    if (clean.includes('res.cloudinary.com')) {
      if (byUrl.has(clean)) return true
      return (byBasename.get(basenameOf(clean)) || []).length === 1
    }
    if (clean.startsWith('/uploads/')) return localAssetExists(clean)
    // Ni URL de Cloudinary ni ruta de subida: no es un archivo.
    return false
  }

  // 3a) Referencias de `cms_data` a media inexistente. Solo valores que SON media:
  //     un texto suelto no es una referencia rota, es contenido.
  const ghostKeys: string[] = []
  for (const r of rows) {
    if (!isMediaValue(r.value)) continue
    if (fixedByKey.has(r.key)) continue // este run ya lo repara a una URL viva
    if (assetExists(r.value)) continue
    if (r.value.includes('res.cloudinary.com')) continue // ya sale como missing-cloudinary
    ghostKeys.push(r.key)
    findings.push({
      kind: 'ghost', key: r.key, url: r.value,
      detail: 'el contenedor apunta a un archivo que no existe en el almacenamiento',
    })
    missing.push({ url: r.value, name: nameOf(r.value, r.key), state: 'used', section: sectionOf(r.value) })
  }

  // 3b) Entradas del índice sin archivo detrás. SOLO aplica a entradas de MEDIA:
  //     `used_content` también guarda campos de TEXTO (kind:'text') de contenedores
  //     con `fields` — char#xxx::name, proj#xxx::title, ::start_date — donde `.src`
  //     es el propio texto (un nombre, una fecha), no una URL. Sin este chequeo el
  //     detector marcaba "asd" (un nombre de personaje sin completar) como fantasma
  //     y `apply` lo habría BORRADO: texto real del sitio, no una referencia rota.
  const ghostEntry = (e: LooseEntry) => {
    if ((e as { kind?: string }).kind === 'text') return false
    const src = entrySrc(e)
    return !!src && !assetExists(src)
  }
  for (const e of [...Object.values(nextUsed) as LooseEntry[], ...nextUnused, ...nextTrash]) {
    if (!ghostEntry(e)) continue
    findings.push({
      kind: 'ghost', url: entrySrc(e), key: (e as { key?: string }).key,
      /* `key` solo existe para entradas de `used_content` (ahí es la clave del
         contenedor); `unused`/`trash` no tienen container asociado. Sin esto es
         imposible saber CUÁL contenedor sostiene el valor basura, y por lo tanto
         si algo (una pestaña abierta, el propio sitio) lo va a volver a escribir
         apenas sincronice su estado local. */
      detail: 'figura en el índice del panel pero no hay archivo detrás',
    })
  }

  const cleanUnused = nextUnused.filter((e) => !ghostEntry(e))
  const cleanTrash = nextTrash.filter((e) => !ghostEntry(e))
  const cleanUsed: Record<string, UsedEntry> = {}
  for (const [k, v] of Object.entries(nextUsed)) {
    if (ghostEntry(v as LooseEntry)) continue
    cleanUsed[k] = v
  }

  /* Lo que sigue vivo en el índice y existe en el almacenamiento también está
     sincronizado: el panel lo muestra como descartable y los bytes están. */
  for (const [state, list] of [['unused', cleanUnused] as const, ['trash', cleanTrash] as const]) {
    for (const e of list) {
      const src = entrySrc(e)
      const hit = src ? byUrl.get(src) : undefined
      if (!hit) continue
      addMatch(src, { url: src, name: (e.name as string) || (e.label as string) || nameOf(src), state, cloudinaryId: hit.public_id })
    }
  }

  /* Huérfanos para el panel: bytes en Cloudinary que el CMS no conoce por
     ninguna vía —ni contenedor ni índice—. Los que sí figuran como sin-usar o
     en papelera NO son huérfanos: están registrados, sólo que no en uso. */
  const indexedSrcs = new Set<string>()
  for (const e of [...Object.values(cleanUsed) as LooseEntry[], ...cleanUnused, ...cleanTrash]) {
    const src = entrySrc(e)
    if (src) indexedSrcs.add(src)
  }
  const orphaned: AuditViews['orphaned'] = []
  for (const r of resources) {
    if (referenced.has(r.public_id)) continue
    if (indexedSrcs.has(srcKey(r.secure_url))) continue
    orphaned.push({
      url: r.secure_url, publicId: r.public_id, resourceType: r.resource_type,
      format: r.format, bytes: r.bytes, folder: r.folder || (r.state ? FOLDER_BY_STATE[r.state] : ''),
    })
  }

  const indexChanged =
    cleanUnused.length !== unusedList.length ||
    cleanTrash.length !== trashList.length ||
    Object.keys(cleanUsed).length !== Object.keys(usedContent).length ||
    Object.entries(cleanUsed).some(([k, v]) => srcKey(usedContent[k]?.src || '') !== srcKey(v.src))

  /* Peso comparable de los dos lados. El del índice se arma sobre los archivos
     únicos —el mismo criterio del contador del repositorio— y se lleva aparte
     la cuenta de los que no tienen tamaño conocido: sumarlos como 0 es lo que
     hacía que el panel mostrara mucho menos de lo real sin decir por qué. */
  const bytesByUrl = new Map<string, number | null>()
  for (const e of [...Object.values(cleanUsed) as LooseEntry[], ...cleanUnused, ...cleanTrash]) {
    const src = entrySrc(e)
    if (!src || bytesByUrl.has(src)) continue
    const known = byUrl.get(src)?.bytes ?? (typeof e.size === 'number' ? e.size : null)
    bytesByUrl.set(src, known && known > 0 ? known : null)
  }
  let indexedBytes = 0
  let indexedUnknown = 0
  for (const n of bytesByUrl.values()) {
    if (n === null) indexedUnknown += 1
    else indexedBytes += n
  }

  const matching = [...matchingByUrl.values()]

  return {
    checked: refs.length,
    cloudinaryAssets: resources.length,
    cloudinaryBytes: resources.reduce((sum, r) => sum + (r.bytes || 0), 0),
    indexedFiles: bytesByUrl.size,
    indexedBytes,
    indexedUnknown,
    findings,
    counts: findings.reduce<Record<string, number>>((a, f) => ({ ...a, [f.kind]: (a[f.kind] || 0) + 1 }), {}),
    repairs,
    drift,
    ghostKeys,
    deadKeys,
    referencedSrcCount: referencedSrcs.size,
    nextUsed: cleanUsed,
    nextUnused: cleanUnused,
    nextTrash: cleanTrash,
    indexChanged,
    matching,
    stale,
    missing,
    orphaned,
    stateDrift,
  }
}

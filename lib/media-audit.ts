import type { MediaState } from '@/lib/storage'

/* Clasificación pura DB ↔ Cloudinary.
   Sin I/O: recibe lo ya leído (filas de `cms_data`, listado de Cloudinary,
   índice de `cms_state`) y devuelve el veredicto + las reparaciones a aplicar.
   Vive fuera del route handler para poder testearla sin base ni credenciales,
   que es exactamente lo que impedía cubrir los casos que se rompían en prod.

   REGLA DE ORO (la que faltaba): el veredicto "sincronizado" es una COMPARACIÓN
   DE CONJUNTOS, apartado por apartado. Si en-uso tiene 140 de un lado y 141 del
   otro, no está sincronizado — no importa qué diga ninguna heurística por
   archivo. Antes el único chequeo por archivo era `r.state !== expected` con
   `expected = referenced ? 'used' : r.state`, o sea que para todo asset NO
   referenciado la condición era `r.state !== r.state`: imposible de cumplir. Un
   archivo que Cloudinary tenía en `en-uso` y el panel mostraba en `sin-usar` no
   producía un solo hallazgo y la auditoría informaba "todo sincronizado". */

export type AuditAsset = {
  public_id: string
  secure_url: string
  resource_type: string
  format: string
  bytes: number
  folder: string
  tags: string[]
  state: MediaState | null
  created_at?: string
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

/* ----- Balance por apartado -------------------------------------------------
   Las cifras que el admin compara a ojo contra la consola de Cloudinary.
   `settings` existe porque el CV, el favicon, el video de la pantalla de carga
   y las animaciones decorativas SÍ están en uso pero NO son contenido de
   galería: no entran en `used_content` y por eso la barra lateral podía decir
   140 mientras `portfolio/en-uso` mostraba 141. Sacarlos a su propia fila hace
   que la resta cierre en vez de quedar como un misterio. */
export type BucketKey = 'used' | 'unused' | 'trash' | 'settings'
export const BUCKET_KEYS: BucketKey[] = ['used', 'unused', 'trash', 'settings']

export type Bucket = { files: number; bytes: number }
export type BucketSet = Record<BucketKey, Bucket>

export type Balance = {
  /** Lo que dice Cloudinary: un archivo por asset, clasificado por su tag. */
  cloudinary: BucketSet
  /** Lo que muestra el panel HOY (índice tal cual, sin reparar). */
  panel: BucketSet
  /** Por apartado: coinciden cantidad Y bytes. */
  match: Record<BucketKey, boolean>
  /** Archivos que el panel sostiene y Cloudinary no tiene: no se pueden pesar. */
  panelUnknown: number
  /** Todos los apartados coinciden y no hay archivos sin pesar. */
  balanced: boolean
}

const emptyBucketSet = (): BucketSet => ({
  used: { files: 0, bytes: 0 },
  unused: { files: 0, bytes: 0 },
  trash: { files: 0, bytes: 0 },
  settings: { files: 0, bytes: 0 },
})

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
  /** Comparación apartado por apartado. Es el veredicto real. */
  balance: Balance
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
  /** Assets de Cloudinary que el panel no conocía y la reparación adopta. */
  adopted: number
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

/** Nombre de archivo con extensión, para las entradas que la reparación crea. */
function fileNameOf(url: string): string {
  const last = srcKey(url).split('/').pop() || ''
  try { return decodeURIComponent(last) } catch { return last }
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
  /* URLs de `cms_data` que matchean EXACTO con un asset. Distinto de
     `gallerySrcs`, que ya trae la URL corregida de un `url-stale`: mientras la
     base no se reescriba esa referencia sigue rota y no puede figurar como
     sincronizada. */
  const exactRefSrcs = new Set<string>()
  const repairs: { key: string; url: string }[] = []
  const deadKeys: string[] = []

  const { mediaMeta } = index
  const metaOf = (url: string): MediaMetaRow => mediaMeta[srcKey(url)] || mediaMeta[url] || {}
  const nameOf = (url: string, key?: string): string => {
    const mm = metaOf(url)
    return mm.label || mm.name || fileNameOf(url) || key || ''
  }
  const sectionOf = (url: string): string => metaOf(url).section || ''

  const stale: AuditViews['stale'] = []
  const missing: AuditViews['missing'] = []

  /* ---- 1) `cms_data` → Cloudinary ---------------------------------------- */
  for (const { key, value } of refs) {
    const clean = srcKey(value)
    const hit = byUrl.get(clean)
    if (hit) { referenced.add(hit.public_id); exactRefSrcs.add(clean); continue }
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

  /* ---- 2) Qué archivo sostiene cada contenedor ---------------------------- */
  const fixedByKey = new Map(repairs.map((r) => [r.key, r.url]))
  const referencedSrcs = new Set<string>()
  const refByKey = new Map<string, string>()
  const refCount = new Map<string, number>()
  for (const r of rows) {
    if (!isMediaValue(r.value)) continue
    const url = fixedByKey.get(r.key) || r.value
    const id = srcKey(url)
    /* Los archivos de AJUSTES (CV, favicon, icono de buscador, animaciones
       decorativas, video de la pantalla de carga) cuentan como referenciados
       —no se pueden descartar— pero NO son contenido de galería: no van al
       índice de la biblioteca. Sin esta distinción esta reparación metía el CV
       en `used_content`, que es justo lo que el picker excluye. */
    referencedSrcs.add(id)
    if (r.key.startsWith('settings.')) continue
    refByKey.set(r.key, url)
    refCount.set(id, (refCount.get(id) || 0) + 1)
  }

  /* Archivos EN USO que no son contenido de galería. Es la fila que explica la
     diferencia entre "In use" de la barra lateral y `portfolio/en-uso`. */
  const gallerySrcs = new Set([...refByKey.values()].map(srcKey))
  const settingsSrcs = new Set([...referencedSrcs].filter((s) => !gallerySrcs.has(s)))

  /* ---- 3) Qué muestra el panel HOY --------------------------------------- */
  const { usedContent, unused: unusedList, trash: trashList } = index
  const entrySrc = (e: LooseEntry) => srcKey((e.src || e.dataUrl || '') as string)

  const panelUsed = new Set<string>()
  for (const e of Object.values(usedContent)) {
    // `used_content` también guarda campos de TEXTO: no son archivos.
    if (!e || e.kind === 'text' || !isMediaValue(e.src)) continue
    panelUsed.add(srcKey(e.src))
  }
  const panelUnused = new Set<string>()
  for (const e of unusedList) { const s = entrySrc(e); if (s && !panelUsed.has(s)) panelUnused.add(s) }
  const panelTrash = new Set<string>()
  for (const e of trashList) { const s = entrySrc(e); if (s && !panelUsed.has(s) && !panelUnused.has(s)) panelTrash.add(s) }

  /** Apartado que el PANEL muestra hoy para este archivo. `null` = no figura en
   *  ningún apartado. Es EXACTAMENTE lo que cuentan los badges de la barra
   *  lateral, y por eso es la columna con la que se compara: si acá dice 140 y
   *  Cloudinary 141, el balance tiene que dar distinto. */
  const panelBucketOf = (src: string): BucketKey | null => {
    if (settingsSrcs.has(src)) return 'settings'
    if (panelUsed.has(src)) return 'used'
    if (panelUnused.has(src)) return 'unused'
    if (panelTrash.has(src)) return 'trash'
    return null
  }

  /* Entradas de `used_content` que ningún contenedor de `cms_data` respalda.
     El paso 5c las baja a sin-usar, así que el estado canónico tiene que
     contemplarlas ACÁ o el tag se alinearía a `used` en esta corrida y a
     `unused` en la siguiente: dos pasadas para converger a lo mismo. */
  const staleUsed = new Set<string>(
    [...panelUsed].filter((src) => !gallerySrcs.has(src) && !settingsSrcs.has(src)),
  )

  /** Apartado que le corresponde según TODO lo que el CMS sabe, incluida una
   *  referencia de `cms_data` que el índice todavía no registró. Se usa para
   *  decidir huérfano / desincronizado: un archivo que un contenedor está
   *  mostrando no es un huérfano aunque falte en `used_content` — eso es
   *  `index-drift`, y se repara aparte. */
  const knownBucketOf = (src: string): BucketKey | null =>
    panelBucketOf(src) ?? (gallerySrcs.has(src) ? 'used' : null)

  /** Apartado en el que CLOUDINARY tiene este asset, según su tag de estado.
   *  Sin tag ni carpeta que lo clasifique cae en sin-usar: es descartable, que
   *  es el estado menos destructivo de los tres. */
  const cloudBucketOf = (r: AuditAsset): BucketKey => {
    if (settingsSrcs.has(srcKey(r.secure_url))) return 'settings'
    return (r.state ?? 'unused') as BucketKey
  }

  /* ---- 4) Estado canónico y alineación de tags ---------------------------
     Precedencia, en este orden y sin excepciones:
       1. lo referencia un contenedor de `cms_data` → EN USO. Es el único hecho
          verificable: hay una pantalla mostrándolo.
       2. el índice del panel lo tiene en sin-usar / basurero → manda el índice.
          Es la intención que el admin registró en NUESTRA base; el tag es un
          espejo que empujamos nosotros y que pudo fallar al escribirse. Al revés
          (que Cloudinary pise el índice) desharía en silencio un "mover a
          papelera" que el admin ya hizo.
       3. el panel no lo conoce → manda el tag de Cloudinary, y la reparación
          ADOPTA el archivo al índice. Es el caso que hacía que el repositorio
          mostrara 140 y Cloudinary 141: bytes que existen y el panel ignoraba. */
  const drift: { url: string; state: MediaState }[] = []
  const stateDrift: AuditViews['stateDrift'] = []
  const adoptable: AuditAsset[] = []

  const canonicalOf = (r: AuditAsset): MediaState => {
    const src = srcKey(r.secure_url)
    if (settingsSrcs.has(src) || referenced.has(r.public_id) || gallerySrcs.has(src)) return 'used'
    if (panelUnused.has(src)) return 'unused'
    if (panelTrash.has(src)) return 'trash'
    // Va a salir de "en uso" en este mismo run: el tag se alinea de una.
    if (staleUsed.has(src)) return 'unused'
    if (panelUsed.has(src)) return 'used'
    return r.state ?? 'unused'
  }

  for (const r of resources) {
    const src = srcKey(r.secure_url)
    const hasStateTag = r.tags.some((t) => t.startsWith('state:'))
    const expected = canonicalOf(r)
    const knownBucket = knownBucketOf(src)
    const cloudBucket = cloudBucketOf(r)

    if (knownBucket === null) {
      /* Bytes reales que el panel no cuenta. Se reportan como huérfanos (se
         pueden borrar desde el panel) y la reparación los adopta al índice para
         que las dos puntas den el mismo número. */
      adoptable.push(r)
      findings.push({
        kind: 'orphan-cloudinary', publicId: r.public_id, url: r.secure_url,
        detail: `existe en Cloudinary (${FOLDER_BY_STATE[expected]}) pero el panel no lo tiene en ningún apartado`,
      })
    }

    /* EL chequeo que faltaba, en sus dos formas: el apartado que muestra el
       panel no es el que dice Cloudinary, o el tag no es el que el estado
       canónico implica. Cualquiera de las dos es una desincronización visible y
       va como fila del informe. */
    const bucketsDisagree = knownBucket !== null && knownBucket !== 'settings' && knownBucket !== cloudBucket
    const tagIsWrong = hasStateTag && r.state !== expected
    if (bucketsDisagree || tagIsWrong) {
      findings.push({
        kind: 'state-drift', publicId: r.public_id, url: r.secure_url,
        detail: bucketsDisagree
          ? `el panel lo muestra en ${knownBucket} y Cloudinary lo tiene en ${cloudBucket}`
          : `debería estar en ${expected} y Cloudinary lo tiene tagueado como ${r.state ?? 'sin estado'}`,
      })
      stateDrift.push({
        url: r.secure_url, name: nameOf(r.secure_url), state: expected, section: sectionOf(r.secure_url),
        cloudinaryId: r.public_id,
        actualFolder: r.state ? FOLDER_BY_STATE[r.state] : r.folder || '—',
        expectedFolder: FOLDER_BY_STATE[expected],
      })
    }

    /* `hasStateTag` distingue "tiene tag" de "se dedujo de la carpeta": los
       assets subidos antes de que el estado viviera en tags no tienen ninguno y
       hay que escribirles el que corresponde (backfill), aunque su estado
       deducido ya sea el correcto. Mientras no se haga conviven los dos
       mecanismos y la carpeta puede contradecir al tag. */
    if (!hasStateTag) {
      findings.push({
        kind: 'untagged', publicId: r.public_id, url: r.secure_url,
        detail: `sin tag de estado; se deduce ${expected}`,
      })
      drift.push({ url: r.secure_url, state: expected })
    } else if (tagIsWrong) {
      drift.push({ url: r.secure_url, state: expected })
    }
  }

  /* ---- 5) Índice del CMS (cms_state) -------------------------------------
     La regla adoptada: un asset referenciado por al menos un valor de `cms_data`
     está EN USO, punto. Si además figura en `unused`/`trash`, el índice se
     contradice a sí mismo: el panel lo ofrece como descartable mientras un
     contenedor lo está mostrando, y vaciar la papelera después destruiría los
     bytes. El tag de Cloudinary ya se alinea arriba; acá se alinea el índice.
     Se toma la URL FINAL (después de la reparación de `url-stale`), si no se
     compararía contra una URL que este mismo run está por reescribir. */

  // 5a) Lo referenciado no puede estar en sin-usar ni en papelera.
  const nextUnused = unusedList.filter((e) => !referencedSrcs.has(entrySrc(e)))
  const nextTrash = trashList.filter((e) => !referencedSrcs.has(entrySrc(e)))
  for (const e of [...unusedList, ...trashList]) {
    if (!referencedSrcs.has(entrySrc(e))) continue
    findings.push({
      kind: 'index-drift', url: entrySrc(e),
      detail: 'figura como descartable en el índice pero un contenedor lo está usando',
    })
  }

  /* 5b) Lo referenciado tiene que estar en `used_content`, si no desaparece del
        panel. Sacarlo de `unused` sin agregarlo acá lo volvería invisible. */
  const nextUsed: Record<string, UsedEntry> = { ...usedContent }
  for (const [key, url] of refByKey) {
    if (nextUsed[key] && srcKey(nextUsed[key].src) === srcKey(url)) continue
    const mm = metaOf(url)
    const fileName = fileNameOf(url)
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

  /* 5c) Al revés: entradas de `used_content` cuyo contenedor ya NO las
        referencia en `cms_data`. El panel las seguía contando como "en uso"
        para siempre —nada las sacaba— así que la barra lateral sumaba archivos
        que ninguna pantalla muestra. El archivo no se pierde: baja a sin-usar,
        que es donde Cloudinary lo va a tener después de alinear el tag. */
  const demoted: string[] = []
  for (const [k, v] of Object.entries(nextUsed)) {
    if (!v || v.kind === 'text' || !isMediaValue(v.src)) continue
    const dbUrl = refByKey.get(k)
    if (dbUrl && srcKey(dbUrl) === srcKey(v.src)) continue
    delete nextUsed[k]
    demoted.push(srcKey(v.src))
    findings.push({
      kind: 'index-drift', key: k, url: v.src,
      detail: 'figura como en uso pero ningún contenedor de la base lo referencia',
    })
  }

  /* ---- 6) Fantasmas: lo que la web muestra y no existe en ningún lado ------
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

  // 6a) Referencias de `cms_data` a media inexistente. Solo valores que SON media:
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

  // 6b) Entradas del índice sin archivo detrás. SOLO aplica a entradas de MEDIA:
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

  /* ---- 7) Adopción: los bytes que Cloudinary tiene y el panel ignoraba -----
     Sin esto la reparación no puede cerrar la diferencia: el archivo seguiría
     existiendo, seguiría sin figurar, y el próximo balance volvería a dar
     distinto. Se adopta al apartado que dice su tag; los degradados de 5c bajan
     a sin-usar por el mismo camino. */
  const alreadyIndexed = new Set<string>([
    ...Object.values(cleanUsed).map((v) => srcKey(v.src)),
    ...cleanUnused.map(entrySrc),
    ...cleanTrash.map(entrySrc),
  ])
  const adoptEntry = (r: AuditAsset): LooseEntry => {
    const name = fileNameOf(r.secure_url)
    const mm = metaOf(r.secure_url)
    const type = r.resource_type === 'video' ? 'video/mp4'
      : r.resource_type === 'raw' ? 'application/octet-stream'
        : 'image/webp'
    return {
      src: r.secure_url,
      name: mm.name || name,
      size: r.bytes,
      type: mm.type || type,
      ts: mm.ts ?? (Date.parse(r.created_at || '') || undefined),
      label: mm.label || name,
      section: mm.section || '',
      reason: 'adopted',
    }
  }
  const demotedSet = new Set(demoted)
  const toAdopt = [...adoptable, ...resources.filter((r) => demotedSet.has(srcKey(r.secure_url)))]
  let adopted = 0
  for (const r of toAdopt) {
    const src = srcKey(r.secure_url)
    if (alreadyIndexed.has(src) || referencedSrcs.has(src)) continue
    alreadyIndexed.add(src)
    adopted++
    if (canonicalOf(r) === 'trash') cleanTrash.push(adoptEntry(r))
    else cleanUnused.push(adoptEntry(r))
  }

  /* ---- 8) Huérfanos para el panel ----------------------------------------
     Bytes en Cloudinary que el CMS no conocía por ninguna vía —ni contenedor ni
     índice—. Los que sí figuran como sin-usar o en papelera NO son huérfanos:
     están registrados, sólo que no en uso. */
  const orphaned: AuditViews['orphaned'] = adoptable.map((r) => ({
    url: r.secure_url, publicId: r.public_id, resourceType: r.resource_type,
    format: r.format, bytes: r.bytes, folder: r.folder || (r.state ? FOLDER_BY_STATE[r.state] : ''),
  }))

  const indexChanged =
    cleanUnused.length !== unusedList.length ||
    cleanTrash.length !== trashList.length ||
    Object.keys(cleanUsed).length !== Object.keys(usedContent).length ||
    Object.entries(cleanUsed).some(([k, v]) => srcKey(usedContent[k]?.src || '') !== srcKey(v.src))

  /* ---- 9) Balance: la comparación que da el veredicto ---------------------
     Dos conjuntos, cuatro filas, cantidad y bytes. El peso SIEMPRE sale del
     listado de Cloudinary cuando el archivo existe ahí: es el único número que
     no se puede discutir. Lo que el panel no puede pesar se cuenta aparte en
     vez de sumar 0, que es lo que hacía que el total quedara corto sin decir
     por qué. */
  const cloudinary = emptyBucketSet()
  for (const r of resources) {
    const b = cloudinary[cloudBucketOf(r)]
    b.files += 1
    b.bytes += r.bytes || 0
  }

  const entryByUrl = new Map<string, LooseEntry>()
  for (const e of [...Object.values(usedContent) as LooseEntry[], ...unusedList, ...trashList]) {
    const src = entrySrc(e)
    if (src && !entryByUrl.has(src)) entryByUrl.set(src, e)
  }

  const panel = emptyBucketSet()
  let panelUnknown = 0
  const bytesByUrl = new Map<string, number | null>()
  const panelSrcs = new Set<string>([...settingsSrcs, ...panelUsed, ...panelUnused, ...panelTrash])
  for (const src of panelSrcs) {
    const bucket = panelBucketOf(src)
    if (!bucket) continue
    const e = entryByUrl.get(src)
    const entrySize = typeof e?.size === 'number' ? (e.size as number) : null
    const known = byUrl.get(src)?.bytes ?? entrySize
    const bytes = known && known > 0 ? known : null
    bytesByUrl.set(src, bytes)
    panel[bucket].files += 1
    if (bytes === null) panelUnknown += 1
    else panel[bucket].bytes += bytes
  }

  const match = BUCKET_KEYS.reduce((acc, k) => {
    acc[k] = cloudinary[k].files === panel[k].files && cloudinary[k].bytes === panel[k].bytes
    return acc
  }, {} as Record<BucketKey, boolean>)
  const balance: Balance = {
    cloudinary, panel, match, panelUnknown,
    balanced: panelUnknown === 0 && BUCKET_KEYS.every((k) => match[k]),
  }

  /* ---- 10) Sincronizados: sólo los que coinciden EN LOS DOS LADOS ---------
     Un archivo que el panel muestra en sin-usar y Cloudinary tiene en en-uso NO
     está sincronizado. Antes entraba a esta lista por el solo hecho de existir
     en las dos puntas, y por eso el panel podía informar "todo sincronizado"
     con los apartados descuadrados. */
  const matching: AuditViews['matching'] = []
  for (const src of new Set<string>([...panelSrcs, ...exactRefSrcs])) {
    const hit = byUrl.get(src)
    if (!hit) continue
    const kb = knownBucketOf(src)
    if (!kb || kb !== cloudBucketOf(hit)) continue
    matching.push({
      url: src,
      name: (entryByUrl.get(src)?.name as string) || nameOf(src),
      state: kb,
      cloudinaryId: hit.public_id,
      uses: refCount.get(src) || 0,
    })
  }

  let indexedBytes = 0
  let indexedUnknown = 0
  for (const n of bytesByUrl.values()) {
    if (n === null) indexedUnknown += 1
    else indexedBytes += n
  }

  return {
    checked: refs.length,
    cloudinaryAssets: resources.length,
    cloudinaryBytes: resources.reduce((sum, r) => sum + (r.bytes || 0), 0),
    indexedFiles: bytesByUrl.size,
    indexedBytes,
    indexedUnknown,
    balance,
    findings,
    counts: findings.reduce<Record<string, number>>((a, f) => ({ ...a, [f.kind]: (a[f.kind] || 0) + 1 }), {}),
    repairs,
    drift,
    ghostKeys,
    deadKeys,
    adopted,
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

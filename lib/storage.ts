import 'server-only'
import { v2 as cloudinary } from 'cloudinary'
import { writeFile, mkdir, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { CLOUDINARY_WIDTHS, VIDEO_POSTER_WIDTH } from '@/lib/utils'

/* Almacenamiento de media por ENTORNO.
   - Prod (con credenciales Cloudinary) → sube a Cloudinary.
   - Local (sin credenciales) → guarda en public/uploads (gitignoreado).
   Así una subida en local NUNCA toca Cloudinary y no infla la DB con base64. */

export const hasCloudinary = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
)

if (hasCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })
}

export type StoredMedia = {
  url: string
  bytes: number
  format: string
  assetId: string
}

/* Sin svg: lo rechaza sniffKind() y dejarlo acá sugeriría que está soportado. */
const EXT_BY_MIME: Record<string, string> = {
  'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg',
  'image/gif': 'gif', 'video/webm': 'webm', 'video/mp4': 'mp4',
  'video/quicktime': 'mov', 'application/pdf': 'pdf',
}

function decodeDataUrl(dataUrl: string): { buffer: Buffer; ext: string; mime: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,([\s\S]*)$/)
  if (!m) throw new Error('Invalid data URL')
  const mime = m[1]
  const ext = EXT_BY_MIME[mime] || (mime.split('/')[1] || 'bin')
  return { buffer: Buffer.from(m[2], 'base64'), ext, mime }
}

/* Firma real del archivo (magic bytes). El `data:image/png` de la data URL lo
   escribe el cliente y no prueba nada: hay que mirar el contenido. SVG queda
   deliberadamente fuera — es XML ejecutable y servido desde nuestro propio
   origen es un vector de XSS almacenado. */
type MediaKind = 'image' | 'video' | 'raw'

/** Archivo rechazado por su contenido → 400 con motivo, no 500 genérico. */
export class UnsupportedMediaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsupportedMediaError'
  }
}

function sniffKind(head: Buffer): MediaKind | null {
  const startsWith = (...bytes: number[]) => bytes.every((b, i) => head[i] === b)
  const ascii = (offset: number, s: string) => head.subarray(offset, offset + s.length).toString('latin1') === s

  if (startsWith(0xff, 0xd8, 0xff)) return 'image'                       // JPEG
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image' // PNG
  if (ascii(0, 'GIF87a') || ascii(0, 'GIF89a')) return 'image'           // GIF
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return 'image'               // WEBP
  if (ascii(0, 'BM')) return 'image'                                     // BMP
  if (startsWith(0x00, 0x00, 0x01, 0x00)) return 'image'                 // ICO
  if (startsWith(0x1a, 0x45, 0xdf, 0xa3)) return 'video'                 // WEBM / Matroska
  if (ascii(4, 'ftyp')) return 'video'                                   // MP4 / MOV / M4V
  if (ascii(0, 'OggS')) return 'video'                                   // OGG
  if (ascii(0, '%PDF-')) return 'raw'                                    // PDF
  return null
}

function assertBufferMatchesKind(buffer: Buffer, declared: MediaKind): void {
  const actual = sniffKind(buffer.subarray(0, 64))
  if (!actual) throw new UnsupportedMediaError('Formato de archivo no reconocido o no permitido (SVG y HTML no se aceptan)')
  if (actual !== declared) {
    throw new UnsupportedMediaError(`The file content is ${actual}, but it was declared as ${declared}`)
  }
}

/* Extensión deducida de la firma, para cuando no hay un mime confiable.
   Se usa solo en el guardado local (Cloudinary decide la suya). */
function extFromBuffer(buffer: Buffer): string | null {
  const head = buffer.subarray(0, 16)
  const ascii = (offset: number, s: string) => head.subarray(offset, offset + s.length).toString('latin1') === s
  if (head[0] === 0xff && head[1] === 0xd8) return 'jpg'
  if (ascii(1, 'PNG')) return 'png'
  if (ascii(0, 'GIF8')) return 'gif'
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return 'webp'
  if (head[0] === 0x1a && head[1] === 0x45) return 'webm'
  if (ascii(4, 'ftyp')) return 'mp4'
  if (ascii(0, '%PDF-')) return 'pdf'
  return null
}

/* cloudinary.uploader.upload() espera una ruta o una data URI; para bytes
   crudos la vía es upload_stream, así que el buffer se escribe al stream. */
type CloudinaryUploadResult = { secure_url: string; bytes: number; format?: string; asset_id: string }

function uploadStream(buffer: Buffer, options: Record<string, unknown>): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err || !result) return reject(err || new Error('Cloudinary returned no result'))
      resolve(result as unknown as CloudinaryUploadResult)
    })
    stream.end(buffer)
  })
}

const LOCAL_DIR = path.join(process.cwd(), 'public', 'uploads')

/* Prefijo NEUTRO del public_id. Antes acá estaba `folderSlug`, que devolvía
   `portfolio/<estado>` y ese estado quedaba grabado dentro del public_id — o sea,
   dentro de la URL. Cambiar de estado obligaba entonces a renombrar. Ahora el
   public_id no lleva estado nunca: el estado vive en un tag y la carpeta visual
   en `asset_folder`, ninguno de los dos presente en la URL de entrega. */
const UPLOAD_PREFIX = 'portfolio'

/** Limpia y normaliza el nombre del archivo para que sea un ID seguro en Cloudinary / storage local. */
function cleanFilename(name: string): string {
  const lastDot = name.lastIndexOf('.')
  const base = lastDot > 0 ? name.slice(0, lastDot) : name
  const ext = lastDot > 0 ? name.slice(lastDot + 1) : ''

  const cleanBase = base
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'archivo'

  const cleanExt = ext
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

  return cleanExt ? `${cleanBase}.${cleanExt}` : cleanBase
}

/** Sube bytes crudos. Es el camino real de subida: multipart entrega el archivo
    ya binario, sin el +33% ni el string gigante en memoria del base64.
    kind 'raw' = documentos (ej. CV en PDF): se guarda tal cual, sin transformar.
    state = estado inicial del ciclo de vida (va como TAG, no como carpeta). */
export async function uploadBuffer(
  buffer: Buffer,
  kind: MediaKind,
  state: MediaState = 'unused',
  originalName?: string,
  mime?: string,
): Promise<StoredMedia> {
  // Boundary único de subida: todo lo que entra al storage pasa por acá, así
  // que la validación de contenido no se puede olvidar en una ruta.
  assertBufferMatchesKind(buffer, kind)

  const filename = originalName ? cleanFilename(originalName) : undefined

  if (hasCloudinary) {
    /* `folder` fija el prefijo del public_id (neutro, sin estado) y `asset_folder`
       la carpeta visual (cosmética, cambiable sin tocar la URL). El estado real
       viaja en `tags`. */
    const options: Record<string, unknown> = {
      folder: UPLOAD_PREFIX,
      asset_folder: folderForState(state),
      tags: [STATE_TAG[state]],
    }
    if (filename) {
      /* Nombre legible pero ÚNICO. Antes: `public_id` explícito + `unique_filename:
         false` + `overwrite: true`. `cleanFilename` normaliza acentos, mayúsculas y
         separadores, así que "Mi Foto (1).webp", "mi foto 1.webp" y "mi-foto-1.webp"
         colapsan al mismo public_id — y con overwrite la segunda subida REEMPLAZABA
         los bytes de la primera. La URL seguía dando 200, así que todo contenedor
         que apuntaba ahí pasaba a mostrar otra imagen, sin ningún cambio en la DB
         que lo delatara. Ninguna auditoría basada en URLs puede ver eso.
         `unique_filename` era inerte mientras `public_id` fuera explícito: Cloudinary
         lo ignora. Por eso se van los tres juntos. Ahora Cloudinary sufija
         (`mi-foto-1_a7f3c1`) y cada subida es un asset distinto. */
      options.use_filename = true
      options.unique_filename = true
      options.overwrite = false
      options.filename_override = filename
    }
    if (kind === 'raw') {
      options.resource_type = 'raw'
    } else if (kind === 'video') {
      // Sin transformación entrante: transcodear sync (format/quality) hace fallar
      // videos medianos por límite de procesamiento de Cloudinary. Se guarda el
      // original; la optimización se aplica en la URL de entrega (f_auto/q_auto).
      options.resource_type = 'video'
      /* Pero la entrega usa f_auto (obligatorio: Safari/iOS no reproduce webm), y
         f_auto sobre un video sin derivadas dispara el transcode en la PRIMERA
         visita — segundos de contenedor negro, peor en mobile. Se pre-generan mp4
         y webm para que f_auto siempre tenga a qué apuntar.
         `eager_async: true` es la diferencia con la imagen: en async Cloudinary
         acepta la subida y transcodea de fondo, así que no reaparece el fallo por
         límite de procesamiento que documenta el comentario de arriba. Hasta que
         terminan, `attachMediaRetry` cubre el hueco. */
      /* La transformación del eager tiene que ser LA MISMA que la de entrega, si no
         genera una derivada distinta y no pre-calienta nada. La entrega usa
         `optimizedMediaSrc(value)` sin ancho → `f_auto,q_auto` (ver
         cloudinaryOptimize en lib/utils.ts). Pedir `{format:'mp4'}` producía
         `/video/upload/v1/name.mp4`, otra URL, y el transcode on-the-fly seguía
         pasando igual — encima pagando dos transcodes por subida. */
      /* Y el póster (primer frame) por el mismo motivo: sin él el contenedor
         pinta negro hasta que decodifica el primer frame. Misma transformación
         que arma `videoPosterSrc` (lib/utils.ts) — si divergen, el derivado que
         se pre-genera no es el que pide el sitio y no pre-calienta nada. */
      options.eager = [
        { fetch_format: 'auto', quality: 'auto' },
        { fetch_format: 'auto', quality: 'auto', width: VIDEO_POSTER_WIDTH, crop: 'limit', start_offset: 0, format: 'jpg' },
      ]
      options.eager_async = true
    } else {
      options.resource_type = 'image'
      options.format = 'webp'
      options.quality = 'auto'
      /* Pre-genera (eager, sync) EXACTAMENTE los anchos que el front puede pedir:
         `snapCloudinaryWidth` redondea el ancho medido a CLOUDINARY_WIDTHS, así que
         la escalera de acá y la de allá tienen que ser la misma lista. Con eso toda
         petición del sitio es un hit y la primera visita NUNCA dispara la generación
         on-the-fly (que devuelve 404 mientras trabaja y deja el contenedor en negro).
         Antes acá había 640/1200 mientras el front pedía el ancho crudo (375, 750,
         1103…): casi ninguna petición caía en la escalera y el negro era la regla.
         Solo imagen: el video NO se transcodea eager (fallaría en archivos grandes
         por el límite de Cloudinary). */
      options.eager = [
        ...CLOUDINARY_WIDTHS.map((width) => ({ fetch_format: 'auto', quality: 'auto', width, crop: 'limit' })),
        { fetch_format: 'auto', quality: 'auto', width: 150, height: 150, crop: 'fill' },
      ]
      options.eager_async = false
    }
    const res = await uploadStream(buffer, options)
    return {
      url: res.secure_url,
      bytes: res.bytes,
      format: res.format || (kind === 'raw' ? 'pdf' : ''),
      assetId: res.asset_id,
    }
  }

  // Local: escribir a public/uploads y devolver una ruta servible (/uploads/..).
  const ext = (mime && EXT_BY_MIME[mime]) || extFromBuffer(buffer) || 'bin'
  let name = `${randomUUID()}.${ext}`
  if (filename) {
    const lastDot = filename.lastIndexOf('.')
    const base = lastDot > 0 ? filename.slice(0, lastDot) : filename
    /* Sufijo corto, mismo criterio que Cloudinary arriba: sin él, dos archivos
       cuyo nombre normaliza igual se pisaban en disco y todo contenedor que
       apuntara al primero pasaba a mostrar el segundo. */
    name = `${base}_${randomUUID().slice(0, 6)}.${ext}`
  }
  await mkdir(LOCAL_DIR, { recursive: true })
  await writeFile(path.join(LOCAL_DIR, name), buffer)
  return { url: `/uploads/${name}`, bytes: buffer.length, format: ext, assetId: `local_${name}` }
}

/** Sube una data URL. Envoltorio sobre uploadBuffer: lo usa /api/content, que
    recibe ajustes (CV, iconos) embebidos como data URL dentro del JSON. */
export async function uploadDataUrl(
  dataUrl: string,
  kind: MediaKind,
  state: MediaState = 'used',
  originalName?: string,
): Promise<StoredMedia> {
  const { buffer, mime } = decodeDataUrl(dataUrl)
  return uploadBuffer(buffer, kind, state, originalName, mime)
}

/* Un segmento de transformación de Cloudinary (`f_auto,q_auto,w_640,c_limit`,
   `c_fill,w_150,h_150`) siempre es una lista de pares `x_valor` separados por coma. */
const TRANSFORM_SEGMENT = /^[a-z]{1,3}_[^/]*$/

/** Extrae resource_type y public_id de una URL de Cloudinary.
 *  Tolera URLs transformadas y con query: el regex anterior usaba un grupo LAZY
 *  (`(?:[^/]+\/)*?`) que matcheaba CERO segmentos, así que el segmento de
 *  transformación terminaba adentro del public_id. Con eso `deleteAsset` no
 *  borraba nada (huérfano permanente) y `verifyAssetExists` devolvía false para
 *  un asset VIVO — y los callers usaban eso para purgar estado. */
function parseCloudinaryUrl(url: string): { resourceType: 'image' | 'video' | 'raw'; publicId: string } | null {
  const clean = url.split('?')[0].split('#')[0]
  const match = clean.match(/\/(image|video|raw)\/upload\/(.+)$/)
  if (!match) return null
  const resourceType = match[1] as 'image' | 'video' | 'raw'

  const segments = match[2].split('/')
  // Descartar transformaciones y la versión; lo que queda es el public_id.
  while (segments.length > 1 && segments[0].split(',').every((p) => TRANSFORM_SEGMENT.test(p))) segments.shift()
  if (segments.length > 1 && /^v\d+$/.test(segments[0])) segments.shift()

  let rawId = segments.join('/')
  if (!rawId) return null
  if (resourceType !== 'raw') rawId = rawId.replace(/\.[a-zA-Z0-9]+$/, '')
  return { resourceType, publicId: decodeURIComponent(rawId) }
}

/* ----- Modo de carpetas del account (Paso 1) --------------------------------
   `fixed`  → la carpeta ES parte del public_id; `asset_folder` no existe.
   `dynamic`→ `asset_folder` es metadato: mover NO toca el public_id ni la URL.
   Nada del ciclo de vida depende de esto (el estado viaja en TAGS, que funcionan
   igual en los dos modos); solo decide si además espejamos la carpeta visual. */
export type FolderMode = 'fixed' | 'dynamic' | 'unknown'

let folderModePromise: Promise<FolderMode> | null = null

/** Una sola llamada Admin API por proceso, memoizada. */
export function getFolderMode(): Promise<FolderMode> {
  if (!hasCloudinary) return Promise.resolve('unknown')
  if (!folderModePromise) {
    folderModePromise = cloudinary.api
      .config({ settings: true } as Parameters<typeof cloudinary.api.config>[0])
      .then((res) => {
        const mode = (res as { settings?: { folder_mode?: string } })?.settings?.folder_mode
        return mode === 'dynamic' || mode === 'fixed' ? mode : 'unknown'
      })
      .catch((err) => {
        console.warn('[getFolderMode] no se pudo leer folder_mode:', err)
        folderModePromise = null // permitir reintento
        return 'unknown' as FolderMode
      })
  }
  return folderModePromise
}

/* ----- Estado del ciclo de vida vía TAGS (Paso 2) ---------------------------
   La carpeta dejó de ser el mecanismo de estado. Un tag no aparece NUNCA en la
   URL de entrega, funciona en los dos modos de carpeta, y se muta por Upload API
   (que no tiene rate limit, a diferencia de Admin API: 500/h en el plan free).
   Consecuencia clave: cambiar de estado ya no renombra el asset, así que la URL
   guardada en `cms_data` no se invalida nunca. */
export type MediaState = 'used' | 'unused' | 'trash'

const STATE_TAG: Record<MediaState, string> = {
  used: 'state:en-uso',
  unused: 'state:sin-usar',
  trash: 'state:basurero',
}

const ALL_STATE_TAGS = Object.values(STATE_TAG)

/** Carpeta VISUAL (solo cosmética, para la Media Library). No afecta la URL. */
export function folderForState(state: MediaState): string {
  if (state === 'unused') return 'portfolio/sin-usar'
  if (state === 'trash') return 'portfolio/basurero'
  return 'portfolio/en-uso'
}

/** Estado leído de los tags, con fallback a la carpeta del public_id.
 *  El fallback es lo que hace que los assets viejos (subidos cuando la carpeta
 *  ERA el estado) sigan clasificando bien mientras no se los haya tagueado. */
export function stateFromTags(tags: string[] | undefined, publicIdOrUrl = ''): MediaState | null {
  const t = tags || []
  if (t.includes(STATE_TAG.trash)) return 'trash'
  if (t.includes(STATE_TAG.unused)) return 'unused'
  if (t.includes(STATE_TAG.used)) return 'used'
  if (publicIdOrUrl.includes('portfolio/basurero/')) return 'trash'
  if (publicIdOrUrl.includes('portfolio/sin-usar/')) return 'unused'
  if (publicIdOrUrl.includes('portfolio/en-uso/')) return 'used'
  return null
}

/** Mueve un asset de estado SIN renombrarlo: reemplaza el tag de estado y, si el
 *  account es dynamic, espeja la carpeta visual. La URL de entrega no cambia.
 *  Reemplaza a `moveAssetFolder`, que hacía `uploader.rename` — es decir, movía
 *  la clave primaria de la que la DB tiene una copia. */
export async function setAssetState(url: string, state: MediaState): Promise<{ ok: boolean; reason?: string }> {
  if (!hasCloudinary || !url.includes('cloudinary.com')) return { ok: true }
  const parsed = parseCloudinaryUrl(url)
  if (!parsed) return { ok: false, reason: 'unparseable url' }
  const { publicId, resourceType } = parsed

  try {
    /* remove_tag + add_tag, NO replace_tag: `replace` pisa TODOS los tags del
       asset, no solo el de estado. Ambos son endpoints de Upload API (sin cuota). */
    const stale = ALL_STATE_TAGS.filter((t) => t !== STATE_TAG[state])
    for (const tag of stale) {
      await cloudinary.uploader.remove_tag(tag, [publicId], { resource_type: resourceType })
    }
    await cloudinary.uploader.add_tag(STATE_TAG[state], [publicId], { resource_type: resourceType })
  } catch (err) {
    console.error('[setAssetState] no se pudo etiquetar:', publicId, err)
    return { ok: false, reason: 'tagging failed' }
  }

  // Carpeta visual: best-effort y solo en dynamic (en fixed el parámetro no existe).
  if ((await getFolderMode()) === 'dynamic') {
    await cloudinary.api
      .update(publicId, { resource_type: resourceType, asset_folder: folderForState(state) })
      .catch((err) => console.warn('[setAssetState] asset_folder no aplicado:', err))
  }

  return { ok: true }
}

/* ----- Nombre visible del asset (display_name) ------------------------------
   Renombrar de verdad (`uploader.rename`) cambia el public_id, o sea la URL, o
   sea la clave de la que `cms_data` guarda copia — exactamente lo que el modelo
   de estado por tags evita desde arriba. `display_name` es el nombre que la
   Media Library de Cloudinary muestra y NO forma parte de la URL de entrega:
   permite editar el nombre en los dos lados sin invalidar una sola referencia.

   Solo existe en cuentas con folder_mode `dynamic`. En `fixed` se devuelve el
   motivo en vez de responder OK a algo que no pasó. */
export type DisplayNameResult = { ok: true; applied: 'cloudinary' | 'local' } | { ok: false; reason: string }

export async function setAssetDisplayName(url: string, displayName: string): Promise<DisplayNameResult> {
  /* Archivos servidos desde public/uploads (entorno local): no hay metadato
     remoto que actualizar, el nombre vive solo en el CMS. */
  if (!url.includes('cloudinary.com')) return { ok: true, applied: 'local' }
  if (!hasCloudinary) return { ok: false, reason: 'cloudinary not configured' }

  const parsed = parseCloudinaryUrl(url)
  if (!parsed) return { ok: false, reason: 'unparseable url' }

  if ((await getFolderMode()) !== 'dynamic') {
    return { ok: false, reason: 'display names require a Cloudinary account in dynamic folder mode' }
  }

  try {
    /* Admin API (500/h en el plan free), a diferencia del tageo de estado que va
       por Upload API. Es un gesto manual y puntual del admin, no un batch. */
    await cloudinary.api.update(parsed.publicId, {
      resource_type: parsed.resourceType,
      display_name: displayName,
    })
  } catch (err) {
    console.error('[setAssetDisplayName] no se pudo actualizar:', parsed.publicId, err)
    return { ok: false, reason: 'cloudinary rejected the update' }
  }

  return { ok: true, applied: 'cloudinary' }
}

/** Borra un asset por su URL (Cloudinary o archivo local).
 *  Devuelve el resultado en vez de tragárselo: un destroy fallido dejaba un objeto
 *  vivo y facturado en Cloudinary mientras la fila de la DB ya se había borrado, y
 *  nadie se enteraba. El caller decide qué hacer con `ok: false`. */
export async function deleteAsset(url: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    if (url.includes('cloudinary.com')) {
      if (!hasCloudinary) return { ok: false, reason: 'cloudinary not configured' }
      const parsed = parseCloudinaryUrl(url)
      if (!parsed) return { ok: false, reason: 'unparseable url' }
      /* `invalidate` purga la CDN: sin esto Cloudinary sigue sirviendo el asset
         borrado desde caché y el borrado no se ve. */
      const res = await cloudinary.uploader.destroy(parsed.publicId, {
        resource_type: parsed.resourceType,
        invalidate: true,
      }) as { result?: string }
      // 'not found' cuenta como éxito: el objetivo (que no exista) se cumplió.
      const ok = res?.result === 'ok' || res?.result === 'not found'
      return ok ? { ok: true } : { ok: false, reason: res?.result || 'unknown' }
    }
    if (url.startsWith('/uploads/')) {
      await unlink(path.join(process.cwd(), 'public', url.replace(/^\//, '')))
      return { ok: true }
    }
    return { ok: false, reason: 'unsupported url' }
  } catch (err) {
    const code = (err as { code?: string })?.code
    if (code === 'ENOENT') return { ok: true } // el archivo local ya no estaba
    console.error('[deleteAsset] error:', url, err)
    return { ok: false, reason: err instanceof Error ? err.message : 'error' }
  }
}

/** `asset_id` de Cloudinary para una URL. Es el único identificador que acepta
 *  la ficha de la consola (el public_id no sirve) y no se puede derivar de la
 *  URL, así que hay que preguntárselo a la Admin API. `null` = no resoluble
 *  (asset local, Cloudinary sin configurar, o no existe). */
export async function resolveAssetId(url: string): Promise<string | null> {
  if (!url || !url.includes('cloudinary.com') || !hasCloudinary) return null
  const parsed = parseCloudinaryUrl(url)
  if (!parsed) return null
  try {
    const res = await cloudinary.api.resource(parsed.publicId, {
      resource_type: parsed.resourceType,
    }) as { asset_id?: string }
    return res?.asset_id || null
  } catch (err) {
    console.error('[resolveAssetId] no se pudo resolver:', parsed.publicId, err)
    return null
  }
}

/** Verifica si un asset de Cloudinary existe. Devuelve true si existe, false si no.
 *  Para URLs no-Cloudinary (locales), devuelve true siempre. */
export async function verifyAssetExists(url: string): Promise<boolean> {
  if (!url || !url.includes('cloudinary.com')) return true
  if (!hasCloudinary) return true
  try {
    const parsed = parseCloudinaryUrl(url)
    if (!parsed) return true // no se pudo parsear → asumir que existe
    await cloudinary.api.resource(parsed.publicId, { resource_type: parsed.resourceType })
    return true
  } catch (err: unknown) {
    // El SDK de Cloudinary devuelve objetos puros con http_code en lugar de Error instances
    const errObj = err as Record<string, unknown>
    const errError = (errObj?.error ?? {}) as Record<string, unknown>
    const httpCode = errObj?.http_code ?? errError?.http_code ?? errObj?.status ?? errObj?.statusCode
    if (httpCode === 404) return false

    const message = (errObj?.message ?? errError?.message ?? (typeof err === 'string' ? err : JSON.stringify(err))) as string
    if (typeof message === 'string' && (message.toLowerCase().includes('not found') || message.toLowerCase().includes('404'))) {
      return false
    }
    // Otro error (rate limit, etc.) → asumir que existe para no borrar datos por error
    console.warn('[verifyAssetExists] inconclusive error:', message, err)
    return true
  }
}

/** Verifica en lote si múltiples assets de Cloudinary existen.
 *  Procesa en paralelo con Promise.allSettled (máx 10 concurrentes). */
export async function verifyAssetsExist(urls: string[]): Promise<{ url: string; exists: boolean }[]> {
  if (!hasCloudinary) return urls.map((url) => ({ url, exists: true }))
  const results: { url: string; exists: boolean }[] = []
  // Procesar en lotes de 10 para no sobrecargar la API
  const BATCH_SIZE = 10
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE)
    const settled = await Promise.allSettled(
      batch.map(async (url) => ({ url, exists: await verifyAssetExists(url) }))
    )
    for (const r of settled) {
      if (r.status === 'fulfilled') results.push(r.value)
      else results.push({ url: batch[settled.indexOf(r)], exists: true }) // error → asumir existe
    }
  }
  return results
}

/* `moveAssetFolder` fue eliminada. Hacía `uploader.rename` para "mover de carpeta",
   y como la carpeta vive dentro del public_id, cada movimiento invalidaba la URL
   que `cms_data` tenía guardada. Además su primer candidato salía de la URL VIEJA,
   así que cuando la DB decía sin-usar y el destino era sin-usar entraba por la rama
   "ya está en destino", devolvía la URL muerta y reportaba éxito — por eso el bug
   de producción era irreparable desde la UI. Su reemplazo es `setAssetState`. */

/** Crea la estructura de carpetas vacías en Cloudinary según la taxonomía del sitio.
 *  Es idempotente: si una carpeta ya existe, no falla. */
export async function scaffoldFolders(folderPaths: string[]): Promise<{ created: number; skipped: number }> {
  if (!hasCloudinary) return { created: 0, skipped: 0 }
  let created = 0
  let skipped = 0
  for (const folderPath of folderPaths) {
    try {
      await cloudinary.api.create_folder(folderPath)
      created++
    } catch (err: unknown) {
      // Cloudinary devuelve error si la carpeta ya existe — eso está bien
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('already exists')) {
        skipped++
      } else {
        console.error(`[scaffoldFolders] error creating ${folderPath}:`, err)
        skipped++
      }
    }
  }
  return { created, skipped }
}

/* `cleanupLegacyFolders` y `cleanSubFoldersRecursively` fueron eliminadas.
   Corrían en CADA carga de /admin (AdminDashboard → scaffoldCloudinaryFolders →
   scaffoldFolders) y renombraban en masa todo recurso que encontraran en una
   subcarpeta no canónica, con `overwrite: true` — destruyendo el asset ocupante en
   caso de colisión — sin escribir una sola línea a `cms_data`. Era un generador de
   desincronización en bulk que se disparaba solo al abrir el panel. Con el estado
   viviendo en tags, las subcarpetas ya no significan nada y no hay nada que migrar. */

// ----- Listado completo de Cloudinary (para auditoría de sincronización) ------

export type CloudinaryResource = {
  asset_id: string
  public_id: string
  secure_url: string
  resource_type: string
  format: string
  bytes: number
  folder: string
  tags: string[]
  /* Estado del ciclo de vida: del tag, con fallback a la carpeta para los assets
     subidos antes de que el estado dejara de vivir en la carpeta. */
  state: MediaState | null
  created_at: string
}

/* `complete: false` = alguna página o algún resource_type falló, así que la lista
   está TRUNCADA. Un listado truncado no se puede distinguir de uno vacío por el
   tamaño, y de esa distinción depende si clasificar es un diagnóstico o una
   pérdida de datos: antes el error se tragaba y la lista parcial se presentaba
   como total. */
export type CloudinaryListing = { resources: CloudinaryResource[]; complete: boolean }

/** Lista TODOS los recursos de Cloudinary.
 *  Intenta primero Search API y luego cae en Admin API si fuera necesario. */
export async function listAllCloudinaryResources(): Promise<CloudinaryListing> {
  if (!hasCloudinary) return { resources: [], complete: false }
  const allMap = new Map<string, CloudinaryResource>()

  const addResource = (r: Record<string, unknown>, defaultFolder = '') => {
    const secure_url = (r.secure_url as string) || ''
    const public_id = (r.public_id as string) || ''
    if (!public_id && !secure_url) return
    /* El ZIP que arma "Download ZIP" se guarda en la cuenta como asset `raw`.
       Es una DERIVADA del repositorio, no contenido: si entrara al listado se
       contaría a sí mismo, aparecería como huérfano en cada auditoría y su peso
       inflaría el total contra el que se compara Cloudinary. */
    if (Array.isArray(r.tags) && (r.tags as string[]).includes(ARCHIVE_TAG)) return
    const key = public_id || secure_url

    if (!allMap.has(key)) {
      let folder = (r.asset_folder as string) || (r.folder as string) || defaultFolder
      if (!folder && secure_url) {
        if (secure_url.includes('/portfolio/sin-usar/')) folder = 'portfolio/sin-usar'
        else if (secure_url.includes('/portfolio/basurero/')) folder = 'portfolio/basurero'
        else if (secure_url.includes('/portfolio/en-uso/')) folder = 'portfolio/en-uso'
        else if (secure_url.includes('/portfolio/')) folder = 'portfolio'
      }
      const tags = Array.isArray(r.tags) ? (r.tags as string[]) : []
      allMap.set(key, {
        asset_id: (r.asset_id as string) || '',
        public_id,
        secure_url,
        resource_type: (r.resource_type as string) || 'image',
        format: (r.format as string) || '',
        bytes: (r.bytes as number) || 0,
        folder,
        tags,
        state: stateFromTags(tags, public_id || secure_url),
        created_at: (r.created_at as string) || '',
      })
    }
  }

  /* `raw` incluido: el CV en PDF se sube con resource_type 'raw' y sin esto era
     invisible para toda auditoría — nunca matcheaba ni se reportaba como huérfano. */
  const types: ('image' | 'video' | 'raw')[] = ['image', 'video', 'raw']
  let complete = true

  for (const type of types) {
    let cursor: string | undefined = undefined
    do {
      try {
        /* El tipado del SDK no declara `type`, pero la Admin API sí lo acepta
           y hace falta para filtrar solo los assets subidos. */
        const res = await cloudinary.api.resources({
          resource_type: type,
          max_results: 500,
          next_cursor: cursor,
          type: 'upload',
          /* Sin `tags: true` la respuesta NO trae los tags y un modelo de estado
             basado en tags queda ciego. */
          tags: true,
        } as Parameters<typeof cloudinary.api.resources>[0]) as {
          resources?: Record<string, unknown>[]
          next_cursor?: string
        }

        if (res?.resources) {
          res.resources.forEach(r => addResource(r))
        }
        cursor = res?.next_cursor
      } catch (err) {
        /* Se sigue con los otros tipos —media parcial es mejor que nada para
           mirar—, pero la lista queda marcada como truncada: quien clasifique
           tiene que poder negarse. */
        console.error(`[listAllCloudinaryResources] falló el listado de '${type}':`, err)
        complete = false
        cursor = undefined
      }
    } while (cursor)
  }

  return { resources: Array.from(allMap.values()), complete }
}

/* ----- Descarga del repositorio completo -----------------------------------
   `download_zip_url({ prefixes: 'portfolio', resource_type: 'all' })` era un
   ZIP incompleto por dos motivos independientes:

   1. `resource_type` NO viaja firmado: el SDK lo mete en la RUTA del endpoint
      (`/v1_1/<cloud>/<resource_type>/generate_archive`). `all` no es un tipo de
      recurso — los válidos son `image`, `video`, `raw` y `auto`. Un archivo por
      prefijo sólo puede llevar UN tipo, así que videos y `raw` (el CV en PDF)
      quedaban afuera. De ahí que bajar la carpeta desde la consola de Cloudinary
      diera el número correcto y desde la web no.
   2. `prefixes: 'portfolio'` es otro conjunto que el que audita el panel: el
      listado del repositorio no filtra por carpeta, así que cualquier asset
      fuera de `portfolio/` se contaba en la web y no entraba al ZIP.

   La corrección es no volver a describir el conjunto: se pasa la lista exacta
   de assets que el panel acaba de contar, con `resource_type: 'auto'` +
   `fully_qualified_public_ids` (`<tipo>/<entrega>/<public_id>`), que es la única
   combinación que admite tipos mezclados en un mismo archivo.

   Se usa el modo `create` (POST) y no la URL firmada de descarga: con ~200
   assets la lista supera holgadamente el largo de URL que aguanta un GET. El
   ZIP resultante se etiqueta y el listado lo excluye. */

const ARCHIVE_TAG = 'system:repo-archive'
const ARCHIVE_PUBLIC_ID = 'system/artist-portfolio-repo'
/** Tope de Cloudinary para `fully_qualified_public_ids` en un solo archivo. */
const ARCHIVE_MAX_ASSETS = 1000

export type RepoArchive = {
  url: string
  /** Archivos que Cloudinary dice haber metido en el ZIP. */
  files: number
  /** Peso de los originales incluidos, para contrastar con el panel. */
  bytes: number
  /** Lo que el panel contaba antes de pedirlo. Si no coincide, algo se cayó. */
  expectedFiles: number
  expectedBytes: number
}

export async function createRepoArchive(): Promise<RepoArchive> {
  if (!hasCloudinary) throw new Error('Cloudinary is not configured in this environment.')

  const { resources, complete } = await listAllCloudinaryResources()
  /* Un listado truncado daría un ZIP silenciosamente incompleto, que es
     exactamente el problema que se está arreglando. */
  if (!complete) throw new Error('Could not read the full Cloudinary listing. Archive aborted.')
  if (resources.length === 0) throw new Error('There is nothing to download: Cloudinary is empty.')
  if (resources.length > ARCHIVE_MAX_ASSETS) {
    throw new Error(`Cloudinary allows at most ${ARCHIVE_MAX_ASSETS} files per archive and the repository has ${resources.length}.`)
  }

  const expectedBytes = resources.reduce((sum, r) => sum + (r.bytes || 0), 0)
  const ids = resources.map((r) => `${r.resource_type}/upload/${r.public_id}`)

  /* El ZIP anterior se borra antes de crear el nuevo: así nunca hay más de uno
     ocupando storage, y `target_public_id` no colisiona con el viejo. */
  await cloudinary.api
    .delete_resources_by_tag(ARCHIVE_TAG, { resource_type: 'raw' })
    .catch((err) => console.warn('[createRepoArchive] no se pudo borrar el ZIP anterior:', err))

  const res = await cloudinary.uploader.create_zip({
    resource_type: 'auto',
    mode: 'create',
    fully_qualified_public_ids: ids,
    target_public_id: ARCHIVE_PUBLIC_ID,
    target_tags: [ARCHIVE_TAG],
    use_original_filename: true,
    /* Se conserva la estructura de carpetas: sin esto dos archivos con el mismo
       nombre original en carpetas distintas se pisan dentro del ZIP. */
    flatten_folders: false,
    /* Un asset que desapareció entre el listado y la creación no puede tirar
       abajo la descarga entera; la diferencia se ve comparando `files`. */
    allow_missing: true,
  } as Parameters<typeof cloudinary.uploader.create_zip>[0]) as {
    secure_url?: string
    url?: string
    file_count?: number
    resource_count?: number
    bytes?: number
  }

  const url = res.secure_url || res.url
  if (!url) throw new Error('Cloudinary did not return an archive URL.')

  return {
    url,
    files: res.file_count ?? res.resource_count ?? 0,
    bytes: res.bytes ?? 0,
    expectedFiles: resources.length,
    expectedBytes,
  }
}

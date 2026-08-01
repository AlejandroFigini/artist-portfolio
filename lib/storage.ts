import 'server-only'
import { v2 as cloudinary } from 'cloudinary'
import { writeFile, mkdir, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'

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

const EXT_BY_MIME: Record<string, string> = {
  'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg',
  'image/gif': 'gif', 'image/svg+xml': 'svg', 'video/webm': 'webm', 'video/mp4': 'mp4',
  'video/quicktime': 'mov', 'application/pdf': 'pdf',
}

function decodeDataUrl(dataUrl: string): { buffer: Buffer; ext: string; mime: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,([\s\S]*)$/)
  if (!m) throw new Error('Data URL inválida')
  const mime = m[1]
  const ext = EXT_BY_MIME[mime] || (mime.split('/')[1] || 'bin')
  return { buffer: Buffer.from(m[2], 'base64'), ext, mime }
}

const LOCAL_DIR = path.join(process.cwd(), 'public', 'uploads')

/** Genera la ruta de carpeta Cloudinary según el estado del contenido.
 *  Simplificado a 3 carpetas principales: en-uso, sin-usar, basurero. */
export function folderSlug(section?: string, mediaState?: 'used' | 'unused' | 'trash'): string {
  if (mediaState === 'unused') return 'portfolio/sin-usar'
  if (mediaState === 'trash') return 'portfolio/basurero'
  return 'portfolio/en-uso'
}

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

/** Sube una data URL (base64). Devuelve la URL servible + metadatos.
    kind 'raw' = documentos (ej. CV en PDF): se guarda tal cual, sin transformar.
    folder = carpeta destino en Cloudinary (por sección de la página). */
export async function uploadDataUrl(
  dataUrl: string,
  kind: 'image' | 'video' | 'raw',
  folder = 'portfolio',
  originalName?: string,
): Promise<StoredMedia> {
  const filename = originalName ? cleanFilename(originalName) : undefined

  if (hasCloudinary) {
    const commonOptions: Record<string, unknown> = { folder, asset_folder: folder }
    if (filename) {
      const lastDot = filename.lastIndexOf('.')
      const base = lastDot > 0 ? filename.slice(0, lastDot) : filename
      commonOptions.public_id = kind === 'raw' ? filename : base
      commonOptions.use_filename = true
      commonOptions.unique_filename = false
      commonOptions.overwrite = true
      commonOptions.filename_override = filename
    }
    if (kind === 'raw') {
      const res = await cloudinary.uploader.upload(dataUrl, { ...commonOptions, resource_type: 'raw' })
      return { url: res.secure_url, bytes: res.bytes, format: res.format || 'pdf', assetId: res.asset_id }
    }
    if (kind === 'video') {
      // Sin transformación entrante: transcodear sync (format/quality) hace fallar
      // videos medianos por límite de procesamiento de Cloudinary. Se guarda el
      // original; la optimización se aplica en la URL de entrega (f_auto/q_auto).
      const res = await cloudinary.uploader.upload(dataUrl, { ...commonOptions, resource_type: 'video' })
      return { url: res.secure_url, bytes: res.bytes, format: res.format, assetId: res.asset_id }
    }
    const res = await cloudinary.uploader.upload(dataUrl, {
      ...commonOptions,
      resource_type: 'image',
      format: 'webp',
      quality: 'auto',
    })
    return { url: res.secure_url, bytes: res.bytes, format: res.format, assetId: res.asset_id }
  }
  // Local: escribir a public/uploads y devolver una ruta servible (/uploads/..).
  const { buffer, ext } = decodeDataUrl(dataUrl)
  let name = `${randomUUID()}.${ext}`
  if (filename) {
    const lastDot = filename.lastIndexOf('.')
    const base = lastDot > 0 ? filename.slice(0, lastDot) : filename
    name = `${base}.${ext}`
  }
  await mkdir(LOCAL_DIR, { recursive: true })
  await writeFile(path.join(LOCAL_DIR, name), buffer)
  return { url: `/uploads/${name}`, bytes: buffer.length, format: ext, assetId: `local_${name}` }
}

/** Extrae resource_type y public_id de una URL de Cloudinary. */
function parseCloudinaryUrl(url: string): { resourceType: 'image' | 'video' | 'raw'; publicId: string } | null {
  const match = url.match(/\/(image|video|raw)\/upload\/(?:[^/]+\/)*?(?:v\d+\/)?(.+)$/)
  if (!match) return null
  const resourceType = match[1] as 'image' | 'video' | 'raw'
  const publicId = resourceType === 'raw' ? match[2] : match[2].replace(/\.[a-zA-Z0-9]+$/, '')
  return { resourceType, publicId }
}

/** Borra un asset por su URL (Cloudinary o archivo local). No lanza si no existe. */
export async function deleteAsset(url: string): Promise<void> {
  try {
    if (url.includes('cloudinary.com')) {
      if (!hasCloudinary) return
      const parsed = parseCloudinaryUrl(url)
      if (!parsed) return
      await cloudinary.uploader.destroy(parsed.publicId, { resource_type: parsed.resourceType })
    } else if (url.startsWith('/uploads/')) {
      await unlink(path.join(process.cwd(), 'public', url.replace(/^\//, ''))).catch(() => {})
    }
  } catch {
    // borrar es best-effort; no romper el flujo si falla
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
    console.warn('[verifyAssetExists] error no concluyente:', message, err)
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

/** Mueve un asset de Cloudinary a una nueva carpeta (vía rename del public_id y update de asset_folder).
 *  Devuelve la nueva URL. Si falla, devuelve la URL original sin romper. */
export async function moveAssetFolder(url: string, newFolder: string): Promise<string> {
  if (!hasCloudinary || !url.includes('cloudinary.com')) return url
  try {
    const parsed = parseCloudinaryUrl(url)
    if (!parsed) return url
    const parts = parsed.publicId.split('/')
    const filename = parts[parts.length - 1]
    const newPublicId = `${newFolder}/${filename}`

    // Probar primero el publicId exacto y luego carpetas candidatas por si el CMS ya actualizó su URL localmente
    const currentFolder = parts.slice(0, -1).join('/')
    const candidateFolders = Array.from(new Set([currentFolder, 'portfolio/en-uso', 'portfolio/sin-usar', 'portfolio/basurero', 'portfolio']))
    
    let successUrl = url
    let renamed = false

    for (const folder of candidateFolders) {
      const candidateId = `${folder}/${filename}`
      if (candidateId === newPublicId && folder === newFolder) {
        // Ya está en la carpeta destino, solo aseguramos asset_folder
        await cloudinary.api.update(newPublicId, {
          resource_type: parsed.resourceType,
          asset_folder: newFolder,
        }).catch(() => {})
        renamed = true
        break
      }

      try {
        const result = await cloudinary.uploader.rename(candidateId, newPublicId, {
          resource_type: parsed.resourceType,
          overwrite: true,
          invalidate: true,
        })
        successUrl = result.secure_url || url
        renamed = true
        break
      } catch {
        // Probar la siguiente carpeta candidata
      }
    }

    if (renamed) {
      await cloudinary.api.update(newPublicId, {
        resource_type: parsed.resourceType,
        asset_folder: newFolder,
      }).catch((e) => console.warn('[moveAssetFolder] no se pudo actualizar asset_folder:', e))
    }

    return successUrl
  } catch (err) {
    console.error('[moveAssetFolder] error:', err)
    return url
  }
}

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
  await cleanupLegacyFolders()
  return { created, skipped }
}

/** Migra recursos de subcarpetas viejas a las 3 carpetas principales y elimina las carpetas vacías. */
async function cleanupLegacyFolders(): Promise<void> {
  if (!hasCloudinary) return
  try {
    await cleanSubFoldersRecursively('portfolio/en-uso', 'portfolio/en-uso')
    await cleanSubFoldersRecursively('portfolio/sin-usar', 'portfolio/sin-usar')
    await cleanSubFoldersRecursively('portfolio/basurero', 'portfolio/basurero')

    const rootSub: { folders?: { name?: string; path: string }[] } | null = await cloudinary.api.sub_folders('portfolio').catch(() => null)
    if (rootSub && rootSub.folders) {
      for (const f of rootSub.folders) {
        const folderName = f.name || f.path.split('/').pop()
        if (folderName !== 'en-uso' && folderName !== 'sin-usar' && folderName !== 'basurero') {
          await cleanSubFoldersRecursively(f.path, 'portfolio/en-uso')
          await cloudinary.api.delete_folder(f.path).catch(() => {})
        }
      }
    }
  } catch (err) {
    console.warn('[cleanupLegacyFolders] error:', err)
  }
}

async function cleanSubFoldersRecursively(parentFolder: string, targetFolder: string): Promise<void> {
  const subRes: { folders?: { path: string }[] } | null = await cloudinary.api.sub_folders(parentFolder).catch(() => null)
  if (!subRes || !subRes.folders || subRes.folders.length === 0) return

  for (const f of subRes.folders) {
    const fPath = f.path
    await cleanSubFoldersRecursively(fPath, targetFolder)

    try {
      let cursor: string | undefined = undefined
      do {
        const resourcesRes: { resources?: { public_id: string; resource_type?: string }[]; next_cursor?: string } | null = await cloudinary.api.resources({
          type: 'upload',
          prefix: `${fPath}/`,
          max_results: 100,
          next_cursor: cursor,
        }).catch(() => null)

        if (resourcesRes && resourcesRes.resources) {
          for (const r of resourcesRes.resources) {
            const filename = r.public_id.split('/').pop()
            const newPublicId = `${targetFolder}/${filename}`
            if (r.public_id !== newPublicId) {
              await cloudinary.uploader.rename(r.public_id, newPublicId, {
                resource_type: r.resource_type || 'image',
                overwrite: true,
                invalidate: true,
              }).catch(() => {})
            }
          }
        }
        cursor = resourcesRes?.next_cursor
      } while (cursor)

      await cloudinary.api.delete_folder(fPath).catch(() => {})
    } catch (e) {
      console.warn(`[cleanSubFoldersRecursively] error in ${fPath}:`, e)
    }
  }
}

// ----- Listado completo de Cloudinary (para auditoría de sincronización) ------

export type CloudinaryResource = {
  public_id: string
  secure_url: string
  resource_type: string
  format: string
  bytes: number
  folder: string
  created_at: string
}

/** Lista TODOS los recursos de Cloudinary.
 *  Intenta primero Search API y luego cae en Admin API si fuera necesario. */
export async function listAllCloudinaryResources(): Promise<CloudinaryResource[]> {
  if (!hasCloudinary) return []
  const allMap = new Map<string, CloudinaryResource>()

  const addResource = (r: Record<string, unknown>, defaultFolder = '') => {
    const secure_url = (r.secure_url as string) || ''
    const public_id = (r.public_id as string) || ''
    if (!public_id && !secure_url) return
    const key = public_id || secure_url

    if (!allMap.has(key)) {
      let folder = (r.asset_folder as string) || (r.folder as string) || defaultFolder
      if (!folder && secure_url) {
        if (secure_url.includes('/portfolio/sin-usar/')) folder = 'portfolio/sin-usar'
        else if (secure_url.includes('/portfolio/basurero/')) folder = 'portfolio/basurero'
        else if (secure_url.includes('/portfolio/en-uso/')) folder = 'portfolio/en-uso'
        else if (secure_url.includes('/portfolio/')) folder = 'portfolio'
      }
      allMap.set(key, {
        public_id,
        secure_url,
        resource_type: (r.resource_type as string) || 'image',
        format: (r.format as string) || '',
        bytes: (r.bytes as number) || 0,
        folder,
        created_at: (r.created_at as string) || '',
      })
    }
  }

  // Método 1: Search API (si está disponible)
  try {
    let cursor: string | undefined = undefined
    do {
      const searchRes = await (cloudinary as any).search
        .expression('public_id:* OR asset_folder:* OR folder:*')
        .max_results(500)
        .next_cursor(cursor)
        .execute() as { resources?: Record<string, unknown>[]; next_cursor?: string }

      if (searchRes?.resources) {
        searchRes.resources.forEach(r => addResource(r))
      }
      cursor = searchRes?.next_cursor
    } while (cursor)
  } catch (err) {
    console.warn('[listAllCloudinaryResources] Search API not available:', err)
  }

  // Método 2: resources_by_asset_folder (para Asset Folders dinámicos)
  const knownFolders = ['portfolio/en-uso', 'portfolio/sin-usar', 'portfolio/basurero', 'portfolio']
  for (const folderPath of knownFolders) {
    try {
      let cursor: string | undefined = undefined
      do {
        const res = await (cloudinary.api as any).resources_by_asset_folder(folderPath, {
          max_results: 500,
          next_cursor: cursor,
        }) as { resources?: Record<string, unknown>[]; next_cursor?: string }

        if (res?.resources) {
          res.resources.forEach(r => addResource(r, folderPath))
        }
        cursor = res?.next_cursor
      } while (cursor)
    } catch {}
  }

  // Método 3: Admin API estándar (api.resources) con type 'upload' y global
  const types: ('image' | 'video' | 'raw')[] = ['image', 'video', 'raw']
  let lastError: unknown = null
  for (const type of types) {
    for (const typeOpt of ['upload', undefined]) {
      let cursor: string | undefined = undefined
      do {
        try {
          const opts: Record<string, unknown> = {
            resource_type: type,
            max_results: 500,
            next_cursor: cursor,
          }
          if (typeOpt) opts.type = typeOpt

          const res = await cloudinary.api.resources(opts as any) as { resources?: Record<string, unknown>[]; next_cursor?: string }

          if (res?.resources) {
            res.resources.forEach(r => addResource(r))
          }
          cursor = res?.next_cursor
        } catch (err) {
          lastError = err
          cursor = undefined
        }
      } while (cursor)
    }
  }

  if (allMap.size === 0 && lastError) {
    throw lastError
  }

  return Array.from(allMap.values())
}

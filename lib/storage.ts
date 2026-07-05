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

/** Slug seguro para carpeta de Cloudinary: "Sobre mí" → "sobre-mi". */
function toSlug(s: string): string {
  return s
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'otros'
}

/** Genera la ruta de carpeta Cloudinary según el estado del contenido.
 *  Simplificado a 3 carpetas principales: en-uso, sin-usar, basurero. */
export function folderSlug(section?: string, mediaState?: 'used' | 'unused' | 'trash', cloudinaryFolder?: string): string {
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
    const commonOptions: Record<string, unknown> = { folder }
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
  const match = url.match(/\/(image|video|raw)\/upload\/(?:[^/]+\/)*?v\d+\/(.+)$/)
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

/** Mueve un asset de Cloudinary a una nueva carpeta (vía rename del public_id).
 *  Devuelve la nueva URL. Si falla, devuelve la URL original sin romper. */
export async function moveAssetFolder(url: string, newFolder: string): Promise<string> {
  if (!hasCloudinary || !url.includes('cloudinary.com')) return url
  try {
    const parsed = parseCloudinaryUrl(url)
    if (!parsed) return url
    // Extraer solo el nombre del archivo (última parte del public_id)
    const parts = parsed.publicId.split('/')
    const filename = parts[parts.length - 1]
    const newPublicId = `${newFolder}/${filename}`
    if (parsed.publicId === newPublicId) return url // ya está en la carpeta correcta
    const result = await cloudinary.uploader.rename(parsed.publicId, newPublicId, {
      resource_type: parsed.resourceType,
      overwrite: true,
      invalidate: true,
    })
    return result.secure_url || url
  } catch (err) {
    console.error('[moveAssetFolder] error:', err)
    return url // devolver la original si falla — no romper el flujo
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


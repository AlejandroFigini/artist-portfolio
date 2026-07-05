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
export function folderSlug(section?: string): string {
  const s = (section || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return s ? `portfolio/${s}` : 'portfolio'
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

/** Borra un asset por su URL (Cloudinary o archivo local). No lanza si no existe. */
export async function deleteAsset(url: string): Promise<void> {
  try {
    if (url.includes('cloudinary.com')) {
      if (!hasCloudinary) return
      // El resource_type real viene en la URL (/image|video|raw/upload/); adivinarlo
      // por extensión rompía el borrado de PDFs (raw) y de videos sin extensión típica.
      const match = url.match(/\/(image|video|raw)\/upload\/(?:[^/]+\/)*?v\d+\/(.+)$/)
      if (!match) return
      const resourceType = match[1] as 'image' | 'video' | 'raw'
      // En raw el public_id conserva la extensión; en image/video se recorta.
      const publicId = resourceType === 'raw' ? match[2] : match[2].replace(/\.[a-zA-Z0-9]+$/, '')
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType })
    } else if (url.startsWith('/uploads/')) {
      await unlink(path.join(process.cwd(), 'public', url.replace(/^\//, ''))).catch(() => {})
    }
  } catch {
    // borrar es best-effort; no romper el flujo si falla
  }
}

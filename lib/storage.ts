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

/** Sube una data URL (base64). Devuelve la URL servible + metadatos.
    kind 'raw' = documentos (ej. CV en PDF): se guarda tal cual, sin transformar. */
export async function uploadDataUrl(dataUrl: string, kind: 'image' | 'video' | 'raw'): Promise<StoredMedia> {
  if (hasCloudinary) {
    if (kind === 'raw') {
      const res = await cloudinary.uploader.upload(dataUrl, { folder: 'portfolio', resource_type: 'raw' })
      return { url: res.secure_url, bytes: res.bytes, format: res.format || 'pdf', assetId: res.asset_id }
    }
    const res = await cloudinary.uploader.upload(dataUrl, {
      folder: 'portfolio',
      resource_type: kind === 'video' ? 'video' : 'image',
      ...(kind === 'video' ? { format: 'webm' } : { format: 'webp' }),
      quality: 'auto',
    })
    return { url: res.secure_url, bytes: res.bytes, format: res.format, assetId: res.asset_id }
  }
  // Local: escribir a public/uploads y devolver una ruta servible (/uploads/..).
  const { buffer, ext } = decodeDataUrl(dataUrl)
  const name = `${randomUUID()}.${ext}`
  await mkdir(LOCAL_DIR, { recursive: true })
  await writeFile(path.join(LOCAL_DIR, name), buffer)
  return { url: `/uploads/${name}`, bytes: buffer.length, format: ext, assetId: `local_${name}` }
}

/** Borra un asset por su URL (Cloudinary o archivo local). No lanza si no existe. */
export async function deleteAsset(url: string): Promise<void> {
  try {
    if (url.includes('cloudinary.com')) {
      if (!hasCloudinary) return
      const match = url.match(/\/v\d+\/(.+)\.[a-zA-Z0-9]+$/)
      if (!match) return
      const publicId = match[1]
      const resourceType = /\.(mp4|webm|mov)$/i.test(url) ? 'video' : 'image'
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType })
    } else if (url.startsWith('/uploads/')) {
      await unlink(path.join(process.cwd(), 'public', url.replace(/^\//, ''))).catch(() => {})
    }
  } catch {
    // borrar es best-effort; no romper el flujo si falla
  }
}

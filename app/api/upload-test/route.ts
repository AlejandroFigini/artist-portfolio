import { NextResponse } from 'next/server'
import { uploadBuffer, folderSlug, UnsupportedMediaError } from '@/lib/storage'
import { requireRole } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* POST /api/upload-test — multipart/form-data con el archivo binario.

   Antes recibía el archivo como data URL dentro de un JSON: eso lo inflaba un
   33% en base64 y obligaba a materializar todo el string en memoria (un video
   de 100 MB llegaba como un JSON de ~134 MB) antes de poder tocarlo. Con
   multipart el archivo viaja binario y se lee de a un Buffer.

   Campos: file (File), name (string), section (string), mediaState (string). */

const MAX_IMAGE_BYTES = 20 * 1024 * 1024
const MAX_VIDEO_BYTES = 100 * 1024 * 1024
const MAX_PDF_BYTES = 10 * 1024 * 1024

export async function POST(req: Request) {
  const auth = await requireRole(req, ['owner', 'admin', 'demo'])
  if ('deny' in auth) return auth.deny

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Se esperaba multipart/form-data' }, { status: 400 })
  }

  const file = form.get('file')
  const originalName = String(form.get('name') || '') || (file instanceof File ? file.name : 'archivo')
  const section = String(form.get('section') || '')
  const mediaState = String(form.get('mediaState') || '') as 'used' | 'unused' | 'trash' | ''

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 })
  }

  const isVideo = file.type.startsWith('video/')
  const isImage = file.type.startsWith('image/')
  const isPdf = file.type === 'application/pdf'
  if (!isVideo && !isImage && !isPdf) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
  }

  /* El tamaño se comprueba con file.size ANTES de leer los bytes: si el
     archivo excede el límite se rechaza sin llegar a cargarlo en memoria. */
  const maxBytes = isVideo ? MAX_VIDEO_BYTES : isPdf ? MAX_PDF_BYTES : MAX_IMAGE_BYTES
  if (file.size > maxBytes) {
    const limitMb = isVideo ? 100 : isPdf ? 10 : 20
    return NextResponse.json(
      { error: `File too large. Maximum ${limitMb} MB for ${isVideo ? 'videos' : isPdf ? 'PDF' : 'images'}.` },
      { status: 413 },
    )
  }

  if (auth.user.role === 'demo') {
    return NextResponse.json({
      success: true,
      secure_url: 'https://via.placeholder.com/800x600?text=Demo+Upload',
      final_bytes: file.size,
      final_format: isVideo ? 'mp4' : 'jpg',
      original_size: file.size,
      original_name: originalName,
      asset_id: 'demo-asset-id',
    })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const folder = folderSlug(section, mediaState || undefined)
    const media = await uploadBuffer(buffer, isVideo ? 'video' : isPdf ? 'raw' : 'image', folder, originalName, file.type)
    return NextResponse.json({
      success: true,
      secure_url: media.url,
      final_bytes: media.bytes || file.size,
      final_format: media.format,
      original_size: file.size,
      original_name: originalName,
      asset_id: media.assetId,
    })
  } catch (err) {
    if (err instanceof UnsupportedMediaError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[upload-test] error:', err)
    return NextResponse.json({ error: 'Error uploading file' }, { status: 500 })
  }
}

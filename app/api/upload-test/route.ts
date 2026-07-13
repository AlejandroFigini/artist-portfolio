import { NextResponse } from 'next/server'
import { uploadDataUrl, folderSlug } from '@/lib/storage'
import { requireSession } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* POST /api/upload-test → recibe una data URL base64 y la guarda en el storage
   del entorno (Cloudinary en prod, filesystem local en dev). Devuelve la URL +
   métricas (lo que espera el cliente: lib/api.ts → uploadMedia). */
export async function POST(req: Request) {
  const auth = await requireSession(req)
  if ('deny' in auth) return auth.deny

  let body: { base64Data?: string; originalSize?: number; originalName?: string; section?: string; mediaState?: 'used' | 'unused' | 'trash' }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const { base64Data, originalSize = 0, originalName = 'archivo', section, mediaState } = body

  if (!base64Data || typeof base64Data !== 'string') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }
  const isVideo = base64Data.startsWith('data:video')
  const isImage = base64Data.startsWith('data:image')
  if (!isVideo && !isImage) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
  }

  try {
    const folder = folderSlug(typeof section === 'string' ? section : '', mediaState)
    const media = await uploadDataUrl(base64Data, isVideo ? 'video' : 'image', folder, originalName)
    return NextResponse.json({
      success: true,
      secure_url: media.url,
      final_bytes: media.bytes || originalSize,
      final_format: media.format,
      original_size: originalSize,
      original_name: originalName,
      asset_id: media.assetId,
    })
  } catch (err) {
    console.error('[upload-test] error:', err)
    return NextResponse.json({ error: 'Error uploading file' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { uploadDataUrl } from '@/lib/storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* POST /api/upload-test → recibe una data URL base64 y la guarda en el storage
   del entorno (Cloudinary en prod, filesystem local en dev). Devuelve la URL +
   métricas (lo que espera el cliente: lib/api.ts → uploadMedia). */
export async function POST(req: Request) {
  let body: { base64Data?: string; originalSize?: number; originalName?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  const { base64Data, originalSize = 0, originalName = 'archivo' } = body

  if (!base64Data || typeof base64Data !== 'string') {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }
  const isVideo = base64Data.startsWith('data:video')
  const isImage = base64Data.startsWith('data:image')
  if (!isVideo && !isImage) {
    return NextResponse.json({ error: 'Tipo de archivo no soportado' }, { status: 400 })
  }

  try {
    const media = await uploadDataUrl(base64Data, isVideo ? 'video' : 'image')
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
    return NextResponse.json({ error: 'Error subiendo el archivo' }, { status: 500 })
  }
}

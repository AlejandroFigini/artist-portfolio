import { NextResponse } from 'next/server'
import { deleteAsset } from '@/lib/storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* POST /api/delete-media → borra un asset por su URL (Cloudinary o archivo local). */
export async function POST(req: Request) {
  let body: { url?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  const { url } = body

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'URL inválida' }, { status: 400 })
  }

  try {
    await deleteAsset(url)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[delete-media] error:', err)
    return NextResponse.json({ error: 'Error borrando el asset' }, { status: 500 })
  }
}

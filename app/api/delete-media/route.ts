import { NextResponse } from 'next/server'
import { deleteAsset } from '@/lib/storage'
import { requireSession } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* POST /api/delete-media → borra un asset por su URL (Cloudinary o archivo local). */
export async function POST(req: Request) {
  const auth = await requireSession(req)
  if ('deny' in auth) return auth.deny

  let body: { url?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const { url } = body

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  try {
    await deleteAsset(url)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[delete-media] error:', err)
    return NextResponse.json({ error: 'Error deleting asset' }, { status: 500 })
  }
}

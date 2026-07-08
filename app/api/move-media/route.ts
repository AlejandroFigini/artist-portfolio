import { NextResponse } from 'next/server'
import { moveAssetFolder } from '@/lib/storage'
import { requireSession } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* POST /api/move-media → mueve un asset de Cloudinary a una nueva carpeta. */
export async function POST(req: Request) {
  const auth = await requireSession(req)
  if ('deny' in auth) return auth.deny

  let body: { url?: string; newFolder?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const { url, newFolder } = body

  if (!url || typeof url !== 'string' || !newFolder || typeof newFolder !== 'string') {
    return NextResponse.json({ error: 'url and newFolder are required' }, { status: 400 })
  }

  try {
    const newUrl = await moveAssetFolder(url, newFolder)
    return NextResponse.json({ success: true, newUrl })
  } catch (err) {
    console.error('[move-media] error:', err)
    return NextResponse.json({ error: 'Error moving asset' }, { status: 500 })
  }
}

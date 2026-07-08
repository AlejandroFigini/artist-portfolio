import { NextResponse } from 'next/server'
import { verifyAssetsExist } from '@/lib/storage'
import { requireSession } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* POST /api/verify-media → verifica en lote si las URLs de Cloudinary existen.
   Recibe { urls: string[] }, devuelve { results: { url, exists }[] }. */
export async function POST(req: Request) {
  const auth = await requireSession(req)
  if ('deny' in auth) return auth.deny

  let body: { urls?: string[] }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const { urls } = body

  if (!Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json({ error: 'An array of URLs is required' }, { status: 400 })
  }

  // Limitar a 100 URLs por request para evitar abuso
  const limited = urls.slice(0, 100).filter((u): u is string => typeof u === 'string' && u.length > 0)

  try {
    const results = await verifyAssetsExist(limited)
    return NextResponse.json({ results })
  } catch (err) {
    console.error('[verify-media] error:', err)
    return NextResponse.json({ error: 'Error verifying assets' }, { status: 500 })
  }
}

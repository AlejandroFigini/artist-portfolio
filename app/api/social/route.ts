import { NextResponse } from 'next/server'
import { getPool, hasDb, ensureDb } from '@/lib/db'
import { SOCIAL_NETWORKS, socialKey } from '@/lib/social'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* GET /api/social → { items: { <id>: url } }
   Lectura liviana de los enlaces sociales (claves social.* de cms_data) para
   que Nav y Footer los apliquen en TODAS las páginas sin cargar todo el CMS.
   Las escrituras reusan POST /api/content (son claves de contenido normales). */
export async function GET() {
  const empty = { items: {} as Record<string, string> }
  if (!hasDb) return NextResponse.json(empty)
  try {
    await ensureDb()
    const pool = getPool()!
    const keys = SOCIAL_NETWORKS.map((n) => socialKey(n.id))
    const res = await pool.query('SELECT key, value FROM cms_data WHERE key = ANY($1)', [keys])
    const items: Record<string, string> = {}
    for (const row of res.rows as { key: string; value: string }[]) {
      items[row.key.replace('social.', '')] = row.value
    }
    return NextResponse.json({ items })
  } catch (err) {
    console.error('[social GET] error:', err)
    return NextResponse.json(empty)
  }
}

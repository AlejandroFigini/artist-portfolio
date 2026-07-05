import { NextResponse } from 'next/server'
import { getPool, hasDb, ensureDb } from '@/lib/db'
import { uploadDataUrl } from '@/lib/storage'
import { requireSession } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* GET /api/content → { version, items }
   Devuelve todo el estado del CMS (key → value). Sin DB → mock vacío (el front
   usa localStorage). Si la DB falla, degrada en vez de romper el sitio. */
export async function GET() {
  if (!hasDb) return NextResponse.json({ version: 1, items: {} })
  try {
    await ensureDb()
    const pool = getPool()!
    const result = await pool.query('SELECT key, value FROM cms_data')
    const items: Record<string, string> = {}
    for (const row of result.rows as { key: string; value: string }[]) items[row.key] = row.value
    return NextResponse.json({ version: 1, items })
  } catch (err) {
    console.error('[content GET] error:', err)
    return NextResponse.json({ version: 1, items: {} })
  }
}

/* POST /api/content → upsert de items.
   Si algún value es una data URL (base64), se sube al storage (Cloudinary en
   prod, filesystem local en dev) y se guarda la URL resultante, no el base64. */
export async function POST(req: Request) {
  const auth = await requireSession(req)
  if ('deny' in auth) return auth.deny

  let body: { items?: Record<string, unknown> }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  const items = body.items
  if (!items || typeof items !== 'object') {
    return NextResponse.json({ error: 'Formato inválido. Se esperaba un objeto items.' }, { status: 400 })
  }

  if (!hasDb) return NextResponse.json({ success: true, message: 'Contenido guardado (mock, sin DB)' })

  await ensureDb()
  const pool = getPool()!
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const [key, value] of Object.entries(items)) {
      let finalValue = value as string
      if (typeof value === 'string' && value.startsWith('data:image')) {
        finalValue = (await uploadDataUrl(value, 'image', 'portfolio', key)).url
      } else if (typeof value === 'string' && value.startsWith('data:video')) {
        finalValue = (await uploadDataUrl(value, 'video', 'portfolio', key)).url
      } else if (typeof value === 'string' && value.startsWith('data:application/pdf')) {
        finalValue = (await uploadDataUrl(value, 'raw', 'portfolio', key)).url
      }
      await client.query(
        `INSERT INTO cms_data (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
        [key, finalValue],
      )
    }
    await client.query('COMMIT')
    return NextResponse.json({ success: true, message: 'Contenido guardado correctamente' })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[content POST] error:', err)
    return NextResponse.json({ error: 'Error guardando contenido' }, { status: 500 })
  } finally {
    client.release()
  }
}

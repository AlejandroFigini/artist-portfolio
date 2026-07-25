import { NextResponse } from 'next/server'
import { getPool, hasDb, ensureDb } from '@/lib/db'
import { requireSession } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* Keys de estado CMS que se sincronizan entre dispositivos.
   Cada una se guarda como JSONB en cms_state. */
const STATE_KEYS = [
  'used_content',
  'unused',
  'retired',
  'trash',
  'media_meta',
  'audit',
  'container_names',
] as const

/* Defaults para cada key — se devuelven siempre aunque la DB no tenga registro.
   Así el cliente sabe que la DB está vacía y no conserva datos stale de localStorage. */
const DEFAULTS: Record<string, unknown> = {
  used_content: {},
  unused: [],
  retired: [],
  trash: [],
  media_meta: {},
  audit: [],
  container_names: {},
}

/* GET /api/state → { [key]: value } para TODAS las state keys.
   Keys sin registro en la DB devuelven su default vacío. No requiere sesión:
   el sitio público necesita `retired` para mostrar los slots vacíos. */
export async function GET() {
  if (!hasDb) return NextResponse.json(DEFAULTS)
  try {
    await ensureDb()
    const pool = getPool()!
    const result = await pool.query(
      'SELECT key, value FROM cms_state WHERE key = ANY($1)',
      [STATE_KEYS],
    )
    const out: Record<string, unknown> = { ...DEFAULTS }
    for (const row of result.rows as { key: string; value: unknown }[]) {
      out[row.key] = row.value
    }
    return NextResponse.json(out)
  } catch (err) {
    console.error('[state GET] error:', err)
    return NextResponse.json({})
  }
}

/* POST /api/state → upsert parcial. Body: { [key]: value }.
   Solo keys reconocidas; requiere sesión. */
export async function POST(req: Request) {
  const auth = await requireSession(req)
  if ('deny' in auth) return auth.deny

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!hasDb) return NextResponse.json({ success: true })

  await ensureDb()
  const pool = getPool()!
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const key of STATE_KEYS) {
      if (!(key in body)) continue
      await client.query(
        `INSERT INTO cms_state (key, value, updated_at)
         VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (key)
         DO UPDATE SET value = $2::jsonb, updated_at = CURRENT_TIMESTAMP`,
        [key, JSON.stringify(body[key])],
      )
    }
    await client.query('COMMIT')
    return NextResponse.json({ success: true })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[state POST] error:', err)
    return NextResponse.json({ error: 'Error saving state' }, { status: 500 })
  } finally {
    client.release()
  }
}

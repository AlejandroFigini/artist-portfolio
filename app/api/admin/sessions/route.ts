import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { requireRole } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* Política global de sesiones (solo owner):
   - GET  → { maxMinutes } vigente (0/null = sin tope).
   - POST { action: 'reset_all' } → mata TODAS las sesiones salvo la del propio
     owner (para no auto-desloguearse con su propio click).
   - POST { maxMinutes } → guarda el tope de vida (0/null lo desactiva). Se
     aplica a las sesiones NUEVAS vía createSession. */

const MAX_MINUTES = 10080 // 1 semana

export async function GET(req: Request) {
  const auth = await requireRole(req, ['owner'])
  if ('deny' in auth) return auth.deny
  const { rows } = await getPool()!.query("SELECT value FROM cms_state WHERE key = 'session_policy'")
  const maxMinutes = (rows[0]?.value as { maxMinutes?: number } | undefined)?.maxMinutes ?? null
  return NextResponse.json({ success: true, maxMinutes })
}

export async function POST(req: Request) {
  const auth = await requireRole(req, ['owner'])
  if ('deny' in auth) return auth.deny

  let body: { action?: string; maxMinutes?: number | null }
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }
  const pool = getPool()!

  if (body.action === 'reset_all') {
    // No se borra la sesión actual del owner: el resto (otros usuarios y sus
    // otras sesiones) cae y debe re-loguear.
    const { rowCount } = await pool.query('DELETE FROM sessions WHERE id <> $1', [auth.user.sid])
    return NextResponse.json({ success: true, killed: rowCount ?? 0 })
  }

  if (body.maxMinutes !== undefined) {
    const raw = body.maxMinutes
    if (raw !== null && (!Number.isInteger(raw) || raw < 0 || raw > MAX_MINUTES)) {
      return NextResponse.json({ success: false, error: `maxMinutes must be between 0 and ${MAX_MINUTES}` }, { status: 400 })
    }
    const value = JSON.stringify({ maxMinutes: raw && raw > 0 ? raw : null })
    await pool.query(
      "INSERT INTO cms_state (key, value) VALUES ('session_policy', $1::jsonb) ON CONFLICT (key) DO UPDATE SET value = $1::jsonb, updated_at = CURRENT_TIMESTAMP",
      [value],
    )
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
}

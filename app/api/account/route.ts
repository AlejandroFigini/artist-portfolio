import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { requireSession, verifyPassword, hashPassword, destroyOtherSessions } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* GET /api/account → identidad de la sesión actual. El front lo usa como
   fuente de verdad de "estoy logeado" (la cookie es httpOnly, JS no la lee). */
export async function GET(req: Request) {
  const auth = await requireSession(req)
  if ('deny' in auth) return auth.deny
  const { username, totpEnabled } = auth.user
  return NextResponse.json({ success: true, user: { username, totpEnabled } })
}

/* PATCH /api/account → el usuario logeado edita SUS credenciales.
   - Solo edita session.user_id (nunca acepta un id del body).
   - Cambio de contraseña exige currentPassword correcto (re-auth).
   - Tras cambiar contraseña, invalida las demás sesiones del usuario. */
export async function PATCH(req: Request) {
  const auth = await requireSession(req)
  if ('deny' in auth) return auth.deny
  const me = auth.user

  let body: { username?: string; currentPassword?: string; newPassword?: string }
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }

  const pool = getPool()!
  const updates: string[] = []
  const values: unknown[] = []

  if (body.username !== undefined) {
    const username = String(body.username).trim()
    if (username.length < 3 || username.length > 64) {
      return NextResponse.json({ success: false, error: 'Username must be between 3 and 64 characters' }, { status: 400 })
    }
    const dup = await pool.query('SELECT 1 FROM users WHERE username = $1 AND id <> $2', [username, me.id])
    if (dup.rows.length) {
      return NextResponse.json({ success: false, error: 'Username is already in use' }, { status: 409 })
    }
    values.push(username)
    updates.push(`username = $${values.length}`)
  }

  let passwordChanged = false
  if (body.newPassword !== undefined) {
    const newPassword = String(body.newPassword)
    if (newPassword.length < 8) {
      return NextResponse.json({ success: false, error: 'New password must be at least 8 characters long' }, { status: 400 })
    }
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [me.id])
    const ok = await verifyPassword(String(body.currentPassword || ''), rows[0].password_hash)
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Current password is incorrect' }, { status: 401 })
    }
    values.push(await hashPassword(newPassword))
    updates.push(`password_hash = $${values.length}`)
    passwordChanged = true
  }

  if (!updates.length) {
    return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 })
  }

  values.push(me.id)
  await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${values.length}`, values)
  if (passwordChanged) await destroyOtherSessions(me.id, me.sid)

  const username = body.username !== undefined ? String(body.username).trim() : me.username
  return NextResponse.json({ success: true, user: { username, totpEnabled: me.totpEnabled } })
}

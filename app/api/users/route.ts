import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { requireRole } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* GET /api/users → lista de usuarios para la sección "Administrar usuarios"
   de Gestión. Solo con sesión. Nunca expone hashes ni secretos TOTP. */
export async function GET(req: Request) {
  // Owner y admin pueden VER la lista; crear/editar/borrar (POST/PATCH/DELETE)
  // sigue siendo exclusivo del owner.
  const auth = await requireRole(req, ['owner', 'admin'])
  if ('deny' in auth) return auth.deny

  try {
    const { rows } = await getPool()!.query(
      'SELECT username, role, totp_enabled, is_blocked, session_ttl_minutes, last_login_at, created_at FROM users ORDER BY id',
    )
    return NextResponse.json({
      success: true,
      users: rows.map((r: { username: string; role: string; totp_enabled: boolean; is_blocked: boolean; session_ttl_minutes: number | null; last_login_at: string | null; created_at: string }) => ({
        username: r.username,
        role: r.role,
        isBlocked: !!r.is_blocked,
        sessionTtlMinutes: r.session_ttl_minutes,
        totpEnabled: !!r.totp_enabled,
        lastLoginAt: r.last_login_at,
        createdAt: r.created_at,
      })),
    })
  } catch (err) {
    console.error('[users GET] error:', err)
    return NextResponse.json({ success: false, error: 'Error listing users' }, { status: 500 })
  }
}

import { hashPassword } from '@/lib/auth'

/* POST /api/users → crear nuevo usuario. Solo el owner puede hacerlo. */
export async function POST(req: Request) {
  const auth = await requireRole(req, ['owner'])
  if ('deny' in auth) return auth.deny

  let body: { username?: string; password?: string; role?: string }
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }

  const username = String(body.username || '').trim()
  const password = String(body.password || '')
  const role = String(body.role || 'demo')

  if (username.length < 3 || username.length > 64) {
    return NextResponse.json({ success: false, error: 'Username must be between 3 and 64 characters' }, { status: 400 })
  }
  // Contraseña de alta = temporal: el owner puede poner cualquier cosa no
  // vacía; el usuario está forzado a cambiarla en el primer login (needs_setup),
  // y ahí sí se exige el mínimo de 8. Por eso acá solo se pide que no sea vacía.
  if (password.length < 1) {
    return NextResponse.json({ success: false, error: 'Password is required' }, { status: 400 })
  }
  if (!['admin', 'demo'].includes(role)) {
    return NextResponse.json({ success: false, error: 'Invalid role (cannot create owner)' }, { status: 400 })
  }

  const pool = getPool()!
  const dup = await pool.query('SELECT 1 FROM users WHERE LOWER(username) = LOWER($1)', [username])
  if (dup.rows.length) {
    return NextResponse.json({ success: false, error: 'Username is already in use' }, { status: 409 })
  }

  try {
    const hashed = await hashPassword(password)
    await pool.query(
      'INSERT INTO users (username, password_hash, role, needs_setup) VALUES ($1, $2, $3, true)',
      [username, hashed, role]
    )
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[users POST] error:', err)
    return NextResponse.json({ success: false, error: 'Error creating user' }, { status: 500 })
  }
}

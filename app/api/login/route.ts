import { NextResponse } from 'next/server'
import { verify } from 'otplib'
import { getPool, ensureDb, hasDb } from '@/lib/db'
import { verifyPassword, createSession, setSessionCookie } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* POST /api/login → login por usuario contra la tabla `users` (2 usuarios
   sembrados en boot). Flujo:
   - user+pass válidos, usuario SIN 2FA activado → sesión directa
     (el 2FA se activa después desde "Mi cuenta").
   - user+pass válidos, usuario CON 2FA → pide código; con código → verifica
     TOTP (epochTolerance ±30s) → sesión.
   Sesión = cookie httpOnly `sid` + fila en `sessions`. */
export async function POST(req: Request) {
  let body: { user?: string; pass?: string; code?: string | null }
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }
  const user = (body.user || '').trim()
  const pass = body.pass || ''
  const code = body.code

  if (!hasDb) {
    return NextResponse.json({ success: false, error: 'Database not configured (DATABASE_URL).' }, { status: 500 })
  }
  if (!user || !pass) {
    return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 })
  }

  try {
    await ensureDb()
    const pool = getPool()!
    const { rows } = await pool.query(
      'SELECT id, username, role, needs_setup, is_blocked, password_hash, totp_secret, totp_enabled FROM users WHERE username = $1',
      [user],
    )
    const u = rows[0]
    // comparar siempre (hash dummy si no existe) → no filtrar qué usuarios existen por timing
    const ok = await verifyPassword(pass, u?.password_hash || '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva')
    if (!u || !ok) {
      const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
      const ua = req.headers.get('user-agent') || 'unknown'
      await pool.query(
        'INSERT INTO failed_logins (username, ip_address, user_agent) VALUES ($1, $2, $3)',
        [user.substring(0, 64), ip.substring(0, 45), ua]
      ).catch(e => console.error('[login] db failed_logins error:', e))
      
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 })
    }

    if (u.is_blocked) {
      return NextResponse.json({ success: false, error: 'Account is locked. Please contact the administrator.' }, { status: 403 })
    }

    if (u.totp_enabled) {
      if (!code) {
        return NextResponse.json({ success: true, require2FA: true, message: 'Valid credentials, enter 2FA code' })
      }
      const result = await verify({ token: String(code), secret: u.totp_secret, epochTolerance: 30 })
      if (!result.valid) {
        const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
        const ua = req.headers.get('user-agent') || 'unknown'
        await pool.query(
          'INSERT INTO failed_logins (username, ip_address, user_agent) VALUES ($1, $2, $3)',
          [user.substring(0, 64), ip.substring(0, 45), ua]
        ).catch(e => console.error('[login] db failed_logins error:', e))
        
        return NextResponse.json({ success: false, error: 'Incorrect 2FA code' }, { status: 401 })
      }
    }

    const { token, maxAge } = await createSession(u.id, u.role || 'owner')
    await pool.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [u.id])
    const res = NextResponse.json({
      success: true,
      message: 'Login successful',
      user: { username: u.username, role: u.role || 'owner', needsSetup: !!u.needs_setup, totpEnabled: !!u.totp_enabled },
    })
    setSessionCookie(res, token, maxAge)
    return res
  } catch (err) {
    console.error('[login] error:', err)
    return NextResponse.json({ success: false, error: 'Internal login error' }, { status: 500 })
  }
}

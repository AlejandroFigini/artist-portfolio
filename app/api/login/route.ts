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
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 }) }
  const user = (body.user || '').trim()
  const pass = body.pass || ''
  const code = body.code

  if (!hasDb) {
    return NextResponse.json({ success: false, error: 'Base de datos no configurada (DATABASE_URL).' }, { status: 500 })
  }
  if (!user || !pass) {
    return NextResponse.json({ success: false, error: 'Credenciales inválidas' }, { status: 401 })
  }

  try {
    await ensureDb()
    const pool = getPool()!
    const { rows } = await pool.query(
      'SELECT id, username, password_hash, totp_secret, totp_enabled FROM users WHERE username = $1',
      [user],
    )
    const u = rows[0]
    // comparar siempre (hash dummy si no existe) → no filtrar qué usuarios existen por timing
    const ok = await verifyPassword(pass, u?.password_hash || '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva')
    if (!u || !ok) {
      return NextResponse.json({ success: false, error: 'Credenciales inválidas' }, { status: 401 })
    }

    if (u.totp_enabled) {
      if (!code) {
        return NextResponse.json({ success: true, require2FA: true, message: 'Credenciales válidas, ingrese código 2FA' })
      }
      const result = await verify({ token: String(code), secret: u.totp_secret, epochTolerance: 30 })
      if (!result.valid) {
        return NextResponse.json({ success: false, error: 'Código 2FA incorrecto' }, { status: 401 })
      }
    }

    const { token, maxAge } = await createSession(u.id)
    await pool.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [u.id])
    const res = NextResponse.json({
      success: true,
      message: 'Login exitoso',
      user: { username: u.username, totpEnabled: !!u.totp_enabled },
    })
    setSessionCookie(res, token, maxAge)
    return res
  } catch (err) {
    console.error('[login] error:', err)
    return NextResponse.json({ success: false, error: 'Error interno de login' }, { status: 500 })
  }
}

import 'server-only'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'
import { getPool, ensureDb, hasDb } from './db'

/* Sesiones server-side sobre Postgres. Reemplaza al flag cliente
   (localStorage/cookie cms_admin) del prototipo legacy.
   - Cookie `sid` httpOnly → JS no la lee; el server decide quién está logeado.
   - Tabla `sessions` → logout real y revocación (cambio de contraseña). */

export const SESSION_COOKIE = 'sid'
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 días

export type SessionUser = {
  id: number
  username: string
  role: string
  needsSetup: boolean
  totpEnabled: boolean
}

export const hashPassword = (plain: string): Promise<string> => bcrypt.hash(plain, 12)
export const verifyPassword = (plain: string, hash: string): Promise<boolean> => bcrypt.compare(plain, hash)

export async function createSession(userId: number, role: string = 'owner'): Promise<{ token: string; maxAge: number }> {
  const pool = getPool()!
  const token = randomBytes(32).toString('hex')
  
  let ttl = SESSION_TTL_MS
  if (role === 'demo') {
    const { rows } = await pool.query('SELECT session_ttl_minutes FROM users WHERE id = $1', [userId])
    const customTtl = rows[0]?.session_ttl_minutes
    ttl = customTtl ? customTtl * 60 * 1000 : 60 * 60 * 1000 // default 1 hour
  }
  
  const expires = new Date(Date.now() + ttl)
  await pool.query('INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)', [token, userId, expires])
  return { token, maxAge: Math.floor(ttl / 1000) }
}

export async function destroySession(token: string): Promise<void> {
  const pool = getPool()
  if (!pool) return
  await pool.query('DELETE FROM sessions WHERE id = $1', [token])
}

/* Invalida todas las sesiones del usuario salvo la actual (post cambio de password). */
export async function destroyOtherSessions(userId: number, keepToken: string): Promise<void> {
  await getPool()!.query('DELETE FROM sessions WHERE user_id = $1 AND id <> $2', [userId, keepToken])
}

function readSid(req: Request): string | null {
  const cookie = req.headers.get('cookie') || ''
  const m = cookie.match(/(?:^|;\s*)sid=([^;]+)/)
  return m ? m[1] : null
}

/* Usuario de la sesión actual o null. Borra sesiones expiradas de forma perezosa. */
export async function getSessionUser(req: Request): Promise<(SessionUser & { sid: string }) | null> {
  if (!hasDb) return null
  await ensureDb()
  const sid = readSid(req)
  if (!sid) return null
  const pool = getPool()!
  const { rows } = await pool.query(
    `SELECT u.id, u.username, u.role, u.needs_setup, u.totp_enabled, u.is_blocked, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = $1`,
    [sid],
  )
  const row = rows[0]
  if (!row) return null
  if (new Date(row.expires_at).getTime() < Date.now() || row.is_blocked) {
    await destroySession(sid)
    return null
  }
  return { id: row.id, username: row.username, role: row.role || 'owner', needsSetup: !!row.needs_setup, totpEnabled: !!row.totp_enabled, sid }
}

/* Gate para endpoints mutantes: devuelve el user o una respuesta 401 lista. */
export async function requireSession(req: Request): Promise<{ user: SessionUser & { sid: string } } | { deny: NextResponse }> {
  const user = await getSessionUser(req)
  if (!user) return { deny: NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 }) }
  return { user }
}

export async function requireRole(req: Request, allowedRoles: string[]): Promise<{ user: SessionUser & { sid: string } } | { deny: NextResponse }> {
  const auth = await requireSession(req)
  if ('deny' in auth) return auth
  if (!allowedRoles.includes(auth.user.role)) {
    return { deny: NextResponse.json({ success: false, error: 'Permisos insuficientes' }, { status: 403 }) }
  }
  return auth
}

export function setSessionCookie(res: NextResponse, token: string, maxAge: number): void {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  })
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 })
}

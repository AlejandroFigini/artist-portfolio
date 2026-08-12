import { NextResponse } from 'next/server'
import { generateSecret, verify } from 'otplib'
import { getPool } from '@/lib/db'
import { requireSession, verifyPassword } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* POST /api/account/2fa → gestiona el 2FA del usuario logeado.
   { action: 'setup' }                → genera secreto pendiente + otpauth URI (QR).
   { action: 'enable', code }         → verifica el primer código → activa.
   { action: 'disable', password }    → re-auth con contraseña → desactiva. */
export async function POST(req: Request) {
  const auth = await requireSession(req)
  if ('deny' in auth) return auth.deny
  const me = auth.user

  let body: { action?: string; code?: string; password?: string }
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }
  const pool = getPool()!

  try {
    if (body.action === 'setup') {
      const secret = generateSecret()
      // Se guarda como PENDIENTE: no pisa totp_secret ni apaga un 2FA ya activo.
      // El 2FA vigente sigue funcionando hasta que 'enable' confirme el nuevo.
      await pool.query('UPDATE users SET totp_pending_secret = $1 WHERE id = $2', [secret, me.id])
      const label = encodeURIComponent(`LuciaMontana:${me.username}`)
      const uri = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent('LuciaMontana')}`
      return NextResponse.json({ success: true, secret, uri })
    }

    if (body.action === 'enable') {
      const { rows } = await pool.query('SELECT totp_pending_secret FROM users WHERE id = $1', [me.id])
      const secret = rows[0]?.totp_pending_secret
      if (!secret) return NextResponse.json({ success: false, error: 'First generate the QR code (setup)' }, { status: 400 })
      const result = await verify({ token: String(body.code || ''), secret, epochTolerance: 30 })
      if (!result.valid) return NextResponse.json({ success: false, error: 'Incorrect 2FA code' }, { status: 401 })
      // Recién acá el secreto pendiente se promueve a activo.
      await pool.query('UPDATE users SET totp_secret = $1, totp_enabled = TRUE, totp_pending_secret = NULL WHERE id = $2', [secret, me.id])
      return NextResponse.json({ success: true })
    }

    if (body.action === 'disable') {
      const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [me.id])
      const ok = await verifyPassword(String(body.password || ''), rows[0].password_hash)
      if (!ok) return NextResponse.json({ success: false, error: 'Incorrect password' }, { status: 401 })
      await pool.query('UPDATE users SET totp_enabled = FALSE, totp_secret = NULL, totp_pending_secret = NULL WHERE id = $1', [me.id])
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('[2fa] error:', err)
    return NextResponse.json({ success: false, error: 'Internal 2FA error' }, { status: 500 })
  }
}

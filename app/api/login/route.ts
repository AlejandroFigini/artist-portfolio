import { NextResponse } from 'next/server'
import { verify } from 'otplib'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* POST /api/login → valida admin + 2FA (TOTP).
   Credenciales SOLO desde env (no hardcodeadas):
     ADMIN_USER, ADMIN_PASS, ADMIN_2FA_SECRET
   Flujo: user+pass válidos sin code → pide 2FA; con code → verifica TOTP. */
export async function POST(req: Request) {
  let body: { user?: string; pass?: string; code?: string | null }
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 }) }
  const { user, pass, code } = body

  const validUser = process.env.ADMIN_USER
  const validPass = process.env.ADMIN_PASS
  const secret = process.env.ADMIN_2FA_SECRET

  if (!validUser || !validPass || !secret) {
    return NextResponse.json(
      { success: false, error: 'Admin no configurado (faltan ADMIN_USER/ADMIN_PASS/ADMIN_2FA_SECRET).' },
      { status: 500 },
    )
  }

  if (user !== validUser || pass !== validPass) {
    return NextResponse.json({ success: false, error: 'Credenciales inválidas' }, { status: 401 })
  }

  if (!code) {
    return NextResponse.json({ success: true, require2FA: true, message: 'Credenciales válidas, ingrese código 2FA' })
  }

  try {
    // epochTolerance: ±30s para tolerar desfase de reloj entre el dispositivo y el server.
    const result = await verify({ token: String(code), secret, epochTolerance: 30 })
    if (result.valid) {
      return NextResponse.json({ success: true, message: 'Login exitoso' })
    }
    return NextResponse.json({ success: false, error: 'Código 2FA incorrecto' }, { status: 401 })
  } catch (err) {
    console.error('[login] error verificando 2FA:', err)
    return NextResponse.json({ success: false, error: 'Error verificando el código 2FA' }, { status: 500 })
  }
}

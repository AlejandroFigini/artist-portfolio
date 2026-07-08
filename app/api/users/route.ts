import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { requireSession } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* GET /api/users → lista de usuarios para la sección "Administrar usuarios"
   de Gestión. Solo con sesión. Nunca expone hashes ni secretos TOTP. */
export async function GET(req: Request) {
  const auth = await requireSession(req)
  if ('deny' in auth) return auth.deny

  try {
    const { rows } = await getPool()!.query(
      'SELECT username, totp_enabled, last_login_at, created_at FROM users ORDER BY id',
    )
    return NextResponse.json({
      success: true,
      users: rows.map((r: { username: string; totp_enabled: boolean; last_login_at: string | null; created_at: string }) => ({
        username: r.username,
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

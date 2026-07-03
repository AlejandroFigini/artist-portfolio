import { NextResponse } from 'next/server'
import { getSessionUser, destroySession, clearSessionCookie } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* POST /api/logout → borra la sesión en DB y limpia la cookie. */
export async function POST(req: Request) {
  const user = await getSessionUser(req)
  if (user) await destroySession(user.sid)
  const res = NextResponse.json({ success: true })
  clearSessionCookie(res)
  return res
}

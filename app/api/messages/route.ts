import { NextResponse } from 'next/server'
import { getPool, hasDb, ensureDb } from '@/lib/db'
import { requireRole } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* GET /api/messages — lista mensajes de contacto (admin).
   Query params: ?page=1&limit=20&unread=true */
export async function GET(req: Request) {
  const auth = await requireRole(req, ['owner', 'admin', 'demo'])
  if ('deny' in auth) return auth.deny
  if (!hasDb) return NextResponse.json({ messages: [], total: 0, unread: 0 })

  await ensureDb()
  const pool = getPool()!

  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')))
  const onlyUnread = url.searchParams.get('unread') === 'true'
  const offset = (page - 1) * limit

  const where = onlyUnread ? 'WHERE is_read = FALSE' : ''

  const [{ rows: messages }, { rows: countRows }, { rows: unreadRows }] = await Promise.all([
    pool.query(
      `SELECT id, sender_name, sender_email, subject, message, ip_address, is_read, created_at
       FROM contact_messages ${where}
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    ),
    pool.query(`SELECT COUNT(*)::int AS total FROM contact_messages ${where}`),
    pool.query(`SELECT COUNT(*)::int AS n FROM contact_messages WHERE is_read = FALSE`),
  ])

  return NextResponse.json({
    messages,
    total: countRows[0].total,
    unread: unreadRows[0].n,
    page,
    limit,
  })
}

/* PATCH /api/messages — marcar leído/no leído.
   Body: { id: number, is_read: boolean } | { ids: number[], is_read: boolean } */
export async function PATCH(req: Request) {
  const auth = await requireRole(req, ['owner', 'admin'])
  if ('deny' in auth) return auth.deny
  if (!hasDb) return NextResponse.json({ success: true })

  await ensureDb()
  const pool = getPool()!

  let body: { id?: number; ids?: number[]; is_read?: boolean }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const isRead = !!body.is_read
  const ids = body.ids || (body.id != null ? [body.id] : [])
  if (ids.length === 0) return NextResponse.json({ error: 'No IDs provided' }, { status: 400 })

  await pool.query(
    `UPDATE contact_messages SET is_read = $1 WHERE id = ANY($2::int[])`,
    [isRead, ids],
  )

  return NextResponse.json({ success: true })
}

/* DELETE /api/messages — eliminar mensajes.
   Body: { id: number } | { ids: number[] } */
export async function DELETE(req: Request) {
  const auth = await requireRole(req, ['owner', 'admin'])
  if ('deny' in auth) return auth.deny
  if (!hasDb) return NextResponse.json({ success: true })

  await ensureDb()
  const pool = getPool()!

  let body: { id?: number; ids?: number[] }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const ids = body.ids || (body.id != null ? [body.id] : [])
  if (ids.length === 0) return NextResponse.json({ error: 'No IDs provided' }, { status: 400 })

  await pool.query(
    `DELETE FROM contact_messages WHERE id = ANY($1::int[])`,
    [ids],
  )

  return NextResponse.json({ success: true })
}

import { NextResponse } from 'next/server'
import { getPool, hasDb, ensureDb } from '@/lib/db'
import { requireRole } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* GET /api/messages — lista mensajes de contacto (admin).
   Query params: ?page=1&limit=20&unread=true&starred=true&trashed=true */
export async function GET(req: Request) {
  const auth = await requireRole(req, ['owner', 'admin', 'demo'])
  if ('deny' in auth) return auth.deny

  // Demo: bandeja ficticia. Nunca se exponen mensajes reales (nombres/emails/IPs).
  if (auth.user.role === 'demo') {
    const url = new URL(req.url)
    const { demoMessagesResponse } = await import('@/lib/demo-mock')
    return NextResponse.json(demoMessagesResponse({
      onlyUnread: url.searchParams.get('unread') === 'true',
      onlyStarred: url.searchParams.get('starred') === 'true',
      onlyTrashed: url.searchParams.get('trashed') === 'true',
    }))
  }

  if (!hasDb) return NextResponse.json({ messages: [], total: 0, unread: 0 })

  await ensureDb()
  const pool = getPool()!

  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')))
  const onlyUnread = url.searchParams.get('unread') === 'true'
  const onlyStarred = url.searchParams.get('starred') === 'true'
  const onlyTrashed = url.searchParams.get('trashed') === 'true'
  const offset = (page - 1) * limit

  // Ejecutar auto-delete pasivo si hay configuración
  try {
    const s = await pool.query(`SELECT value FROM cms_data WHERE key = 'messages.trashAutoDeleteDays'`)
    if (s.rows.length > 0 && s.rows[0].value) {
      const days = parseInt(s.rows[0].value)
      if (days > 0) {
        await pool.query(`DELETE FROM contact_messages WHERE is_trashed = TRUE AND created_at < NOW() - INTERVAL '${days} days'`)
      }
    }
  } catch (e) {
    console.error('[messages auto-delete error]', e)
  }

  const conds = []
  if (onlyTrashed) {
    conds.push('is_trashed = TRUE')
  } else {
    conds.push('is_trashed = FALSE')
    if (onlyUnread) conds.push('is_read = FALSE')
    if (onlyStarred) conds.push('is_starred = TRUE')
  }
  const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : ''

  const [{ rows: messages }, { rows: countRows }, { rows: unreadRows }, { rows: inboxRows }, { rows: starredRows }, { rows: trashRows }] = await Promise.all([
    pool.query(
      `SELECT id, sender_name, sender_email, country, subject, message, ip_address, is_read, is_starred, is_trashed, email_sent, email_error, created_at
       FROM contact_messages ${where}
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    ),
    pool.query(`SELECT COUNT(*)::int AS total FROM contact_messages ${where}`),
    pool.query(`SELECT COUNT(*)::int AS n FROM contact_messages WHERE is_read = FALSE`),
    pool.query(`SELECT COUNT(*)::int AS n FROM contact_messages WHERE is_trashed = FALSE`),
    pool.query(`SELECT COUNT(*)::int AS n FROM contact_messages WHERE is_starred = TRUE AND is_trashed = FALSE`),
    pool.query(`SELECT COUNT(*)::int AS n FROM contact_messages WHERE is_trashed = TRUE`),
  ])

  return NextResponse.json({
    messages,
    total: countRows[0].total,
    unread: unreadRows[0].n,
    counts: {
      inbox: inboxRows[0].n,
      starred: starredRows[0].n,
      trash: trashRows[0].n,
    },
    page,
    limit,
  })
}

/* PATCH /api/messages — marcar leído/no leído, destacado/no destacado, o basura.
   Body: { id: number, is_read?: boolean, is_starred?: boolean, is_trashed?: boolean } | { ids: number[], is_read?: boolean, is_starred?: boolean, is_trashed?: boolean } */
export async function PATCH(req: Request) {
  const auth = await requireRole(req, ['owner', 'admin', 'demo'])
  if ('deny' in auth) return auth.deny
  if (auth.user.role === 'demo') return NextResponse.json({ success: true }) // no-op
  if (!hasDb) return NextResponse.json({ success: true })

  await ensureDb()
  const pool = getPool()!

  let body: { id?: number; ids?: number[]; is_read?: boolean; is_starred?: boolean; is_trashed?: boolean }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const ids = body.ids || (body.id != null ? [body.id] : [])
  if (ids.length === 0) return NextResponse.json({ error: 'No IDs provided' }, { status: 400 })

  if (body.is_read !== undefined) {
    await pool.query(
      `UPDATE contact_messages SET is_read = $1 WHERE id = ANY($2::int[])`,
      [body.is_read, ids],
    )
  }

  if (body.is_starred !== undefined) {
    await pool.query(
      `UPDATE contact_messages SET is_starred = $1 WHERE id = ANY($2::int[])`,
      [body.is_starred, ids],
    )
  }

  if (body.is_trashed !== undefined) {
    await pool.query(
      `UPDATE contact_messages SET is_trashed = $1 WHERE id = ANY($2::int[])`,
      [body.is_trashed, ids],
    )
  }

  return NextResponse.json({ success: true })
}

/* DELETE /api/messages — eliminar mensajes o vaciar papelera.
   Body: { id: number } | { ids: number[] }
   Query: ?empty_trash=true */
export async function DELETE(req: Request) {
  const auth = await requireRole(req, ['owner', 'admin', 'demo'])
  if ('deny' in auth) return auth.deny
  if (auth.user.role === 'demo') return NextResponse.json({ success: true }) // no-op
  if (!hasDb) return NextResponse.json({ success: true })
  await ensureDb()
  const pool = getPool()!

  const url = new URL(req.url)
  if (url.searchParams.get('empty_trash') === 'true') {
    await pool.query(`DELETE FROM contact_messages WHERE is_trashed = TRUE`)
    return NextResponse.json({ success: true })
  }

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

import { NextResponse } from 'next/server'
import { getPool, hasDb, ensureDb } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { buildContactNotification, getNotificationEmails, sendMail } from '@/lib/mail'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* POST /api/messages/resend — reintenta la notificación por mail de un mensaje
   que quedó sin entregar (email_sent = FALSE). Body: { id: number }.
   Cierra el hueco de los fallos silenciosos: el mensaje siempre se guardó, pero
   antes no había forma de recuperar el aviso perdido. */
export async function POST(req: Request) {
  const auth = await requireRole(req, ['owner', 'admin', 'demo'])
  if ('deny' in auth) return auth.deny
  if (auth.user.role === 'demo') return NextResponse.json({ success: true }) // no-op
  if (!hasDb) return NextResponse.json({ error: 'No database configured' }, { status: 503 })

  let body: { id?: number }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (typeof body.id !== 'number') return NextResponse.json({ error: 'No ID provided' }, { status: 400 })

  await ensureDb()
  const pool = getPool()!

  const { rows } = await pool.query(
    `SELECT sender_name, sender_email, country, subject, message, ip_address
     FROM contact_messages WHERE id = $1`,
    [body.id],
  )
  if (rows.length === 0) return NextResponse.json({ error: 'Message not found' }, { status: 404 })

  const row = rows[0] as {
    sender_name: string; sender_email: string; country: string | null
    subject: string; message: string; ip_address: string | null
  }

  const mail = buildContactNotification({
    name: row.sender_name,
    email: row.sender_email,
    country: row.country || '',
    subject: row.subject,
    message: row.message,
    ip: row.ip_address || 'unknown',
  })
  const result = await sendMail({ to: await getNotificationEmails(), ...mail })

  await pool.query(
    `UPDATE contact_messages SET email_sent = $1, email_error = $2 WHERE id = $3`,
    [result.sent, result.sent ? null : result.reason, body.id],
  )

  if (!result.sent) {
    return NextResponse.json({ error: result.reason }, { status: 502 })
  }
  return NextResponse.json({ success: true })
}

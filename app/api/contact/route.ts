import { NextResponse } from 'next/server'
import { getPool, hasDb, ensureDb } from '@/lib/db'
import { getClientIp, checkContactRateLimit } from '@/lib/rate-limit'
import { buildContactNotification, getNotificationEmails, isValidEmail, sendMail } from '@/lib/mail'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* POST /api/contact — recibe un mensaje de contacto del formulario público.
   Valida campos, verifica captcha Turnstile, aplica rate limiting por IP,
   guarda el mensaje en DB y lo notifica por email (lib/mail). */

/* Verificar token de Cloudflare Turnstile contra su API. */
async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY!
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    })
    const data = await r.json() as { success: boolean }
    return data.success
  } catch {
    console.error('[contact] Turnstile verification failed')
    return false
  }
}

export async function POST(req: Request) {
  let body: { name?: string; email?: string; country?: string; subject?: string; message?: string; turnstileToken?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name = (body.name || '').trim()
  const email = (body.email || '').trim()
  const country = (body.country || '').trim()
  const subject = (body.subject || '').trim()
  const message = (body.message || '').trim()
  const turnstileToken = (body.turnstileToken || '').trim()

  // Validaciones
  if (!name) {
    return NextResponse.json({ error: 'Name is required.', field: 'name' }, { status: 400 })
  }
  if (name.length > 100) {
    return NextResponse.json({ error: 'Name must be 100 characters or less.', field: 'name' }, { status: 400 })
  }
  if (!email) {
    return NextResponse.json({ error: 'Email is required.', field: 'email' }, { status: 400 })
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Please provide a valid email address.', field: 'email' }, { status: 400 })
  }
  if (!country) {
    return NextResponse.json({ error: 'Country is required.', field: 'country' }, { status: 400 })
  }
  if (country.length > 100) {
    return NextResponse.json({ error: 'Country must be 100 characters or less.', field: 'country' }, { status: 400 })
  }
  if (subject.length > 255) {
    return NextResponse.json({ error: 'Subject is too long (max 255 characters).', field: 'subject' }, { status: 400 })
  }
  if (!message) {
    return NextResponse.json({ error: 'Message is required.', field: 'message' }, { status: 400 })
  }
  if (message.length > 5000) {
    return NextResponse.json({ error: 'Message must be 5000 characters or less.', field: 'message' }, { status: 400 })
  }

  const ip = getClientIp(req)

  /* Captcha. En producción se exige sí o sí: si falta TURNSTILE_SECRET_KEY se
     rechaza en vez de dejar el formulario abierto en silencio. Fuera de
     producción, sin secreto configurado, se saltea para poder probar en local. */
  const isProduction = process.env.NODE_ENV === 'production'
  const hasTurnstileSecret = !!process.env.TURNSTILE_SECRET_KEY

  if (isProduction && !hasTurnstileSecret) {
    console.error('[contact] TURNSTILE_SECRET_KEY missing in production — rejecting submission')
    return NextResponse.json({ error: 'The contact form is temporarily unavailable.' }, { status: 503 })
  }

  if (hasTurnstileSecret) {
    if (!turnstileToken) {
      return NextResponse.json({ error: 'Please complete the captcha.' }, { status: 400 })
    }
    if (!await verifyTurnstile(turnstileToken, ip)) {
      return NextResponse.json({ error: 'Captcha verification failed. Please try again.' }, { status: 400 })
    }
  }

  // Rate limiting: tope por IP + techo global que no depende de la IP
  if (hasDb) {
    await ensureDb()
    const verdict = await checkContactRateLimit(getPool()!, ip)
    if (verdict.limited) {
      if (verdict.scope === 'global') {
        console.warn('[contact] techo global por hora alcanzado — posible flood')
      }
      return NextResponse.json(
        { error: 'Too many messages. Please try again later.' },
        { status: 429 },
      )
    }
  }

  // Guardar en DB
  let messageId: number | null = null
  if (hasDb) {
    const { rows } = await getPool()!.query(
      `INSERT INTO contact_messages (sender_name, sender_email, country, subject, message, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [name, email, country, subject, message, ip],
    )
    messageId = rows[0].id
  }

  /* Notificación por mail. El mensaje ya está persistido, así que un fallo acá
     no rompe la respuesta al visitante — pero SÍ se registra en la fila para
     que el panel lo marque y ofrezca reenviar. */
  const mail = buildContactNotification({ name, email, country, subject, message, ip })
  const result = await sendMail({ to: await getNotificationEmails(), ...mail })

  if (!result.sent) console.error('[contact] notification not sent:', result.reason)

  if (messageId !== null) {
    await getPool()!.query(
      `UPDATE contact_messages SET email_sent = $1, email_error = $2 WHERE id = $3`,
      [result.sent, result.sent ? null : result.reason, messageId],
    ).catch((err) => console.error('[contact] could not record delivery status:', err))
  }

  return NextResponse.json({ success: true })
}

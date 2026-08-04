import { NextResponse } from 'next/server'
import { getPool, hasDb, ensureDb } from '@/lib/db'
import { getClientIp, checkContactRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* POST /api/contact — recibe un mensaje de contacto del formulario público.
   Valida campos, verifica captcha Turnstile, aplica rate limiting por IP,
   guarda el mensaje en DB y lo envía por email vía Resend. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/* El asunto va como cabecera del mail: un \r\n permite inyectar cabeceras
   propias (Bcc, Reply-To). Se colapsa cualquier salto de línea. */
function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

/* Verificar token de Cloudflare Turnstile contra su API. */
async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true // sin configurar → captcha deshabilitado
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

/* Obtener email(s) destino desde la configuración de redes sociales del admin
   (social.email en cms_data). Soporta dos emails separados por coma. */
async function getDestinationEmails(): Promise<string[]> {
  if (!hasDb) return []
  const pool = getPool()!
  const { rows } = await pool.query(
    "SELECT value FROM cms_data WHERE key = 'social.email'",
  )
  const val = (rows[0]?.value || '').trim()
  if (!val) return []
  // Soporta "email1, email2" separados por coma
  return val
    .split(',')
    .map((e: string) => e.trim())
    .filter((e: string) => EMAIL_RE.test(e))
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
  if (!EMAIL_RE.test(email) || email.length > 255) {
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

  // Captcha
  if (process.env.TURNSTILE_SECRET_KEY) {
    if (!turnstileToken) {
      return NextResponse.json({ error: 'Please complete the captcha.' }, { status: 400 })
    }
    const ok = await verifyTurnstile(turnstileToken, ip)
    if (!ok) {
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
  if (hasDb) {
    const pool = getPool()!
    await pool.query(
      `INSERT INTO contact_messages (sender_name, sender_email, country, subject, message, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [name, email, country, subject, message, ip],
    )
  }

  // Enviar email vía Resend — SOLO en producción.
  // En desarrollo/local los mensajes se guardan en DB pero no se envían.
  const isProduction = process.env.NODE_ENV === 'production'
  const resendKey = process.env.RESEND_API_KEY
  const destEmails = await getDestinationEmails()

  if (isProduction && resendKey && destEmails.length > 0) {
    try {
      const { Resend } = await import('resend')
      const resend = new Resend(resendKey)
      // FROM: dirección verificada en Resend (dominio propio), o fallback
      const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
      await resend.emails.send({
        from: `luciamontana.art <${fromEmail}>`,
        to: destEmails,
        subject: sanitizeHeader(subject || `New message from ${name}`),
        replyTo: email,
        html: `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #8b5cf6; margin-bottom: 4px;">new email</h2>
            <hr style="border: none; border-top: 2px solid #8b5cf6; margin: 12px 0 24px;">
            <p><strong>Name:</strong> ${escapeHtml(name)}</p>
            <p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
            <p><strong>Country:</strong> ${escapeHtml(country)}</p>
            ${subject ? `<p><strong>Subject:</strong> ${escapeHtml(subject)}</p>` : ''}
            <h3 style="color: #64748b; margin-top: 24px;">Message:</h3>
            <div style="background: #f8fafc; border-left: 3px solid #8b5cf6; padding: 16px; border-radius: 4px; white-space: pre-wrap;">${escapeHtml(message)}</div>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">Sent from the portfolio contact form • IP: ${ip}</p>
          </div>
        `,
      })
    } catch (err) {
      console.error('[contact] Resend error:', err)
      // El mensaje ya se guardó en DB — no falla la respuesta por un error de email
    }
  } else if (!isProduction && resendKey) {
    console.log('[contact] Email skipped (development mode). Message saved to DB.')
  }

  return NextResponse.json({ success: true })
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

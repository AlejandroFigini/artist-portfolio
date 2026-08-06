import 'server-only'

/* Capa única de correo saliente. Todo email que sale del sitio pasa por acá:
   destinatarios, remitente, layout HTML y envío vía Resend. Las rutas no
   instancian Resend ni arman el wrapper del HTML por su cuenta.

   Env:
   - RESEND_API_KEY     credencial de Resend. Sin ella no se envía nada.
   - RESEND_FROM_EMAIL  remitente; DEBE ser de un dominio verificado en Resend.
                        Sin él no se envía: el viejo fallback onboarding@resend.dev
                        solo entrega al dueño de la cuenta, así que disfrazaba un
                        error de configuración como envío exitoso.
   - MAIL_FROM_NAME     nombre visible del remitente (default 'Portfolio').
   - MAIL_ENABLE_IN_DEV 'true' para enviar de verdad fuera de producción. */

import { getPool, hasDb } from '@/lib/db'

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(value: string): boolean {
  return value.length <= 255 && EMAIL_RE.test(value)
}

/* El asunto va como cabecera del mail: un \r\n permite inyectar cabeceras
   propias (Bcc, Reply-To). Se colapsa cualquier salto de línea. */
export function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/* Destinatarios de las notificaciones internas (mensajes del formulario,
   reporte semanal). `settings.notifyEmail` los separa del email PÚBLICO que se
   muestra en el sitio; si está vacío cae a `social.email`, que es como
   funcionaba antes. Ambas claves aceptan varios destinos separados por coma. */
export async function getNotificationEmails(): Promise<string[]> {
  if (!hasDb) return []
  const pool = getPool()!
  const { rows } = await pool.query(
    "SELECT key, value FROM cms_data WHERE key IN ('settings.notifyEmail', 'social.email')",
  )
  const byKey = new Map((rows as { key: string; value: string }[]).map((r) => [r.key, r.value]))
  const raw = (byKey.get('settings.notifyEmail') || '').trim() || (byKey.get('social.email') || '').trim()
  if (!raw) return []
  return raw
    .split(',')
    .map((e) => e.trim())
    .filter(isValidEmail)
}

// ----- Envío ------------------------------------------------------------------

/* `code` separa "nunca se intentó" (falta configuración, o estamos en dev) de
   "se intentó y el proveedor lo rechazó". El cron lo usa para decidir si el
   fallo merece un 500 que el monitor del cron marque como caído. */
export type SendResult =
  | { sent: true }
  | { sent: false; reason: string; code: 'not_configured' | 'disabled' | 'send_failed' }

type SendMailArgs = {
  to: string[]
  subject: string
  html: string
  text: string
  replyTo?: string
  fromName?: string
}

/* Nunca lanza: devuelve el motivo por el que no salió para que el llamador lo
   persista o lo muestre. Un fallo de correo no debe tumbar la request. */
export async function sendMail({ to, subject, html, text, replyTo, fromName }: SendMailArgs): Promise<SendResult> {
  if (to.length === 0) {
    return { sent: false, reason: 'No destination email configured', code: 'not_configured' }
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { sent: false, reason: 'RESEND_API_KEY is not configured', code: 'not_configured' }

  const from = process.env.RESEND_FROM_EMAIL
  if (!from) return { sent: false, reason: 'RESEND_FROM_EMAIL is not configured', code: 'not_configured' }

  if (process.env.NODE_ENV !== 'production' && process.env.MAIL_ENABLE_IN_DEV !== 'true') {
    return { sent: false, reason: 'Sending disabled outside production', code: 'disabled' }
  }

  try {
    const { Resend } = await import('resend')
    const name = fromName || process.env.MAIL_FROM_NAME || 'Portfolio'
    const { error } = await new Resend(apiKey).emails.send({
      from: `${sanitizeHeader(name)} <${from}>`,
      to,
      subject: sanitizeHeader(subject),
      html,
      text,
      ...(replyTo && isValidEmail(replyTo) ? { replyTo } : {}),
    })
    /* Resend no tira excepción ante un rechazo de la API: devuelve `error`.
       Sin esta rama, un dominio sin verificar se contaba como envío exitoso. */
    if (error) {
      return { sent: false, reason: error.message || 'Resend rejected the request', code: 'send_failed' }
    }
    return { sent: true }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Unknown mail error'
    return { sent: false, reason, code: 'send_failed' }
  }
}

// ----- Layout compartido ------------------------------------------------------

const ACCENT = '#8b5cf6'

/* Wrapper visual común a todos los mails del sitio. El estilo va inline porque
   los clientes de correo descartan <style> y hojas externas. */
export function emailLayout({ title, subtitle, body, footer }: {
  title: string
  subtitle?: string
  body: string
  footer?: string
}): string {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: ${ACCENT}; margin-bottom: 4px;">${escapeHtml(title)}</h2>
      ${subtitle ? `<p style="color: #64748b; font-size: 14px; margin-top: 0;">${escapeHtml(subtitle)}</p>` : ''}
      <hr style="border: none; border-top: 2px solid ${ACCENT}; margin: 16px 0 24px;">
      ${body}
      ${footer ? `<p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">${escapeHtml(footer)}</p>` : ''}
    </div>
  `
}

// ----- Notificación de mensaje de contacto ------------------------------------

export type ContactNotification = {
  name: string
  email: string
  country: string
  subject: string
  message: string
  ip: string
}

/* Compartido por POST /api/contact y el reenvío manual desde el panel, para que
   el admin reciba exactamente el mismo mail en los dos caminos. */
export function buildContactNotification(msg: ContactNotification): {
  subject: string
  html: string
  text: string
  replyTo: string
} {
  const body = `
    <p><strong>Name:</strong> ${escapeHtml(msg.name)}</p>
    <p><strong>Email:</strong> <a href="mailto:${escapeHtml(msg.email)}">${escapeHtml(msg.email)}</a></p>
    <p><strong>Country:</strong> ${escapeHtml(msg.country)}</p>
    ${msg.subject ? `<p><strong>Subject:</strong> ${escapeHtml(msg.subject)}</p>` : ''}
    <h3 style="color: #64748b; margin-top: 24px;">Message:</h3>
    <div style="background: #f8fafc; border-left: 3px solid ${ACCENT}; padding: 16px; border-radius: 4px; white-space: pre-wrap;">${escapeHtml(msg.message)}</div>
  `
  const text = [
    'New message from the portfolio contact form',
    '',
    `Name: ${msg.name}`,
    `Email: ${msg.email}`,
    `Country: ${msg.country}`,
    ...(msg.subject ? [`Subject: ${msg.subject}`] : []),
    '',
    'Message:',
    msg.message,
    '',
    `IP: ${msg.ip}`,
  ].join('\n')

  return {
    subject: msg.subject || `New message from ${msg.name}`,
    html: emailLayout({
      title: 'New message',
      body,
      footer: `Sent from the portfolio contact form • IP: ${msg.ip}`,
    }),
    text,
    replyTo: msg.email,
  }
}

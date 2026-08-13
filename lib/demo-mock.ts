import 'server-only'

/* Datos ficticios para el usuario demo. Un demo ve el panel como el owner pero
   TODO lo que "mira" (mensajes, usuarios, analítica) es inventado y nada toca la
   DB. Set fijo y determinista: mismas entradas en cada carga. Las fechas son
   literales ISO a propósito (sin Date.now, para que no cambien entre requests). */

export const DEMO_USERS = [
  { username: 'lucia', role: 'owner', isBlocked: false, sessionTtlMinutes: null, totpEnabled: true, lastLoginAt: '2026-08-11T13:42:00.000Z', createdAt: '2025-01-15T09:00:00.000Z' },
  { username: 'studio_manager', role: 'admin', isBlocked: false, sessionTtlMinutes: null, totpEnabled: false, lastLoginAt: '2026-08-09T18:05:00.000Z', createdAt: '2025-03-02T11:20:00.000Z' },
  { username: 'guest_demo', role: 'demo', isBlocked: false, sessionTtlMinutes: 60, totpEnabled: false, lastLoginAt: '2026-08-11T10:15:00.000Z', createdAt: '2025-06-10T16:45:00.000Z' },
  { username: 'former_intern', role: 'admin', isBlocked: true, sessionTtlMinutes: null, totpEnabled: false, lastLoginAt: '2026-05-21T08:30:00.000Z', createdAt: '2025-02-18T10:00:00.000Z' },
] as const

type DemoMessage = {
  id: number
  sender_name: string
  sender_email: string
  country: string | null
  subject: string
  message: string
  ip_address: string | null
  is_read: boolean
  is_starred: boolean
  is_trashed: boolean
  email_sent: boolean | null
  email_error: string | null
  created_at: string
}

export const DEMO_MESSAGES: DemoMessage[] = [
  { id: 9001, sender_name: 'Marco Bianchi', sender_email: 'marco.bianchi@studioluce.it', country: 'IT', subject: 'Character design commission', message: 'Hi Lucia, we loved your creature work. Would you be open to a paid commission for our upcoming animated short?', ip_address: '81.44.—.—', is_read: false, is_starred: true, is_trashed: false, email_sent: true, email_error: null, created_at: '2026-08-11T09:12:00.000Z' },
  { id: 9002, sender_name: 'Hannah Weber', sender_email: 'h.weber@pixelforge.de', country: 'DE', subject: 'Freelance availability Q4', message: 'Are you taking on freelance illustration work later this year? We have a game project that fits your style.', ip_address: '91.63.—.—', is_read: false, is_starred: false, is_trashed: false, email_sent: true, email_error: null, created_at: '2026-08-10T17:40:00.000Z' },
  { id: 9003, sender_name: 'Diego Fernández', sender_email: 'diego@animarte.mx', country: 'MX', subject: 'Portfolio feedback', message: 'Your 3D section is stunning. Small note: the reel took a moment to load on mobile. Great work overall!', ip_address: '187.190.—.—', is_read: true, is_starred: false, is_trashed: false, email_sent: true, email_error: null, created_at: '2026-08-08T12:05:00.000Z' },
  { id: 9004, sender_name: 'Aiko Tanaka', sender_email: 'aiko.tanaka@kumo.jp', country: 'JP', subject: 'Exhibition invitation', message: 'We would like to feature two of your illustrations in a group show this autumn. Details attached.', ip_address: '126.75.—.—', is_read: true, is_starred: true, is_trashed: false, email_sent: true, email_error: null, created_at: '2026-08-05T08:22:00.000Z' },
  { id: 9005, sender_name: 'Spam Bot', sender_email: 'noreply@cheap-seo-deals.biz', country: null, subject: 'Boost your ranking!!!', message: 'Buy 10000 backlinks now, limited offer...', ip_address: '45.12.—.—', is_read: true, is_starred: false, is_trashed: true, email_sent: false, email_error: 'Recipient rejected', created_at: '2026-08-03T03:11:00.000Z' },
]

export function demoMessagesResponse(params: { onlyUnread?: boolean; onlyStarred?: boolean; onlyTrashed?: boolean }) {
  const inbox = DEMO_MESSAGES.filter((m) => !m.is_trashed)
  let list = inbox
  if (params.onlyTrashed) list = DEMO_MESSAGES.filter((m) => m.is_trashed)
  else {
    if (params.onlyUnread) list = list.filter((m) => !m.is_read)
    if (params.onlyStarred) list = list.filter((m) => m.is_starred)
  }
  return {
    messages: list,
    total: list.length,
    unread: inbox.filter((m) => !m.is_read).length,
    counts: {
      inbox: inbox.length,
      starred: inbox.filter((m) => m.is_starred).length,
      trash: DEMO_MESSAGES.filter((m) => m.is_trashed).length,
    },
    page: 1,
    limit: 20,
  }
}

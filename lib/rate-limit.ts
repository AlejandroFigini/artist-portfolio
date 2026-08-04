import 'server-only'

/* Identificación del cliente y límites de envío del formulario público.

   El problema con `x-forwarded-for`: lo puede escribir el cliente. Los proxies
   NO lo reemplazan, lo APPENDEAN — cada uno agrega la IP del par del que
   recibió la conexión. Con la cadena `A, B, C`, la `A` es lo que mandó el
   cliente (puede ser mentira) y la última la escribió el proxy más cercano a
   nosotros, que es el único dato en el que podemos confiar.

   Por eso se lee de derecha a izquierda: con N proxies de confianza delante,
   la IP real del cliente está en la posición `length - N`. Tomar la primera
   (lo que se hacía antes) es tomar exactamente el valor que el atacante
   controla, así que rotarlo esquivaba el rate limit y además envenenaba la
   columna ip_address de la tabla.

   TRUSTED_PROXY_HOPS ajusta N si algún día se mete un proxy más (CDN delante
   de Railway, por ejemplo). Por defecto 1 = el edge de Railway. */

const DEFAULT_TRUSTED_HOPS = 1
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/
const IPV6 = /^[0-9a-f:]{2,45}$/i

function trustedHops(): number {
  const raw = Number.parseInt(process.env.TRUSTED_PROXY_HOPS || '', 10)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TRUSTED_HOPS
}

function isIp(value: string): boolean {
  if (IPV4.test(value)) return value.split('.').every((o) => Number(o) <= 255)
  return IPV6.test(value) && value.includes(':')
}

/** IP del cliente según la cadena de proxies de confianza. '0.0.0.0' si no se puede determinar. */
export function getClientIp(req: Request): string {
  const chain = (req.headers.get('x-forwarded-for') || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)

  if (chain.length) {
    // Con N hops, la IP escrita por el proxy más externo de confianza.
    const idx = Math.max(0, chain.length - trustedHops())
    const candidate = chain[idx]
    if (candidate && isIp(candidate)) return candidate
  }

  const real = (req.headers.get('x-real-ip') || '').trim()
  if (real && isIp(real)) return real

  return '0.0.0.0'
}

/* Dos topes complementarios sobre contact_messages:
   - por IP: frena al abusador individual
   - global: techo de seguridad que NO depende de la IP, así rotar el header
     (o usar muchas IPs reales) no deja el buzón sin defensa.
   El global se dimensiona muy por encima del tráfico legítimo de un
   portfolio, así que solo actúa ante un flood. */
export const MAX_PER_IP_PER_HOUR = 5
export const MAX_GLOBAL_PER_HOUR = 60

export type RateVerdict = { limited: false } | { limited: true; scope: 'ip' | 'global' }

type Queryable = { query: (sql: string, params?: unknown[]) => Promise<{ rows: { n: number }[] }> }

export async function checkContactRateLimit(pool: Queryable, ip: string): Promise<RateVerdict> {
  /* Una sola consulta para los dos conteos: son la misma ventana temporal y
     el índice (ip_address, created_at) sirve para ambos. */
  const { rows } = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE ip_address = $1)::int AS n,
       COUNT(*)::int AS total
     FROM contact_messages
     WHERE created_at > NOW() - INTERVAL '1 hour'`,
    [ip],
  )
  const row = rows[0] as unknown as { n: number; total: number }
  if ((row?.n ?? 0) >= MAX_PER_IP_PER_HOUR) return { limited: true, scope: 'ip' }
  if ((row?.total ?? 0) >= MAX_GLOBAL_PER_HOUR) return { limited: true, scope: 'global' }
  return { limited: false }
}

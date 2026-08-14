import { NextRequest, NextResponse } from 'next/server'

/* ================================================================
   proxy.ts — Next.js 16 "Proxy" (ex-middleware)
   Corre en el Node.js runtime ANTES de cada request matcheada.

   Responsabilidades:
   1. Security headers (CSP, HSTS, X-Frame-Options, etc.)
   2. Rate limiting en memoria (login/2FA = estricto, API general = laxo)
   3. Gate de /admin (requiere cookie `sid`)
   ================================================================ */

// --------------- Rate Limiter en memoria ---------------

type RateBucket = { count: number; resetAt: number }

// Map: "ip:path_group" → bucket
const rateBuckets = new Map<string, RateBucket>()

// Limpieza periódica cada 5 minutos para no acumular entradas viejas
let lastCleanup = Date.now()
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000

function cleanupBuckets() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return
  lastCleanup = now
  for (const [key, bucket] of rateBuckets) {
    if (now > bucket.resetAt) rateBuckets.delete(key)
  }
}

/**
 * Retorna true si la request excede el límite.
 * @param ip          IP del cliente
 * @param group       Grupo de rate limit (ej. "login", "api")
 * @param maxRequests Máximo de requests permitidas en el window
 * @param windowMs    Ventana de tiempo en milisegundos
 */
function isRateLimited(ip: string, group: string, maxRequests: number, windowMs: number): boolean {
  cleanupBuckets()
  const key = `${ip}:${group}`
  const now = Date.now()
  const bucket = rateBuckets.get(key)

  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs })
    return false
  }

  bucket.count++
  return bucket.count > maxRequests
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

// --------------- Security Headers ---------------

const SECURITY_HEADERS: Record<string, string> = {
  // Previene clickjacking: solo permite iframes del mismo origen
  'X-Frame-Options': 'SAMEORIGIN',
  // Previene MIME-type sniffing
  'X-Content-Type-Options': 'nosniff',
  // Referrer solo origin en cross-site, full en same-site
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Deshabilita APIs de browser innecesarias
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  // Protección XSS legacy (para navegadores viejos)
  'X-XSS-Protection': '1; mode=block',
}

function applySecurityHeaders(res: NextResponse): void {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(key, value)
  }

  // HSTS solo en producción (fuerza HTTPS por 1 año + subdominios)
  if (process.env.NODE_ENV === 'production') {
    res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }

  // CSP: permite recursos propios + CDNs usados (fonts, icons, analytics)
  // Nota: 'unsafe-inline' necesario para los estilos de las librerías CSS-in-JS
  // y el script de boot inlneado en layout.tsx.
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net",
    "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net",
    "img-src 'self' data: blob: https://res.cloudinary.com https://via.placeholder.com https://*.google-analytics.com https://www.googletagmanager.com",
    "media-src 'self' blob: https://res.cloudinary.com",
    "connect-src 'self' https://res.cloudinary.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com",
    "frame-src 'self' https://challenges.cloudflare.com",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
  res.headers.set('Content-Security-Policy', csp)
}

// --------------- Rate Limit Config ---------------

/* Login y 2FA: backstop GRUESO anti-flood por IP (protege incluso el costo de
   bcrypt ante un aluvión). NO es el lockout fino: ese vive en /api/login (mide
   por IP+username, verifica credenciales igual y un login correcto limpia el
   contador). El proxy corre ANTES del handler, así que no puede saber si el
   intento fue exitoso — por eso acá el tope es alto (no traba el uso normal:
   un login con 2FA son 2 requests, logout+login otro par...) y el trabajo fino
   lo hace el route. Con max=5 este backstop bloqueaba hasta los logins correctos. */
const AUTH_RATE_LIMIT  = { max: 30,  windowMs: 15 * 60 * 1000 }
// API general: máx 120 requests por IP por minuto
const API_RATE_LIMIT   = { max: 120, windowMs: 60 * 1000 }

// Rutas que reciben rate limiting estricto (autenticación)
const AUTH_PATHS = ['/api/login', '/api/account/2fa']

// --------------- Proxy (ex-middleware) ---------------

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const ip = getClientIp(req)

  // 1. Rate limiting estricto para rutas de autenticación (solo POST)
  if (req.method === 'POST' && AUTH_PATHS.some(p => pathname === p)) {
    if (isRateLimited(ip, 'auth', AUTH_RATE_LIMIT.max, AUTH_RATE_LIMIT.windowMs)) {
      const res = NextResponse.json(
        { success: false, error: 'Too many attempts. Please try again later.' },
        { status: 429 }
      )
      res.headers.set('Retry-After', '900') // 15 minutos
      applySecurityHeaders(res)
      return res
    }
  }

  // 2. Rate limiting general para todas las rutas API
  if (pathname.startsWith('/api/')) {
    if (isRateLimited(ip, 'api', API_RATE_LIMIT.max, API_RATE_LIMIT.windowMs)) {
      const res = NextResponse.json(
        { success: false, error: 'Too many requests. Please slow down.' },
        { status: 429 }
      )
      res.headers.set('Retry-After', '60')
      applySecurityHeaders(res)
      return res
    }
  }

  // 3. Gate de /admin: requiere la cookie de sesión httpOnly `sid`.
  //    Solo chequea presencia — la validación real la hacen los endpoints.
  if (pathname.startsWith('/admin')) {
    if (!req.cookies.get('sid')?.value) {
      const res = NextResponse.redirect(new URL('/', req.url))
      applySecurityHeaders(res)
      return res
    }
  }

  // 4. Continuar con security headers
  const res = NextResponse.next()
  applySecurityHeaders(res)
  return res
}

export const config = {
  matcher: [
    // Matchear todo excepto archivos estáticos y optimización de imágenes
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|uploads/).*)',
  ],
}

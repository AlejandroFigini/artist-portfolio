import { NextRequest, NextResponse } from 'next/server'

/* Gate de /admin: requiere la cookie de sesión que setea el login del
   CMS. Misma fuerza que el flag del prototipo legacy (conveniencia,
   no seguridad real — eso exige sesiones server-side, fuera del scope
   del backend actual). La página además re-verifica del lado cliente. */

export default function proxy(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/admin')) {
    if (req.cookies.get('cms_admin')?.value !== '1') {
      return NextResponse.redirect(new URL('/', req.url))
    }
  }
  return NextResponse.next()
}

export const config = { matcher: ['/admin/:path*', '/admin'] }

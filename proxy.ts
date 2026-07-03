import { NextRequest, NextResponse } from 'next/server'

/* Gate de /admin: requiere la cookie de sesión httpOnly `sid` que setea
   /api/login. El middleware (edge) solo chequea presencia — la validación
   real contra la tabla `sessions` la hacen los endpoints del server. */

export default function proxy(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/admin')) {
    if (!req.cookies.get('sid')?.value) {
      return NextResponse.redirect(new URL('/', req.url))
    }
  }
  return NextResponse.next()
}

export const config = { matcher: ['/admin/:path*', '/admin'] }

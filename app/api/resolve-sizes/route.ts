import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { requireSession } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* POST /api/resolve-sizes → { urls: string[] } → { results: { url: size } }
   Resuelve el peso de los medios para la biblioteca del admin.

   Solo dos orígenes son válidos y ambos están cerrados:
   - rutas propias bajo /public, resueltas y verificadas contra ese directorio
   - assets de Cloudinary (host fijo)
   Cualquier otra URL se descarta. Sin ese cerrojo el endpoint es un SSRF: el
   atacante elige a qué host pega el servidor y usa la respuesta para mapear
   la red interna. */

const PUBLIC_DIR = path.resolve(process.cwd(), 'public')
const ALLOWED_HOSTS = new Set(['res.cloudinary.com'])
const MAX_URLS = 150
const BATCH_SIZE = 10
const FETCH_TIMEOUT_MS = 5000

/* Ruta local: se resuelve y se comprueba que caiga DENTRO de public/.
   `path.resolve` normaliza los `..`, así que "/../.env" queda fuera del
   directorio y se rechaza, en vez de filtrar el tamaño de un archivo interno. */
async function localSize(url: string): Promise<number | null> {
  const clean = url.split('?')[0].split('#')[0]
  let decoded: string
  try { decoded = decodeURIComponent(clean) } catch { return null }
  const abs = path.resolve(PUBLIC_DIR, '.' + (decoded.startsWith('/') ? decoded : `/${decoded}`))
  if (abs !== PUBLIC_DIR && !abs.startsWith(PUBLIC_DIR + path.sep)) return null
  try {
    const stat = await fs.stat(abs)
    return stat.isFile() ? stat.size : null
  } catch { return null }
}

async function remoteSize(url: string): Promise<number | null> {
  let parsed: URL
  try { parsed = new URL(url) } catch { return null }
  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname)) return null
  try {
    const r = await fetch(parsed.href, { method: 'HEAD', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!r.ok) return null
    const cl = r.headers.get('content-length')
    return cl ? Number.parseInt(cl, 10) || null : null
  } catch { return null }
}

export async function POST(req: Request) {
  const auth = await requireSession(req)
  if ('deny' in auth) return auth.deny

  let body: { urls?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!Array.isArray(body.urls) || body.urls.length === 0) {
    return NextResponse.json({ error: 'An array of URLs is required' }, { status: 400 })
  }

  const urls = Array.from(
    new Set(body.urls.filter((u): u is string => typeof u === 'string' && u.length > 0)),
  ).slice(0, MAX_URLS)

  const results: Record<string, number> = {}
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    await Promise.all(
      urls.slice(i, i + BATCH_SIZE).map(async (url) => {
        const size = url.startsWith('/') ? await localSize(url) : await remoteSize(url)
        if (size !== null) results[url] = size
      }),
    )
  }

  return NextResponse.json({ results })
}

import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { requireSession } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/resolve-sizes
// Recibe: { urls: string[] }
// Devuelve: { results: Record<string, number> } (mapa de URL a size)
export async function POST(req: Request) {
  // const auth = await requireSession(req)
  // if ('deny' in auth) return auth.deny

  let body: { urls?: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { urls } = body

  if (!Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json({ error: 'An array of URLs is required' }, { status: 400 })
  }

  // Limitar a 150 URLs por request
  const uniqueUrls = Array.from(new Set(urls.filter((u): u is string => typeof u === 'string' && u.length > 0))).slice(0, 150)

  const results: Record<string, number> = {}

  // Procesar en lotes de 10 para no saturar conexiones
  const BATCH_SIZE = 10
  for (let i = 0; i < uniqueUrls.length; i += BATCH_SIZE) {
    const batch = uniqueUrls.slice(i, i + BATCH_SIZE)
    await Promise.all(batch.map(async (url) => {
      try {
        if (url.startsWith('/')) {
          const localPath = path.join(process.cwd(), 'public', url.split('?')[0].split('#')[0])
          if (fs.existsSync(localPath)) {
            const stat = fs.statSync(localPath)
            results[url] = stat.size
            return
          }
          const fullUrl = new URL(url, req.url).href
          const r = await fetch(fullUrl, { method: 'HEAD' })
          if (r.ok) {
            const cl = r.headers.get('content-length')
            if (cl) results[url] = parseInt(cl, 10)
          }
        } else {
          const r = await fetch(url, { method: 'HEAD' })
          if (r.ok) {
            const cl = r.headers.get('content-length')
            if (cl) results[url] = parseInt(cl, 10)
          }
        }
      } catch (err) {
        // Ignorar errores individuales
      }
    }))
  }

  return NextResponse.json({ results })
}

import { NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { getPool, hasDb, ensureDb } from '@/lib/db'
import { SETTINGS_KEYS } from '@/lib/settings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* GET /api/cv → sirve el CV como descarga real con el NOMBRE correcto.
   El CV puede estar guardado como URL de Cloudinary, ruta local (/uploads) o
   data URL (según entorno/historial). En todos los casos se entrega el binario
   con Content-Disposition + el nombre real (settings.cvName), de modo que la
   descarga NO hereda el nombre interno del asset (era "settings.*") ni depende
   de cómo el navegador maneja un data: URL / un redirect. */
export async function GET() {
  if (!hasDb) return new NextResponse('Not found', { status: 404 })
  try {
    await ensureDb()
    const pool = getPool()!
    const { rows } = await pool.query(
      'SELECT key, value FROM cms_data WHERE key = ANY($1)',
      [[SETTINGS_KEYS.cvUrl, SETTINGS_KEYS.cvName]],
    )
    const byKey: Record<string, string> = {}
    for (const r of rows as { key: string; value: string }[]) byKey[r.key] = r.value
    const src = byKey[SETTINGS_KEYS.cvUrl] || ''
    if (!src) return new NextResponse('Not found', { status: 404 })

    // Nombre saneado (sin saltos ni comillas que rompan el header).
    const filename = (byKey[SETTINGS_KEYS.cvName] || 'CV.pdf').replace(/[\r\n"\\]/g, '').trim() || 'CV.pdf'

    let buf: Buffer
    let mime = 'application/pdf'

    if (src.startsWith('data:')) {
      const comma = src.indexOf(',')
      const meta = src.slice(5, comma)
      mime = meta.split(';')[0] || 'application/pdf'
      buf = /;base64/i.test(meta)
        ? Buffer.from(src.slice(comma + 1), 'base64')
        : Buffer.from(decodeURIComponent(src.slice(comma + 1)), 'utf-8')
    } else if (/^https?:\/\//i.test(src)) {
      // Cloudinary u otra URL absoluta: se trae del servidor y se re-emite con
      // el nombre correcto (el redirect perdía el Content-Disposition).
      const upstream = await fetch(src, { cache: 'no-store' })
      if (!upstream.ok) return new NextResponse('Not found', { status: 404 })
      mime = upstream.headers.get('content-type') || 'application/pdf'
      buf = Buffer.from(await upstream.arrayBuffer())
    } else if (src.startsWith('/uploads/')) {
      // Guardado local (dev sin Cloudinary): se lee del filesystem.
      const abs = path.join(process.cwd(), 'public', src.replace(/^\//, ''))
      buf = await readFile(abs)
    } else {
      return new NextResponse('Not found', { status: 404 })
    }

    // Buffer → Uint8Array: BodyInit no acepta Buffer en el tipado de esta versión.
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buf.length),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[cv GET] error:', err)
    return new NextResponse('Internal error', { status: 500 })
  }
}

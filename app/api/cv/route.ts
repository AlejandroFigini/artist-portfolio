import { NextResponse } from 'next/server'
import { getPool, hasDb, ensureDb } from '@/lib/db'
import { SETTINGS_KEYS } from '@/lib/settings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* GET /api/cv → sirve el CV como descarga real.
   El CV se guarda como data URL (base64) en cms_data. Servirlo por un endcoint
   con Content-Disposition evita los problemas de descargar un `data:` URL desde
   un <a download target="_blank"> (el navegador lo abría/renombraba mal) y saca
   el PDF entero del HTML de cada página. */
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
    const dataUrl = byKey[SETTINGS_KEYS.cvUrl] || ''

    if (!dataUrl) return new NextResponse('Not found', { status: 404 })

    // Si por alguna razón fuera una URL normal (no data:), se redirige a ella.
    if (!dataUrl.startsWith('data:')) return NextResponse.redirect(dataUrl)

    const comma = dataUrl.indexOf(',')
    const meta = dataUrl.slice(5, comma) // p.ej. "application/pdf;base64"
    const mime = meta.split(';')[0] || 'application/pdf'
    const isBase64 = /;base64/i.test(meta)
    const payload = dataUrl.slice(comma + 1)
    const buf = isBase64 ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload), 'utf-8')

    // Nombre saneado (sin saltos ni comillas que rompan el header).
    const rawName = (byKey[SETTINGS_KEYS.cvName] || 'CV.pdf').replace(/[\r\n"\\]/g, '').trim() || 'CV.pdf'

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Content-Disposition': `attachment; filename="${rawName}"`,
        'Content-Length': String(buf.length),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[cv GET] error:', err)
    return new NextResponse('Internal error', { status: 500 })
  }
}

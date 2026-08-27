import { NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { getPool, hasDb, ensureDb } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { deleteAsset } from '@/lib/storage'
import { SETTINGS_KEYS } from '@/lib/settings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* El CV vive en la DB (tabla `cms_files`, fila `cv`), NO en el repositorio de
   media. Antes se subía como un asset más de Cloudinary y eso traía dos
   problemas: contaminaba el inventario —contaba como archivo y sumaba MB, así
   que "Repositorio" nunca coincidía con Cloudinary— y al reemplazarlo el PDF
   anterior quedaba huérfano ahí para siempre (de ahí los dos CV que aparecían
   en la cuenta).

   `settings.cvUrl` guarda el centinela `/api/cv` cuando el archivo está en la
   DB. Los valores viejos (URL de Cloudinary, /uploads/…, data URL) se siguen
   sirviendo para no romper un sitio que todavía no reemplazó su CV, y el
   primer reemplazo los limpia. */

const CV_KEY = 'cv'
const CV_ROUTE = '/api/cv'
const CV_MAX_BYTES = 10 * 1024 * 1024
const PDF_MAGIC = '%PDF-'

/** Nombre saneado: sin saltos ni comillas que rompan el header. */
const safeName = (raw: string): string =>
  raw.replace(/[\r\n"\\]/g, '').trim() || 'CV.pdf'

async function readSettings(keys: string[]): Promise<Record<string, string>> {
  const { rows } = await getPool()!.query(
    'SELECT key, value FROM cms_data WHERE key = ANY($1)',
    [keys],
  )
  const byKey: Record<string, string> = {}
  for (const r of rows as { key: string; value: string }[]) byKey[r.key] = r.value
  return byKey
}

async function writeSettings(entries: Record<string, string>): Promise<void> {
  const pool = getPool()!
  for (const [key, value] of Object.entries(entries)) {
    if (value === '') {
      await pool.query('DELETE FROM cms_data WHERE key = $1', [key])
      continue
    }
    await pool.query(
      `INSERT INTO cms_data (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
      [key, value],
    )
  }
}

/* Limpieza del CV anterior. Solo toca lo que ES un asset externo: un centinela
   o una data URL no dejan nada atrás. Best-effort: si Cloudinary rechaza el
   borrado no se aborta la subida — el CV nuevo ya está guardado y bloquearla
   dejaría al admin sin CV. */
async function dropPreviousAsset(prevUrl: string): Promise<void> {
  if (!prevUrl || prevUrl === CV_ROUTE) return
  if (!/^https?:\/\//i.test(prevUrl) && !prevUrl.startsWith('/uploads/')) return
  try {
    await deleteAsset(prevUrl)
  } catch (err) {
    console.error('[cv] no se pudo borrar el CV anterior:', err)
  }
}

/* GET /api/cv → sirve el CV como descarga real con el NOMBRE correcto
   (`settings.cvName`), de modo que no herede el nombre interno del asset ni
   dependa de cómo el navegador maneje un data: URL o un redirect. */
export async function GET() {
  if (!hasDb) return new NextResponse('Not found', { status: 404 })
  try {
    await ensureDb()
    const byKey = await readSettings([SETTINGS_KEYS.cvUrl, SETTINGS_KEYS.cvName])
    const src = byKey[SETTINGS_KEYS.cvUrl] || ''
    if (!src) return new NextResponse('Not found', { status: 404 })

    const filename = safeName(byKey[SETTINGS_KEYS.cvName] || 'CV.pdf')

    let buf: Buffer
    let mime = 'application/pdf'

    if (src === CV_ROUTE) {
      // Guardado en la DB: el camino normal desde que el CV dejó Cloudinary.
      const { rows } = await getPool()!.query(
        'SELECT name, mime, data FROM cms_files WHERE key = $1',
        [CV_KEY],
      )
      if (!rows.length) return new NextResponse('Not found', { status: 404 })
      const row = rows[0] as { name: string; mime: string; data: Buffer }
      mime = row.mime || mime
      buf = row.data
    } else if (src.startsWith('data:')) {
      const comma = src.indexOf(',')
      const meta = src.slice(5, comma)
      mime = meta.split(';')[0] || 'application/pdf'
      buf = /;base64/i.test(meta)
        ? Buffer.from(src.slice(comma + 1), 'base64')
        : Buffer.from(decodeURIComponent(src.slice(comma + 1)), 'utf-8')
    } else if (/^https?:\/\//i.test(src)) {
      // Legado (CV todavía en Cloudinary): se trae del servidor y se re-emite
      // con el nombre correcto — el redirect perdía el Content-Disposition.
      const upstream = await fetch(src, { cache: 'no-store' })
      if (!upstream.ok) return new NextResponse('Not found', { status: 404 })
      mime = upstream.headers.get('content-type') || 'application/pdf'
      buf = Buffer.from(await upstream.arrayBuffer())
    } else if (src.startsWith('/uploads/')) {
      // Legado local (dev sin Cloudinary): se lee del filesystem.
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

/* POST /api/cv → reemplaza el CV. Multipart con el PDF; guarda el binario en
   `cms_files` y deja `settings.cvUrl` apuntando a esta misma ruta. */
export async function POST(req: Request) {
  const auth = await requireRole(req, ['owner', 'admin', 'demo'])
  if ('deny' in auth) return auth.deny
  if (auth.user.role === 'demo') {
    return NextResponse.json({ success: true, url: CV_ROUTE, name: 'CV.pdf', demo: true })
  }
  if (!hasDb) return NextResponse.json({ error: 'No database configured' }, { status: 503 })

  let form: FormData
  try { form = await req.formData() } catch { return NextResponse.json({ error: 'Invalid form data' }, { status: 400 }) }

  const file = form.get('file')
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'Missing file' }, { status: 400 })
  if (file.size === 0) return NextResponse.json({ error: 'Empty file' }, { status: 400 })
  if (file.size > CV_MAX_BYTES) {
    return NextResponse.json({ error: 'PDF exceeds the 10 MB limit.' }, { status: 413 })
  }

  const buf = Buffer.from(await file.arrayBuffer())
  /* Firma real del archivo. El `type` del Blob lo declara el cliente y no
     prueba nada: acá se sirve de vuelta a los visitantes. */
  if (buf.subarray(0, PDF_MAGIC.length).toString('latin1') !== PDF_MAGIC) {
    return NextResponse.json({ error: 'CV must be a PDF file.' }, { status: 400 })
  }

  const rawName = typeof form.get('name') === 'string' ? String(form.get('name')) : (file as File).name
  const name = safeName(rawName || 'CV.pdf')

  try {
    await ensureDb()
    const prev = await readSettings([SETTINGS_KEYS.cvUrl])
    await getPool()!.query(
      `INSERT INTO cms_files (key, name, mime, bytes, data, updated_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE SET
         name = EXCLUDED.name, mime = EXCLUDED.mime, bytes = EXCLUDED.bytes,
         data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`,
      [CV_KEY, name, 'application/pdf', buf.length, buf],
    )
    await writeSettings({ [SETTINGS_KEYS.cvUrl]: CV_ROUTE, [SETTINGS_KEYS.cvName]: name })
    // Recién con el nuevo ya guardado: si esto falla, el CV sigue sirviéndose.
    await dropPreviousAsset(prev[SETTINGS_KEYS.cvUrl] || '')
    return NextResponse.json({ success: true, url: CV_ROUTE, name, bytes: buf.length })
  } catch (err) {
    console.error('[cv POST] error:', err)
    return NextResponse.json({ error: 'Failed to save CV' }, { status: 500 })
  }
}

/* DELETE /api/cv → quita el CV del sitio y borra sus bytes. */
export async function DELETE(req: Request) {
  const auth = await requireRole(req, ['owner', 'admin', 'demo'])
  if ('deny' in auth) return auth.deny
  if (auth.user.role === 'demo') return NextResponse.json({ success: true, demo: true })
  if (!hasDb) return NextResponse.json({ error: 'No database configured' }, { status: 503 })

  try {
    await ensureDb()
    const prev = await readSettings([SETTINGS_KEYS.cvUrl])
    await getPool()!.query('DELETE FROM cms_files WHERE key = $1', [CV_KEY])
    await writeSettings({ [SETTINGS_KEYS.cvUrl]: '', [SETTINGS_KEYS.cvName]: '' })
    await dropPreviousAsset(prev[SETTINGS_KEYS.cvUrl] || '')
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[cv DELETE] error:', err)
    return NextResponse.json({ error: 'Failed to remove CV' }, { status: 500 })
  }
}

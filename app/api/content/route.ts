import { NextResponse } from 'next/server'
import { getPool, hasDb, ensureDb } from '@/lib/db'
import { uploadDataUrl, UnsupportedMediaError } from '@/lib/storage'
import { requireRole } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* GET /api/content → { version, items }
   Devuelve todo el estado del CMS (key → value). Sin DB → mock vacío (el front
   usa localStorage). Si la DB falla, degrada en vez de romper el sitio. */
export async function GET() {
  if (!hasDb) return NextResponse.json({ version: 1, items: {} })
  try {
    await ensureDb()
    const pool = getPool()!
    const result = await pool.query('SELECT key, value FROM cms_data')
    const items: Record<string, string> = {}
    for (const row of result.rows as { key: string; value: string }[]) items[row.key] = row.value
    return NextResponse.json({ version: 1, items })
  } catch (err) {
    console.error('[content GET] error:', err)
    return NextResponse.json({ version: 1, items: {} })
  }
}

/* POST /api/content → upsert de items.
   Si algún value es una data URL (base64), se sube al storage (Cloudinary en
   prod, filesystem local en dev) y se guarda la URL resultante, no el base64. */
export async function POST(req: Request) {
  const auth = await requireRole(req, ['owner', 'admin', 'demo'])
  if ('deny' in auth) return auth.deny

  if (auth.user.role === 'demo') {
    return NextResponse.json({ success: true, message: 'Content saved successfully (Demo Mode)' })
  }

  let body: { items?: Record<string, unknown> }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const items = body.items
  if (!items || typeof items !== 'object') {
    return NextResponse.json({ error: 'Invalid format. Expected an items object.' }, { status: 400 })
  }

  if (!hasDb) return NextResponse.json({ success: true, message: 'Content saved (mock, no DB)' })

  await ensureDb()

  const entries = Object.entries(items)
  const deleteKeys = entries
    .filter(([, v]) => v === '' || v === null || v === undefined)
    .map(([k]) => k)
  const setEntries = entries.filter(([, v]) => !(v === '' || v === null || v === undefined))

  /* Las subidas van ANTES de abrir la transacción. Estaban adentro: una tanda
     de imágenes mantenía una conexión del pool (max 5) y una transacción
     abierta durante todo el ida y vuelta con Cloudinary. */
  const KIND_BY_PREFIX = [
    ['data:image', 'image'],
    ['data:video', 'video'],
    ['data:application/pdf', 'raw'],
  ] as const

  let resolved: [string, string][]
  try {
    resolved = await Promise.all(
      setEntries.map(async ([key, value]): Promise<[string, string]> => {
        if (typeof value !== 'string') return [key, String(value)]
        const match = KIND_BY_PREFIX.find(([prefix]) => value.startsWith(prefix))
        if (!match) return [key, value]
        return [key, (await uploadDataUrl(value, match[1], 'used', key)).url]
      }),
    )
  } catch (err) {
    if (err instanceof UnsupportedMediaError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[content POST] upload error:', err)
    return NextResponse.json({ error: 'Error uploading media' }, { status: 500 })
  }

  const pool = getPool()!
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    /* Dos sentencias en lote en vez de una por clave: guardar la portada
       entera eran decenas de round-trips secuenciales. */
    if (deleteKeys.length) {
      await client.query('DELETE FROM cms_data WHERE key = ANY($1::varchar[])', [deleteKeys])
    }
    if (resolved.length) {
      await client.query(
        `INSERT INTO cms_data (key, value)
         SELECT * FROM UNNEST($1::varchar[], $2::text[])
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
        [resolved.map(([k]) => k), resolved.map(([, v]) => v)],
      )
    }
    await client.query('COMMIT')
    return NextResponse.json({ success: true, message: 'Content saved successfully' })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[content POST] error:', err)
    return NextResponse.json({ error: 'Error saving content' }, { status: 500 })
  } finally {
    client.release()
  }
}

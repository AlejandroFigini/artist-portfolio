import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { getPool, hasDb, ensureDb } from '@/lib/db'
import { BASE_LANG, TARGET_LANGS, ALL_LANGS, isTranslatableEntry, type Lang } from '@/lib/i18n'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type LangMaps = Record<Lang, Record<string, string>>

function emptyMaps(): LangMaps {
  return { es: {}, en: {}, pt: {}, fr: {} }
}

/* GET /api/translations → { base, langs, items: { en, es, pt, fr } }
   - en: texto base vivo desde cms_data, filtrado a prosa (no media/URLs).
   - es/pt/fr: traducciones desde cms_translations.
   Lo usa el cliente para aplicar el idioma y el admin para exportar a Claude.
   Sin DB → maps vacíos (el front degrada). */
export async function GET() {
  const empty = { base: BASE_LANG, langs: ALL_LANGS, items: emptyMaps() }
  if (!hasDb) return NextResponse.json(empty)
  try {
    await ensureDb()
    const pool = getPool()!
    const items = emptyMaps()
    
    // Consultas en paralelo a Postgres
    const [baseRes, trRes] = await Promise.all([
      pool.query('SELECT key, value FROM cms_data'),
      pool.query('SELECT key, lang, value FROM cms_translations'),
    ])

    for (const row of baseRes.rows as { key: string; value: string }[]) {
      if (isTranslatableEntry(row.key, row.value)) items[BASE_LANG][row.key] = row.value
    }
    for (const row of trRes.rows as { key: string; lang: string; value: string }[]) {
      if (items[row.lang as Lang]) items[row.lang as Lang][row.key] = row.value
    }

    const res = NextResponse.json({ base: BASE_LANG, langs: ALL_LANGS, items })
    res.headers.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
    return res
  } catch (err) {
    console.error('[translations GET] error:', err)
    return NextResponse.json(empty)
  }
}

/* Límites del import — el JSON viene de pegar la respuesta de un modelo, así
   que se valida como cualquier otro input no confiable. */
const MAX_KEY_LEN = 200
const MAX_VALUE_LEN = 20_000
const MAX_ROWS = 20_000
/* Las claves CMS son `seccion.parte#0::campo`; nada más entra a la tabla. */
const KEY_RE = /^[A-Za-z0-9_.#:-]+$/

/* POST /api/translations → importar traducciones.
   Body: { items: { es: {key:val}, pt: {...}, fr: {...} } } (en se ignora: es base).
   Valida y upsertea cada (key, lang, value) en cms_translations. */
export async function POST(req: Request) {
  const auth = await requireSession(req)
  if ('deny' in auth) return auth.deny

  let body: { items?: Record<string, Record<string, unknown>> }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const incoming = body.items
  if (!incoming || typeof incoming !== 'object') {
    return NextResponse.json(
      { error: `Invalid format. Expected { items: { ${TARGET_LANGS.join(', ')} } }.` },
      { status: 400 },
    )
  }

  // Recolectar filas válidas solo para los idiomas destino; todo lo demás
  // (idiomas desconocidos, claves raras, valores no-string) se descarta y se
  // reporta como `skipped` en vez de romper la importación entera.
  const rows: { key: string; lang: string; value: string }[] = []
  let skipped = 0
  for (const lang of TARGET_LANGS) {
    const map = incoming[lang]
    if (!map || typeof map !== 'object') continue
    for (const [key, value] of Object.entries(map)) {
      if (rows.length >= MAX_ROWS) { skipped++; continue }
      if (!key || key.length > MAX_KEY_LEN || !KEY_RE.test(key)) { skipped++; continue }
      if (typeof value !== 'string' || !value.trim() || value.length > MAX_VALUE_LEN) { skipped++; continue }
      rows.push({ key, lang, value })
    }
  }
  if (rows.length === 0) {
    return NextResponse.json(
      { error: `No valid translations found for ${TARGET_LANGS.join(', ')}.`, skipped },
      { status: 400 },
    )
  }

  if (!hasDb) return NextResponse.json({ success: true, imported: rows.length, skipped, message: 'Translations received (mock, no DB)' })

  await ensureDb()
  const pool = getPool()!
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const r of rows) {
      await client.query(
        `INSERT INTO cms_translations (key, lang, value) VALUES ($1, $2, $3)
         ON CONFLICT (key, lang) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
        [r.key, r.lang, r.value],
      )
    }
    await client.query('COMMIT')
    return NextResponse.json({ success: true, imported: rows.length, skipped })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[translations POST] error:', err)
    return NextResponse.json({ error: 'Error saving translations' }, { status: 500 })
  } finally {
    client.release()
  }
}

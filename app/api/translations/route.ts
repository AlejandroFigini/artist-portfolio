import { NextResponse } from 'next/server'
import { getPool, hasDb, ensureDb } from '@/lib/db'
import { BASE_LANG, TARGET_LANGS, ALL_LANGS, isTranslatableEntry, type Lang } from '@/lib/i18n'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type LangMaps = Record<Lang, Record<string, string>>

function emptyMaps(): LangMaps {
  return { es: {}, en: {}, pt: {}, fr: {} }
}

/* GET /api/translations → { base, langs, items: { es, en, pt, fr } }
   - es: texto base vivo desde cms_data, filtrado a prosa (no media/URLs).
   - en/pt/fr: traducciones desde cms_translations.
   Lo usa el cliente para aplicar el idioma y el admin para exportar a Claude.
   Sin DB → maps vacíos (el front degrada). */
export async function GET() {
  const empty = { base: BASE_LANG, langs: ALL_LANGS, items: emptyMaps() }
  if (!hasDb) return NextResponse.json(empty)
  try {
    await ensureDb()
    const pool = getPool()!
    const items = emptyMaps()
    const base = await pool.query('SELECT key, value FROM cms_data')
    for (const row of base.rows as { key: string; value: string }[]) {
      if (isTranslatableEntry(row.key, row.value)) items.es[row.key] = row.value
    }
    const tr = await pool.query('SELECT key, lang, value FROM cms_translations')
    for (const row of tr.rows as { key: string; lang: string; value: string }[]) {
      if (items[row.lang as Lang]) items[row.lang as Lang][row.key] = row.value
    }
    return NextResponse.json({ base: BASE_LANG, langs: ALL_LANGS, items })
  } catch (err) {
    console.error('[translations GET] error:', err)
    return NextResponse.json(empty)
  }
}

/* POST /api/translations → importar traducciones.
   Body: { items: { en: {key:val}, pt: {...}, fr: {...} } } (es se ignora: es base).
   Valida y upsertea cada (key, lang, value) en cms_translations. */
export async function POST(req: Request) {
  let body: { items?: Record<string, Record<string, unknown>> }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const incoming = body.items
  if (!incoming || typeof incoming !== 'object') {
    return NextResponse.json({ error: 'Formato inválido. Se esperaba { items: { en, pt, fr } }.' }, { status: 400 })
  }

  // Recolectar filas válidas solo para los idiomas destino (en/pt/fr).
  const rows: { key: string; lang: string; value: string }[] = []
  for (const lang of TARGET_LANGS) {
    const map = incoming[lang]
    if (!map || typeof map !== 'object') continue
    for (const [key, value] of Object.entries(map)) {
      if (typeof value !== 'string' || !value.trim()) continue
      rows.push({ key, lang, value })
    }
  }
  if (rows.length === 0) {
    return NextResponse.json({ error: 'No se encontraron traducciones válidas para en/pt/fr.' }, { status: 400 })
  }

  if (!hasDb) return NextResponse.json({ success: true, imported: rows.length, message: 'Traducciones recibidas (mock, sin DB)' })

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
    return NextResponse.json({ success: true, imported: rows.length })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[translations POST] error:', err)
    return NextResponse.json({ error: 'Error guardando traducciones' }, { status: 500 })
  } finally {
    client.release()
  }
}

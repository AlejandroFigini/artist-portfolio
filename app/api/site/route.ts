import { NextResponse } from 'next/server'
import { getPool, hasDb, ensureDb } from '@/lib/db'
import { SETTINGS_KEYS, EMPTY_SETTINGS } from '@/lib/settings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* GET /api/site → { loaderImage, loaderDuration, cvUrl, cvName }
   Lectura liviana de los ajustes globales (claves settings.* de cms_data) para
   aplicarlos en TODAS las páginas (loader, botón CV) sin cargar todo el CMS.
   Las escrituras reusan POST /api/content (son claves de contenido normales). */
export async function GET() {
  if (!hasDb) return NextResponse.json(EMPTY_SETTINGS)
  try {
    await ensureDb()
    const pool = getPool()!
    const keys = Object.values(SETTINGS_KEYS)
    const res = await pool.query('SELECT key, value FROM cms_data WHERE key = ANY($1)', [keys])
    const byKey: Record<string, string> = {}
    for (const row of res.rows as { key: string; value: string }[]) byKey[row.key] = row.value
    return NextResponse.json({
      loaderImage: byKey[SETTINGS_KEYS.loaderImage] || '',
      loaderDuration: byKey[SETTINGS_KEYS.loaderDuration] || '',
      cvUrl: byKey[SETTINGS_KEYS.cvUrl] || '',
      cvName: byKey[SETTINGS_KEYS.cvName] || '',
      faviconUrl: byKey[SETTINGS_KEYS.faviconUrl] || '',
    })
  } catch (err) {
    console.error('[site GET] error:', err)
    return NextResponse.json(EMPTY_SETTINGS)
  }
}

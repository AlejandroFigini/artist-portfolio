import 'server-only'
import { getPool, hasDb, ensureDb } from '@/lib/db'
import { SETTINGS_KEYS, EMPTY_SETTINGS, type SiteSettings } from '@/lib/settings'

export async function getSiteSettingsServer(): Promise<SiteSettings> {
  if (!hasDb) return EMPTY_SETTINGS
  try {
    await ensureDb()
    const pool = getPool()!
    const keys = [...Object.values(SETTINGS_KEYS), 'loader.gallop']
    const res = await pool.query('SELECT key, value FROM cms_data WHERE key = ANY($1)', [keys])
    const byKey: Record<string, string> = {}
    for (const row of res.rows as { key: string; value: string }[]) byKey[row.key] = row.value
    return {
      loaderVideo: byKey['loader.gallop'] || byKey[SETTINGS_KEYS.loaderVideo] || '',
      loaderImage: byKey[SETTINGS_KEYS.loaderImage] || '',
      loaderDuration: byKey[SETTINGS_KEYS.loaderDuration] || '',
      cvUrl: byKey[SETTINGS_KEYS.cvUrl] || '',
      cvName: byKey[SETTINGS_KEYS.cvName] || '',
      faviconUrl: byKey[SETTINGS_KEYS.faviconUrl] || '',
    }
  } catch (err) {
    console.error('[site-server] error:', err)
    return EMPTY_SETTINGS
  }
}

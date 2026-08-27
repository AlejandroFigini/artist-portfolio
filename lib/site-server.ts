import 'server-only'
import { cache } from 'react'
import { getPool, hasDb, ensureDb } from '@/lib/db'
import { SETTINGS_KEYS, EMPTY_SETTINGS, ANIM_FIELDS, ANIM_EVERY_FIELDS, animKey, type SiteSettings } from '@/lib/settings'

/* `cache()` = una sola consulta por request. El layout lo pide para el favicon
   y la portada para el póster del loader: sin esto son dos viajes a la base
   por cada visita, y con la base en otro servicio de Railway eso es latencia
   pura metida en el TTFB. */
export const getSiteSettingsServer = cache(async (): Promise<SiteSettings> => {
  if (!hasDb) return EMPTY_SETTINGS
  try {
    await ensureDb()
    const pool = getPool()!
    const keys = [...Object.values(SETTINGS_KEYS), ...ANIM_FIELDS.map(animKey), ...ANIM_EVERY_FIELDS.map(animKey), 'loader.gallop']
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
      appleIconUrl: byKey[SETTINGS_KEYS.appleIconUrl] || '',
      // Animaciones (principal + rotación) — salen de la tabla, no a mano.
      ...(Object.fromEntries(ANIM_FIELDS.map((f) => [f, byKey[animKey(f)] || ''])) as Pick<SiteSettings, (typeof ANIM_FIELDS)[number]>),
      ...(Object.fromEntries(ANIM_EVERY_FIELDS.map((f) => [f, byKey[animKey(f)] || ''])) as Pick<SiteSettings, (typeof ANIM_EVERY_FIELDS)[number]>),
    }
  } catch (err) {
    console.error('[site-server] error:', err)
    return EMPTY_SETTINGS
  }
})

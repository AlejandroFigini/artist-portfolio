import 'server-only'
import { getPool, hasDb, ensureDb } from '@/lib/db'
import { itemKey, readSettings } from '@/lib/cms/collection'
import { COLLECTIONS } from '@/lib/cms/collections'

/* Primera slide de los carruseles del hero, leída en el server.

   El contenido del CMS se hidrata en el cliente (`/api/content`), así que la
   URL de la portada recién se conocía después de: HTML → bundle → hidratar →
   fetch → recién ahí empezaba la descarga de la imagen. Cuatro saltos en
   serie, y la pantalla de carga espera justamente a que esa imagen decodifique
   (gates `heroBackdrop` / `heroPanel`).

   Leyendo la misma clave acá, la página puede emitir el `<link rel=preload>` en
   el HTML inicial: la imagen baja en paralelo con el JS en vez de después de
   él. No cambia de dónde sale el contenido — sigue siendo `cms_data`. */

export type HeroPreload = { backdrop: string; panel: string }

const EMPTY: HeroPreload = { backdrop: '', panel: '' }

export async function getHeroPreloadServer(): Promise<HeroPreload> {
  if (!hasDb) return EMPTY
  try {
    await ensureDb()
    const pool = getPool()!
    const settings = await pool.query(
      'SELECT key, value FROM cms_data WHERE key = ANY($1)',
      [['hero.settings', 'hero-main.settings']],
    )
    const byKey: Record<string, string> = {}
    for (const row of settings.rows as { key: string; value: string }[]) byKey[row.key] = row.value

    // readSettings espera el mapa de items: alcanza con las dos claves .settings.
    const firstKeyOf = (prefix: string) => {
      const id = readSettings(byKey, prefix).ids[0]
      return id ? itemKey(COLLECTIONS[prefix], id) : ''
    }
    const backdropKey = firstKeyOf('hero')
    const panelKey = firstKeyOf('hero-main')
    const wanted = [backdropKey, panelKey].filter(Boolean)
    if (!wanted.length) return EMPTY

    const items = await pool.query('SELECT key, value FROM cms_data WHERE key = ANY($1)', [wanted])
    const srcByKey: Record<string, string> = {}
    for (const row of items.rows as { key: string; value: string }[]) srcByKey[row.key] = row.value

    return {
      backdrop: srcByKey[backdropKey] || '',
      panel: srcByKey[panelKey] || '',
    }
  } catch (err) {
    console.error('[hero-server] error:', err)
    return EMPTY
  }
}

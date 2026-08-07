import 'server-only'
import { getPool, hasDb, ensureDb } from '@/lib/db'
import { ALL_LANGS, BASE_LANG, isTranslatableEntry, type Lang } from '@/lib/i18n'

/* Contenido inicial del CMS, leído en el server y embebido en el HTML.

   El arranque encadenaba tres viajes en serie DESPUÉS de hidratar:
   `/api/content` → y recién con esa respuesta `/api/app-state` y
   `/api/translations`. La pantalla de carga espera a los dos primeros (gates
   `serverState` e `i18n`), así que en 4G lento eran ~1s largo de latencia pura
   metida adentro del LCP, con el sitio ya descargado y sin poder mostrarse.

   Son ~1 KB de contenido y ~1 KB de traducciones: entran en el HTML por menos
   de lo que cuesta un solo round trip. `retired` viaja también porque el sitio
   público lo necesita para pintar los contenedores vacíos.

   NO viaja el resto de `cms_state` (media_meta, audit, unused, trash): son
   ~96 KB de metadata que solo mira el panel de gestión. Eso se sigue trayendo
   por `/api/app-state`, pero de fondo y sin retener la pantalla de carga. */

export type CmsBootstrap = {
  items: Record<string, string>
  translations: Record<string, Record<string, string>>
  retired: string[]
}

const EMPTY: CmsBootstrap = { items: {}, translations: {}, retired: [] }

/** Id del <script type="application/json"> que lo transporta. */
export const CMS_BOOTSTRAP_ID = '__cms_bootstrap__'

export async function getCmsBootstrapServer(): Promise<CmsBootstrap> {
  if (!hasDb) return EMPTY
  try {
    await ensureDb()
    const pool = getPool()!
    const [data, translations, retired] = await Promise.all([
      pool.query('SELECT key, value FROM cms_data'),
      pool.query('SELECT key, lang, value FROM cms_translations'),
      pool.query("SELECT value FROM cms_state WHERE key = 'retired'"),
    ])

    const items: Record<string, string> = {}
    for (const row of data.rows as { key: string; value: string }[]) items[row.key] = row.value

    /* Misma forma y MISMO filtro que /api/translations: el idioma base sale de
       `cms_data` pero solo con las entradas traducibles (sin URLs, settings,
       fechas ni rutas). Si acá se colara la lista entera, el mapa base tendría
       claves que el de /api/translations no tiene y volver al inglés se
       comportaría distinto según por dónde se hidrató. */
    const byLang: Record<string, Record<string, string>> = {}
    for (const lang of ALL_LANGS) byLang[lang] = {}
    for (const [key, value] of Object.entries(items)) {
      if (isTranslatableEntry(key, value)) byLang[BASE_LANG][key] = value
    }
    for (const row of translations.rows as { key: string; lang: Lang; value: string }[]) {
      if (!byLang[row.lang]) continue
      byLang[row.lang][row.key] = row.value
    }

    const rawRetired = retired.rows[0]?.value
    return {
      items,
      translations: byLang,
      retired: Array.isArray(rawRetired) ? (rawRetired as string[]) : [],
    }
  } catch (err) {
    console.error('[cms-bootstrap] error:', err)
    return EMPTY
  }
}

/* `</script>` adentro de un valor cerraría la etiqueta antes de tiempo. Escapar
   `<` cubre ese caso y el de `<!--`, y sigue siendo JSON válido. */
export function serializeCmsBootstrap(data: CmsBootstrap): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

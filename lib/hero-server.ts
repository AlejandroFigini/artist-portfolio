import 'server-only'
import { cache } from 'react'
import { getCmsBootstrapServer } from '@/lib/cms-bootstrap-server'
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

/* Se resuelve contra el bootstrap y no con consultas propias. Antes eran DOS
   `SELECT` en serie —el segundo depende de las ids que devuelve el primero—
   sobre la misma tabla que `getCmsBootstrapServer` ya trae ENTERA en paralelo
   con el resto. Con Postgres en otro servicio eso era latencia de red pura
   sumada al TTFB de un documento que todavía no mandó un byte, y encima
   retrasando el `<link rel=preload>` que esperan los gates `heroBackdrop` y
   `heroPanel`. `cache()` de React deduplica la llamada dentro del request, así
   que reusarla no repite ninguna consulta. */
export const getHeroPreloadServer = cache(async (): Promise<HeroPreload> => {
  const { items } = await getCmsBootstrapServer()

  // readSettings espera el mapa de items: las dos claves .settings están ahí.
  const firstKeyOf = (prefix: string) => {
    const id = readSettings(items, prefix).ids[0]
    return id ? itemKey(COLLECTIONS[prefix], id) : ''
  }
  const backdropKey = firstKeyOf('hero')
  const panelKey = firstKeyOf('hero-main')
  if (!backdropKey && !panelKey) return EMPTY

  return {
    backdrop: items[backdropKey] || '',
    panel: items[panelKey] || '',
  }
})

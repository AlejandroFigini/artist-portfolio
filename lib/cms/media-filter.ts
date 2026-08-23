/* Filtrado y orden de las grillas de medios (Repositorio del panel y selector
   "Choose from repository" del sitio).

   Módulo PURO a propósito: no importa el store ni toca el DOM. Los datos que
   necesita —nombre, fecha, peso, tipo— se los pasa el caller ya resueltos como
   `MediaFacts` (ver `mediaFacts()` en `lib/cms/store`). Así el criterio de
   filtrado es UNO solo para las dos grillas y se puede testear en node. */

export type MediaKindFilter = 'all' | 'image' | 'video'

/* Criterio y sentido van SEPARADOS: en la barra son dos controles (un
   desplegable de dos opciones y un botón que invierte), y así "cambiar de fecha
   a peso" no pierde el sentido que el admin ya había elegido. */
export type MediaSortBy = 'date' | 'size'
export type MediaSortDir = 'asc' | 'desc'

export type MediaQuery = {
  /** Texto del buscador. Se aplica en vivo, sin botón de confirmar. */
  search: string
  kind: MediaKindFilter
  sortBy: MediaSortBy
  sortDir: MediaSortDir
}

export const DEFAULT_MEDIA_QUERY: MediaQuery = { search: '', kind: 'all', sortBy: 'date', sortDir: 'desc' }

/** Los cuatro datos de los que dependen el buscador, el filtro y el orden. */
export type MediaFacts = {
  name: string
  /** Epoch ms de subida. 0 = desconocida (queda al final en orden descendente). */
  ts: number
  /** Bytes. 0 = desconocido. */
  size: number
  isVideo: boolean
}

/** Normaliza para comparar: sin acentos y en minúsculas, para que tecleando
 *  "ilustracion" aparezca "Ilustración". */
export function normalizeSearch(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export function matchesMediaQuery(f: MediaFacts, q: MediaQuery): boolean {
  if (q.kind !== 'all' && (q.kind === 'video') !== f.isVideo) return false
  const term = normalizeSearch(q.search)
  if (!term) return true
  return normalizeSearch(f.name).includes(term)
}

export function compareMedia(a: MediaFacts, b: MediaFacts, q: MediaQuery): number {
  const asc = q.sortBy === 'size' ? a.size - b.size : a.ts - b.ts
  return q.sortDir === 'asc' ? asc : -asc
}

/** ¿La query recorta algo? Sirve para distinguir "el repositorio está vacío" de
 *  "tu búsqueda no encontró nada", que son dos mensajes distintos. */
export const isMediaQueryActive = (q: MediaQuery): boolean =>
  q.kind !== 'all' || normalizeSearch(q.search).length > 0

/** Filtra y ordena en un solo paso. `facts` resuelve cada item una única vez;
 *  sin eso el comparador reharía la resolución en cada comparación. */
export function filterSortMedia<T>(list: T[], facts: (e: T) => MediaFacts, q: MediaQuery): T[] {
  const rows = list.map((e) => ({ e, f: facts(e) })).filter(({ f }) => matchesMediaQuery(f, q))
  rows.sort((x, y) => compareMedia(x.f, y.f, q))
  return rows.map(({ e }) => e)
}

/* Orden de estados en la vista "All": primero lo que NO se está usando —que es
   lo que el admin busca cuando entra al repositorio—, después lo ya asignado y
   al final la papelera. Los dos consumidores hablan vocabularios distintos
   (el panel `used|unused|trash`, el picker `usado|sin usar`), por eso el orden
   se pasa por parámetro y no se cablea acá. */
export const MEDIA_STATE_ORDER = ['unused', 'used', 'trash'] as const

/** Agrupa por estado sin tocar el orden interno: `Array.sort` es estable, así
 *  que dentro de cada grupo se conserva el criterio elegido en la barra.
 *  Un estado que no figure en `order` cae al final. */
export function groupByMediaState<T>(
  list: T[],
  stateOf: (e: T) => string,
  order: readonly string[] = MEDIA_STATE_ORDER,
): T[] {
  const rank = (e: T) => {
    const i = order.indexOf(stateOf(e))
    return i === -1 ? order.length : i
  }
  return [...list].sort((a, b) => rank(a) - rank(b))
}

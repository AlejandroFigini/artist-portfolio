/* Taxonomía declarativa Página → Secciones para la tab "Contenido en uso".
   El modelo de datos solo guarda `section` por entrada; acá la agrupamos en
   las páginas reales del sitio (nav). Hoy renderizan contenido la home (el
   Feed concentra todas las secciones) y /contact; las páginas de galería y
   /about no tienen contenedores propios (su contenido vive en el Feed), así
   que no figuran como página aparte y su contenido no se duplica. El orden
   replica el del nav.

   Un mismo archivo puede ocupar VARIOS contenedores. La regla de agrupación:
   - repetido dentro de UNA página → una sola tarjeta en esa página, que
     enumera todos sus contenedores;
   - repetido en DOS páginas → aparece en cada página, y en cada una enumera
     solo los contenedores de esa página.
   Por eso la deduplicación es por (página, archivo) y no global. */

import { sumSizes } from './store'
import { ANIM_FIELDS, animKey } from '@/lib/settings'

type TreeEntry = { key?: string; section?: string; size?: number | null; src?: string; dataUrl?: string }

type PageDef = { id: string; label: string; route: string; icon: string; sections: string[]; keys?: string[] }

/* Secciones (las del REGISTRY de engine.ts y las heredadas en español que
   siguen vivas en la BD) que pertenecen a cada página. Agregar variantes en
   inglés, nunca borrar las viejas: renombrarlas rompe datos de producción. */
export const SITE_PAGES: PageDef[] = [
  {
    id: 'config', label: 'Site Configuration', route: '/admin', icon: 'fa-gear',
    sections: [
      'Página de carga', 'Pantalla de carga', 'Loading Screen',
      'Ajustes del sitio', 'Icono de la página', 'Favicon',
      'Site Settings', 'Configuración del sitio', 'Site Configuration',
    ],
    keys: ['loader.gallop', 'settings.faviconUrl', 'settings.appleIconUrl', ...ANIM_FIELDS.map(animKey)],
  },
  {
    id: 'contact', label: 'Contact', route: '/contact', icon: 'fa-envelope',
    sections: ['Contact', 'Contacto'],
    keys: ['contact.hero.bg', 'contact.hero.title', 'contact.hero.lede', 'contact.social.anim'],
  },
  /* Fallback: el Feed concentra todo lo que no es de una página dedicada. */
  { id: 'feed', label: 'Feed', route: '/', icon: 'fa-house', sections: [] },
]

const FALLBACK_PAGE = SITE_PAGES[SITE_PAGES.length - 1]

/* La clave indexada lleva sufijo posicional (`settings.faviconUrl#0`), así que
   la comparación es por la base, no por igualdad exacta. */
const baseKey = (key: string) => key.split('#')[0]

function pageDefFor(e: TreeEntry): PageDef {
  const key = e.key ? baseKey(e.key) : ''
  const section = e.section || ''
  return (
    SITE_PAGES.find((p) => p.sections.includes(section) || (key && p.keys?.includes(key))) ||
    FALLBACK_PAGE
  )
}

/** Identidad del archivo dentro de una página: mismo archivo = misma tarjeta. */
const fileIdOf = (e: TreeEntry) => e.src || e.dataUrl || e.key || ''

/** Una tarjeta de "Contenido en uso": el archivo + todos los contenedores de
 *  ESA página que lo usan (`occs[0]` es el representante que se pinta). */
export type PageEntry<T> = { item: T; occs: T[] }

export type PageNode<T> = {
  id: string; label: string; route: string; icon: string
  /** Archivos únicos de la página (uno por tarjeta). */
  items: T[]
  /** Los mismos archivos, con sus contenedores de esta página. */
  entries: PageEntry<T>[]
  /** Usos repetidos dentro de la página (total de contenedores − archivos). */
  reused: number
  count: number; size: number
}

export function buildPageTree<T extends TreeEntry>(arr: T[]): PageNode<T>[] {
  const byPage = new Map<string, Map<string, PageEntry<T>>>()
  SITE_PAGES.forEach((p) => byPage.set(p.id, new Map()))

  arr.forEach((e) => {
    const groups = byPage.get(pageDefFor(e).id)!
    const id = fileIdOf(e)
    const group = groups.get(id)
    if (group) group.occs.push(e)
    else groups.set(id, { item: e, occs: [e] })
  })

  return SITE_PAGES.map((p) => {
    const entries = Array.from(byPage.get(p.id)!.values())
    const items = entries.map((g) => g.item)
    return {
      id: p.id, label: p.label, route: p.route, icon: p.icon,
      entries, items,
      reused: entries.reduce((n, g) => n + g.occs.length - 1, 0),
      count: items.length,
      size: sumSizes(items),
    }
  })
}

// ----- Cloudinary folder helpers -------------------------------------------------

/** Dado el nombre humano de una sección, devuelve la ruta de carpeta en Cloudinary.
 *  Simplificado a 3 carpetas principales: en-uso, sin-usar, basurero. */
export function getCloudinaryFolder(sectionName: string): string {
  if (sectionName === 'basurero') return 'portfolio/basurero'
  if (sectionName === 'sin-usar') return 'portfolio/sin-usar'
  return 'portfolio/en-uso'
}

/** Devuelve la lista completa de rutas de carpeta que deben existir en Cloudinary. */
export function getAllFolderPaths(): string[] {
  return [
    'portfolio',
    'portfolio/en-uso',
    'portfolio/sin-usar',
    'portfolio/basurero',
  ]
}

/** Devuelve la página y sección formateada para una entrada en uso según su clave o sección */
export function getPageAndSectionInfo(entry: { key?: string; _key?: string; section?: string }): { page: string; section: string } {
  const p = pageDefFor({ key: entry._key || entry.key, section: entry.section })
  return { page: `${p.label} (${p.route})`, section: entry.section || 'General' }
}

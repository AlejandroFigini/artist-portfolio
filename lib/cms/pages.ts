/* Taxonomía declarativa Página → Secciones para la tab "Contenido en uso".
   El modelo de datos solo guarda `section` por entrada; acá la agrupamos en
   las páginas reales del sitio (nav). Hoy SOLO la home (/) renderiza contenido:
   el Feed concentra todo. Las páginas de galería/about figuran en el orden del
   nav pero sin secciones propias (aún no implementadas) → se ven como
   placeholders vacíos. Así una sección vive en un único lugar (Feed), sin
   duplicar el mismo contenido entre Feed y su página dedicada. El orden de
   páginas y secciones replica el del nav y el de la home. */

import { sumSizes } from './store'

type TreeEntry = { key?: string; section?: string; size?: number | null }

type PageDef = { id: string; label: string; route: string; icon: string; match: (e: TreeEntry) => boolean }

export const SITE_PAGES: PageDef[] = [
  {
    id: 'config', label: 'Site Configuration', route: '/admin', icon: 'fa-gear',
    match: (e) =>
      ['Página de carga', 'Pantalla de carga', 'Loading Screen', 'Ajustes del sitio', 'Icono de la página', 'Favicon', 'Site Settings', 'Configuración del sitio', 'Site Configuration'].includes(e.section || '') ||
      (e.key === 'loader.gallop' || e.key === 'settings.faviconUrl' || e.key === 'settings.appleIconUrl'),
  },
  {
    id: 'feed', label: 'Feed', route: '/', icon: 'fa-house',
    match: () => true // Catch-all for feed since it's the only other page
  }
]

export type PageNode<T> = {
  id: string; label: string; route: string; icon: string
  count: number; size: number; items: T[]
}

export function buildPageTree<T extends TreeEntry>(arr: T[]): PageNode<T>[] {
  const pages: PageNode<T>[] = SITE_PAGES.map((p) => ({
    id: p.id, label: p.label, route: p.route, icon: p.icon, items: [], count: 0, size: 0
  }))
  
  arr.forEach(e => {
    const page = pages.find(p => {
      const def = SITE_PAGES.find(sp => sp.id === p.id)
      return def && def.match(e)
    })
    if (page) {
      page.items.push(e)
    } else {
      pages[1].items.push(e) // Fallback to feed
    }
  })

  pages.forEach(p => {
    p.count = p.items.length
    p.size = sumSizes(p.items)
  })

  // Only return pages that have items to keep UI clean, though config and feed will likely always have items
  return pages
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
  const e: TreeEntry = { key: entry._key || entry.key, section: entry.section }
  for (const p of SITE_PAGES) {
    if (p.match(e)) {
      return { page: `${p.label} (${p.route})`, section: 'General' }
    }
  }
  return { page: 'Feed (/)', section: 'General' }
}

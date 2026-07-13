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

type SectionDef = { id: string; label: string; match: (e: TreeEntry) => boolean }
type PageDef = { id: string; label: string; route: string; icon: string; sections: SectionDef[] }

const bySection = (...names: string[]) => (e: TreeEntry) => names.includes(e.section || '')

// Orden replica el nav: Feed → galerías (Illustrations, Animations, Characters,
// 3D Models, Multimedia) → About me. Solo Feed tiene secciones; el resto son
// placeholders hasta que esas páginas existan.
export const SITE_PAGES: PageDef[] = [
  {
    id: 'config', label: 'Site Configuration', route: '/admin', icon: 'fa-gear',
    sections: [
      {
        id: 'loader',
        label: 'Loading Screen',
        match: (e) =>
          bySection('Página de carga', 'Pantalla de carga', 'Loading Screen')(e) ||
          ((e.section === 'Configuración del sitio' || e.section === 'Site Configuration') && e.key === 'loader.gallop'),
      },
      {
        id: 'favicon',
        label: 'Favicon',
        match: (e) =>
          bySection('Ajustes del sitio', 'Icono de la página', 'Favicon', 'Site Settings', 'Site Configuration')(e) ||
          ((e.section === 'Configuración del sitio' || e.section === 'Site Configuration') && e.key === 'settings.faviconUrl'),
      },
    ],
  },
  {
    id: 'feed', label: 'Feed', route: '/', icon: 'fa-house',
    sections: [
      { id: 'portada', label: 'Hero / Cover', match: bySection('Portada', 'Portada (Principal)', 'Portada (Secundario)', 'Subtítulos', 'Hero / Cover', 'Cover', 'Hero', 'Subtitles') },
      { id: 'about', label: 'About me', match: bySection('Sobre mí', 'About me') },
      { id: 'animations', label: 'Animations', match: bySection('Animations', 'Animaciones') },
      { id: 'projects', label: 'Projects', match: bySection('Proyectos', 'Projects') },
      { id: 'characters', label: 'Characters', match: bySection('Characters') },
      { id: 'models3d', label: '3D Models', match: bySection('3D Models') },
      { id: 'illustrations', label: 'Illustrations', match: bySection('Ilustraciones', 'Illustrations') },
    ],
  },
  { id: 'illustrations', label: 'Illustrations', route: '/illustrations', icon: 'fa-paintbrush', sections: [] },
  { id: 'animations', label: 'Animations', route: '/animations', icon: 'fa-clapperboard', sections: [] },
  { id: 'characters', label: 'Characters', route: '/characters', icon: 'fa-user-astronaut', sections: [] },
  { id: 'models3d', label: '3D Models', route: '/models-3d', icon: 'fa-cube', sections: [] },
  { id: 'multimedia', label: 'Multimedia', route: '/multimedia', icon: 'fa-photo-film', sections: [] },
  { id: 'aboutme', label: 'About me', route: '/about', icon: 'fa-id-badge', sections: [] },
]

export type SectionNode<T> = { id: string; label: string; items: T[]; count: number; size: number }
export type PageNode<T> = {
  id: string; label: string; route: string; icon: string
  count: number; size: number; sections: SectionNode<T>[]
}

/** Arma el árbol Página → Sección a partir de un set de entradas (en uso).
   Las entradas que no caen en ninguna sección conocida se juntan en "Otros"
   bajo Feed, para no perder contenido de vista. */
export function buildPageTree<T extends TreeEntry>(arr: T[]): PageNode<T>[] {
  const matched = new Set<T>()
  const pages: PageNode<T>[] = SITE_PAGES.map((p) => {
    const sections: SectionNode<T>[] = p.sections.map((s) => {
      const items = arr.filter((e) => s.match(e))
      items.forEach((e) => matched.add(e))
      return { id: s.id, label: s.label, items, count: items.length, size: sumSizes(items) }
    })
    return { id: p.id, label: p.label, route: p.route, icon: p.icon, sections, count: 0, size: 0 }
  })
  const unmatched = arr.filter((e) => !matched.has(e))
  const feed = pages.find((p) => p.id === 'feed')
  if (unmatched.length && feed) {
    feed.sections.push({ id: 'otros', label: 'Other', items: unmatched, count: unmatched.length, size: sumSizes(unmatched) })
  }
  pages.forEach((p) => {
    const allItems = p.sections.flatMap((s) => s.items)
    p.count = p.sections.reduce((a, s) => a + s.count, 0)
    p.size = sumSizes(allItems)
  })
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


/* Taxonomía declarativa Página → Secciones para la tab "Contenido en uso".
   El modelo de datos solo guarda `section` por entrada; acá la agrupamos en
   las páginas reales del sitio (nav). Feed concentra todo lo que muestra el
   home; las páginas de galería se listan aunque aún no estén implementadas
   (se ven con su conteo en cero). Una sección puede contarse en Feed y también
   en su galería dedicada — el doble conteo es intencional. */

import { sumSizes } from './store'

type TreeEntry = { key?: string; section?: string; size?: number | null }

type SectionDef = { id: string; label: string; match: (e: TreeEntry) => boolean }
type PageDef = { id: string; label: string; route: string; icon: string; sections: SectionDef[] }

const bySection = (...names: string[]) => (e: TreeEntry) => names.includes(e.section || '')
const byKeyPrefix = (prefix: string) => (e: TreeEntry) => !!e.key && e.key.startsWith(prefix)

export const SITE_PAGES: PageDef[] = [
  {
    id: 'feed', label: 'Feed', route: '/', icon: 'fa-house',
    sections: [
      { id: 'portada', label: 'Portada', match: bySection('Portada', 'Subtítulos') },
      { id: 'about', label: 'Sobre mí', match: bySection('Sobre mí') },
      { id: 'animations', label: 'Animations', match: bySection('Animations', 'Animaciones') },
      { id: 'projects', label: 'Projects', match: byKeyPrefix('proj#') },
      { id: 'characters', label: 'Characters', match: bySection('Characters') },
      { id: 'models3d', label: '3D Models', match: bySection('3D Models') },
      { id: 'illustrations', label: 'Ilustraciones', match: bySection('Ilustraciones') },
    ],
  },
  {
    id: 'aboutme', label: 'About me', route: '/about', icon: 'fa-id-badge',
    sections: [{ id: 'about', label: 'Sobre mí', match: bySection('Sobre mí') }],
  },
  {
    id: 'illustrations', label: 'Illustrations', route: '/illustrations', icon: 'fa-paintbrush',
    sections: [{ id: 'illustrations', label: 'Ilustraciones', match: bySection('Ilustraciones') }],
  },
  {
    id: 'animations', label: 'Animations', route: '/animations', icon: 'fa-clapperboard',
    sections: [{ id: 'animations', label: 'Animations', match: bySection('Animations', 'Animaciones') }],
  },
  {
    id: 'characters', label: 'Characters', route: '/characters', icon: 'fa-user-astronaut',
    sections: [{ id: 'characters', label: 'Characters', match: bySection('Characters') }],
  },
  {
    id: 'models3d', label: '3D Models', route: '/models-3d', icon: 'fa-cube',
    sections: [{ id: 'models3d', label: '3D Models', match: bySection('3D Models') }],
  },
  { id: 'multimedia', label: 'Multimedia', route: '/multimedia', icon: 'fa-photo-film', sections: [] },
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
    feed.sections.push({ id: 'otros', label: 'Otros', items: unmatched, count: unmatched.length, size: sumSizes(unmatched) })
  }
  pages.forEach((p) => {
    p.count = p.sections.reduce((a, s) => a + s.count, 0)
    p.size = p.sections.reduce((a, s) => a + s.size, 0)
  })
  return pages
}

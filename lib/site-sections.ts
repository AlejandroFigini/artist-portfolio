/* Secciones de la portada a las que apunta la navegación.

   El sitio es UNA sola página: las galerías son secciones del feed, no rutas.
   Antes existían /illustrations, /animations, /characters, /models-3d y
   /multimedia, cada una montando la MISMA sección de la portada (y multimedia
   ni siquiera eso: era un "próximamente"). Duplicaban el contenido, partían el
   SEO y arrastraban su propio <head>. Ahora el menú ancla al feed.

   El orden es el de montaje en `app/(site)/page.tsx`. Los `id` son los del
   `<section>` correspondiente: si se renombra uno hay que renombrarlo en ambos
   lados o el ancla deja de resolver. */

export type SiteSection = {
  /** id del <section> en la portada. También el fragmento de la URL. */
  id: string
  icon: string
  label: string
  /** Clave de UI_TRANSLATIONS (lib/i18n). */
  i18n: string
}

export const SITE_SECTIONS: SiteSection[] = [
  { id: 'animations', icon: 'fa-clapperboard', label: 'Animations', i18n: 'nav_animations' },
  { id: 'projects', icon: 'fa-diagram-project', label: 'Projects', i18n: 'rail_projects' },
  { id: 'characters', icon: 'fa-user-astronaut', label: 'Characters', i18n: 'nav_characters' },
  { id: 'models-3d', icon: 'fa-cube', label: '3D Models', i18n: 'nav_3d' },
  { id: 'illustrations', icon: 'fa-paintbrush', label: 'Illustrations', i18n: 'nav_illustrations' },
]

export const isSiteSectionId = (id: string): boolean =>
  SITE_SECTIONS.some((s) => s.id === id)

/** Fragmento leído de la URL, ya validado contra la lista. */
export function sectionIdFromHash(hash: string): string {
  const id = hash.replace(/^#/, '')
  if (!id) return ''
  let decoded = id
  try { decoded = decodeURIComponent(id) } catch { /* hash malformado: se usa crudo */ }
  return isSiteSectionId(decoded) ? decoded : ''
}

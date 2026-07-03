'use client'

/* Motor CMS del sitio — port del núcleo DOM de cms.js: registro de
   editables, indexado, hidratación de overrides, overlay de edición y
   slots vacíos. Opera imperativamente sobre el DOM que React renderizó
   (los contenedores son estáticos; React no los re-renderiza), igual
   que el legacy operaba sobre el HTML. Los modales son React: el motor
   despacha comandos vía lib/commands. */

import type { Dispatch } from '@/lib/commands'
import { saveContent } from '@/lib/api'
import {
  state, emit, recordAudit, persistUsed, persistUnused, persistRetired,
  persistOverridesLocal, persistLang, saveJSON, LS, type FieldValue,
} from '@/lib/cms/store'
import { BASE_LANG, type Lang } from '@/lib/i18n'
import { basename } from '@/lib/utils'

// ----- Definiciones de campos (port de ANIM_FIELDS / ILLU_FIELDS / WAVE_FIELDS)

export type FieldDef = {
  key: string
  label: string
  textarea?: boolean
  optional?: boolean // si es true, no bloquea la subida cuando está vacío
  get: (c: HTMLElement) => string
  set: (c: HTMLElement, v: string) => void
}

const txt = (e: Element | null) => (e ? (e.textContent || '').trim() : '')
function setTxtKeepIcon(e: Element | null, v: string) {
  if (!e) return
  const icon = e.querySelector('i')
  e.textContent = ''
  if (icon) { e.appendChild(icon); e.appendChild(document.createTextNode(' ')) }
  e.appendChild(document.createTextNode(v))
}

const ANIM_FIELDS: FieldDef[] = [
  { key: 'title', label: 'Título',
    get: (c) => txt(c.querySelector('.video-title')),
    set: (c, v) => { const e = c.querySelector('.video-title'); if (e) e.textContent = v; c.setAttribute('data-title', v) } },
  { key: 'date', label: 'Fecha', optional: true,
    get: (c) => txt(c.querySelector('.video-date')) || c.getAttribute('data-date') || '',
    set: (c, v) => { setTxtKeepIcon(c.querySelector('.video-date'), v); c.setAttribute('data-date', v) } },
  { key: 'project', label: 'Proyecto', optional: true,
    get: (c) => txt(c.querySelector('.video-project')) || c.getAttribute('data-project') || '',
    set: (c, v) => { setTxtKeepIcon(c.querySelector('.video-project'), v); c.setAttribute('data-project', v) } },
  { key: 'inspiration', label: 'Inspiración', optional: true,
    get: (c) => c.getAttribute('data-inspiration') || '',
    set: (c, v) => c.setAttribute('data-inspiration', v) },
  { key: 'fsdesc', label: 'Descripción (al ver en pantalla completa)', textarea: true, optional: true,
    get: (c) => c.getAttribute('data-desc') || '',
    set: (c, v) => c.setAttribute('data-desc', v) },
]

const ILLU_FIELDS: FieldDef[] = [
  { key: 'title', label: 'Título', get: (c) => c.dataset.title || '', set: (c, v) => { c.dataset.title = v } },
  { key: 'date', label: 'Fecha', optional: true, get: (c) => c.dataset.date || '', set: (c, v) => { c.dataset.date = v } },
  { key: 'project', label: 'Proyecto', optional: true, get: (c) => c.dataset.project || '', set: (c, v) => { c.dataset.project = v } },
  { key: 'inspiration', label: 'Inspiración', optional: true, get: (c) => c.dataset.inspiration || '', set: (c, v) => { c.dataset.inspiration = v } },
  { key: 'desc', label: 'Descripción (al ver en pantalla completa)', textarea: true, optional: true,
    get: (c) => c.dataset.desc || '', set: (c, v) => { c.dataset.desc = v } },
  { key: 'link', label: 'Link al repositorio (Instagram, ArtStation, etc.)', optional: true,
    get: (c) => c.dataset.link || '', set: (c, v) => { c.dataset.link = v } },
]

export const PROJECT_FIELDS: FieldDef[] = [
  { key: 'title', label: 'Título',
    get: (c) => c.getAttribute('data-title') || '',
    set: (c, v) => { c.setAttribute('data-title', v); const e = c.querySelector('.proj-card-title'); if (e) e.textContent = v } },
  { key: 'start_date', label: 'Fecha de inicio', optional: true,
    get: (c) => c.getAttribute('data-start-date') || '',
    set: (c, v) => { c.setAttribute('data-start-date', v); const e = c.querySelector('.proj-card-date'); if (e) e.textContent = v } },
  { key: 'end_date', label: 'Fecha de finalización', optional: true,
    get: (c) => c.getAttribute('data-end-date') || '',
    set: (c, v) => { c.setAttribute('data-end-date', v) } },
  { key: 'duration', label: 'Duración', optional: true,
    get: (c) => c.getAttribute('data-duration') || '',
    set: (c, v) => { c.setAttribute('data-duration', v) } },
  { key: 'theme', label: 'Temática del proyecto', optional: true,
    get: (c) => c.getAttribute('data-theme') || '',
    set: (c, v) => { c.setAttribute('data-theme', v) } },
  { key: 'summary', label: 'Breve descripción', textarea: true, optional: true,
    get: (c) => c.getAttribute('data-summary') || '',
    set: (c, v) => { c.setAttribute('data-summary', v); const e = c.querySelector('.proj-card-summary'); if (e) e.textContent = v } },
  { key: 'desc', label: 'Descripción completa', textarea: true, optional: true,
    get: (c) => c.getAttribute('data-desc') || '',
    set: (c, v) => { c.setAttribute('data-desc', v) } }
]

const CHARACTER_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Nombre',
    get: (c) => c.getAttribute('data-name') || '',
    set: (c, v) => { c.setAttribute('data-name', v); const e = c.querySelector('.ch-name'); if (e) e.textContent = v } },
  { key: 'role', label: 'Rol', optional: true,
    get: (c) => c.getAttribute('data-role') || '',
    set: (c, v) => { c.setAttribute('data-role', v); const e = c.querySelector('.ch-role'); if (e) e.textContent = v } },
  { key: 'desc', label: 'Descripción', textarea: true, optional: true,
    get: (c) => c.getAttribute('data-desc') || '',
    set: (c, v) => { c.setAttribute('data-desc', v); const e = c.querySelector('.ch-desc'); if (e) e.textContent = v } },
]


const WAVE_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Nombre de Software',
    get: (c) => txt(c.querySelector('.wave-text')),
    set: (c, v) => {
      const key = c.getAttribute('data-cms-key')
      if (!key) return
      document.querySelectorAll<HTMLElement>(`[data-cms-key="${key}"]`).forEach(el => {
        let t = el.querySelector('.wave-text')
        if (!t) { t = document.createElement('span'); t.className = 'wave-text'; el.appendChild(t) }
        t.textContent = v
      })
    }
  },
]

const ABOUT_SPEC_FIELDS: FieldDef[] = [
  { key: 'k', label: 'Etiqueta',
    get: (c) => txt(c.querySelector('.about-spec-k')),
    set: (c, v) => { const e = c.querySelector('.about-spec-k'); if (e) e.textContent = v } },
  { key: 'v', label: 'Valor',
    get: (c) => txt(c.querySelector('.about-spec-v')),
    set: (c, v) => { const e = c.querySelector('.about-spec-v'); if (e) e.textContent = v } },
]

const ABOUT_SOCIAL_FIELDS: FieldDef[] = [
  { key: 'label', label: 'Nombre',
    get: (c) => txt(c.querySelector('.about-social-label')),
    set: (c, v) => { const e = c.querySelector('.about-social-label'); if (e) e.textContent = v } },
  { key: 'url', label: 'URL',
    get: (c) => c.querySelector('a')?.getAttribute('href') || '',
    set: (c, v) => { const a = c.querySelector('a'); if (a) a.setAttribute('href', v) } },
]

// ----- Registro de editables (selectores adaptados al markup Next) ----------

type RegistryEntry = {
  base: string
  sel: string
  kind: 'text' | 'image' | 'video'
  accept?: string
  mount: 'self' | 'parent' | 'none'
  section: string
  container?: string
  fields?: FieldDef[]
  label: string | ((el: Element, i: number) => string)
}

const REGISTRY: RegistryEntry[] = [
  // Página de carga (loader del index — el video de galope se sube por CMS)
  { base: 'loader.gallop', sel: '.loader-gallop', kind: 'video', accept: 'webm', mount: 'parent', section: 'Página de carga', label: 'Video del loader — Página de carga' },
  // Portada
  { base: 'hero-main.slide', sel: '.hero-main-carousel-slide', kind: 'image', accept: 'webp', mount: 'none', section: 'Portada (Principal)', label: (el, i) => `Imagen Carrusel Principal #${i + 1}` },
  { base: 'hero-sub.slide', sel: '.hero-sub-carousel-slide', kind: 'image', accept: 'webp', mount: 'none', section: 'Portada (Secundario)', label: (el, i) => `Imagen Carrusel Secundario #${i + 1}` },
  { base: 'hero.marquee', sel: '.hero-software-wave .wave-item', kind: 'image', accept: 'webp,png,svg', mount: 'self', section: 'Portada', fields: WAVE_FIELDS, label: (el, i) => `Herramienta Wave #${(i % 11) + 1}` },
  { base: 'hero.subtitle', sel: '.hero-subtitle', kind: 'text', mount: 'self', section: 'Portada', label: 'Bajada (debajo del título) — Portada' },
  // Production Stack
  { base: 'soft.global', sel: '.global-soft-icons .soft-item', kind: 'image', accept: 'webp', mount: 'self', section: 'Animaciones', label: (el, i) => `Logo Stack Animaciones #${i + 1}` },
  // Animaciones de fondo
  { base: 'anim.bg', sel: '.decor-motion .decor-video', kind: 'video', accept: 'webm', mount: 'parent', section: 'Animaciones', label: (el, i) => `Video Fondo Animaciones #${i + 1}` },
  // Sobre mí
  { base: 'about.title', sel: 'h2[data-i18n="about_title"]', kind: 'text', mount: 'self', section: 'Sobre mí', label: 'Título — Sobre mí' },
  { base: 'about.lede', sel: '.about-lede', kind: 'text', mount: 'self', section: 'Sobre mí', label: 'Bajada (debajo del título) — Sobre mí' },
  { base: 'about.desc', sel: '.bio-content', kind: 'text', mount: 'self', section: 'Sobre mí', label: 'Biografía — Sobre mí' },
  { base: 'about.spec', sel: '.about-spec', kind: 'text', mount: 'self', section: 'Sobre mí', fields: ABOUT_SPEC_FIELDS, label: (el, i) => `Spec #${i + 1} — Sobre mí` },
  { base: 'about.social', sel: '.about-social', kind: 'text', mount: 'self', section: 'Sobre mí', fields: ABOUT_SOCIAL_FIELDS, label: (el, i) => `Red social #${i + 1} — Sobre mí` },
  { base: 'about.photo', sel: '.artist-photo-img', kind: 'image', accept: 'webp', mount: 'parent', section: 'Sobre mí', label: 'Foto de Lucía — Sobre mí' },
  { base: 'about.video', sel: '.about-video', kind: 'video', accept: 'webm', mount: 'parent', section: 'Sobre mí', label: 'Video / Animación — Sobre mí' },
  // Subtítulos de sección
  { base: 'subtitle', sel: '.section-title p', kind: 'text', mount: 'self', section: 'Subtítulos', label: (el) => {
    const sec = el.closest('section')
    const h = sec && sec.querySelector<HTMLElement>('.section-typewriter')
    return 'Subtítulo — ' + (h ? (h.dataset.text || h.textContent || '').trim() : 'sección')
  } },
  // Characters (sección nueva — paneles con scroll horizontal, dinámica vía CMS)
  { base: 'char.title', sel: '.ch-showcase__title', kind: 'text', mount: 'self', section: 'Characters', label: 'Título de sección — Characters' },
  { base: 'char.sectiondesc', sel: '.ch-showcase__desc', kind: 'text', mount: 'self', section: 'Characters', label: 'Descripción — Characters' },
  { base: 'char.soft', sel: '.char-soft-icon', kind: 'image', accept: 'webp,png,svg', mount: 'self', section: 'Characters', label: (el, i) => `Logo de software #${i + 1}` },
  { base: 'char.softname', sel: '.char-soft-name', kind: 'text', mount: 'self', section: 'Characters', label: (el, i) => `Nombre de software #${i + 1}` },
  // Retrato del personaje: la key explícita (char#i) la fija el componente; el
  // motor la respeta. Campos (nombre/rol/desc) viven en el contenedor .ch-panel.
  { base: 'char', sel: '.ch-panel .ch-portrait', kind: 'image', accept: 'webp', mount: 'parent', section: 'Characters', container: '.ch-panel', fields: CHARACTER_FIELDS, label: (el, i) => `Personaje #${i + 1}` },
  // Concepts del personaje: key explícita (char#i::cM) fijada por el componente;
  // host de edición/overlay = la celda contenedora (.ch-concept-cell).
  { base: 'char.concept', sel: '.ch-panel .ch-concept', kind: 'image', accept: 'webp', mount: 'parent', section: 'Characters', label: () => 'Concept' },
  // Illustrations (sección nueva — contenedores fijos en .illu-masonry)
  { base: 'illustration', sel: '.illu-masonry .illu-cell__img', kind: 'image', accept: 'webp', mount: 'parent', section: 'Ilustraciones', container: '.illu-cell', fields: ILLU_FIELDS, label: (el, i) => `Ilustración #${i + 1}` },
  // Animations
  { base: 'anim.title', sel: '.anim-showcase__title', kind: 'text', mount: 'self', section: 'Animations', label: 'Título de sección — Animations' },
  { base: 'anim.desc', sel: '.anim-showcase__desc', kind: 'text', mount: 'self', section: 'Animations', label: 'Descripción — Animations' },
  { base: 'anim.soft', sel: '.anim-soft-icon', kind: 'image', accept: 'webp,png,svg', mount: 'self', section: 'Animations', label: (el, i) => `Logo de software #${i + 1}` },
  { base: 'anim.softname', sel: '.anim-soft-name', kind: 'text', mount: 'self', section: 'Animations', label: (el, i) => `Nombre de software #${i + 1}` },
  { base: 'anim', sel: '.animations-grid .anim-video', kind: 'video', accept: 'webm', mount: 'parent', section: 'Animations', container: '.animation-item', fields: ANIM_FIELDS, label: (el, i) => `Animación #${i + 1}` },
  // Projects (carrusel horizontal entre Animations y Character Design)
  { base: 'proj.title', sel: '.proj-showcase__title', kind: 'text', mount: 'self', section: 'Proyectos', label: 'Título de sección — Proyectos' },
  { base: 'proj.desc', sel: '.proj-showcase__desc', kind: 'text', mount: 'self', section: 'Proyectos', label: 'Descripción — Proyectos' },
  { base: 'proj.soft', sel: '.proj-soft-icon', kind: 'image', accept: 'webp,png,svg', mount: 'self', section: 'Proyectos', label: (el, i) => `Logo de software #${i + 1}` },
  { base: 'proj.softname', sel: '.proj-soft-name', kind: 'text', mount: 'self', section: 'Proyectos', label: (el, i) => `Nombre de software #${i + 1}` },
  { base: 'proj', sel: '.proj-showcase .proj-card-img', kind: 'image', accept: 'webp', mount: 'parent', section: 'Proyectos', container: '.project-item', fields: PROJECT_FIELDS, label: (el, i) => `Proyecto #${i + 1}` },
  // 3D Models (selectores → markup .m3d- de ModelsShowcase.tsx; bases conservadas)
  { base: 'model3d.soft', sel: '.model3d-soft-icon', kind: 'image', accept: 'webp,png,svg', mount: 'self', section: '3D Models', label: (el, i) => `Logo de software #${i + 1}` },
  { base: 'model3d.softname', sel: '.model3d-soft-name', kind: 'text', mount: 'self', section: '3D Models', label: (el, i) => `Nombre de software #${i + 1}` },
  { base: 'model3d.heading', sel: '.m3d-showcase__title', kind: 'text', mount: 'self', section: '3D Models', label: 'Nombre de la sección — 3D' },
  { base: 'model3d.intro', sel: '.m3d-showcase__desc', kind: 'text', mount: 'self', section: '3D Models', label: 'Texto introductorio — 3D' },
  { base: 'model3d.title', sel: '.m3d-text__title', kind: 'text', mount: 'self', section: '3D Models', label: (el, i) => `Título bloque #${i + 1} — 3D` },
  { base: 'model3d.desc', sel: '.m3d-text__body', kind: 'text', mount: 'self', section: '3D Models', label: (el, i) => `Texto bloque #${i + 1} — 3D` },
  { base: 'model3d', sel: '.m3d-slide .m3d-video', kind: 'video', accept: 'webm', mount: 'parent', section: '3D Models', label: (el, i) => `Video 3D #${i + 1}` },
  { base: 'model3d.gallery', sel: '.m3d-gallery__img', kind: 'image', accept: 'webp', mount: 'parent', section: '3D Models', label: (el, i) => `Imagen 3D #${i + 1}` },
]

// ----- Índices del motor ------------------------------------------------------

export type Meta = {
  label: string
  section: string
  kind: 'text' | 'image' | 'video'
  accept?: string
  fields?: FieldDef[]
  container?: string
  mount: 'self' | 'parent' | 'none'
}

export const elementsByKey: Record<string, HTMLElement> = {}
export const typeByKey: Record<string, 'text' | 'media'> = {}
export const metaByKey: Record<string, Meta> = {}
const fieldSetters: Record<string, (v: string) => void> = {}

let dispatch: Dispatch = () => {}
export function setDispatch(d: Dispatch) { dispatch = d }

const resolveLabel = (entry: RegistryEntry, el: Element, i: number) =>
  typeof entry.label === 'function' ? entry.label(el, i) : entry.label

export function indexEditables() {
  REGISTRY.forEach((entry) => {
    document.querySelectorAll<HTMLElement>(entry.sel).forEach((el, i) => {
      let key = el.getAttribute('data-cms-key')
      if (!key) {
        key = entry.base + '#' + i
        el.setAttribute('data-cms-key', key)
      }
      if (elementsByKey[key]) return // ya indexado en esta sesión

      elementsByKey[key] = el
      typeByKey[key] = entry.kind === 'text' ? 'text' : 'media'
      metaByKey[key] = {
        label: state.containerNames[key] || resolveLabel(entry, el, i),
        section: entry.section,
        kind: entry.kind,
        accept: entry.accept,
        fields: entry.fields,
        container: entry.container,
        mount: entry.mount,
      }
      if (entry.fields) {
        const cont = entry.container ? el.closest<HTMLElement>(entry.container) : el
        entry.fields.forEach((f) => {
          fieldSetters[key + '::' + f.key] = (v: string) => { if (cont) f.set(cont, v) }
        })
      }
    })
  })
}

// ----- Aplicar valores ---------------------------------------------------------

export function currentSrcOf(el: HTMLElement | null): string {
  if (!el) return ''
  if (el.tagName === 'IMG') return (el as HTMLImageElement).src
  if (el.tagName === 'VIDEO') {
    const s = el.querySelector('source')
    return s ? s.src : (el as HTMLVideoElement).src
  }
  // Wave items: read from the .wave-icon-slot child
  if (el.classList.contains('wave-item')) {
    const slot = el.querySelector<HTMLElement>('.wave-icon-slot')
    if (slot) {
      const bg = slot.style.backgroundImage || ''
      const m = bg.match(/url\(["']?(.*?)["']?\)/)
      return m ? m[1] : ''
    }
    return ''
  }
  if (el.getAttribute('data-full')) return el.getAttribute('data-full') || ''
  const bg = el.style.backgroundImage || ''
  const m = bg.match(/url\(["']?(.*?)["']?\)/)
  return m ? m[1] : ''
}

function applyValue(el: HTMLElement, type: string, value: string) {
  if (value == null) return
  if (type === 'text') {
    const keep = el.querySelector(':scope > .cms-tools')
    el.textContent = value
    if (keep) el.appendChild(keep)
  } else if (type === 'image' && el.tagName === 'IMG') {
    el.removeAttribute('srcset')
    ;(el as HTMLImageElement).src = value
  } else if (type === 'bg' || type === 'image') {
    if (el.classList.contains('soft-item')) {
      // ocultar el badge y meter un <img> como ícono custom (port L329)
      Array.from(el.children).forEach((c) => {
        if (c.classList.contains('soft-badge') || c.classList.contains('soft-name') || c.tagName === 'I' || c.tagName === 'svg') {
          (c as HTMLElement).style.display = 'none'
        }
      })
      let img = el.querySelector<HTMLImageElement>('img.cms-custom-icon')
      if (!img) {
        img = document.createElement('img')
        img.className = 'cms-custom-icon'
        img.style.height = '2.8rem'
        img.style.objectFit = 'contain'
        el.insertBefore(img, el.firstChild)
      }
      img.src = value
    } else {
      el.style.backgroundImage = `url("${value}")`
    }
    if (el.hasAttribute('data-full')) el.setAttribute('data-full', value)
  } else if (type === 'video') {
    const s = el.querySelector('source')
    if (s) {
      if (value) s.src = value
      else s.removeAttribute('src')
    } else {
      if (value) (el as HTMLVideoElement).src = value
      else el.removeAttribute('src')
    }
    try {
      const v = el as HTMLVideoElement
      v.load()
      if (value) v.play().catch(() => {})
    } catch {}
  }
}

// Las slides del carrusel (hero.slide#i) no tienen elemento DOM propio
// (el slideshow se hidrata por evento), así que no se indexan vía REGISTRY.
// Crea una meta sintética para que los pickers (que hacen `if(!meta) return null`)
// puedan asignarles imagen.
export function ensureSlideMeta(key: string) {
  if (metaByKey[key]) return
  const m = key.match(/^(.+)\.slide#(\d+)$/)
  if (!m) return
  metaByKey[key] = {
    label: state.containerNames[key] || `Imagen del carrusel #${Number(m[2]) + 1}`,
    section: 'Portada',
    kind: 'image',
    accept: 'webp',
    mount: 'none',
  }
  typeByKey[key] = 'media'
}

export function ensureProjectMeta(key: string) {
  if (metaByKey[key]) return
  const m = key.match(/^proj#(\d+)$/)
  if (!m && !key.startsWith('proj#new')) return
  const n = m ? Number(m[1]) + 1 : 'Nuevo'
  metaByKey[key] = {
    label: state.containerNames[key] || `Proyecto #${n}`,
    section: 'Proyectos',
    kind: 'image',
    accept: 'webp',
    mount: 'none',
    fields: PROJECT_FIELDS,
  }
  typeByKey[key] = 'media'
}

// Meta sintética para los contenedores dinámicos de Characters: el retrato
// (char#i / char#new_*) lleva los campos de ficha; los concepts (…::cM) son
// media simple. El CharactersManager los crea on-demand antes de abrir el picker.
export function ensureCharacterMeta(key: string) {
  if (metaByKey[key]) return
  const concept = key.match(/^char#(?:new_)?\w+::c(\d+)$/)
  if (concept) {
    metaByKey[key] = {
      label: state.containerNames[key] || `Concept #${Number(concept[1]) + 1}`,
      section: 'Characters', kind: 'image', accept: 'webp', mount: 'none',
    }
    typeByKey[key] = 'media'
    return
  }
  if (!/^char#(?:new_)?\w+$/.test(key)) return
  const m = key.match(/^char#(\d+)$/)
  const n = m ? Number(m[1]) + 1 : 'Nuevo'
  metaByKey[key] = {
    label: state.containerNames[key] || `Personaje #${n}`,
    section: 'Characters', kind: 'image', accept: 'webp', mount: 'none', fields: CHARACTER_FIELDS,
  }
  typeByKey[key] = 'media'
}

// Re-emite el evento del carrusel para que el slideshow (Slideshow.tsx) se
// actualice en vivo tras asignar/quitar una slide (no hay elemento DOM por
// slide; el slideshow se hidrata desde state.items vía este evento).
export function broadcastCarousel(prefix: string) {
  let settings = { count: 3, duration: 7000 }
  try { settings = Object.assign(settings, JSON.parse(state.items[`${prefix}.settings`] || '')) } catch {}
  // count puede ser 0 (carrusel limpiado): respetarlo. `|| 3` lo trataría como
  // "usar 3" → reaparecerían slides/defaults tras limpiar.
  const count = Number.isFinite(settings.count) ? Math.max(0, settings.count) : 3
  const slides: string[] = []
  for (let i = 0; i < count; i++) slides.push(state.items[`${prefix}.slide#${i}`] || '')
  window.dispatchEvent(new CustomEvent(`cms:${prefix}`, { detail: { slides, duration: settings.duration || 7000 } }))
}

export function applyMedia(key: string, value: string) {
  // Slides del carrusel: no tienen elemento propio → actualizar vía evento.
  const slideMatch = key.match(/^(.+)\.slide#\d+$/)
  if (slideMatch) { broadcastCarousel(slideMatch[1]); return }

  // Galería 3D (cinta): mismo data-cms-key en las 2 copias → actualizar todas
  // las instancias (la copia clon mantiene el loop seamless con contenido).
  if (key.startsWith('model3d.gallery#')) {
    document.querySelectorAll<HTMLImageElement>(`img[data-cms-key="${key}"]`).forEach((img) => {
      if (value) { img.removeAttribute('srcset'); img.src = value }
      else img.removeAttribute('src')
    })
    return
  }

  // Wave items: update ALL instances in the DOM for infinite scroll clones
  if (key.startsWith('hero.marquee#')) {
    document.querySelectorAll<HTMLElement>(`[data-cms-key="${key}"]`).forEach(el => {
      const slot = el.querySelector<HTMLElement>('.wave-icon-slot')
      if (slot) slot.style.backgroundImage = value ? `url("${value}")` : ''
      if (value) el.classList.add('wave-has-content')
      else el.classList.remove('wave-has-content')
    })
    return
  }

  const el = elementsByKey[key]
  if (!el) return
  if (el.tagName === 'IMG') applyValue(el, 'image', value)
  else if (el.tagName === 'VIDEO') applyValue(el, 'video', value)
  else applyValue(el, 'bg', value)
}

export function applyStored(key: string, value: string) {
  if (fieldSetters[key]) { fieldSetters[key](value); return }
  const el = elementsByKey[key]
  if (!el) return
  if (typeByKey[key] === 'text') applyValue(el, 'text', value)
  else applyMedia(key, value)
}

export function hydrate() {
  // Auto-sanitización: si un elemento fue retirado por el botón individual viejo,
  // puede que su URL haya quedado como "fantasma" en state.items. Lo limpiamos.
  state.retired.forEach(key => {
    if (state.items[key]) {
      delete state.items[key]
      Object.keys(state.items).forEach(k => {
        if (k.startsWith(key + '::')) delete state.items[k]
      })
    }
  })
  
  Object.keys(state.items).forEach((key) => applyStored(key, state.items[key]))
}

// ----- Idioma (i18n) ----------------------------------------------------------

/** Claves de texto conocidas: campos (key::campo) + contenedores de texto. */
function textKeys(extra: Record<string, string>): Set<string> {
  const keys = new Set<string>()
  Object.keys(state.items).forEach((k) => {
    if (fieldSetters[k] || typeByKey[k] === 'text') keys.add(k)
  })
  Object.keys(extra).forEach((k) => keys.add(k))
  return keys
}

/* Aplica un idioma a todo el texto del DOM. base (es) restaura state.items;
   un idioma destino usa su traducción y cae al base cuando falta la clave.
   No toca media. Persiste la elección y notifica a los suscriptores. */
export function setLanguage(lang: Lang) {
  const dict = lang === BASE_LANG ? state.items : (state.translations[lang] || {})
  textKeys(dict).forEach((key) => {
    const value = lang === BASE_LANG
      ? state.items[key]
      : (dict[key] != null ? dict[key] : state.items[key])
    if (value != null) applyStored(key, value)
  })
  state.lang = lang
  persistLang()
  emit()
}

// Clona el contenido del primer wave-group a los duplicados (port syncWaveGroups)
export function syncWaveGroups() {
  // Obsoleto: WaveMarquee.tsx ahora renderiza todos los clones de forma idéntica en React.
  // applyMedia actualiza todos los duplicados en vivo.
}

// ----- Campos de info -----------------------------------------------------------

export function computeFields(key: string, el: HTMLElement, meta: Meta): FieldValue[] | null {
  if (!meta.fields) return null
  const cont = meta.container ? el.closest<HTMLElement>(meta.container) : el
  return meta.fields.map((f) => {
    const compositeKey = key + '::' + f.key
    const val = state.items[compositeKey] != null ? state.items[compositeKey] : (cont ? f.get(cont) : '')
    return { key: f.key, label: f.label, textarea: !!f.textarea, value: val || '' }
  })
}

// Registra como "usado" cada media indexada que aún no esté (port seedUsedContent)
export function seedUsedContent() {
  let changed = false
  Object.keys(elementsByKey).forEach((key) => {
    if (typeByKey[key] !== 'media') return
    if (state.retired.includes(key)) return
    const el = elementsByKey[key]
    const meta = metaByKey[key]
    const src = currentSrcOf(el)
    if (state.usedContent[key]) {
      // Contenedor vacío marcado por error como "usado" (seed sin contenido):
      // purgar para que no contamine el repositorio ni se evacúe a "sin usar".
      if (!state.usedContent[key].src && !src) {
        delete state.usedContent[key]
        changed = true
        return
      }
      if (meta.fields && !state.usedContent[key].fields) {
        state.usedContent[key].fields = computeFields(key, el, meta)
        changed = true
      }
      return
    }
    if (!src) return // contenedor vacío: no es contenido usado, no sembrar
    let name = basename(src), size: number | null = null, original = true
    const mm = state.mediaMeta[key]
    if (mm) { name = mm.name; size = mm.size; original = false }
    state.usedContent[key] = {
      key, label: meta.label, section: meta.section,
      kind: meta.kind as 'image' | 'video', src, name, size, original,
      fields: computeFields(key, el, meta),
    }
    changed = true
  })
  if (changed) { persistUsed(); emit() }
}

// ----- Slots retirados / vacíos ---------------------------------------------------

function isIconSlot(el: HTMLElement) {
  return el.classList.contains('soft-item') || el.classList.contains('carousel-slide')
}

function visualHosts(key: string): HTMLElement[] {
  if (key.startsWith('hero.marquee#')) {
    const els = Array.from(document.querySelectorAll<HTMLElement>(`[data-cms-key="${key}"]`))
    return els.length > 0 ? els : []
  }
  // Galería 3D: todas las copias de la celda (overlay vacío en cada instancia).
  if (key.startsWith('model3d.gallery#')) {
    return Array.from(document.querySelectorAll<HTMLElement>(`img[data-cms-key="${key}"]`))
      .map((img) => img.closest<HTMLElement>('.m3d-gallery-cell') || img.parentElement)
      .filter((e): e is HTMLElement => !!e)
  }
  const el = elementsByKey[key]
  if (!el) return []
  if (el.classList.contains('wave-item')) return [el]
  if (isIconSlot(el)) return [el.closest('a') || el]
  return [el.closest<HTMLElement>('.illu-cell, .animation-item, .model-video-card, .m3d-slide') || el.parentElement || el]
}

export function showEmptySlot(key: string) {
  visualHosts(key).forEach((h) => {
    h.classList.add('cms-empty-slot')
    h.classList.remove('wave-has-content')
    if (!h.querySelector('.cms-empty-overlay')) {
      const meta = metaByKey[key]
      const ov = document.createElement('div')
      ov.className = 'cms-empty-overlay'
      ov.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i><span></span>'
      ov.querySelector('span')!.textContent = meta ? meta.label : 'Asignar contenido'
      ov.title = 'Subir o asignar contenido aquí'
      ov.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!state.isAdmin) return // visitante: el contenedor es solo visual
        dispatch({ type: 'contentPicker', key })
      })
      h.appendChild(ov)
    }
  })
}

export function clearEmptySlot(key: string) {
  visualHosts(key).forEach((h) => {
    h.classList.remove('cms-empty-slot')
    h.querySelector('.cms-empty-overlay')?.remove()
  })
}

export function refreshRetired() {
  document.querySelectorAll('.cms-retired').forEach((e) => e.classList.remove('cms-retired'))
  document.querySelectorAll('.cms-empty-slot').forEach((e) => e.classList.remove('cms-empty-slot'))
  document.querySelectorAll('.cms-empty-overlay').forEach((e) => e.remove())
  
  // Retirados: mismo marco vacío para admin Y visitante (el contenedor nunca
  // desaparece de la página; CSS ya oculta icono/nombre/click al visitante).
  state.retired.forEach((key) => {
    visualHosts(key).forEach(() => showEmptySlot(key))
  })

  // Slots de media vacíos (sin contenido y no retirados) → marco genérico.
  // Se muestra para TODOS (admin y visitante): el contenedor punteado se mantiene
  // siempre; el icono + nombre + click solo se ven en admin (CSS los oculta para
  // el visitante). Excluye texto y los carruseles (mount 'none', gestionados aparte).
  Object.keys(elementsByKey).forEach((key) => {
    const m = metaByKey[key]
    if (!m || m.kind === 'text' || m.mount === 'none') return
    if (!state.items[key] && !state.retired.includes(key)) showEmptySlot(key)
  })
}

// Mueve un contenido usado a "no usados" desde el sitio (port moveToUnused)
export function moveToUnusedSite(key: string) {
  let entry = state.usedContent[key]
  if (!entry) {
    const el = elementsByKey[key]
    const meta = metaByKey[key]
    if (!meta) return
    const s = currentSrcOf(el)
    entry = {
      key, label: meta.label, section: meta.section, kind: meta.kind as 'image' | 'video',
      src: s, name: basename(s), size: null, original: true,
    }
  }
  state.unused.push({
    key, src: entry.src, dataUrl: entry.src, name: entry.name, size: entry.size,
    type: entry.kind === 'video' ? 'video/webm' : 'image/webp', ts: Date.now(),
    label: entry.label, section: entry.section, original: entry.original, reason: 'retired',
  })
  delete state.usedContent[key]
  delete state.items[key]
  applyMedia(key, '')
  // Limpiar campos asociados
  Object.keys(state.items).forEach(k => {
    if (k.startsWith(key + '::')) {
      delete state.items[k]
      if (fieldSetters[k]) fieldSetters[k]('')
    }
  })
  if (!state.retired.includes(key)) state.retired.push(key)
  persistUnused(); persistUsed(); persistRetired()
  showEmptySlot(key)
  refreshTools(key)
  recordAudit({ section: entry.section, label: entry.label, kind: 'gestión', summary: 'Contenido movido a no usados' })
}

// Elimina una tarjeta de proyecto del carrusel: archiva su imagen a "no usados"
// (el contenido se conserva, recuperable), reindexa los proyectos siguientes
// (proj#i+1 → proj#i), decrementa proj.settings.count y persiste. A diferencia de
// moveToUnusedSite (que solo vacía el slot dejando la tarjeta), esto QUITA la tarjeta.
export async function deleteProjectSite(key: string) {
  if (!state.isAdmin) return
  const m = key.match(/^proj#(\d+)$/)
  if (!m) return
  const delIdx = Number(m[1])

  let count = 0
  try { count = JSON.parse(state.items['proj.settings'] || '').count || 0 } catch {}
  if (!count) return

  // Archiva la imagen del proyecto borrado (si tiene contenido) a "no usados".
  if (state.items[key]) archiveMediaKey(key)

  // Backup de todas las claves proj#N (+ campos) y limpieza del estado actual.
  const oldData: Record<string, string> = {}
  Object.keys(state.items).forEach((k) => { if (/^proj#\d+(::|$)/.test(k)) oldData[k] = state.items[k] })
  Object.keys(oldData).forEach((k) => { delete state.items[k] })

  // Reconstruye saltando delIdx: los siguientes bajan una posición.
  const payload: Record<string, string> = {}
  Object.keys(oldData).forEach((k) => { payload[k] = '' }) // limpia en DB todo lo viejo (upsert no borra)
  let newIdx = 0
  for (let i = 0; i < count; i++) {
    if (i === delIdx) continue
    const ov = oldData[`proj#${i}`] ?? ''
    state.items[`proj#${newIdx}`] = ov
    payload[`proj#${newIdx}`] = ov
    const pre = `proj#${i}::`
    Object.keys(oldData).forEach((ok) => {
      if (ok.startsWith(pre)) {
        const dst = `proj#${newIdx}::${ok.slice(pre.length)}`
        state.items[dst] = oldData[ok]
        payload[dst] = oldData[ok]
      }
    })
    newIdx++
  }

  const newCount = newIdx
  state.items['proj.settings'] = JSON.stringify({ count: newCount })
  payload['proj.settings'] = state.items['proj.settings']

  // Los índices proj# se reusan al reindexar → no dejar entradas retired stale
  // (marcarían slots vacíos por error).
  state.retired = state.retired.filter((k) => !/^proj#\d+/.test(k))

  persistOverridesLocal()
  persistUnused(); persistUsed(); persistRetired()
  emit()
  setTimeout(() => rescan(), 100)
  await saveContent(payload).catch(() => {})
}

// Archiva a "no usados" un media key, armando el entry desde usedContent o DOM/meta.
function archiveMediaKey(key: string) {
  let entry = state.usedContent[key]
  if (!entry) {
    const el = elementsByKey[key]
    const meta = metaByKey[key]
    const src = state.items[key] || currentSrcOf(el)
    if (!src || !meta) return // contenedor ya vacío: nada que archivar
    const label = meta?.label || state.containerNames[key] || key
    const section = meta?.section || 'Otros'
    const kind: 'image' | 'video' = meta?.kind === 'video' ? 'video' : 'image'
    entry = { key, label, section, kind, src, name: basename(src), size: null, original: true }
  }
  state.unused.push({
    key, src: entry.src, dataUrl: entry.src, name: entry.name, size: entry.size,
    type: entry.kind === 'video' ? 'video/webm' : 'image/webp', ts: Date.now(),
    label: entry.label, section: entry.section, original: entry.original, reason: 'retired',
  })
  delete state.usedContent[key]
  if (!state.retired.includes(key)) state.retired.push(key)
}

// Mueve a "no usados" cada media key dada, dejando el contenedor vacío. Núcleo
// compartido por "Clear All" y "Clear current section". El texto NO se toca.
// Claves borradas → se envían a la DB como '' (POST /api/content es upsert, no
// borra) para que el contenido no reaparezca al recargar / en otro navegador.
function clearKeys(keys: Iterable<string>, forceCarousels: string[] = []) {
  const cleared: Record<string, string> = {}
  const carouselPrefixes = new Set<string>(forceCarousels)

  for (const key of keys) {
    if (key.includes('::')) continue          // campos de texto compuestos
    if (typeByKey[key] === 'text') continue   // texto: no va a "no usados"
    if (key.endsWith('.settings')) continue   // settings de carrusel: conservar

    const slideMatch = key.match(/^(.+)\.slide#\d+$/)
    if (slideMatch) {
      archiveMediaKey(key)
      delete state.items[key]
      cleared[key] = ''
      carouselPrefixes.add(slideMatch[1])
      continue
    }

    archiveMediaKey(key)
    delete state.items[key]
    cleared[key] = ''
    applyMedia(key, '')   // limpia el src/bg real del DOM (img/video/wave)
    // Limpiar campos asociados al contenedor principal
    Object.keys(state.items).forEach(k => {
      if (k.startsWith(key + '::')) {
        delete state.items[k]
        cleared[k] = ''
        if (fieldSetters[k]) fieldSetters[k]('')
      }
    })
    showEmptySlot(key)
    refreshTools(key)
  }

  // Reset de cada carrusel a su estado "cero": borra contenidos Y diapositivas
  // (count:0). Único momento sin imágenes. Display resultante: principal/secundario
  // → 1 contenedor vacío (HeroMediaCarousel colapsa a [''] ); fondo → blanco.
  carouselPrefixes.forEach((p) => {
    let duration = 7000
    try { duration = JSON.parse(state.items[`${p}.settings`] || '').duration || 7000 } catch {}
    const slideRe = new RegExp(`^${p}\\.slide#\\d+$`)
    Object.keys(state.items).forEach((k) => {
      if (slideRe.test(k)) { delete state.items[k]; cleared[k] = '' }
    })
    state.items[`${p}.settings`] = JSON.stringify({ count: 0, duration })
    cleared[`${p}.settings`] = state.items[`${p}.settings`]
    broadcastCarousel(p)
  })
  persistUsed(); persistUnused(); persistRetired(); persistOverridesLocal()
  emit()
  if (Object.keys(cleared).length) saveContent(cleared).catch(() => {})
}

// Reúne todas las media keys con contenido (state, usados, o src en el DOM).
function allMediaKeys(): Set<string> {
  const keys = new Set<string>([...Object.keys(state.items), ...Object.keys(state.usedContent)])
  Object.keys(elementsByKey).forEach((k) => {
    if (typeByKey[k] === 'media' && currentSrcOf(elementsByKey[k])) keys.add(k)
  })
  return keys
}

// Limpia TODO el contenido de media del sitio → lo mueve a "no usados", dejando
// solo los contenedores vacíos. Cubre media indexada, carruseles y burbujas wave.
export function clearAllSite() {
  if (!state.isAdmin) return
  // Fuerza el reset de los carruseles de portada aunque no tengan contenido CMS
  // (ej. el fondo mostrando los DEFAULT_SLIDES) → "limpiar todo" siempre los vacía.
  clearKeys(allMediaKeys(), ['hero', 'hero-main', 'hero-sub'])
}

// ----- Limpieza por sección (sección en viewport) --------------------------------

// <section> con mayor área visible en el viewport actual.
export function currentSectionEl(): HTMLElement | null {
  const vh = window.innerHeight
  let best: HTMLElement | null = null, bestArea = 0
  document.querySelectorAll<HTMLElement>('section').forEach((s) => {
    const r = s.getBoundingClientRect()
    const vis = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0))
    if (vis > bestArea) { bestArea = vis; best = s }
  })
  return best
}

// ¿La key (su host DOM) vive dentro de sectionEl? Los slides de carrusel no
// tienen elemento propio → se ubican por el contenedor `.{prefix}-carousel`.
function keyInSection(key: string, sectionEl: HTMLElement): boolean {
  const slide = key.match(/^(.+)\.slide#\d+$/)
  if (slide) {
    const prefix = slide[1]
    // El fondo (prefix 'hero') vive fuera de <section> → pertenece a la portada.
    if (prefix === 'hero') return sectionEl.classList.contains('hero')
    // Principal/secundario: sus slides (.{prefix}-carousel-slide) viven dentro
    // del <section> de la portada.
    const host = document.querySelector<HTMLElement>(`.${prefix}-carousel-slide`)
    return !!host && sectionEl.contains(host)
  }
  const el = elementsByKey[key]
  return !!el && sectionEl.contains(el)
}

// Info de la sección actual para el diálogo de confirmación (sin mutar): label
// legible (meta.section dominante) + keys de media a limpiar.
export function currentSectionInfo(): { label: string; keys: string[]; count: number } {
  const sec = currentSectionEl()
  if (!sec) return { label: '', keys: [], count: 0 }
  // Solo keys CON contenido real (evita contar/limpiar contenedores ya vacíos).
  const hasContent = (k: string) =>
    !!state.items[k] || !!state.usedContent[k]?.src || !!(elementsByKey[k] && currentSrcOf(elementsByKey[k]))
  const keys = [...allMediaKeys()].filter((k) =>
    !k.includes('::') && typeByKey[k] !== 'text' && !k.endsWith('.settings') &&
    hasContent(k) && keyInSection(k, sec))
  const counts: Record<string, number> = {}
  keys.forEach((k) => { const s = metaByKey[k]?.section; if (s) counts[s] = (counts[s] || 0) + 1 })
  const label = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || ''
  return { label, keys, count: keys.length }
}

// Limpia las keys dadas (capturadas en currentSectionInfo al abrir el confirm).
export function clearSectionKeys(keys: string[]) {
  if (!state.isAdmin || !keys.length) return
  clearKeys(keys)
}

// ----- Overlay de edición (tuercas/lápices) -----------------------------------------

function ensurePositioned(el: HTMLElement) {
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative'
}

function toolBtn(icon: string, title: string, extra: string, onClick: () => void) {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'cms-edit-btn cms-tool-btn' + (extra ? ' ' + extra : '')
  const i = document.createElement('i')
  i.classList.add('fa-solid', icon)
  b.appendChild(i)
  b.title = title
  b.setAttribute('aria-label', title)
  b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onClick() })
  return b
}

function makeTools(key: string) {
  const meta = metaByKey[key]
  const tools = document.createElement('div')
  tools.className = 'cms-tools'
  if (meta.kind === 'text') {
    if (meta.fields) tools.appendChild(toolBtn('fa-pen', 'Editar: ' + meta.label, 'cms-tool-edit', () => dispatch({ type: 'editInfo', key })))
    else tools.appendChild(toolBtn('fa-pen', 'Editar: ' + meta.label, 'cms-tool-edit', () => dispatch({ type: 'editText', key })))
    return tools
  }
  const hasContent = !!state.items[key]
  const isProject = /^proj#\d+$/.test(key)
  if (hasContent && meta.fields) tools.appendChild(toolBtn('fa-pen', 'Editar información: ' + meta.label, 'cms-tool-edit', () => dispatch({ type: 'editInfo', key })))
  tools.appendChild(toolBtn('fa-arrow-up-from-bracket', hasContent ? 'Reemplazar: ' + meta.label : 'Subir contenido: ' + meta.label, 'cms-tool-replace', () => dispatch({ type: 'contentPicker', key })))
  // Proyectos: papelera que ELIMINA la tarjeta (archivando su imagen a no usados).
  // Resto: archivar a no usados (vacía el slot, conserva la tarjeta).
  if (isProject) tools.appendChild(toolBtn('fa-trash', 'Eliminar tarjeta: ' + meta.label, 'cms-tool-move', () => dispatch({ type: 'confirmMove', key })))
  else if (hasContent) tools.appendChild(toolBtn('fa-box-archive', 'Mover a no usados: ' + meta.label, 'cms-tool-move', () => dispatch({ type: 'confirmMove', key })))
  return tools
}

export function attachEditControls() {
  REGISTRY.forEach((entry) => {
    document.querySelectorAll<HTMLElement>(entry.sel).forEach((el) => {
      const key = el.getAttribute('data-cms-key')
      if (!key) return
      
      // Ensure empty wave slots always get the upload button overlay
      if (key.startsWith('hero.marquee#') && !state.items[key]) {
        showEmptySlot(key)
      }

      if (el.getAttribute('data-cms-has-btn') === '1') return
      if (entry.mount === 'none') { el.setAttribute('data-cms-has-btn', '1'); return }
      const host = entry.mount === 'parent' && el.parentElement ? el.parentElement : el
      host.classList.add('cms-mount')
      ensurePositioned(host)
      host.appendChild(makeTools(key))
      el.setAttribute('data-cms-has-btn', '1')
    })
  })
}

export function removeEditControls() {
  document.querySelectorAll('.cms-tools').forEach((b) => b.remove())
  document.querySelectorAll('[data-cms-has-btn]').forEach((e) => e.removeAttribute('data-cms-has-btn'))
  document.querySelectorAll('.cms-mount').forEach((e) => e.classList.remove('cms-mount'))
}

/** Reconstruye los botones de edición de un slot (tras subir/archivar contenido,
    para reflejar el set de acciones correcto según haya o no contenido). */
export function refreshTools(key: string) {
  if (!state.isAdmin) return
  const meta = metaByKey[key]
  if (!meta || meta.mount === 'none') return
  // Burbujas wave: 1 fuente + N clones comparten data-cms-key → cada copia
  // necesita sus propias herramientas (hover individual). refrescar todas.
  const hosts: HTMLElement[] = key.startsWith('hero.marquee#')
    ? Array.from(document.querySelectorAll<HTMLElement>(`.wave-item[data-cms-key="${key}"]`))
    : (() => {
        const el = elementsByKey[key]
        if (!el) return []
        return [meta.mount === 'parent' && el.parentElement ? el.parentElement : el]
      })()
  hosts.forEach((host) => {
    host.querySelector(':scope > .cms-tools')?.remove()
    host.classList.add('cms-mount')
    ensurePositioned(host)
    host.appendChild(makeTools(key))
  })
}

/** Refresca en vivo el nombre visible del contenedor (texto del overlay vacío
    + tooltips de las herramientas) tras renombrar, sin recargar la página. */
export function refreshContainerLabel(key: string) {
  const meta = metaByKey[key]
  if (!meta) return
  visualHosts(key).forEach((h) => {
    const span = h.querySelector<HTMLElement>('.cms-empty-overlay span')
    if (span) span.textContent = meta.label
  })
  refreshTools(key)
}

// ----- Persistencia al backend -------------------------------------------------------

/** Guarda overrides en localStorage y sincroniza con el Express. Lanza si falla la red. */
export async function persistOverrides(): Promise<void> {
  persistOverridesLocal()
  emit()
  await saveContent(state.items)
}

export function rescan() {
  indexEditables()
  if (state.isAdmin) {
    attachEditControls()
    // Asegurar que las waves vacías muestren el overlay de subida ("solo icono de subir imagen")
    REGISTRY.forEach((entry) => {
      if (entry.base === 'hero.wave') {
        document.querySelectorAll<HTMLElement>(entry.sel).forEach((el) => {
          const key = el.getAttribute('data-cms-key')
          if (key && !state.usedContent[key] && !state.items[key]) {
            showEmptySlot(key)
          }
        })
      }
    })
  }
  refreshRetired()
  syncWaveGroups()
}


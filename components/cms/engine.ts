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
  persistOverridesLocal, saveJSON, LS, type FieldValue,
} from '@/lib/cms/store'
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

const charLabel = (prefix: string) => (el: Element) => {
  const p = el.closest('.cd-panel')
  const n = p && p.querySelector('.cd-name')
  return prefix + (n ? ' — ' + (n.textContent || '').trim() : '')
}

const REGISTRY: RegistryEntry[] = [
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
  // Character Design
  { base: 'char.title', sel: '.char-showcase__title', kind: 'text', mount: 'self', section: 'Character Design', label: 'Título de sección — Character Design' },
  { base: 'char.sectiondesc', sel: '.char-showcase__desc', kind: 'text', mount: 'self', section: 'Character Design', label: 'Descripción — Character Design' },
  { base: 'char.soft', sel: '.char-soft-icon', kind: 'image', accept: 'webp,png,svg', mount: 'self', section: 'Character Design', label: (el, i) => `Logo de software #${i + 1}` },
  { base: 'char.softname', sel: '.char-soft-name', kind: 'text', mount: 'self', section: 'Character Design', label: (el, i) => `Nombre de software #${i + 1}` },
  { base: 'char.name', sel: '.cd-name', kind: 'text', mount: 'self', section: 'Character Design', label: (el, i) => `Nombre de personaje #${i + 1}` },
  { base: 'char.role', sel: '.cd-role', kind: 'text', mount: 'self', section: 'Character Design', label: charLabel('Rol de personaje') },
  { base: 'char.desc', sel: '.cd-desc', kind: 'text', mount: 'self', section: 'Character Design', label: charLabel('Descripción de personaje') },
  { base: 'char.portrait', sel: '.cd-portrait', kind: 'image', accept: 'webp', mount: 'self', section: 'Character Design', label: charLabel('Retrato principal') },
  { base: 'char.concept', sel: '.cd-concept', kind: 'image', accept: 'webp', mount: 'self', section: 'Character Design', label: charLabel('Concept') },
  { base: 'char.railname', sel: '.cd-rail-name', kind: 'text', mount: 'self', section: 'Character Design', label: (el, i) => `Nombre carrusel inferior #${i + 1}` },
  { base: 'char.railthumb', sel: '.cd-rail-thumb', kind: 'image', accept: 'webp', mount: 'self', section: 'Character Design', label: (el, i) => `Miniatura carrusel inferior #${i + 1}` },
  { base: 'char.railrole', sel: '.cd-rail-role', kind: 'text', mount: 'self', section: 'Character Design', label: (el, i) => `Rol carrusel inferior #${i + 1}` },
  // Ilustraciones (masonry generada por el CMS → re-escaneo)
  { base: 'illu', sel: '#illustrations-container .gallery-item img', kind: 'image', accept: 'webp', mount: 'parent', section: 'Ilustraciones', container: '.gallery-item', fields: ILLU_FIELDS, label: (el, i) => `Ilustración #${i + 1}` },
  // Animations
  { base: 'anim.title', sel: '.anim-showcase__title', kind: 'text', mount: 'self', section: 'Animations', label: 'Título de sección — Animations' },
  { base: 'anim.desc', sel: '.anim-showcase__desc', kind: 'text', mount: 'self', section: 'Animations', label: 'Descripción — Animations' },
  { base: 'anim.soft', sel: '.anim-soft-icon', kind: 'image', accept: 'webp,png,svg', mount: 'self', section: 'Animations', label: (el, i) => `Logo de software #${i + 1}` },
  { base: 'anim.softname', sel: '.anim-soft-name', kind: 'text', mount: 'self', section: 'Animations', label: (el, i) => `Nombre de software #${i + 1}` },
  { base: 'anim', sel: '.animations-grid .anim-video', kind: 'video', accept: 'webm', mount: 'parent', section: 'Animations', container: '.animation-item', fields: ANIM_FIELDS, label: (el, i) => `Animación #${i + 1}` },
  // 3D Models (selectores → markup .m3d- de ModelsShowcase.tsx; bases conservadas)
  { base: 'model3d.soft', sel: '.model3d-soft-icon', kind: 'image', accept: 'webp,png,svg', mount: 'self', section: '3D Models', label: (el, i) => `Logo de software #${i + 1}` },
  { base: 'model3d.softname', sel: '.model3d-soft-name', kind: 'text', mount: 'self', section: '3D Models', label: (el, i) => `Nombre de software #${i + 1}` },
  { base: 'model3d.heading', sel: '.m3d-showcase__title', kind: 'text', mount: 'self', section: '3D Models', label: 'Nombre de la sección — 3D' },
  { base: 'model3d.intro', sel: '.m3d-showcase__desc', kind: 'text', mount: 'self', section: '3D Models', label: 'Texto introductorio — 3D' },
  { base: 'model3d.title', sel: '.m3d-text__title', kind: 'text', mount: 'self', section: '3D Models', label: (el, i) => `Título bloque #${i + 1} — 3D` },
  { base: 'model3d.desc', sel: '.m3d-text__body', kind: 'text', mount: 'self', section: '3D Models', label: (el, i) => `Texto bloque #${i + 1} — 3D` },
  { base: 'model3d', sel: '.m3d-slide .m3d-video', kind: 'video', accept: 'webm', mount: 'parent', section: '3D Models', label: (el, i) => `Video 3D #${i + 1}` },
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
    if (s) s.src = value
    else (el as HTMLVideoElement).src = value
    try {
      const v = el as HTMLVideoElement
      v.load()
      v.play().catch(() => {})
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

// Re-emite el evento del carrusel para que el slideshow (Slideshow.tsx) se
// actualice en vivo tras asignar/quitar una slide (no hay elemento DOM por
// slide; el slideshow se hidrata desde state.items vía este evento).
export function broadcastCarousel(prefix: string) {
  let settings = { count: 3, duration: 7000 }
  try { settings = Object.assign(settings, JSON.parse(state.items[`${prefix}.settings`] || '')) } catch {}
  const slides: string[] = []
  for (let i = 0; i < (settings.count || 3); i++) slides.push(state.items[`${prefix}.slide#${i}`] || '')
  window.dispatchEvent(new CustomEvent(`cms:${prefix}`, { detail: { slides, duration: settings.duration || 7000 } }))
}

export function applyMedia(key: string, value: string) {
  // Slides del carrusel: no tienen elemento propio → actualizar vía evento.
  const slideMatch = key.match(/^(.+)\.slide#\d+$/)
  if (slideMatch) { broadcastCarousel(slideMatch[1]); return }

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
  Object.keys(state.items).forEach((key) => applyStored(key, state.items[key]))
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
    if (state.usedContent[key]) {
      if (meta.fields && !state.usedContent[key].fields) {
        state.usedContent[key].fields = computeFields(key, el, meta)
        changed = true
      }
      return
    }
    const src = currentSrcOf(el)
    let name = basename(src), size: number | null = null, original = true
    const mm = state.mediaMeta[key]
    if (mm) { name = mm.name; size = mm.size; original = false }
    else if (src.startsWith('data:')) {
      const found = state.addedIllu.find((a) => a.dataUrl === src)
      if (found) { name = found.name; size = found.size; original = false }
    }
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
  const el = elementsByKey[key]
  if (!el) return []
  if (el.classList.contains('wave-item')) return [el]
  if (isIconSlot(el)) return [el.closest('a') || el]
  return [el.closest<HTMLElement>('.gallery-item, .animation-item, .model-video-card, .m3d-slide') || el.parentElement || el]
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
  
  state.retired.forEach((key) => {
    visualHosts(key).forEach((h) => {
      if (state.isAdmin) showEmptySlot(key)
      else h.classList.add('cms-retired')
    })
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
  if (!state.retired.includes(key)) state.retired.push(key)
  persistUnused(); persistUsed(); persistRetired()
  showEmptySlot(key)
  refreshTools(key)
  recordAudit({ section: entry.section, label: entry.label, kind: 'gestión', summary: 'Contenido movido a no usados' })
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
  if (hasContent && meta.fields) tools.appendChild(toolBtn('fa-pen', 'Editar información: ' + meta.label, 'cms-tool-edit', () => dispatch({ type: 'editInfo', key })))
  tools.appendChild(toolBtn('fa-arrow-up-from-bracket', hasContent ? 'Reemplazar: ' + meta.label : 'Subir contenido: ' + meta.label, 'cms-tool-replace', () => dispatch({ type: 'contentPicker', key })))
  if (hasContent) tools.appendChild(toolBtn('fa-box-archive', 'Mover a no usados: ' + meta.label, 'cms-tool-move', () => dispatch({ type: 'confirmMove', key })))
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
  const el = elementsByKey[key]
  const meta = metaByKey[key]
  if (!el || !meta || meta.mount === 'none') return
  const host = meta.mount === 'parent' && el.parentElement ? el.parentElement : el
  host.querySelector(':scope > .cms-tools')?.remove()
  host.classList.add('cms-mount')
  ensurePositioned(host)
  host.appendChild(makeTools(key))
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

// Renombrar contenedor desde el sitio (port del pencil del ContentPicker).
// Vive acá y no en el componente: muta metaByKey/usedContent (estado del motor).
export function renameContainerSite(key: string, newName: string) {
  state.containerNames[key] = newName
  saveJSON(LS.CONTAINER_NAMES, state.containerNames)
  const meta = metaByKey[key]
  if (meta) meta.label = newName
  if (state.usedContent[key]) {
    state.usedContent[key].label = newName
    persistUsed()
  }
  recordAudit({ section: meta?.section || '', label: newName, kind: 'gestión', summary: 'Contenedor renombrado' })
}

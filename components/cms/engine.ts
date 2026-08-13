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
  state, emit, recordAudit, recordMediaMeta, persistUsed, persistUnused, persistRetired,
  persistOverridesLocal, persistLang, retireUsedEntryToUnused, archiveMediaKey, clearItemOverrides, getAllKnownContainerKeys, getContainerMeta, type FieldValue, flushSyncToServer,
  persistTrash, loadTextDefaults, recordTextDefaults
} from '@/lib/cms/store'
import { BASE_LANG, isTranslatableEntry, applyStaticTranslations, type Lang } from '@/lib/i18n'
export { applyStaticTranslations }
import { basename, optimizedMediaSrc } from '@/lib/utils'
import { COLLECTIONS, collectionOf } from '@/lib/cms/collections'
import { readSettings, planCommit, isEmptyMedia } from '@/lib/cms/collection'

function resolveMediaName(src: string | undefined, key?: string): string {
  if (!src && !key) return ''
  if (key && state.mediaMeta[key]?.name) return state.mediaMeta[key].name
  if (src && state.mediaMeta[src]?.name) return state.mediaMeta[src].name
  return src ? basename(src) : ''
}

// ----- Definiciones de campos (port de ANIM_FIELDS / ILLU_FIELDS / WAVE_FIELDS)

export type FieldDef = {
  key: string
  label: string
  textarea?: boolean
  optional?: boolean // si es true, no bloquea la subida cuando está vacío
  get: (c: HTMLElement) => string
  set: (c: HTMLElement, v: string) => void
}

const txt = (e: Element | null) => {
  if (!e) return ''
  const val = e.querySelector('.val')
  return (val ? val.textContent || '' : e.textContent || '').trim()
}
function setTxtKeepIcon(e: Element | null, v: string) {
  if (!e) return
  const val = e.querySelector('.val')
  if (val) {
    val.textContent = v
    return
  }
  const icon = e.querySelector('i')
  e.textContent = ' ' + v
  if (icon) e.prepend(icon)
}

const ANIM_FIELDS: FieldDef[] = [
  { key: 'title', label: 'Title',
    get: (c) => txt(c.querySelector('.video-title')),
    set: (c, v) => { const e = c.querySelector('.video-title'); if (e) { const val = e.querySelector('.val'); if (val) val.textContent = v; else e.textContent = v; } c.setAttribute('data-title', v) } },
  { key: 'date', label: 'Date', optional: true,
    get: (c) => txt(c.querySelector('.video-date')) || c.getAttribute('data-date') || '',
    set: (c, v) => { 
      const e = c.querySelector('.video-date'); 
      if (e) { const val = e.querySelector('.val'); if (val) val.textContent = v; else setTxtKeepIcon(e, v); } 
      c.setAttribute('data-date', v) 
    } },
  { key: 'project', label: 'Project', optional: true,
    get: (c) => txt(c.querySelector('.video-project')) || c.getAttribute('data-project') || '',
    set: (c, v) => { 
      const e = c.querySelector('.video-project'); 
      if (e) { const val = e.querySelector('.val'); if (val) val.textContent = v; else setTxtKeepIcon(e, v); } 
      c.setAttribute('data-project', v) 
    } },
  { key: 'inspiration', label: 'Inspiration', optional: true,
    get: (c) => c.getAttribute('data-inspiration') || '',
    set: (c, v) => c.setAttribute('data-inspiration', v) },
  { key: 'fsdesc', label: 'Description (when viewing full screen)', textarea: true, optional: true,
    get: (c) => c.getAttribute('data-desc') || '',
    set: (c, v) => c.setAttribute('data-desc', v) },
]

const ILLU_FIELDS: FieldDef[] = [
  { key: 'title', label: 'Title', get: (c) => c.dataset.title || '', set: (c, v) => { c.dataset.title = v } },
  { key: 'date', label: 'Date', optional: true, get: (c) => c.dataset.date || '', set: (c, v) => { c.dataset.date = v } },
  { key: 'project', label: 'Project', optional: true, get: (c) => c.dataset.project || '', set: (c, v) => { c.dataset.project = v } },
  { key: 'inspiration', label: 'Inspiration', optional: true, get: (c) => c.dataset.inspiration || '', set: (c, v) => { c.dataset.inspiration = v } },
  { key: 'desc', label: 'Description (when viewing full screen)', textarea: true, optional: true,
    get: (c) => c.dataset.desc || '', set: (c, v) => { c.dataset.desc = v } },
  { key: 'link', label: 'Repository link (Instagram, ArtStation, etc.)', optional: true,
    get: (c) => c.dataset.link || '', set: (c, v) => { c.dataset.link = v } },
]

export const PROJECT_FIELDS: FieldDef[] = [
  { key: 'title', label: 'Title',
    get: (c) => c.getAttribute('data-title') || '',
    set: (c, v) => { c.setAttribute('data-title', v); const e = c.querySelector('.proj-card-title'); if (e) e.textContent = v } },
  { key: 'start_date', label: 'Start Date', optional: true,
    get: (c) => c.getAttribute('data-start-date') || '',
    set: (c, v) => { c.setAttribute('data-start-date', v); const e = c.querySelector('.proj-card-date'); if (e) e.textContent = v } },
  { key: 'end_date', label: 'End Date', optional: true,
    get: (c) => c.getAttribute('data-end-date') || '',
    set: (c, v) => { c.setAttribute('data-end-date', v) } },
  { key: 'duration', label: 'Duration', optional: true,
    get: (c) => c.getAttribute('data-duration') || '',
    set: (c, v) => { c.setAttribute('data-duration', v) } },
  { key: 'theme', label: 'Project Theme', optional: true,
    get: (c) => c.getAttribute('data-theme') || '',
    set: (c, v) => { c.setAttribute('data-theme', v) } },
  { key: 'summary', label: 'Short Description', textarea: true, optional: true,
    get: (c) => c.getAttribute('data-summary') || '',
    set: (c, v) => { c.setAttribute('data-summary', v); const e = c.querySelector('.proj-card-summary'); if (e) e.textContent = v } },
  { key: 'desc', label: 'Full Description', textarea: true, optional: true,
    get: (c) => c.getAttribute('data-desc') || '',
    set: (c, v) => { c.setAttribute('data-desc', v) } }
]

const CHARACTER_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Name',
    get: (c) => c.getAttribute('data-name') || '',
    set: (c, v) => { c.setAttribute('data-name', v); const e = c.querySelector('.ch-name'); if (e) e.textContent = v } },
  { key: 'role', label: 'Role', optional: true,
    get: (c) => c.getAttribute('data-role') || '',
    set: (c, v) => { c.setAttribute('data-role', v); const e = c.querySelector('.ch-role'); if (e) e.textContent = v } },
  { key: 'desc', label: 'Description', textarea: true, optional: true,
    get: (c) => c.getAttribute('data-desc') || '',
    set: (c, v) => { c.setAttribute('data-desc', v); const e = c.querySelector('.ch-desc'); if (e) e.textContent = v } },
]


const WAVE_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Software Name',
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
  { key: 'k', label: 'Label',
    get: (c) => txt(c.querySelector('.about-spec-k')),
    set: (c, v) => { const e = c.querySelector('.about-spec-k'); if (e) e.textContent = v } },
  { key: 'v', label: 'Value',
    get: (c) => txt(c.querySelector('.about-spec-v')),
    set: (c, v) => { const e = c.querySelector('.about-spec-v'); if (e) e.textContent = v } },
]

const ABOUT_SOCIAL_FIELDS: FieldDef[] = [
  { key: 'label', label: 'Name',
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
  /* `attr`: la clave la emite React vía data-cms-key. Sin ese atributo el
     elemento se saltea, en vez de recibir una clave posicional que con uids
     sería fantasma. */
  identity?: 'positional' | 'attr'
}

const REGISTRY: RegistryEntry[] = [
  { base: 'loader.gallop', sel: '.loader-gallop', kind: 'video', accept: 'webm', mount: 'parent', section: 'Site Settings', label: 'Loading Screen' },
  { base: 'settings.faviconUrl', sel: '.favicon-preview-img', kind: 'image', accept: 'png,ico,svg,jpg,webp', mount: 'parent', section: 'Site Settings', label: 'Page Favicon' },
  { base: 'settings.appleIconUrl', sel: '.apple-icon-preview-img', kind: 'image', accept: 'png,ico,jpg,webp', mount: 'parent', section: 'Site Settings', label: 'Search Engine Icon' },
  { base: 'hero.marquee', sel: '.hero-software-wave .wave-item', kind: 'image', accept: 'webp,png,svg', mount: 'self', section: 'Hero', fields: WAVE_FIELDS, label: (el, i) => `Wave Tool #${(i % 11) + 1}` },
  { base: 'hero.subtitle', sel: '.hero-subtitle', kind: 'text', mount: 'self', section: 'Hero', label: 'Subtitle (below title) — Hero' },
  { base: 'soft.global', sel: '.global-soft-icons .soft-item', kind: 'image', accept: 'webp', mount: 'self', section: 'Animations', label: (el, i) => `Animation Stack Logo #${i + 1}` },
  { base: 'anim.bg', sel: '.decor-motion .decor-video', kind: 'video', accept: 'webm', mount: 'parent', section: 'Animations', label: (el, i) => `Animation Background Video #${i + 1}` },
  { base: 'about.title', sel: 'h2[data-i18n="about_title"]', kind: 'text', mount: 'self', section: 'About me', label: 'Title — About me' },
  { base: 'about.lede', sel: '.about-lede', kind: 'text', mount: 'self', section: 'About me', label: 'Subtitle (below title) — About me' },
  { base: 'about.desc', sel: '.bio-content', kind: 'text', mount: 'self', section: 'About me', label: 'Biography — About me' },
  { base: 'about.spec', sel: '.about-spec', kind: 'text', mount: 'self', section: 'About me', fields: ABOUT_SPEC_FIELDS, label: (el, i) => `Spec #${i + 1} — About me` },
  { base: 'about.social', sel: '.about-social', kind: 'text', mount: 'self', section: 'About me', fields: ABOUT_SOCIAL_FIELDS, label: (el, i) => `Social Network #${i + 1} — About me` },
  { base: 'about.video', sel: '.about-video', kind: 'video', accept: 'webm', mount: 'parent', section: 'About me', label: 'Video / Animation — About me' },
  { base: 'subtitle', sel: '.section-title p', kind: 'text', mount: 'self', section: 'Subtitles', label: (el) => {
    const sec = el.closest('section')
    const h = sec && sec.querySelector<HTMLElement>('.section-typewriter')
    return 'Subtitle — ' + (h ? (h.dataset.text || h.textContent || '').trim() : 'section')
  } },
  { base: 'char.title', sel: '.ch-showcase__title', kind: 'text', mount: 'self', section: 'Characters', label: 'Section Title — Characters' },
  { base: 'char.sectiondesc', sel: '.ch-showcase__desc', kind: 'text', mount: 'self', section: 'Characters', label: 'Description — Characters' },
  { base: 'char.soft', sel: '.char-soft-icon', kind: 'image', accept: 'webp,png,svg', mount: 'self', section: 'Characters', label: (el, i) => `Software Logo #${i + 1}` },
  { base: 'char.softname', sel: '.char-soft-name', kind: 'text', mount: 'self', section: 'Characters', label: (el, i) => `Software Name #${i + 1}` },
  { base: 'char', sel: '.ch-panel .ch-portrait', kind: 'image', accept: 'webp', mount: 'parent', section: 'Characters', container: '.ch-panel', fields: CHARACTER_FIELDS, label: (el, i) => `Character #${i + 1}`, identity: 'attr' },
  { base: 'char.concept', sel: '.ch-panel .ch-concept', kind: 'image', accept: 'webp', mount: 'parent', section: 'Characters', label: () => 'Concept' },
  { base: 'illustration', sel: '.illu-masonry .illu-cell__img', kind: 'image', accept: 'webp', mount: 'parent', section: 'Illustrations', container: '.illu-cell', fields: ILLU_FIELDS, label: (el, i) => `Illustration #${i + 1}` },
  { base: 'anim.title', sel: '.anim-showcase__title', kind: 'text', mount: 'self', section: 'Animations', label: 'Section Title — Animations' },
  { base: 'anim.desc', sel: '.anim-showcase__desc', kind: 'text', mount: 'self', section: 'Animations', label: 'Description — Animations' },
  { base: 'anim.soft', sel: '.anim-soft-icon', kind: 'image', accept: 'webp,png,svg', mount: 'self', section: 'Animations', label: (el, i) => `Software Logo #${i + 1}` },
  { base: 'anim.softname', sel: '.anim-soft-name', kind: 'text', mount: 'self', section: 'Animations', label: (el, i) => `Software Name #${i + 1}` },
  { base: 'anim', sel: '.animations-grid .anim-video', kind: 'video', accept: 'webm', mount: 'parent', section: 'Animations', container: '.animation-item', fields: ANIM_FIELDS, label: (el, i) => `Animation #${i + 1}` },
  { base: 'proj.title', sel: '.proj-showcase__title', kind: 'text', mount: 'self', section: 'Projects', label: 'Section Title — Projects' },
  { base: 'proj.desc', sel: '.proj-showcase__desc', kind: 'text', mount: 'self', section: 'Projects', label: 'Description — Projects' },
  { base: 'proj.soft', sel: '.proj-soft-icon', kind: 'image', accept: 'webp,png,svg', mount: 'self', section: 'Projects', label: (el, i) => `Software Logo #${i + 1}` },
  { base: 'proj.softname', sel: '.proj-soft-name', kind: 'text', mount: 'self', section: 'Projects', label: (el, i) => `Software Name #${i + 1}` },
  { base: 'proj', sel: '.proj-showcase .proj-card-img', kind: 'image', accept: 'webp', mount: 'parent', section: 'Projects', container: '.project-item', fields: PROJECT_FIELDS, label: (el, i) => `Project #${i + 1}`, identity: 'attr' },
  { base: 'model3d.soft', sel: '.model3d-soft-icon', kind: 'image', accept: 'webp,png,svg', mount: 'self', section: '3D Models', label: (el, i) => `Software Logo #${i + 1}` },
  { base: 'model3d.softname', sel: '.model3d-soft-name', kind: 'text', mount: 'self', section: '3D Models', label: (el, i) => `Software Name #${i + 1}` },
  { base: 'model3d.heading', sel: '.m3d-showcase__title', kind: 'text', mount: 'self', section: '3D Models', label: 'Section Name — 3D' },
  { base: 'model3d.intro', sel: '.m3d-showcase__desc', kind: 'text', mount: 'self', section: '3D Models', label: 'Introductory Text — 3D' },
  { base: 'model3d.title', sel: '.m3d-text__title', kind: 'text', mount: 'self', section: '3D Models', label: (el, i) => `Block Title #${i + 1} — 3D` },
  { base: 'model3d.desc', sel: '.m3d-text__body', kind: 'text', mount: 'self', section: '3D Models', label: (el, i) => `Block Text #${i + 1} — 3D` },
  { base: 'model3d', sel: '.m3d-slide .m3d-video', kind: 'video', accept: 'webm', mount: 'parent', section: '3D Models', label: (el, i) => `3D Video #${i + 1}` },
  { base: 'model3d.gallery', sel: '.m3d-gallery__img', kind: 'image', accept: 'webp', mount: 'parent', section: '3D Models', label: (el, i) => `3D Image #${i + 1}` },
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
export function triggerContentPicker(key: string) { dispatch({ type: 'contentPicker', key }) }

const resolveLabel = (entry: RegistryEntry, el: Element, i: number) =>
  typeof entry.label === 'function' ? entry.label(el, i) : entry.label

export function indexEditables() {
  REGISTRY.forEach((entry) => {
    document.querySelectorAll<HTMLElement>(entry.sel).forEach((el, i) => {
      let key = el.getAttribute('data-cms-key')
      if (!key) {
        if (entry.identity === 'attr') return
        key = entry.base + '#' + i
        el.setAttribute('data-cms-key', key)
      }
      if (elementsByKey[key] && document.contains(elementsByKey[key])) return // ya indexado y activo en el DOM

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

/* Cada medición es una lectura de layout, y `applyStored` alterna medir →
   escribir `src`/`backgroundImage` sobre decenas de contenedores: la escritura
   ensucia el layout y la medición siguiente lo fuerza a recalcularse. Como el
   arranque encadena varias pasadas sobre los mismos nodos (hydrate → rescan →
   setLanguage), se memoriza el ancho por elemento y se descarta al cambiar el
   viewport. Solo se cachean medidas reales: un contenedor todavía sin layout
   mide 0 y cae al fallback, que no debe quedar congelado. */
let renderWidths = new WeakMap<HTMLElement, number>()

if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => { renderWidths = new WeakMap() }, { passive: true })
}

/* Ancho real de render × DPR: la imagen se pide al tamaño en que se ve.
   Sin layout todavía (contenedor oculto) cae al ancho del viewport. */
function renderWidthOf(el: HTMLElement): number {
  const cached = renderWidths.get(el)
  if (cached !== undefined) return cached
  const w = el.clientWidth || el.getBoundingClientRect().width
  const base = w > 0 ? w : (typeof window !== 'undefined' ? window.innerWidth : 1280)
  const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2)
  const out = Math.ceil(base * dpr)
  if (w > 0) renderWidths.set(el, out)
  return out
}

/* `data-cms-src` guarda SIEMPRE la URL original: lo que se pinta puede ser una
   variante redimensionada, pero el CMS (picker, repositorio, "en uso") tiene
   que seguir viendo el archivo real. */
export function currentSrcOf(el: HTMLElement | null): string {
  if (!el) return ''
  if (el.dataset.cmsSrc) return el.dataset.cmsSrc
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
    const img = el as HTMLImageElement
    img.removeAttribute('srcset')
    img.decoding = 'async'
    // El hero es LCP: se carga ya. El resto entra al scrollear.
    if (!img.hasAttribute('loading')) img.loading = el.closest('.hero') ? 'eager' : 'lazy'
    el.dataset.cmsSrc = value
    img.src = optimizedMediaSrc(value, renderWidthOf(el))
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
        img.decoding = 'async'
        img.loading = 'lazy'
        el.insertBefore(img, el.firstChild)
      }
      el.dataset.cmsSrc = value
      img.src = optimizedMediaSrc(value, renderWidthOf(img))
    } else {
      el.dataset.cmsSrc = value
      el.style.backgroundImage = `url("${optimizedMediaSrc(value, renderWidthOf(el))}")`
    }
    if (el.hasAttribute('data-full')) el.setAttribute('data-full', value)
  } else if (type === 'video') {
    const v = el as HTMLVideoElement
    const s = el.querySelector('source')
    /* f_auto/q_auto: sin esto Cloudinary entrega el contenedor tal cual se
       subió (típicamente webm) a CUALQUIER navegador. Safari/iOS nunca
       soportó webm en <video> — con f_auto, Cloudinary detecta el user-agent
       en cada request y sirve mp4/h264 a Safari, webm al resto, desde el
       mismo archivo original. Mismo tratamiento que ya recibe la imagen unas
       líneas arriba (optimizedMediaSrc); acá faltaba conectarlo. */
    const optimized = optimizedMediaSrc(value)
    const target = optimized || null
    const actual = s ? s.getAttribute('src') : v.getAttribute('src')

    /* Salir si la fuente ya es la que corresponde. `load()` reinicia el video
       desde cero, así que llamarlo cuando no cambió nada lo hace parpadear:
       applyValue corre en cada rescan/emit del store, y durante el arranque
       hay varios seguidos. */
    if (actual === target) return

    if (s) {
      if (value) s.src = optimized
      else s.removeAttribute('src')
    } else {
      if (value) v.src = optimized
      else v.removeAttribute('src')
    }
    try {
      v.load()
      if (value && v.autoplay) v.play().catch(() => {})
    } catch {}
  }
}

/* Los items de colección no tienen elemento DOM propio indexado por el REGISTRY
   (React los pinta y el picker escribe la clave directo). Se crea una meta
   sintética para que los pickers, que hacen `if (!meta) return null`, puedan
   asignarles contenido. */
export function ensureCollectionMeta(key: string) {
  if (metaByKey[key]) return
  const spec = collectionOf(key)
  if (!spec) return
  const conceptMatch = key.match(/::c(\d+)$/)
  // `spec.fields` (CollectionSpec, lib/cms/collections.ts) es metadata declarativa
  // { key, label, type } para que el gestor decida qué columna mostrar — no sirve
  // para el modal. `FieldDef[]` (PROJECT_FIELDS / CHARACTER_FIELDS, este archivo)
  // es lo que EditInfoModal necesita: trae get/set que leen y escriben el DOM.
  // Las claves de ambos arrays tienen que coincidir (arman los sufijos ::title,
  // ::name, etc.) o el modal termina escribiendo en claves que nadie lee.
  // Una clave de concept art (::cN) es un slot de media suelto, sin ficha propia.
  const fields = conceptMatch ? undefined
    : spec.prefix === 'proj' ? PROJECT_FIELDS
    : spec.prefix === 'char' ? CHARACTER_FIELDS
    : undefined
  metaByKey[key] = {
    label: state.containerNames[key]
      || (conceptMatch ? `Concept image #${Number(conceptMatch[1]) + 1}` : spec.label),
    section: spec.section,
    kind: 'image',
    accept: spec.accept,
    mount: 'none',
    ...(fields ? { fields } : {}),
  }
  typeByKey[key] = 'media'
}

export function applyMedia(key: string, value: string) {
  // Items de colección: los pinta React desde el store, no el motor.
  if (collectionOf(key)) { emit(); return }

  // Galería 3D (cinta): mismo data-cms-key en las 2 copias → actualizar todas
  // las instancias (la copia clon mantiene el loop seamless con contenido).
  if (key.startsWith('model3d.gallery#')) {
    document.querySelectorAll<HTMLImageElement>(`img[data-cms-key="${key}"]`).forEach((img) => {
      if (value) {
        img.removeAttribute('srcset')
        img.decoding = 'async'
        img.loading = 'lazy'
        img.dataset.cmsSrc = value
        img.src = optimizedMediaSrc(value, renderWidthOf(img))
      } else {
        delete img.dataset.cmsSrc
        img.removeAttribute('src')
      }
    })
    return
  }

  // Wave items: update ALL instances in the DOM for infinite scroll clones
  if (key.startsWith('hero.marquee#')) {
    document.querySelectorAll<HTMLElement>(`[data-cms-key="${key}"]`).forEach(el => {
      const slot = el.querySelector<HTMLElement>('.wave-icon-slot')
      if (slot) {
        // burbuja de ~30px: pedir el original sería tirar megapíxeles a la basura
        slot.style.backgroundImage = value ? `url("${optimizedMediaSrc(value, renderWidthOf(slot))}")` : ''
      }
      if (value) el.dataset.cmsSrc = value
      else delete el.dataset.cmsSrc
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
  // PERO: si la key tiene contenido real en state.items, NO lo borramos — en su
  // lugar la des-retiramos. Cuando el usuario retira contenido legítimamente,
  // clearItemOverrides() ya borra state.items[key] ANTES de agregar a retired.
  // Así que si llegamos aquí con una key en retired Y con valor en items,
  // es una inconsistencia (bug viejo de cleanOrphanOverrides) y la resolvemos
  // a favor del contenido.
  const toUnretire: string[] = []
  state.retired.forEach(key => {
    if (state.items[key]) {
      // Key has content but is marked retired — un-retire it
      toUnretire.push(key)
    }
  })
  // Remove falsely-retired keys
  if (toUnretire.length > 0) {
    state.retired = state.retired.filter(k => !toUnretire.includes(k))
    persistRetired()
  }
  
  Object.keys(state.items).forEach((key) => applyStored(key, state.items[key]))
}

// ----- Idioma (i18n) ----------------------------------------------------------

/** Claves de texto conocidas: campos (key::campo) + contenedores de texto.
    Se excluyen los contenedores que tienen campos propios: su texto vive en
    los `::campo` y escribirles el textContent entero borraría su markup. */
function textKeys(extra: Record<string, string>): Set<string> {
  const keys = new Set<string>()
  Object.keys(state.items).forEach((k) => keys.add(k))
  Object.keys(typeByKey).forEach((k) => { if (typeByKey[k] === 'text') keys.add(k) })
  Object.keys(fieldSetters).forEach((k) => keys.add(k))
  Object.keys(extra).forEach((k) => keys.add(k))
  Object.keys(metaByKey).forEach((k) => { if (metaByKey[k].fields) keys.delete(k) })
  return keys
}

/* Texto visible de un contenedor editable, sin la cromática del CMS: los
   botones .cms-tools y el overlay de slot vacío viven DENTRO del elemento, así
   que leer textContent en crudo exportaría el nombre del contenedor como si
   fuera contenido del artista. */
function cleanTextOf(el: HTMLElement): string {
  const attr = el.getAttribute('data-text')
  if (attr) return attr.trim()
  const clone = el.cloneNode(true) as HTMLElement
  clone.querySelectorAll('.cms-tools, .cms-empty-overlay').forEach((n) => n.remove())
  return (clone.textContent || '').trim()
}

/* Recorre los contenedores de texto presentes en el DOM actual (contenedor
   simple + cada campo de ficha) y entrega key → texto vivo. */
function scanDomTextKeys(): Record<string, string> {
  const found: Record<string, string> = {}
  for (const [k, el] of Object.entries(elementsByKey)) {
    const meta = metaByKey[k]
    if (!meta || !el || !document.contains(el)) continue
    // Con campos, el contenido real son los campos: leer además el textContent
    // del contenedor daría un pegote ("ROLE" + "3D Generalist") y aplicarlo de
    // vuelta borraría los <span> internos.
    if (meta.kind === 'text' && !meta.fields) {
      const val = cleanTextOf(el)
      if (val) found[k] = val
    }
    if (meta.fields) {
      const cont = meta.container ? el.closest<HTMLElement>(meta.container) : el
      if (!cont) continue
      meta.fields.forEach((f) => {
        const val = (f.get(cont) || '').trim()
        if (val) found[k + '::' + f.key] = val
      })
    }
  }
  return found
}

/* Memoriza el texto por defecto de la ruta montada. Se llama en cada rescan:
   a medida que el admin navega, el caché va cubriendo el sitio entero y la
   exportación deja de depender de en qué página se pulsó el botón. */
export function captureTextDefaults() {
  // Solo con el idioma base montado: en es/pt/fr el DOM ya trae la traducción
  // aplicada y guardarla como "default" contaminaría la exportación.
  if (state.lang !== BASE_LANG) return
  const found: Record<string, string> = {}
  for (const [k, v] of Object.entries(scanDomTextKeys())) {
    if (isTranslatableEntry(k, v)) found[k] = v
  }
  recordTextDefaults(found)
}

/** Claves de texto esperadas según el registro + los contadores de los gestores. */
export function expectedTextKeys(): string[] {
  const keys = new Set<string>()
  for (const [k, meta] of Object.entries(metaByKey)) {
    if (meta.kind === 'text') keys.add(k)
    if (meta.fields) meta.fields.forEach((f) => keys.add(k + '::' + f.key))
  }
  Object.keys(loadTextDefaults()).forEach((k) => keys.add(k))
  Object.keys(state.items).forEach((k) => {
    if (isTranslatableEntry(k, state.items[k])) keys.add(k)
  })
  return [...keys]
}

/* Reúne TODO el texto traducible. Une cuatro fuentes para que ninguna
   ruta quede fuera: lo que guardó el servidor, los overrides locales, lo que
   hay montado ahora mismo en el DOM y el caché de textos por defecto. */
export function getAllTranslatableItems(baseFromStore: Record<string, string> = {}): Record<string, string> {
  const result: Record<string, string> = {}

  const merge = (src: Record<string, string>) => {
    for (const [k, v] of Object.entries(src)) {
      if (typeof v === 'string' && isTranslatableEntry(k, v)) result[k] = v
    }
  }

  // Precedencia ascendente: el texto vivo del DOM y los overrides mandan sobre
  // el caché de defaults (que puede haber quedado viejo tras una edición).
  merge(loadTextDefaults())
  merge(baseFromStore)
  // El DOM solo es fuente fiable con el idioma base montado; en un idioma
  // destino estaría devolviendo la traducción en lugar del texto original.
  if (state.lang === BASE_LANG) merge(scanDomTextKeys())
  merge(state.items)

  return result
}

/** Resumen por sección para confirmarle al admin qué se está exportando. */
export function translationCoverage(items: Record<string, string>): { section: string; count: number }[] {
  const counts: Record<string, number> = {}
  for (const key of Object.keys(items)) {
    const base = key.split('::')[0]
    const section = metaByKey[base]?.section || getContainerMeta(base)?.section || 'Other'
    counts[section] = (counts[section] || 0) + 1
  }
  return Object.entries(counts)
    .map(([section, count]) => ({ section, count }))
    .sort((a, b) => b.count - a.count)
}

/* Aplica un idioma a todo el texto del DOM. El idioma base restaura el texto
   original (override del admin, o el default del contenedor si nunca se editó);
   un idioma destino usa su traducción y cae al base cuando falta la clave.
   No toca media. Persiste la elección y notifica a los suscriptores.

   El fallback a los defaults es lo que permite VOLVER al inglés: un contenedor
   sin editar no tiene entrada en state.items, así que sin él se quedaría
   mostrando la última traducción aplicada. */
export function setLanguage(lang: Lang) {
  const dict = lang === BASE_LANG ? {} : (state.translations[lang] || {})
  const defaults = loadTextDefaults()
  const baseOf = (key: string) => (state.items[key] != null ? state.items[key] : defaults[key])

  textKeys({ ...defaults, ...dict }).forEach((key) => {
    const value = lang === BASE_LANG ? baseOf(key) : (dict[key] != null ? dict[key] : baseOf(key))
    if (value != null) applyStored(key, value)
  })
  applyStaticTranslations(lang)
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
  const allKeys = new Set([...Object.keys(elementsByKey), ...getAllKnownContainerKeys()])
  allKeys.forEach((key) => {
    if (state.retired.includes(key)) return
    const el = elementsByKey[key] || null
    const meta = metaByKey[key] || getContainerMeta(key)
    if (!meta || (meta.kind !== 'image' && meta.kind !== 'video')) return
    const src = state.items[key] || (el ? currentSrcOf(el) : '')
    const mm = state.mediaMeta[key] || (src ? state.mediaMeta[src] : undefined)
    let ts: number | undefined = mm?.ts
    if (!ts && src && typeof src === 'string' && src.includes('/upload/v')) {
      const match = src.match(/\/upload\/v(\d{10,})\//)
      if (match && match[1]) {
        ts = parseInt(match[1], 10) * 1000
      }
    }

    if (state.usedContent[key]) {
      // Contenedor vacío marcado por error como "usado" (seed sin contenido):
      // purgar para que no contamine el repositorio ni se evacúe a "sin usar".
      if (!state.usedContent[key].src && !src) {
        delete state.usedContent[key]
        changed = true
        return
      }
      if (src && state.usedContent[key].src !== src) {
        state.usedContent[key].src = src
        changed = true
      }
      if (!state.usedContent[key].ts && ts) {
        state.usedContent[key].ts = ts
        changed = true
      }
      if ((!state.usedContent[key].size || state.usedContent[key].size === 0) && mm?.size) {
        state.usedContent[key].size = mm.size
        changed = true
      }
      if (meta.fields && !state.usedContent[key].fields) {
        state.usedContent[key].fields = computeFields(key, el, meta)
        changed = true
      }
      return
    }
    if (!src) return // contenedor vacío: no es contenido usado, no sembrar
    let name = resolveMediaName(src, key), size: number | null = null, original = true
    if (mm) { name = mm.name || name; size = mm.size ?? null; original = false }
    state.usedContent[key] = {
      key, label: meta.label, section: meta.section,
      kind: meta.kind as 'image' | 'video', src, name, size, ts, original,
      fields: computeFields(key, el, meta),
    }
    if (ts || size) {
      recordMediaMeta(key, src, { ts, size, name })
    }
    changed = true
  })

  // Limpieza de entries huérfanas: si una key en usedContent ya no tiene
  // contenido en state.items NI tiene elemento DOM, la entrada es un
  // remanente de un reordenamiento o eliminación → purgarla.
  Object.keys(state.usedContent).forEach((key) => {
    if (!allKeys.has(key)) {
      // Key completamente desconocida (no está en ningún registro)
      delete state.usedContent[key]
      changed = true
      return
    }
    // Key conocida pero sin contenido real
    const src = state.items[key] || (elementsByKey[key] ? currentSrcOf(elementsByKey[key]) : '')
    if (!src && state.usedContent[key]) {
      delete state.usedContent[key]
      changed = true
    }
  })

  // Helper to normalize Cloudinary URLs by extracting just the filename (e.g. image_abc123.jpg)
  // This ensures that even if an image is in a different folder or has a version tag, it matches.
  const normalizeUrl = (url: string | undefined) => {
    if (!url) return ''
    try {
      const pathname = new URL(url, 'http://localhost').pathname
      const parts = pathname.split('/')
      return parts[parts.length - 1]
    } catch {
      const parts = url.split('/')
      return parts[parts.length - 1]
    }
  }

  // Prevent active content from appearing in Unused or Trash
  const activeSrcs = new Set<string>()
  Object.values(state.usedContent).forEach((u) => {
    if (u && u.src) activeSrcs.add(normalizeUrl(u.src))
  })

  const initialUnusedCount = state.unused.length
  state.unused = state.unused.filter(u => {
    const normSrc = normalizeUrl(u.src)
    const normDataUrl = normalizeUrl(u.dataUrl)
    return !activeSrcs.has(normSrc) && !activeSrcs.has(normDataUrl)
  })
  
  if (state.unused.length !== initialUnusedCount) {
    persistUnused()
    changed = true
  }

  const initialTrashCount = state.trash.length
  state.trash = state.trash.filter(t => {
    const normSrc = normalizeUrl(t.src)
    const normDataUrl = normalizeUrl(t.dataUrl)
    return !activeSrcs.has(normSrc) && !activeSrcs.has(normDataUrl)
  })
  
  if (state.trash.length !== initialTrashCount) {
    persistTrash()
    changed = true
  }

  if (changed) { persistUsed(); emit() }
}

export function cleanTemporaryKeys(keys: string[]) {
  let changed = false
  keys.forEach((k) => {
    delete metaByKey[k]
    delete typeByKey[k]
    if (state.usedContent[k]) {
      delete state.usedContent[k]
      changed = true
    }
  })
  if (changed) { persistUsed(); emit() }
}

export function syncSettingsUsedContent(settings: { loaderVideo?: string; faviconUrl?: string }) {
  let changed = false
  if (settings.loaderVideo !== undefined) {
    const src = settings.loaderVideo
    const prev = state.usedContent['loader.gallop']
    if (src && prev?.src !== src) {
      if (prev && prev.src) {
        retireUsedEntryToUnused(prev, 'replaced', ['loader.gallop'])
      }
      const idx = state.unused.findIndex(u => u.src === src)
      if (idx !== -1) {
        state.unused.splice(idx, 1)
        persistUnused()
      }
      state.usedContent['loader.gallop'] = {
        key: 'loader.gallop',
        label: 'Loading Screen',
        section: 'Site Configuration',
        kind: 'video',
        src,
        name: resolveMediaName(src, 'loader.gallop'),
        size: null,
        original: true,
      }
      changed = true
    } else if (!src && prev) {
      retireUsedEntryToUnused(prev, 'retired', ['loader.gallop'])
      delete state.usedContent['loader.gallop']
      changed = true
    }
  }

  if (settings.faviconUrl !== undefined) {
    const src = settings.faviconUrl
    const prev = state.usedContent['settings.faviconUrl']
    if (src && prev?.src !== src) {
      if (prev && prev.src) {
        retireUsedEntryToUnused(prev, 'replaced', ['settings.faviconUrl'])
      }
      const idx = state.unused.findIndex(u => u.src === src)
      if (idx !== -1) {
        state.unused.splice(idx, 1)
        persistUnused()
      }
      state.usedContent['settings.faviconUrl'] = {
        key: 'settings.faviconUrl',
        label: 'Favicon',
        section: 'Site Configuration',
        kind: 'image',
        src,
        name: resolveMediaName(src, 'settings.faviconUrl'),
        size: null,
        original: true,
      }
      changed = true
    } else if (!src && prev) {
      retireUsedEntryToUnused(prev, 'retired', ['settings.faviconUrl'])
      delete state.usedContent['settings.faviconUrl']
      changed = true
    }
  }

  if (changed) {
    persistUsed()
    emit()
  }
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
  // Buscar todas las copias o clones en el DOM (carruseles, galerías 3D, proyectos, personajes, etc.)
  const allEls = Array.from(document.querySelectorAll<HTMLElement>(`[data-cms-key="${key}"]`))
  if (allEls.length > 0) {
    const hosts = allEls.map((el) => {
      if (el.classList.contains('wave-item')) return el
      if (isIconSlot(el)) return el.closest('a') || el
      const host = el.closest<HTMLElement>('.illu-cell, .animation-item, .model-video-card, .m3d-slide, .ch-portrait-wrap, .ch-concept-cell, .project-item, .m3d-gallery-cell') || el.parentElement || el
      if (key.includes('::c') && host && host.classList.contains('ch-portrait-wrap')) return null
      return host
    }).filter((e): e is HTMLElement => !!e)
    if (hosts.length > 0) return Array.from(new Set(hosts))
  }
  const el = elementsByKey[key]
  if (!el) return []
  if (el.classList.contains('wave-item')) return [el]
  if (isIconSlot(el)) return [el.closest('a') || el]
  const host = el.closest<HTMLElement>('.illu-cell, .animation-item, .model-video-card, .m3d-slide, .ch-portrait-wrap, .ch-concept-cell, .project-item, .m3d-gallery-cell') || el.parentElement || el
  if (key.includes('::c') && host && host.classList.contains('ch-portrait-wrap')) return []
  return [host]
}

export function showEmptySlot(key: string) {
  visualHosts(key).forEach((h) => {
    if ((key === 'loader.gallop' && !h.closest('#ajustes-loader')) || (key === 'settings.faviconUrl' && !h.closest('#ajustes-favicon'))) return
    h.classList.add('cms-empty-slot')
    h.classList.remove('wave-has-content')
    if (!h.querySelector('.cms-empty-overlay')) {
      const meta = metaByKey[key]
      const ov = document.createElement('div')
      ov.className = 'cms-empty-overlay'
      ov.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i><span></span>'
      ov.querySelector('span')!.textContent = meta ? meta.label : 'Assign content'
      ov.title = 'Upload or assign content here'
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

  /* Reconciliar: una clave CON contenido no puede estar "retirada". Al asignar,
     `performAssign` saca la clave de `retired` y lo persiste, pero ese borrado y
     el guardado del contenido son syncs separados: si el de `retired` no aterriza
     (o llega una foto vieja del server), la clave queda retirada aunque tenga
     contenido, y el overlay vacío lo tapaba al recargar → "el contenido
     desaparece". Acá se limpia (y se re-persiste una vez) para que nunca se pinte
     un slot vacío sobre contenido real. */
  const cleaned = state.retired.filter((key) => isEmptyMedia(state.items[key]))
  if (cleaned.length !== state.retired.length) {
    state.retired = cleaned
    persistRetired()
  }

  // Retirados: mismo marco vacío para admin Y visitante (el contenedor nunca
  // desaparece de la página; CSS ya oculta icono/nombre/click al visitante).
  state.retired.forEach((key) => {
    visualHosts(key).forEach(() => showEmptySlot(key))
  })

  // Slots de media vacíos (sin contenido y no retirados) → marco genérico para admin.
  Object.keys(elementsByKey).forEach((key) => {
    const m = metaByKey[key]
    if (!m || m.kind === 'text' || m.mount === 'none') return
    if (!state.items[key] && !state.retired.includes(key)) {
      showEmptySlot(key)
    }
  })
}

// Mueve un contenido usado a "no usados" desde el sitio (port moveToUnused)
export function moveToUnusedSite(key: string) {
  let entry = state.usedContent[key]
  if (!entry) {
    const el = elementsByKey[key]
    const meta = metaByKey[key]
    if (!meta) return
    // Para items de colección (proj#/char#) applyMedia corta antes de escribir
    // data-cms-src, así que el fallback a currentSrcOf leería la variante
    // redimensionada del DOM en vez del original: preferir state.items primero.
    const s = state.items[key] || currentSrcOf(el)
    const mm = state.mediaMeta[key] || (s ? state.mediaMeta[s] : undefined)
    entry = {
      key, label: meta.label, section: meta.section, kind: meta.kind as 'image' | 'video',
      src: s, name: mm?.name || resolveMediaName(s, key), size: mm?.size ?? null, original: mm ? false : true,
    }
  }
  retireUsedEntryToUnused(entry, 'retired', [key])
  delete state.usedContent[key]
  applyMedia(key, '')
  // Limpiar campos asociados en el DOM
  Object.keys(state.items).forEach(k => {
    if (k.startsWith(key + '::')) {
      if (fieldSetters[k]) fieldSetters[k]('')
    }
  })
  if (key === 'loader.gallop' || key === 'settings.faviconUrl') {
    state.items[key] = ''
    persistOverridesLocal()
    emit()
  } else {
    clearItemOverrides([key])
  }
  if (!state.retired.includes(key)) state.retired.push(key)
  persistUnused(); persistUsed(); persistRetired()
  showEmptySlot(key)
  refreshTools(key)
  recordAudit({ section: entry.section, label: entry.label, kind: 'management', summary: 'Content moved to unused' })
  flushSyncToServer()
}

/* Quita la tarjeta del sitio (no solo su contenido): archiva el media a
   "no usados" y saca el id del orden. Ya no hay reindexado: los otros items
   conservan su uid. */
export async function deleteProjectSite(key: string) {
  if (!state.isAdmin) return
  const spec = collectionOf(key)
  if (!spec) return
  const id = key.slice(spec.prefix.length + 1)
  const { ids, duration } = readSettings(state.items, spec.prefix)
  if (!ids.includes(id)) return

  const plan = planCommit(spec, ids, ids.filter((x) => x !== id), state.items, duration)
  for (const k of plan.archiveKeys) archiveMediaKey(k, 'deleted')
  for (const k of plan.deleteKeys) { delete state.items[k]; delete state.usedContent[k] }
  for (const [k, v] of Object.entries(plan.payload)) {
    if (v === '') delete state.items[k]
    else state.items[k] = v
  }
  persistOverridesLocal()
  persistUnused(); persistUsed(); persistRetired()
  await saveContent(plan.payload)
  emit()
}



// Mueve a "no usados" cada media key dada, dejando el contenedor vacío. Núcleo
// compartido por "Clear All" y "Clear current section". El texto NO se toca.
// Claves borradas → se envían a la DB como '' (POST /api/content es upsert, no
// borra) para que el contenido no reaparezca al recargar / en otro navegador.
function clearKeys(keys: Iterable<string>, forceCollections: string[] = []) {
  const cleared: Record<string, string> = {}
  const collectionPrefixes = new Set<string>(forceCollections)

  for (const key of keys) {
    if (key.includes('::')) continue          // campos de texto compuestos
    if (typeByKey[key] === 'text') continue   // texto: no va a "no usados"
    if (key.endsWith('.settings')) continue   // settings de carrusel: conservar

    const spec = collectionOf(key)
    if (spec) {
      archiveMediaKey(key)
      delete state.items[key]
      cleared[key] = ''
      collectionPrefixes.add(spec.prefix)
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

  // Reset de cada colección a su estado "cero": borra contenidos Y sus ids
  // (ids: []). Único momento sin imágenes. Display resultante: principal/secundario
  // → 1 contenedor vacío (HeroMediaCarousel colapsa a [''] ); fondo → blanco.
  collectionPrefixes.forEach((prefix) => {
    const spec = COLLECTIONS[prefix]
    const { ids, duration } = readSettings(state.items, prefix)
    // Mismo camino que deleteProjectSite/commit(): archivar (concept images incluidas)
    // antes de borrar, para que nada se pierda sin pasar por "no usados".
    const plan = planCommit(spec, ids, [], state.items, duration)
    for (const k of plan.archiveKeys) archiveMediaKey(k, 'deleted')
    for (const k of plan.deleteKeys) {
      delete state.items[k]
      delete state.usedContent[k]
      cleared[k] = ''
    }
    state.items[`${prefix}.settings`] = plan.payload[`${prefix}.settings`]
    cleared[`${prefix}.settings`] = state.items[`${prefix}.settings`]
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
  clearKeys(allMediaKeys(), Object.keys(COLLECTIONS))
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
  const spec = collectionOf(key)
  if (spec) {
    // El fondo (prefix 'hero') vive fuera de <section> → pertenece a la portada.
    if (spec.prefix === 'hero') return sectionEl.classList.contains('hero')
    const host = document.querySelector<HTMLElement>(`.${spec.prefix}-carousel-slide`)
      || document.querySelector<HTMLElement>(`[data-cms-key^="${spec.prefix}#"]`)
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
    if (meta.fields) tools.appendChild(toolBtn('fa-pen', 'Edit: ' + meta.label, 'cms-tool-edit', () => dispatch({ type: 'editInfo', key })))
    else tools.appendChild(toolBtn('fa-pen', 'Edit: ' + meta.label, 'cms-tool-edit', () => dispatch({ type: 'editText', key })))
    return tools
  }
  const hasContent = !!state.items[key]
  const isProject = collectionOf(key)?.prefix === 'proj'
  tools.setAttribute('data-cms-content', hasContent ? '1' : '0')
  if (hasContent && meta.fields) tools.appendChild(toolBtn('fa-pen', 'Edit info: ' + meta.label, 'cms-tool-edit', () => dispatch({ type: 'editInfo', key })))
  tools.appendChild(toolBtn('fa-arrow-up-from-bracket', hasContent ? 'Replace: ' + meta.label : 'Upload content: ' + meta.label, 'cms-tool-replace', () => dispatch({ type: 'contentPicker', key })))
  // Proyectos: papelera que ELIMINA la tarjeta (archivando su imagen a no usados).
  // Resto: archivar a no usados (vacía el slot, conserva la tarjeta).
  if (isProject) tools.appendChild(toolBtn('fa-trash', 'Delete card: ' + meta.label, 'cms-tool-move', () => dispatch({ type: 'confirmMove', key })))
  else if (hasContent) tools.appendChild(toolBtn('fa-box-archive', 'Move to unused: ' + meta.label, 'cms-tool-move', () => dispatch({ type: 'confirmMove', key })))
  return tools
}

export function attachEditControls() {
  REGISTRY.forEach((entry) => {
    document.querySelectorAll<HTMLElement>(entry.sel).forEach((el) => {
      const key = el.getAttribute('data-cms-key')
      if (!key) return
      if ((entry.base === 'loader.gallop' && !el.closest('#ajustes-loader')) || (entry.base === 'settings.faviconUrl' && !el.closest('#ajustes-favicon'))) return
      
      // Ensure empty wave slots always get the upload button overlay
      if (key.startsWith('hero.marquee#') && !state.items[key]) {
        showEmptySlot(key)
      }

      if (entry.mount === 'none') { el.setAttribute('data-cms-has-btn', '1'); return }
      const host = entry.mount === 'parent' && el.parentElement ? el.parentElement : el
      const hasContent = !!state.items[key]
      if (el.getAttribute('data-cms-has-btn') === '1') {
        const existing = host.querySelector(':scope > .cms-tools')
        if (existing && existing.getAttribute('data-cms-content') === (hasContent ? '1' : '0')) return
      }
      host.querySelector(':scope > .cms-tools')?.remove()
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
    if ((key === 'loader.gallop' && !host.closest('#ajustes-loader')) || (key === 'settings.faviconUrl' && !host.closest('#ajustes-favicon'))) return
    host.querySelector(':scope > .cms-tools')?.remove()
    host.classList.add('cms-mount')
    ensurePositioned(host)
    host.appendChild(makeTools(key))
  })
  setTimeout(() => {
    if (state.isAdmin) rescan()
  }, 150)
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
export async function persistOverrides() {
  persistOverridesLocal()
  emit()
  await saveContent(state.items)
  flushSyncToServer()
}

/** Igual que persistOverrides pero al backend manda SOLO las claves indicadas.
    Asignar contenido a un contenedor guardaba el estado ENTERO (saveContent(state.items)):
    si un solo ítem del estado hacía fallar /api/content (p.ej. un data URL que la
    subida rechaza → 5xx, que saveContent traga en silencio), la asignación se veía
    aplicada pero no persistía y "se iba" al recargar. Guardando solo la clave recién
    asignada, la escritura es inmune al resto del estado (igual que el commit del
    carrusel). El caché local sigue siendo el estado completo. */
export async function persistOverrideKeys(keys: string[]) {
  persistOverridesLocal()
  emit()
  const payload: Record<string, string> = {}
  for (const k of keys) payload[k] = state.items[k] ?? ''
  await saveContent(payload)
  flushSyncToServer()
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
  // Orden importante: primero memorizar el texto base de lo que se acaba de
  // montar, después repintar el idioma activo sobre ese mismo texto. Las
  // secciones con next/dynamic entran tarde, así que sin este re-apply se
  // quedarían en inglés tras un cambio de idioma o una navegación.
  captureTextDefaults()
  if (state.lang !== BASE_LANG) setLanguage(state.lang)
  else applyStaticTranslations(state.lang)
}


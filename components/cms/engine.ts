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
  { key: 'date', label: 'Fecha',
    get: (c) => txt(c.querySelector('.video-date')) || c.getAttribute('data-date') || '',
    set: (c, v) => { setTxtKeepIcon(c.querySelector('.video-date'), v); c.setAttribute('data-date', v) } },
  { key: 'project', label: 'Proyecto',
    get: (c) => txt(c.querySelector('.video-project')) || c.getAttribute('data-project') || '',
    set: (c, v) => { setTxtKeepIcon(c.querySelector('.video-project'), v); c.setAttribute('data-project', v) } },
  { key: 'inspiration', label: 'Inspiración',
    get: (c) => c.getAttribute('data-inspiration') || '',
    set: (c, v) => c.setAttribute('data-inspiration', v) },
  { key: 'fsdesc', label: 'Descripción (al ver en pantalla completa)', textarea: true,
    get: (c) => c.getAttribute('data-desc') || '',
    set: (c, v) => c.setAttribute('data-desc', v) },
]

const ILLU_FIELDS: FieldDef[] = [
  { key: 'title', label: 'Título', get: (c) => c.dataset.title || '', set: (c, v) => { c.dataset.title = v } },
  { key: 'date', label: 'Fecha', get: (c) => c.dataset.date || '', set: (c, v) => { c.dataset.date = v } },
  { key: 'project', label: 'Proyecto', get: (c) => c.dataset.project || '', set: (c, v) => { c.dataset.project = v } },
  { key: 'inspiration', label: 'Inspiración', get: (c) => c.dataset.inspiration || '', set: (c, v) => { c.dataset.inspiration = v } },
  { key: 'desc', label: 'Descripción (al ver en pantalla completa)', textarea: true,
    get: (c) => c.dataset.desc || '', set: (c, v) => { c.dataset.desc = v } },
  { key: 'link', label: 'Link al repositorio (Instagram, ArtStation, etc.)',
    get: (c) => c.dataset.link || '', set: (c, v) => { c.dataset.link = v } },
]

const WAVE_FIELDS: FieldDef[] = [
  { key: 'text', label: 'Nombre de la Herramienta',
    get: (c) => txt(c.querySelector('.wave-text')),
    set: (c, v) => { const e = c.querySelector('.wave-text'); if (e) e.textContent = v } },
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
  // Portada (el hero Next usa .hero-title/.hero-subtitle; el legacy .hero-overlay quedó muerto)
  { base: 'hero.title', sel: '.hero-title', kind: 'text', mount: 'self', section: 'Portada', label: 'Título Principal' },
  { base: 'hero.sub', sel: '.hero-subtitle', kind: 'text', mount: 'self', section: 'Portada', label: 'Subtítulo' },
  { base: 'hero.slide', sel: '.hero-bg-carousel .carousel-slide', kind: 'image', accept: 'webp', mount: 'none', section: 'Portada', label: (el, i) => `Imagen Carrusel #${i + 1}` },
  { base: 'hero.media', sel: '.hero-media-wrapper .cms-media', kind: 'image', accept: 'webp', mount: 'parent', section: 'Portada', label: (el, i) => `Imagen Flotante Hero #${i + 1}` },
  { base: 'hero.wave', sel: '.hero-software-wave .wave-track .wave-group:first-child .wave-item img.wave-icon', kind: 'image', accept: 'webp,png,svg', mount: 'parent', section: 'Portada', container: '.wave-item', fields: WAVE_FIELDS, label: (el, i) => `Herramienta Wave #${i + 1}` },
  // Production Stack
  { base: 'soft.global', sel: '.global-soft-icons .soft-item', kind: 'image', accept: 'webp', mount: 'self', section: 'Animaciones', label: (el, i) => `Logo Stack Animaciones #${i + 1}` },
  // Animaciones de fondo
  { base: 'anim.bg', sel: '.decor-motion .decor-video', kind: 'video', accept: 'webm', mount: 'parent', section: 'Animaciones', label: (el, i) => `Video Fondo Animaciones #${i + 1}` },
  // Sobre mí
  { base: 'about.title', sel: 'h2[data-i18n="about_title"]', kind: 'text', mount: 'self', section: 'Sobre mí', label: 'Título — Sobre mí' },
  { base: 'about.desc', sel: '.bio-content', kind: 'text', mount: 'self', section: 'Sobre mí', label: 'Biografía — Sobre mí' },
  { base: 'about.photo', sel: '.artist-photo-img', kind: 'image', accept: 'webp', mount: 'parent', section: 'Sobre mí', label: 'Foto de Lucía — Sobre mí' },
  { base: 'about.video', sel: '.about-video', kind: 'video', accept: 'webm', mount: 'parent', section: 'Sobre mí', label: 'Video — Sobre mí' },
  // Subtítulos de sección
  { base: 'subtitle', sel: '.section-title p', kind: 'text', mount: 'self', section: 'Subtítulos', label: (el) => {
    const sec = el.closest('section')
    const h = sec && sec.querySelector<HTMLElement>('.section-typewriter')
    return 'Subtítulo — ' + (h ? (h.dataset.text || h.textContent || '').trim() : 'sección')
  } },
  // Character Design
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
  { base: 'anim', sel: '.animations-grid .anim-video', kind: 'video', accept: 'webm', mount: 'parent', section: 'Animations', container: '.animation-item', fields: ANIM_FIELDS, label: (el, i) => `Animación #${i + 1}` },
  // 3D Models
  { base: 'model3d.soft', sel: '.software-icons-mini .soft-icon-wrap img', kind: 'image', accept: 'webp', mount: 'parent', section: '3D Models', label: (el, i) => `Logo Software 3D #${i + 1}` },
  { base: 'model3d.title', sel: '.model-text h3', kind: 'text', mount: 'self', section: '3D Models', label: (el, i) => `Título 3D #${i + 1}` },
  { base: 'model3d.desc', sel: '.model-text p', kind: 'text', mount: 'self', section: '3D Models', label: (el, i) => `Texto 3D #${i + 1}` },
  { base: 'model3d', sel: '.model-video-card .obs-video', kind: 'video', accept: 'webm', mount: 'parent', section: '3D Models', label: (el, i) => `Video 3D #${i + 1}` },
]

// ----- Índices del motor ------------------------------------------------------

export type Meta = {
  label: string
  section: string
  kind: 'text' | 'image' | 'video'
  accept?: string
  fields?: FieldDef[]
  container?: string
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

export function applyMedia(key: string, value: string) {
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
  const track = document.querySelector('.wave-track')
  if (!track) return
  const groups = track.querySelectorAll('.wave-group')
  if (groups.length <= 1) return
  const content = groups[0].innerHTML
  for (let i = 1; i < groups.length; i++) {
    groups[i].innerHTML = content
    groups[i].querySelectorAll('.cms-tools, .cms-empty-overlay').forEach((el) => el.remove())
    groups[i].querySelectorAll('[data-cms-key]').forEach((el) => el.removeAttribute('data-cms-key'))
  }
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

function visualHost(key: string): HTMLElement | null {
  const el = elementsByKey[key]
  if (!el) return null
  if (isIconSlot(el)) return el.closest('a') || el
  return el.closest<HTMLElement>('.gallery-item, .animation-item, .model-video-card') || el.parentElement || el
}

export function showEmptySlot(key: string) {
  const h = visualHost(key)
  if (!h) return
  h.classList.add('cms-empty-slot')
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
      dispatch({ type: 'contentPicker', key })
    })
    h.appendChild(ov)
  }
}

export function clearEmptySlot(key: string) {
  const h = visualHost(key)
  if (!h) return
  h.classList.remove('cms-empty-slot')
  h.querySelector('.cms-empty-overlay')?.remove()
}

export function refreshRetired() {
  document.querySelectorAll('.cms-retired').forEach((e) => e.classList.remove('cms-retired'))
  document.querySelectorAll('.cms-empty-slot').forEach((e) => e.classList.remove('cms-empty-slot'))
  document.querySelectorAll('.cms-empty-overlay').forEach((e) => e.remove())
  state.retired.forEach((key) => {
    const h = visualHost(key)
    if (!h) return
    if (state.isAdmin) showEmptySlot(key)
    else h.classList.add('cms-retired')
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
  b.innerHTML = `<i class="fa-solid ${icon}"></i>`
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
    tools.appendChild(toolBtn('fa-pen', 'Editar: ' + meta.label, 'cms-tool-edit', () => dispatch({ type: 'editText', key })))
    return tools
  }
  if (meta.fields) tools.appendChild(toolBtn('fa-pen', 'Editar información: ' + meta.label, 'cms-tool-edit', () => dispatch({ type: 'editInfo', key })))
  tools.appendChild(toolBtn('fa-arrow-up-from-bracket', 'Reemplazar: ' + meta.label, 'cms-tool-replace', () => dispatch({ type: 'contentPicker', key })))
  tools.appendChild(toolBtn('fa-box-archive', 'Mover a no usados: ' + meta.label, 'cms-tool-move', () => dispatch({ type: 'confirmMove', key })))
  return tools
}

export function attachEditControls() {
  REGISTRY.forEach((entry) => {
    document.querySelectorAll<HTMLElement>(entry.sel).forEach((el) => {
      const key = el.getAttribute('data-cms-key')
      if (!key || el.getAttribute('data-cms-has-btn') === '1') return
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

// ----- Persistencia al backend -------------------------------------------------------

/** Guarda overrides en localStorage y sincroniza con el Express. Lanza si falla la red. */
export async function persistOverrides(): Promise<void> {
  persistOverridesLocal()
  emit()
  await saveContent(state.items)
}

export function rescan() {
  indexEditables()
  if (state.isAdmin) attachEditControls()
  refreshRetired()
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

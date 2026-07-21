'use client'

/* Estado CMS compartido entre el sitio (overlay de edición) y /admin.
   Unifica los persist*() de cms.js y los load/save de admin.js sobre
   las MISMAS claves de localStorage (los datos del legacy se conservan).
   React se suscribe vía useCmsStore() (useSyncExternalStore). */

import { useSyncExternalStore } from 'react'
import { isVideo } from '@/lib/utils'
import { BASE_LANG, type Lang } from '@/lib/i18n'

// Claves localStorage — idénticas al legacy (compatibilidad de datos)
export const LS = {
  ADMIN: 'cms_admin_v1',
  OVERRIDES: 'cms_overrides_v1',
  OVERRIDES_HASH: 'cms_overrides_hash_v1',
  GLOBAL_HASH: 'cms_global_hash_v1',
  AUDIT: 'cms_audit_v1',
  MEDIA: 'cms_media_meta_v1',
  UNUSED: 'cms_unused_v1',
  USED: 'cms_used_content_v1',
  RETIRED: 'cms_retired_v1',
  TRASH: 'cms_trash_v1',
  TRASH_POLICY: 'cms_trash_policy_v1',
  UPLOAD_TEST: 'cms_upload_test_v1',
  REPO_FILTER: 'cms_repo_filter_v1',
  CONTAINER_NAMES: 'cms_container_names_v1',
  LANG: 'cms_lang_v1',
} as const

export const MAX_BYTES = 25 * 1024 * 1024

// ----- Tipos ---------------------------------------------------------------

export type FieldValue = { key: string; label: string; textarea: boolean; value: string }

export type UsedEntry = {
  key: string
  label: string
  section: string
  kind: 'image' | 'video' | 'text'
  src: string
  name: string
  size: number | null
  original: boolean
  fields?: FieldValue[] | null
  ts?: number
  type?: string
}

export type UnusedEntry = {
  key?: string
  src: string
  dataUrl?: string
  name: string
  size: number | null
  type: string
  ts: number
  label: string
  section: string
  original?: boolean
  reason?: 'replaced' | 'retired' | 'deleted' | 'upload'
  deletedAt?: number
}

export type AuditEntry = {
  ts: number
  user: string
  section: string
  label: string
  kind: string
  summary: string
  file: { name: string; size: number; type?: string } | null
}

export function loadJSON<T>(key: string, def: T): T {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(def)) }
  catch { return def }
}
export function saveJSON(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)) } catch {}
}

export function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return hash
}

// ----- Estado + suscripción -------------------------------------------------

export const state = {
  loaded: false,                              // loadState() ya corrió en este cliente
  serverReady: false,                         // merge con el servidor completado
  items: {} as Record<string, string>,        // overrides (clave -> valor)
  audit: [] as AuditEntry[],
  mediaMeta: {} as Record<string, { name: string; size: number; type: string; ts: number; label: string; section: string }>,
  unused: [] as UnusedEntry[],
  usedContent: {} as Record<string, UsedEntry>,
  retired: [] as string[],
  trash: [] as UnusedEntry[],
  containerNames: {} as Record<string, string>,
  isAdmin: false,
  username: '',                                               // usuario de la sesión actual
  lang: BASE_LANG as Lang,                                   // idioma activo
  translations: {} as Record<string, Record<string, string>>, // lang -> key -> valor traducido
}

/** Idioma guardado (localStorage). Default = base (es). */
export function loadLang(): Lang {
  try {
    const v = localStorage.getItem(LS.LANG) as Lang | null
    if (v) return v
  } catch {}
  return BASE_LANG
}

export function persistLang() {
  try { localStorage.setItem(LS.LANG, state.lang) } catch {}
}

let version = 0
const listeners = new Set<() => void>()

export function emit() {
  version++
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

/** Re-render cuando muta el store. Devuelve un contador; leer de `state`. */
export function useCmsStore(): number {
  return useSyncExternalStore(subscribe, () => version, () => 0)
}

export function loadState() {
  state.audit = loadJSON(LS.AUDIT, [])
  state.mediaMeta = loadJSON(LS.MEDIA, {})
  state.unused = loadJSON(LS.UNUSED, [])
  state.usedContent = loadJSON(LS.USED, {})
  state.retired = loadJSON(LS.RETIRED, [])
  state.trash = loadJSON(LS.TRASH, [])
  state.containerNames = loadJSON(LS.CONTAINER_NAMES, {})
  try { state.isAdmin = localStorage.getItem(LS.ADMIN) === '1' } catch {}
  state.loaded = true
  emit()
}

// ----- Persistencia ----------------------------------------------------------
//
// La DB (vía /api/state) es la FUENTE DE VERDAD. localStorage es solo un caché
// rápido para pintar antes de que el servidor responda; al llegar la respuesta
// del server, se sobreescribe por completo. Las funciones persist*() guardan
// en ambos lados: localStorage inmediato (UX) + DB con debounce (persistencia).

import { saveState, getState, saveContent, type CmsStatePayload, moveMedia, verifyMedia } from '@/lib/api'

let _syncTimer: ReturnType<typeof setTimeout> | null = null
const _pendingKeys = new Set<string>()

function scheduleSyncToServer(...keys: string[]) {
  keys.forEach((k) => _pendingKeys.add(k))
  if (_syncTimer) clearTimeout(_syncTimer)
  _syncTimer = setTimeout(flushSyncToServer, 2000)
}

function flushSyncToServer() {
  _syncTimer = null
  if (!state.isAdmin || _pendingKeys.size === 0) return
  const payload: CmsStatePayload = {}
  let syncOverrides = false
  for (const k of _pendingKeys) {
    if (k === 'used_content') payload.used_content = state.usedContent
    if (k === 'unused') payload.unused = state.unused
    if (k === 'retired') payload.retired = state.retired
    if (k === 'trash') payload.trash = state.trash
    if (k === 'media_meta') payload.media_meta = state.mediaMeta
    if (k === 'audit') payload.audit = state.audit.slice(-300)
    if (k === 'container_names') payload.container_names = state.containerNames
    if (k === 'overrides') syncOverrides = true
  }
  _pendingKeys.clear()
  if (Object.keys(payload).length > 0) saveState(payload).catch(() => {})
  if (syncOverrides) saveContent(state.items).catch(() => {})
}

export const persistAudit = () => { saveJSON(LS.AUDIT, state.audit.slice(-300)); scheduleSyncToServer('audit') }
export const persistUnused = () => { saveJSON(LS.UNUSED, state.unused); saveJSON(LS.MEDIA, state.mediaMeta); scheduleSyncToServer('unused', 'media_meta') }
export const persistUsed = () => { saveJSON(LS.USED, state.usedContent); saveJSON(LS.MEDIA, state.mediaMeta); scheduleSyncToServer('used_content', 'media_meta') }
export const persistRetired = () => { saveJSON(LS.RETIRED, state.retired); scheduleSyncToServer('retired') }
export const persistTrash = () => { saveJSON(LS.TRASH, state.trash); scheduleSyncToServer('trash') }
export const persistOverridesLocal = () => {
  saveJSON(LS.OVERRIDES, state.items)
  saveJSON(LS.OVERRIDES_HASH, simpleHash(JSON.stringify(state.items)))
}
export const persistMediaMeta = () => { saveJSON(LS.MEDIA, state.mediaMeta); scheduleSyncToServer('media_meta') }

export function clearDbOverrides(keys: string[]) {
  const payload: Record<string, string> = {}
  keys.forEach(k => payload[k] = '')
  saveContent(payload).catch(() => {})
}

/* Aplica el estado del servidor sobre el local. El server SIEMPRE gana:
   si el server devuelve un array vacío o un objeto vacío, eso significa que
   no hay datos — no que "se conserve lo local". localStorage se actualiza
   como caché para el próximo arranque rápido. */
export function mergeServerState(server: CmsStatePayload) {
  // Compute a global deterministic hash of the whole payload
  const serverHash = simpleHash(JSON.stringify(server))
  const localHash = loadJSON(LS.GLOBAL_HASH, null)
  // If hashes match, nothing changed – keep local cache
  if (localHash !== null && serverHash === localHash) {
    state.serverReady = true
    emit()
    return
  }

  // Otherwise, overwrite all persisted sections with server data
  if ('used_content' in server) {
    state.usedContent = (server.used_content || {}) as typeof state.usedContent
    saveJSON(LS.USED, state.usedContent)
  }
  if ('unused' in server) {
    state.unused = (Array.isArray(server.unused) ? server.unused : []) as typeof state.unused
    saveJSON(LS.UNUSED, state.unused)
  }
  if (['retired', 'trash', 'media_meta', 'audit', 'container_names', 'overrides'].some(k => k in server)) {
    if ('retired' in server) {
      state.retired = (Array.isArray(server.retired) ? server.retired : []) as typeof state.retired
      saveJSON(LS.RETIRED, state.retired)
    }
    if ('trash' in server) {
      state.trash = (Array.isArray(server.trash) ? server.trash : []) as typeof state.trash
      saveJSON(LS.TRASH, state.trash)
    }
    if ('media_meta' in server) {
      state.mediaMeta = (server.media_meta || {}) as typeof state.mediaMeta
      saveJSON(LS.MEDIA, state.mediaMeta)
    }
    if ('audit' in server) {
      state.audit = (Array.isArray(server.audit) ? server.audit : []) as typeof state.audit
      saveJSON(LS.AUDIT, state.audit)
    }
    if ('container_names' in server) {
      state.containerNames = (server.container_names || {}) as typeof state.containerNames
      saveJSON(LS.CONTAINER_NAMES, state.containerNames)
    }
    if ('overrides' in server) {
      const newItems = (server.overrides || {}) as Record<string, string>
      const newHash = simpleHash(JSON.stringify(newItems))
      // Store overrides and its hash regardless of previous value, because global change already detected
      state.items = newItems
      saveJSON(LS.OVERRIDES, state.items)
      saveJSON(LS.OVERRIDES_HASH, newHash)
    }
  }

  // Persist the new global hash for future comparisons
  saveJSON(LS.GLOBAL_HASH, serverHash)
  state.serverReady = true
  emit()
}

/* Carga el estado completo desde el server y lo aplica. La DB es la fuente
   de verdad; lo que había en localStorage se sobreescribe. */
export function loadServerState(): Promise<void> {
  return getState()
    .then((server) => { mergeServerState(server) })
    .catch(() => {})
}

export function recordMediaMeta(key: string, src: string | undefined, meta: { name?: string; size?: number | null; type?: string; ts?: number; label?: string; section?: string }) {
  if (!meta.name && !meta.size) return
  const existing = state.mediaMeta[key] || (src ? state.mediaMeta[src] : undefined) || {}
  const entry = {
    name: meta.name || existing.name || '',
    size: meta.size ?? existing.size ?? 0,
    type: meta.type || existing.type || '',
    ts: meta.ts || existing.ts || Date.now(),
    label: meta.label || existing.label || '',
    section: meta.section || existing.section || '',
  }
  if (key) state.mediaMeta[key] = entry
  if (src) state.mediaMeta[src] = entry
  persistMediaMeta()
}


export function recordAudit(entry: Partial<AuditEntry> & { user?: string }) {
  state.audit.push({
    ts: Date.now(),
    user: entry.user || 'Administrador',
    section: entry.section || '',
    label: entry.label || '',
    kind: entry.kind || 'gestión',
    summary: entry.summary || '',
    file: entry.file || null,
  })
  persistAudit()
  emit()
}

export function setAdminFlag(on: boolean, username?: string) {
  state.isAdmin = on
  state.username = on ? username || state.username : ''
  // la sesión real vive en la cookie httpOnly `sid` (server-side); el
  // localStorage es solo un hint de UX para pintar rápido al recargar.
  try { localStorage.setItem(LS.ADMIN, on ? '1' : '0') } catch {}
  emit()
}

export const kindOf = (e: { kind?: string; type?: string; name?: string; key?: string }): 'image' | 'video' => {
  if (e.key) {
    const meta = getContainerMeta(e.key)
    if (meta && (meta.kind === 'image' || meta.kind === 'video')) return meta.kind
  }
  return e.kind === 'video' || isVideo(e.type, e.name) ? 'video' : 'image'
}

export function getFormat(e: { type?: string; src?: string; dataUrl?: string; name?: string }): string {
  if (e.type && e.type.includes('/')) return e.type.split('/')[1]
  const src = e.src || e.dataUrl || e.name || ''
  const match = src.match(/\.([a-zA-Z0-9]+)(?:[?#]|$)/)
  if (match) return match[1]
  return e.type && e.type !== 'image' && e.type !== 'video' ? e.type : '—'
}

export const sumSizes = (arr: { size?: number | null; src?: string; dataUrl?: string; url?: string }[]) => {
  const seen = new Set<string>()
  return arr.reduce((s, e) => {
    const id = (e as { src?: string }).src || (e as { dataUrl?: string }).dataUrl || (e as { url?: string }).url
    if (id) {
      if (seen.has(id)) return s
      seen.add(id)
    }
    return s + (e.size || 0)
  }, 0)
}

export const deduplicateMedia = <T extends { src?: string; dataUrl?: string; url?: string }>(arr: T[]): T[] => {
  const seen = new Set<string>()
  return arr.filter((e) => {
    const id = (e as { src?: string }).src || (e as { dataUrl?: string }).dataUrl || (e as { url?: string }).url
    if (!id) return true
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}


// ----- Metadata de contenedores (port de admin.js getContainerMeta) ---------

const CONTAINER_BASES: Record<string, { section: string; label: (n: number) => string; kind: 'image' | 'video' | 'text' }> = {
  'loader.gallop': { section: 'Site Configuration', label: () => 'Loading Screen', kind: 'video' },
  'settings.faviconUrl': { section: 'Site Configuration', label: () => 'Favicon', kind: 'image' },
  'hero-main.slide': { section: 'Hero', label: (n) => `Main Carousel Image #${n}`, kind: 'image' },
  'hero-sub.slide': { section: 'Hero', label: (n) => `Secondary Carousel Image #${n}`, kind: 'image' },
  'hero.slide': { section: 'Hero', label: (n) => `Carousel Image #${n}`, kind: 'image' },
  'about-carousel.slide': { section: 'About me', label: (n) => `About me Carousel Image #${n}`, kind: 'image' },
  'hero.wave': { section: 'Hero', label: (n) => `Wave Tool #${n}`, kind: 'image' },
  'hero.marquee': { section: 'Hero', label: (n) => `Wave Tool #${n}`, kind: 'image' },
  'soft.hero': { section: 'Hero', label: (n) => `Hero Stack Logo #${n}`, kind: 'image' },
  'soft.global': { section: 'Animations', label: (n) => `Animations Stack Logo #${n}`, kind: 'image' },
  'anim.bg': { section: 'Animations', label: (n) => `Animations Background Video #${n}`, kind: 'video' },
  'hero.subtitle': { section: 'Hero', label: () => 'Subtitle (below title) — Hero', kind: 'text' },
  'about.title': { section: 'About me', label: () => 'Title — About me', kind: 'text' },
  'about.desc': { section: 'About me', label: () => 'Biography — About me', kind: 'text' },
  'about.video': { section: 'About me', label: () => 'Video — About me', kind: 'video' },
  'subtitle': { section: 'Subtitles', label: (n) => `Subtitle #${n}`, kind: 'text' },
  'char': { section: 'Characters', label: (n) => `Character #${n}`, kind: 'image' },
  'illustration': { section: 'Illustrations', label: (n) => `Illustration #${n}`, kind: 'image' },
  'anim.title': { section: 'Animations', label: () => 'Section Title — Animations', kind: 'text' },
  'anim.desc': { section: 'Animations', label: () => 'Description — Animations', kind: 'text' },
  'anim.soft': { section: 'Animations', label: (n) => `Software Logo #${n}`, kind: 'image' },
  'anim.softname': { section: 'Animations', label: (n) => `Software Name #${n}`, kind: 'text' },
  'anim': { section: 'Animations', label: (n) => `Animation #${n}`, kind: 'video' },
  'proj': { section: 'Projects', label: (n) => `Project #${n}`, kind: 'image' },
  'proj.soft': { section: 'Projects', label: (n) => `Software Logo #${n}`, kind: 'image' },
  'char.title': { section: 'Characters', label: () => 'Section Title — Characters', kind: 'text' },
  'char.sectiondesc': { section: 'Characters', label: () => 'Description — Characters', kind: 'text' },
  'char.soft': { section: 'Characters', label: (n) => `Software Logo #${n}`, kind: 'image' },
  'char.softname': { section: 'Characters', label: (n) => `Software Name #${n}`, kind: 'text' },
  'model3d.soft': { section: '3D Models', label: (n) => `Software Logo #${n}`, kind: 'image' },
  'model3d.softname': { section: '3D Models', label: (n) => `Software Name #${n}`, kind: 'text' },
  'model3d.heading': { section: '3D Models', label: () => 'Section Name — 3D', kind: 'text' },
  'model3d.intro': { section: '3D Models', label: () => 'Introductory Text — 3D', kind: 'text' },
  'model3d.title': { section: '3D Models', label: (n) => `Block Title #${n} — 3D`, kind: 'text' },
  'model3d.desc': { section: '3D Models', label: (n) => `Block Text #${n} — 3D`, kind: 'text' },
  'model3d': { section: '3D Models', label: (n) => `3D Video #${n}`, kind: 'video' },
  'model3d.gallery': { section: '3D Models', label: (n) => `3D Image #${n}`, kind: 'image' },
}

export function getContainerMeta(key: string): { label: string; section: string; kind: 'image' | 'video' | 'text' } {
  const customLabel = state.containerNames[key]
  const [base, idxStr] = key.split('#')
  const n = (idxStr ? parseInt(idxStr, 10) : 0) + 1
  const def = CONTAINER_BASES[base]
  if (!def) return { label: customLabel || key, section: 'Otros', kind: 'image' }
  return { label: customLabel || def.label(n), section: def.section, kind: def.kind }
}

function tryParseCount(jsonStr: string | undefined, fallback = 6): number {
  if (!jsonStr) return fallback
  try {
    const p = JSON.parse(jsonStr)
    if (p && typeof p.count === 'number' && p.count > 0) return p.count
  } catch {}
  return fallback
}

export function getAllKnownContainerKeys(): string[] {
  const keys = new Set<string>()
  // 1) Claves estándar del sitio
  const standard: string[] = [
    'loader.gallop',
    'settings.faviconUrl',
    'anim.bg',
    'about.video',
    ...Array.from({ length: 5 }, (_, i) => `hero-main.slide#${i}`),
    ...Array.from({ length: 5 }, (_, i) => `hero-sub.slide#${i}`),
    ...Array.from({ length: 5 }, (_, i) => `hero.slide#${i}`),
    ...Array.from({ length: 5 }, (_, i) => `about-carousel.slide#${i}`),
    ...Array.from({ length: 11 }, (_, i) => `hero.wave#${i}`),
    ...Array.from({ length: 11 }, (_, i) => `hero.marquee#${i}`),
    ...Array.from({ length: 6 }, (_, i) => `soft.global#${i}`),
    ...Array.from({ length: Math.max(6, tryParseCount(state.items['char.settings'])) }, (_, i) => `char#${i}`),
    ...Array.from({ length: 3 }, (_, i) => `char.soft#${i}`),
    ...Array.from({ length: 15 }, (_, i) => `illustration#${i}`),
    ...Array.from({ length: Math.max(6, tryParseCount(state.items['anim.settings'])) }, (_, i) => `anim#${i}`),
    ...Array.from({ length: 4 }, (_, i) => `anim.soft#${i}`),
    ...Array.from({ length: Math.max(4, tryParseCount(state.items['proj.settings'], 4)) }, (_, i) => `proj#${i}`),
    ...Array.from({ length: 6 }, (_, i) => `proj.soft#${i}`),
    ...Array.from({ length: 6 }, (_, i) => `model3d#${i}`),
    ...Array.from({ length: 12 }, (_, i) => `model3d.gallery#${i}`),
    ...Array.from({ length: 4 }, (_, i) => `model3d.soft#${i}`),
  ]
  standard.forEach(k => keys.add(k))
  // 2) Claves en uso, retiradas, sin usar o en papelera
  Object.keys(state.usedContent).forEach(k => keys.add(k))
  state.retired.forEach(k => keys.add(k))
  state.unused.forEach(u => { if (u.key) keys.add(u.key) })
  state.trash.forEach(t => { if (t.key) keys.add(t.key) })
  Object.keys(state.containerNames).forEach(k => keys.add(k))
  // 3) Claves en items que correspondan a contenedores de media conocidos
  Object.keys(state.items).forEach(k => {
    if (/^(?:char|proj|anim|illustration|model3d|hero|hero-main|hero-sub|about-carousel|soft|model3d\.gallery|char\.soft|anim\.soft|proj\.soft|model3d\.soft|hero\.wave|hero\.marquee)(?:#\d+)?$/.test(k)) {
      keys.add(k)
    }
  })
  return Array.from(keys)
}

// ----- Operaciones de gestión (port de admin.js) -----------------------------

import { getCloudinaryFolder } from '@/lib/cms/pages'

/** Mueve un asset en Cloudinary de forma fire-and-forget y actualiza la URL
 *  en todos los arrays del estado donde aparezca. */
export function cloudinaryMove(oldUrl: string, newFolder: string) {
  if (!oldUrl || !oldUrl.includes('cloudinary.com')) return
  moveMedia(oldUrl, newFolder).then(({ newUrl }) => {
    if (newUrl === oldUrl) return // sin cambios
    // Actualizar la URL en usedContent
    for (const k of Object.keys(state.usedContent)) {
      if (state.usedContent[k].src === oldUrl) {
        state.usedContent[k].src = newUrl
        if (state.items[k] === oldUrl) state.items[k] = newUrl
      }
    }
    // Actualizar en unused
    state.unused.forEach((e) => {
      if (e.src === oldUrl) { e.src = newUrl; if (e.dataUrl === oldUrl) e.dataUrl = newUrl }
    })
    // Actualizar en trash
    state.trash.forEach((e) => {
      if (e.src === oldUrl) { e.src = newUrl; if (e.dataUrl === oldUrl) e.dataUrl = newUrl }
    })
    persistUsed(); persistUnused(); persistTrash(); persistOverridesLocal()
    scheduleSyncToServer('overrides')
    emit()
  }).catch(() => {})
}

/** Sincroniza automáticamente las carpetas de Cloudinary (en-uso, sin-usar, basurero)
 *  según el estado actual del CMS para corregir archivos que hayan quedado en carpetas incorrectas. */
export function syncCloudinaryFolders(): number {
  if (!state.isAdmin) return 0
  let count = 0
  // 0. Contenidos activos en overrides del sitio (state.items) -> portfolio/en-uso
  Object.values(state.items).forEach((val) => {
    if (typeof val === 'string' && val.includes('cloudinary.com') && !val.includes('/portfolio/en-uso/') && !val.includes('/portfolio/basurero/')) {
      cloudinaryMove(val, 'portfolio/en-uso')
      count++
    }
  })
  // 1. Contenidos en uso -> portfolio/en-uso
  Object.values(state.usedContent).forEach((entry) => {
    if (entry && entry.src && entry.src.includes('cloudinary.com') && !entry.src.includes('/portfolio/en-uso/')) {
      cloudinaryMove(entry.src, 'portfolio/en-uso')
      count++
    }
  })
  // 2. Contenidos sin usar -> portfolio/sin-usar
  state.unused.forEach((entry) => {
    const src = entry.src || entry.dataUrl
    if (src && src.includes('cloudinary.com') && !src.includes('/portfolio/sin-usar/')) {
      cloudinaryMove(src, 'portfolio/sin-usar')
      count++
    }
  })
  // 3. Contenidos en basurero -> portfolio/basurero
  state.trash.forEach((entry) => {
    const src = entry.src || entry.dataUrl
    if (src && src.includes('cloudinary.com') && !src.includes('/portfolio/basurero/')) {
      cloudinaryMove(src, 'portfolio/basurero')
      count++
    }
  })
  if (count > 0) {
    console.log(`[syncCloudinaryFolders] Sincronizando ${count} archivos a sus carpetas correctas...`)
  }
  return count
}

/** Valida que las URLs de Cloudinary del CMS sigan existiendo.
 *  Las que ya no existen se purgan del estado con purgeUrlsFromAllState().
 *  Devuelve la cantidad de contenidos eliminados. */
export async function validateCloudinaryContent(): Promise<number> {
  if (!state.isAdmin) return 0
  // Recopilar todas las URLs de Cloudinary únicas del estado
  const urls = new Set<string>()
  Object.values(state.usedContent).forEach((e) => {
    if (e?.src?.includes('cloudinary.com')) urls.add(e.src)
  })
  state.unused.forEach((e) => {
    if (e.src?.includes('cloudinary.com')) urls.add(e.src)
    if (e.dataUrl?.includes('cloudinary.com')) urls.add(e.dataUrl)
  })
  state.trash.forEach((e) => {
    if (e.src?.includes('cloudinary.com')) urls.add(e.src)
    if (e.dataUrl?.includes('cloudinary.com')) urls.add(e.dataUrl)
  })
  Object.values(state.items).forEach((val) => {
    if (typeof val === 'string' && val.includes('cloudinary.com')) urls.add(val)
  })
  const uploadHist = loadJSON<{ secure_url?: string }[]>(LS.UPLOAD_TEST, [])
  uploadHist.forEach((h) => {
    if (h?.secure_url?.includes('cloudinary.com')) urls.add(h.secure_url)
  })
  if (urls.size === 0) return 0
  const results = await verifyMedia(Array.from(urls))
  if (results.length === 0) return 0 // endpoint no disponible o error
  const missing = results.filter((r) => !r.exists).map((r) => r.url)
  if (missing.length === 0) return 0
  console.warn(`[validateCloudinaryContent] ${missing.length} contenido(s) ya no existen en Cloudinary:`, missing)
  purgeUrlsFromAllState(missing)
  return missing.length
}

/** Verifica si una URL de Cloudinary específica sigue existiendo.
 *  Para uso puntual (ej. antes de asignar desde repo). */
export async function verifySingleUrl(url: string): Promise<boolean> {
  if (!url || !url.includes('cloudinary.com')) return true
  const results = await verifyMedia([url])
  if (results.length === 0) return true // endpoint no disponible → asumir OK
  return results[0].exists
}

export function retireUsedEntryToUnused(entry: UsedEntry, reason: 'retired' | 'replaced' | 'deleted' | 'upload' = 'retired', ignoreKeys: string[] = []) {
  if (!entry || !entry.src) return
  const id = entry.src
  const otherUses = Object.values(state.usedContent).filter(u => u.src === id && u.key !== entry.key && !ignoreKeys.includes(u.key))
  if (otherUses.length === 0) {
    const alreadyInUnused = state.unused.some(u => (u.src || u.dataUrl) === id)
    if (!alreadyInUnused) {
      state.unused.push({
        key: entry.key, src: entry.src, name: entry.name, size: entry.size,
        type: entry.kind === 'video' ? 'video/webm' : 'image/webp', ts: Date.now(),
        label: entry.label, section: entry.section, original: entry.original, reason,
      })
      // Mover en Cloudinary: en-uso → sin-usar
      if (entry.src) cloudinaryMove(entry.src, 'portfolio/sin-usar')
    }
  }
}

export function clearItemOverrides(keys: string[]) {
  if (!keys.length) return
  const cleared: Record<string, string> = {}
  keys.forEach((key) => {
    delete state.items[key]
    cleared[key] = ''
    Object.keys(state.items).forEach((k) => {
      if (k.startsWith(key + '::')) {
        delete state.items[k]
        cleared[k] = ''
      }
    })
  })
  persistOverridesLocal()
  // Persist removal to DB (DB first strategy)
  saveContent(cleared).catch(() => {})
}

/** Alias used when we want to clear overrides without persisting to localStorage first */
export const clearOverridesForKeys = clearItemOverrides
export function purgeUrlsFromAllState(urls: string[]) {
  if (!urls || !urls.length) return
  const urlSet = new Set(urls.filter(Boolean))
  if (!urlSet.size) return

  const keysToClear: string[] = []
  let usedChanged = false
  let unusedChanged = false
  let trashChanged = false

  Object.keys(state.usedContent).forEach((key) => {
    const entry = state.usedContent[key]
    if (entry && (urlSet.has(entry.src) || ('dataUrl' in entry && typeof (entry as { dataUrl?: string }).dataUrl === 'string' && urlSet.has((entry as { dataUrl?: string }).dataUrl!)))) {
      delete state.usedContent[key]
      keysToClear.push(key)
      if (!state.retired.includes(key)) state.retired.push(key)
      usedChanged = true
    }
  })

  Object.keys(state.items).forEach((key) => {
    const val = state.items[key]
    if (val && urlSet.has(val)) {
      if (!keysToClear.includes(key)) {
        keysToClear.push(key)
        if (!state.retired.includes(key) && !key.includes('::') && !key.endsWith('.settings')) {
          state.retired.push(key)
        }
      }
    }
  })

  const initialUnusedLen = state.unused.length
  state.unused = state.unused.filter((e) => !urlSet.has(e.src) && (!e.dataUrl || !urlSet.has(e.dataUrl)))
  if (state.unused.length !== initialUnusedLen) unusedChanged = true

  const initialTrashLen = state.trash.length
  state.trash = state.trash.filter((e) => !urlSet.has(e.src) && (!e.dataUrl || !urlSet.has(e.dataUrl)))
  if (state.trash.length !== initialTrashLen) trashChanged = true

  if (keysToClear.length > 0) {
    clearItemOverrides(keysToClear)
  }
  const hist = loadJSON<{ secure_url?: string }[]>(LS.UPLOAD_TEST, [])
  if (hist.length > 0) {
    const newHist = hist.filter((h) => !h.secure_url || !urlSet.has(h.secure_url))
    if (newHist.length !== hist.length) {
      saveJSON(LS.UPLOAD_TEST, newHist)
    }
  }
  if (usedChanged) { persistUsed(); persistRetired() }
  if (unusedChanged) { persistUnused() }
  if (trashChanged) { persistTrash() }
  if (usedChanged || unusedChanged || trashChanged || keysToClear.length > 0 || hist.length > 0) { 
    emit() 
    flushSyncToServer() // Ensure immediate sync to prevent reappearing on reload
  }
}

export function cleanOrphanOverrides() {
  const validUrls = new Set<string>()
  Object.values(state.usedContent).forEach((e) => { if (e && e.src) validUrls.add(e.src) })
  state.unused.forEach((e) => {
    if (e && e.src) validUrls.add(e.src)
    if (e && 'dataUrl' in e && typeof (e as { dataUrl?: string }).dataUrl === 'string' && (e as { dataUrl?: string }).dataUrl) {
      validUrls.add((e as { dataUrl?: string }).dataUrl!)
    }
  })
  state.trash.forEach((e) => {
    if (e && e.src) validUrls.add(e.src)
    if (e && 'dataUrl' in e && typeof (e as { dataUrl?: string }).dataUrl === 'string' && (e as { dataUrl?: string }).dataUrl) {
      validUrls.add((e as { dataUrl?: string }).dataUrl!)
    }
  })

  const keysToClear: string[] = []
  Object.entries(state.items).forEach(([key, val]) => {
    if (key.startsWith('settings.') || key === 'loader.gallop') return
    if (typeof val === 'string' && (val.includes('cloudinary.com') || val.startsWith('data:image') || val.startsWith('data:video'))) {
      if (!validUrls.has(val)) {
        keysToClear.push(key)
        if (!state.retired.includes(key) && !key.includes('::') && !key.endsWith('.settings')) {
          state.retired.push(key)
        }
      }
    }
  })

  if (keysToClear.length > 0) {
    clearItemOverrides(keysToClear)
    persistRetired()
    emit()
  }

  // Normalizar conteo por defecto de proyectos (de 6 a 4) si el usuario tiene guardado 6 de versiones anteriores pero no hay proyectos reales en slots #4 y #5.
  try {
    const s = JSON.parse(state.items['proj.settings'] || '')
    if (s && s.count === 6 && !state.items['proj#4'] && !state.items['proj#5']) {
      s.count = 4
      state.items['proj.settings'] = JSON.stringify(s)
      clearItemOverrides(['proj#4', 'proj#5', 'proj#4::title', 'proj#4::summary', 'proj#4::start_date', 'proj#5::title', 'proj#5::summary', 'proj#5::start_date'])
      saveContent({ 'proj.settings': state.items['proj.settings'], 'proj#4': '', 'proj#5': '' }).catch(() => {})
      emit()
    }
  } catch {}
}

export function moveUsedToUnused(key: string) {
  const entry = state.usedContent[key]
  if (!entry) return
  retireUsedEntryToUnused(entry, 'retired', [key])
  delete state.usedContent[key]
  if (!state.retired.includes(key)) state.retired.push(key)
  clearItemOverrides([key])
  persistUsed(); persistUnused(); persistRetired()
  recordAudit({ section: entry.section, label: entry.label, summary: 'Contenido movido a no usados' })
}

export function moveUnusedToTrash(idx: number) {
  const entry = state.unused.splice(idx, 1)[0]
  if (!entry) return
  entry.deletedAt = Date.now()
  state.trash.push(entry)
  persistUnused(); persistTrash()
  recordAudit({ section: entry.section, label: entry.label, summary: 'Moved to trash' })
  // Mover en Cloudinary: sin-usar → basurero
  cloudinaryMove(entry.src || entry.dataUrl || '', 'portfolio/basurero')
}

export function restoreTrashToUnused(idx: number) {
  const entry = state.trash.splice(idx, 1)[0]
  if (!entry) return
  state.unused.push(entry)
  persistTrash(); persistUnused()
  recordAudit({ section: entry.section, label: entry.label, summary: 'Restored from trash to unused' })
  // Mover en Cloudinary: basurero → sin-usar
  cloudinaryMove(entry.src || entry.dataUrl || '', 'portfolio/sin-usar')
}

/** Restaura un "sin usar" a su ubicación original; lo que hubiera ahí pasa a no usados. */
export function performRestore(idx: number) {
  const entry = state.unused[idx]
  if (!entry || !entry.key) return
  const key = entry.key
  state.unused.splice(idx, 1)
  const cur = state.usedContent[key]
  if (cur) {
    retireUsedEntryToUnused(cur, 'replaced', [key])
  }
  state.usedContent[key] = {
    key, label: entry.label, section: entry.section, kind: kindOf(entry),
    src: entry.src, name: entry.name, size: entry.size, original: !!entry.original, ts: entry.ts,
  }
  state.items[key] = entry.src
  const ri = state.retired.indexOf(key)
  if (ri >= 0) state.retired.splice(ri, 1)
  persistUnused(); persistUsed(); persistRetired(); persistOverridesLocal()
  recordAudit({ section: entry.section, label: entry.label, summary: 'Contenido restaurado a su ubicación' })
  // Mover en Cloudinary: sin-usar → en-uso/pagina/seccion
  cloudinaryMove(entry.src, getCloudinaryFolder(entry.section))
}

export function performRenameContainer(key: string, newLabel: string) {
  let oldLabel = state.containerNames[key]
  state.containerNames[key] = newLabel
  saveJSON(LS.CONTAINER_NAMES, state.containerNames)
  scheduleSyncToServer('container_names')
  if (state.usedContent[key]) {
    if (!oldLabel) oldLabel = state.usedContent[key].label
    state.usedContent[key].label = newLabel
    persistUsed()
  }
  state.unused.forEach((it) => { if (it.key === key) { if (!oldLabel) oldLabel = it.label; it.label = newLabel } })
  persistUnused()
  state.trash.forEach((it) => { if (it.key === key) { if (!oldLabel) oldLabel = it.label; it.label = newLabel } })
  persistTrash()
  recordAudit({
    section: (state.usedContent[key] && state.usedContent[key].section) || 'Contenedores',
    label: newLabel,
    summary: `Contenedor renombrado (anterior: ${oldLabel || key})`,
  })
}

function occupyTarget(targetKey: string) {
  const cur = state.usedContent[targetKey]
  if (cur) {
    retireUsedEntryToUnused(cur, 'replaced', [targetKey])
  } else {
    const ri = state.retired.indexOf(targetKey)
    if (ri >= 0) state.retired.splice(ri, 1)
  }
}

export function associateUnusedToContainer(unusedIdx: number, targetKey: string) {
  const entry = state.unused.splice(unusedIdx, 1)[0]
  if (!entry) return
  const targetMeta = getContainerMeta(targetKey)
  occupyTarget(targetKey)
  const src = entry.src || entry.dataUrl || ''
  state.usedContent[targetKey] = {
    key: targetKey, label: targetMeta.label, section: targetMeta.section, kind: kindOf(entry),
    src, name: entry.name, size: entry.size, original: !!entry.original, ts: entry.ts,
  }
  state.items[targetKey] = src
  persistUsed(); persistUnused(); persistRetired(); persistOverridesLocal()
  recordAudit({ section: targetMeta.section, label: targetMeta.label, summary: 'Unused content associated with container' })
  // Mover en Cloudinary: sin-usar → en-uso/pagina/seccion
  cloudinaryMove(src, getCloudinaryFolder(targetMeta.section))
}

export function associateUsedToContainer(oldKey: string, targetKey: string) {
  if (oldKey === targetKey) return
  const entry = state.usedContent[oldKey]
  if (!entry) return
  const targetMeta = getContainerMeta(targetKey)
  delete state.usedContent[oldKey]
  if (!state.retired.includes(oldKey)) state.retired.push(oldKey)
  clearItemOverrides([oldKey])
  occupyTarget(targetKey)
  state.usedContent[targetKey] = {
    key: targetKey, label: targetMeta.label, section: targetMeta.section, kind: kindOf(entry),
    src: entry.src, name: entry.name, size: entry.size, original: entry.original, ts: entry.ts,
  }
  state.items[targetKey] = entry.src
  persistUsed(); persistUnused(); persistRetired(); persistOverridesLocal()
  recordAudit({ section: targetMeta.section, label: targetMeta.label, summary: `Contenido movido de contenedor ${oldKey} a ${targetKey}` })
  // Mover en Cloudinary: en-uso/paginaA/seccionA → en-uso/paginaB/seccionB
  if (entry.section !== targetMeta.section) {
    cloudinaryMove(entry.src, getCloudinaryFolder(targetMeta.section))
  }
}

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

// ----- Estado + suscripción -------------------------------------------------

export const state = {
  loaded: false,                              // loadState() ya corrió en este cliente
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

export const persistAudit = () => saveJSON(LS.AUDIT, state.audit.slice(-300))
export const persistUnused = () => saveJSON(LS.UNUSED, state.unused)
export const persistUsed = () => saveJSON(LS.USED, state.usedContent)
export const persistRetired = () => saveJSON(LS.RETIRED, state.retired)
export const persistTrash = () => saveJSON(LS.TRASH, state.trash)
export const persistOverridesLocal = () => saveJSON(LS.OVERRIDES, state.items)

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

export const kindOf = (e: { kind?: string; type?: string; name?: string }): 'image' | 'video' =>
  e.kind === 'video' || isVideo(e.type, e.name) ? 'video' : 'image'

export function getFormat(e: { type?: string; src?: string; dataUrl?: string; name?: string }): string {
  if (e.type && e.type.includes('/')) return e.type.split('/')[1]
  const src = e.src || e.dataUrl || e.name || ''
  const match = src.match(/\.([a-zA-Z0-9]+)(?:[?#]|$)/)
  if (match) return match[1]
  return e.type && e.type !== 'image' && e.type !== 'video' ? e.type : '—'
}

export const sumSizes = (arr: { size?: number | null }[]) =>
  arr.reduce((s, e) => s + (e.size || 0), 0)


// ----- Metadata de contenedores (port de admin.js getContainerMeta) ---------

const CONTAINER_BASES: Record<string, { section: string; label: (n: number) => string; kind: 'image' | 'video' | 'text' }> = {
  'hero.slide': { section: 'Portada', label: (n) => `Imagen Carrusel #${n}`, kind: 'image' },
  'hero.wave': { section: 'Portada', label: (n) => `Herramienta Wave #${n}`, kind: 'image' },
  'soft.hero': { section: 'Portada', label: (n) => `Logo Stack Portada #${n}`, kind: 'image' },
  'soft.global': { section: 'Animaciones', label: (n) => `Logo Stack Animaciones #${n}`, kind: 'image' },
  'anim.bg': { section: 'Animaciones', label: (n) => `Video Fondo Animaciones #${n}`, kind: 'video' },
  'hero.subtitle': { section: 'Portada', label: () => 'Bajada (debajo del título) — Portada', kind: 'text' },
  'about.title': { section: 'Sobre mí', label: () => 'Título — Sobre mí', kind: 'text' },
  'about.desc': { section: 'Sobre mí', label: () => 'Biografía — Sobre mí', kind: 'text' },
  'about.photo': { section: 'Sobre mí', label: () => 'Foto de Lucía — Sobre mí', kind: 'image' },
  'about.video': { section: 'Sobre mí', label: () => 'Video — Sobre mí', kind: 'video' },
  'subtitle': { section: 'Subtítulos', label: (n) => `Subtítulo #${n}`, kind: 'text' },
  'char': { section: 'Characters', label: (n) => `Personaje #${n}`, kind: 'image' },
  'illustration': { section: 'Ilustraciones', label: (n) => `Ilustración #${n}`, kind: 'image' },
  'anim.title': { section: 'Animations', label: () => 'Título de sección — Animations', kind: 'text' },
  'anim.desc': { section: 'Animations', label: () => 'Descripción — Animations', kind: 'text' },
  'anim.soft': { section: 'Animations', label: (n) => `Logo de software #${n}`, kind: 'image' },
  'anim.softname': { section: 'Animations', label: (n) => `Nombre de software #${n}`, kind: 'text' },
  'anim': { section: 'Animations', label: (n) => `Animación #${n}`, kind: 'video' },
  'char.title': { section: 'Characters', label: () => 'Título de sección — Characters', kind: 'text' },
  'char.sectiondesc': { section: 'Characters', label: () => 'Descripción — Characters', kind: 'text' },
  'char.soft': { section: 'Characters', label: (n) => `Logo de software #${n}`, kind: 'image' },
  'char.softname': { section: 'Characters', label: (n) => `Nombre de software #${n}`, kind: 'text' },
  'model3d.soft': { section: '3D Models', label: (n) => `Logo de software #${n}`, kind: 'image' },
  'model3d.softname': { section: '3D Models', label: (n) => `Nombre de software #${n}`, kind: 'text' },
  'model3d.heading': { section: '3D Models', label: () => 'Nombre de la sección — 3D', kind: 'text' },
  'model3d.intro': { section: '3D Models', label: () => 'Texto introductorio — 3D', kind: 'text' },
  'model3d.title': { section: '3D Models', label: (n) => `Título bloque #${n} — 3D`, kind: 'text' },
  'model3d.desc': { section: '3D Models', label: (n) => `Texto bloque #${n} — 3D`, kind: 'text' },
  'model3d': { section: '3D Models', label: (n) => `Video 3D #${n}`, kind: 'video' },
}

export function getContainerMeta(key: string): { label: string; section: string; kind: 'image' | 'video' | 'text' } {
  const customLabel = state.containerNames[key]
  const [base, idxStr] = key.split('#')
  const n = (idxStr ? parseInt(idxStr, 10) : 0) + 1
  const def = CONTAINER_BASES[base]
  if (!def) return { label: customLabel || key, section: 'Otros', kind: 'image' }
  return { label: customLabel || def.label(n), section: def.section, kind: def.kind }
}

// ----- Operaciones de gestión (port de admin.js) -----------------------------

export function moveUsedToUnused(key: string) {
  const entry = state.usedContent[key]
  if (!entry) return
  state.unused.push({
    key, src: entry.src, dataUrl: entry.src, name: entry.name, size: entry.size,
    type: entry.kind === 'video' ? 'video/webm' : 'image/webp', ts: Date.now(),
    label: entry.label, section: entry.section, original: entry.original, reason: 'retired',
  })
  delete state.usedContent[key]
  delete state.items[key]
  if (!state.retired.includes(key)) state.retired.push(key)
  persistUsed(); persistUnused(); persistRetired(); persistOverridesLocal()
  recordAudit({ section: entry.section, label: entry.label, summary: 'Contenido movido a no usados' })
}

export function moveUnusedToTrash(idx: number) {
  const entry = state.unused.splice(idx, 1)[0]
  if (!entry) return
  entry.deletedAt = Date.now()
  state.trash.push(entry)
  persistUnused(); persistTrash()
  recordAudit({ section: entry.section, label: entry.label, summary: 'Movido al basurero' })
}

export function restoreTrashToUnused(idx: number) {
  const entry = state.trash.splice(idx, 1)[0]
  if (!entry) return
  state.unused.push(entry)
  persistTrash(); persistUnused()
  recordAudit({ section: entry.section, label: entry.label, summary: 'Restaurado desde basurero a sin usar' })
}

/** Restaura un "sin usar" a su ubicación original; lo que hubiera ahí pasa a no usados. */
export function performRestore(idx: number) {
  const entry = state.unused[idx]
  if (!entry || !entry.key) return
  const key = entry.key
  state.unused.splice(idx, 1)
  const cur = state.usedContent[key]
  if (cur) {
    state.unused.push({
      key, src: cur.src, dataUrl: cur.src, name: cur.name, size: cur.size,
      type: cur.kind === 'video' ? 'video/webm' : 'image/webp', ts: Date.now(),
      label: cur.label, section: cur.section, original: cur.original, reason: 'replaced',
    })
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
}

export function performRenameContainer(key: string, newLabel: string) {
  let oldLabel = state.containerNames[key]
  state.containerNames[key] = newLabel
  saveJSON(LS.CONTAINER_NAMES, state.containerNames)
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
    state.unused.push({
      key: targetKey, src: cur.src, dataUrl: cur.src, name: cur.name, size: cur.size,
      type: cur.kind === 'video' ? 'video/webm' : 'image/webp', ts: Date.now(),
      label: cur.label, section: cur.section, original: cur.original, reason: 'replaced',
    })
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
  state.usedContent[targetKey] = {
    key: targetKey, label: targetMeta.label, section: targetMeta.section, kind: kindOf(entry),
    src: entry.src || entry.dataUrl || '', name: entry.name, size: entry.size, original: !!entry.original, ts: entry.ts,
  }
  state.items[targetKey] = entry.src || entry.dataUrl || ''
  persistUsed(); persistUnused(); persistRetired(); persistOverridesLocal()
  recordAudit({ section: targetMeta.section, label: targetMeta.label, summary: 'Contenido sin usar asociado a contenedor' })
}

export function associateUsedToContainer(oldKey: string, targetKey: string) {
  if (oldKey === targetKey) return
  const entry = state.usedContent[oldKey]
  if (!entry) return
  const targetMeta = getContainerMeta(targetKey)
  delete state.usedContent[oldKey]
  delete state.items[oldKey]
  if (!state.retired.includes(oldKey)) state.retired.push(oldKey)
  occupyTarget(targetKey)
  state.usedContent[targetKey] = {
    key: targetKey, label: targetMeta.label, section: targetMeta.section, kind: kindOf(entry),
    src: entry.src, name: entry.name, size: entry.size, original: entry.original, ts: entry.ts,
  }
  state.items[targetKey] = entry.src
  persistUsed(); persistUnused(); persistRetired(); persistOverridesLocal()
  recordAudit({ section: targetMeta.section, label: targetMeta.label, summary: `Contenido movido de contenedor ${oldKey} a ${targetKey}` })
}

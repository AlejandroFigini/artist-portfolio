'use client'

/* Estado CMS compartido entre el sitio (overlay de edición) y /admin.
   Unifica los persist*() de cms.js y los load/save de admin.js sobre
   las MISMAS claves de localStorage (los datos del legacy se conservan).
   React se suscribe vía useCmsStore() (useSyncExternalStore). */

import { useSyncExternalStore } from 'react'
import { isVideo } from '@/lib/utils'
import { BASE_LANG, ui, type Lang } from '@/lib/i18n'
import { COLLECTIONS, collectionOf, fixedSlotKeys, isCollectionTextKey } from '@/lib/cms/collections'
import { readSettings, mediaKeysOf } from '@/lib/cms/collection'
import type { MediaFacts } from '@/lib/cms/media-filter'
import { isNonMediaSettingsKey, ANIM_SLOTS, ANIM_FIELDS, animFields, animKey, animLabel } from '@/lib/settings'

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
  TEXT_DEFAULTS: 'cms_text_defaults_v1',
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
  /* `cms_data` YA se cargó en este cliente. Distinto de `serverReady` (que es
     cms_state). Sin esto no se puede distinguir "no hay contenido" de "el
     contenido todavía no llegó", y purgar bajo esa ambigüedad borra el índice. */
  itemsLoaded: false,
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
  role: '',                                                   // rol del usuario (owner, admin, demo)
  needsSetup: false,                                          // indica si el usuario debe cambiar credenciales
  lang: BASE_LANG as Lang,                                   // idioma activo
  translations: {} as Record<string, Record<string, string>>, // lang -> key -> valor traducido
}

/* Colecciones cuyo manager está abierto con "guardado diferido": mientras el
   prefijo está acá, asignar media a un item de esa colección NO se persiste al
   instante — el picker la deja como preview local y el commit del manager la
   guarda. Fuera de un manager abierto el set está vacío y todo persiste como
   siempre. Solo aplica a colecciones (carrusel/proyectos/personajes). */
export const deferredCollectionPrefixes = new Set<string>()

export function setCollectionDeferred(prefix: string, on: boolean) {
  if (on) deferredCollectionPrefixes.add(prefix)
  else deferredCollectionPrefixes.delete(prefix)
}

export function isDeferredMediaKey(key: string): boolean {
  const c = collectionOf(key)
  return !!c && deferredCollectionPrefixes.has(c.prefix)
}

/** Idioma guardado (localStorage). Default = base (en). */
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

/* Resolutor de texto CMS consciente del idioma. Los componentes React que
   pintan contenido editable (Projects, Characters) DEBEN leer por acá y no
   por state.items: el engine aplica el idioma mutando el DOM, y cualquier
   re-render posterior lo pisaría con el texto base. `fallback` cubre el texto
   de muestra que el componente usa cuando la clave todavía no tiene valor. */
export function t(key: string, fallback = ''): string {
  if (state.lang !== BASE_LANG) {
    const tr = state.translations[state.lang]?.[key]
    if (tr) return tr
  }
  return state.items[key] || fallback
}

/* Textos estáticos (nav, ajustes, modales, chrome de las secciones) para
   componentes React. `applyStaticTranslations` cubre el markup que el motor
   muta por data-i18n, pero un componente que se re-renderiza —o que arma el
   texto en JS (títulos condicionales, aria-labels, placeholders)— tiene que
   resolver la traducción en el propio render. Suscribe al store para repintar
   al cambiar de idioma. */
export function useUiText(): (key: string, fallback?: string, vars?: Record<string, string | number>) => string {
  useCmsStore()
  return (key: string, fallback = '', vars?: Record<string, string | number>) =>
    ui(key, state.lang, vars) || fallback
}

/* Texto por defecto de cada contenedor editable, descubierto al indexar el
   DOM. Se acumula en localStorage porque el índice solo ve la ruta montada:
   sin este caché, exportar desde /animations perdería el texto por defecto de
   las secciones que solo viven en la home. */
export function loadTextDefaults(): Record<string, string> {
  return loadJSON<Record<string, string>>(LS.TEXT_DEFAULTS, {})
}

export function recordTextDefaults(found: Record<string, string>) {
  const current = loadTextDefaults()
  let changed = false
  for (const [k, v] of Object.entries(found)) {
    if (v && current[k] !== v) { current[k] = v; changed = true }
  }
  if (changed) saveJSON(LS.TEXT_DEFAULTS, current)
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
  state.audit = []
  state.mediaMeta = {}
  state.unused = []
  state.usedContent = {}
  state.retired = []
  state.trash = []
  state.containerNames = {}
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

/* Última versión de `cms_data` que sabemos que el servidor tiene. La sincronización
   de overrides manda el DIFF contra esto, no `state.items` entero.
   Antes mandaba el mapa completo, armado desde el snapshot que se cargó al abrir
   la página: cualquier pestaña vieja pisaba con datos rancios todo lo que otra
   hubiera cambiado mientras tanto — incluso resucitando claves borradas. Con el
   diff, una pestaña solo puede escribir lo que ELLA tocó. */
let _serverItems: Record<string, string> = {}

/** El servidor y el cliente coinciden en estas claves. */
export function markItemsSynced(keys?: string[]) {
  if (!keys) { _serverItems = { ...state.items }; return }
  for (const k of keys) {
    const v = state.items[k]
    if (v === undefined || v === '') delete _serverItems[k]
    else _serverItems[k] = v
  }
}

/** Claves que este cliente cambió respecto de lo que el servidor tiene. */
function dirtyItems(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(state.items)) {
    if (typeof v === 'string' && _serverItems[k] !== v) out[k] = v
  }
  // Borradas acá pero todavía presentes en el servidor → mandar '' para que se eliminen.
  for (const k of Object.keys(_serverItems)) {
    if (state.items[k] === undefined || state.items[k] === '') out[k] = ''
  }
  return out
}

/* Vaciar una colección es legítimo (vaciar papelera, purgar sin-usar, borrar todo
   el sitio) pero también es exactamente lo que hace un cliente con estado roto.
   El servidor no puede distinguirlos mirando el payload, así que la intención se
   declara: solo las claves marcadas acá pueden llegar vacías y pisar datos. */
const _allowEmpty = new Set<string>()

/* Claves que el servidor devolvió en el último GET. Solo esas se pueden escribir:
   una clave que el servidor no mandó (porque la sesión no alcanza) se está
   pintando desde localStorage y no es fuente de verdad de nada. */
const _serverAuthoritative = new Set<string>()

/** Este vaciado es deliberado, no un cliente sin cargar. */
export function markIntentionalClear(...keys: string[]) {
  keys.forEach((k) => _allowEmpty.add(k))
}

let _syncTimer: NodeJS.Timeout | null = null
let _flushPromise: Promise<void> | null = null
const _pendingKeys = new Set<string>()

export function scheduleSyncToServer(...keys: string[]) {
  keys.forEach((k) => _pendingKeys.add(k))
  if (_syncTimer) clearTimeout(_syncTimer)
  _syncTimer = setTimeout(() => { flushSyncToServer().catch(() => {}) }, 500)
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (_syncTimer) {
      clearTimeout(_syncTimer)
      flushSyncToServer({ unload: true })
    }
  })
}

export function flushSyncToServer(opts: { unload?: boolean } = {}): Promise<void> {
  if (_syncTimer) {
    clearTimeout(_syncTimer)
    _syncTimer = null
  }
  if (!state.isAdmin || _pendingKeys.size === 0) return _flushPromise || Promise.resolve()

  /* No escribir estado antes de haberlo LEÍDO. `loadState()` deja las colecciones
     vacías y el merge con el servidor llega después; un flush en esa ventana manda
     `{}` y pisa la DB. Es la misma clase de bug que vació `used_content` en
     producción, y la guarda anti-vaciado del servidor lo estaba atajando con 409.
     Las claves NO se descartan: quedan pendientes para el próximo flush. */
  if (!state.serverReady) {
    scheduleSyncToServer()
    return _flushPromise || Promise.resolve()
  }
  const payload: CmsStatePayload = {}
  let syncOverrides = false
  /* Vaciado POR CONSUMO. Mover el último archivo de "sin usar" a un contenedor
     deja la colección en [] y la guarda anti-vaciado del servidor lo rechazaba
     con 409 ("el servidor rechazó el estado"), así que el cambio no se
     persistía. Acá el vacío es legítimo: este punto ya solo corre con
     `serverReady` y solo manda claves que el servidor dio, que es exactamente
     lo que la guarda quiere atajar. Se declara en el mismo flush que lo lleva,
     así el permiso no queda dando vueltas para un vaciado posterior. */
  const declareEmpty = (key: string, empty: boolean) => { if (empty) _allowEmpty.add(key) }
  for (const k of _pendingKeys) {
    /* Nunca escribir una clave que el servidor no nos dio: sería devolverle el
       caché local como si fuera dato bueno. `overrides` va por otro camino
       (cms_data, con su propio diff) y no aplica. */
    if (k !== 'overrides' && !_serverAuthoritative.has(k)) continue
    if (k === 'used_content') { declareEmpty(k, Object.keys(state.usedContent).length === 0); payload.used_content = state.usedContent; try { localStorage.setItem('cms_state_used_content', JSON.stringify(state.usedContent)) } catch {} }
    if (k === 'unused') { declareEmpty(k, state.unused.length === 0); payload.unused = state.unused; try { localStorage.setItem('cms_state_unused', JSON.stringify(state.unused)) } catch {} }
    if (k === 'retired') { declareEmpty(k, state.retired.length === 0); payload.retired = state.retired; try { localStorage.setItem('cms_state_retired', JSON.stringify(state.retired)) } catch {} }
    if (k === 'trash') { declareEmpty(k, state.trash.length === 0); payload.trash = state.trash; try { localStorage.setItem('cms_state_trash', JSON.stringify(state.trash)) } catch {} }
    if (k === 'media_meta') { payload.media_meta = state.mediaMeta; try { localStorage.setItem('cms_state_media_meta', JSON.stringify(state.mediaMeta)) } catch {} }
    if (k === 'audit') { payload.audit = state.audit.slice(-300); try { localStorage.setItem('cms_state_audit', JSON.stringify(payload.audit)) } catch {} }
    if (k === 'container_names') { payload.container_names = state.containerNames; try { localStorage.setItem('cms_state_container_names', JSON.stringify(state.containerNames)) } catch {} }
    if (k === 'overrides') syncOverrides = true
  }
  _pendingKeys.clear()
  const promises: Promise<unknown>[] = []
  if (_flushPromise) promises.push(_flushPromise.catch(() => {}))
  /* `media_meta` viaja en su PROPIO request. Iba pegado a `used_content` y entre
     los dos pasaban el límite de keepalive, así que el navegador descartaba el
     lote entero — incluido el índice de la biblioteca. Separados, `used_content`
     entra siempre. */
  /* La autorización se gasta SOLO en las claves que viajan en este payload. Si se
     mandaba entera, un flush que no lleva `trash` consumía el permiso de vaciar
     `trash` y el flush siguiente —el que sí lo llevaba— se comía un 409. */
  const spend = (keys: string[]) => {
    const used = keys.filter((k) => _allowEmpty.has(k))
    used.forEach((k) => _allowEmpty.delete(k))
    return used
  }
  const { media_meta, ...rest } = payload
  if (Object.keys(rest).length > 0) promises.push(saveState(rest, opts, spend(Object.keys(rest))).catch(() => {}))
  if (media_meta !== undefined) promises.push(saveState({ media_meta }, opts, spend(['media_meta'])).catch(() => {}))
  if (syncOverrides) {
    const diff = dirtyItems()
    if (Object.keys(diff).length > 0) {
      promises.push(saveContent(diff).then(() => markItemsSynced(Object.keys(diff))).catch(() => {}))
    }
  }
  
  _flushPromise = Promise.all(promises).then(() => {})
  _flushPromise.finally(() => {
    setTimeout(() => { _flushPromise = null }, 0)
  })
  return _flushPromise
}

export const persistAudit = () => { scheduleSyncToServer('audit') }
export const persistUnused = () => { scheduleSyncToServer('unused', 'media_meta') }
export const persistUsed = () => { scheduleSyncToServer('used_content', 'media_meta') }
export const persistRetired = () => { scheduleSyncToServer('retired') }
export const persistTrash = () => { scheduleSyncToServer('trash') }
export const persistOverridesLocal = () => {
  scheduleSyncToServer('overrides')
}
export const persistMediaMeta = () => { scheduleSyncToServer('media_meta') }

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
  /* Regla: si el servidor MANDÓ la key, el servidor gana — aunque venga vacía.
     Vacío significa "no hay datos", no "conservá lo local". localStorage solo se
     usa cuando la key NO viene en la respuesta (sin sesión el GET público solo
     devuelve `retired`), que es el único caso en que el servidor no opinó.
     Antes el fallback saltaba con cualquier colección vacía: la DB nunca podía
     propagar un vaciado legítimo, y un navegador con caché viejo la repoblaba. */
  const getLoc = <T,>(k: string, def: T): T => {
    try { const v = localStorage.getItem('cms_state_' + k); return v ? JSON.parse(v) as T : def } catch { return def }
  }
  /* Claves sobre las que el servidor SÍ opinó en esta sesión. Sin sesión el GET
     solo devuelve `retired`, así que el resto se pinta desde localStorage — pero
     ese caché puede estar viejo, y escribirlo de vuelta pisa la DB con datos
     incompletos. Pasó de verdad: `media_meta` bajó de 117 a 52 entradas porque un
     cliente sin sesión rellenó desde caché y después, ya con sesión, lo flusheó.
     La guarda anti-vaciado no lo atrapa: 52 no es vacío. */
  _serverAuthoritative.clear()

  const pick = <T,>(key: keyof CmsStatePayload, lsKey: string, current: T): T => {
    if (key in server) {
      _serverAuthoritative.add(key as string)
      return (server[key] ?? current) as T
    }
    return getLoc(lsKey, current)
  }

  state.usedContent = pick('used_content', 'used_content', state.usedContent)
  state.unused = pick('unused', 'unused', state.unused)
  state.retired = pick('retired', 'retired', state.retired)
  state.trash = pick('trash', 'trash', state.trash)
  state.mediaMeta = pick('media_meta', 'media_meta', state.mediaMeta)
  state.audit = pick('audit', 'audit', state.audit)
  state.containerNames = pick('container_names', 'container_names', state.containerNames)
  if ('overrides' in server) {
    state.items = (server.overrides || {}) as Record<string, string>
  }

  state.serverReady = true

  /* Los valores de texto no son archivos: si la DB todavía tiene entradas viejas
     (el bug del valor de `settings.loaderDuration` o de `char#<uid>::name`
     sembrado como media), se purgan acá —único punto por el que pasan sitio y
     panel— y el flush deja la DB limpia en vez de rehidratarlas en cada
     arranque. */
  if (purgeNonMediaEntries()) { persistUsed(); persistUnused(); persistTrash(); persistRetired() }

  emit()

  // Migración one-shot índice→uid. Se importa dinámicamente para no crear un
  // ciclo store ⇄ useCollection. Corre para CUALQUIER sesión, no solo admin:
  // sin admin logueado aplica el mismo mapeo determinista solo en memoria
  // (sin tocar el servidor), para que el sitio no se muestre vacío mientras
  // nadie migró la DB todavía (ver D1 / migrateCollections).
  import('./useCollection')
    .then((m) => m.migrateCollections())
    .catch((err) => console.error('[cms] migración de colecciones falló:', err))
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
    user: entry.user || 'Administrator',
    section: entry.section || '',
    label: entry.label || '',
    kind: entry.kind || 'management',
    summary: entry.summary || '',
    file: entry.file || null,
  })
  persistAudit()
  emit()
}

/* Purga el cache local del CMS. Se usa para el usuario demo: sus cambios viven
   solo en el navegador y no deben persistir entre sesiones ni filtrarse al sitio
   público (los overrides se aplican sin gate de admin). No toca el idioma. */
export function clearDemoLocalState() {
  const keys = [
    LS.OVERRIDES, LS.OVERRIDES_HASH, LS.GLOBAL_HASH, LS.AUDIT, LS.MEDIA, LS.UNUSED,
    LS.USED, LS.RETIRED, LS.TRASH, LS.TRASH_POLICY, LS.UPLOAD_TEST, LS.REPO_FILTER,
    LS.CONTAINER_NAMES, LS.TEXT_DEFAULTS,
    'cms_state_used_content', 'cms_state_unused', 'cms_state_retired', 'cms_state_trash',
    'cms_state_media_meta', 'cms_state_audit', 'cms_state_container_names',
  ]
  try { keys.forEach((k) => localStorage.removeItem(k)) } catch {}
}

export function setAdminFlag(on: boolean, username?: string, role?: string, needsSetup?: boolean) {
  const prevRole = state.role
  // Demo efímero: al ENTRAR o SALIR de una sesión demo, se purga el cache local
  // para arrancar de cero y no dejar rastro (ni en el sitio público de ese navegador).
  if ((on && role === 'demo') || (!on && prevRole === 'demo')) {
    clearDemoLocalState()
  }
  state.isAdmin = on
  state.username = on ? username || state.username : ''
  state.role = on ? role || state.role : ''
  state.needsSetup = on ? needsSetup || false : false
  // la sesión real vive en la cookie httpOnly `sid` (server-side); el
  // localStorage es solo un hint de UX para pintar rápido al recargar.
  try { localStorage.setItem(LS.ADMIN, on ? '1' : '0') } catch {}
  /* Escrituras encoladas ANTES de saber que había sesión (el panel resuelve
     `getAccount()` y `loadServerState()` en paralelo): el flush las rechaza por
     `!state.isAdmin` y quedan pendientes sin timer. Al confirmarse el admin se
     reprograma el envío. */
  if (on) scheduleSyncToServer()
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

export type MediaLike = {
  name?: string
  label?: string
  section?: string
  size?: number | null
  ts?: number
  type?: string
  kind?: string
  src?: string
  dataUrl?: string
  key?: string
  deletedAt?: number
}

/* Cloudinary incrusta la versión (epoch) en la URL de entrega. Es el último
   recurso para fechar un asset que llegó sin `ts` ni entrada en mediaMeta. */
const CLOUDINARY_VERSION_TS = /\/upload\/v(\d{10,})\//

/** Resuelve los datos de un medio con la MISMA cadena de fallbacks que usa la
 *  tarjeta para mostrarlos (entry → mediaMeta → versión de la URL). Si la
 *  tarjeta muestra una fecha, ordenar por fecha tiene que usar esa misma. */
export function mediaFacts(e: MediaLike, useDeletedAt = false): MediaFacts {
  const src = e.src || e.dataUrl || ''
  const srcKey = src ? src.split('?')[0].split('#')[0] : ''
  const mm = (srcKey ? state.mediaMeta[srcKey] || state.mediaMeta[src] : undefined)
    || (e.key ? state.mediaMeta[e.key] : undefined)

  let ts = useDeletedAt ? e.deletedAt : (e.ts ?? mm?.ts)
  if (!ts && src) {
    const m = src.match(CLOUDINARY_VERSION_TS)
    if (m) ts = parseInt(m[1], 10) * 1000
  }

  return {
    /* Estrictamente el nombre de ARCHIVO: sin fallback a la etiqueta del
       contenedor. El buscador dice "by file name" y el editor de nombre no debe
       precargar algo que no es un nombre de archivo. */
    name: e.name || mm?.name || '',
    ts: ts || 0,
    size: e.size ?? mm?.size ?? 0,
    /* `kind` primero y el sniff después: una entrada puede traer
       `type: 'image'` genérico y `kind: 'video'`, y ahí la miniatura pinta un
       video. Lo que se filtra como "animación" tiene que ser exactamente lo que
       se ve como video. No se consulta el contenedor (a diferencia de `kindOf`):
       en "sin usar" el `key` apunta al contenedor ANTERIOR, que hoy puede tener
       otra cosa. */
    isVideo: e.kind === 'video' || isVideo(e.type, e.name),
  }
}

export const sumSizes = (arr: { size?: number | null; src?: string; dataUrl?: string; url?: string; key?: string }[]) => {
  const seen = new Set<string>()
  return arr.reduce((s, e) => {
    const id = e.src || e.dataUrl || e.url
    if (id) {
      if (seen.has(id)) return s
      seen.add(id)
    }
    const size = e.size ?? (id ? (state.mediaMeta[id.split('?')[0].split('#')[0]]?.size || state.mediaMeta[id]?.size) : null) ?? (e.key ? state.mediaMeta[e.key]?.size : 0) ?? 0
    return s + size
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

const CONTAINER_BASES: Record<string, { section: string; label: (n: number) => string; kind: 'image' | 'video' | 'text' | 'media' }> = {
  'loader.gallop': { section: 'Site Configuration', label: () => 'Loading Screen', kind: 'video' },
  'settings.faviconUrl': { section: 'Site Configuration', label: () => 'Favicon', kind: 'image' },
  'settings.appleIconUrl': { section: 'Site Configuration', label: () => 'Search Engine Icon', kind: 'image' },
  // Animaciones decorativas (principal + rotación), desde la tabla de ajustes.
  ...Object.fromEntries(ANIM_SLOTS.flatMap((slot) =>
    animFields(slot.base).map((f, i) => [
      animKey(f),
      { section: 'Site Configuration', label: () => animLabel(slot, i), kind: 'video' as const },
    ]),
  )),
  'contact.hero.bg': { section: 'Contact', label: () => 'Background Image — Contact', kind: 'image' },
  'contact.hero.title': { section: 'Contact', label: () => 'Title — Contact', kind: 'text' },
  'contact.hero.lede': { section: 'Contact', label: () => 'Subtitle — Contact', kind: 'text' },
  'contact.social.anim': { section: 'Contact', label: () => 'Video / Animation — Contact', kind: 'video' },
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
  'gamedev.soft': { section: 'Game Dev', label: (n) => `Software Logo #${n}`, kind: 'image' },
  'gamedev.softname': { section: 'Game Dev', label: (n) => `Software Name #${n}`, kind: 'text' },
  'gamedev.heading': { section: 'Game Dev', label: () => 'Section Name — Game Dev', kind: 'text' },
  'gamedev.intro': { section: 'Game Dev', label: () => 'Introductory Text — Game Dev', kind: 'text' },
  'gamedev.title': { section: 'Game Dev', label: (n) => `Block Title #${n} — Game Dev`, kind: 'text' },
  'gamedev.desc': { section: 'Game Dev', label: (n) => `Block Text #${n} — Game Dev`, kind: 'text' },
  'gamedev': { section: 'Game Dev', label: (n) => `Game Material #${n}`, kind: 'media' },
  'gamedev.hero': { section: 'Game Dev', label: () => 'Featured Game', kind: 'media' },
}

export function getContainerMeta(key: string): { label: string; section: string; kind: 'image' | 'video' | 'text' | 'media' } {
  const customLabel = state.containerNames[key]

  // Colecciones con uid (proj#/char#): el índice no es numérico, así que el
  // parseInt de más abajo daría "#NaN". La posición real se busca en el orden
  // vivo de la colección (mismo criterio que ensureCollectionMeta en engine.ts).
  const spec = collectionOf(key)
  if (spec) {
    const id = key.slice(spec.prefix.length + 1).split('::')[0]
    const conceptMatch = key.match(/::c(\d+)$/)
    const idx = readSettings(state.items, spec.prefix).ids.indexOf(id)
    const itemName = spec.itemNoun.charAt(0).toUpperCase() + spec.itemNoun.slice(1)
    const itemLabel = idx >= 0 ? `${itemName} #${idx + 1}` : spec.label
    // Campo de ficha (`::name`, `::title`, `::summary`…): es texto, no un archivo.
    // Devolverlo como 'image' hacía que el índice lo sembrara como contenido.
    const field = isCollectionTextKey(key)
      ? spec.fields?.find((d) => d.key === key.slice(key.indexOf('::') + 2))
      : undefined
    return {
      label: customLabel || (conceptMatch
        ? `${itemLabel} — Concept #${Number(conceptMatch[1]) + 1}`
        : field ? `${itemLabel} — ${field.label}` : itemLabel),
      section: spec.section,
      kind: isCollectionTextKey(key) ? 'text' : 'image',
    }
  }

  const conceptMatch = key.match(/^([^#]+)#(\d+)::c(\d+)$/)
  if (conceptMatch) {
    const [, base, itemIdxStr, conceptIdxStr] = conceptMatch
    const itemN = parseInt(itemIdxStr, 10) + 1
    const conceptN = parseInt(conceptIdxStr, 10) + 1
    const def = CONTAINER_BASES[base]
    const section = def ? def.section : 'Otros'
    const name = base === 'char' ? 'Character' : base === 'proj' ? 'Project' : base
    return {
      label: customLabel || `${name} #${itemN} — Concept #${conceptN}`,
      section,
      kind: 'image',
    }
  }

  const [base, idxStr] = key.split('#')
  const n = (idxStr ? parseInt(idxStr, 10) : 0) + 1
  const def = CONTAINER_BASES[base]
  if (!def) return { label: customLabel || key, section: 'Otros', kind: 'image' }
  return { label: customLabel || def.label(n), section: def.section, kind: def.kind }
}

export function getAllKnownContainerKeys(): string[] {
  const keys = new Set<string>()
  // 1) Claves estándar del sitio
  const standard: string[] = [
    'loader.gallop',
    'settings.faviconUrl',
    'settings.appleIconUrl',
    ...ANIM_FIELDS.map(animKey),
    'contact.hero.bg',
    'contact.social.anim',
    'anim.bg',
    'about.video',
    ...fixedSlotKeys(),
    ...Object.values(COLLECTIONS).flatMap((spec) =>
      readSettings(state.items, spec.prefix).ids.flatMap((id) => mediaKeysOf(spec, id))),
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
    if (/^(?:anim|illustration|model3d|soft|model3d\.gallery|char\.soft|anim\.soft|proj\.soft|model3d\.soft|hero\.wave|hero\.marquee)(?:#[a-z0-9]+)?$/.test(k)) {
      keys.add(k)
    }
  })
  return Array.from(keys)
}

// ----- Operaciones de gestión (port de admin.js) -----------------------------

import { getCloudinaryFolder } from '@/lib/cms/pages'

/** Mueve un asset en Cloudinary de forma fire-and-forget y actualiza la URL
 *  en todos los arrays del estado donde aparezca. */
export function cloudinaryMove(oldUrl: string, newFolder: string, ignoreKeys: string[] = []) {
  if (!oldUrl || !oldUrl.includes('cloudinary.com')) return
  moveMedia(oldUrl, newFolder, ignoreKeys).then(({ newUrl, ok, error }) => {
    if (!ok) { console.error('[cloudinaryMove] no se aplicó el estado:', error); return }
    /* Con el estado en tags la URL NO cambia, así que esto es lo normal: no hay
       nada que reescribir. Solo se sigue para el caso heredado de una URL que sí
       cambió (assets movidos por el modelo viejo). */
    if (newUrl === oldUrl) return
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

/** Verifica si una URL de Cloudinary específica sigue existiendo.
 *  Para uso puntual (ej. antes de asignar desde repo). */
export async function verifySingleUrl(url: string): Promise<boolean> {
  if (!url || !url.includes('cloudinary.com')) return true
  const results = await verifyMedia([url])
  if (results.length === 0) return true // endpoint no disponible → asumir OK
  return results[0].exists
}

/* Claves cuyo VALOR es texto, no un archivo: los ajustes de texto
   (settings.loaderDuration, settings.cvName…) y los campos de ficha de las
   colecciones (char#<uid>::name, proj#<uid>::title…). El índice de contenidos
   trata cualquier clave desconocida como imagen, así que sin este filtro el
   valor crudo se sembraba como si fuera un archivo. */
const isNonMediaIndexKey = (key: string): boolean =>
  isNonMediaSettingsKey(key) || isCollectionTextKey(key)

/* Purga esas claves de los índices de contenido. La purga vivía solo en
   `seedUsedContent()`, que corre en el sitio y no en /admin: la copia de la DB
   volvía a hidratar la entrada en cada arranque. Devuelve true si tocó algo.

   Las entradas de ficha además arrastraban al texto real: la tarjeta fantasma
   se veía en Gestión y "Mover a sin usar" borraba `char#<uid>::name`, con lo
   que el personaje desaparecía del sitio. Por eso también se limpian `retired`
   (un campo nunca es un slot retirado) y las copias que quedaron en sin-usar y
   en la papelera. Solo se tocan los ÍNDICES: `state.items` —el texto real— no
   se modifica acá. */
export function purgeNonMediaEntries(): boolean {
  let changed = false
  Object.keys(state.usedContent).forEach((key) => {
    if (isNonMediaIndexKey(key)) { delete state.usedContent[key]; changed = true }
  })
  Object.keys(state.mediaMeta).forEach((key) => {
    if (isNonMediaIndexKey(key)) { delete state.mediaMeta[key]; changed = true }
  })
  const drop = <T extends { key?: string }>(arr: T[]) => arr.filter((e) => !isNonMediaIndexKey(e.key || ''))
  const unusedClean = drop(state.unused)
  if (unusedClean.length !== state.unused.length) { state.unused = unusedClean; changed = true }
  const trashClean = drop(state.trash)
  if (trashClean.length !== state.trash.length) { state.trash = trashClean; changed = true }
  const retiredClean = state.retired.filter((key) => !isCollectionTextKey(key))
  if (retiredClean.length !== state.retired.length) { state.retired = retiredClean; changed = true }
  return changed
}

export function retireUsedEntryToUnused(entry: UsedEntry, reason: 'retired' | 'replaced' | 'deleted' | 'upload' = 'retired', ignoreKeys: string[] = []) {
  if (!entry || !entry.src) return
  // Valor de texto (duración del loader, nombre del CV, ficha de un personaje…):
  // no es un archivo, así que no tiene "sin usar" al que ir.
  if (isNonMediaIndexKey(entry.key || '')) return
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
      /* Pasar a sin-usar en Cloudinary. Se le informan al servidor los contenedores
         que este mismo gesto está vaciando (`entry.key` + `ignoreKeys`): su borrado
         en `cms_data` va con debounce y todavía puede no haber aterrizado, y sin eso
         el refcount del servidor bloquearía su propia operación legítima. */
      if (entry.src) cloudinaryMove(entry.src, 'portfolio/sin-usar', [entry.key, ...ignoreKeys])
    }
  }
}

function resolveMediaName(url: string, key?: string): string {
  if (!url) return key || 'Archivo'
  try {
    const clean = url.split('?')[0].split('#')[0]
    const part = clean.split('/').pop() || ''
    return decodeURIComponent(part) || key || 'Archivo'
  } catch {
    return key || 'Archivo'
  }
}

/** Archiva a "sin usar" la media asociada a una clave, construyendo la entrada
 *  desde usedContent o state.items/getContainerMeta si no existía en usedContent. */
export function archiveMediaKey(key: string, reason: 'retired' | 'replaced' | 'deleted' | 'upload' = 'retired') {
  let entry = state.usedContent[key]
  const src = (entry && entry.src) || state.items[key] || ''
  if (!src) return // nada que archivar si no hay URL/fuente

  if (!entry) {
    const meta = getContainerMeta(key)
    const label = state.containerNames[key] || meta.label || key
    const section = meta.section || 'Otros'
    const mm = state.mediaMeta[key] || (src ? state.mediaMeta[src] : undefined)
    /* En un contenedor `media` el tipo lo define el archivo, no el registro. */
    const kind: 'image' | 'video' =
      meta.kind === 'video' || (meta.kind === 'media' && isVideo(mm?.type, src)) ? 'video' : 'image'
    entry = {
      key,
      label,
      section,
      kind,
      src,
      name: mm?.name || resolveMediaName(src, key),
      size: mm?.size ?? null,
      original: !mm,
    }
  }
  retireUsedEntryToUnused(entry, reason, [key])
  delete state.usedContent[key]
  if (!state.retired.includes(key)) state.retired.push(key)
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
  const urlSet = new Set(urls.filter(Boolean).map(u => u.split('?')[0].split('#')[0]))
  if (!urlSet.size) return

  const keysToClear: string[] = []
  const strip = (u: string) => u.split('?')[0].split('#')[0]

  Object.keys(state.usedContent).forEach((key) => {
    const entry = state.usedContent[key]
    if (entry && (urlSet.has(strip(entry.src)) || ('dataUrl' in entry && typeof (entry as { dataUrl?: string }).dataUrl === 'string' && urlSet.has(strip((entry as { dataUrl?: string }).dataUrl!))))) {
      delete state.usedContent[key]
      keysToClear.push(key)
      if (!state.retired.includes(key)) state.retired.push(key)
    }
  })

  Object.keys(state.items).forEach((key) => {
    const val = state.items[key]
    if (val && typeof val === 'string' && urlSet.has(strip(val))) {
      if (!keysToClear.includes(key)) {
        keysToClear.push(key)
        if (!state.retired.includes(key) && !key.includes('::') && !key.endsWith('.settings')) {
          state.retired.push(key)
        }
      }
    }
  })

  state.unused = state.unused.filter((e) => (!e.src || !urlSet.has(strip(e.src))) && (!e.dataUrl || !urlSet.has(strip(e.dataUrl))))
  state.trash = state.trash.filter((e) => (!e.src || !urlSet.has(strip(e.src))) && (!e.dataUrl || !urlSet.has(strip(e.dataUrl))))

  urlSet.forEach((u) => {
    delete state.mediaMeta[u]
  })

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

  persistUsed()
  persistUnused()
  persistTrash()
  persistRetired()
  persistMediaMeta()
  emit()
  flushSyncToServer()
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

  // Also treat any URL currently active in state.items as valid — seedUsedContent()
  // runs AFTER this function and will properly register them. Without this, recently
  // uploaded content gets falsely retired due to the usedContent debounce lag.
  // Include ALL non-empty values (not just cloudinary), since local /uploads/ URLs
  // are also valid content.
  Object.values(state.items).forEach((val) => {
    if (typeof val === 'string' && val.length > 0) {
      validUrls.add(val)
    }
  })

  const keysToClear: string[] = []
  Object.entries(state.items).forEach(([key, val]) => {
    if (key.startsWith('settings.') || key === 'loader.gallop') return
    if (typeof val === 'string' && (val.includes('cloudinary.com') || val.startsWith('data:image') || val.startsWith('data:video'))) {
      if (!validUrls.has(val)) {
        // keysToClear.push(key) // DISABLED: race conditions with usedContent debounce can wipe valid recently uploaded images
        // Also disabled the retirement: seedUsedContent() will handle registration properly.
      }
    }
  })

  if (keysToClear.length > 0) {
    clearItemOverrides(keysToClear)
    persistRetired()
    emit()
  }
}

export function moveUsedToUnused(key: string) {
  archiveMediaKey(key, 'retired')
  clearItemOverrides([key])
  persistUsed(); persistUnused(); persistRetired()
  const meta = getContainerMeta(key)
  recordAudit({ section: meta.section, label: meta.label, summary: 'Content moved to unused' })
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
  recordAudit({ section: entry.section, label: entry.label, summary: 'Content restored to its location' })
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
    summary: `Container renamed (previously: ${oldLabel || key})`,
  })
}

/* Renombra un ARCHIVO en todo el estado local. No confundir con
   `performRenameContainer`, que renombra el CONTENEDOR: acá el contenedor no se
   toca, cambia el nombre del asset.

   Se busca por `src` normalizado y se actualizan TODAS las apariciones porque un
   mismo archivo puede estar en varios contenedores a la vez ("Contenido en uso"
   lo lista reusado): es un solo asset, así que un solo nombre.

   El nombre en Cloudinary (display_name) lo aplica `POST /api/rename-media`; esta
   función corre DESPUÉS de que ese endpoint confirmó, nunca antes — si se
   invirtiera el orden, un fallo de red dejaría los dos lados con nombres
   distintos y nada que lo delatara. */
export function renameMediaEverywhere(src: string, newName: string) {
  const norm = (u?: string) => (u ? u.split('?')[0].split('#')[0] : '')
  const target = norm(src)
  if (!target || !newName) return

  let touchedUsed = false
  let touchedUnused = false
  let touchedTrash = false

  /* Claves de contenedor que HOY apuntan a este archivo. mediaMeta está indexado
     por URL y por clave de contenedor; las entradas "sin usar"/"basurero" guardan
     su contenedor ANTERIOR, que puede estar mostrando otra cosa, así que esas no
     se tocan por clave. */
  const containerKeys = new Set<string>()

  Object.entries(state.usedContent).forEach(([k, u]) => {
    if (norm(u.src) !== target) return
    u.name = newName
    containerKeys.add(k)
    touchedUsed = true
  })
  state.unused.forEach((u) => {
    if (norm(u.src) !== target && norm(u.dataUrl) !== target) return
    u.name = newName
    touchedUnused = true
  })
  state.trash.forEach((t) => {
    if (norm(t.src) !== target && norm(t.dataUrl) !== target) return
    t.name = newName
    touchedTrash = true
  })

  Object.keys(state.mediaMeta).forEach((k) => {
    if (norm(k) === target || containerKeys.has(k)) state.mediaMeta[k].name = newName
  })

  if (touchedUsed) persistUsed()
  if (touchedUnused) persistUnused()
  if (touchedTrash) persistTrash()
  if (!touchedUsed && !touchedUnused) persistMediaMeta()

  emit()
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
  recordAudit({ section: targetMeta.section, label: targetMeta.label, summary: `Content moved from container ${oldKey} to ${targetKey}` })
  // Mover en Cloudinary: en-uso/paginaA/seccionA → en-uso/paginaB/seccionB
  if (entry.section !== targetMeta.section) {
    cloudinaryMove(entry.src, getCloudinaryFolder(targetMeta.section))
  }
}

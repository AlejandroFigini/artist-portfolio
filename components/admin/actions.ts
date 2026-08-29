'use client'

/* Operaciones del panel de gestión — port de admin.js: borrado
   permanente (Cloudinary), limpieza automática del basurero, lotes y
   resolución de tamaños faltantes. */

import { deleteMedia } from '@/lib/api'
import { approxDataUrlBytes } from '@/lib/utils'
import {
  state, emit, loadJSON, saveJSON, LS, recordAudit, recordMediaMeta,
  persistUsed, persistUnused, persistRetired, persistTrash,
  archiveMediaKey, clearItemOverrides, purgeUrlsFromAllState, type UnusedEntry, flushSyncToServer, cloudinaryMove, markIntentionalClear,
} from '@/lib/cms/store'

export async function deletePermanent(idx: number) {
  const entry = state.trash[idx]
  if (!entry) return
  const url = entry.src || entry.dataUrl || ''
  state.trash.splice(idx, 1)
  persistTrash()
  if (url) purgeUrlsFromAllState([url])
  if (url && url.includes('cloudinary.com')) {
    const del = await deleteMedia(url)
    if (!del.ok) console.error('[actions] el servidor rechazó el borrado:', url, del.error)
    recordAudit({ user: 'superadmin', section: entry.section, label: entry.label, summary: 'Eliminado de Cloudinary' })
  } else {
    recordAudit({ user: 'superadmin', section: entry.section, label: entry.label, summary: 'Permanently deleted (local)' })
  }
  emit()
  flushSyncToServer()
}

// Política de borrado automático del basurero (manual / 1d / 3d / 7d)
const POLICY_MS: Record<string, number> = { '1d': 86400000, '3d': 259200000, '7d': 604800000 }

export function autoCleanTrash() {
  const policy = loadJSON<string>(LS.TRASH_POLICY, 'manual')
  const maxMs = POLICY_MS[policy]
  if (!maxMs) return
  const now = Date.now()
  const kept: UnusedEntry[] = []
  const urlsToDelete: string[] = []
  state.trash.forEach((item) => {
    if (now - (item.deletedAt || now) > maxMs) {
      const url = item.src || item.dataUrl
      if (url) {
        urlsToDelete.push(url)
        if (url.includes('cloudinary.com')) {
          void deleteMedia(url).then((d) => { if (!d.ok) console.error('[actions] borrado rechazado:', url, d.error) })
        }
      }
    } else {
      kept.push(item)
    }
  })
  if (urlsToDelete.length > 0) {
    state.trash = kept
    persistTrash()
    purgeUrlsFromAllState(urlsToDelete)
    emit()
    flushSyncToServer()
  }
}

export async function emptyTrash() {
  const items = state.trash.slice()
  const urls: string[] = []
  items.forEach((item) => {
    const url = item.src || item.dataUrl
    if (url) urls.push(url)
  })
  markIntentionalClear('trash')
  state.trash = []
  persistTrash()
  if (urls.length > 0) purgeUrlsFromAllState(urls)
  emit()
  await Promise.all(items.map((item) => {
    const url = item.src || item.dataUrl
    if (!url || !url.includes('cloudinary.com')) return Promise.resolve()
    return deleteMedia(url).then((d) => { if (!d.ok) console.error('[actions] borrado rechazado:', url, d.error) })
  }))
  flushSyncToServer()
}

/* ----- Peso real de cada archivo -------------------------------------------
   Cloudinary es donde están los bytes, así que Cloudinary pone el número. Esta
   hidratación PISA el `size` que traiga el índice: un tamaño viejo guardado al
   subir (o medido con un HEAD sobre la URL de entrega, que devuelve la variante
   recodificada) es justamente lo que hacía que la barra lateral y las cabeceras
   de cada apartado no dieran lo mismo que la consola de Cloudinary.

   Corre para los TRES apartados —incluida la papelera, que `resolveSizes` nunca
   recibía y por eso pesaba 0— y toca únicamente entradas cuyo archivo el
   listado conoce: lo que Cloudinary no devolvió se deja como estaba. */
export async function hydrateSizesFromCloudinary(): Promise<void> {
  let sizes: Record<string, number>
  let complete: boolean
  try {
    const res = await fetch('/api/media/sizes', { cache: 'no-store' })
    if (!res.ok) return
    const data = await res.json() as { sizes?: Record<string, number>; complete?: boolean }
    sizes = data.sizes || {}
    complete = !!data.complete
  } catch {
    // Sin lectura no se toca nada: un tamaño viejo es mejor que un 0 inventado.
    return
  }
  /* Una lectura truncada no puede corregir pesos: los archivos que faltaron en
     la respuesta quedarían indistinguibles de los que Cloudinary no tiene. */
  if (!complete || Object.keys(sizes).length === 0) return

  let changed = false
  const apply = (e: { src?: string; dataUrl?: string; key?: string; size?: number | null; name?: string }) => {
    const src = e.src || e.dataUrl || ''
    if (!src) return
    const bytes = sizes[src.split('?')[0].split('#')[0]]
    if (!bytes || e.size === bytes) return
    e.size = bytes
    recordMediaMeta(e.key || '', src, { size: bytes, name: e.name })
    changed = true
  }

  Object.values(state.usedContent).forEach(apply)
  state.unused.forEach(apply)
  state.trash.forEach(apply)

  if (changed) {
    emit()
    persistUsed()
    persistUnused()
    persistTrash()
    flushSyncToServer()
  }
}

// Tamaños y fechas faltantes: dataURL se estima; URLs remotas se miden con un fetch
/* `key` y `name` se declaran acá porque los callers ya los mandan y el cuerpo
   los necesita para recordMediaMeta; antes se accedían con `as any`. */
type SizeEntry = {
  size?: number | null
  ts?: number | null
  src?: string
  dataUrl?: string
  key?: string
  name?: string
}

export async function resolveSizes(entries: SizeEntry[]) {
  let changed = false
  const urlsToFetch: string[] = []
  
  // Primera pasada: procesar fechas, dataUrls y armar lista de URLs para el backend
  for (const e of entries) {
    const src = e.src || e.dataUrl || ''
    if (!src) continue

    if (typeof src === 'string' && src.includes('/upload/v')) {
      const match = src.match(/\/upload\/v(\d{10,})\//)
      if (match && match[1]) {
        const realTs = parseInt(match[1], 10) * 1000
        if (e.ts !== realTs) {
          e.ts = realTs
          recordMediaMeta(e.key || '', src, { ts: realTs, name: e.name })
          changed = true
        }
      }
    }

    if (e.size != null && e.size > 0) continue

    if (src.startsWith('data:')) {
      e.size = approxDataUrlBytes(src)
      recordMediaMeta(e.key || '', src, { size: e.size, ts: e.ts ?? undefined, name: e.name })
      changed = true
      continue
    }

    if (src.startsWith('http') || src.startsWith('/')) {
      urlsToFetch.push(src)
    }
  }

  /* Segunda pasada: pedir los tamaños al backend para eludir bloqueos CORS del
     navegador. En TANDAS: el endpoint acepta 150 URLs por request y descarta el
     resto en silencio, así que con el repositorio por encima de ese número los
     sobrantes quedaban en 0 para siempre y el total del panel salía corto sin
     que nada lo dijera. */
  const RESOLVE_BATCH = 150
  const measured: Record<string, number> = {}
  for (let i = 0; i < urlsToFetch.length; i += RESOLVE_BATCH) {
    try {
      const res = await fetch('/api/resolve-sizes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: urlsToFetch.slice(i, i + RESOLVE_BATCH) })
      })
      if (!res.ok) continue
      const { results } = await res.json() as { results: Record<string, number> }
      if (results) Object.assign(measured, results)
    } catch {
      // Un fallo midiendo tamaños no debe romper el panel: se quedan sin dato.
    }
  }
  for (const e of entries) {
    const src = e.src || e.dataUrl || ''
    if (!measured[src] || (e.size && e.size > 0)) continue
    e.size = measured[src]
    recordMediaMeta(e.key || '', src, { size: measured[src], ts: e.ts ?? undefined, name: e.name })
    changed = true
  }
  
  if (changed) {
    emit()
    persistUsed()
    persistUnused()
    flushSyncToServer()
  }
}

// ----- Lotes (selección múltiple) --------------------------------------------

export function batchMoveUsedToUnused(keys: string[]): number {
  let count = 0
  keys.forEach((key) => {
    archiveMediaKey(key, 'retired')
    count++
  })
  clearItemOverrides(keys)
  persistUsed(); persistUnused(); persistRetired()
  recordAudit({ user: 'superadmin', section: 'Lote', label: `${count} items`, summary: 'Moved to unused (batch)' })
  flushSyncToServer()
  return count
}

export function batchMoveUnusedToTrash(indices: number[]): number {
  let count = 0
  indices.slice().sort((a, b) => b - a).forEach((idx) => {
    const entry = state.unused.splice(idx, 1)[0]
    if (entry) {
      entry.deletedAt = Date.now()
      state.trash.push(entry)
      /* Faltaba mover el asset en Cloudinary: la versión de a uno
         (`moveUnusedToTrash`) sí lo hace y esta no, así que el mismo gesto dejaba
         estados distintos según se hiciera individual o en lote. */
      cloudinaryMove(entry.src || entry.dataUrl || '', 'portfolio/basurero')
      count++
    }
  })
  persistUnused(); persistTrash()
  recordAudit({ user: 'superadmin', section: 'Lote', label: `${count} items`, summary: 'Moved to trash (batch)' })
  flushSyncToServer()
  return count
}

export async function batchDeletePermanent(indices: number[]): Promise<number> {
  const urls: string[] = []
  let count = 0
  indices.slice().sort((a, b) => b - a).forEach((idx) => {
    const entry = state.trash.splice(idx, 1)[0]
    if (entry) {
      const url = entry.src || entry.dataUrl
      if (url) urls.push(url)
      count++
    }
  })
  persistTrash()
  if (urls.length > 0) purgeUrlsFromAllState(urls)
  emit()
  const res = await Promise.all(urls.map((u) =>
    u && u.includes('cloudinary.com')
      ? deleteMedia(u).then((d) => ({ u, ok: d.ok, error: d.error }))
      : Promise.resolve({ u, ok: true as boolean, error: undefined as string | undefined })))
  const fallidos = res.filter((r) => !r.ok)
  if (fallidos.length) console.error('[actions] el servidor rechazó', fallidos.length, 'borrado(s):', fallidos.map((f) => f.error).join('; '))
  recordAudit({ user: 'superadmin', section: 'Lote', label: `${count} items`, summary: 'Permanently deleted (batch)' })
  flushSyncToServer()
  return count
}

export function clearAudit() { state.audit = []; saveJSON(LS.AUDIT, []); emit() }

/** Vacía "Sin usar" moviendo TODO al basurero (recuperable; no borra nada). */
export function purgeUnused() {
  const count = state.unused.length
  if (!count) return
  const now = Date.now()
  state.unused.forEach((e) => {
    e.deletedAt = now
    state.trash.push(e)
    // Misma corrección que en batchMoveUnusedToTrash: acá tampoco se movía el asset.
    cloudinaryMove(e.src || e.dataUrl || '', 'portfolio/basurero')
  })
  markIntentionalClear('unused')
  state.unused = []
  persistUnused(); persistTrash()
  recordAudit({ user: 'superadmin', section: 'Sin usar', label: `${count} items`, summary: 'Moved to trash (empty)' })
  emit()
  flushSyncToServer()
}

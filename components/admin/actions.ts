'use client'

/* Operaciones del panel de gestión — port de admin.js: borrado
   permanente (Cloudinary), limpieza automática del basurero, lotes y
   resolución de tamaños faltantes. */

import { deleteMedia } from '@/lib/api'
import { approxDataUrlBytes } from '@/lib/utils'
import {
  state, emit, loadJSON, saveJSON, LS, recordAudit,
  persistUsed, persistUnused, persistRetired, persistTrash,
  retireUsedEntryToUnused, archiveMediaKey, clearItemOverrides, purgeUrlsFromAllState, type UnusedEntry, flushSyncToServer,
} from '@/lib/cms/store'

export async function deletePermanent(idx: number) {
  const entry = state.trash[idx]
  if (!entry) return
  const url = entry.src || entry.dataUrl || ''
  state.trash.splice(idx, 1)
  persistTrash()
  if (url) purgeUrlsFromAllState([url])
  if (url && url.includes('cloudinary.com')) {
    await deleteMedia(url).catch(() => {})
    recordAudit({ user: 'superadmin', section: entry.section, label: entry.label, summary: 'Eliminado de Cloudinary' })
  } else {
    recordAudit({ user: 'superadmin', section: entry.section, label: entry.label, summary: 'Eliminado permanentemente (local)' })
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
        if (url.includes('cloudinary.com')) deleteMedia(url).catch(() => {})
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
  state.trash = []
  persistTrash()
  if (urls.length > 0) purgeUrlsFromAllState(urls)
  emit()
  await Promise.all(items.map((item) => {
    const url = item.src || item.dataUrl
    return url && url.includes('cloudinary.com') ? deleteMedia(url).catch(() => {}) : Promise.resolve()
  }))
  flushSyncToServer()
}

// Tamaños y fechas faltantes: dataURL se estima; URLs remotas se miden con un fetch
export async function resolveSizes(entries: { size?: number | null; ts?: number | null; src?: string; dataUrl?: string }[]) {
  let changed = false
  await Promise.all(entries.map(async (e) => {
    const src = e.src || e.dataUrl || ''
    if (!src) return

    // Intentar deducir la fecha de subida (ts) desde la versión de Cloudinary (ej: v1784895000)
    if (!e.ts && typeof src === 'string' && src.includes('/upload/v')) {
      const match = src.match(/\/upload\/v(\d{10,})\//)
      if (match && match[1]) {
        e.ts = parseInt(match[1], 10) * 1000
        changed = true
      }
    }

    if (e.size != null) return

    if (src.startsWith('data:')) {
      e.size = approxDataUrlBytes(src)
      changed = true
      return
    }

    try {
      const r = await fetch(src, { method: 'HEAD' })
      if (r.ok) {
        const cl = r.headers.get('content-length')
        if (cl) {
          e.size = parseInt(cl, 10)
          changed = true
        }
      } else {
        // Fallback for CORS issues or servers blocking HEAD
        const r2 = await fetch(src)
        if (r2.ok) {
          e.size = (await r2.blob()).size
          changed = true
        }
      }
    } catch {}
  }))
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
  recordAudit({ user: 'superadmin', section: 'Lote', label: `${count} ítems`, summary: 'Movidos a sin usar (Batch)' })
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
      count++
    }
  })
  persistUnused(); persistTrash()
  recordAudit({ user: 'superadmin', section: 'Lote', label: `${count} ítems`, summary: 'Movidos al basurero (Batch)' })
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
  await Promise.all(urls.map((u) => u && u.includes('cloudinary.com') ? deleteMedia(u).catch(() => {}) : Promise.resolve()))
  recordAudit({ user: 'superadmin', section: 'Lote', label: `${count} ítems`, summary: 'Eliminados permanentemente (Batch)' })
  flushSyncToServer()
  return count
}

export function clearAudit() { state.audit = []; saveJSON(LS.AUDIT, []); emit() }

/** Vacía "Sin usar" moviendo TODO al basurero (recuperable; no borra nada). */
export function purgeUnused() {
  const count = state.unused.length
  if (!count) return
  const now = Date.now()
  state.unused.forEach((e) => { e.deletedAt = now; state.trash.push(e) })
  state.unused = []
  persistUnused(); persistTrash()
  recordAudit({ user: 'superadmin', section: 'Sin usar', label: `${count} ítems`, summary: 'Movidos al basurero (vaciar)' })
  emit()
  flushSyncToServer()
}

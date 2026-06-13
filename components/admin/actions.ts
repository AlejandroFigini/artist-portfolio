'use client'

/* Operaciones del panel de gestión — port de admin.js: borrado
   permanente (Cloudinary), limpieza automática del basurero, lotes y
   resolución de tamaños faltantes. */

import { deleteMedia } from '@/lib/api'
import { approxDataUrlBytes } from '@/lib/utils'
import {
  state, emit, loadJSON, saveJSON, LS, recordAudit,
  persistUsed, persistUnused, persistRetired, persistTrash, persistOverridesLocal,
  type UnusedEntry,
} from '@/lib/cms/store'

export async function deletePermanent(idx: number) {
  const entry = state.trash.splice(idx, 1)[0]
  if (!entry) return
  persistTrash()
  const url = entry.src || entry.dataUrl
  if (url && url.includes('cloudinary.com')) {
    await deleteMedia(url).catch(() => {})
    recordAudit({ user: 'superadmin', section: entry.section, label: entry.label, summary: 'Eliminado de Cloudinary' })
  } else {
    recordAudit({ user: 'superadmin', section: entry.section, label: entry.label, summary: 'Eliminado permanentemente (local)' })
  }
  emit()
}

// Política de borrado automático del basurero (manual / 1d / 3d / 7d)
const POLICY_MS: Record<string, number> = { '1d': 86400000, '3d': 259200000, '7d': 604800000 }

export function autoCleanTrash() {
  const policy = loadJSON<string>(LS.TRASH_POLICY, 'manual')
  const maxMs = POLICY_MS[policy]
  if (!maxMs) return
  const now = Date.now()
  const kept: UnusedEntry[] = []
  let deletedAny = false
  state.trash.forEach((item) => {
    if (now - (item.deletedAt || now) > maxMs) {
      deletedAny = true
      const url = item.src || item.dataUrl
      if (url) deleteMedia(url).catch(() => {})
    } else {
      kept.push(item)
    }
  })
  if (deletedAny) {
    state.trash = kept
    persistTrash()
    emit()
  }
}

export async function emptyTrash() {
  const items = state.trash.slice()
  state.trash = []
  persistTrash()
  emit()
  await Promise.all(items.map((item) => {
    const url = item.src || item.dataUrl
    return url && url.includes('cloudinary.com') ? deleteMedia(url).catch(() => {}) : Promise.resolve()
  }))
}

// Tamaños faltantes: dataURL se estima; URLs remotas se miden con un fetch
export async function resolveSizes(entries: { size?: number | null; src?: string; dataUrl?: string }[]) {
  await Promise.all(entries.map(async (e) => {
    if (e.size != null) return
    const src = e.src || e.dataUrl || ''
    if (!src) return
    if (src.startsWith('data:')) { e.size = approxDataUrlBytes(src); return }
    try {
      const r = await fetch(src)
      if (r.ok) e.size = (await r.blob()).size
    } catch {}
  }))
  emit()
}

// ----- Lotes (selección múltiple) --------------------------------------------

export function batchMoveUsedToUnused(keys: string[]): number {
  let count = 0
  keys.forEach((key) => {
    const entry = state.usedContent[key]
    if (!entry) return
    delete state.usedContent[key]
    delete state.items[key]
    if (!state.retired.includes(key)) state.retired.push(key)
    state.unused.push({
      key: entry.key, src: entry.src, dataUrl: entry.src, name: entry.name, size: entry.size,
      type: entry.kind === 'video' ? 'video/webm' : 'image/webp', ts: Date.now(),
      label: entry.label, section: entry.section, original: entry.original, reason: 'retired',
    })
    count++
  })
  persistUsed(); persistUnused(); persistRetired(); persistOverridesLocal()
  recordAudit({ user: 'superadmin', section: 'Lote', label: `${count} ítems`, summary: 'Movidos a sin usar (Batch)' })
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
  return count
}

export async function batchDeletePermanent(indices: number[]): Promise<number> {
  const urls: string[] = []
  let count = 0
  indices.slice().sort((a, b) => b - a).forEach((idx) => {
    const entry = state.trash.splice(idx, 1)[0]
    if (entry) {
      const url = entry.src || entry.dataUrl
      if (url && url.includes('cloudinary.com')) urls.push(url)
      count++
    }
  })
  persistTrash()
  emit()
  await Promise.all(urls.map((u) => deleteMedia(u).catch(() => {})))
  recordAudit({ user: 'superadmin', section: 'Lote', label: `${count} ítems`, summary: 'Eliminados permanentemente (Batch)' })
  return count
}

export function clearAudit() { state.audit = []; saveJSON(LS.AUDIT, []); emit() }
export function purgeUnused() { state.unused = []; persistUnused(); emit() }

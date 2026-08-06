'use client'

/* Puente entre la lógica pura de `collection.ts` y el store/red. El estado de
   edición (orden, duración) vive en el componente; nada se persiste hasta
   `commit()`. Esa es la diferencia con los managers viejos, que guardaban desde
   un efecto y se realimentaban en bucle. */

import { useCallback, useMemo, useState } from 'react'
import { saveContent } from '@/lib/api'
import {
  archiveMediaKey, emit, loadJSON, LS, persistUnused, persistUsed,
  saveJSON, scheduleSyncToServer, state, useCmsStore,
} from '@/lib/cms/store'
import { COLLECTIONS, type CollectionSpec } from './collections'
import {
  newId, planCommit, planMigration, readSettings,
} from './collection'

export const DEFAULT_DURATION_MS = 7000

export function readCollectionIds(prefix: string): string[] {
  return readSettings(state.items, prefix).ids
}

export function readCollectionDuration(prefix: string): number {
  return readSettings(state.items, prefix).duration ?? DEFAULT_DURATION_MS
}

export type CollectionHandle = {
  ids: string[]
  duration: number
  dirty: boolean
  add: () => string
  remove: (id: string) => void
  move: (id: string, dir: -1 | 1) => void
  setDuration: (ms: number) => void
  commit: () => Promise<void>
  reset: () => void
}

export function useCollection(spec: CollectionSpec): CollectionHandle {
  useCmsStore()
  const persisted = readSettings(state.items, spec.prefix)
  const persistedIds = persisted.ids
  const [draft, setDraft] = useState<{ ids: string[]; duration: number } | null>(null)

  const ids = draft?.ids ?? persistedIds
  const duration = draft?.duration ?? persisted.duration ?? DEFAULT_DURATION_MS

  const dirty = useMemo(() => {
    if (!draft) return false
    if (draft.ids.length !== persistedIds.length) return true
    if (spec.duration && draft.duration !== (persisted.duration ?? DEFAULT_DURATION_MS)) return true
    return draft.ids.some((id, i) => id !== persistedIds[i])
  }, [draft, persistedIds, persisted.duration, spec.duration])

  const edit = useCallback((fn: (prev: { ids: string[]; duration: number }) => { ids: string[]; duration: number }) => {
    setDraft((prev) => fn(prev ?? {
      ids: readSettings(state.items, spec.prefix).ids,
      duration: readSettings(state.items, spec.prefix).duration ?? DEFAULT_DURATION_MS,
    }))
  }, [spec.prefix])

  const add = useCallback(() => {
    const current = draft?.ids ?? readSettings(state.items, spec.prefix).ids
    const id = newId(current)
    edit((prev) => ({ ...prev, ids: [...prev.ids, id] }))
    return id
  }, [draft, edit, spec.prefix])

  const remove = useCallback((id: string) => {
    edit((prev) => ({ ...prev, ids: prev.ids.filter((x) => x !== id) }))
  }, [edit])

  const move = useCallback((id: string, dir: -1 | 1) => {
    edit((prev) => {
      const i = prev.ids.indexOf(id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= prev.ids.length) return prev
      const next = prev.ids.slice()
      ;[next[i], next[j]] = [next[j], next[i]]
      return { ...prev, ids: next }
    })
  }, [edit])

  const setDuration = useCallback((ms: number) => {
    edit((prev) => ({ ...prev, duration: ms }))
  }, [edit])

  const reset = useCallback(() => setDraft(null), [])

  const commit = useCallback(async () => {
    if (!state.isAdmin) return
    const current = draft
    if (!current) return

    const plan = planCommit(
      spec, persistedIds, current.ids, state.items,
      spec.duration ? current.duration : undefined,
    )

    // Archivar UNA sola vez, solo lo que realmente desaparece.
    for (const k of plan.archiveKeys) archiveMediaKey(k, 'deleted')
    for (const k of plan.deleteKeys) {
      delete state.items[k]
      delete state.usedContent[k]
    }
    persistUnused()
    persistUsed()

    for (const [k, v] of Object.entries(plan.payload)) {
      if (v === '') delete state.items[k]
      else state.items[k] = v
    }

    const overrides = loadJSON<Record<string, string>>(LS.OVERRIDES, {})
    for (const [k, v] of Object.entries(plan.payload)) {
      if (v === '') delete overrides[k]
      else overrides[k] = v
    }
    saveJSON(LS.OVERRIDES, overrides)
    scheduleSyncToServer('overrides')

    await saveContent(plan.payload)
    setDraft(null)
    emit()
  }, [draft, persistedIds, spec])

  return { ids, duration, dirty, add, remove, move, setDuration, commit, reset }
}

/* Guard a nivel de módulo contra la migración concurrente. `mergeServerState`
   (lib/cms/store.ts) llama a `migrateCollections()` de forma fire-and-forget
   cada vez que pisa `state.items` con datos del server, y uno de sus tres
   call-sites es `components/cms/PickerModals.tsx:149`, dentro del picker.
   Si el picker se abre mientras la migración disparada al cargar la página
   todavía tiene su `saveContent` en vuelo, ese segundo `mergeServerState`
   trae del server las claves legacy (el primer POST no aterrizó todavía) y
   las vuelve a pisar sobre `state.items`. Sin este guard, una segunda
   corrida de `planMigration` ve datos legacy y genera un set de uids
   distinto del primero (son aleatorios) — el segundo `saveContent` gana la
   carrera y dos migraciones divergentes escriben cosas distintas en la DB.
   Memoizamos la promesa en curso para que la segunda llamada la reutilice
   en vez de replanificar, y solo la liberamos si la corrida falla, para
   que un reintento posterior no quede trabado para siempre. */
let migrationPromise: Promise<void> | null = null

async function runMigration(): Promise<void> {
  const payload: Record<string, string> = {}
  const renames: Record<string, string> = {}

  for (const spec of Object.values(COLLECTIONS)) {
    const plan = planMigration(spec, state.items, (taken) => newId(taken))
    if (!plan) continue
    Object.assign(payload, plan.payload)
    Object.assign(renames, plan.renames)
  }
  if (Object.keys(payload).length === 0) return

  for (const [oldKey, newKey] of Object.entries(renames)) {
    const used = state.usedContent[oldKey]
    if (used) {
      state.usedContent[newKey] = { ...used, key: newKey }
      delete state.usedContent[oldKey]
    }
  }
  for (const [k, v] of Object.entries(payload)) {
    if (v === '') delete state.items[k]
    else state.items[k] = v
  }

  const overrides = loadJSON<Record<string, string>>(LS.OVERRIDES, {})
  for (const [k, v] of Object.entries(payload)) {
    if (v === '') delete overrides[k]
    else overrides[k] = v
  }
  saveJSON(LS.OVERRIDES, overrides)

  persistUsed()
  await saveContent(payload)
  emit()
}

/* Migración one-shot de índice posicional a uid. Idempotente: si todas las
   colecciones ya tienen `ids`, no escribe nada. Los datos de producción son
   descartables por decisión de producto → no hay rollback. */
export function migrateCollections(): Promise<void> {
  if (!state.isAdmin) return Promise.resolve()
  if (migrationPromise) return migrationPromise

  migrationPromise = runMigration().catch((err) => {
    // Se libera el guard solo ante un fallo: un éxito deja la promesa
    // memoizada para siempre (no hace falta remigrar), pero un fallo
    // transitorio (ej. saveContent caído por red) no puede dejar el guard
    // trabado — el próximo llamado tiene que poder reintentar.
    migrationPromise = null
    throw err
  })
  return migrationPromise
}

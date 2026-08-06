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
  newId, planCommit, planMigration, readSettings, type MigrationPlan,
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
  // Se prende si el último `commit()` falló. `persisted` sale de `state.items`,
  // que `commit()` ya mutó de forma sincrónica ANTES del `await saveContent`
  // (contrato: no revertir en memoria ante un fallo). Como `persisted` se
  // recalcula en cada render y `useCmsStore()` repinta con CUALQUIER `emit()`
  // ajeno (otro guardado, un upload, un cambio de idioma), sin esta bandera
  // un repintado ajeno haría que `persisted` coincida con el draft y `dirty`
  // se cayera a `false` aunque el guardado nunca llegó al servidor.
  const [saveFailed, setSaveFailed] = useState(false)

  const ids = draft?.ids ?? persistedIds
  const duration = draft?.duration ?? persisted.duration ?? DEFAULT_DURATION_MS

  const dirty = useMemo(() => {
    if (!draft) return false
    if (saveFailed) return true
    if (draft.ids.length !== persistedIds.length) return true
    if (spec.duration && draft.duration !== (persisted.duration ?? DEFAULT_DURATION_MS)) return true
    return draft.ids.some((id, i) => id !== persistedIds[i])
  }, [draft, persistedIds, persisted.duration, spec.duration, saveFailed])

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

  const reset = useCallback(() => {
    setDraft(null)
    setSaveFailed(false)
  }, [])

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

    try {
      await saveContent(plan.payload)
    } catch (err) {
      // Contrato: no se revierte lo ya mutado en `state.items` (el admin sigue
      // viendo su edición), pero `dirty` tiene que seguir en `true` para que
      // reintentar sea un click. Ojo: `saveContent` (lib/api.ts) no relanza
      // ante errores de red ni 5xx — los traga en silencio y solo rechaza
      // en algunos 4xx —, así que este `catch` no cubre un fallo de red.
      setSaveFailed(true)
      throw err
    }

    setSaveFailed(false)
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
   que un reintento posterior no quede trabado para siempre.

   Eso cierra la carrera MIENTRAS la migración está en vuelo. Pero queda una
   segunda carrera, posterior al éxito: si el `mergeServerState` del picker
   (mismo call-site de arriba, `PickerModals.tsx:149`) arranca su fetch ANTES
   de que el `saveContent` de la migración aterrice en la DB, ese fetch trae
   los datos todavía legacy y los pisa sobre `state.items` DESPUÉS de que la
   migración ya resolvió en éxito. Como `migrationPromise` queda memoizada
   para siempre, un `migrateCollections()` posterior la devuelve tal cual sin
   volver a mirar `state.items` — la sesión queda con claves legacy y las
   colecciones se ven vacías el resto del tab, aunque la DB esté bien.

   El arreglo obvio —liberar el guard tras el éxito para poder remigrar— es
   una trampa: un segundo `planMigration` sobre datos legacy generaría uids
   nuevos y distintos (son aleatorios), dejando filas huérfanas en la DB.
   Por eso NO se replanifica: se memoiza el `payload`/`renames` que produjo
   la primera corrida exitosa y, si `state.items` volvió a verse legacy, se
   reaplica ESE MISMO payload sobre el estado en memoria — sin tocar el
   servidor (ya lo tiene) y con los mismos uids de siempre.

   Hay todavía una TERCERA variante de la misma carrera, más frecuente que el
   picker: `app/admin/page.tsx` monta `<CmsRoot />` y `<AdminDashboard />`
   juntos, y cada uno dispara su propio `loadServerState()` en su efecto de
   montaje (`components/cms/CmsRoot.tsx` y `components/admin/AdminDashboard.tsx`)
   — o sea, cada carga de `/admin` sale con DOS GET casi simultáneos, ambos
   con la misma foto legacy. Si el pisado del segundo GET llega MIENTRAS el
   primero todavía tiene su `saveContent` en vuelo (`migrationResult` sigue
   `null`), el chequeo de arriba (`if (migrationResult && revertedToLegacy(...))`)
   no aplica porque no hay nada memoizado todavía, y la llamada cae en
   `if (migrationPromise) return migrationPromise` sin reparar nada. Cuando
   `runMigration()` por fin resuelve, con solo setear `migrationResult` y
   hacer `emit()` NO alcanza: `state.items` pudo haber quedado pisado por ese
   segundo GET durante el `await`. Por eso `runMigration()` repite el mismo
   chequeo (`revertedToLegacy` + `applyMigrationPlan`) inmediatamente después
   de memoizar el resultado — ver el bloque al final de esa función. */
let migrationPromise: Promise<void> | null = null
let migrationResult: MigrationPlan | null = null

/* Escribe un plan de migración (nuevo o memoizado) sobre `state.items` /
   `state.usedContent` / el caché de overrides. Común a la primera corrida y
   a la reaplicación. */
function applyMigrationPlan(plan: MigrationPlan): void {
  for (const [oldKey, newKey] of Object.entries(plan.renames)) {
    const used = state.usedContent[oldKey]
    if (used) {
      state.usedContent[newKey] = { ...used, key: newKey }
      delete state.usedContent[oldKey]
    }
  }
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
  persistUsed()
}

/* ¿`state.items` volvió a verse legacy después de una migración ya exitosa?
   Barato y sin falsos positivos: NO se mira `ids.length === 0`, porque una
   colección legítimamente vaciada por el admin después de migrar también da
   `ids: []` — confundirla con "no migrada" resucitaría items que se borraron
   a propósito. La señal real es la presencia de las claves legacy que la
   migración renombró: nada después de la migración vuelve a escribirlas, así
   que si reaparecen es porque `state.items` es una foto de antes del rename. */
function revertedToLegacy(renames: Record<string, string>): boolean {
  return Object.keys(renames).some((oldKey) => oldKey in state.items)
}

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

  applyMigrationPlan({ payload, renames })
  await saveContent(payload)
  // Recién se memoiza tras el éxito del `saveContent`: es el plan que la DB
  // ya tiene confirmado, el único que es seguro reaplicar sin volver a tocar
  // el servidor.
  migrationResult = { payload, renames }

  // Reconciliación post-await (ventana que quedaba abierta, ver comentario
  // de arriba del guard de módulo): mientras este `await saveContent` estaba
  // en vuelo, `migrationResult` todavía era `null`, así que un
  // `mergeServerState` concurrente que haya pisado `state.items` con la foto
  // legacy no pudo repararse en el momento — una segunda llamada a
  // `migrateCollections()` durante esa ventana cae en
  // `if (migrationPromise) return migrationPromise` y no mira el estado.
  // Ahora que el payload ya está memoizado, repetimos el mismo chequeo que
  // ya existe para el caso post-éxito: si `state.items` volvió a verse
  // legacy, reaplicamos ESTE MISMO payload (mismos uids, sin volver a tocar
  // el servidor, que ya lo tiene). Si no hubo pisado, `revertedToLegacy` da
  // `false` y esto es un no-op.
  if (revertedToLegacy(renames)) applyMigrationPlan({ payload, renames })
  emit()
}

/* Migración one-shot de índice posicional a uid. Idempotente: si todas las
   colecciones ya tienen `ids`, no escribe nada. Los datos de producción son
   descartables por decisión de producto → no hay rollback. */
export function migrateCollections(): Promise<void> {
  if (!state.isAdmin) return Promise.resolve()

  if (migrationResult && revertedToLegacy(migrationResult.renames)) {
    applyMigrationPlan(migrationResult)
    emit()
    return Promise.resolve()
  }

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

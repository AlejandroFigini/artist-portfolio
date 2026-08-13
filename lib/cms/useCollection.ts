'use client'

/* Puente entre la lógica pura de `collection.ts` y el store/red. El estado de
   edición (orden, duración) vive en el componente; nada se persiste hasta
   `commit()`. Esa es la diferencia con los managers viejos, que guardaban desde
   un efecto y se realimentaban en bucle. */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { saveContent, renameTranslations } from '@/lib/api'
import {
  archiveMediaKey, emit, loadJSON, LS, persistRetired, persistUnused, persistUsed,
  saveJSON, scheduleSyncToServer, setCollectionDeferred, state, useCmsStore,
} from '@/lib/cms/store'
import { COLLECTIONS, type CollectionSpec } from './collections'
import {
  mediaKeysOf, migrationIdGenerator, newId, planCommit, planMigration, readSettings, type MigrationPlan,
} from './collection'

export const DEFAULT_DURATION_MS = 7000

export function readCollectionIds(prefix: string): string[] {
  return readSettings(state.items, prefix).ids
}

export function readCollectionDuration(prefix: string): number {
  return readSettings(state.items, prefix).duration ?? DEFAULT_DURATION_MS
}

/* Foto de la media actual (base + conceptos) de todos los items de la colección.
   Es la línea base para detectar asignaciones pendientes y para revertirlas. */
function snapshotMedia(spec: CollectionSpec): Record<string, string> {
  const out: Record<string, string> = {}
  for (const id of readSettings(state.items, spec.prefix).ids) {
    for (const k of mediaKeysOf(spec, id)) {
      if (state.items[k] !== undefined) out[k] = state.items[k]
    }
  }
  return out
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

  /* Guardado diferido de la ASIGNACIÓN de contenido: mientras este manager está
     montado, el prefijo se marca "diferido" (el picker no persiste la media al
     instante) y se guarda un snapshot de la media para marcar `dirty` con
     asignaciones pendientes y revertirlas al descartar. */
  const [mediaBaseline, setMediaBaseline] = useState<Record<string, string>>(() => snapshotMedia(spec))

  useEffect(() => {
    setCollectionDeferred(spec.prefix, true)
    return () => setCollectionDeferred(spec.prefix, false)
  }, [spec.prefix])

  const ids = draft?.ids ?? persistedIds
  const duration = draft?.duration ?? persisted.duration ?? DEFAULT_DURATION_MS

  const structuralDirty = useMemo(() => {
    if (!draft) return false
    if (saveFailed) return true
    if (draft.ids.length !== persistedIds.length) return true
    if (spec.duration && draft.duration !== (persisted.duration ?? DEFAULT_DURATION_MS)) return true
    return draft.ids.some((id, i) => id !== persistedIds[i])
  }, [draft, persistedIds, persisted.duration, spec.duration, saveFailed])

  /* Asignaciones de media pendientes vs el snapshot. Se computa en cada render:
     `useCmsStore()` repinta con el `emit()` del picker, y `state.items` no es una
     dependencia reactiva de React. */
  const mediaDirty = ids.some((id) => mediaKeysOf(spec, id).some((k) => (state.items[k] || '') !== (mediaBaseline[k] || '')))

  const dirty = structuralDirty || mediaDirty

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
    // D5: un id agregado y descartado en la MISMA sesión de edición nunca
    // estuvo en `persistedIds` y nunca va a estar en `nextIds` — `commit()`
    // compara ambos (`planCommit`), así que jamás lo ve como "removido". Si
    // el picker ya subió contenido para ese id (se persiste al instante
    // contra su propia clave, independiente del draft), esa media quedaría
    // huérfana para siempre: sin ids que la referencien, ninguna UI vuelve a
    // mostrarla. Se archiva/borra acá mismo, en el momento en que se saca del
    // draft, en vez de dejarlo en manos de un commit que nunca la va a ver.
    if (!persistedIds.includes(id)) {
      const plan = planCommit(spec, [id], [], state.items)
      for (const k of plan.archiveKeys) archiveMediaKey(k, 'deleted')
      if (plan.deleteKeys.length) {
        const cleared: Record<string, string> = {}
        for (const k of plan.deleteKeys) {
          delete state.items[k]
          delete state.usedContent[k]
          cleared[k] = ''
        }
        persistUnused(); persistUsed(); persistRetired()
        emit()
        saveContent(cleared).catch(() => {})
      }
    }
    edit((prev) => ({ ...prev, ids: prev.ids.filter((x) => x !== id) }))
  }, [edit, persistedIds, spec])

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
    // Revertir las asignaciones de media pendientes (no guardadas) al snapshot:
    // volver a lo que había antes de abrir el manager. Descarta como los slides.
    const currentIds = draft?.ids ?? persistedIds
    for (const id of currentIds) {
      for (const k of mediaKeysOf(spec, id)) {
        if ((state.items[k] || '') === (mediaBaseline[k] || '')) continue
        if (mediaBaseline[k] !== undefined) state.items[k] = mediaBaseline[k]
        else delete state.items[k]
      }
    }
    setDraft(null)
    setSaveFailed(false)
    emit()
  }, [draft, persistedIds, spec, mediaBaseline])

  const commit = useCallback(async () => {
    if (!state.isAdmin) return
    // Puede no haber `draft` si el único cambio fue asignar contenido (sin tocar
    // la lista de slides): igual hay que persistir la media pendiente.
    const current = draft ?? { ids: persistedIds, duration: persisted.duration ?? DEFAULT_DURATION_MS }

    const plan = planCommit(
      spec, persistedIds, current.ids, state.items,
      spec.duration ? current.duration : undefined,
    )

    // Media pendiente (asignada en esta sesión, aún no persistida): se agrega al
    // payload del commit. Solo las claves que cambiaron respecto del snapshot.
    for (const id of current.ids) {
      for (const k of mediaKeysOf(spec, id)) {
        const cur = state.items[k]
        if ((cur || '') === (mediaBaseline[k] || '')) continue
        plan.payload[k] = cur || ''
      }
    }

    // Archivar UNA sola vez, solo lo que realmente desaparece.
    for (const k of plan.archiveKeys) archiveMediaKey(k, 'deleted')
    for (const k of plan.deleteKeys) {
      delete state.items[k]
      delete state.usedContent[k]
    }
    persistUnused()
    persistUsed()
    persistRetired()

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
    setMediaBaseline(snapshotMedia(spec)) // lo recién guardado pasa a ser la línea base
    emit()
  }, [draft, persistedIds, persisted.duration, spec, mediaBaseline])

  return { ids, duration, dirty, add, remove, move, setDuration, commit, reset }
}

/* Guard a nivel de módulo contra la migración concurrente. `mergeServerState`
   (lib/cms/store.ts) llama a `migrateCollections()` de forma fire-and-forget
   cada vez que pisa `state.items` con datos del server, y uno de sus tres
   call-sites es `components/cms/PickerModals.tsx:149`, dentro del picker.
   Si el picker se abre mientras la migración disparada al cargar la página
   todavía tiene su `saveContent` en vuelo, ese segundo `mergeServerState`
   trae del server las claves legacy (el primer POST no aterrizó todavía) y
   las vuelve a pisar sobre `state.items`.

   Antes esto era grave: los ids salían de `crypto.getRandomValues` (`newId`),
   así que una segunda corrida de `planMigration` sobre la misma foto legacy
   generaba un set de uids DISTINTO del primero, y el segundo `saveContent`
   dejaba filas huérfanas en la DB (D2). Con `migrationIdGenerator` (ver
   `lib/cms/collection.ts`) los ids son deterministas: misma foto de datos →
   mismo mapeo índice→uid, sin importar cuántas pestañas o corridas los
   generen. Dos migraciones "divergentes" ahora escriben exactamente lo
   mismo — ya no hay riesgo de huérfanas por esta carrera.

   El guard se mantiene igual por eficiencia, no por corrección: sin él, cada
   `mergeServerState` concurrente dispara su propio `saveContent` redundante
   (mismo payload, mismo resultado, solo trabajo de más). Memoizamos la
   promesa en curso para que la segunda llamada la reutilice en vez de
   replanificar, y solo la liberamos si la corrida falla, para que un
   reintento posterior no quede trabado para siempre.

   Sigue existiendo la variante posterior al éxito: si un `mergeServerState`
   concurrente pisa `state.items` con la foto legacy DESPUÉS de que la
   migración ya resolvió (`migrationResult` memoizado), la sesión se queda
   viendo claves legacy hasta que algo la repare — `revertedToLegacy` +
   `applyMigrationPlan` reaplican el MISMO plan memoizado (mismos uids,
   deterministas, sin volver a tocar el servidor) en ese caso. Y la variante
   mientras el primer `saveContent` sigue en vuelo (`migrationResult` todavía
   `null`, dos GET casi simultáneos como en `app/admin/page.tsx`, que monta
   `<CmsRoot />` y `<AdminDashboard />` juntos): `runMigration()` repite el
   mismo chequeo inmediatamente después de memoizar el resultado — ver el
   bloque al final de esa función. */
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

/* Arma el plan de migración de TODAS las colecciones sobre una foto de
   `items`. Ids deterministas (`migrationIdGenerator`, ver D2): la misma foto
   produce siempre el mismo mapeo índice→uid, así que esta función se puede
   llamar tantas veces como haga falta —incluso desde una pestaña sin sesión
   de admin— sin arriesgar uids divergentes entre corridas. */
function computeMigrationPlan(items: Record<string, string>): MigrationPlan | null {
  const payload: Record<string, string> = {}
  const renames: Record<string, string> = {}
  for (const spec of Object.values(COLLECTIONS)) {
    const plan = planMigration(spec, items, migrationIdGenerator(spec.prefix))
    if (!plan) continue
    Object.assign(payload, plan.payload)
    Object.assign(renames, plan.renames)
  }
  return Object.keys(payload).length > 0 ? { payload, renames } : null
}

async function runMigration(): Promise<void> {
  const plan = computeMigrationPlan(state.items)
  if (!plan) return

  applyMigrationPlan(plan)
  await saveContent(plan.payload)
  // Recién se memoiza tras el éxito del `saveContent`: es el plan que la DB
  // ya tiene confirmado, el único que es seguro reaplicar sin volver a tocar
  // el servidor.
  migrationResult = plan

  // D3: `cms_translations` está keyeada por la MISMA clave que `cms_data`.
  // Sin este paso, cada fila traducida sigue apuntando a la clave legacy
  // (`proj#0::title`) que la migración ya vació — el contenido traducido de
  // proyectos/personajes queda huérfano e irrecuperable en un sitio de
  // cuatro idiomas. Best-effort: si falla, el contenido ya quedó migrado
  // (no hay rollback, ver comentario de `migrateCollections`) — se loguea
  // para poder reintentar a mano en vez de bloquear la migración entera.
  if (Object.keys(plan.renames).length > 0) {
    try {
      await renameTranslations(plan.renames)
    } catch (err) {
      console.error('[cms] no se pudieron renombrar las traducciones tras la migración:', err)
    }
  }

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
  if (revertedToLegacy(plan.renames)) applyMigrationPlan(plan)
  emit()
}

/* Migración one-shot de índice posicional a uid. Idempotente: si todas las
   colecciones ya tienen `ids`, no escribe nada. Los datos de producción son
   descartables por decisión de producto → no hay rollback.

   D1: sin sesión de admin (el caso normal de un visitante recién desplegado,
   antes de que el dueño entre al panel) NO se toca el servidor — se calcula
   el mismo plan determinista y se aplica solo en memoria, para esa sesión de
   lectura. Como el id es determinista, el mapeo que ve el visitante coincide
   exactamente con el que persistirá el admin cuando entre; hasta entonces,
   el sitio deja de mostrarse vacío en vez de depender de que alguien haga
   login primero. Se recalcula en cada llamada (barato: `planMigration`
   devuelve `null` para lo que ya esté migrado en `state.items`), así que no
   hace falta memoizar nada para este camino. */
export function migrateCollections(): Promise<void> {
  if (!state.isAdmin) {
    const plan = computeMigrationPlan(state.items)
    if (plan) { applyMigrationPlan(plan); emit() }
    return Promise.resolve()
  }

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

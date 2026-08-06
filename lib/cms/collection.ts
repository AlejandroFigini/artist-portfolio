/* Lógica pura de colecciones: derivación de claves y planificación de escrituras.
   Este módulo NO importa React, el store ni la red — así se puede testear entero
   sin montar nada. El hook `useCollection` es el que aplica los planes. */

import type { CollectionSpec } from './collections'

export type CollectionSettings = { ids: string[]; duration?: number }

const ID_LENGTH = 6
const PLACEHOLDER_MARKER = 'placeholder'
const EMPTY_BACKGROUNDS = new Set(['url("")', "url('')", 'url()'])

function randomId(): string {
  const bytes = new Uint8Array(ID_LENGTH)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => (b % 36).toString(36)).join('')
}

/* `rand` es inyectable para que los tests sean deterministas. */
export function newId(existing: Iterable<string>, rand: () => string = randomId): string {
  const taken = new Set(existing)
  let id = rand()
  while (taken.has(id)) id = rand()
  return id
}

/* Hash FNV-1a de 32 bits: no criptográfico, solo necesitamos que el mismo
   seed produzca siempre el mismo número. */
function fnv1a(seed: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function hashToId(n: number): string {
  let s = n.toString(36).padStart(ID_LENGTH, '0').slice(-ID_LENGTH)
  // Un id totalmente numérico sería indistinguible de un índice legacy para
  // `legacyIndices()` (ver D2) — se fuerza al menos una letra.
  if (!/[a-z]/.test(s)) s = 'abcdefghijklmnopqrstuvwxyz'[n % 26] + s.slice(1)
  return s
}

/* Id determinista: mismo seed → mismo id, siempre. A diferencia de `newId`
   (aleatorio, para items nuevos creados a mano desde el gestor), la
   migración necesita que dos corridas —o dos pestañas migrando a la vez—
   produzcan EXACTAMENTE el mismo mapeo índice→uid, para que no queden filas
   huérfanas en la DB si ambas escriben (ver D2). Una colisión dentro de la
   misma corrida se resuelve reintentando con un sufijo, también determinista. */
export function migrationId(seed: string, existing: Iterable<string> = []): string {
  const taken = new Set(existing)
  let id = hashToId(fnv1a(seed))
  let attempt = 0
  while (taken.has(id)) {
    attempt++
    id = hashToId(fnv1a(`${seed}#${attempt}`))
  }
  return id
}

/* Generador de ids para `planMigration` (parámetro `makeId`, firma sin
   tocar: `(taken: Iterable<string>) => string`). Cierra sobre el prefijo de
   la colección y arma el seed con la posición del item dentro de la corrida:
   misma foto de `items` de entrada → misma secuencia de posiciones → mismos
   ids, sin depender de un `i` que la firma de `makeId` no expone. */
export function migrationIdGenerator(prefix: string): (existing: Iterable<string>) => string {
  let position = 0
  return (existing: Iterable<string>) => migrationId(`${prefix}#${position++}`, existing)
}

export function readSettings(items: Record<string, string>, prefix: string): CollectionSettings {
  try {
    const parsed = JSON.parse(items[`${prefix}.settings`] || '')
    const ids = Array.isArray(parsed?.ids) && parsed.ids.every((v: unknown) => typeof v === 'string')
      ? (parsed.ids as string[])
      : []
    const duration = typeof parsed?.duration === 'number' && parsed.duration > 0
      ? parsed.duration
      : undefined
    return duration === undefined ? { ids } : { ids, duration }
  } catch {
    return { ids: [] }
  }
}

export function writeSettings(settings: CollectionSettings): string {
  return JSON.stringify(
    settings.duration === undefined
      ? { ids: settings.ids }
      : { ids: settings.ids, duration: settings.duration },
  )
}

export const itemKey = (spec: CollectionSpec, id: string) => `${spec.prefix}#${id}`

export function mediaKeysOf(spec: CollectionSpec, id: string): string[] {
  const base = itemKey(spec, id)
  return [base, ...Array.from({ length: spec.concepts ?? 0 }, (_, m) => `${base}::c${m}`)]
}

export function fieldKeysOf(spec: CollectionSpec, id: string): string[] {
  const base = itemKey(spec, id)
  return (spec.fields ?? []).map((f) => `${base}::${f.key}`)
}

export const allKeysOf = (spec: CollectionSpec, id: string) =>
  [...mediaKeysOf(spec, id), ...fieldKeysOf(spec, id)]

export function isEmptyMedia(src: string | undefined | null): boolean {
  if (!src) return true
  const v = src.trim()
  if (!v) return true
  if (EMPTY_BACKGROUNDS.has(v)) return true
  return v.includes(PLACEHOLDER_MARKER)
}

export type CommitPlan = {
  payload: Record<string, string>
  archiveKeys: string[]
  deleteKeys: string[]
}

const CONCEPT_KEY_RE = /::c\d+$/

/* Media = la clave base del item o un slot de concepto (`::cN`). Cualquier
   otro sufijo (`::title`, `::end_date`, …) es texto y nunca se archiva,
   exista o no en la lista declarada de campos. */
function isMediaKey(base: string, key: string): boolean {
  return key === base || CONCEPT_KEY_RE.test(key)
}

/* Claves reales del item a borrar/archivar: unión de lo DECLARADO en la spec
   (`allKeysOf`, cubre el caso normal aunque un campo nunca se haya escrito)
   con todo lo que `items` tenga de más bajo `<itemKey>::` — declarado o no
   (ver D6: el modal de edición escribe más campos que los que `spec.fields`
   declara, y datos legacy pueden traer conceptos `::c3..c5` que `spec.concepts`
   no cubre). Escanear en vez de derivar de una lista evita que dos listas
   paralelas se desincronicen. */
function itemKeysOf(spec: CollectionSpec, id: string, items: Record<string, string>): string[] {
  const base = itemKey(spec, id)
  const prefix = `${base}::`
  const keys = new Set<string>(allKeysOf(spec, id))
  for (const k of Object.keys(items)) {
    if (k === base || k.startsWith(prefix)) keys.add(k)
  }
  return [...keys]
}

/* Diferencia el orden anterior contra el nuevo y devuelve exactamente lo que hay
   que escribir. Un reordenamiento no produce bajas → payload de una sola clave.
   Los items que siguen vivos NUNCA se tocan: su uid no cambió. */
export function planCommit(
  spec: CollectionSpec,
  prevIds: string[],
  nextIds: string[],
  items: Record<string, string>,
  duration?: number,
): CommitPlan {
  const surviving = new Set(nextIds)
  const removed = prevIds.filter((id) => !surviving.has(id))

  const archiveKeys: string[] = []
  const deleteKeys: string[] = []
  for (const id of removed) {
    const base = itemKey(spec, id)
    const keys = itemKeysOf(spec, id, items)
    for (const k of keys) {
      if (isMediaKey(base, k) && !isEmptyMedia(items[k])) archiveKeys.push(k)
    }
    deleteKeys.push(...keys)
  }

  const payload: Record<string, string> = {
    [`${spec.prefix}.settings`]: writeSettings(
      spec.duration ? { ids: nextIds, duration } : { ids: nextIds },
    ),
  }
  for (const k of deleteKeys) payload[k] = ''

  return { payload, archiveKeys, deleteKeys }
}

export type MigrationPlan = {
  payload: Record<string, string>
  renames: Record<string, string>
}

/* Índices legacy presentes en `items` para esta colección, ordenados.
   Se leen del propio estado en vez de confiar en `count`: un count desfasado
   (bug conocido del formato viejo) no debe inventar ni perder items. */
function legacyIndices(spec: CollectionSpec, items: Record<string, string>): number[] {
  const re = new RegExp(`^${escapeRe(spec.legacyBase)}#(\\d+)(?:::|$)`)
  const found = new Set<number>()
  for (const k of Object.keys(items)) {
    const m = k.match(re)
    if (m) found.add(Number(m[1]))
  }
  return [...found].sort((a, b) => a - b)
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/* ¿El slot legacy tiene algún campo declarado con contenido? Solo aplica a
   proj/char (colecciones con `fields`): ahí "ficha cargada, imagen todavía no"
   es un estado normal, no un hueco vacío del formato viejo (ver D4). */
function hasFieldContent(spec: CollectionSpec, oldBase: string, items: Record<string, string>): boolean {
  if (!spec.fields?.length) return false
  return spec.fields.some((f) => {
    const v = items[`${oldBase}::${f.key}`]
    return typeof v === 'string' && v.trim() !== ''
  })
}

export function planMigration(
  spec: CollectionSpec,
  items: Record<string, string>,
  makeId: (taken: Iterable<string>) => string,
): MigrationPlan | null {
  if (readSettings(items, spec.prefix).ids.length > 0) return null

  const indices = legacyIndices(spec, items)
  if (indices.length === 0) return null

  const payload: Record<string, string> = {}
  const renames: Record<string, string> = {}
  const ids: string[] = []

  for (const i of indices) {
    const oldBase = `${spec.legacyBase}#${i}`
    // Un slot legacy sin media es un hueco del formato viejo, no un item —
    // salvo que tenga texto cargado (ver hasFieldContent/D4): ahí es una
    // ficha real esperando su imagen, y descartarla borraría su texto sin
    // posibilidad de recuperarlo (la migración es idempotente).
    if (isEmptyMedia(items[oldBase]) && !hasFieldContent(spec, oldBase, items)) continue

    const id = makeId(ids)
    ids.push(id)
    const newBase = itemKey(spec, id)

    for (const oldKey of Object.keys(items)) {
      if (oldKey !== oldBase && !oldKey.startsWith(`${oldBase}::`)) continue
      const newKey = oldKey === oldBase ? newBase : `${newBase}::${oldKey.slice(oldBase.length + 2)}`
      payload[newKey] = items[oldKey]
      payload[oldKey] = ''
      renames[oldKey] = newKey
    }
  }

  payload[`${spec.prefix}.settings`] = writeSettings(
    spec.duration ? { ids, duration: readSettings(items, spec.prefix).duration } : { ids },
  )

  return { payload, renames }
}

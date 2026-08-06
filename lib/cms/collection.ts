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
    for (const k of mediaKeysOf(spec, id)) {
      if (!isEmptyMedia(items[k])) archiveKeys.push(k)
    }
    deleteKeys.push(...allKeysOf(spec, id))
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
    // Un slot legacy sin media es un hueco del formato viejo, no un item.
    if (isEmptyMedia(items[oldBase])) continue

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

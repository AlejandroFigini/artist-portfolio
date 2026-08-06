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

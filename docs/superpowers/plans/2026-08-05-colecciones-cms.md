# Reestructuración de colecciones del CMS — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la identidad posicional de los items de colección (`proj#2`, `hero.slide#0`) por uids estables, con una única implementación de persistencia, de modo que reordenar, borrar y agregar dejen de corromper el estado.

**Architecture:** Un módulo de lógica pura (`lib/cms/collection.ts`) que planifica commits y migraciones sin tocar store, red ni DOM — testeable con vitest. Encima, un hook (`lib/cms/useCollection.ts`) que aplica esos planes al store, y un `CollectionManager` único parametrizado por specs declarativas. Los consumidores de render leen del store por suscripción; se elimina el bus de `CustomEvent` y la recarga de página.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5, vitest (nuevo), Embla Carousel 8, GSAP 3, PostgreSQL vía `pg`.

**Spec de referencia:** `docs/superpowers/specs/2026-08-05-colecciones-cms-design.md`

## Global Constraints

- **Idioma del sitio: inglés.** Todo texto visible por el usuario (labels, botones, `title`, `aria-label`, `placeholder`, toasts, errores de validación) se escribe en inglés. Los comentarios de código siguen en español.
- **No renombrar identificadores internos**: slugs de ruta, clases CSS (`cms-tag--basurero`, `.ch-panel`, `.proj-card-img`), carpetas de Cloudinary (`portfolio/en-uso|sin-usar|basurero`).
- **Archivos bajo 500 líneas.** Si un archivo pasa ese límite, se extrae un componente hijo por responsabilidad, no por tipo de colección.
- **Cambios quirúrgicos**: no reformatear ni "mejorar" código adyacente. Remover solo los imports/variables que los propios cambios dejaron sin uso.
- **`POST /api/content` trata `''` como DELETE de fila.** Vaciar una clave = mandarla con string vacío.
- **`isTranslatableEntry()` en `lib/i18n.ts` excluye `*.settings`.** Por eso el orden vive dentro de `<prefix>.settings` y no en una clave nueva.
- **Responsive obligatorio** a 320 / 375 / 768 / 1024 / 1440 px, con unidades relativas (`rem`, `%`, `dvh`, `clamp()`).
- **Animaciones** respetan `prefers-reduced-motion`.
- Comandos de verificación disponibles: `npm run type-check`, `npm run lint`, `npm run build`, y (tras la Task 1) `npx vitest run`.

## Corrección al spec descubierta durante la planificación

El spec §4.5 dice que "el engine debe leer `data-cms-key` en vez de asignarlo". Al inspeccionar el código, `engine.indexEditables()` (`components/cms/engine.ts:250-252`) **ya lo lee primero**:

```ts
let key = el.getAttribute('data-cms-key')
if (!key) {
  key = entry.base + '#' + i
  el.setAttribute('data-cms-key', key)
}
```

Y tanto `ProjectsShowcase.ProjectCard` (`:100`) como `CharactersShowcase.CharMedia` (`:67`) ya emiten el atributo desde React. Lo que falta no es la lectura sino **desactivar el fallback posicional** para las bases de colección: con uids, un elemento sin atributo recibiría `proj#0` y crearía una clave fantasma. La Task 7 agrega `identity: 'attr'` a esas entradas del REGISTRY para que se salteen en vez de inventar clave.

---

## Estructura de archivos

| Archivo | Responsabilidad | Estado |
|---|---|---|
| `lib/cms/collections.ts` | Tabla declarativa de specs. Sin lógica. | Crear |
| `lib/cms/collection.ts` | Lógica pura: claves, planificación de commit y de migración. Sin imports de React ni del store. | Crear |
| `lib/cms/useCollection.ts` | Hook que aplica los planes al store y a la red. | Crear |
| `components/cms/CollectionManager.tsx` | Modal único de gestión. | Crear |
| `components/cms/CollectionRow.tsx` | Fila de un item (simple o rica). | Crear |
| `tests/cms/collection.test.ts` | Tests de la lógica pura. | Crear |
| `vitest.config.ts` | Config del runner. | Crear |
| `components/cms/CarouselManager.tsx` | — | **Borrar** |
| `components/cms/ProjectsManager.tsx` | — | **Borrar** |
| `components/cms/CharactersManager.tsx` | — | **Borrar** |
| `components/cms/CmsRoot.tsx` | Monta `CollectionManager`; pierde el broadcast inline. | Modificar |
| `components/cms/engine.ts` | Pierde `broadcastCarousel`, `ensure*Meta` x3, `deleteProjectSite`, entradas `*.slide` del REGISTRY. | Modificar |
| `lib/cms/store.ts` | Pierde `compactList` y la normalización legacy de `proj.settings`. | Modificar |
| `components/home/Slideshow.tsx` | Pierde el listener `cms:hero`. | Modificar |
| `components/home/HeroMediaCarousel.tsx` | Lee por `useCollection`. | Modificar |
| `components/home/ProjectsShowcase.tsx` | Itera ids, no índices. | Modificar |
| `components/home/CharactersShowcase.tsx` | Itera ids, no índices. | Modificar |
| `components/ui/useCarouselSync.ts` | Pierde el `rescan()` diferido. | Modificar |
| `components/cms/TextModals.tsx` | Regex de uid. | Modificar |

---

## Task 1: Runner de tests, specs y helpers de clave

**Files:**
- Create: `vitest.config.ts`
- Create: `lib/cms/collections.ts`
- Create: `lib/cms/collection.ts`
- Create: `tests/cms/collection.test.ts`
- Modify: `package.json` (scripts + devDependency)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type CollectionField = { key: string; label: string; type: 'text' | 'textarea' | 'date' }`
  - `type CollectionSpec = { prefix: string; legacyBase: string; label: string; itemNoun: string; section: string; accept: string; max?: number; duration?: boolean; concepts?: number; fields?: CollectionField[] }`
  - `const COLLECTIONS: Record<string, CollectionSpec>`
  - `function collectionOf(key: string): CollectionSpec | null`
  - `type CollectionSettings = { ids: string[]; duration?: number }`
  - `function newId(existing: Iterable<string>, rand?: () => string): string`
  - `function readSettings(items: Record<string, string>, prefix: string): CollectionSettings`
  - `function writeSettings(settings: CollectionSettings): string`
  - `function itemKey(spec: CollectionSpec, id: string): string`
  - `function mediaKeysOf(spec: CollectionSpec, id: string): string[]`
  - `function fieldKeysOf(spec: CollectionSpec, id: string): string[]`
  - `function allKeysOf(spec: CollectionSpec, id: string): string[]`
  - `function isEmptyMedia(src: string | undefined | null): boolean`

- [ ] **Step 1: Instalar vitest**

```bash
npm install --save-dev vitest@^3
```

- [ ] **Step 2: Crear `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, '.') },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
```

- [ ] **Step 3: Agregar el script de test a `package.json`**

En el bloque `"scripts"`, después de `"type-check"`, agregar:

```json
    "test": "vitest run"
```

- [ ] **Step 4: Escribir el test que falla**

Crear `tests/cms/collection.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { COLLECTIONS, collectionOf } from '@/lib/cms/collections'
import {
  allKeysOf,
  fieldKeysOf,
  isEmptyMedia,
  itemKey,
  mediaKeysOf,
  newId,
  readSettings,
} from '@/lib/cms/collection'

describe('COLLECTIONS', () => {
  it('declara las seis colecciones dinámicas', () => {
    expect(Object.keys(COLLECTIONS).sort()).toEqual([
      'about-carousel', 'char', 'hero', 'hero-main', 'hero-sub', 'proj',
    ])
  })

  it('los carruseles de portada rotan y tienen tope de 4', () => {
    expect(COLLECTIONS['hero'].duration).toBe(true)
    expect(COLLECTIONS['hero'].max).toBe(4)
    expect(COLLECTIONS['hero'].concepts).toBeUndefined()
  })

  it('proj y char declaran campos y conceptos', () => {
    expect(COLLECTIONS['proj'].concepts).toBe(3)
    expect(COLLECTIONS['proj'].fields?.map((f) => f.key)).toEqual(['title', 'start_date', 'summary'])
    expect(COLLECTIONS['char'].concepts).toBe(3)
    expect(COLLECTIONS['char'].fields?.map((f) => f.key)).toEqual(['name', 'role', 'desc'])
  })

  it('legacyBase conserva el infijo .slide de los carruseles', () => {
    expect(COLLECTIONS['hero'].legacyBase).toBe('hero.slide')
    expect(COLLECTIONS['about-carousel'].legacyBase).toBe('about-carousel.slide')
    expect(COLLECTIONS['proj'].legacyBase).toBe('proj')
  })
})

describe('collectionOf', () => {
  it('resuelve la spec desde una clave de media', () => {
    expect(collectionOf('proj#k3f9')?.prefix).toBe('proj')
  })

  it('resuelve la spec desde una clave de campo o de concepto', () => {
    expect(collectionOf('proj#k3f9::title')?.prefix).toBe('proj')
    expect(collectionOf('char#m2b1::c2')?.prefix).toBe('char')
  })

  it('no confunde prefijos que comparten raíz', () => {
    expect(collectionOf('hero-main#a1c7')?.prefix).toBe('hero-main')
    expect(collectionOf('hero#a1c7')?.prefix).toBe('hero')
  })

  it('devuelve null para claves que no son de colección', () => {
    expect(collectionOf('illustration#3')).toBeNull()
    expect(collectionOf('proj.settings')).toBeNull()
    expect(collectionOf('proj.soft#1')).toBeNull()
  })
})

describe('newId', () => {
  it('genera un id base36 de 6 caracteres', () => {
    expect(newId([])).toMatch(/^[a-z0-9]{6}$/)
  })

  it('evita colisionar con los ids existentes', () => {
    const rand = (() => {
      const queue = ['aaaaaa', 'aaaaaa', 'bbbbbb']
      return () => queue.shift()!
    })()
    expect(newId(['aaaaaa'], rand)).toBe('bbbbbb')
  })
})

describe('readSettings', () => {
  it('lee ids y duración del formato nuevo', () => {
    const items = { 'hero.settings': '{"ids":["a1","b2"],"duration":9000}' }
    expect(readSettings(items, 'hero')).toEqual({ ids: ['a1', 'b2'], duration: 9000 })
  })

  it('devuelve ids vacíos si la clave no existe', () => {
    expect(readSettings({}, 'hero')).toEqual({ ids: [] })
  })

  it('tolera JSON inválido sin lanzar', () => {
    expect(readSettings({ 'hero.settings': '{roto' }, 'hero')).toEqual({ ids: [] })
  })

  it('ignora un ids que no sea array de strings', () => {
    expect(readSettings({ 'hero.settings': '{"ids":[1,2]}' }, 'hero')).toEqual({ ids: [] })
  })

  it('no interpreta el count legacy como ids', () => {
    expect(readSettings({ 'proj.settings': '{"count":4}' }, 'proj')).toEqual({ ids: [] })
  })
})

describe('helpers de clave', () => {
  const proj = COLLECTIONS['proj']
  const hero = COLLECTIONS['hero']

  it('itemKey usa el prefijo, no el legacyBase', () => {
    expect(itemKey(hero, 'a1c7')).toBe('hero#a1c7')
    expect(itemKey(proj, 'k3f9')).toBe('proj#k3f9')
  })

  it('mediaKeysOf incluye el principal y los conceptos', () => {
    expect(mediaKeysOf(proj, 'k3f9')).toEqual([
      'proj#k3f9', 'proj#k3f9::c0', 'proj#k3f9::c1', 'proj#k3f9::c2',
    ])
  })

  it('mediaKeysOf de un carrusel es solo el principal', () => {
    expect(mediaKeysOf(hero, 'a1c7')).toEqual(['hero#a1c7'])
  })

  it('fieldKeysOf lista los campos declarados', () => {
    expect(fieldKeysOf(proj, 'k3f9')).toEqual([
      'proj#k3f9::title', 'proj#k3f9::start_date', 'proj#k3f9::summary',
    ])
  })

  it('allKeysOf es la unión de media y campos', () => {
    expect(allKeysOf(proj, 'k3f9')).toEqual([
      'proj#k3f9', 'proj#k3f9::c0', 'proj#k3f9::c1', 'proj#k3f9::c2',
      'proj#k3f9::title', 'proj#k3f9::start_date', 'proj#k3f9::summary',
    ])
  })
})

describe('isEmptyMedia', () => {
  it('trata como vacíos los placeholders de background sin URL', () => {
    expect(isEmptyMedia('')).toBe(true)
    expect(isEmptyMedia('   ')).toBe(true)
    expect(isEmptyMedia(undefined)).toBe(true)
    expect(isEmptyMedia(null)).toBe(true)
    expect(isEmptyMedia('url("")')).toBe(true)
    expect(isEmptyMedia('url()')).toBe(true)
  })

  it('trata como vacío un placeholder por nombre de archivo', () => {
    expect(isEmptyMedia('/img/placeholder.webp')).toBe(true)
  })

  it('acepta una URL real', () => {
    expect(isEmptyMedia('https://res.cloudinary.com/x/a.webp')).toBe(false)
  })
})
```

- [ ] **Step 5: Correr el test para verificar que falla**

Run: `npx vitest run tests/cms/collection.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/cms/collections"`

- [ ] **Step 6: Crear `lib/cms/collections.ts`**

```ts
/* Declaración de las colecciones dinámicas del CMS. Una entrada por colección;
   agregar una colección nueva es agregar una entrada acá, no código nuevo.
   `prefix` es la clave viva (`proj#<uid>`); `legacyBase` es la forma vieja
   indexada por posición, que solo usa la migración. */

export type CollectionField = {
  key: string
  label: string
  type: 'text' | 'textarea' | 'date'
}

export type CollectionSpec = {
  prefix: string
  legacyBase: string
  label: string
  itemNoun: string
  section: string
  accept: string
  max?: number
  duration?: boolean
  concepts?: number
  fields?: CollectionField[]
}

const CAROUSEL_MAX = 4

const carousel = (
  prefix: string,
  label: string,
  section: string,
): CollectionSpec => ({
  prefix,
  legacyBase: `${prefix}.slide`,
  label,
  itemNoun: 'slide',
  section,
  accept: 'webp',
  max: CAROUSEL_MAX,
  duration: true,
})

export const COLLECTIONS: Record<string, CollectionSpec> = {
  'hero': carousel('hero', 'Hero Background Carousel', 'Hero'),
  'hero-main': carousel('hero-main', 'Main Carousel', 'Hero (Main)'),
  'hero-sub': carousel('hero-sub', 'Secondary Carousel', 'Hero (Secondary)'),
  'about-carousel': carousel('about-carousel', 'About me Carousel', 'About me'),
  'proj': {
    prefix: 'proj',
    legacyBase: 'proj',
    label: 'Featured Projects',
    itemNoun: 'project',
    section: 'Projects',
    accept: 'webp',
    concepts: 3,
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'start_date', label: 'Start date', type: 'date' },
      { key: 'summary', label: 'Summary', type: 'textarea' },
    ],
  },
  'char': {
    prefix: 'char',
    legacyBase: 'char',
    label: 'Character Design',
    itemNoun: 'character',
    section: 'Characters',
    accept: 'webp',
    concepts: 3,
    fields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'role', label: 'Role', type: 'text' },
      { key: 'desc', label: 'Description', type: 'textarea' },
    ],
  },
}

/* Los prefijos se prueban de más largo a más corto: `hero-main#x` no debe
   resolver a la spec `hero`. */
const PREFIXES_BY_LENGTH = Object.keys(COLLECTIONS).sort((a, b) => b.length - a.length)

export function collectionOf(key: string): CollectionSpec | null {
  for (const prefix of PREFIXES_BY_LENGTH) {
    if (key.startsWith(`${prefix}#`)) return COLLECTIONS[prefix]
  }
  return null
}
```

- [ ] **Step 7: Crear `lib/cms/collection.ts` con los helpers**

```ts
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
```

- [ ] **Step 8: Correr el test para verificar que pasa**

Run: `npx vitest run tests/cms/collection.test.ts`
Expected: PASS — todos los tests del archivo en verde, ninguno saltado

- [ ] **Step 9: Verificar tipos y lint**

Run: `npm run type-check && npm run lint`
Expected: sin errores

- [ ] **Step 10: Commit**

```bash
git add vitest.config.ts package.json package-lock.json pnpm-lock.yaml lib/cms/collections.ts lib/cms/collection.ts tests/cms/collection.test.ts
git commit -m "feat(cms): specs de coleccion y helpers de clave con vitest"
```

---

## Task 2: Planificador de commit

**Files:**
- Modify: `lib/cms/collection.ts`
- Modify: `tests/cms/collection.test.ts`

**Interfaces:**
- Consumes: `CollectionSpec`, `allKeysOf`, `mediaKeysOf`, `writeSettings` (Task 1).
- Produces:
  - `type CommitPlan = { payload: Record<string, string>; archiveKeys: string[]; deleteKeys: string[] }`
  - `function planCommit(spec: CollectionSpec, prevIds: string[], nextIds: string[], items: Record<string, string>, duration?: number): CommitPlan`

`archiveKeys` son las claves de media de los items eliminados que **tienen contenido** (las vacías no se archivan). `deleteKeys` son todas las claves de los items eliminados. `payload` es lo que se manda a `POST /api/content`.

- [ ] **Step 1: Escribir el test que falla**

Agregar al final de `tests/cms/collection.test.ts`:

```ts
import { planCommit } from '@/lib/cms/collection'

describe('planCommit', () => {
  const proj = COLLECTIONS['proj']
  const hero = COLLECTIONS['hero']

  const items = {
    'proj.settings': '{"ids":["a","b","c"]}',
    'proj#a': 'https://cdn/a.webp',
    'proj#a::title': 'Alpha',
    'proj#a::c0': 'https://cdn/a-c0.webp',
    'proj#b': 'https://cdn/b.webp',
    'proj#b::title': 'Beta',
    'proj#c': 'https://cdn/c.webp',
    'proj#c::title': 'Gamma',
  }

  it('un reordenamiento puro escribe SOLO la clave de settings', () => {
    const plan = planCommit(proj, ['a', 'b', 'c'], ['b', 'a', 'c'], items)
    expect(Object.keys(plan.payload)).toEqual(['proj.settings'])
    expect(plan.payload['proj.settings']).toBe('{"ids":["b","a","c"]}')
  })

  it('un reordenamiento puro no archiva ni borra nada', () => {
    const plan = planCommit(proj, ['a', 'b', 'c'], ['c', 'b', 'a'], items)
    expect(plan.archiveKeys).toEqual([])
    expect(plan.deleteKeys).toEqual([])
  })

  it('borrar el item del medio solo toca sus propias claves', () => {
    const plan = planCommit(proj, ['a', 'b', 'c'], ['a', 'c'], items)
    expect(plan.payload['proj.settings']).toBe('{"ids":["a","c"]}')
    expect(plan.payload['proj#b']).toBe('')
    expect(plan.payload['proj#b::title']).toBe('')
    expect(plan.payload['proj#a']).toBeUndefined()
    expect(plan.payload['proj#c']).toBeUndefined()
    expect(plan.payload['proj#a::title']).toBeUndefined()
  })

  it('borrar archiva las claves de media con contenido, una sola vez', () => {
    const plan = planCommit(proj, ['a', 'b', 'c'], ['b', 'c'], items)
    expect(plan.archiveKeys).toEqual(['proj#a', 'proj#a::c0'])
  })

  it('borrar no archiva slots de media vacíos', () => {
    const plan = planCommit(proj, ['a', 'b', 'c'], ['a', 'c'], items)
    expect(plan.archiveKeys).toEqual(['proj#b'])
  })

  it('deleteKeys cubre media, conceptos y campos del item borrado', () => {
    const plan = planCommit(proj, ['a', 'b'], ['b'], items)
    expect(plan.deleteKeys).toEqual([
      'proj#a', 'proj#a::c0', 'proj#a::c1', 'proj#a::c2',
      'proj#a::title', 'proj#a::start_date', 'proj#a::summary',
    ])
  })

  it('agregar un item escribe solo settings: el media lo escribe el picker', () => {
    const plan = planCommit(proj, ['a'], ['a', 'nuevo'], items)
    expect(Object.keys(plan.payload)).toEqual(['proj.settings'])
    expect(plan.payload['proj.settings']).toBe('{"ids":["a","nuevo"]}')
  })

  it('vaciar la colección borra todos los items', () => {
    const plan = planCommit(proj, ['a', 'b', 'c'], [], items)
    expect(plan.payload['proj.settings']).toBe('{"ids":[]}')
    expect(plan.archiveKeys).toEqual(['proj#a', 'proj#a::c0', 'proj#b', 'proj#c'])
  })

  it('persiste la duración en las colecciones que rotan', () => {
    const plan = planCommit(hero, ['x'], ['x'], { 'hero#x': 'https://cdn/x.webp' }, 9000)
    expect(plan.payload['hero.settings']).toBe('{"ids":["x"],"duration":9000}')
  })

  it('ignora la duración en las colecciones que no rotan', () => {
    const plan = planCommit(proj, ['a'], ['a'], items, 9000)
    expect(plan.payload['proj.settings']).toBe('{"ids":["a"]}')
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run tests/cms/collection.test.ts`
Expected: FAIL — `planCommit is not a function` / no exportada

- [ ] **Step 3: Implementar `planCommit` en `lib/cms/collection.ts`**

Agregar al final del archivo:

```ts
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
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run tests/cms/collection.test.ts`
Expected: PASS — los 10 tests nuevos de `planCommit` en verde, más los de la Task 1

- [ ] **Step 5: Verificar tipos y lint**

Run: `npm run type-check && npm run lint`
Expected: sin errores

- [ ] **Step 6: Commit**

```bash
git add lib/cms/collection.ts tests/cms/collection.test.ts
git commit -m "feat(cms): planCommit transaccional para colecciones"
```

---

## Task 3: Planificador de migración

**Files:**
- Modify: `lib/cms/collection.ts`
- Modify: `tests/cms/collection.test.ts`

**Interfaces:**
- Consumes: `CollectionSpec`, `readSettings`, `writeSettings`, `newId` (Tasks 1-2).
- Produces:
  - `type MigrationPlan = { payload: Record<string, string>; renames: Record<string, string> }`
  - `function planMigration(spec: CollectionSpec, items: Record<string, string>, makeId: (taken: Iterable<string>) => string): MigrationPlan | null`

Devuelve `null` cuando no hay nada que migrar (ya tiene `ids`, o no hay formato legacy). `renames` mapea clave vieja → clave nueva, para que el aplicador mueva también `state.usedContent`.

- [ ] **Step 1: Escribir el test que falla**

Agregar al final de `tests/cms/collection.test.ts`:

```ts
import { planMigration } from '@/lib/cms/collection'

describe('planMigration', () => {
  const proj = COLLECTIONS['proj']
  const hero = COLLECTIONS['hero']

  /* Generador determinista: id0, id1, id2… */
  const makeIds = () => {
    let n = 0
    return () => `id${n++}`
  }

  it('devuelve null si la colección ya tiene ids', () => {
    expect(planMigration(proj, { 'proj.settings': '{"ids":["a"]}' }, makeIds())).toBeNull()
  })

  it('devuelve null si no hay settings ni claves legacy', () => {
    expect(planMigration(proj, {}, makeIds())).toBeNull()
  })

  it('convierte count legacy en ids', () => {
    const plan = planMigration(proj, {
      'proj.settings': '{"count":2}',
      'proj#0': 'https://cdn/a.webp',
      'proj#1': 'https://cdn/b.webp',
    }, makeIds())!
    expect(plan.payload['proj.settings']).toBe('{"ids":["id0","id1"]}')
    expect(plan.payload['proj#id0']).toBe('https://cdn/a.webp')
    expect(plan.payload['proj#id1']).toBe('https://cdn/b.webp')
  })

  it('vacía las claves legacy que quedaron libres', () => {
    const plan = planMigration(proj, {
      'proj.settings': '{"count":1}',
      'proj#0': 'https://cdn/a.webp',
    }, makeIds())!
    expect(plan.payload['proj#0']).toBe('')
  })

  it('arrastra campos y conceptos del item', () => {
    const plan = planMigration(proj, {
      'proj.settings': '{"count":1}',
      'proj#0': 'https://cdn/a.webp',
      'proj#0::title': 'Alpha',
      'proj#0::c1': 'https://cdn/a-c1.webp',
    }, makeIds())!
    expect(plan.payload['proj#id0::title']).toBe('Alpha')
    expect(plan.payload['proj#id0::c1']).toBe('https://cdn/a-c1.webp')
    expect(plan.payload['proj#0::title']).toBe('')
    expect(plan.payload['proj#0::c1']).toBe('')
  })

  it('renames mapea cada clave vieja a la nueva', () => {
    const plan = planMigration(proj, {
      'proj.settings': '{"count":1}',
      'proj#0': 'https://cdn/a.webp',
      'proj#0::title': 'Alpha',
    }, makeIds())!
    expect(plan.renames).toEqual({
      'proj#0': 'proj#id0',
      'proj#0::title': 'proj#id0::title',
    })
  })

  it('migra el infijo .slide de los carruseles y conserva la duración', () => {
    const plan = planMigration(hero, {
      'hero.settings': '{"count":2,"duration":9000}',
      'hero.slide#0': 'https://cdn/s0.webp',
      'hero.slide#1': 'https://cdn/s1.webp',
    }, makeIds())!
    expect(plan.payload['hero.settings']).toBe('{"ids":["id0","id1"],"duration":9000}')
    expect(plan.payload['hero#id0']).toBe('https://cdn/s0.webp')
    expect(plan.payload['hero.slide#0']).toBe('')
  })

  it('descarta los slots legacy vacíos en vez de crear items fantasma', () => {
    const plan = planMigration(proj, {
      'proj.settings': '{"count":3}',
      'proj#0': 'https://cdn/a.webp',
      'proj#1': '',
      'proj#2': 'https://cdn/c.webp',
    }, makeIds())!
    expect(plan.payload['proj.settings']).toBe('{"ids":["id0","id1"]}')
    expect(plan.payload['proj#id0']).toBe('https://cdn/a.webp')
    expect(plan.payload['proj#id1']).toBe('https://cdn/c.webp')
  })

  it('migra claves legacy huérfanas aunque no haya settings', () => {
    const plan = planMigration(proj, {
      'proj#0': 'https://cdn/a.webp',
    }, makeIds())!
    expect(plan.payload['proj.settings']).toBe('{"ids":["id0"]}')
    expect(plan.payload['proj#id0']).toBe('https://cdn/a.webp')
  })

  it('es idempotente: aplicar el plan y replanificar devuelve null', () => {
    const items: Record<string, string> = {
      'proj.settings': '{"count":1}',
      'proj#0': 'https://cdn/a.webp',
    }
    const plan = planMigration(proj, items, makeIds())!
    for (const [k, v] of Object.entries(plan.payload)) {
      if (v === '') delete items[k]
      else items[k] = v
    }
    expect(planMigration(proj, items, makeIds())).toBeNull()
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run tests/cms/collection.test.ts`
Expected: FAIL — `planMigration is not a function`

- [ ] **Step 3: Implementar `planMigration` en `lib/cms/collection.ts`**

Agregar al final del archivo:

```ts
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

function legacyDuration(items: Record<string, string>, prefix: string): number | undefined {
  try {
    const parsed = JSON.parse(items[`${prefix}.settings`] || '')
    return typeof parsed?.duration === 'number' && parsed.duration > 0 ? parsed.duration : undefined
  } catch {
    return undefined
  }
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
    spec.duration ? { ids, duration: legacyDuration(items, spec.prefix) } : { ids },
  )

  return { payload, renames }
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run tests/cms/collection.test.ts`
Expected: PASS — los 11 tests nuevos de `planMigration` en verde, más los anteriores

- [ ] **Step 5: Verificar tipos y lint**

Run: `npm run type-check && npm run lint`
Expected: sin errores

- [ ] **Step 6: Commit**

```bash
git add lib/cms/collection.ts tests/cms/collection.test.ts
git commit -m "feat(cms): planMigration idempotente de indice posicional a uid"
```

---

## Task 4: Hook `useCollection` y aplicador de migración

**Files:**
- Create: `lib/cms/useCollection.ts`
- Modify: `lib/cms/store.ts` (llamar a `migrateCollections` tras hidratar)

**Interfaces:**
- Consumes: `COLLECTIONS`, `CollectionSpec`, `planCommit`, `planMigration`, `readSettings`, `newId`, `itemKey`, `mediaKeysOf`, `isEmptyMedia` (Tasks 1-3); del store: `state`, `emit`, `useCmsStore`, `archiveMediaKey`, `persistUnused`, `persistUsed`, `loadJSON`, `saveJSON`, `LS`, `scheduleSyncToServer`; de `lib/api`: `saveContent`.
- Produces:
  - `function useCollection(spec: CollectionSpec): CollectionHandle`
  - `type CollectionHandle = { ids: string[]; duration: number; dirty: boolean; add(): string; remove(id: string): void; move(id: string, dir: -1 | 1): void; setDuration(ms: number): void; commit(): Promise<void>; reset(): void }`
  - `function readCollectionIds(prefix: string): string[]` — lectura barata para los componentes de render, sin estado editable.
  - `async function migrateCollections(): Promise<void>`
  - `const DEFAULT_DURATION_MS = 7000`

- [ ] **Step 1: Crear `lib/cms/useCollection.ts`**

```ts
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
  itemKey, newId, planCommit, planMigration, readSettings, writeSettings,
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

/* Migración one-shot de índice posicional a uid. Idempotente: si todas las
   colecciones ya tienen `ids`, no escribe nada. Los datos de producción son
   descartables por decisión de producto → no hay rollback. */
export async function migrateCollections(): Promise<void> {
  if (!state.isAdmin) return
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
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run type-check`
Expected: puede fallar solo por `writeSettings`/`itemKey` importados y no usados. En ese caso, quitarlos del import — no agregar usos artificiales.

- [ ] **Step 3: Encadenar la migración a la hidratación del store**

En `lib/cms/store.ts`, localizar la función que hidrata el estado desde `/api/content` (la que asigna `state.items` con la respuesta del servidor). Al final de esa función, después del `emit()` existente, agregar:

```ts
  // Migración one-shot índice→uid. Se importa dinámicamente para no crear un
  // ciclo store ⇄ useCollection.
  if (state.isAdmin) {
    import('./useCollection')
      .then((m) => m.migrateCollections())
      .catch((err) => console.error('[cms] migración de colecciones falló:', err))
  }
```

- [ ] **Step 4: Verificar tipos y lint**

Run: `npm run type-check && npm run lint`
Expected: sin errores

- [ ] **Step 5: Correr los tests para verificar que nada se rompió**

Run: `npx vitest run`
Expected: PASS — la suite entera en verde

- [ ] **Step 6: Commit**

```bash
git add lib/cms/useCollection.ts lib/cms/store.ts
git commit -m "feat(cms): hook useCollection y aplicador de migracion"
```

---

## Task 5: `CollectionManager` único

**Files:**
- Create: `components/cms/CollectionManager.tsx`
- Create: `components/cms/CollectionRow.tsx`
- Modify: `components/cms/CmsRoot.tsx`
- Delete: `components/cms/CarouselManager.tsx`
- Delete: `components/cms/ProjectsManager.tsx`
- Delete: `components/cms/CharactersManager.tsx`

**Interfaces:**
- Consumes: `useCollection`, `CollectionHandle`, `COLLECTIONS`, `CollectionSpec`, `itemKey`, `mediaKeysOf`, `isEmptyMedia`; de `engine`: `ensureCollectionMeta` (creada en Task 7 — hasta entonces, usar el `ensureSlideMeta` existente y cambiarlo en Task 7).
- Produces:
  - `export default function CollectionManager(props: { spec: CollectionSpec; show?: boolean; onClose: () => void; onPickImage: (key: string) => void; onEditInfo: (key: string) => void }): JSX.Element`
  - `export default function CollectionRow(props: { spec: CollectionSpec; id: string; index: number; total: number; onPick: (key: string) => void; onEditInfo: (key: string) => void; onMove: (dir: -1 | 1) => void; onRemove: () => void }): JSX.Element`

**Nota de comportamiento:** desaparece el flujo de dos pasos. Un solo botón `Save`. Al apretar `Add`, el uid ya existe en el borrador, así que el botón de imagen queda habilitado inmediatamente.

- [ ] **Step 1: Crear `components/cms/CollectionRow.tsx`**

```tsx
'use client'

/* Fila de un item de colección. Rinde la variante simple (solo miniatura) o la
   rica (miniatura + título + editar info + conceptos) según lo que declare la
   spec. Una sola fila para las seis colecciones. */

import { state } from '@/lib/cms/store'
import { isEmptyMedia, itemKey } from '@/lib/cms/collection'
import type { CollectionSpec } from '@/lib/cms/collections'

type Props = {
  spec: CollectionSpec
  id: string
  index: number
  total: number
  onPick: (key: string) => void
  onEditInfo: (key: string) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}

const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.45rem',
  background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)',
  flexWrap: 'wrap',
}

export default function CollectionRow({
  spec, id, index, total, onPick, onEditInfo, onMove, onRemove,
}: Props) {
  const key = itemKey(spec, id)
  const src = state.items[key] || ''
  const empty = isEmptyMedia(src)
  const rich = !!spec.fields
  const titleField = spec.fields?.[0]
  const title = titleField ? state.items[`${key}::${titleField.key}`] || '' : ''

  return (
    <div style={rowStyle}>
      <div
        title={empty ? 'No image' : undefined}
        style={{
          position: 'relative', width: rich ? 64 : 84, height: rich ? 64 : 50,
          borderRadius: rich ? 6 : 4, flexShrink: 0, backgroundSize: 'cover',
          backgroundPosition: 'center', backgroundColor: 'var(--bg-primary)',
          backgroundImage: empty ? undefined : `url("${src}")`,
          border: empty ? '1px dashed #b45309' : '1px solid var(--border)',
        }}
      >
        {empty && (
          <i
            className="fa-solid fa-image"
            style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#b45309', opacity: 0.55, fontSize: '1rem',
            }}
          />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 160, fontSize: '0.85rem', fontWeight: 600 }}>
        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>
          {title || `${spec.itemNoun[0].toUpperCase()}${spec.itemNoun.slice(1)} ${index + 1}`}
        </div>
        {empty && (
          <div style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 400, marginTop: 2 }}>
            no image
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
        <button type="button" className="cms-icon-btn" title="Change image" aria-label="Change image" onClick={() => onPick(key)}>
          <i className="fa-solid fa-image"></i>
        </button>

        {rich && (
          <button type="button" className="cms-icon-btn" title="Edit info" aria-label="Edit info" onClick={() => onEditInfo(key)}>
            <i className="fa-solid fa-pen-to-square"></i>
          </button>
        )}

        {!!spec.concepts && (
          <>
            <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 0.2rem' }} />
            {Array.from({ length: spec.concepts }, (_, m) => {
              const cKey = `${key}::c${m}`
              const cSrc = state.items[cKey] || ''
              const cEmpty = isEmptyMedia(cSrc)
              return (
                <button
                  key={m}
                  type="button"
                  className="cms-icon-btn"
                  style={{
                    width: 34, height: 34, padding: 0, position: 'relative', overflow: 'hidden',
                    border: cEmpty ? '1px dashed var(--border)' : '1px solid var(--accent)',
                  }}
                  title={`Concept image #${m + 1} (${cEmpty ? 'Empty — click to upload' : 'Uploaded — click to change'})`}
                  onClick={() => onPick(cKey)}
                >
                  {cEmpty
                    ? <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary)' }}>C{m + 1}</span>
                    : <div style={{ position: 'absolute', inset: 0, backgroundSize: 'cover', backgroundPosition: 'center', backgroundImage: `url("${cSrc}")` }} />}
                </button>
              )
            })}
          </>
        )}

        <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 0.2rem' }} />

        <button type="button" className="cms-icon-btn" title="Move up" aria-label="Move up" disabled={index === 0} onClick={() => onMove(-1)}>
          <i className="fa-solid fa-chevron-up"></i>
        </button>
        <button type="button" className="cms-icon-btn" title="Move down" aria-label="Move down" disabled={index === total - 1} onClick={() => onMove(1)}>
          <i className="fa-solid fa-chevron-down"></i>
        </button>
        <button type="button" className="cms-icon-btn cms-icon-btn--danger" title="Delete" aria-label="Delete" onClick={onRemove}>
          <i className="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Crear `components/cms/CollectionManager.tsx`**

```tsx
'use client'

/* Gestor único de colecciones. Reemplaza CarouselManager, ProjectsManager y
   CharactersManager: la única diferencia entre ellos era qué campos y cuántos
   conceptos declaraba la colección, y eso ahora vive en la spec.
   Un solo botón de guardado: no hay "guardar estructura" previo porque el uid
   existe apenas se agrega el item. */

import { useState } from 'react'
import { CmsModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { isEmptyMedia, itemKey } from '@/lib/cms/collection'
import type { CollectionSpec } from '@/lib/cms/collections'
import { useCollection } from '@/lib/cms/useCollection'
import { state, useCmsStore } from '@/lib/cms/store'
import CollectionRow from './CollectionRow'

type Props = {
  spec: CollectionSpec
  show?: boolean
  onClose: () => void
  onPickImage: (key: string) => void
  onEditInfo: (key: string) => void
}

export default function CollectionManager({ spec, show = true, onClose, onPickImage, onEditInfo }: Props) {
  const toast = useToast()
  useCmsStore()
  const col = useCollection(spec)
  const [saving, setSaving] = useState(false)
  const [showInfo, setShowInfo] = useState(false)

  const filled = col.ids.filter((id) => !isEmptyMedia(state.items[itemKey(spec, id)])).length
  const hasEmpty = filled < col.ids.length
  const atMax = spec.max !== undefined && col.ids.length >= spec.max

  const status = col.dirty
    ? { color: '#047857', icon: 'fa-circle-check', label: 'Ready to save', title: 'Pending changes ready to be saved' }
    : hasEmpty
      ? { color: '#b45309', icon: 'fa-triangle-exclamation', label: `${filled}/${col.ids.length} with image`, title: 'Some items have no image yet' }
      : { color: '#64748b', icon: 'fa-check', label: 'No changes', title: 'Everything is saved' }

  const onSave = () => {
    setSaving(true)
    col.commit()
      .then(() => { toast('Saved successfully'); setSaving(false) })
      .catch(() => { toast('Error saving changes', 'error'); setSaving(false) })
  }

  const onAdd = () => {
    if (atMax) { toast(`Maximum ${spec.max} ${spec.itemNoun}s`, 'error'); return }
    col.add()
  }

  return (
    <CmsModal
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>{spec.label}</span>
          <span
            style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
            onMouseEnter={() => setShowInfo(true)}
            onMouseLeave={() => setShowInfo(false)}
          >
            <button
              type="button"
              className="cms-icon-btn"
              style={{ border: 'none', background: 'transparent', padding: '0.1rem 0.25rem', color: 'var(--text-secondary)', fontSize: '0.9em' }}
              aria-label="Help"
              aria-expanded={showInfo}
              onFocus={() => setShowInfo(true)}
              onBlur={() => setShowInfo(false)}
            >
              <i className="fa-solid fa-circle-info"></i>
            </button>
            {showInfo && (
              <div
                role="tooltip"
                style={{
                  position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 50, width: 300,
                  padding: '0.6rem 0.8rem', borderRadius: 8, background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)', fontSize: '0.8rem', fontWeight: 400,
                  color: 'var(--text-secondary)', lineHeight: 1.55,
                  boxShadow: '0 6px 20px rgba(0, 0, 0, 0.18)', textTransform: 'none', letterSpacing: 'normal',
                }}
              >
                Add, reorder or remove {spec.itemNoun}s, then press <strong>Save</strong>.
                {spec.max !== undefined && <> Maximum {spec.max}.</>}
                {spec.duration && <> One {spec.itemNoun} means a static image, with no rotation.</>}
              </div>
            )}
          </span>
        </span>
      }
      wide={!!spec.fields}
      show={show}
      onClose={onClose}
      actions={[]}
    >
      <div className="cms-carousel-manager">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <span title={status.title} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', fontWeight: 600, color: status.color }}>
            <i className={`fa-solid ${status.icon}`}></i>{status.label}
          </span>
          <span style={{ flex: 1 }} />
          {spec.duration && (
            <label title="Duration between slides (seconds)" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <i className="fa-solid fa-clock"></i>
              <input
                type="number" min={2} max={30}
                value={Math.round(col.duration / 1000)}
                onChange={(e) => col.setDuration(Math.max(2, parseInt(e.target.value, 10) || 7) * 1000)}
                style={{ width: 54, padding: '0.35rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', textAlign: 'center' }}
              />
            </label>
          )}
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Total: <strong>{col.ids.length}</strong>
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {col.ids.map((id, i) => (
            <CollectionRow
              key={id}
              spec={spec}
              id={id}
              index={i}
              total={col.ids.length}
              onPick={onPickImage}
              onEditInfo={onEditInfo}
              onMove={(dir) => col.move(id, dir)}
              onRemove={() => col.remove(id)}
            />
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '0.25rem' }}>
            <button
              type="button"
              className="cms-btn"
              style={{ padding: '0.45rem 0.8rem', fontSize: '0.8rem', borderStyle: 'dashed' }}
              disabled={atMax}
              title={atMax ? `Maximum ${spec.max} ${spec.itemNoun}s` : `Add new ${spec.itemNoun}`}
              onClick={onAdd}
            >
              <i className="fa-solid fa-plus"></i> Add {spec.itemNoun}
            </button>
          </div>
        </div>

        <div className="cms-modal-actions" style={{ justifyContent: 'flex-end', gap: '0.35rem' }}>
          <button
            type="button"
            className="cms-btn cms-btn--primary"
            style={{ margin: 0 }}
            disabled={saving || !col.dirty}
            title={col.dirty ? undefined : 'No changes recorded'}
            onClick={onSave}
          >
            {saving
              ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Saving…</>
              : <><i className="fa-solid fa-floppy-disk"></i> Save</>}
          </button>
        </div>
      </div>
    </CmsModal>
  )
}
```

- [ ] **Step 3: Cablear en `CmsRoot.tsx`**

Reemplazar los tres imports dinámicos de managers (`components/cms/CmsRoot.tsx:23-25`) por uno solo:

```tsx
const CollectionManager = dynamic(() => import('./CollectionManager'), { ssr: false })
```

Reemplazar los tres bloques de render (`:247-270`) por uno solo:

```tsx
          {managerCmd?.type === 'collectionManager' && COLLECTIONS[managerCmd.key || 'hero'] && (
            <CollectionManager
              show={true}
              spec={COLLECTIONS[managerCmd.key || 'hero']}
              onClose={() => { setManagerCmd(null); close(); }}
              onPickImage={(key) => { engine.ensureSlideMeta(key); dispatch({ type: 'contentPicker', key }) }}
              onEditInfo={(key) => { engine.ensureSlideMeta(key); dispatch({ type: 'editInfo', key }) }}
            />
          )}
```

Agregar el import de `COLLECTIONS` junto a los demás imports del archivo:

```tsx
import { COLLECTIONS } from '@/lib/cms/collections'
```

En las líneas `:59`, `:165`, `:169` y `:175`, renombrar el tipo de comando `'carouselManager'` a `'collectionManager'`, y donde se despachaban `'projectsManager'` / `'charactersManager'` pasar a despachar `'collectionManager'` con `key: 'proj'` y `key: 'char'` respectivamente.

- [ ] **Step 4: Borrar los tres managers viejos**

```bash
git rm components/cms/CarouselManager.tsx components/cms/ProjectsManager.tsx components/cms/CharactersManager.tsx
```

- [ ] **Step 5: Verificar tipos y lint**

Run: `npm run type-check && npm run lint`
Expected: sin errores. Si `type-check` reporta que `ensureProjectMeta` / `ensureCharacterMeta` quedaron sin consumidor, dejarlas — se borran en la Task 7.

- [ ] **Step 6: Verificar que el build pasa**

Run: `npm run build`
Expected: build correcto

- [ ] **Step 7: Commit**

```bash
git add components/cms/CollectionManager.tsx components/cms/CollectionRow.tsx components/cms/CmsRoot.tsx
git commit -m "feat(cms): CollectionManager unico reemplaza los tres managers"
```

---

## Task 6: Consumidores de render leen del store

**Files:**
- Modify: `components/home/Slideshow.tsx`
- Modify: `components/home/HeroMediaCarousel.tsx`
- Modify: `components/home/ProjectsShowcase.tsx`
- Modify: `components/home/CharactersShowcase.tsx`
- Modify: `components/ui/useCarouselSync.ts`
- Modify: `components/cms/CmsRoot.tsx`
- Modify: `components/cms/engine.ts`

**Interfaces:**
- Consumes: `readCollectionIds`, `readCollectionDuration`, `DEFAULT_DURATION_MS` (Task 4); `COLLECTIONS`, `itemKey` (Task 1).
- Produces: nada nuevo. Elimina `engine.broadcastCarousel`.

- [ ] **Step 1: `Slideshow.tsx` — leer del store en vez del CustomEvent**

Reemplazar el bloque de estado y el efecto del listener (`components/home/Slideshow.tsx:28-43`) por:

```tsx
export default function HeroSlideshow() {
  useCmsStore()
  // Solo las slides con imagen real. Vacío → [] → fondo blanco.
  const slides = readCollectionIds('hero')
    .map((id) => state.items[itemKey(COLLECTIONS['hero'], id)] || '')
    .filter((s) => s.trim() !== '')
  const intervalMs = readCollectionDuration('hero')
```

Ajustar los imports del archivo:

```tsx
import { useEffect } from 'react'
import { useCarouselSync } from '@/components/ui/useCarouselSync'
import { ensureGSAP, gsap, prefersReducedMotion } from '@/hooks/useGSAP'
import { state, useCmsStore } from '@/lib/cms/store'
import { COLLECTIONS } from '@/lib/cms/collections'
import { itemKey } from '@/lib/cms/collection'
import { readCollectionDuration, readCollectionIds } from '@/lib/cms/useCollection'
import { optimizedMediaSrc } from '@/lib/utils'
```

Borrar el `type HeroDetail` y la constante `DEFAULT_INTERVAL_MS` (queda sin uso: el default vive en `useCollection`). El resto del componente (el efecto de GSAP y el JSX) no cambia.

- [ ] **Step 2: `HeroMediaCarousel.tsx` — reemplazar `readCarousel`**

Borrar la función local `readCarousel` (`:10-22`) y la constante `DEFAULT_DURATION_MS` (`:8`). Reemplazar el cuerpo inicial del componente (`:61-68`) por:

```tsx
  useCmsStore();

  const spec = COLLECTIONS[prefix];
  const slides = readCollectionIds(prefix).map((id) => state.items[itemKey(spec, id)] || '');
  const duration = readCollectionDuration(prefix);
  const finalPanels = slides;
```

Agregar los imports:

```tsx
import { COLLECTIONS } from '@/lib/cms/collections';
import { itemKey } from '@/lib/cms/collection';
import { readCollectionDuration, readCollectionIds } from '@/lib/cms/useCollection';
```

- [ ] **Step 3: `ProjectsShowcase.tsx` — iterar ids**

Reemplazar el bloque de conteo (`:174-195`) por:

```tsx
  const ids = readCollectionIds('proj')
  const spec = COLLECTIONS['proj']

  const completedIds = ids.filter((id) => {
    const key = itemKey(spec, id)
    return !isEmptyMedia(state.items[key]) && !!(state.items[`${key}::title`] || '').trim()
  })

  // Embla clona los slides con loop:true y los clones son copias estáticas del
  // DOM; al cambiar contenido sin reInit quedan viejos. Firmamos todo el
  // contenido visible para reconstruirlos cuando cambia.
  const projSignature = ids.map((id) => {
    const key = itemKey(spec, id)
    return [
      state.items[key] || '',
      state.items[`${key}::title`] || '',
      state.items[`${key}::start_date`] || '',
      state.items[`${key}::summary`] || '',
    ].join('|')
  }).join('~')

  useCarouselSync(carouselApi, projSignature, [ids.length])
```

Cambiar la firma de `ProjectCard` (`:25-27`) de índice a id:

```tsx
function ProjectCard({ id }: { id: string }) {
  useCmsStore()
  const key = `proj#${id}`
```

Actualizar los sitios de render que hacían `<ProjectCard index={i} />` para pasar `id`, iterando `ids` (o `completedIds`, según lo que use cada bloque) en lugar de `Array.from({ length: displayCount })`.

Agregar los imports:

```tsx
import { COLLECTIONS } from '@/lib/cms/collections'
import { isEmptyMedia, itemKey } from '@/lib/cms/collection'
import { readCollectionIds } from '@/lib/cms/useCollection'
```

- [ ] **Step 4: `CharactersShowcase.tsx` — iterar ids**

Borrar la función `readCount()` (`:33-42`) completa.

Reemplazar el bloque de conteo y firma (`:235-256`) por:

```tsx
  const ids = readCollectionIds('char')
  const spec = COLLECTIONS['char']

  const completedIds = ids.filter((id) => {
    const key = itemKey(spec, id)
    return !isEmptyMedia(state.items[key]) && !!(state.items[`${key}::name`] || '').trim()
  })

  // Firma del contenido visible → reInit de embla cuando cambian alta/baja/orden
  // o las imágenes (los clones/medidas se reconstruyen), igual que en Projects.
  const signature = ids.map((id) => {
    const key = itemKey(spec, id)
    return [
      state.items[key] || '',
      state.items[`${key}::name`] || '',
      ...Array.from({ length: CONCEPTS_PER }, (_, m) => state.items[`${key}::c${m}`] || ''),
    ].join('|')
  }).join('~')

  useCarouselSync(api, signature, [ids.length])
```

Cambiar la firma del panel (`:78-92`). El panel necesita el `id` para las claves y el `index` para la numeración visible (`num`) y los textos de ejemplo, así que recibe ambos:

```tsx
function CharacterPanel({ id, index, total }: { id: string; index: number; total: number }) {
  const ui = useUiText()
  const [isHovered, setIsHovered] = useState(false)
  const [activeSlide, setActiveSlide] = useState(0) // 0 = retrato principal, 1..4 = concepts c0..c3

  const key = `char#${id}`
```

El resto del cuerpo del panel (`sampleNames`, `sampleRoles`, `name`, `role`, `desc`, `num`, `tot`, `galleryKeys`) no cambia: ya deriva todo de `key` y de `index`.

Actualizar el sitio de render que iteraba por índice para que itere `completedIds` pasando ambos props:

```tsx
{completedIds.map((id, i) => (
  <CharacterPanel key={id} id={id} index={i} total={completedIds.length} />
))}
```

Agregar los imports:

```tsx
import { COLLECTIONS } from '@/lib/cms/collections'
import { isEmptyMedia, itemKey } from '@/lib/cms/collection'
import { readCollectionIds } from '@/lib/cms/useCollection'
```

Verificar que `readCount` y `totalSlots` no quedaron referenciados en ningún otro punto del archivo antes de continuar.

- [ ] **Step 5: `useCarouselSync.ts` — quitar el rescan diferido**

Reemplazar el cuerpo del efecto por:

```ts
  useEffect(() => {
    if (!api) return
    // Re-initialize Embla to rebuild cloned slides.
    api.reInit()
    /* El spread es la API del hook: cada carrusel aporta sus propias
       dependencias extra. El linter no puede verificar un array variádico. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, signature, ...extraDeps])
```

Borrar el import de `rescan` y el de `state` si quedan sin uso.

- [ ] **Step 6: `CmsRoot.tsx` — borrar el broadcast inline**

Borrar el bloque `const broadcastCarousel = …` y las cuatro llamadas (`components/cms/CmsRoot.tsx:128-141`). El contenido ahora lo pinta React por suscripción al store.

- [ ] **Step 7: `engine.ts` — borrar `broadcastCarousel` y su uso en `applyMedia`**

Borrar la función `broadcastCarousel` (`:454-463`). En `applyMedia` (`:465-468`), reemplazar la rama de slides por:

```ts
export function applyMedia(key: string, value: string) {
  // Items de colección: los pinta React desde el store, no el motor.
  if (collectionOf(key)) { emit(); return }
```

Agregar el import de `collectionOf` desde `@/lib/cms/collections` y de `emit` desde el store si no está. Borrar las llamadas a `broadcastCarousel` que quedaron en `clearKeys` (`:1146`).

- [ ] **Step 8: Verificar tipos, lint y build**

Run: `npm run type-check && npm run lint && npm run build`
Expected: sin errores

- [ ] **Step 9: Commit**

```bash
git add components/home/Slideshow.tsx components/home/HeroMediaCarousel.tsx components/home/ProjectsShowcase.tsx components/home/CharactersShowcase.tsx components/ui/useCarouselSync.ts components/cms/CmsRoot.tsx components/cms/engine.ts
git commit -m "refactor(cms): el store es la unica fuente de los carruseles"
```

---

## Task 7: Barrido de índices numéricos en engine y store

**Files:**
- Modify: `components/cms/engine.ts`
- Modify: `lib/cms/store.ts`
- Modify: `components/cms/TextModals.tsx`

**Interfaces:**
- Consumes: `COLLECTIONS`, `collectionOf`, `allKeysOf`, `mediaKeysOf`, `readSettings` (Tasks 1-3).
- Produces: `function ensureCollectionMeta(key: string): void` en `engine.ts`, que reemplaza a `ensureSlideMeta`, `ensureProjectMeta` y `ensureCharacterMeta`.

- [ ] **Step 1: `engine.ts` — una sola `ensureCollectionMeta`**

Borrar `ensureSlideMeta`, `ensureProjectMeta` y `ensureCharacterMeta`. Agregar en su lugar:

```ts
/* Los items de colección no tienen elemento DOM propio indexado por el REGISTRY
   (React los pinta y el picker escribe la clave directo). Se crea una meta
   sintética para que los pickers, que hacen `if (!meta) return null`, puedan
   asignarles contenido. */
export function ensureCollectionMeta(key: string) {
  if (metaByKey[key]) return
  const spec = collectionOf(key)
  if (!spec) return
  const conceptMatch = key.match(/::c(\d+)$/)
  metaByKey[key] = {
    label: state.containerNames[key]
      || (conceptMatch ? `Concept image #${Number(conceptMatch[1]) + 1}` : spec.label),
    section: spec.section,
    kind: 'image',
    accept: spec.accept,
    mount: 'none',
  }
  typeByKey[key] = 'media'
}
```

Actualizar las llamadas en `CmsRoot.tsx` (`onPickImage` / `onEditInfo` de la Task 5) para usar `engine.ensureCollectionMeta`.

- [ ] **Step 2: `engine.ts` — desactivar el fallback posicional en las bases de colección**

Agregar el campo opcional al tipo `RegistryEntry`:

```ts
  /* `attr`: la clave la emite React vía data-cms-key. Sin ese atributo el
     elemento se saltea, en vez de recibir una clave posicional que con uids
     sería fantasma. */
  identity?: 'positional' | 'attr'
```

Marcar `identity: 'attr'` en las entradas `{ base: 'char', … }` y `{ base: 'proj', … }`. Borrar por completo las entradas `hero-main.slide`, `hero-sub.slide` y `about-carousel.slide` (eran `mount: 'none'`; sus labels viven ahora en las specs).

En `indexEditables()`, reemplazar el bloque de asignación de clave por:

```ts
      let key = el.getAttribute('data-cms-key')
      if (!key) {
        if (entry.identity === 'attr') return
        key = entry.base + '#' + i
        el.setAttribute('data-cms-key', key)
      }
```

- [ ] **Step 3: `engine.ts` — `deleteProjectSite` sobre la nueva API**

Reemplazar la función entera (`:1033` hasta su cierre) por:

```ts
/* Quita la tarjeta del sitio (no solo su contenido): archiva el media a
   "no usados" y saca el id del orden. Ya no hay reindexado: los otros items
   conservan su uid. */
export async function deleteProjectSite(key: string) {
  if (!state.isAdmin) return
  const spec = collectionOf(key)
  if (!spec) return
  const id = key.slice(spec.prefix.length + 1)
  const { ids, duration } = readSettings(state.items, spec.prefix)
  if (!ids.includes(id)) return

  const plan = planCommit(spec, ids, ids.filter((x) => x !== id), state.items, duration)
  for (const k of plan.archiveKeys) archiveMediaKey(k, 'deleted')
  for (const k of plan.deleteKeys) { delete state.items[k]; delete state.usedContent[k] }
  for (const [k, v] of Object.entries(plan.payload)) {
    if (v === '') delete state.items[k]
    else state.items[k] = v
  }
  persistOverridesLocal()
  persistUnused(); persistUsed(); persistRetired()
  await saveContent(plan.payload)
  emit()
}
```

- [ ] **Step 4: `engine.ts` — `clearKeys` usa las specs**

En `clearKeys` (`:1100`), reemplazar la detección `key.match(/^(.+)\.slide#\d+$/)` y el bloque de reset de carruseles (`:1109-1147`) por:

```ts
    const spec = collectionOf(key)
    if (spec) {
      archiveMediaKey(key)
      delete state.items[key]
      cleared[key] = ''
      collectionPrefixes.add(spec.prefix)
      continue
    }
```

y, más abajo, el reset de cada colección:

```ts
  collectionPrefixes.forEach((prefix) => {
    const spec = COLLECTIONS[prefix]
    const { ids, duration } = readSettings(state.items, prefix)
    for (const id of ids) {
      for (const k of allKeysOf(spec, id)) { delete state.items[k]; cleared[k] = '' }
    }
    state.items[`${prefix}.settings`] = writeSettings(spec.duration ? { ids: [], duration } : { ids: [] })
    cleared[`${prefix}.settings`] = state.items[`${prefix}.settings`]
  })
```

Renombrar la variable local `carouselPrefixes` a `collectionPrefixes` y el parámetro `forceCarousels` a `forceCollections`. Actualizar la llamada de `clearAllSite` (`:1181`) a:

```ts
  clearKeys(allMediaKeys(), Object.keys(COLLECTIONS))
```

- [ ] **Step 5: `engine.ts` — `keyInSection` sobre uids**

Reemplazar el bloque de slides de `keyInSection` (`:1200-1210`) por:

```ts
  const spec = collectionOf(key)
  if (spec) {
    // El fondo (prefix 'hero') vive fuera de <section> → pertenece a la portada.
    if (spec.prefix === 'hero') return sectionEl.classList.contains('hero')
    const host = document.querySelector<HTMLElement>(`.${spec.prefix}-carousel-slide`)
      || document.querySelector<HTMLElement>(`[data-cms-key^="${spec.prefix}#"]`)
    return !!host && sectionEl.contains(host)
  }
```

- [ ] **Step 6: `store.ts` — borrar `compactList` y la normalización legacy**

Borrar la función `compactList` (`:634` hasta su cierre en `:699`) y sus dos llamadas en `clearItemOverrides` (`:723-724`), junto con los `Set<number>` `charDeleted` / `projDeleted` y los dos `match` de índice (`:704-711`).

Borrar el bloque de normalización de `proj.settings` de 6 a 4 (`:833-843`) completo, incluido su `try/catch`.

- [ ] **Step 7: `store.ts` — `getAllKnownContainerKeys` deriva de los ids**

Reemplazar las seis líneas de colecciones dinámicas (`:502-505`, `:509`, `:514`) por:

```ts
    ...Object.values(COLLECTIONS).flatMap((spec) =>
      readSettings(state.items, spec.prefix).ids.flatMap((id) => allKeysOf(spec, id))),
```

Borrar la línea de `anim#` (`:512`): la colección es vestigial y no tiene consumidor.

En la regex de la línea `:529`, quitar las alternativas `hero\.slide`, `hero-main\.slide`, `hero-sub\.slide`, `about-carousel\.slide`, `char` y `proj`, y cambiar el sufijo `(?:#\d+)?` a `(?:#[a-z0-9]+)?` para las que quedan.

En `CONTAINER_BASES` (`:421-449`), borrar las entradas `'hero-main.slide'`, `'hero-sub.slide'`, `'hero.slide'` y `'about-carousel.slide'`; dejar `'char'` y `'proj'` (las usa `getContainerMeta` como fallback de label).

- [ ] **Step 8: `TextModals.tsx` — regex de uid**

En `components/cms/TextModals.tsx:230`, reemplazar:

```tsx
  const isProject = /^proj#\d+$/.test(cmsKey)
```

por:

```tsx
  const isProject = collectionOf(cmsKey)?.prefix === 'proj'
```

Agregar el import `import { collectionOf } from '@/lib/cms/collections'`.

- [ ] **Step 9: Barrido final de regex de índice**

Run: `npx rg "#\\\\d\+|#\$\{i\}|proj#\d|char#\d|slide#" --glob '!node_modules' --glob '!docs' components lib app`
Expected: los únicos resultados deben ser los slots de tamaño fijo (`illustration`, `model3d`, `model3d.gallery`, `soft.*`, `hero.wave`, `hero.marquee`), que conservan la clave posicional a propósito. Cualquier resultado sobre `proj`, `char`, `hero`, `hero-main`, `hero-sub` o `about-carousel` es un caso pendiente: corregirlo antes de commitear.

- [ ] **Step 10: Verificar tipos, lint, tests y build**

Run: `npm run type-check && npm run lint && npx vitest run && npm run build`
Expected: sin errores, suite en verde

- [ ] **Step 11: Commit**

```bash
git add components/cms/engine.ts lib/cms/store.ts components/cms/TextModals.tsx
git commit -m "refactor(cms): eliminar reindexado posicional de engine y store"
```

---

## Task 8: Superficie común para los slots de tamaño fijo

**Files:**
- Modify: `lib/cms/collections.ts`
- Modify: `lib/cms/store.ts`
- Modify: `components/home/ProjectsShowcase.tsx`
- Modify: `components/home/CharactersShowcase.tsx`
- Modify: `components/cms/engine.ts`
- Modify: `tests/cms/collection.test.ts`

**Interfaces:**
- Consumes: `isEmptyMedia` (Task 1).
- Produces:
  - `type FixedSlotSpec = { base: string; length: number }`
  - `const FIXED_SLOTS: FixedSlotSpec[]`
  - `function fixedSlotKeys(): string[]`

**Por qué los slots fijos NO llevan uid:** su identidad *es* la posición en el markup
estático — `illustration#7` es la celda 7 del bento, no un item movible. Un uid
exigiría una tabla de mapeo posición↔uid que puede desincronizarse, reintroduciendo
la misma clase de bug desde el otro lado. Lo que se unifica acá es la superficie:
un solo predicado de vacío y una sola declaración de qué slots existen, en lugar de
diez `Array.from` hardcodeados repartidos por `store.ts`.

- [ ] **Step 1: Escribir el test que falla**

Agregar al final de `tests/cms/collection.test.ts`:

```ts
import { FIXED_SLOTS, fixedSlotKeys } from '@/lib/cms/collections'

describe('FIXED_SLOTS', () => {
  it('declara los slots de tamaño fijo con su longitud', () => {
    const byBase = Object.fromEntries(FIXED_SLOTS.map((s) => [s.base, s.length]))
    expect(byBase['illustration']).toBe(15)
    expect(byBase['model3d']).toBe(6)
    expect(byBase['model3d.gallery']).toBe(12)
    expect(byBase['hero.marquee']).toBe(11)
  })

  it('no declara ninguna colección dinámica', () => {
    const bases = FIXED_SLOTS.map((s) => s.base)
    for (const prefix of Object.keys(COLLECTIONS)) {
      expect(bases).not.toContain(prefix)
    }
  })

  it('fixedSlotKeys expande cada base a sus claves posicionales', () => {
    const keys = fixedSlotKeys()
    expect(keys).toContain('illustration#0')
    expect(keys).toContain('illustration#14')
    expect(keys).not.toContain('illustration#15')
    expect(keys).not.toContain('proj#0')
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run tests/cms/collection.test.ts`
Expected: FAIL — `FIXED_SLOTS` no exportada desde `@/lib/cms/collections`

- [ ] **Step 3: Declarar los slots fijos en `lib/cms/collections.ts`**

Agregar al final del archivo:

```ts
/* Contenedores de tamaño fijo. A diferencia de las colecciones, su identidad ES
   la posición en el markup estático: `illustration#7` es la celda 7 del bento.
   No se reordenan ni se agregan desde el CMS, así que conservan la clave
   posicional. Se declaran acá para que exista una sola lista. */
export type FixedSlotSpec = { base: string; length: number }

export const FIXED_SLOTS: FixedSlotSpec[] = [
  { base: 'hero.wave', length: 11 },
  { base: 'hero.marquee', length: 11 },
  { base: 'soft.global', length: 6 },
  { base: 'char.soft', length: 3 },
  { base: 'illustration', length: 15 },
  { base: 'anim.soft', length: 4 },
  { base: 'proj.soft', length: 6 },
  { base: 'model3d', length: 6 },
  { base: 'model3d.gallery', length: 12 },
  { base: 'model3d.soft', length: 4 },
]

export function fixedSlotKeys(): string[] {
  return FIXED_SLOTS.flatMap(({ base, length }) =>
    Array.from({ length }, (_, i) => `${base}#${i}`))
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run tests/cms/collection.test.ts`
Expected: PASS — los 3 tests nuevos en verde, más los anteriores

- [ ] **Step 5: `store.ts` — `getAllKnownContainerKeys` usa la lista única**

Reemplazar las diez líneas de `Array.from` de slots fijos que quedaron en el array
`standard` (las de `hero.wave`, `hero.marquee`, `soft.global`, `char.soft`,
`illustration`, `anim.soft`, `proj.soft`, `model3d`, `model3d.gallery`,
`model3d.soft`) por una sola:

```ts
    ...fixedSlotKeys(),
```

Agregar el import `import { COLLECTIONS, fixedSlotKeys } from './collections'` si
no está ya presente de la Task 7.

- [ ] **Step 6: `isEmptyMedia` como único predicado de vacío**

Barrer las comprobaciones sueltas de vacío y reemplazarlas por `isEmptyMedia`.

Run: `npx rg "includes\('placeholder'\)|includes\(\"placeholder\"\)" --glob '!node_modules' components lib app`

Para cada resultado, reemplazar la expresión completa. Los patrones exactos que
aparecen hoy son:

```tsx
// antes
const hasImage = !!src && !src.includes('placeholder')
// después
const hasImage = !isEmptyMedia(src)
```

```tsx
// antes
const has = !!src && !src.includes('placeholder')
// después
const has = !isEmptyMedia(src)
```

En `ProjectsShowcase.ProjectCard` la expresión aparece en el cálculo de
`conceptsKey`; ahí queda:

```tsx
    ...Array.from({ length: CONCEPTS_PER }, (_, m) => m + 1).filter((idx) =>
      !isEmptyMedia(state.items[`${key}::c${idx - 1}`])),
```

Agregar `import { isEmptyMedia } from '@/lib/cms/collection'` en cada archivo
tocado que no lo tenga.

- [ ] **Step 7: Verificar tipos, lint, tests y build**

Run: `npm run type-check && npm run lint && npx vitest run && npm run build`
Expected: sin errores, suite en verde

- [ ] **Step 8: Commit**

```bash
git add lib/cms/collections.ts lib/cms/store.ts components/home/ProjectsShowcase.tsx components/home/CharactersShowcase.tsx components/cms/engine.ts tests/cms/collection.test.ts
git commit -m "refactor(cms): lista unica de slots fijos y predicado unico de vacio"
```

---

## Task 9: Verificación end-to-end en el navegador

**Files:**
- Create: `.claude/launch.json` (si no existe)
- Modify: los que resulten de los defectos encontrados

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: nada. Es el gate de aceptación.

- [ ] **Step 1: Asegurar la config de arranque**

Si `.claude/launch.json` no existe, crearlo:

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "artist-portfolio",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 3000
    }
  ]
}
```

- [ ] **Step 2: Levantar el preview y entrar como admin**

Arrancar el servidor con la herramienta de preview (nunca con Bash) usando `{name: "artist-portfolio"}`. Iniciar sesión con las credenciales de `.env` (`ADMIN_USER` / `ADMIN_PASS` / TOTP de `ADMIN_2FA_SECRET`).

Verificar en la consola del navegador que no haya errores y que la migración corrió: `proj.settings` debe contener `ids`, no `count`.

- [ ] **Step 3: Criterio 1 — reordenar no archiva**

Abrir el gestor de proyectos, mover el proyecto 1 hacia abajo, apretar Save.
Expected: la petición a `/api/content` contiene **una sola clave**, `proj.settings`. Ninguna imagen aparece en "sin usar". Verificar el payload con la herramienta de lectura de peticiones de red.

- [ ] **Step 4: Criterio 2 — borrar solo toca lo borrado**

Con tres proyectos cargados, borrar el del medio y guardar.
Expected: en el payload solo aparecen `proj.settings` y las claves del borrado (`proj#<uid>`, sus `::c*` y sus campos). Los otros dos conservan uid, título y conceptos en pantalla.

- [ ] **Step 5: Criterio 3 — alta en un solo paso**

Abrir el gestor del carrusel principal, `Add slide`, subir una imagen al slot nuevo, `Save`.
Expected: un solo click de guardado, sin recarga de página, la portada repinta sola con la imagen nueva.

- [ ] **Step 6: Criterio 4 — limpiar todo**

Ejecutar "Clear all content" desde el panel de ajustes.
Expected: las seis colecciones quedan con `ids: []`. Los contenedores vacíos muestran el borde punteado violeta con el icono de nube y el nombre. Recargar la página: no reaparece ninguna slide.

- [ ] **Step 7: Criterio 5 — supervivencia a la navegación**

Volver a cargar contenido en el carrusel de fondo. Navegar a `/about` y volver al home.
Expected: el fondo sigue pintando las slides (antes dependía de que el `CustomEvent` llegara después del montaje).

- [ ] **Step 8: Criterio 6 — clones de Embla**

Con el carrusel de proyectos en loop, desde el sitio (no desde el gestor) abrir la edición de la tarjeta 2 y cambiar su imagen.
Expected: cambia la tarjeta 2, no un clon ni una vecina.

- [ ] **Step 9: Criterio 7 — idioma**

Exportar traducciones, verificar que el `.txt` **no** contiene ninguna clave `*.settings`. Cambiar el idioma a `es` con las colecciones montadas y volver a `en`.
Expected: el contenido del CMS se traduce y al volver al idioma base recupera el texto original.

- [ ] **Step 10: Criterio 8 — responsive**

Con la herramienta de redimensionado, revisar el gestor y los seis carruseles a 320, 375, 768, 1024 y 1440 px.
Expected: sin scroll horizontal del body, sin desbordes, los controles de fila siguen alcanzables a 320 px.

- [ ] **Step 11: Gate automático final**

Run: `npm run type-check && npm run lint && npx vitest run && npm run build`
Expected: sin errores, suite en verde

- [ ] **Step 12: Commit de los arreglos que surjan**

**No usar `git add -A` ni `git add .`**: el árbol de trabajo tiene cambios previos
sin commitear ajenos a esta tarea. Listar los archivos modificados durante la
verificación y agregarlos uno por uno:

```bash
git status --short
```

```bash
git add <solo los archivos que tocó esta verificación>
git commit -m "fix(cms): correcciones de la verificacion end-to-end de colecciones"
```

Si no surgió ningún defecto, saltear este paso — no crear un commit vacío.

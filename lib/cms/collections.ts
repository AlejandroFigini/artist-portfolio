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

/* Contenedores de tamaño fijo. A diferencia de las colecciones, su identidad ES
   la posición en el markup estático: `illustration#7` es la celda 7 del bento.
   No se reordenan ni se agregan desde el CMS, así que conservan la clave
   posicional. Se declaran acá para que exista una sola lista. */
export type FixedSlotSpec = { base: string; length: number }

export const FIXED_SLOTS: FixedSlotSpec[] = [
  { base: 'anim', length: 6 },
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

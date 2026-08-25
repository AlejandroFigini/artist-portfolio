/* Ajustes globales del sitio — fuente única de las claves cms_data (prefijo
   settings.*, excluidas de traducción vía isTranslatableEntry). Compartido por
   el endpoint /api/site, el SiteSettingsProvider y el panel de Ajustes. */

export const SETTINGS_KEYS = {
  loaderVideo: 'settings.loaderVideo',
  loaderImage: 'settings.loaderImage',
  loaderDuration: 'settings.loaderDuration',
  cvUrl: 'settings.cvUrl',
  cvName: 'settings.cvName',
  faviconUrl: 'settings.faviconUrl',
  appleIconUrl: 'settings.appleIconUrl',
  // Las claves de las animaciones NO van acá: salen de ANIM_SLOTS (abajo) vía
  // `animKey()`, que es lo que recorren /api/site, el provider y las tarjetas.
} as const

/* ── Animaciones decorativas ────────────────────────────────────────────────
   Cada apartado tiene una animación PRINCIPAL más hasta 4 de ROTACIÓN. Con
   solo la principal cargada no rota nada; con N cargadas el contenedor va
   pasando de una a la otra.
   Cuándo cambia (`rotateOn`):
   - 'toggle'   → cada vez que el panel que la aloja se cierra. El cambio ocurre
     con el panel cerrado y la siguiente queda precargada, así al abrir ya está
     lista: nunca se ve el salto.
   - 'load'     → una por montaje (el modal de contacto se desmonta al cerrarse).
   - 'interval' → por reloj, cada `everyField` segundos, mientras está a la
     vista. La cuenta arranca en un clip distinto en cada carga de página.
   Esta tabla es la fuente única: de acá salen las claves de cms_data, las
   entradas del REGISTRY del engine, las tarjetas de Gestión y el índice de
   "Contenido en uso". Agregar un apartado = una fila. */

export const ANIM_ROTATION_MAX = 4

export const ANIM_SLOTS = [
  { id: 'nav', base: 'navAnimUrl', cardId: 'ajustes-nav-anim', previewClass: 'nav-anim-preview', icon: 'fa-wand-magic-sparkles', label: 'Menu Animation', sub: 'Mobile menu decorative animation', rotateOn: 'toggle' },
  { id: 'panel', base: 'panelAnimUrl', cardId: 'ajustes-panel-anim', previewClass: 'panel-anim-preview', icon: 'fa-sliders', label: 'Options Menu Animation', sub: 'Settings panel decorative animation', rotateOn: 'toggle' },
  { id: 'footer', base: 'footerAnimUrl', cardId: 'ajustes-footer-anim', previewClass: 'footer-anim-preview', icon: 'fa-film', label: 'Footer Animation', sub: 'Footer decorative animation', rotateOn: 'interval', everyField: 'footerAnimEvery' },
  { id: 'contact', base: 'contactAnimUrl', cardId: 'ajustes-contact-anim', previewClass: 'contact-anim-preview', icon: 'fa-paper-plane', label: 'Contact Form Animation', sub: 'Contact form decorative animation', rotateOn: 'load' },
  /* Un solo ajuste para TODOS los desplegables de software (Animations,
     Character Design, 3D): comparten la lista y cada panel rota por su cuenta
     al cerrarse. */
  { id: 'software', base: 'softwareAnimUrl', cardId: 'ajustes-software-anim', previewClass: 'software-anim-preview', icon: 'fa-layer-group', label: 'Software Panel Animation', sub: 'Software dropdown decorative animation (all sections)', rotateOn: 'toggle' },
] as const

export type AnimSlot = (typeof ANIM_SLOTS)[number]
type AnimBase = AnimSlot['base']
/** Clave del intervalo de rotación de los apartados que rotan por reloj. */
export type AnimEveryField = Extract<AnimSlot, { everyField: string }>['everyField']

export const ANIM_EVERY_FIELDS: AnimEveryField[] = ANIM_SLOTS
  .map((s) => ('everyField' in s ? s.everyField : null))
  .filter((f): f is AnimEveryField => f !== null)

/* Intervalo de rotación en ms, con clamp defensivo (3s–5min). El default es
   generoso a propósito: el decorado no tiene que competir con el contenido. */
export const ANIM_EVERY_DEFAULT = 12
export function animIntervalMs(raw: string): number {
  const secs = parseFloat(raw)
  if (!Number.isFinite(secs) || secs <= 0) return ANIM_EVERY_DEFAULT * 1000
  return Math.min(Math.max(secs, 3), 300) * 1000
}
/** `navAnimUrl` (principal) · `navAnimUrl2..5` (rotación). */
export type AnimField = AnimBase | `${AnimBase}${2 | 3 | 4 | 5}`

/** Campos de un apartado, en orden de rotación: [principal, 2, 3, 4, 5]. */
export const animFields = (base: AnimBase): AnimField[] =>
  [base, ...Array.from({ length: ANIM_ROTATION_MAX }, (_, i) => `${base}${i + 2}` as AnimField)]

export const ANIM_FIELDS: AnimField[] = ANIM_SLOTS.flatMap((s) => animFields(s.base))

export const animKey = (field: AnimField | AnimEveryField): string => `settings.${field}`

/** Clase del <video> de vista previa en Gestión: la principal conserva la clase
 *  histórica y las de rotación llevan sufijo. */
export const animPreviewClass = (slot: AnimSlot, i: number): string =>
  i === 0 ? slot.previewClass : `${slot.previewClass}-${i + 1}`

export const animLabel = (slot: AnimSlot, i: number): string =>
  i === 0 ? slot.label : `${slot.label} — Rotation ${i + 1}`

type BaseSettings = {
  loaderVideo?: string
  loaderImage: string
  loaderDuration: string // segundos, como string (valor crudo de cms_data)
  cvUrl: string
  cvName: string
  faviconUrl: string
  appleIconUrl: string
}

export type SiteSettings = BaseSettings & Record<AnimField, string> & Record<AnimEveryField, string>

export const EMPTY_SETTINGS: SiteSettings = {
  loaderVideo: '', loaderImage: '', loaderDuration: '', cvUrl: '', cvName: '', faviconUrl: '', appleIconUrl: '',
  ...(Object.fromEntries(ANIM_FIELDS.map((f) => [f, ''])) as Record<AnimField, string>),
  ...(Object.fromEntries(ANIM_EVERY_FIELDS.map((f) => [f, ''])) as Record<AnimEveryField, string>),
}

/** Fuentes de un apartado, sin huecos: principal primero, después las cargadas. */
export const animSources = (settings: SiteSettings, base: AnimBase): string[] =>
  animFields(base).map((f) => settings[f]).filter(Boolean)

/* Media que además es AJUSTE. Se comporta distinto que un contenedor común:
   1) asignarle contenido NO lo persiste — el valor queda en `state.items` como
      vista previa y viaja a la DB recién con el botón Guardar de su tarjeta;
   2) su marco vacío y sus herramientas solo se pintan DENTRO de esa tarjeta (el
      mismo data-cms-key existe también en el sitio, p.ej. el <video> del loader,
      y ahí no corresponde ninguna de las dos cosas).
   El valor de cada entrada es el id de la tarjeta que la contiene.
   `settings.appleIconUrl` faltaba en los siete puntos que consultaban esto a
   mano: se persistía sola al subir, salteándose su propio botón Guardar. */
export const SETTINGS_MEDIA_CARDS: Record<string, string> = {
  'loader.gallop': '#ajustes-loader',
  [SETTINGS_KEYS.faviconUrl]: '#ajustes-favicon',
  [SETTINGS_KEYS.appleIconUrl]: '#ajustes-apple-icon',
  ...Object.fromEntries(
    ANIM_SLOTS.flatMap((slot) => animFields(slot.base).map((f) => [animKey(f), `#${slot.cardId}`])),
  ),
}

/** Media de ajustes: guardado diferido al botón de su tarjeta, no al asignar. */
export const isSettingsMediaKey = (key: string): boolean => key in SETTINGS_MEDIA_CARDS

/* Piso estético del loader, en segundos. Rango único: lo usan el clamp de
   lectura, el clamp de guardado y los límites del input de Gestión. Sin esta
   fuente común el panel aceptaba "999", lo persistía crudo y el sitio aplicaba
   15s: el admin veía un número que el sitio no respetaba. */
export const LOADER_DURATION_MIN = 0.5
export const LOADER_DURATION_MAX = 15
export const LOADER_DURATION_DEFAULT = 1.2

export const clampLoaderDuration = (secs: number): number =>
  Math.min(Math.max(secs, LOADER_DURATION_MIN), LOADER_DURATION_MAX)

/* Piso estético del loader en ms. Es tiempo en el que la portada ya está
   pintada pero tapada, contado desde que el loader se pintó (el sello lo deja
   el boot script de app/layout.tsx). El admin lo sube desde Gestión. */
export function loaderDurationMs(raw: string): number {
  const secs = parseFloat(raw)
  if (!Number.isFinite(secs) || secs <= 0) return LOADER_DURATION_DEFAULT * 1000
  return clampLoaderDuration(secs) * 1000
}

/* Ajuste que NO es media (duración del loader, nombre del CV…). El índice de
   contenidos trata cualquier clave desconocida como imagen, así que sin este
   filtro el valor crudo ("3") se sembraba como archivo y cada cambio de valor
   mandaba el anterior a "sin usar". */
export const isNonMediaSettingsKey = (key: string): boolean =>
  key.startsWith('settings.') && !isSettingsMediaKey(key)

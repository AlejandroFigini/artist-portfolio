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
  navAnimUrl: 'settings.navAnimUrl',
} as const

export type SiteSettings = {
  loaderVideo?: string
  loaderImage: string
  loaderDuration: string // segundos, como string (valor crudo de cms_data)
  cvUrl: string
  cvName: string
  faviconUrl: string
  appleIconUrl: string
  navAnimUrl: string
}

export const EMPTY_SETTINGS: SiteSettings = { loaderVideo: '', loaderImage: '', loaderDuration: '', cvUrl: '', cvName: '', faviconUrl: '', appleIconUrl: '', navAnimUrl: '' }

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
  [SETTINGS_KEYS.navAnimUrl]: '#ajustes-nav-anim',
}

/** Media de ajustes: guardado diferido al botón de su tarjeta, no al asignar. */
export const isSettingsMediaKey = (key: string): boolean => key in SETTINGS_MEDIA_CARDS

/* Piso estético del loader en ms, con clamp defensivo (0.5s–15s).
   El piso es tiempo en el que la portada ya está pintada pero tapada: entra
   entero en el LCP. 1.2s alcanza para que la animación se lea sin volverse el
   techo de la métrica. El admin lo sigue subiendo desde Gestión. */
export function loaderDurationMs(raw: string): number {
  const secs = parseFloat(raw)
  if (!Number.isFinite(secs) || secs <= 0) return 1200
  return Math.min(Math.max(secs, 0.5), 15) * 1000
}

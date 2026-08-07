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
} as const

export type SiteSettings = {
  loaderVideo?: string
  loaderImage: string
  loaderDuration: string // segundos, como string (valor crudo de cms_data)
  cvUrl: string
  cvName: string
  faviconUrl: string
  appleIconUrl: string
}

export const EMPTY_SETTINGS: SiteSettings = { loaderVideo: '', loaderImage: '', loaderDuration: '', cvUrl: '', cvName: '', faviconUrl: '', appleIconUrl: '' }

/* Piso estético del loader en ms, con clamp defensivo (0.5s–15s).
   El piso es tiempo en el que la portada ya está pintada pero tapada: entra
   entero en el LCP. 1.2s alcanza para que la animación se lea sin volverse el
   techo de la métrica. El admin lo sigue subiendo desde Gestión. */
export function loaderDurationMs(raw: string): number {
  const secs = parseFloat(raw)
  if (!Number.isFinite(secs) || secs <= 0) return 1200
  return Math.min(Math.max(secs, 0.5), 15) * 1000
}

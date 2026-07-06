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
} as const

export type SiteSettings = {
  loaderVideo?: string
  loaderImage: string
  loaderDuration: string // segundos, como string (valor crudo de cms_data)
  cvUrl: string
  cvName: string
  faviconUrl: string
}

export const EMPTY_SETTINGS: SiteSettings = { loaderVideo: '', loaderImage: '', loaderDuration: '', cvUrl: '', cvName: '', faviconUrl: '' }

/** Duración del loader en ms, con default 3s y clamp defensivo (1s–15s). */
export function loaderDurationMs(raw: string): number {
  const secs = parseFloat(raw)
  if (!Number.isFinite(secs) || secs <= 0) return 3000
  return Math.min(Math.max(secs, 1), 15) * 1000
}

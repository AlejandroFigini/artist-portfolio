/* Constantes y helpers de internacionalización compartidos cliente/servidor.
   Modelo: el contenido base (es) vive en cms_data (lo edita el admin); las
   traducciones (en/pt/fr) viven en cms_translations. Flujo admin-driven:
   exportar base → traducir con Claude → importar JSON → guardar en BD. */

export const BASE_LANG = 'es' as const
export const TARGET_LANGS = ['en', 'pt', 'fr'] as const
export const ALL_LANGS = [BASE_LANG, ...TARGET_LANGS] as const

export type Lang = (typeof ALL_LANGS)[number]

export const LANG_META: Record<Lang, { flag: string; label: string }> = {
  es: { flag: 'es', label: 'Español' },
  en: { flag: 'us', label: 'English' },
  pt: { flag: 'pt', label: 'Português' },
  fr: { flag: 'fr', label: 'Français' },
}

/** Un valor es media (no traducible) si es una URL, ruta absoluta o data URL. */
export function isMediaValue(v: string): boolean {
  return /^(https?:\/\/|\/|data:)/.test(v.trim())
}

/** Una entrada de cms_data es texto traducible si su valor es prosa
    (no media/URL) y no es configuración JSON (claves *.settings del carrusel). */
export function isTranslatableEntry(key: string, value: string): boolean {
  if (!value || !value.trim()) return false
  if (key.endsWith('.settings')) return false
  return !isMediaValue(value)
}

'use client'

/* Export/import de traducciones — única implementación, compartida por el
   panel de Gestión (SiteSettings → TranslationSettings) y por la tuerca de
   admin del sitio (SettingsPanel). Antes cada uno tenía su propia copia del
   prompt y del parseo, así que arreglar uno dejaba el otro atrás.

   Flujo: exportar prompt → pegarlo en Claude → importar el JSON que devuelve. */

import { getAllTranslatableItems, translationCoverage, setLanguage } from '@/components/cms/engine'
import { state, loadTextDefaults } from '@/lib/cms/store'
import { getTranslations, importTranslations } from '@/lib/api'
import { BASE_LANG, TARGET_LANGS, LANG_META, type Lang } from '@/lib/i18n'

export type ExportResult = {
  count: number
  coverage: { section: string; count: number }[]
  /** El caché de textos por defecto está vacío: el admin nunca abrió el sitio
      en este navegador, así que solo se exporta lo ya guardado en la BD. */
  incompleteScan: boolean
}

function buildPrompt(items: Record<string, string>): string {
  const targets = TARGET_LANGS.map((l) => `${LANG_META[l].label} (${l})`).join(', ')
  const shape = TARGET_LANGS.map((l) => `"${l}": { ... }`).join(', ')
  return [
    `Translate the following artist portfolio content (animation, illustration, and 3D) from ${LANG_META[BASE_LANG].label} (${BASE_LANG}) to ${targets}.`,
    'Maintain a professional and artistic tone. Do not translate proper names, software brands, or URLs.',
    'Keep every key exactly as given — do not add, remove, rename, or reorder keys.',
    '',
    'Respond ONLY with valid JSON, without extra text or markdown fences, using this exact structure:',
    `{ "items": { ${shape} } }`,
    '',
    'Save your response as a .json file and import it in the panel using "Import translations".',
    '',
    `--- CONTENT (${LANG_META[BASE_LANG].label}) — ${Object.keys(items).length} entries ---`,
    JSON.stringify({ items: { [BASE_LANG]: items } }, null, 2),
  ].join('\n')
}

function download(filename: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/* Descarga el prompt con TODO el texto editable del sitio. Devuelve null
   cuando todavía no hay nada que traducir. */
export async function exportTranslationPrompt(): Promise<ExportResult | null> {
  const server = await getTranslations()
  const items = getAllTranslatableItems(server[BASE_LANG] || {})
  if (Object.keys(items).length === 0) return null

  download('translations-prompt.txt', buildPrompt(items), 'text/plain')

  return {
    count: Object.keys(items).length,
    coverage: translationCoverage(items),
    incompleteScan: Object.keys(loadTextDefaults()).length === 0,
  }
}

/* Lee el JSON devuelto por Claude y lo persiste. Acepta tanto
   `{ items: { es: {...} } }` como el mapa pelado `{ es: {...} }`, porque el
   modelo a veces entrega una forma y a veces la otra. */
export async function importTranslationsFile(file: File): Promise<{ imported: number; skipped: number }> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    throw new Error('Invalid JSON file')
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid JSON file')

  const root = parsed as Record<string, unknown>
  const raw = (root.items && typeof root.items === 'object' ? root.items : root) as Record<string, unknown>

  const items: Partial<Record<Lang, Record<string, string>>> = {}
  for (const lang of TARGET_LANGS) {
    const map = raw[lang]
    if (!map || typeof map !== 'object') continue
    items[lang] = map as Record<string, string>
  }
  if (Object.keys(items).length === 0) {
    throw new Error(`No translations found for ${TARGET_LANGS.join(', ')}.`)
  }

  const res = await importTranslations(items as Record<string, Record<string, string>>)
  // Refrescar el diccionario en memoria y repintar el idioma activo para que
  // las traducciones nuevas se vean sin recargar.
  state.translations = await getTranslations()
  setLanguage(state.lang)
  return res
}

'use client'

/* Guardado de los ajustes del sitio (claves `settings.*` de cms_data).
 *
 * Vive en `lib/` y no en `components/admin/SiteSettings.tsx` por una razón de
 * peso, literal: `app/(site)/layout.tsx` importa `SettingsPanel`, y ése llamaba
 * a `useSaveSettings()` desde el módulo de gestión. Al ser una llamada a hook no
 * se puede meter detrás de un `if (state.isAdmin)`, así que era una arista fija
 * del grafo: el chunk de primera carga de CUALQUIER ruta pública se llevaba las
 * ~36 KB del panel de Ajustes de gestión más `SocialSettings`, para un visitante
 * que no puede abrir ninguno de los dos.
 *
 * Es un movimiento de código: el cuerpo es el mismo que estaba allá. */

import { useToast } from '@/components/ui/Toast'
import { useSiteSettings } from '@/components/ui/SiteSettingsProvider'
import { saveContent } from '@/lib/api'
import { state, persistOverridesLocal, recordAudit, persistUsed, persistUnused, retireUsedEntryToUnused } from '@/lib/cms/store'
import { applyMedia } from '@/components/cms/engine'
import {
  SETTINGS_KEYS, ANIM_SLOTS, ANIM_FIELDS, ANIM_EVERY_FIELDS,
  animFields, animKey, animLabel, animPreviewClass,
  type SiteSettings,
} from '@/lib/settings'

export const CV_MAX_BYTES = 10 * 1024 * 1024

// Mapea el patch (camelCase) a claves cms_data settings.*
export function toItems(patch: Partial<SiteSettings>): Record<string, string> {
  const items: Record<string, string> = {}
  if (patch.loaderVideo !== undefined) {
    items[SETTINGS_KEYS.loaderVideo] = patch.loaderVideo
    items['loader.gallop'] = patch.loaderVideo
    items[SETTINGS_KEYS.loaderImage] = '' // limpiar imagen estática heredada
  }
  if (patch.loaderImage !== undefined) items[SETTINGS_KEYS.loaderImage] = patch.loaderImage
  if (patch.loaderDuration !== undefined) items[SETTINGS_KEYS.loaderDuration] = patch.loaderDuration
  if (patch.cvUrl !== undefined) items[SETTINGS_KEYS.cvUrl] = patch.cvUrl
  if (patch.cvName !== undefined) items[SETTINGS_KEYS.cvName] = patch.cvName
  if (patch.faviconUrl !== undefined) items[SETTINGS_KEYS.faviconUrl] = patch.faviconUrl
  if (patch.appleIconUrl !== undefined) items[SETTINGS_KEYS.appleIconUrl] = patch.appleIconUrl
  ANIM_FIELDS.forEach((f) => { if (patch[f] !== undefined) items[animKey(f)] = patch[f] as string })
  ANIM_EVERY_FIELDS.forEach((f) => { if (patch[f] !== undefined) items[animKey(f)] = patch[f] as string })
  return items
}

/* Ajustes que ADEMÁS son media: al guardar hay que reflejar el archivo en
   "Contenido en uso". El bloque era idéntico por ajuste (loader, favicon,
   icono de búsqueda) y con la animación del menú serían cuatro copias, así
   que la variación vive en la tabla y el cuerpo es uno solo.
   `imageAware`: el loader acepta imagen o video — el tipo real del archivo
   manda sobre el de la tabla. */
type SettingsMediaSync = {
  field: keyof SiteSettings
  key: string
  label: string
  name: string
  kind: 'image' | 'video'
  type: string
  imageAware?: boolean
  imageName?: string
}

export const SETTINGS_MEDIA_SYNC: SettingsMediaSync[] = [
  { field: 'loaderVideo', key: 'loader.gallop', label: 'Loading Screen (.loader-gallop)', name: 'video', kind: 'video', type: 'video/webm', imageAware: true, imageName: 'loader-image' },
  { field: 'faviconUrl', key: SETTINGS_KEYS.faviconUrl, label: 'Favicon (.favicon-preview-img)', name: 'favicon', kind: 'image', type: 'image/webp' },
  { field: 'appleIconUrl', key: SETTINGS_KEYS.appleIconUrl, label: 'Apple Touch Icon (.apple-icon-preview-img)', name: 'apple-icon', kind: 'image', type: 'image/webp' },
  // Animaciones: principal + rotación, generadas desde ANIM_SLOTS.
  ...ANIM_SLOTS.flatMap((slot) =>
    animFields(slot.base).map((field, i): SettingsMediaSync => ({
      field,
      key: animKey(field),
      label: `${animLabel(slot, i)} (.${animPreviewClass(slot, i)})`,
      name: animLabel(slot, i).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      kind: 'video',
      type: 'video/webm',
    })),
  ),
]

/* Persiste un patch de ajustes: POST /api/content (sube dataURLs → URLs),
   canonicaliza desde /api/site (para no dejar base64 en localStorage) y
   refleja en vivo vía setSettings. Devuelve los valores finales. */
export function useSaveSettings() {
  const { settings, setSettings } = useSiteSettings()
  const toast = useToast()

  return async (patch: Partial<SiteSettings>, summary: string): Promise<SiteSettings | null> => {
    try {
      await saveContent(toItems(patch))
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error saving settings', 'error')
      return null
    }
    // canonicalizar (URLs finales del backend); fallback a lo optimista
    let server: SiteSettings | null = null
    try {
      const r = await fetch('/api/site', { cache: 'no-store' })
      server = r.ok ? await r.json() : null
    } catch { /* sin DB → usar patch optimista */ }

    /* Resolución por campo, distinguiendo ASIGNAR de QUITAR (la clave de los dos
       bugs):
       - Campo tocado por el patch con valor '' → QUITAR: se honra el vacío. Antes
         `server || patch` dejaba que un eco viejo de /api/site RESUCITARA el CV
         recién removido ("Remove CV no funciona").
       - Campo tocado con valor → ASIGNAR: gana la URL canónica del server si vino,
         si no el propio patch (así un vacío desincronizado del server NO borra lo
         recién elegido — el bug del loader).
       - Campo NO tocado → lo del server, o lo actual. */
    const pick = (field: keyof SiteSettings): string => {
      const p = patch[field]
      if (p !== undefined) return p === '' ? '' : (server?.[field] || p)
      return (server?.[field] ?? settings[field] ?? '')
    }
    const final: SiteSettings = {
      loaderVideo: pick('loaderVideo'),
      loaderImage: pick('loaderImage'),
      loaderDuration: pick('loaderDuration'),
      cvUrl: pick('cvUrl'),
      cvName: pick('cvName'),
      faviconUrl: pick('faviconUrl'),
      appleIconUrl: pick('appleIconUrl'),
      ...(Object.fromEntries(ANIM_FIELDS.map((f) => [f, pick(f)])) as Pick<SiteSettings, (typeof ANIM_FIELDS)[number]>),
      ...(Object.fromEntries(ANIM_EVERY_FIELDS.map((f) => [f, pick(f)])) as Pick<SiteSettings, (typeof ANIM_EVERY_FIELDS)[number]>),
    }
    setSettings(final)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cms:favicon-updated', { detail: final.faviconUrl || '' }))
    }
    // persistir valores finales (URLs, no base64) en el store home + localStorage
    Object.assign(state.items, toItems(final))
    SETTINGS_MEDIA_SYNC.forEach((m) => {
      const src = final[m.field]
      if (src === undefined) return
      applyMedia(m.key, src)
      const prev = state.usedContent[m.key]
      if (!src) {
        if (prev) {
          retireUsedEntryToUnused(prev, 'retired', [m.key])
          delete state.usedContent[m.key]
        }
        return
      }
      if (prev && prev.src !== src) retireUsedEntryToUnused(prev, 'replaced', [m.key])
      const mm = state.mediaMeta[m.key] || state.mediaMeta[src]
      const asImage = !!m.imageAware && (mm?.type?.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(src))
      state.usedContent[m.key] = {
        key: m.key, label: m.label, section: 'Site Configuration', kind: asImage ? 'image' : m.kind,
        src, name: mm?.name || (asImage ? m.imageName! : m.name), size: mm?.size ?? null, original: false,
        ts: Date.now(), type: mm?.type || (asImage ? 'image/webp' : m.type),
      }
      const idx = state.unused.findIndex((u) => u.src === src)
      if (idx !== -1) state.unused.splice(idx, 1)
    })
    persistUsed(); persistUnused()
    persistOverridesLocal()
    recordAudit({ section: 'Site Settings', label: 'Settings', summary })
    toast('Saved')
    return final
  }
}

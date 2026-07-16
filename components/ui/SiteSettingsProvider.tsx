'use client'

/* Provee los ajustes globales del sitio (loader + CV) a TODAS las páginas:
   PageLoader (imagen/duración) y los botones de descarga de CV (Nav + gear).
   Carga una vez desde /api/site (lectura liviana) con fallback a los overrides
   locales (cms_overrides_v1) para dev sin DB. El admin refleja los cambios en
   vivo vía setSettings tras guardar en Ajustes → Gestión. */

import { createContext, useContext, useEffect, useState } from 'react'
import { EMPTY_SETTINGS, SETTINGS_KEYS, type SiteSettings } from '@/lib/settings'
import { syncSettingsUsedContent } from '@/components/cms/engine'

const SiteSettingsContext = createContext<{
  settings: SiteSettings
  setSettings: (s: SiteSettings) => void
}>({ settings: EMPTY_SETTINGS, setSettings: () => {} })

export const useSiteSettings = () => useContext(SiteSettingsContext)

/** Overrides locales (cms_overrides_v1) → SiteSettings, para dev sin DB. */
function fromLocalOverrides(): Partial<SiteSettings> {
  try {
    const ov = JSON.parse(localStorage.getItem('cms_overrides_v1') || '{}') as Record<string, string>
    const res: Partial<SiteSettings> = {}
    if (ov[SETTINGS_KEYS.loaderVideo] || ov['loader.gallop']) res.loaderVideo = ov[SETTINGS_KEYS.loaderVideo] || ov['loader.gallop']
    if (ov[SETTINGS_KEYS.loaderImage]) res.loaderImage = ov[SETTINGS_KEYS.loaderImage]
    if (ov[SETTINGS_KEYS.loaderDuration]) res.loaderDuration = ov[SETTINGS_KEYS.loaderDuration]
    if (ov[SETTINGS_KEYS.cvUrl]) res.cvUrl = ov[SETTINGS_KEYS.cvUrl]
    if (ov[SETTINGS_KEYS.cvName]) res.cvName = ov[SETTINGS_KEYS.cvName]
    if (ov[SETTINGS_KEYS.faviconUrl]) res.faviconUrl = ov[SETTINGS_KEYS.faviconUrl]
    return res
  } catch {
    return {}
  }
}

/** Actualiza o inyecta el favicon en el DOM cambiando el href sin remover elementos
 *  (para evitar que Chrome Incógnito revierta al ícono por defecto) y usando cache-buster
 *  cuando se guarda de forma dinámica. */
function applyFaviconToDOM(targetUrl: string, forceCacheBuster = false) {
  if (typeof document === 'undefined') return
  const url = targetUrl || '/favicon.ico'
  const existing = document.querySelectorAll<HTMLLinkElement>('link[rel*="icon"]')

  if (!forceCacheBuster && existing.length > 0) {
    const allMatch = Array.from(existing).every((el) => {
      try {
        return new URL(el.href, window.location.origin).pathname === new URL(url, window.location.origin).pathname
      } catch {
        return el.getAttribute('href') === url
      }
    })
    if (allMatch) {
      return
    }
  }

  const cacheBusterUrl = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`

  if (existing.length > 0) {
    existing.forEach((el) => {
      el.href = cacheBusterUrl
    })
  } else {
    const rels = ['icon', 'shortcut icon', 'apple-touch-icon']
    rels.forEach((rel) => {
      const link = document.createElement('link')
      link.rel = rel
      link.href = cacheBusterUrl
      document.head.appendChild(link)
    })
  }
}

export function SiteSettingsProvider({ children, initialSettings }: { children: React.ReactNode; initialSettings?: SiteSettings }) {
  const [settings, setSettings] = useState<SiteSettings>(initialSettings || EMPTY_SETTINGS)

  useEffect(() => {
    // 1) fallback local inmediato (sin flash en dev sin DB)
    setTimeout(() => {
      setSettings((s) => ({ ...s, ...fromLocalOverrides() }))
    }, 0)
    // 2) valores canónicos del backend (ganan si están presentes)
    fetch('/api/site', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: SiteSettings | null) => {
        if (!d) return
        const local = fromLocalOverrides()
        setSettings((s) => ({
          loaderVideo: local.loaderVideo || d.loaderVideo || s.loaderVideo,
          loaderImage: local.loaderImage || d.loaderImage || s.loaderImage,
          loaderDuration: local.loaderDuration || d.loaderDuration || s.loaderDuration,
          cvUrl: local.cvUrl || d.cvUrl || s.cvUrl,
          cvName: local.cvName || d.cvName || s.cvName,
          faviconUrl: local.faviconUrl || d.faviconUrl || s.faviconUrl,
        }))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    syncSettingsUsedContent(settings)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only sync when these specific fields change
  }, [settings.loaderVideo, settings.faviconUrl])

  useEffect(() => {
    applyFaviconToDOM(settings.faviconUrl || '', false)
  }, [settings.faviconUrl])

  useEffect(() => {
    const handleFaviconUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<string>
      applyFaviconToDOM(customEvent.detail || settings.faviconUrl || '', true)
    }
    window.addEventListener('cms:favicon-updated', handleFaviconUpdate)
    return () => window.removeEventListener('cms:favicon-updated', handleFaviconUpdate)
  }, [settings.faviconUrl])

  return (
    <SiteSettingsContext.Provider value={{ settings, setSettings }}>
      {children}
    </SiteSettingsContext.Provider>
  )
}

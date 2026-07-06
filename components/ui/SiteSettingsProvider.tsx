'use client'

/* Provee los ajustes globales del sitio (loader + CV) a TODAS las páginas:
   PageLoader (imagen/duración) y los botones de descarga de CV (Nav + gear).
   Carga una vez desde /api/site (lectura liviana) con fallback a los overrides
   locales (cms_overrides_v1) para dev sin DB. El admin refleja los cambios en
   vivo vía setSettings tras guardar en Ajustes → Gestión. */

import { createContext, useContext, useEffect, useState } from 'react'
import { EMPTY_SETTINGS, SETTINGS_KEYS, type SiteSettings } from '@/lib/settings'

const SiteSettingsContext = createContext<{
  settings: SiteSettings
  setSettings: (s: SiteSettings) => void
}>({ settings: EMPTY_SETTINGS, setSettings: () => {} })

export const useSiteSettings = () => useContext(SiteSettingsContext)

/** Overrides locales (cms_overrides_v1) → SiteSettings, para dev sin DB. */
function fromLocalOverrides(): Partial<SiteSettings> {
  try {
    const ov = JSON.parse(localStorage.getItem('cms_overrides_v1') || '{}') as Record<string, string>
    return {
      loaderVideo: ov[SETTINGS_KEYS.loaderVideo] || ov['loader.gallop'] || '',
      loaderImage: ov[SETTINGS_KEYS.loaderImage] || '',
      loaderDuration: ov[SETTINGS_KEYS.loaderDuration] || '',
      cvUrl: ov[SETTINGS_KEYS.cvUrl] || '',
      cvName: ov[SETTINGS_KEYS.cvName] || '',
      faviconUrl: ov[SETTINGS_KEYS.faviconUrl] || '',
    }
  } catch {
    return {}
  }
}

export function SiteSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(EMPTY_SETTINGS)

  useEffect(() => {
    // 1) fallback local inmediato (sin flash en dev sin DB)
    setSettings((s) => ({ ...s, ...fromLocalOverrides() }))
    // 2) valores canónicos del backend (ganan si están presentes)
    fetch('/api/site', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: SiteSettings | null) => {
        if (!d) return
        setSettings((s) => ({
          loaderVideo: d.loaderVideo || s.loaderVideo,
          loaderImage: d.loaderImage || s.loaderImage,
          loaderDuration: d.loaderDuration || s.loaderDuration,
          cvUrl: d.cvUrl || s.cvUrl,
          cvName: d.cvName || s.cvName,
          faviconUrl: d.faviconUrl || s.faviconUrl,
        }))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const url = settings.faviconUrl || '/favicon.ico'
    const existing = document.querySelectorAll('link[rel*="icon"]')
    existing.forEach((el) => el.remove())

    const link = document.createElement('link')
    link.rel = 'icon'
    link.href = url
    document.head.appendChild(link)

    const shortcut = document.createElement('link')
    shortcut.rel = 'shortcut icon'
    shortcut.href = url
    document.head.appendChild(shortcut)
  }, [settings.faviconUrl])

  return (
    <SiteSettingsContext.Provider value={{ settings, setSettings }}>
      {children}
    </SiteSettingsContext.Provider>
  )
}

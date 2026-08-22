'use client'

/* Gestión → Ajustes del sitio. Cuatro apartados:
   1) Pantalla de carga — imagen + duración del loader
   2) Redes sociales — reusa <SocialSettings/>
   3) Curriculum (CV) — sube el PDF que descargan Nav y el panel de ajustes
   4) Traducciones — exportar/importar el JSON (flujo admin-driven con Claude)

   Todo persiste en cms_data (claves settings.*) vía POST /api/content y se
   refleja en vivo en el sitio a través del SiteSettingsProvider. */

import { useRef, useState, useEffect } from 'react'
import { useToast } from '@/components/ui/Toast'
import { useSiteSettings } from '@/components/ui/SiteSettingsProvider'
import { saveContent, uploadMedia } from '@/lib/api'
import { state, persistOverridesLocal, recordAudit, useCmsStore, persistUsed, persistUnused, retireUsedEntryToUnused } from '@/lib/cms/store'
import { applyMedia, triggerContentPicker, indexEditables, attachEditControls, showEmptySlot, refreshTools, elementsByKey } from '@/components/cms/engine'
import { exportTranslationPrompt, importTranslationsFile } from '@/lib/translations-io'
import { SETTINGS_KEYS, type SiteSettings } from '@/lib/settings'
import SocialSettings from './SocialSettings'

export const CV_MAX_BYTES = 10 * 1024 * 1024

// Mapea el patch (camelCase) a claves cms_data settings.*
function toItems(patch: Partial<SiteSettings>): Record<string, string> {
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
  if (patch.navAnimUrl !== undefined) items[SETTINGS_KEYS.navAnimUrl] = patch.navAnimUrl
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

const SETTINGS_MEDIA_SYNC: SettingsMediaSync[] = [
  { field: 'loaderVideo', key: 'loader.gallop', label: 'Loading Screen (.loader-gallop)', name: 'video', kind: 'video', type: 'video/webm', imageAware: true, imageName: 'loader-image' },
  { field: 'faviconUrl', key: SETTINGS_KEYS.faviconUrl, label: 'Favicon (.favicon-preview-img)', name: 'favicon', kind: 'image', type: 'image/webp' },
  { field: 'appleIconUrl', key: SETTINGS_KEYS.appleIconUrl, label: 'Apple Touch Icon (.apple-icon-preview-img)', name: 'apple-icon', kind: 'image', type: 'image/webp' },
  { field: 'navAnimUrl', key: SETTINGS_KEYS.navAnimUrl, label: 'Menu Animation (.nav-anim-preview)', name: 'menu-animation', kind: 'video', type: 'video/webm' },
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
      navAnimUrl: pick('navAnimUrl'),
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

/* Vista previa en hover de las tarjetas con video. `pause()` mientras el
   `play()` anterior sigue pendiente aborta esa promesa y el navegador lo
   reporta como error ("The play() request was interrupted by a call to
   pause()"): por eso la pausa se encadena a la promesa en vuelo. */
function useVideoPreview(ref: React.RefObject<HTMLVideoElement | null>) {
  const pending = useRef<Promise<void> | null>(null)
  return {
    onMouseEnter: () => {
      const v = ref.current
      if (v) pending.current = v.play().catch(() => {})
    },
    onMouseLeave: () => {
      const v = ref.current
      if (!v) return
      void Promise.resolve(pending.current).then(() => {
        v.pause()
        v.currentTime = 0
      })
    },
  }
}

// ----- 1) Pantalla de carga --------------------------------------------------

/* Espejo de loaderDurationMs(): el panel tiene que mostrar el piso que el
   sitio realmente aplica cuando el ajuste nunca se guardó. */
const DEFAULT_DURATION = '1.2'

export function LoaderSettings() {
  useCmsStore()
  const { settings } = useSiteSettings()
  const save = useSaveSettings()
  const videoRef = useRef<HTMLVideoElement>(null)
  const preview = useVideoPreview(videoRef)
  const [duration, setDuration] = useState(() => settings.loaderDuration || DEFAULT_DURATION)
  const [saving, setSaving] = useState(false)

  const currentVideo = state.items['loader.gallop'] !== undefined ? state.items['loader.gallop'] : (settings.loaderVideo || '')
  const isChanged = duration !== (settings.loaderDuration || DEFAULT_DURATION) || currentVideo !== (settings.loaderVideo || '')

  useEffect(() => {
    indexEditables()
    attachEditControls()
    if (!currentVideo) {
      showEmptySlot('loader.gallop')
    } else {
      const parent = elementsByKey['loader.gallop']?.parentElement
      if (parent) {
        parent.classList.remove('cms-empty-slot')
        parent.querySelector('.cms-empty-overlay')?.remove()
      }
      refreshTools('loader.gallop')
    }
  }, [currentVideo])

  const onSaveConfiguration = async () => {
    setSaving(true)
    await save({
      loaderDuration: String(parseFloat(duration) || parseFloat(DEFAULT_DURATION)),
      loaderVideo: currentVideo,
    }, 'Loading screen settings updated')
    setSaving(false)
  }

  const onPreview = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cms:previewLoader'))
    }
  }

  return (
    <div className="admin-card" id="ajustes-loader">
      <div className="admin-card-head">
        <h2><i className="fa-solid fa-spinner"></i> Loading Screen
          <span className="cms-info-tip" tabIndex={0} aria-label="Customize the introductory loading video and its duration.">
            <i className="fa-solid fa-circle-info"></i>
            <span className="cms-info-bubble" role="tooltip">Customize the introductory loading video and its duration.</span>
          </span>
        </h2>
      </div>
      <p className="cms-admin-sub">Loading video and duration</p>
      <div className="site-setting-row" style={{ display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '1.25rem' }}>
        <div
          className="site-setting-media"
          style={{
            position: 'relative',
            width: 'clamp(260px, 40vw, 340px)',
            aspectRatio: '16 / 9',
            borderRadius: '14px',
            overflow: 'hidden',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: currentVideo ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
            cursor: 'pointer',
          }}
          onClick={() => triggerContentPicker('loader.gallop')}
          {...preview}
        >
          <video
            ref={videoRef}
            data-cms-key="loader.gallop"
            className="loader-gallop"
            src={currentVideo || undefined}
            loop
            muted
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: currentVideo ? 'block' : 'none', pointerEvents: 'none' }}
          />
        </div>
        <div className="site-setting-fields" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <label className="setting-item" style={{ maxWidth: 300 }}>
            <span>Duration (seconds)</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="number"
                min={0.5}
                max={15}
                step={0.5}
                className="social-input"
                style={{ maxWidth: 90 }}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
              <i className="fa-solid fa-clock" style={{ color: '#a78bfa', fontSize: '1.1rem' }}></i>
            </div>
          </label>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="cms-btn cms-btn--primary"
              onClick={onSaveConfiguration}
              disabled={!isChanged || saving}
            >
              <i className="fa-solid fa-floppy-disk"></i> {saving ? 'Saving…' : 'Save configuration'}
            </button>
            <button
              type="button"
              className="cms-btn cms-btn--primary"
              onClick={onPreview}
            >
              <i className="fa-solid fa-play"></i> Preview
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ----- 2) Icono de pestaña (Favicon) -----------------------------------------

export function FaviconSettings() {
  useCmsStore()
  const { settings } = useSiteSettings()
  const save = useSaveSettings()
  const [saving, setSaving] = useState(false)

  const currentFavicon = state.items['settings.faviconUrl'] !== undefined ? state.items['settings.faviconUrl'] : (settings.faviconUrl || '')
  const isChanged = currentFavicon !== (settings.faviconUrl || '')

  useEffect(() => {
    indexEditables()
    attachEditControls()
    
    // Favicon
    if (!currentFavicon) {
      showEmptySlot('settings.faviconUrl')
    } else {
      const parent = elementsByKey['settings.faviconUrl']?.parentElement
      if (parent) {
        parent.classList.remove('cms-empty-slot')
        parent.querySelector('.cms-empty-overlay')?.remove()
      }
      refreshTools('settings.faviconUrl')
    }
  }, [currentFavicon])

  const onSaveConfiguration = async () => {
    setSaving(true)
    await save({ faviconUrl: currentFavicon }, 'Favicon updated')
    setSaving(false)
  }

  return (
    <div className="admin-card" id="ajustes-favicon">
      <div className="admin-card-head">
        <h2><i className="fa-solid fa-compass"></i> Favicon
          <span className="cms-info-tip" tabIndex={0} aria-label="Icon shown in browser tabs. Upload a transparent design; without one the site falls back to /favicon.ico.">
            <i className="fa-solid fa-circle-info"></i>
            <span className="cms-info-bubble" role="tooltip" style={{ width: 280 }}>Icon shown in browser tabs. Upload a transparent design; without one the site falls back to /favicon.ico.</span>
          </span>
        </h2>
      </div>
      <p className="cms-admin-sub">Browser tab icon</p>
      <div className="site-setting-row" style={{ display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '1.25rem' }}>
        <div
          className="site-setting-media"
          style={{
            position: 'relative',
            width: 'clamp(140px, 20vw, 180px)',
            aspectRatio: '1 / 1',
            borderRadius: '14px',
            overflow: 'hidden',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: currentFavicon ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => triggerContentPicker('settings.faviconUrl')}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            data-cms-key="settings.faviconUrl"
            className="favicon-preview-img"
            src={currentFavicon || '/favicon.ico'}
            alt="Favicon preview"
            style={{ width: '60%', height: '60%', objectFit: 'contain', pointerEvents: 'none' }}
          />
        </div>
        <div className="site-setting-fields" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <button
              type="button"
              className="cms-btn cms-btn--primary"
              onClick={onSaveConfiguration}
              disabled={!isChanged || saving}
            >
              <i className="fa-solid fa-floppy-disk"></i> {saving ? 'Saving…' : 'Save favicon'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function AppleIconSettings() {
  useCmsStore()
  const { settings } = useSiteSettings()
  const save = useSaveSettings()
  const [saving, setSaving] = useState(false)

  const currentAppleIcon = state.items['settings.appleIconUrl'] !== undefined ? state.items['settings.appleIconUrl'] : (settings.appleIconUrl || '')
  const isChanged = currentAppleIcon !== (settings.appleIconUrl || '')

  useEffect(() => {
    indexEditables()
    attachEditControls()
    
    // Apple Icon
    if (!currentAppleIcon) {
      showEmptySlot('settings.appleIconUrl')
    } else {
      const parent = elementsByKey['settings.appleIconUrl']?.parentElement
      if (parent) {
        parent.classList.remove('cms-empty-slot')
        parent.querySelector('.cms-empty-overlay')?.remove()
      }
      refreshTools('settings.appleIconUrl')
    }
  }, [currentAppleIcon])

  const onSaveConfiguration = async () => {
    setSaving(true)
    await save({ appleIconUrl: currentAppleIcon }, 'Apple Touch Icon updated')
    setSaving(false)
  }

  return (
    <div className="admin-card" id="ajustes-apple-icon">
      <div className="admin-card-head">
        <h2><i className="fa-solid fa-magnifying-glass"></i> Search Engine Icon
          <span className="cms-info-tip" tabIndex={0} aria-label="Icon shown in Google Search results and mobile bookmarks. Upload a solid square image; without one the Favicon is used.">
            <i className="fa-solid fa-circle-info"></i>
            <span className="cms-info-bubble" role="tooltip" style={{ width: 280 }}>Icon shown in Google Search results and mobile bookmarks. Upload a solid square image; without one the Favicon is used.</span>
          </span>
        </h2>
      </div>
      <p className="cms-admin-sub">Search and mobile bookmark icon</p>
      <div className="site-setting-row" style={{ display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '1.25rem' }}>
        <div
          className="site-setting-media"
          style={{
            position: 'relative',
            width: 'clamp(140px, 20vw, 180px)',
            aspectRatio: '1 / 1',
            borderRadius: '14px',
            overflow: 'hidden',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: currentAppleIcon ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => triggerContentPicker('settings.appleIconUrl')}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            data-cms-key="settings.appleIconUrl"
            className="apple-icon-preview-img"
            src={currentAppleIcon || '/favicon.ico'}
            alt="Search Engine Icon preview"
            style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none', background: currentAppleIcon ? 'transparent' : '#fff' }}
          />
        </div>
        <div className="site-setting-fields" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <button
              type="button"
              className="cms-btn cms-btn--primary"
              onClick={onSaveConfiguration}
              disabled={!isChanged || saving}
            >
              <i className="fa-solid fa-floppy-disk"></i> {saving ? 'Saving…' : 'Save icon'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ----- Animación del menú (drawer móvil) -------------------------------------

export function NavAnimSettings() {
  useCmsStore()
  const { settings } = useSiteSettings()
  const save = useSaveSettings()
  const [saving, setSaving] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const preview = useVideoPreview(videoRef)

  const currentAnim = state.items[SETTINGS_KEYS.navAnimUrl] !== undefined
    ? state.items[SETTINGS_KEYS.navAnimUrl]
    : (settings.navAnimUrl || '')
  const isChanged = currentAnim !== (settings.navAnimUrl || '')

  useEffect(() => {
    indexEditables()
    attachEditControls()
    if (!currentAnim) {
      showEmptySlot(SETTINGS_KEYS.navAnimUrl)
    } else {
      const parent = elementsByKey[SETTINGS_KEYS.navAnimUrl]?.parentElement
      if (parent) {
        parent.classList.remove('cms-empty-slot')
        parent.querySelector('.cms-empty-overlay')?.remove()
      }
      refreshTools(SETTINGS_KEYS.navAnimUrl)
    }
  }, [currentAnim])

  const onSaveConfiguration = async () => {
    setSaving(true)
    await save({ navAnimUrl: currentAnim }, 'Menu animation updated')
    setSaving(false)
  }

  return (
    <div className="admin-card" id="ajustes-nav-anim">
      <div className="admin-card-head">
        <h2><i className="fa-solid fa-wand-magic-sparkles"></i> Menu Animation
          <span className="cms-info-tip" tabIndex={0} aria-label="Decorative WebM video with a transparent background. It sits in the bottom-right corner of the mobile menu, plays once every time the menu opens, and never moves the menu options.">
            <i className="fa-solid fa-circle-info"></i>
            <span className="cms-info-bubble" role="tooltip" style={{ width: 280 }}>Decorative WebM video with a transparent background. It sits in the bottom-right corner of the mobile menu, plays once every time the menu opens, and never moves the menu options.</span>
          </span>
        </h2>
      </div>
      <p className="cms-admin-sub">Mobile menu decorative animation</p>
      <div className="site-setting-row" style={{ display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '1.25rem' }}>
        <div
          className="site-setting-media"
          style={{
            position: 'relative',
            width: 'clamp(160px, 24vw, 200px)',
            aspectRatio: '1 / 1',
            borderRadius: '14px',
            overflow: 'hidden',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: currentAnim ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
            cursor: 'pointer',
          }}
          onClick={() => triggerContentPicker(SETTINGS_KEYS.navAnimUrl)}
          {...preview}
        >
          <video
            ref={videoRef}
            data-cms-key={SETTINGS_KEYS.navAnimUrl}
            className="nav-anim-preview"
            src={currentAnim || undefined}
            loop
            muted
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: currentAnim ? 'block' : 'none', pointerEvents: 'none' }}
          />
        </div>
        <div className="site-setting-fields" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <button
              type="button"
              className="cms-btn cms-btn--primary"
              onClick={onSaveConfiguration}
              disabled={!isChanged || saving}
            >
              <i className="fa-solid fa-floppy-disk"></i> {saving ? 'Saving…' : 'Save animation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ----- 3) Curriculum (CV) ----------------------------------------------------

export function CvSettings() {
  const { settings } = useSiteSettings()
  const save = useSaveSettings()
  const toast = useToast()
  const [saving, setSaving] = useState(false)

  const upload = async (file: File) => {
    if (file.type !== 'application/pdf') { toast('CV must be a PDF file.', 'error'); return }
    if (file.size > CV_MAX_BYTES) { toast('PDF exceeds the 10 MB limit.', 'error'); return }
    setSaving(true)
    try {
      // Multipart (no data URL dentro de un JSON): sube el PDF con su nombre real
      // y persiste la URL resultante. Evita el body gigante que hacía fallar el
      // guardado (Replace/Remove) y el asset con nombre "settings.*".
      const res = await uploadMedia(file, file.name, 'CV')
      await save({ cvUrl: res.secure_url, cvName: file.name }, `CV updated (${file.name})`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to upload CV', 'error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    setSaving(true)
    await save({ cvUrl: '', cvName: '' }, 'CV removed')
    setSaving(false)
  }

  return (
    <div className="admin-card" id="ajustes-cv">
      <div className="admin-card-head">
        <h2><i className="fa-solid fa-file-pdf"></i> Curriculum Vitae (CV)
          <span className="cms-info-tip" tabIndex={0} aria-label="Upload your CV in PDF format. This file is downloaded from the 'CV' button in the menu and settings panel across all pages.">
            <i className="fa-solid fa-circle-info"></i>
            <span className="cms-info-bubble" role="tooltip" style={{ width: 280 }}>Upload your CV in PDF format. This file is downloaded from the &quot;CV&quot; button in the menu and settings panel across all pages.</span>
          </span>
        </h2>
      </div>
      <p className="cms-admin-sub">Public downloadable resume</p>
      {settings.cvUrl ? (
        <div className="site-setting-file">
          <i className="fa-solid fa-file-pdf"></i>
          {/* /api/cv (no la URL cruda de Cloudinary): descarga con el nombre real
              en vez del public_id interno ("settings.*"). */}
          <a href="/api/cv" rel="noopener noreferrer">{settings.cvName || 'CV.pdf'}</a>
          <span className="cms-tag" style={{ background: '#22c55e', color: '#fff' }}>Active</span>
        </div>
      ) : (
        <p className="cms-admin-sub">No CV uploaded yet.</p>
      )}
      <div className="admin-quick" style={{ marginTop: '1.5rem' }}>
        <label className="cms-btn cms-btn--primary" style={{ cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
          <i className="fa-solid fa-file-arrow-up"></i> {saving ? 'Uploading…' : (settings.cvUrl ? 'Replace CV' : 'Upload CV')}
          <input
            type="file" accept="application/pdf" style={{ display: 'none' }} disabled={saving}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(f) }}
          />
        </label>
        {settings.cvUrl && (
          <button type="button" className="cms-btn" onClick={remove} disabled={saving}>
            <i className="fa-solid fa-trash"></i> Remove CV
          </button>
        )}
      </div>
    </div>
  )
}

// ----- 4) Traducciones -------------------------------------------------------

export function TranslationSettings() {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const [coverage, setCoverage] = useState<{ section: string; count: number }[]>([])

  const onExport = async () => {
    const res = await exportTranslationPrompt()
    if (!res) {
      toast('No text available for translation yet. Add English content first.', 'error')
      return
    }
    setCoverage(res.coverage)
    toast(
      res.incompleteScan
        ? `Prompt exported with ${res.count} texts. Browse the site once so every container is scanned.`
        : `Prompt exported with ${res.count} texts. Paste it entirely into Claude.`,
      res.incompleteScan ? 'error' : undefined,
    )
  }

  const onImport = async (file: File) => {
    try {
      const { imported, skipped } = await importTranslationsFile(file)
      toast(`${imported} translations imported${skipped ? ` · ${skipped} skipped` : ''}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error importing translations', 'error')
    }
  }

  return (
    <div className="admin-card" id="ajustes-traducciones">
      <div className="admin-card-head">
        <h2><i className="fa-solid fa-language"></i> Translations
          <span className="cms-info-tip" tabIndex={0} aria-label="Export the translation prompt (instructions + site text), paste it entirely into Claude, and then import the resulting JSON (Spanish, Portuguese, and French).">
            <i className="fa-solid fa-circle-info"></i>
            <span className="cms-info-bubble" role="tooltip" style={{ width: 300 }}>Export the translation prompt (instructions + site text), paste it entirely into Claude, and then import the resulting JSON (Spanish, Portuguese, and French).</span>
          </span>
        </h2>
      </div>
      <p className="cms-admin-sub">Manage multi-language content</p>
      <div className="admin-quick" style={{ marginTop: '1rem' }}>
        <button type="button" className="cms-btn" onClick={onExport}>
          <i className="fa-solid fa-download"></i> Export for translation
        </button>
        <button type="button" className="cms-btn cms-btn--primary" onClick={() => fileRef.current?.click()}>
          <i className="fa-solid fa-upload"></i> Import translations
        </button>
        <input
          ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onImport(f) }}
        />
      </div>
      {coverage.length > 0 && (
        <div className="cms-admin-sub" style={{ marginTop: '1rem', fontSize: '0.8rem' }}>
          <strong>Last export — texts per section:</strong>
          <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.1rem' }}>
            {coverage.map((c) => (
              <li key={c.section}>{c.section}: {c.count}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="cms-admin-sub" style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}>
        Base language: English. New text containers are automatically included in the next export.
      </p>
    </div>
  )
}

// ----- Página de Ajustes -----------------------------------------------------

export default function SiteSettings() {
  return (
    <>
      <LoaderSettings />
      <FaviconSettings />
      <AppleIconSettings />
      <NavAnimSettings />
      <SocialSettings />
      <CvSettings />
      <TranslationSettings />
    </>
  )
}

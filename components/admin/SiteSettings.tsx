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
import { fileToDataURL } from '@/lib/media'
import { saveContent, getTranslations, importTranslations } from '@/lib/api'
import { state, persistOverridesLocal, recordAudit, useCmsStore, persistUsed, persistUnused, retireUsedEntryToUnused } from '@/lib/cms/store'
import { setLanguage, applyMedia, triggerContentPicker, indexEditables, attachEditControls, showEmptySlot, refreshTools, elementsByKey, getAllTranslatableItems } from '@/components/cms/engine'
import { SETTINGS_KEYS, type SiteSettings } from '@/lib/settings'
import { BASE_LANG } from '@/lib/i18n'
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
  return items
}

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

    const optimistic = { ...settings, ...patch }
    const final: SiteSettings = {
      loaderVideo: server?.loaderVideo !== undefined ? server.loaderVideo : (optimistic.loaderVideo || ''),
      loaderImage: server?.loaderImage || optimistic.loaderImage,
      loaderDuration: server?.loaderDuration || optimistic.loaderDuration,
      cvUrl: server?.cvUrl || optimistic.cvUrl,
      cvName: server?.cvName || optimistic.cvName,
      faviconUrl: server?.faviconUrl || optimistic.faviconUrl,
    }
    setSettings(final)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cms:favicon-updated', { detail: final.faviconUrl || '' }))
    }
    // persistir valores finales (URLs, no base64) en el store home + localStorage
    Object.assign(state.items, toItems(final))
    if (final.loaderVideo !== undefined) {
      applyMedia('loader.gallop', final.loaderVideo)
      if (final.loaderVideo !== '') {
        const prev = state.usedContent['loader.gallop']
        if (prev && prev.src !== final.loaderVideo) {
          retireUsedEntryToUnused(prev, 'replaced', ['loader.gallop'])
        }
        const mm = state.mediaMeta['loader.gallop'] || state.mediaMeta[final.loaderVideo]
        const isImage = mm?.type?.startsWith('image/') || final.loaderVideo.match(/\.(png|jpe?g|webp|gif|svg)$/i)
        state.usedContent['loader.gallop'] = {
          key: 'loader.gallop', label: 'Loading Screen (.loader-gallop)', section: 'Site Settings', kind: isImage ? 'image' : 'video',
          src: final.loaderVideo, name: mm?.name || (isImage ? 'loader-image' : 'video'), size: mm?.size ?? null, original: false,
          ts: Date.now(), type: mm?.type || (isImage ? 'image/webp' : 'video/webm'),
        }
        const idx = state.unused.findIndex(u => u.src === final.loaderVideo)
        if (idx !== -1) state.unused.splice(idx, 1)
      } else {
        const prev = state.usedContent['loader.gallop']
        if (prev) {
          retireUsedEntryToUnused(prev, 'retired', ['loader.gallop'])
          delete state.usedContent['loader.gallop']
        }
      }
    }
    if (final.faviconUrl !== undefined) {
      applyMedia('settings.faviconUrl', final.faviconUrl)
      if (final.faviconUrl !== '') {
        const prev = state.usedContent['settings.faviconUrl']
        if (prev && prev.src !== final.faviconUrl) {
          retireUsedEntryToUnused(prev, 'replaced', ['settings.faviconUrl'])
        }
        const mm = state.mediaMeta['settings.faviconUrl'] || state.mediaMeta[final.faviconUrl]
        state.usedContent['settings.faviconUrl'] = {
          key: 'settings.faviconUrl', label: 'Favicon (.favicon-preview-img)', section: 'Site Settings', kind: 'image',
          src: final.faviconUrl, name: mm?.name || 'favicon', size: mm?.size ?? null, original: false,
          ts: Date.now(), type: mm?.type || 'image/webp',
        }
        const idx = state.unused.findIndex(u => u.src === final.faviconUrl)
        if (idx !== -1) state.unused.splice(idx, 1)
      } else {
        const prev = state.usedContent['settings.faviconUrl']
        if (prev) {
          retireUsedEntryToUnused(prev, 'retired', ['settings.faviconUrl'])
          delete state.usedContent['settings.faviconUrl']
        }
      }
    }
    persistUsed(); persistUnused()
    persistOverridesLocal()
    recordAudit({ section: 'Site Settings', label: 'Settings', summary })
    toast('Saved')
    return final
  }
}

// ----- 1) Pantalla de carga --------------------------------------------------

export function LoaderSettings() {
  useCmsStore()
  const { settings } = useSiteSettings()
  const save = useSaveSettings()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [duration, setDuration] = useState(() => settings.loaderDuration || '3')
  const [saving, setSaving] = useState(false)

  const currentVideo = state.items['loader.gallop'] !== undefined ? state.items['loader.gallop'] : (settings.loaderVideo || '')
  const isChanged = duration !== (settings.loaderDuration || '3') || currentVideo !== (settings.loaderVideo || '')

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
      loaderDuration: String(parseFloat(duration) || 3),
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
          onMouseEnter={() => videoRef.current?.play()}
          onMouseLeave={() => {
            if (videoRef.current) {
              videoRef.current.pause()
              videoRef.current.currentTime = 0
            }
          }}
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
                min={1}
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
    await save({ faviconUrl: currentFavicon }, 'Page favicon updated')
    setSaving(false)
  }

  return (
    <div className="admin-card" id="ajustes-favicon">
      <div className="admin-card-head">
        <h2><i className="fa-solid fa-compass"></i> Page Icon
          <span className="cms-info-tip" tabIndex={0} aria-label="Customize the icon displayed in browser tabs and bookmarks.">
            <i className="fa-solid fa-circle-info"></i>
            <span className="cms-info-bubble" role="tooltip">Customize the icon displayed in browser tabs and bookmarks.</span>
          </span>
        </h2>
      </div>
      <p className="cms-admin-sub">Tab and bookmark icon</p>
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
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
              {currentFavicon ? 'Custom favicon active' : 'Default favicon (/favicon.ico)'}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
              {isChanged ? 'Unsaved changes pending...' : 'Displayed in all tabs and bookmarks'}
            </div>
          </div>
          <div>
            <button
              type="button"
              className="cms-btn cms-btn--primary"
              onClick={onSaveConfiguration}
              disabled={!isChanged || saving}
            >
              <i className="fa-solid fa-floppy-disk"></i> {saving ? 'Saving…' : 'Save configuration'}
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
    const dataUrl = await fileToDataURL(file)
    await save({ cvUrl: dataUrl, cvName: file.name }, `CV updated (${file.name})`)
    setSaving(false)
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
          <a href={settings.cvUrl} target="_blank" rel="noopener noreferrer">{settings.cvName || 'CV.pdf'}</a>
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

  const onExport = async () => {
    const server = await getTranslations()
    const baseItems = getAllTranslatableItems(server[BASE_LANG] || {})
    if (Object.keys(baseItems).length === 0) {
      toast('No text available for translation yet. Add English content first.', 'error')
      return
    }
    const prompt = [
      'Translate the following artist portfolio content (animation, illustration, and 3D) from English (en) to Spanish (es), Portuguese (pt), and French (fr).',
      'Maintain a professional and artistic tone. Do not translate proper names or software brands.',
      '',
      'Respond ONLY with valid JSON, without extra text or markdown formatting, with this exact structure (same keys as the original for each language):',
      '{ "items": { "es": { ... }, "pt": { ... }, "fr": { ... } } }',
      '',
      'Save your response as a .json file and import it in the panel using "Import translations".',
      '',
      '--- CONTENT (English) ---',
      JSON.stringify({ items: { [BASE_LANG]: baseItems } }, null, 2),
    ].join('\n')
    const blob = new Blob([prompt], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'translations-prompt.txt'
    a.click()
    URL.revokeObjectURL(url)
    toast(`Prompt exported with ${Object.keys(baseItems).length} texts. Paste it entirely into Claude.`)
  }

  const onImport = async (file: File) => {
    let parsed: { items?: Record<string, Record<string, string>> }
    try { parsed = JSON.parse(await file.text()) } catch { toast('Invalid JSON file', 'error'); return }
    const items = parsed.items || (parsed as Record<string, Record<string, string>>)
    try {
      const { imported } = await importTranslations(items)
      state.translations = await getTranslations()
      setLanguage(state.lang) // reaplica con las traducciones nuevas
      toast(`${imported} translations imported`)
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
      <SocialSettings />
      <CvSettings />
      <TranslationSettings />
    </>
  )
}

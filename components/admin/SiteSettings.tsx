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
import { fileToDataURL, validateFile } from '@/lib/media'
import { saveContent, getTranslations, importTranslations } from '@/lib/api'
import { state, persistOverridesLocal, recordAudit } from '@/lib/cms/store'
import { setLanguage, applyMedia, triggerContentPicker, indexEditables, attachEditControls, showEmptySlot, refreshTools, elementsByKey } from '@/components/cms/engine'
import { SETTINGS_KEYS, type SiteSettings } from '@/lib/settings'
import { isTranslatableEntry } from '@/lib/i18n'
import SocialSettings from './SocialSettings'

const CV_MAX_BYTES = 10 * 1024 * 1024

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
function useSaveSettings() {
  const { settings, setSettings } = useSiteSettings()
  const toast = useToast()

  return async (patch: Partial<SiteSettings>, summary: string): Promise<SiteSettings | null> => {
    try {
      await saveContent(toItems(patch))
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error guardando', 'error')
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
    // persistir valores finales (URLs, no base64) en el store home + localStorage
    Object.assign(state.items, toItems(final))
    if (final.loaderVideo !== undefined) {
      applyMedia('loader.gallop', final.loaderVideo)
    }
    persistOverridesLocal()
    recordAudit({ section: 'Ajustes del sitio', label: 'Ajustes', summary })
    toast('Guardado')
    return final
  }
}

// ----- 1) Pantalla de carga --------------------------------------------------

export function LoaderSettings() {
  const { settings } = useSiteSettings()
  const save = useSaveSettings()
  const [duration, setDuration] = useState(() => settings.loaderDuration || '3')
  const [saving, setSaving] = useState(false)

  const currentVideo = state.items['loader.gallop'] || settings.loaderVideo || ''
  const isDurationChanged = duration !== (settings.loaderDuration || '3')

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

  const onSaveDuration = async () => {
    setSaving(true)
    await save({ loaderDuration: String(parseFloat(duration) || 3) }, 'Duración de pantalla de carga actualizada')
    setSaving(false)
  }

  return (
    <div className="admin-card" id="ajustes-loader">
      <div className="admin-card-head">
        <h2><i className="fa-solid fa-spinner"></i> Pantalla de carga</h2>
      </div>
      <p className="cms-admin-sub">
        <i className="fa-solid fa-circle-info"></i> Haz clic sobre el contenedor para abrir el selector de contenido (subir un video nuevo o elegir desde el repositorio), con el mismo flujo que los demás contenedores del sitio.
      </p>
      <div className="site-setting-row">
        <div
          className="site-setting-media"
          style={{
            position: 'relative',
            width: 'clamp(260px, 40vw, 360px)',
            aspectRatio: '16 / 9',
            borderRadius: '14px',
            overflow: 'hidden',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: currentVideo ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
            cursor: 'pointer',
          }}
          onClick={() => triggerContentPicker('loader.gallop')}
          title="Haz clic para seleccionar desde el repositorio o subir contenido"
        >
          <video
            data-cms-key="loader.gallop"
            className="loader-gallop"
            src={currentVideo || undefined}
            autoPlay
            loop
            muted
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: currentVideo ? 'block' : 'none', pointerEvents: 'none' }}
          />
        </div>
        <div className="site-setting-fields">
          <label className="setting-item" style={{ maxWidth: 320, marginTop: '0.5rem' }}>
            <span>Duración (segundos)</span>
            <input
              type="number"
              min={1}
              max={15}
              step={0.5}
              className="social-input"
              style={{ maxWidth: 120 }}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </label>
        </div>
      </div>
      <div className="admin-quick" style={{ marginTop: '1.5rem' }}>
        <button type="button" className="cms-btn cms-btn--primary" onClick={onSaveDuration} disabled={!isDurationChanged || saving}>
          <i className="fa-solid fa-floppy-disk"></i> {saving ? 'Guardando…' : 'Guardar configuración'}
        </button>
      </div>
    </div>
  )
}

// ----- 2) Icono de pestaña (Favicon) -----------------------------------------

export function FaviconSettings() {
  const { settings } = useSiteSettings()
  const save = useSaveSettings()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const current = preview || settings.faviconUrl

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast('El icono no debe superar los 2MB', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setPreview(String(reader.result))
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!preview) return
    setSaving(true)
    await save({ faviconUrl: preview }, 'Icono actualizado')
    setPreview(null)
    setSaving(false)
  }

  const handleRemove = async () => {
    setSaving(true)
    setPreview(null)
    await save({ faviconUrl: '' }, 'Icono restablecido al por defecto')
    setSaving(false)
  }

  return (
    <div className="admin-card" id="ajustes-favicon">
      <div className="admin-card-head">
        <h2><i className="fa-solid fa-compass"></i> Icono de la página (Favicon)</h2>
      </div>
      <p className="cms-admin-sub">
        <i className="fa-solid fa-circle-info"></i> Elegí la imagen (PNG, ICO, SVG o JPG) que aparecerá en la pestaña del navegador junto al título del sitio. Se recomienda un formato cuadrado (ej. 64x64 o 512x512 px).
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', margin: '1.5rem 0' }}>
        <div style={{
          width: 64, height: 64, borderRadius: 12, border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--card-bg)',
          overflow: 'hidden', position: 'relative'
        }}>
          {current ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={current} alt="Favicon" style={{ width: 36, height: 36, objectFit: 'contain' }} />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src="/favicon.ico" alt="Default favicon" style={{ width: 36, height: 36, objectFit: 'contain' }} />
          )}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
            {settings.faviconUrl ? 'Icono personalizado activo' : 'Icono por defecto (/favicon.ico)'}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
            {preview ? 'Cambio pendiente de guardar...' : 'Se muestra en todas las pestañas y marcadores'}
          </div>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/png,image/x-icon,image/svg+xml,image/jpeg,image/webp,.ico" style={{ display: 'none' }} onChange={onFile} />

      <div className="cms-form-actions" style={{ marginTop: '1.5rem' }}>
        <button type="button" className="cms-btn" onClick={() => fileRef.current?.click()} disabled={saving}>
          <i className="fa-solid fa-upload"></i> Elegir imagen...
        </button>
        {preview && (
          <button type="button" className="cms-btn cms-btn--primary" onClick={handleSave} disabled={saving}>
            <i className="fa-solid fa-floppy-disk"></i> Guardar icono
          </button>
        )}
        {(settings.faviconUrl || preview) && (
          <button type="button" className="cms-btn cms-btn--danger" onClick={handleRemove} disabled={saving}>
            <i className="fa-solid fa-trash"></i> Restablecer por defecto
          </button>
        )}
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
    if (file.type !== 'application/pdf') { toast('El CV debe ser un PDF.', 'error'); return }
    if (file.size > CV_MAX_BYTES) { toast('El PDF supera el límite de 10 MB.', 'error'); return }
    setSaving(true)
    const dataUrl = await fileToDataURL(file)
    await save({ cvUrl: dataUrl, cvName: file.name }, `CV actualizado (${file.name})`)
    setSaving(false)
  }

  const remove = async () => {
    setSaving(true)
    await save({ cvUrl: '', cvName: '' }, 'CV quitado')
    setSaving(false)
  }

  return (
    <div className="admin-card" id="ajustes-cv">
      <div className="admin-card-head">
        <h2><i className="fa-solid fa-file-pdf"></i> Curriculum (CV)</h2>
      </div>
      <p className="cms-admin-sub">
        <i className="fa-solid fa-circle-info"></i> Subí el CV en PDF. Es el archivo que descargan el botón &quot;CV&quot;
        del menú y el del panel de ajustes, en todas las páginas.
      </p>
      {settings.cvUrl ? (
        <div className="site-setting-file">
          <i className="fa-solid fa-file-pdf"></i>
          <a href={settings.cvUrl} target="_blank" rel="noopener noreferrer">{settings.cvName || 'CV.pdf'}</a>
          <span className="cms-tag" style={{ background: '#22c55e', color: '#fff' }}>Activo</span>
        </div>
      ) : (
        <p className="cms-admin-sub">Todavía no hay un CV cargado.</p>
      )}
      <div className="admin-quick" style={{ marginTop: '1.5rem' }}>
        <label className="cms-btn cms-btn--primary" style={{ cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
          <i className="fa-solid fa-file-arrow-up"></i> {saving ? 'Subiendo…' : (settings.cvUrl ? 'Reemplazar CV' : 'Subir CV')}
          <input
            type="file" accept="application/pdf" style={{ display: 'none' }} disabled={saving}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(f) }}
          />
        </label>
        {settings.cvUrl && (
          <button type="button" className="cms-btn" onClick={remove} disabled={saving}>
            <i className="fa-solid fa-trash"></i> Quitar CV
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
    // Base ES = BD + estado vivo del CMS (texto recién editado que puede no
    // haber llegado aún a cms_data). El filtro excluye media/URLs/settings.
    const server = await getTranslations()
    const es: Record<string, string> = { ...(server.es || {}) }
    for (const [key, value] of Object.entries(state.items)) {
      if (typeof value === 'string' && isTranslatableEntry(key, value)) es[key] = value
    }
    if (Object.keys(es).length === 0) {
      toast('No hay texto para traducir todavía. Cargá contenido en español primero.', 'error')
      return
    }
    const prompt = [
      'Traduce el siguiente contenido de un portfolio de artista (animación, ilustración y 3D) del español a inglés (en), portugués (pt) y francés (fr).',
      'Mantené un tono profesional y artístico. No traduzcas nombres propios ni marcas.',
      '',
      'Respondé SOLO con un JSON válido, sin texto extra ni markdown, con esta estructura exacta (mismas claves que el original en cada idioma):',
      '{ "items": { "en": { ... }, "pt": { ... }, "fr": { ... } } }',
      '',
      'Guardá tu respuesta como archivo .json e importalo en el panel con "Importar traducciones".',
      '',
      '--- CONTENIDO (español) ---',
      JSON.stringify({ items: { es } }, null, 2),
    ].join('\n')
    const blob = new Blob([prompt], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'translations-prompt.txt'
    a.click()
    URL.revokeObjectURL(url)
    toast(`Prompt exportado con ${Object.keys(es).length} textos. Pegalo entero en Claude.`)
  }

  const onImport = async (file: File) => {
    let parsed: { items?: Record<string, Record<string, string>> }
    try { parsed = JSON.parse(await file.text()) } catch { toast('Archivo JSON inválido', 'error'); return }
    const items = parsed.items || (parsed as Record<string, Record<string, string>>)
    try {
      const { imported } = await importTranslations(items)
      state.translations = await getTranslations()
      setLanguage(state.lang) // reaplica con las traducciones nuevas
      toast(`${imported} traducciones importadas`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error importando', 'error')
    }
  }

  return (
    <div className="admin-card" id="ajustes-traducciones">
      <div className="admin-card-head">
        <h2><i className="fa-solid fa-language"></i> Traducciones</h2>
      </div>
      <p className="cms-admin-sub">
        <i className="fa-solid fa-circle-info"></i> Exportá el prompt listo (instrucciones + texto del sitio),
        pegalo entero en Claude, y después importá el JSON que te devuelva (inglés, portugués y francés).
      </p>
      <div className="admin-quick" style={{ marginTop: '1rem' }}>
        <button type="button" className="cms-btn" onClick={onExport}>
          <i className="fa-solid fa-download"></i> Exportar para traducir
        </button>
        <button type="button" className="cms-btn cms-btn--primary" onClick={() => fileRef.current?.click()}>
          <i className="fa-solid fa-upload"></i> Importar traducciones
        </button>
        <input
          ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onImport(f) }}
        />
      </div>
      <p className="cms-admin-sub" style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}>
        Idioma base: Español. Los nuevos contenedores de texto se incluyen automáticamente en la próxima exportación.
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

'use client'

/* Settings (tuerca) — portado de shared-ui.js (SETTINGS) + index.html.
   Dark mode, pausa de animaciones (cms.js motion-off) y ocultar
   controles de edición (cms.js hide-cms) funcionales. */

import { useEffect, useRef, useState } from 'react'
import { state, useCmsStore, useUiText } from '@/lib/cms/store'
import { clearAllSite, currentSectionInfo, clearSectionKeys, setLanguage } from '@/components/cms/engine'
import { revealAllNow } from '@/components/home/HomeFx'
import { ALL_LANGS, LANG_META, type Lang } from '@/lib/i18n'
import { useSiteSettings } from '@/components/ui/SiteSettingsProvider'
import { exportTranslationPrompt, importTranslationsFile } from '@/lib/translations-io'
import { useToast } from '@/components/ui/Toast'
import { uploadCvFile, deleteCvFile } from '@/lib/api'
import { useSaveSettings, CV_MAX_BYTES } from '@/components/admin/SiteSettings'
import { useSocial } from '@/components/ui/SocialProvider'
import { sendGAEvent } from '@next/third-parties/google'
import { useDownloadCv } from '@/hooks/useDownloadCv'
import DecorAnim from '@/components/ui/DecorAnim'
import { animSources } from '@/lib/settings'

const LS_MOTION = 'cms_motion_off_v1'
const LS_HIDE_CMS = 'cms_hide_controls_v1'

/* Fracción de pantalla que "About me" tiene que haber invadido para que la
   tuerca entre. Con 1 (el borde inferior exacto) aparecería ya en la portada,
   porque el hero mide 100svh y el tope de About coincide con el pliegue. */
const GEAR_AWAY_ENTER_RATIO = 0.75


// Al pausar el movimiento, los títulos typewriter muestran su texto
// completo para que no queden vacíos (port revealTypewriters)
function revealTypewriters() {
  document.querySelectorAll<HTMLElement>('.section-typewriter').forEach((el) => {
    const full = el.dataset.text
    if (full && el.innerHTML !== full) {
      el.innerHTML = full
      el.dataset.animated = 'true'
    }
  })
}

function applyMotionOff(off: boolean) {
  document.documentElement.classList.toggle('motion-off', off)
  // GSAP global: matar/reactivar toda la coreografía (todas las secciones, no
  // solo la portada). Import dinámico → gsap no viaja a rutas sin animación.
  import('@/hooks/useGSAP').then((m) => (off ? m.killAllMotion() : m.resumeMotion())).catch(() => {})
  if (off) {
    document.querySelectorAll('video').forEach((v) => { try { v.pause() } catch {} })
    // cortar también la coreografía de entrada (reveals on-scroll + typewriter):
    // todo visible ya, sin esperar al IntersectionObserver.
    revealAllNow()
    revealTypewriters()
    setTimeout(revealTypewriters, 60) // por si el observer aún no escribió un título
  }
  try { localStorage.setItem(LS_MOTION, off ? '1' : '0') } catch {}
}

function applyHideCms(hide: boolean) {
  document.body.classList.toggle('hide-cms-controls', hide)
  try { localStorage.setItem(LS_HIDE_CMS, hide ? '1' : '0') } catch {}
}

export default function SettingsPanel() {
  const { settings } = useSiteSettings()
  const saveSettings = useSaveSettings()
  const toast = useToast()
  const [savingCv, setSavingCv] = useState(false)
  const { downloadCv, isDownloading } = useDownloadCv(settings.cvUrl, settings.cvName || 'CV.pdf')
  const transFileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  // true mientras la tuerca todavía no debe mostrarse (portada, en móvil)
  const [gearAway, setGearAway] = useState(false)
  /* Pestaña del borde (solo ≤992px): cerrada solo asoma la lengueta; al
     abrirla salen las tuercas. Un toque más abre el panel. En escritorio la
     pestaña no existe (`display: contents`) y las tuercas flotan como siempre,
     así que este estado no las afecta. */
  const [dockOpen, setDockOpen] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [sectionClear, setSectionClear] = useState<{ label: string; keys: string[]; count: number } | null>(null)
  // lazy init: en SSR no hay window; en hidratación lee el tema que el boot
  // script ya aplicó (el suppressHydrationWarning del input cubre el diff)
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false
    try { return localStorage.getItem('theme') === 'dark' } catch { return false }
  })
  const [langOpen, setLangOpen] = useState(false)
  const activeLang = LANG_META[state.lang]
  // lazy init desde localStorage (igual patrón que dark mode); el effect
  // solo aplica las clases al DOM, sin setState
  const [motionOff, setMotionOff] = useState(() => {
    if (typeof window === 'undefined') return false
    try { return localStorage.getItem(LS_MOTION) === '1' } catch { return false }
  })
  const [hideCms, setHideCms] = useState(() => {
    if (typeof window === 'undefined') return false
    try { return localStorage.getItem(LS_HIDE_CMS) === '1' } catch { return false }
  })
  useCmsStore() // re-render cuando cambia el estado CMS
  const ui = useUiText()
  const panelRef = useRef<HTMLDivElement>(null)
  const gearRef = useRef<HTMLButtonElement>(null)
  const adminPanelRef = useRef<HTMLDivElement>(null)
  const adminGearRef = useRef<HTMLButtonElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)

  /* Usado el panel, la pestana se repliega sola: la tuerca es el paso
     intermedio para llegar a los ajustes, no un boton que tenga que quedarse
     a la vista despues. En reposo lo unico visible vuelve a ser la flecha.
     Se dispara en el flanco abierto -> cerrado, no con "no hay panel
     abierto": si no, replegaria la pestana en el mismo gesto que la abre. */
  const panelWasOpen = useRef(false)
  useEffect(() => {
    const anyOpen = open || adminOpen
    if (panelWasOpen.current && !anyOpen) setDockOpen(false)
    panelWasOpen.current = anyOpen
  }, [open, adminOpen])

  const uploadCv = async (file: File) => {
    if (file.type !== 'application/pdf') { toast('CV must be a PDF file.', 'error'); return }
    if (file.size > CV_MAX_BYTES) { toast('PDF exceeds the 10 MB limit.', 'error'); return }
    setSavingCv(true)
    try {
      // Mismo circuito que Gestión: DB vía /api/cv, nunca el repositorio de media.
      const res = await uploadCvFile(file, file.name)
      await saveSettings({ cvUrl: res.url, cvName: res.name }, `CV updated (${res.name})`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Upload failed', 'error')
    }
    setSavingCv(false)
  }

  const removeCv = async () => {
    setSavingCv(true)
    try {
      await deleteCvFile()
      await saveSettings({ cvUrl: '', cvName: '' }, 'CV removed')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to remove CV', 'error')
    }
    setSavingCv(false)
  }

  const onExportTranslations = async () => {
    const res = await exportTranslationPrompt()
    if (!res) {
      toast('No text available for translation yet. Add English content first.', 'error')
      return
    }
    toast(
      res.incompleteScan
        ? `Prompt exported with ${res.count} texts. Browse the site once so every container is scanned.`
        : `Prompt exported with ${res.count} texts. Paste it entirely into Claude.`,
      res.incompleteScan ? 'error' : undefined,
    )
  }

  const onImportTranslations = async (file: File) => {
    try {
      const { imported, skipped } = await importTranslationsFile(file)
      toast(`${imported} translations imported${skipped ? ` · ${skipped} skipped` : ''}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error importing translations', 'error')
    }
  }

  // aplicar preferencias guardadas al montar (port de los init legacy)
  useEffect(() => {
    if (motionOff) applyMotionOff(true)
    if (hideCms) applyHideCms(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!open && !adminOpen && !dockOpen) return
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (open && !(panelRef.current?.contains(t) || gearRef.current?.contains(t))) setOpen(false)
      if (adminOpen && !(adminPanelRef.current?.contains(t) || adminGearRef.current?.contains(t))) setAdminOpen(false)
      // La pestaña se repliega si el toque cae fuera de ella Y de los paneles
      // que abrió (cerrarla con un panel abierto dejaría el panel huérfano).
      if (dockOpen && !(dockRef.current?.contains(t) || panelRef.current?.contains(t) || adminPanelRef.current?.contains(t))) setDockOpen(false)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [open, adminOpen, dockOpen])

  // Retiro de la tuerca sobre la portada y sobre el footer (ver `gearAway`).
  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const footer = document.querySelector('footer.main-footer')
          const footerTop = footer ? footer.getBoundingClientRect().top : Infinity
          /* La tuerca entra al ENTRAR en "About me": hasta ahí sobra sobre la
             portada. Se mide contra el borde superior de la sección y no
             contra el inferior — con el inferior había que recorrer los 1300px
             de About enteros antes de que apareciera. Se consulta el DOM en
             cada tick porque la sección solo existe en la home: en el resto de
             las rutas no hay nada que esperar y la tuerca queda visible desde
             el arranque. */
          const about = document.querySelector('.about-section')
          const beforeAbout = !!about
            && about.getBoundingClientRect().top > window.innerHeight * GEAR_AWAY_ENTER_RATIO
          /* El footer cierra el recorrido: ahí la tuerca ya no tiene contenido
             debajo al que aplicar y se superpone al bloque de contacto, así
             que se retira igual que sobre la portada. */
          const atFooter = footerTop < window.innerHeight
          const away = beforeAbout || atFooter
          setGearAway(away)
          // si se retira con un panel abierto, el panel se va con ella
          if (away) { setOpen(false); setAdminOpen(false); setDockOpen(false) }
          ticking = false
        })
        ticking = true
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    onScroll() // check inicial

    /* "About me" baja por next/dynamic: en el primer chequeo todavía no está en
       el DOM y la tuerca se quedaría visible sobre la portada hasta el primer
       scroll. Se re-evalúa en cuanto monta. En las rutas donde la sección no
       existe el observer nunca dispara y lo corta el failsafe. */
    let mo: MutationObserver | null = null
    let failsafe = 0
    if (!document.querySelector('.about-section')) {
      mo = new MutationObserver(() => {
        if (!document.querySelector('.about-section')) return
        mo?.disconnect(); mo = null
        onScroll()
      })
      mo.observe(document.body, { childList: true, subtree: true })
      failsafe = window.setTimeout(() => { mo?.disconnect(); mo = null }, 5000)
    }

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      mo?.disconnect()
      if (failsafe) clearTimeout(failsafe)
    }
  }, [])

  const toggleDark = (checked: boolean) => {
    setDark(checked)
    const theme = checked ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('theme', theme) } catch {}
  }


  return (
    <>
      {/* Pestaña del borde izquierdo. En ≤992px es la única pieza visible con la
          pestaña cerrada; en escritorio el contenedor es `display: contents` y
          las tuercas vuelven a flotar por su cuenta. */}
      <div ref={dockRef} className={`settings-dock${dockOpen ? ' is-open' : ''}${gearAway ? ' is-away' : ''}`}>
        <button
          type="button"
          className="settings-dock__handle"
          aria-label={ui('settings_tab')}
          aria-expanded={dockOpen}
          aria-controls="settings-toggle"
          onClick={() => {
            // Al replegar se van también los paneles: quedarían sueltos sin
            // su tuerca a la vista.
            setDockOpen((o) => { if (o) { setOpen(false); setAdminOpen(false) } return !o })
          }}
        >
          <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
        </button>
        {/* Tuerca general — visible para todos los usuarios */}
        <button ref={gearRef} id="settings-toggle" className={`settings-gear${gearAway ? ' is-away' : ''}`} aria-label={ui('settings')} onClick={() => { setOpen((o) => !o); setAdminOpen(false) }}>
          <i className="fa-solid fa-gear"></i>
        </button>
        {/* Tuerca admin — comparte la pestaña, solo con sesión iniciada */}
        {state.isAdmin && (
          <button
            ref={adminGearRef}
            id="admin-settings-toggle"
            className={`settings-gear settings-gear--admin${gearAway ? ' is-away' : ''}`}
            aria-label="Admin settings"
            title="Admin settings"
            onClick={() => { setAdminOpen((o) => !o); setOpen(false) }}
          >
            <i className="fa-solid fa-user-gear"></i>
          </button>
        )}
      </div>
      <div ref={panelRef} id="settings-panel" className={`settings-panel${open ? '' : ' hidden'}${gearAway ? ' is-away' : ''}`}>
        <h3>{ui('settings')}</h3>
        <div className="setting-item">
          <span>{ui('dark_mode')}</span>
          <label className="switch">
            <input type="checkbox" id="dark-mode-switch" checked={dark} onChange={(e) => toggleDark(e.target.checked)} suppressHydrationWarning />
            <span className="slider round"></span>
          </label>
        </div>
        <div className="setting-item">
          <span>{ui('pause_animations')}</span>
          <label className="switch">
            <input
              type="checkbox" id="motion-switch" checked={motionOff} suppressHydrationWarning
              onChange={(e) => { setMotionOff(e.target.checked); applyMotionOff(e.target.checked) }}
            />
            <span className="slider round"></span>
          </label>
        </div>
        <div className="setting-item">
          <span>{ui('curriculum_vitae')}</span>
          <a
            className={`cv-btn cv-btn-settings${settings.cvUrl && !isDownloading ? '' : ' is-disabled'}`}
            id="cv-download-settings" href={settings.cvUrl ? '/api/cv' : undefined}
            onClick={settings.cvUrl ? downloadCv : undefined}
            title={settings.cvUrl ? ui('download_cv_pdf') : ui('cv_unavailable')}
            aria-disabled={!settings.cvUrl || undefined}
          >
            <i className={`fa-solid ${isDownloading ? 'fa-spinner fa-spin' : 'fa-file-arrow-down'}`}></i>
            <span>{ui('cv')}</span>
          </a>
        </div>
        <div className="setting-item">
          <span>{ui('language')}</span>
          <div className="lang-selector-settings" id="lang-selector-settings">
            <button className="lang-btn-settings" id="lang-toggle-settings" aria-label={ui('change_language')} onClick={() => setLangOpen((o) => !o)}>
              {/* Bandera SVG inline de LANG_META: next/image no optimiza SVG. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={activeLang.svg} alt={activeLang.label} className="lang-flag-img" id="lang-flag-settings" />
              <span className="lang-code" id="lang-code-settings">{state.lang.toUpperCase()}</span>
              <i className="fa-solid fa-chevron-down chev"></i>
            </button>
            <div className={`lang-dropdown-settings${langOpen ? ' active' : ''}`} id="lang-dropdown-settings">
              {ALL_LANGS.map((code) => (
                <button key={code} className="lang-option" data-lang={code} title={LANG_META[code].label} onClick={() => { setLanguage(code as Lang); setLangOpen(false) }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={LANG_META[code].svg} alt={LANG_META[code].label} className="lang-flag-img" /> {LANG_META[code].label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {/* Cierre del panel, debajo del selector de idioma: en el flujo y a todo
            el ancho de la caja. Corre mientras el panel está abierto. */}
        <DecorAnim sources={animSources(settings, 'panelAnimUrl')} className="settings-panel__anim" active={open} rotateOn="toggle" />
      </div>

      {/* Panel admin — solo logueado como admin. Lista settings exclusivos de admin.
          Por ahora: Hide Edit actions + Clear Current Section (+ Clear All Content, solo owner).
          Su tuerca vive en la pestaña, arriba. */}
      {state.isAdmin && (
        <>
          <div ref={adminPanelRef} id="admin-settings-panel" className={`settings-panel settings-panel--admin${adminOpen ? '' : ' hidden'}${gearAway ? ' is-away' : ''}`}>
            <h3>Admin Settings</h3>
            <div className="setting-item">
          <span>Hide Edit actions</span>
              <label className="switch">
                <input
                  type="checkbox" id="hide-cms-switch" checked={hideCms} suppressHydrationWarning
                  onChange={(e) => { setHideCms(e.target.checked); applyHideCms(e.target.checked) }}
                />
                <span className="slider round"></span>
              </label>
            </div>
            <div className="setting-item">
              <span>Clear Current Section</span>
              <button
                type="button"
                className="cv-btn cv-btn-settings"
                id="clear-section-btn"
                title="Clear only the containers of the section currently in view"
                onClick={() => setSectionClear(currentSectionInfo())}
              >
                <i className="fa-solid fa-eraser"></i>
              </button>
            </div>
            {/* Vaciar el sitio entero es irreversible para el resto de los
                roles: queda reservado al owner. "Clear Current Section" sigue
                disponible para cualquier admin. */}
            {state.role === 'owner' && (
              <div className="setting-item">
                <span>Clear All Content</span>
                <button
                  type="button"
                  className="cv-btn cv-btn-settings"
                  id="clear-content-btn"
                  title="Clear all page content"
                  onClick={() => setShowClearConfirm(true)}
                >
                  <i className="fa-solid fa-trash"></i>
                </button>
              </div>
            )}
            <hr className="settings-divider" />
            <div className="setting-item">
          <span>Upload CV</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <label
                  className="cv-btn cv-btn-settings"
                  style={{ cursor: 'pointer', opacity: savingCv ? 0.6 : 1 }}
                  title={settings.cvUrl ? 'Replace CV' : 'Upload CV'}
                >
                  <i className={`fa-solid ${savingCv ? 'fa-spinner fa-spin' : 'fa-file-arrow-up'}`}></i>
                  <input
                    type="file" accept="application/pdf" style={{ display: 'none' }} disabled={savingCv}
                    onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadCv(f) }}
                  />
                </label>
                {settings.cvUrl && (
                  <button
                    type="button"
                    className="cv-btn cv-btn-settings"
                    title="Remove CV"
                    onClick={removeCv}
                    disabled={savingCv}
                  >
                    <i className="fa-solid fa-trash"></i>
                  </button>
                )}
              </div>
            </div>
            <div className="setting-item">
              <span>Export translations</span>
              <button
                type="button"
                className="cv-btn cv-btn-settings"
                title="Export translation prompt"
                onClick={onExportTranslations}
              >
                <i className="fa-solid fa-download"></i>
              </button>
            </div>
            <div className="setting-item">
              <span>Import translations</span>
              <button
                type="button"
                className="cv-btn cv-btn-settings"
                title="Import translations JSON file"
                onClick={() => transFileRef.current?.click()}
              >
                <i className="fa-solid fa-upload"></i>
              </button>
              <input
                ref={transFileRef}
                type="file" accept=".json,application/json" style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onImportTranslations(f) }}
              />
            </div>
          </div>
        </>
      )}

      {sectionClear && (
        <div className="cms-confirm-overlay" onClick={() => setSectionClear(null)}>
          <div className="cms-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Clear Current Section?</h3>
            {sectionClear.count > 0 ? (
              <p>
                This will move the content of{' '}
                <strong>{sectionClear.label || 'this section'}</strong> ({sectionClear.count}) to unused,
                leaving only empty containers. The rest of the page is untouched.
              </p>
            ) : (
              <p>No content to clear in <strong>{sectionClear.label || 'this section'}</strong>.</p>
            )}
            <div className="cms-confirm-actions">
              <button type="button" onClick={() => setSectionClear(null)} className="cms-btn cms-btn-cancel">
                Cancel
              </button>
              {sectionClear.count > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    clearSectionKeys(sectionClear.keys)
                    setSectionClear(null)
                    setAdminOpen(false)
                  }}
                  className="cms-btn cms-btn-danger"
                >
                  Clear Section
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {showClearConfirm && state.role === 'owner' && (
        <div className="cms-confirm-overlay" onClick={() => setShowClearConfirm(false)}>
          <div className="cms-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Clear All Content?</h3>
            <p>This will move all content to unused, leaving only empty containers.</p>
            <div className="cms-confirm-actions">
              <button type="button" onClick={() => setShowClearConfirm(false)} className="cms-btn cms-btn-cancel">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  clearAllSite()
                  setShowClearConfirm(false)
                  setAdminOpen(false)
                }}
                className="cms-btn cms-btn-danger"
              >
                Clear All Content
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

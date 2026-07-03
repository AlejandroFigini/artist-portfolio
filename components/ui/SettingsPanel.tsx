'use client'

/* Settings (tuerca) — portado de shared-ui.js (SETTINGS) + index.html.
   Dark mode, pausa de animaciones (cms.js motion-off) y ocultar
   controles de edición (cms.js hide-cms) funcionales. */

import { useEffect, useRef, useState } from 'react'
import { state, useCmsStore } from '@/lib/cms/store'
import { clearAllSite, currentSectionInfo, clearSectionKeys, setLanguage } from '@/components/cms/engine'
import { revealAllNow } from '@/components/home/HomeFx'
import { ALL_LANGS, LANG_META, type Lang } from '@/lib/i18n'
import { useSiteSettings } from '@/components/ui/SiteSettingsProvider'

const LS_MOTION = 'cms_motion_off_v1'
const LS_HIDE_CMS = 'cms_hide_controls_v1'

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
  const [open, setOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
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
  const panelRef = useRef<HTMLDivElement>(null)
  const gearRef = useRef<HTMLButtonElement>(null)
  const adminPanelRef = useRef<HTMLDivElement>(null)
  const adminGearRef = useRef<HTMLButtonElement>(null)

  // aplicar preferencias guardadas al montar (port de los init legacy)
  useEffect(() => {
    if (motionOff) applyMotionOff(true)
    if (hideCms) applyHideCms(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!open && !adminOpen) return
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (open && !(panelRef.current?.contains(t) || gearRef.current?.contains(t))) setOpen(false)
      if (adminOpen && !(adminPanelRef.current?.contains(t) || adminGearRef.current?.contains(t))) setAdminOpen(false)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [open, adminOpen])

  const toggleDark = (checked: boolean) => {
    setDark(checked)
    const theme = checked ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('theme', theme) } catch {}
  }


  return (
    <>
      {/* Tuerca general — visible para todos los usuarios */}
      <button ref={gearRef} id="settings-toggle" className="settings-gear" aria-label="Settings" onClick={() => { setOpen((o) => !o); setAdminOpen(false) }}>
        <i className="fa-solid fa-gear"></i>
      </button>
      <div ref={panelRef} id="settings-panel" className={`settings-panel${open ? '' : ' hidden'}`}>
        <h3>Settings</h3>
        <div className="setting-item">
          <span>Dark Mode</span>
          <label className="switch">
            <input type="checkbox" id="dark-mode-switch" checked={dark} onChange={(e) => toggleDark(e.target.checked)} suppressHydrationWarning />
            <span className="slider round"></span>
          </label>
        </div>
        <div className="setting-item">
          <span>Pausar animaciones</span>
          <label className="switch">
            <input
              type="checkbox" id="motion-switch" checked={motionOff} suppressHydrationWarning
              onChange={(e) => { setMotionOff(e.target.checked); applyMotionOff(e.target.checked) }}
            />
            <span className="slider round"></span>
          </label>
        </div>
        <div className="setting-item">
          <span>Language</span>
          <div className="lang-selector-settings" id="lang-selector-settings">
            <button className="lang-btn-settings" id="lang-toggle-settings" aria-label="Change language" onClick={() => setLangOpen((o) => !o)}>
              <span className={`fi fi-${activeLang.flag}`} id="lang-flag-settings"></span>
              <span className="lang-code" id="lang-code-settings">{state.lang.toUpperCase()}</span>
              <i className="fa-solid fa-chevron-down chev"></i>
            </button>
            <div className={`lang-dropdown-settings${langOpen ? ' active' : ''}`} id="lang-dropdown-settings">
              {ALL_LANGS.map((code) => (
                <button key={code} className="lang-option" data-lang={code} title={LANG_META[code].label} onClick={() => { setLanguage(code as Lang); setLangOpen(false) }}>
                  <span className={`fi fi-${LANG_META[code].flag}`}></span> {LANG_META[code].label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="setting-item">
          <span>Curriculum</span>
          <a
            className={`cv-min-btn${settings.cvUrl ? '' : ' is-disabled'}`}
            id="cv-download-settings" href={settings.cvUrl || undefined}
            download={settings.cvUrl ? settings.cvName || 'CV.pdf' : undefined}
            target={settings.cvUrl ? '_blank' : undefined} rel="noopener noreferrer"
            title={settings.cvUrl ? 'Download CV' : 'CV no disponible aún'}
            aria-disabled={!settings.cvUrl || undefined}
          >
            <i className="fa-solid fa-file-arrow-down"></i>
            <span>CV</span>
          </a>
        </div>
      </div>

      {/* Tuerca admin — solo logueado como admin. Lista settings exclusivos de admin.
          Por ahora: Hide Edit actions + Clear All Content (con el tiempo se suman más). */}
      {state.isAdmin && (
        <>
          <button
            ref={adminGearRef}
            id="admin-settings-toggle"
            className="settings-gear settings-gear--admin"
            aria-label="Admin settings"
            title="Admin settings"
            onClick={() => { setAdminOpen((o) => !o); setOpen(false) }}
          >
            <i className="fa-solid fa-user-gear"></i>
          </button>
          <div ref={adminPanelRef} id="admin-settings-panel" className={`settings-panel settings-panel--admin${adminOpen ? '' : ' hidden'}`}>
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
                title="Clear only the containers of the section currently in view (moves to unused)"
                onClick={() => setSectionClear(currentSectionInfo())}
              >
                <i className="fa-solid fa-eraser"></i>
                <span>Clear Section</span>
              </button>
            </div>
            <div className="setting-item">
              <span>Clear All Content</span>
              <button
                type="button"
                className="cv-btn cv-btn-settings"
                id="clear-content-btn"
                title="Clear all page content (moves to unused)"
                onClick={() => setShowClearConfirm(true)}
              >
                <i className="fa-solid fa-trash"></i>
                <span>Clear All</span>
              </button>
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
      {showClearConfirm && (
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

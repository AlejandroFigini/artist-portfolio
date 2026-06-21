'use client'

/* Settings (tuerca) — portado de shared-ui.js (SETTINGS) + index.html.
   Dark mode, pausa de animaciones (cms.js motion-off) y ocultar
   controles de edición (cms.js hide-cms) funcionales. */

import { useEffect, useRef, useState } from 'react'

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
  if (off) {
    document.querySelectorAll('video').forEach((v) => { try { v.pause() } catch {} })
    revealTypewriters()
    setTimeout(revealTypewriters, 60) // por si el observer aún no escribió un título
  }
  try { localStorage.setItem(LS_MOTION, off ? '1' : '0') } catch {}
}

function applyHideCms(hide: boolean) {
  document.body.classList.toggle('hide-cms-controls', hide)
  try { localStorage.setItem(LS_HIDE_CMS, hide ? '1' : '0') } catch {}
}

const LANGS = [
  { code: 'en', flag: 'us', label: 'English' },
  { code: 'es', flag: 'es', label: 'Español' },
  { code: 'pt', flag: 'pt', label: 'Português' },
  { code: 'fr', flag: 'fr', label: 'Français' },
]

export default function SettingsPanel() {
  const [open, setOpen] = useState(false)
  // lazy init: en SSR no hay window; en hidratación lee el tema que el boot
  // script ya aplicó (el suppressHydrationWarning del input cubre el diff)
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false
    try { return localStorage.getItem('theme') === 'dark' } catch { return false }
  })
  const [langOpen, setLangOpen] = useState(false)
  const [lang, setLang] = useState(LANGS[0])
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
  const panelRef = useRef<HTMLDivElement>(null)
  const gearRef = useRef<HTMLButtonElement>(null)

  // aplicar preferencias guardadas al montar (port de los init legacy)
  useEffect(() => {
    if (motionOff) applyMotionOff(true)
    if (hideCms) applyHideCms(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (panelRef.current?.contains(t) || gearRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [open])

  const toggleDark = (checked: boolean) => {
    setDark(checked)
    const theme = checked ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('theme', theme) } catch {}
  }

  return (
    <>
      <button ref={gearRef} id="settings-toggle" className="settings-gear" aria-label="Settings" onClick={() => setOpen((o) => !o)}>
        <i className="fa-solid fa-gear"></i>
      </button>
      <div ref={panelRef} id="settings-panel" className={`settings-panel${open ? '' : ' hidden'}`}>
        <h3>Settings</h3>
        <div className="setting-item admin-only">
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
              <span className={`fi fi-${lang.flag}`} id="lang-flag-settings"></span>
              <span className="lang-code" id="lang-code-settings">{lang.code.toUpperCase()}</span>
              <i className="fa-solid fa-chevron-down chev"></i>
            </button>
            <div className={`lang-dropdown-settings${langOpen ? ' active' : ''}`} id="lang-dropdown-settings">
              {LANGS.map((l) => (
                <button key={l.code} className="lang-option" data-lang={l.code} title={l.label} onClick={() => { setLang(l); setLangOpen(false) }}>
                  <span className={`fi fi-${l.flag}`}></span> {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="setting-item">
          <span>Curriculum</span>
          <button type="button" className="cv-btn cv-btn-settings" id="cv-download-settings" title="Download CV">
            <i className="fa-solid fa-file-arrow-down"></i>
            <span>Download CV</span>
          </button>
        </div>
      </div>
    </>
  )
}

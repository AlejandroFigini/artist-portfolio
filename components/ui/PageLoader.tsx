'use client'

/* Pantalla de carga del index — portada de script.js initPageLoader().
   Visitante: se muestra una vez por sesión (sessionStorage), mínimo 3s,
   failsafe 6s. El video de galope (.loader-gallop) es un contenedor CMS.
   Admin: queda visible y editable (no auto-oculta ni respeta el skip),
   se cierra con el botón ✕ — única vía para subir/reemplazar ese video. */

import { useEffect, useRef, useState } from 'react'
import { state, useCmsStore } from '@/lib/cms/store'
import { useSiteSettings } from '@/components/ui/SiteSettingsProvider'
import { loaderDurationMs } from '@/lib/settings'

const FADE_MS = 800

export default function PageLoader() {
  const [gone, setGone] = useState(false)
  const [adminDismissed, setAdminDismissed] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useCmsStore() // re-render cuando se activa/desactiva admin
  const { settings } = useSiteSettings()
  const admin = state.isAdmin
  const minDisplay = loaderDurationMs(settings.loaderDuration) // duración configurable
  const failsafe = minDisplay + 3000

  useEffect(() => {
    const loader = ref.current
    if (!loader) return

    let skip = false
    try {
      skip = sessionStorage.getItem('cms_skip_loader') === '1' || sessionStorage.getItem('lm_seen_loader') === '1'
      sessionStorage.removeItem('cms_skip_loader')
      sessionStorage.setItem('lm_seen_loader', '1')
    } catch {}
    if (skip) {
      document.body.classList.remove('loading-active')
      setGone(true)
      return
    }

    // Admin: mantener el loader montado y visible en la primera visita de
    // la sesión para poder editar el contenedor CMS.
    if (admin) {
      if (!adminDismissed) {
        document.body.classList.add('loading-active')
        loader.classList.remove('loader-hidden')
        setGone(false)
      }
      return () => { document.body.classList.remove('loading-active') }
    }

    // idempotente: cubre la navegación SPA a '/', donde el boot script no corre
    document.body.classList.add('loading-active')

    let hidden = false
    const start = Date.now()
    const timers: number[] = []
    const hide = () => {
      if (hidden) return
      hidden = true
      loader.classList.add('loader-hidden')
      document.body.classList.remove('loading-active')
      timers.push(window.setTimeout(() => setGone(true), FADE_MS))
    }
    const tryHide = () => {
      timers.push(window.setTimeout(hide, Math.max(0, minDisplay - (Date.now() - start))))
    }

    if (document.readyState === 'complete') tryHide()
    else window.addEventListener('load', tryHide)
    timers.push(window.setTimeout(hide, failsafe))

    return () => {
      window.removeEventListener('load', tryHide)
      timers.forEach(clearTimeout)
      document.body.classList.remove('loading-active')
    }
  }, [admin, adminDismissed, minDisplay, failsafe])

  if (gone) return null

  return (
    <>
      {/* body.loading-active lo agrega el boot script del layout (pre-paint) */}
      <div id="page-loader" className="page-loader" ref={ref}>
        {admin && (
          <button
            type="button"
            className="loader-admin-dismiss"
            aria-label="Cerrar pantalla de carga"
            title="Cerrar (solo admin)"
            onClick={() => { document.body.classList.remove('loading-active'); setAdminDismissed(true); setGone(true) }}
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        )}
        <div className="loader-stage">
          <div className="loader-media">
            {settings.loaderImage ? (
              /* imagen elegida en Ajustes → Pantalla de carga (clase propia para
                 no colisionar con el contenedor CMS .loader-gallop del engine) */
              /* eslint-disable-next-line @next/next/no-img-element */
              <img className="loader-still" src={settings.loaderImage} alt="" />
            ) : (
              /* contenedor CMS .loader-gallop — el admin sube/reemplaza el video acá */
              <video className="loader-gallop" autoPlay loop muted playsInline preload="auto"></video>
            )}
            <div className="loader-media-glow"></div>
          </div>
          <div className="loader-info">
            <h1 className="loader-title">Lucia Montaña <span>| Portfolio</span></h1>
            <p className="loader-subtitle">Animation &middot; Illustration &middot; 3D Art</p>
            <div className="loader-status">
              <span className="loader-orbit" aria-hidden="true">
                <span className="orbit-ring"></span>
                <span className="orbit-dot"></span>
              </span>
              <span className="loader-text">Loading<span className="loader-dots"><i>.</i><i>.</i><i>.</i></span></span>
            </div>
            <div className="loader-bar"><span className="loader-bar-fill"></span></div>
          </div>
        </div>
      </div>
    </>
  )
}

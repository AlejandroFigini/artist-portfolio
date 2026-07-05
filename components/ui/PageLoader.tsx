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
  const [minTimeElapsed, setMinTimeElapsed] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useCmsStore() // re-render cuando se activa/desactiva admin o cambia serverReady
  const { settings } = useSiteSettings()
  const admin = state.isAdmin
  const serverReady = state.serverReady
  const minDisplay = loaderDurationMs(settings.loaderDuration) // duración configurable
  const failsafe = minDisplay + 6000

  // 1. Escuchar cuando cambia el contenido en el servidor (ej: refrescar caché / nuevo contenido)
  useEffect(() => {
    const onContentChanged = () => {
      if (admin && adminDismissed) return // Si admin ya lo cerró en su sesión, no molestar
      try { sessionStorage.removeItem('lm_seen_loader') } catch {}
      setMinTimeElapsed(false)
      setGone(false)
      document.body.classList.add('loading-active')
      if (ref.current) ref.current.classList.remove('loader-hidden')
    }
    window.addEventListener('cms:contentChanged', onContentChanged)
    return () => window.removeEventListener('cms:contentChanged', onContentChanged)
  }, [admin, adminDismissed])

  // 2. Control del temporizador mínimo de visualización
  useEffect(() => {
    if (gone) return
    const timer = window.setTimeout(() => {
      setMinTimeElapsed(true)
    }, minDisplay)
    const failsafeTimer = window.setTimeout(() => {
      setMinTimeElapsed(true)
    }, failsafe)
    return () => {
      clearTimeout(timer)
      clearTimeout(failsafeTimer)
    }
  }, [gone, minDisplay, failsafe])

  // 3. Decidir cuándo ocultar el preloader (debe cumplirse tiempo mínimo + servidor listo)
  useEffect(() => {
    const loader = ref.current
    if (!loader || gone) return

    let skip = false
    try {
      skip = sessionStorage.getItem('cms_skip_loader') === '1' || sessionStorage.getItem('lm_seen_loader') === '1'
      sessionStorage.removeItem('cms_skip_loader')
    } catch {}

    // Si ya se vio en la sesión actual y el servidor ya está listo, saltar
    if (skip && serverReady && minTimeElapsed) {
      loader.classList.add('loader-hidden')
      document.body.classList.remove('loading-active')
      const t = window.setTimeout(() => setGone(true), FADE_MS)
      return () => clearTimeout(t)
    }

    if (skip && serverReady && !minTimeElapsed) {
      document.body.classList.remove('loading-active')
      setGone(true)
      return
    }

    // Admin: mantener visible para poder editar el video, hasta que lo cierre con la X
    if (admin) {
      if (!adminDismissed) {
        document.body.classList.add('loading-active')
        loader.classList.remove('loader-hidden')
      }
      return () => { if (adminDismissed) document.body.classList.remove('loading-active') }
    }

    // Si no se ha visto (o si se reactivó por nuevo contenido), esperar a que se cumpla minTimeElapsed Y serverReady
    document.body.classList.add('loading-active')

    if (minTimeElapsed && serverReady) {
      loader.classList.add('loader-hidden')
      document.body.classList.remove('loading-active')
      try { sessionStorage.setItem('lm_seen_loader', '1') } catch {}
      const t = window.setTimeout(() => setGone(true), FADE_MS)
      return () => clearTimeout(t)
    }
  }, [admin, adminDismissed, gone, minTimeElapsed, serverReady])

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

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
  const [gone, setGone] = useState(() => {
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      return true
    }
    return false
  })
  const [minTimeElapsed, setMinTimeElapsed] = useState(false)
  const [isPreview, setIsPreview] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useCmsStore() // re-render cuando se activa/desactiva admin o cambia serverReady
  const { settings } = useSiteSettings()
  const admin = state.isAdmin
  const serverReady = state.serverReady
  const minDisplay = loaderDurationMs(settings.loaderDuration) // duración configurable
  const failsafe = minDisplay + 6000

  // 1. Escuchar cuando se solicita vista previa de la pantalla de carga desde gestión
  useEffect(() => {
    const onPreviewLoader = () => {
      try { sessionStorage.removeItem('lm_seen_loader') } catch {}
      setIsPreview(true)
      setMinTimeElapsed(false)
      setGone(false)
      document.body.classList.add('loading-active')
      if (ref.current) ref.current.classList.remove('loader-hidden')
    }
    window.addEventListener('cms:previewLoader', onPreviewLoader)
    return () => window.removeEventListener('cms:previewLoader', onPreviewLoader)
  }, [])

  // 2. Control del temporizador mínimo de visualización
  useEffect(() => {
    if (gone || isPreview) return
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
  }, [gone, minDisplay, failsafe, isPreview])

  // 3. Decidir cuándo ocultar el preloader (debe cumplirse tiempo mínimo + servidor listo)
  useEffect(() => {
    const loader = ref.current
    if (!loader || gone || isPreview) return

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

    // Si no se ha visto (o si se reactivó por nuevo contenido), esperar a que se cumpla minTimeElapsed Y serverReady
    document.body.classList.add('loading-active')

    if (minTimeElapsed && serverReady) {
      loader.classList.add('loader-hidden')
      document.body.classList.remove('loading-active')
      try { sessionStorage.setItem('lm_seen_loader', '1') } catch {}
      const t = window.setTimeout(() => setGone(true), FADE_MS)
      return () => clearTimeout(t)
    }
  }, [gone, minTimeElapsed, serverReady, isPreview])

  if (gone) return null

  return (
    <>
      {isPreview && (
        <button
          type="button"
          className="loader-preview-close"
          onClick={() => {
            const loader = ref.current
            if (loader) loader.classList.add('loader-hidden')
            document.body.classList.remove('loading-active')
            setIsPreview(false)
            setTimeout(() => setGone(true), FADE_MS)
          }}
          aria-label="Cerrar vista previa"
        >
          <i className="fa-solid fa-xmark" />
        </button>
      )}
      {/* body.loading-active lo agrega el boot script del layout (pre-paint) */}
      <div id="page-loader" className="page-loader" ref={ref}>
        <div className="loader-stage">
          <div className="loader-media">
            <video
              data-cms-key="loader.gallop"
              className="loader-gallop"
              src={(state.items['loader.gallop'] !== undefined ? state.items['loader.gallop'] : settings.loaderVideo) || undefined}
              autoPlay loop muted playsInline preload="auto" fetchPriority="high"
            ></video>
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

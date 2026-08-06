'use client'

/* Pantalla de carga del index — portada de script.js initPageLoader().
   Visitante: se muestra una vez por sesión (sessionStorage). El cierre lo
   decide `lib/loader-ready`: el loader se va cuando el contenido crítico está
   realmente pintado (datos + fuentes + hero + chunks), no cuando vence un
   temporizador. La duración configurable pasa a ser el PISO estético y el
   failsafe el techo duro. El video de galope (.loader-gallop) es un contenedor
   CMS. Admin: queda visible y editable (no auto-oculta ni respeta el skip),
   se cierra con el botón ✕ — única vía para subir/reemplazar ese video. */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { state, useCmsStore, useUiText } from '@/lib/cms/store'
import { useSiteSettings } from '@/components/ui/SiteSettingsProvider'
import { loaderDurationMs } from '@/lib/settings'
import {
  loaderProgress,
  loaderProgressServer,
  markLoaderGate,
  startLoaderGateTimers,
  subscribeLoaderGates,
} from '@/lib/loader-ready'

const FADE_MS = 800
// Techo duro sobre el piso configurable: por encima del gate más lento (8s).
const FAILSAFE_MS = 9000

export default function PageLoader() {
  const ui = useUiText()
  const pathname = usePathname()
  const [gone, setGone] = useState(pathname !== '/')
  const [minTimeElapsed, setMinTimeElapsed] = useState(false)
  const [forced, setForced] = useState(false)
  const [isPreview, setIsPreview] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useCmsStore() // re-render cuando se activa/desactiva admin o cambia serverReady
  const { settings } = useSiteSettings()
  const serverReady = state.serverReady
  const minDisplay = loaderDurationMs(settings.loaderDuration) // piso configurable
  const failsafe = minDisplay + FAILSAFE_MS

  const progress = useSyncExternalStore(subscribeLoaderGates, loaderProgress, loaderProgressServer)
  const gatesReady = progress >= 1
  // Al cerrarse la barra se completa aunque el failsafe haya cortado antes.
  const shownProgress = forced || gatesReady ? 1 : progress

  /* Fuente del video, resuelta UNA vez.
     Los ajustes llegan async (EMPTY_SETTINGS → overrides locales → /api/site) y
     el store CMS se hidrata aparte, así que este valor cambiaba varias veces
     durante el arranque. Cada cambio de `src` en un <video> es una recarga, y
     eso era el parpadeo: la pantalla de carga dura pocos segundos y el video
     se reiniciaba en cada paso.
     Se engancha el primer valor no vacío y se mantiene; cambiarlo a mitad de
     la animación no aporta nada. La vista previa del admin sí lo reengancha,
     que es donde se quiere ver el archivo recién subido. */
  const resolvedSrc = (state.items['loader.gallop'] !== undefined ? state.items['loader.gallop'] : settings.loaderVideo) || ''
  const [videoSrc, setVideoSrc] = useState(resolvedSrc)
  if (resolvedSrc && resolvedSrc !== videoSrc && (!videoSrc || isPreview)) {
    // setState en render: patrón de estado derivado de React, no un efecto.
    setVideoSrc(resolvedSrc)
  }

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

  // 2. Piso estético (minDisplay) + techo duro (failsafe). El failsafe fuerza
  //    el cierre aunque queden gates abiertos: el sitio nunca queda tapado.
  useEffect(() => {
    if (gone || isPreview) return
    const timer = window.setTimeout(() => {
      setMinTimeElapsed(true)
    }, minDisplay)
    const failsafeTimer = window.setTimeout(() => {
      setMinTimeElapsed(true)
      setForced(true)
    }, failsafe)
    return () => {
      clearTimeout(timer)
      clearTimeout(failsafeTimer)
    }
  }, [gone, minDisplay, failsafe, isPreview])

  // 2b. Gates propios del loader. Los del contenido los marcan sus dueños
  //     (Slideshow, HeroMediaCarousel, HomeFx, CmsRoot).
  useEffect(() => {
    if (gone) return
    startLoaderGateTimers()
  }, [gone])

  useEffect(() => {
    if (serverReady) markLoaderGate('serverState')
  }, [serverReady])

  useEffect(() => {
    // Sin fuentes listas los títulos reflowean apenas se va el loader.
    if (!document.fonts) { markLoaderGate('fonts'); return }
    let alive = true
    const done = () => { if (alive) markLoaderGate('fonts') }
    document.fonts.ready.then(done, done)
    return () => { alive = false }
  }, [])

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

    // Primera vez en la sesión: esperar el piso de tiempo Y que todos los
    // gates de contenido hayan cerrado (o que el failsafe fuerce el cierre).
    document.body.classList.add('loading-active')

    if (forced || (minTimeElapsed && gatesReady)) {
      loader.classList.add('loader-hidden')
      document.body.classList.remove('loading-active')
      try { sessionStorage.setItem('lm_seen_loader', '1') } catch {}
      const t = window.setTimeout(() => setGone(true), FADE_MS)
      return () => clearTimeout(t)
    }
  }, [gone, minTimeElapsed, serverReady, gatesReady, forced, isPreview])

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
          aria-label={ui('close_preview')}
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
              src={videoSrc || undefined}
              autoPlay loop muted playsInline preload="auto"
            ></video>
            <div className="loader-media-glow"></div>
          </div>
          <div className="loader-info">
            <h1 className="loader-title">Lucia Montaña <span>| Portfolio</span></h1>
            <p className="loader-subtitle">{ui('loader_subtitle')}</p>
            <div className="loader-status">
              <span className="loader-orbit" aria-hidden="true">
                <span className="orbit-ring"></span>
                <span className="orbit-dot"></span>
              </span>
              <span className="loader-text">
                {ui('loading')}<span className="loader-dots"><i>.</i><i>.</i><i>.</i></span>
                {!isPreview && <span className="loader-pct">{Math.round(shownProgress * 100)}%</span>}
              </span>
            </div>
            {/* Vista previa del admin: no hay carga real que medir → shimmer */}
            <div
              className={`loader-bar${isPreview ? ' loader-bar--indeterminate' : ''}`}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={isPreview ? undefined : Math.round(shownProgress * 100)}
            >
              <span
                className="loader-bar-fill"
                style={isPreview ? undefined : { transform: `scaleX(${shownProgress})` }}
              ></span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

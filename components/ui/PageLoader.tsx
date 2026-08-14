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
import { CRITICAL_FONT_FAMILY } from '@/lib/fonts'
import {
  loaderProgress,
  loaderProgressServer,
  markLoaderGate,
  startLoaderGateTimers,
  subscribeLoaderGates,
} from '@/lib/loader-ready'
import { optimizedMediaSrc, attachMediaRetry } from '@/lib/utils'

const FADE_MS = 800
// Mínimo que la animación de carga se queda en pantalla una vez pintada.
const MIN_ON_SCREEN_MS = 400
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
  const videoRef = useRef<HTMLVideoElement>(null)
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

  /* Autoplay defensivo. El <video> se sirve sin `src` —los ajustes llegan
     async— así que el navegador evalúa el autoplay contra un elemento vacío y
     hay motores que no lo reintentan cuando la fuente aparece después. Se
     vuelve a pedir play en cada cambio de fuente y en cuanto hay datos. Si el
     navegador lo bloquea igual (modo de bajo consumo en iOS, o autoplay
     denegado para el sitio) la promesa se rechaza y se ignora: es una
     decisión del usuario, no un error que deba romper el arranque. */
  useEffect(() => {
    const v = videoRef.current
    if (!v || !videoSrc) return
    v.muted = true // el atributo se sirve en el HTML; la propiedad es la que evalúa play()
    // Retry si la derivada de Cloudinary (transcode) todavía no está lista → sin
    // video negro; fallback al original (videoSrc) si sigue fallando.
    attachMediaRetry(v, videoSrc)
    const tryPlay = () => { void v.play().catch(() => {}) }
    tryPlay()
    v.addEventListener('loadeddata', tryPlay)
    v.addEventListener('canplay', tryPlay)
    return () => {
      v.removeEventListener('loadeddata', tryPlay)
      v.removeEventListener('canplay', tryPlay)
    }
  }, [videoSrc])

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

  /* 2. Piso estético (minDisplay) + techo duro (failsafe). El failsafe fuerza
        el cierre aunque queden gates abiertos: el sitio nunca queda tapado.

        Los dos se cuentan desde el INICIO DE LA NAVEGACIÓN, no desde que corre
        este efecto. Este componente monta recién al hidratar, y en 4G lento eso
        pasa a los ~3.8s: el piso de 1.2s se convertía en "tapar el sitio hasta
        los 5s" y terminaba atando el cierre incluso después de que todos los
        gates estaban resueltos (medido: gates listos 4535ms, piso vencido
        4980ms). Cuanto más lenta la conexión más tarde arrancaba el reloj, o
        sea que el piso castigaba justo a quien ya venía sufriendo.

        `performance.now()` es el tiempo transcurrido desde navigationStart, así
        que restarlo da el semantic correcto: "el loader se ve al menos 1.2s de
        la vida de la página". En una conexión rápida el piso sigue actuando
        igual que antes.

        El segundo término evita el efecto colateral: el loader se pinta en el
        FCP, antes de hidratar, pero si el FCP llegara muy tarde y los gates
        resolvieran de golpe la animación podría durar dos frames. Se le
        garantiza un mínimo en pantalla contado desde que se pintó. */
  useEffect(() => {
    if (gone || isPreview) return
    const since = performance.now()
    const painted = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0
    const floor = Math.max(minDisplay - since, MIN_ON_SCREEN_MS - (since - painted), 0)
    const timer = window.setTimeout(() => {
      setMinTimeElapsed(true)
    }, floor)
    const failsafeTimer = window.setTimeout(() => {
      setMinTimeElapsed(true)
      setForced(true)
    }, Math.max(0, failsafe - since))
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

  /* Sin fuentes listas los títulos reflowean apenas se va el loader. Pero
     `document.fonts.ready` espera a TODAS las que arrancaron, y el sitio carga
     cuatro familias: Raleway (42 KB) y Fira Code (36 KB) son de detalle —
     cotas blueprint, badges— y no aparecen en el texto grande de arriba. En 4G
     lento terminaban a los ~4.5s y retenían el loader por un reflow que nadie
     iba a ver.

     Se espera solo a la familia del hero. `fonts.load()` resuelve cuando esa
     está lista; si el navegador no soporta la API o el shorthand falla, se
     libera el gate igual (fail-open: un gate colgado no puede tapar el sitio). */
  useEffect(() => {
    if (!document.fonts?.load) { markLoaderGate('fonts'); return }
    let alive = true
    const done = () => { if (alive) markLoaderGate('fonts') }
    try {
      document.fonts.load(`1rem ${CRITICAL_FONT_FAMILY}`).then(done, done)
    } catch {
      done()
    }
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
              ref={videoRef}
              data-cms-key="loader.gallop"
              className="loader-gallop"
              // f_auto/q_auto: sin esto Safari/iOS recibe el contenedor tal
              // cual se subió (típicamente webm, que nunca soportó) y el
              // video queda mudo — no es un bloqueo de autoplay, el navegador
              // no puede decodificarlo. Cloudinary sirve mp4/h264 a Safari y
              // webm al resto desde el mismo archivo. Este <video> es
              // React-controlled (no pasa por engine.ts), así que se aplica
              // acá aparte.
              src={optimizedMediaSrc(videoSrc) || undefined}
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

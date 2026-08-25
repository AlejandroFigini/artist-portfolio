'use client'

/* Pantalla de carga del index.

   Se muestra en TODA carga del index, recarga incluida. El único salto es
   volver desde gestión (`cms_skip_loader`, que consume el boot script del
   layout antes del primer paint).

   El cierre NO lo decide ningún reloj. Se va cuando se cumplen las dos cosas:
   - todos los gates de `lib/loader-ready` resueltos, incluido `windowLoad`
     (el evento del propio navegador: mientras no se dispara, el navegador
     sigue bajando la página y el loader no se puede ir);
   - el piso estético configurable, contado desde que el loader SE PINTÓ.

   No hay failsafe: cada gate cierra cuando su operación termina, bien o mal,
   así que un recurso roto libera igual. El video de galope (.loader-gallop) es
   un contenedor CMS, editable desde la tarjeta de Gestión (no desde acá). */

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
  subscribeLoaderGates,
  trackWindowLoad,
} from '@/lib/loader-ready'
import { optimizedMediaSrc, videoPosterSrc, attachMediaRetry, keepVideoMuted } from '@/lib/utils'

declare global {
  interface Window {
    /** Sello del boot script: ms de reloj en que el loader quedó pintado. */
    __loaderPaintedAt?: number
  }
}

const FADE_MS = 800
/* La barra tarda 0.45s (transición CSS) en llegar visualmente al 100%. Cerrar
   en el mismo frame en que resuelve el último gate haría que nunca se vea
   completarse. Es un retardo de pintado, no un techo de carga. */
const PRE_CLOSE_HOLD_MS = 450

function releaseScrollLock() {
  document.documentElement.classList.remove('loading-active')
  document.body.classList.remove('loading-active')
}

export default function PageLoader() {
  const ui = useUiText()
  const pathname = usePathname()
  const [gone, setGone] = useState(pathname !== '/')
  /* Mayor piso que ya se cumplió, en ms. No es un booleano a propósito: si la
     duración configurada llega tarde y es MAYOR que la que se estaba usando,
     un booleano ya latcheado la ignoraría — justo el caso que hace que el
     ajuste de Gestión no se respete. */
  const [floorSatisfiedMs, setFloorSatisfiedMs] = useState(0)
  const [isPreview, setIsPreview] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  /* Latch de cierre: una vez arrancado el fundido no se revierte. */
  const closingRef = useRef(false)
  /* Primer sello de pintado observado. Se congela: si se releyera en cada
     evaluación, una duración que llega tarde re-anclaría el piso al "ahora" y
     volvería a alargarse sola. */
  const paintedAtRef = useRef(0)
  useCmsStore() // re-render cuando se activa/desactiva admin o cambia serverReady
  const { settings } = useSiteSettings()
  const serverReady = state.serverReady
  const minDisplay = loaderDurationMs(settings.loaderDuration) // piso configurable

  const progress = useSyncExternalStore(subscribeLoaderGates, loaderProgress, loaderProgressServer)
  const canClose = progress >= 1 && floorSatisfiedMs >= minDisplay

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
    /* El HTML del server sale con `muted=""` pero React borra el atributo al
       hidratar, y iOS mira el atributo para decidir si permite el autoplay. */
    keepVideoMuted(v)
    // Retry si la derivada de Cloudinary (transcode) todavía no está lista → sin
    // video negro; fallback al original (videoSrc) si sigue fallando.
    attachMediaRetry(v, videoSrc)
    const tryPlay = () => { void v.play().catch(() => {}) }
    tryPlay()
    v.addEventListener('loadeddata', tryPlay)
    v.addEventListener('canplay', tryPlay)
    /* Último recurso: si el navegador denegó igual (bajo consumo en iOS), el
       primer toque en cualquier parte de la pantalla de carga lo arranca. Sin
       esto la animación se queda congelada en su primer frame toda la espera. */
    document.addEventListener('pointerdown', tryPlay, { once: true, passive: true })
    return () => {
      v.removeEventListener('loadeddata', tryPlay)
      v.removeEventListener('canplay', tryPlay)
      document.removeEventListener('pointerdown', tryPlay)
    }
  }, [videoSrc])

  // 1. Escuchar cuando se solicita vista previa de la pantalla de carga desde gestión
  useEffect(() => {
    const onPreviewLoader = () => {
      setIsPreview(true)
      closingRef.current = false
      setGone(false)
      document.documentElement.classList.add('loading-active')
      document.body.classList.add('loading-active')
      if (ref.current) ref.current.classList.remove('loader-hidden')
    }
    window.addEventListener('cms:previewLoader', onPreviewLoader)
    return () => window.removeEventListener('cms:previewLoader', onPreviewLoader)
  }, [])

  /* Red de seguridad del bloqueo de scroll: la clase la pone el boot script
     antes del primer paint y solo React la saca. Si este componente muriera
     por un error boundary o un Fast Refresh, el sitio quedaría sin scroll. */
  useEffect(() => releaseScrollLock, [])

  /* 2. Salto al volver de gestión: el boot script ya marcó <html class="skip-loader">
        y el CSS dejó el overlay en `display:none`, así que no hay nada que
        animar — solo desmontar. Se difiere un tick porque desmontar en el
        cuerpo del efecto encadena renders y acá no hay ninguna urgencia: el
        loader ya es invisible. */
  useEffect(() => {
    if (gone || isPreview) return
    if (!document.documentElement.classList.contains('skip-loader')) return
    releaseScrollLock()
    const t = window.setTimeout(() => setGone(true), 0)
    return () => clearTimeout(t)
  }, [gone, isPreview])

  /* 3. Piso estético, contado desde que el loader SE PINTÓ.

        Antes se contaba desde el inicio de la navegación y se evaluaba recién
        al hidratar: en 4G lento eso ocurre a los ~3.8s, o sea que un piso de
        1.2s daba negativo y la duración de Gestión no tenía ningún efecto. El
        sello lo deja el boot script con doble rAF (app/layout.tsx).

        Cadena de respaldo, de más exacta a más conservadora. Nunca puede
        devolver un momento ANTERIOR al pintado: acortar el piso es el bug que
        se está arreglando, alargarlo un poco solo se nota estéticamente.
        1. sello del boot script (doble rAF, exacto);
        2. entrada de Paint Timing (WebKit solo expone FCP, y recién desde
           Safari 14.1, así que es refuerzo y no fuente);
        3. con el documento a la vista pero sin ninguna de las dos: ahora. Sin
           este escalón, cualquier entorno donde rAF no corra dejaría el piso
           sin arrancar para siempre — y ya no hay failsafe que lo rescate.
        Oculto (pestaña de fondo, prerender) no hay nada que contar: nadie vio
        el loader. Se reintenta por rAF y por `visibilitychange`, que son
        eventos, no relojes.

        No se "latchea" el resultado: si la duración configurada llega tarde y
        es mayor, el efecto se re-arma y el piso vuelve a exigirse. */
  useEffect(() => {
    if (gone || isPreview) return
    let alive = true
    let timer = 0
    let raf = 0

    const evaluate = () => {
      if (!alive) return
      // Puede re-entrar por `visibilitychange` o por rAF: no acumular relojes.
      clearTimeout(timer)
      cancelAnimationFrame(raf)
      if (!paintedAtRef.current) {
        const stamped = window.__loaderPaintedAt
          || performance.getEntriesByName('first-contentful-paint')[0]?.startTime
          || 0
        if (stamped) paintedAtRef.current = stamped
        else if (document.visibilityState === 'hidden') { raf = requestAnimationFrame(evaluate); return }
        else paintedAtRef.current = performance.now()
      }
      const remaining = paintedAtRef.current + minDisplay - performance.now()
      timer = window.setTimeout(() => {
        if (alive) setFloorSatisfiedMs((prev) => Math.max(prev, minDisplay))
      }, Math.max(0, remaining))
    }
    evaluate()
    document.addEventListener('visibilitychange', evaluate)

    return () => {
      alive = false
      clearTimeout(timer)
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', evaluate)
    }
  }, [gone, isPreview, minDisplay])

  // 3b. Gate del navegador. Los del contenido los marcan sus dueños
  //     (Slideshow, HeroMediaCarousel, CmsRoot).
  useEffect(() => {
    if (gone) return
    return trackWindowLoad()
  }, [gone])

  useEffect(() => {
    if (serverReady) markLoaderGate('serverState')
  }, [serverReady])

  /* Sin fuentes listas los títulos reflowean apenas se va el loader. Pero
     `document.fonts.ready` espera a TODAS las que arrancaron, y el sitio carga
     cuatro familias: Raleway (42 KB) y Fira Code (36 KB) son de detalle —
     cotas blueprint, badges— y no aparecen en el texto grande de arriba.

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

  // 4. Cierre: una sola vía, y de ida — una vez arrancado no se revierte.
  useEffect(() => {
    if (gone || isPreview || closingRef.current || !canClose) return
    const loader = ref.current
    if (!loader) return
    closingRef.current = true
    const hold = window.setTimeout(() => {
      loader.classList.add('loader-hidden')
      releaseScrollLock()
    }, PRE_CLOSE_HOLD_MS)
    const fade = window.setTimeout(() => setGone(true), PRE_CLOSE_HOLD_MS + FADE_MS)
    return () => { clearTimeout(hold); clearTimeout(fade) }
  }, [gone, isPreview, canClose])

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
            releaseScrollLock()
            setIsPreview(false)
            setTimeout(() => setGone(true), FADE_MS)
          }}
          aria-label={ui('close_preview')}
        >
          <i className="fa-solid fa-xmark" />
        </button>
      )}
      {/* body.loading-active lo agrega el boot script del layout (pre-paint) */}
      <div id="page-loader" className="page-loader" ref={ref} aria-busy="true">
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
              /* El <src> llega recién al hidratar y desde ahí hay que descargar
                 y decodificar: sin póster el recuadro se ve NEGRO ese rato, que
                 es justo el arranque del sitio. El póster es una imagen chica y
                 se pinta enseguida. */
              poster={videoPosterSrc(videoSrc) || undefined}
              /* `metadata`, NO `auto`: un <video> con `auto` retiene el evento
                 `load` del documento hasta tener el primer frame decodificado.
                 Como ahora el loader ESPERA ese evento, con `auto` se quedaba
                 esperándose a sí mismo — y `attachMediaRetry` re-arma esa
                 retención en cada reintento. Con `metadata` el navegador
                 suelta el evento apenas tiene la cabecera; el autoplay sigue
                 bajando lo que necesita para reproducir. */
              autoPlay loop muted playsInline preload="metadata"
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
                {!isPreview && <span className="loader-pct">{Math.round(progress * 100)}%</span>}
              </span>
            </div>
            {/* Vista previa del admin: no hay carga real que medir → shimmer */}
            <div
              className={`loader-bar${isPreview ? ' loader-bar--indeterminate' : ''}`}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={isPreview ? undefined : Math.round(progress * 100)}
            >
              <span
                className="loader-bar-fill"
                style={isPreview ? undefined : { transform: `scaleX(${progress})` }}
              ></span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

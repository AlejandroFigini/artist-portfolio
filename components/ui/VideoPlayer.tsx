'use client'

/* Reproductor con controles propios (estética blueprint): play/pause + barra de
   avance. Sin `controls` nativos → desaparecen el botón de volumen y el menú de
   3 puntos del navegador. Ref visual: controles minimal tipo Vimeo, teñidos con
   el violeta del sitio.

   El estado se deriva de los EVENTOS del <video>, nunca de las llamadas
   propias: así el control imperativo externo (lightbox.ts hace .play()/.pause()
   sobre #lightbox-video) queda en sync sin acoplar los dos módulos. */

import { useCallback, useEffect, useRef, useState } from 'react'

export type VideoPlayerLabels = { play: string; pause: string; seek: string }

const DEFAULT_LABELS: VideoPlayerLabels = { play: 'Play', pause: 'Pause', seek: 'Seek' }

/* Los mismos que vigila ViewportGate: `loadeddata` es el que corresponde, pero
   un video que ya venía decodificado no lo vuelve a emitir, y `emptied`/`error`
   tienen que poder APAGAR la marca cuando el consumidor cambia la fuente. */
const FRAME_EVENTS = ['loadeddata', 'canplay', 'playing', 'emptied', 'error'] as const

function formatTime(t: number) {
  if (!Number.isFinite(t) || t <= 0) return '0:00'
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export type VideoPlayerProps = {
  /** Opcional: el lightbox global asigna el src imperativamente. */
  src?: string
  poster?: string
  /** Id del <video> — lo usa el lightbox global para engancharse. */
  videoId?: string
  /** Clase del CONTENEDOR: hereda el encuadre del sitio (ej. `lightbox-content`). */
  className?: string
  style?: React.CSSProperties
  autoPlay?: boolean
  loop?: boolean
  muted?: boolean
  playsInline?: boolean
  preload?: 'none' | 'metadata' | 'auto'
  /** Textos accesibles. El sitio pasa los traducidos; el admin usa los de acá (inglés). */
  labels?: VideoPlayerLabels
}

export default function VideoPlayer({
  src,
  poster,
  videoId,
  className = '',
  style,
  autoPlay,
  loop,
  muted,
  playsInline = true,
  preload,
  labels = DEFAULT_LABELS,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [ratio, setRatio] = useState('')

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onTime = () => setTime(v.currentTime)
    const onMeta = () => {
      setDuration(Number.isFinite(v.duration) ? v.duration : 0)
      if (v.videoWidth && v.videoHeight) setRatio(`${v.videoWidth} / ${v.videoHeight}`)
    }
    /* `has-frame` propia. ViewportGate también la pone, pero descubre los nodos
       nuevos por MutationObserver coalescido en un rAF: este reproductor lo
       monta un portal recién al abrirlo, y en móvil ese frame puede tardar
       cientos de ms (medidos 757–2006 ms en el arranque). Hasta entonces la
       regla `html.video-frame-gate ... :not(.has-frame)` lo dejaba invisible —
       era el segundo de espera al abrir una animación. Acá se resuelve por
       ESTADO (`readyState`) en el mismo montaje, sin esperar ningún frame. */
    const syncFrame = () => v.classList.toggle('has-frame', v.readyState >= 2)
    // `emptied` = el consumidor vació el src (cierre del lightbox): resetear o
    // la barra queda mostrando el avance del clip anterior.
    const onEmptied = () => { setPlaying(false); setTime(0); setDuration(0); syncFrame() }
    FRAME_EVENTS.forEach((ev) => v.addEventListener(ev, syncFrame))
    syncFrame()
    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    v.addEventListener('ended', onPause)
    v.addEventListener('timeupdate', onTime)
    v.addEventListener('loadedmetadata', onMeta)
    v.addEventListener('durationchange', onMeta)
    v.addEventListener('emptied', onEmptied)
    // Estado inicial: con SSR o src imperativo el vídeo puede llegar ya cargado
    // y esos eventos no vuelven a dispararse.
    if (v.readyState >= 1) onMeta()
    setPlaying(!v.paused && !v.ended)
    return () => {
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
      v.removeEventListener('ended', onPause)
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('loadedmetadata', onMeta)
      v.removeEventListener('durationchange', onMeta)
      v.removeEventListener('emptied', onEmptied)
      FRAME_EVENTS.forEach((ev) => v.removeEventListener(ev, syncFrame))
    }
  }, [])

  /* React escribe `muted` como PROPIEDAD, después de insertar el nodo: al
     evaluar el atributo `autoplay` el vídeo todavía no está silenciado y la
     política de autoplay lo bloquea. Se reintenta al montar, ya con muted. */
  useEffect(() => {
    const v = videoRef.current
    if (!v || !autoPlay) return
    v.muted = !!muted
    if (v.paused) v.play().catch(() => {})
  }, [autoPlay, muted, src])

  const toggle = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play().catch(() => {})
    else v.pause()
  }, [])

  const seek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current
    if (!v) return
    const next = Number(e.target.value)
    v.currentTime = next
    setTime(next)
  }, [])

  const progress = duration > 0 ? Math.min(100, (time / duration) * 100) : 0

  return (
    <div
      className={`cvp ${className}`.trim()}
      style={{ ...style, ...(ratio ? ({ '--cvp-ar': ratio } as React.CSSProperties) : null) }}
      /* El lightbox cierra al click en el fondo: los controles no son fondo. */
      onClick={(e) => e.stopPropagation()}
    >
      <video
        ref={videoRef}
        id={videoId}
        className="cvp__video"
        src={src}
        poster={poster}
        autoPlay={autoPlay}
        loop={loop}
        muted={muted}
        playsInline={playsInline}
        preload={preload}
        onClick={toggle}
      />
      <div className="cvp__bar">
        <button type="button" className="cvp__btn" onClick={toggle} aria-label={playing ? labels.pause : labels.play}>
          <i className={`fa-solid ${playing ? 'fa-pause' : 'fa-play'}`} aria-hidden="true" />
        </button>
        <input
          type="range"
          className="cvp__seek"
          min={0}
          max={duration || 0}
          step={0.01}
          value={time}
          onChange={seek}
          aria-label={labels.seek}
          style={{ '--cvp-p': `${progress}%` } as React.CSSProperties}
        />
        <span className="cvp__time">{formatTime(time)} / {formatTime(duration)}</span>
      </div>
    </div>
  )
}

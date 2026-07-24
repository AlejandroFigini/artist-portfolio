'use client'

/* MODELS SHOWCASE (3D) — texto (izq) + coverflow 3D scoped (der).
   Ref. visual: coverflow / cover-stack tipo Awwwards — card central al frente,
   laterales inclinados con rotateY (profundidad). A diferencia del CircularGallery
   scroll-driven, este es scoped a la sección: navega por prev/next + drag +
   autoplay, NO secuestra el scroll de la página.

   CMS: los textos (nombre de sección, intro, 3 bloques) y los 3 videos usan el
   sistema de subida estándar del sitio (engine.ts → REGISTRY model3d.*). Los
   contenedores son estáticos; el engine los muta imperativamente. */

import { useEffect, useRef, useState, useCallback } from 'react'
import { ensureGSAP, gsap, ScrollTrigger, prefersReducedMotion, typewriterRevealLoop, wordRevealLoop, type LoopHandle } from '@/hooks/useGSAP'
import SoftwareDropdown from '@/components/home/SoftwareDropdown'
const SLIDE_COUNT = 4
const GALLERY_COUNT = 5
const AUTOPLAY_MS = 5000

/* Bloques de texto (3). Contenido por defecto, editable desde el CMS. */
const TEXT_BLOCKS: { title: string; body: string }[] = [
  {
    title: 'Process',
    body: 'From concept to final model: shape blocking, sculpting, retopology, UVs, and texturing. Every piece is built with clean topology and production-ready materials.',
  },
  {
    title: 'Approach',
    body: 'Characters, props, and environments focused on silhouette, proportion, and volume readability. Aesthetics drive the technique — not the other way around.',
  },
  {
    title: 'Tools',
    body: 'Blender and ZBrush for modeling and sculpting; Substance for PBR texturing; rendering and lookdev to integrate each model into its scene.',
  },
]

function Corners() {
  return (
    <>
      <span className="bp-corner tl" />
      <span className="bp-corner tr" />
      <span className="bp-corner bl" />
      <span className="bp-corner br" />
    </>
  )
}

/* Posición circular de una slide respecto a la activa (rango -1..0..1 para 3). */
function relOffset(i: number, active: number, n: number) {
  let off = i - active
  if (off > n / 2) off -= n
  if (off < -n / 2) off += n
  return off
}

function slideStyle(off: number): React.CSSProperties {
  const abs = Math.abs(off)
  // abs >= 2 lo manda al centro profundo para que no cruce la pantalla visiblemente al reordenarse
  const translateX = abs >= 2 ? 0 : off * 50
  const rotateY = abs >= 2 ? 0 : off * -30
  const translateZ = abs === 0 ? 0 : abs === 1 ? -180 : -400
  const scale = abs === 0 ? 1 : abs === 1 ? 0.78 : 0.5
  const opacity = abs === 0 ? 1 : abs === 1 ? 0.5 : 0
  return {
    transform: `translate(-50%, -50%) translateX(${translateX}%) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
    opacity,
    zIndex: 10 - abs,
    pointerEvents: abs === 0 ? 'auto' : 'none',
  }
}

/* Slide = contenedor de video CMS. Observa el src para alternar placeholder y
   reproduce solo cuando es la slide activa (perf). */
function Slide({ index, isActive, off }: { index: number; isActive: boolean; off: number }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasContent, setHasContent] = useState(false)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const sync = () => {
      const srcEl = v.querySelector('source')
      const srcVal = v.getAttribute('src') || (srcEl && srcEl.getAttribute('src'))
      const has = !!srcVal
      setHasContent(has)
      if (has) { try { v.pause(); v.currentTime = 0 } catch {} }
    }
    sync()
    const mo = new MutationObserver(sync)
    mo.observe(v, { attributes: true, attributeFilter: ['src'] })
    v.addEventListener('loadeddata', sync)
    return () => { mo.disconnect(); v.removeEventListener('loadeddata', sync) }
  }, [])

  useEffect(() => {
    const v = videoRef.current
    if (!v || !hasContent) return
    if (isActive) { v.play().catch(() => {}) }
    else { v.pause() }
  }, [isActive, hasContent])

  return (
    <figure className="m3d-slide" style={slideStyle(off)} aria-hidden={!isActive}>
      <Corners />
      <div className="m3d-slide__media">
        <video
          ref={videoRef}
          className="m3d-video"
          muted
          loop
          playsInline
          preload="metadata"
        />
        {!hasContent && (
          <div className="m3d-slide__placeholder" aria-hidden="true">
            <i className="fa-solid fa-cube" />
            <span className="m3d-slide__fig">FIG. 05{String.fromCharCode(97 + index)}</span>
          </div>
        )}
      </div>
    </figure>
  )
}

function Coverflow() {
  const [active, setActive] = useState(0)
  const stageRef = useRef<HTMLDivElement>(null)
  const hoverRef = useRef(false)
  const dragRef = useRef<{ x: number; active: boolean }>({ x: 0, active: false })

  const go = useCallback((dir: number) => {
    setActive((a) => (a + dir + SLIDE_COUNT) % SLIDE_COUNT)
  }, [])

  // Autoplay — pausa en hover, fuera de viewport o con reduced-motion.
  useEffect(() => {
    if (prefersReducedMotion()) return
    const stage = stageRef.current
    let inView = true
    const io = stage
      ? new IntersectionObserver((e) => { inView = e[0].isIntersecting }, { threshold: 0.2 })
      : null
    if (stage && io) io.observe(stage)
    const id = setInterval(() => {
      if (!hoverRef.current && inView && !dragRef.current.active) go(1)
    }, AUTOPLAY_MS)
    return () => { clearInterval(id); io?.disconnect() }
  }, [go])

  // Drag horizontal → cambia slide.
  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { x: e.clientX, active: true }
  }
  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return
    const dx = e.clientX - dragRef.current.x
    dragRef.current.active = false
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
  }

  return (
    <div className="m3d-coverflow">
      <div
        ref={stageRef}
        className="m3d-coverflow__stage"
        onMouseEnter={() => { hoverRef.current = true }}
        onMouseLeave={() => { hoverRef.current = false }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {Array.from({ length: SLIDE_COUNT }, (_, i) => {
          const off = relOffset(i, active, SLIDE_COUNT)
          return <Slide key={i} index={i} off={off} isActive={off === 0} />
        })}
      </div>

      <div className="m3d-coverflow__controls">
        <button type="button" className="m3d-nav" onClick={() => go(-1)} aria-label="Anterior">
          <i className="fa-solid fa-chevron-left" />
        </button>
        <div className="m3d-dots" role="tablist" aria-label="Modelados 3D">
          {Array.from({ length: SLIDE_COUNT }, (_, i) => (
            <button
              key={i}
              type="button"
              className={`m3d-dot${i === active ? ' is-active' : ''}`}
              onClick={() => setActive(i)}
              aria-label={`Ver modelado ${i + 1}`}
              aria-selected={i === active}
              role="tab"
            />
          ))}
        </div>
        <button type="button" className="m3d-nav" onClick={() => go(1)} aria-label="Siguiente">
          <i className="fa-solid fa-chevron-right" />
        </button>
      </div>
    </div>
  )
}

/* Galería de renders 3D — cinta de correr infinita: 2 copias idénticas de las
   celdas; un loop JS (rAF) desplaza el track con transform y permite arrastrar
   (press + drag), retomando el auto-scroll al soltar. Loop seamless (nunca se
   detiene). Cada celda comparte data-cms-key entre copias → el motor CMS
   actualiza todas las instancias (mismo patrón que el wave del hero; evita los
   clones imperativos de embla que rompen la mutación del CMS). */
function galleryCells(copy: number) {
  return Array.from({ length: GALLERY_COUNT }, (_, i) => (
    <div
      key={`${copy}-${i}`}
      className={`m3d-gallery-cell${copy > 0 ? ' m3d-gallery-cell--clone' : ''}`}
      aria-hidden={copy > 0 || undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="m3d-gallery__img" data-cms-key={`model3d.gallery#${i}`} alt="" draggable={false} loading="lazy" decoding="async" />
    </div>
  ))
}

const DRAG_THRESHOLD = 5   // px antes de considerar arrastre (deja pasar los clicks)
const AUTO_SPEED = 0.045   // px/ms (~45px/s) de desplazamiento automático

function GalleryStrip() {
  const galleryRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const offsetRef = useRef(0)
  const halfRef = useRef(0)              // ancho de una copia (punto de wrap)
  const pointerDownRef = useRef(false)
  const draggingRef = useRef(false)
  const justDraggedRef = useRef(false)
  const startXRef = useRef(0)
  const lastXRef = useRef(0)
  const inViewRef = useRef(false)

  // Reposiciona el offset dentro de [-half, 0] → loop infinito sin salto (2 copias).
  const wrap = useCallback(() => {
    const half = halfRef.current
    if (half <= 0) return
    while (offsetRef.current <= -half) offsetRef.current += half
    while (offsetRef.current > 0) offsetRef.current -= half
  }, [])

  useEffect(() => {
    const track = trackRef.current
    const gallery = galleryRef.current
    if (!track || !gallery) return
    const measure = () => { halfRef.current = track.scrollWidth / 2; wrap() }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(track)

    const reduce = prefersReducedMotion()
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = now - last
      last = now
      // Auto-scroll salvo mientras se arrastra (al soltar, vuelve a arrancar).
      if (!draggingRef.current && !reduce) {
        offsetRef.current -= AUTO_SPEED * dt
        wrap()
      }
      track.style.transform = `translate3d(${offsetRef.current}px, 0, 0)`
      // No animar fuera de viewport (perf); se reanuda al volver a verse.
      if (!inViewRef.current && !draggingRef.current) { raf = 0; return }
      raf = requestAnimationFrame(tick)
    }
    const start = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick) } }
    const io = new IntersectionObserver(([e]) => {
      inViewRef.current = e.isIntersecting
      if (e.isIntersecting) start()
    })
    io.observe(gallery)
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect() }
  }, [wrap])

  const onPointerDown = (e: React.PointerEvent) => {
    pointerDownRef.current = true
    startXRef.current = e.clientX
    lastXRef.current = e.clientX
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointerDownRef.current) return
    if (!draggingRef.current) {
      if (Math.abs(e.clientX - startXRef.current) < DRAG_THRESHOLD) return
      draggingRef.current = true
      lastXRef.current = e.clientX
      galleryRef.current?.classList.add('is-dragging')
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch {}
      return
    }
    const dx = e.clientX - lastXRef.current
    lastXRef.current = e.clientX
    offsetRef.current += dx
    wrap()
  }
  const endDrag = (e: React.PointerEvent) => {
    pointerDownRef.current = false
    if (!draggingRef.current) return
    draggingRef.current = false
    justDraggedRef.current = true     // suprime el click posterior al arrastre
    galleryRef.current?.classList.remove('is-dragging')
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch {}
  }
  // Un arrastre no debe disparar el picker de subida del CMS (click en overlay/gear).
  const onClickCapture = (e: React.MouseEvent) => {
    if (justDraggedRef.current) { e.stopPropagation(); e.preventDefault(); justDraggedRef.current = false }
  }

  return (
    <div
      className="m3d-gallery"
      ref={galleryRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClickCapture={onClickCapture}
    >
      <div className="m3d-gallery__track" ref={trackRef}>
        {galleryCells(0)}
        {galleryCells(1)}
      </div>
    </div>
  )
}

export default function ModelsShowcase() {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (prefersReducedMotion()) return
    ensureGSAP()
    const sec = sectionRef.current
    if (!sec) return

    let titleTw: LoopHandle | null = null
    let descTw: LoopHandle | null = null

    const ctx = gsap.context(() => {
      gsap.set('.m3d-showcase__fig', { autoAlpha: 0, y: 12 })
      gsap.set('.m3d-showcase__title', { autoAlpha: 0 })
      gsap.set('.m3d-showcase__desc', { autoAlpha: 0, y: 18 })
      gsap.set('.m3d-text', { autoAlpha: 0, y: 24 })
      gsap.set('.m3d-gallery', { autoAlpha: 0, y: 36 })
      gsap.set('.m3d-coverflow', { autoAlpha: 0, y: 36 })

      // fig + desc fade-up; el título entra letra por letra (typewriterRevealLoop).
      const tl = gsap.timeline({ defaults: { ease: 'power4.out' }, paused: true })
      tl.to('.m3d-showcase__fig', { autoAlpha: 1, y: 0, duration: 0.4 }, 0)
        .to('.m3d-showcase__desc', { autoAlpha: 1, y: 0, duration: 0.7 }, 0.45)
        .to('.m3d-text', { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.12 }, '-=0.4')
        .to('.m3d-gallery', { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out' }, '-=0.55')
        .to('.m3d-coverflow', { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out' }, '-=0.55')

      let played = false
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !played) {
            played = true
            tl.play()
            io.disconnect()
            const titleEl = sec.querySelector<HTMLElement>('.m3d-showcase__title')
            const descEl = sec.querySelector<HTMLElement>('.m3d-showcase__desc')
            if (titleEl) titleTw = typewriterRevealLoop(titleEl, 8)
            if (descEl) descTw = wordRevealLoop(descEl, 8)
          }
        }
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 })
      io.observe(sec)

      gsap.set('.m3d-showcase__rail-fill', { scaleY: 0, transformOrigin: 'top center' })
      gsap.to('.m3d-showcase__rail-fill', {
        scaleY: 1, ease: 'none',
        scrollTrigger: { trigger: sec, start: 'top 70%', end: 'bottom 50%', scrub: 0.6 },
      })

      ScrollTrigger.refresh()
    }, sectionRef)
    return () => { titleTw?.kill(); descTw?.kill(); ctx.revert() }
  }, [])

  return (
    <section ref={sectionRef} className="m3d-showcase" aria-labelledby="m3d-showcase-title">
      <div className="m3d-showcase__rail" aria-hidden="true">
        <span className="m3d-showcase__rail-fig">FILE 05 · 3D</span>
        <span className="m3d-showcase__rail-track">
          <span className="m3d-showcase__rail-fill" />
        </span>
        <span className="m3d-showcase__rail-fig m3d-showcase__rail-fig--end">END</span>
      </div>

      <div className="m3d-showcase__frame">
        <div className="m3d-showcase__header">
          <span className="m3d-showcase__fig">FIG. 05 — Models</span>
          <h2 id="m3d-showcase-title" className="m3d-showcase__title">3D</h2>
          <p className="m3d-showcase__desc">
            Digital modeling and sculpting — characters, props, and environments
            built with a focus on form, topology, and production-ready materials.
          </p>
          <SoftwareDropdown prefix="model3d" count={4} />
        </div>

        <div className="m3d-grid">
          <div className="m3d-texts">
            {TEXT_BLOCKS.map((b, i) => (
              <article key={i} className="m3d-text">
                <h3 className="m3d-text__title">{b.title}</h3>
                <p className="m3d-text__body">{b.body}</p>
              </article>
            ))}
          </div>

          <div className="m3d-media">
            <GalleryStrip />
            <Coverflow />
          </div>
        </div>
      </div>
    </section>
  )
}

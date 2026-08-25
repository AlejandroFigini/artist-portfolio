'use client'

/* Hero — coreografía de entrada GSAP (line-mask reveal tipo Lusion/
   Locomotive en Awwwards) + instrumentación blueprint: cota que se
   dibuja, marcos de registro FIG., scanline y rig de profundidad con
   el mouse. Los estados iniciales los setea GSAP dentro del effect:
   sin JS o con prefers-reduced-motion todo queda visible.
   El slideshow de fondo vive en Slideshow.tsx. */

import { useEffect, useRef } from 'react'
import WaveMarquee from './WaveMarquee'
import HeroMediaCarousel from './HeroMediaCarousel'
import { useCmsStore, state } from '@/lib/cms/store'
import { useMotionReady, prefersReducedMotion } from '@/hooks/useGSAP'
import { whenLoaderDone } from '@/lib/loader-ready'

const openCarousel = (prefix: string) =>
  window.dispatchEvent(new CustomEvent('cms:carouselManager', { detail: { prefix } }))

const MEASURE_LABEL = 'W // 12-COL · REV.03'

function Corners() {
  return (
    <>
      <span className="bp-corner tl"></span>
      <span className="bp-corner tr"></span>
      <span className="bp-corner bl"></span>
      <span className="bp-corner br"></span>
    </>
  )
}

export default function Hero() {
  const motion = useMotionReady() // GSAP llega en su propio chunk
  const sectionRef = useRef<HTMLElement>(null)
  useCmsStore() // re-render al cambiar admin (muestra/oculta los engranajes)
  const isAdmin = state.isAdmin

  // Coreografía de entrada + parallax de scroll
  useEffect(() => {
    if (prefersReducedMotion()) return
    if (!motion) return
    const { gsap } = motion
    const sec = sectionRef.current
    if (!sec) return

    const ctx = gsap.context(() => {
      // parallax del media principal al scrollear (port de script.js)
      const mediaEl = sec.querySelector('.hero-primary .cms-media') || sec.querySelector('.hero-primary .hero-slide-panel') || sec.querySelector('.hero-primary')
      if (mediaEl) {
        gsap.to(mediaEl, {
          yPercent: 15,
          ease: 'none',
          scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom top', scrub: true },
        })
      }

      const tl = gsap.timeline({ paused: true, defaults: { ease: 'power4.out' } })

      /* Estados iniciales (solo cuando la animación va a correr).
         Badge, título y subtítulo NO están acá: su entrada vive en CSS
         (styles/hero.css). El subtítulo es el elemento LCP y atarlo a esta
         timeline lo hacía esperar el chunk de GSAP. */
      gsap.set('.bp-line-h', { strokeDasharray: 600, strokeDashoffset: 600 })
      gsap.set('.bp-measure-label, .bp-fig, .bp-tick', { autoAlpha: 0 })
      gsap.set('.hero-media-wrapper .media-container', { autoAlpha: 0, scale: 1.04 })
      gsap.set('.bp-corner', { autoAlpha: 0, scale: 0.4 })
      gsap.set('.hero-software-wave', { autoAlpha: 0, y: 24 })

      /* Offsets ABSOLUTOS a propósito. Antes venían encadenados con '-=x'
         relativo al fin de la timeline, y ese fin lo marcaban el badge y el
         título: al sacarlos, cada '-=x' se habría corrido hacia el cero y toda
         la instrumentación blueprint habría entrado antes de tiempo. Estos
         números son los que esas restas ya daban (título terminaba en 1.76,
         .hero-secondary en 2.4), así que el resultado visual no cambia. */
      tl.to('.bp-line-h', { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut' }, 1.06)
        .to('.bp-tick', { autoAlpha: 1, duration: 0.3 }, 1.71)
        .to('.bp-measure-label', { autoAlpha: 1, duration: 0.5 }, 1.71)
        // media: entrada delicada con fade in + micro-zoom suave
        .to('.hero-primary', { autoAlpha: 1, scale: 1, duration: 1.8, ease: 'power2.out' }, 0.4)
        .to('.hero-secondary', { autoAlpha: 1, scale: 1, duration: 1.8, ease: 'power2.out' }, 0.6)
        .to('.bp-corner', { autoAlpha: 1, scale: 1, duration: 0.45, stagger: 0.045, ease: 'power3.out' }, 1.5)
        .to('.bp-fig', { autoAlpha: 0.85, duration: 0.5 }, 1.9)
        .to('.hero-software-wave', { autoAlpha: 1, y: 0, duration: 0.9 }, 1.7)

      const cancelWait = whenLoaderDone(() => tl.play())
      return () => cancelWait()
    }, sectionRef)
    return () => ctx.revert()
  }, [motion])

  // Rig de profundidad: los planos responden al mouse (solo puntero fino)
  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    if (!fine || prefersReducedMotion()) return
    if (!motion) return
    const { gsap } = motion
    const section = sectionRef.current
    const rig = section?.querySelector('.hero-media-wrapper')
    if (!section || !rig) return

    const rx = gsap.quickTo(rig, 'rotationY', { duration: 0.9, ease: 'power3.out' })
    const ry = gsap.quickTo(rig, 'rotationX', { duration: 0.9, ease: 'power3.out' })
    const mx = gsap.quickTo(rig, 'x', { duration: 1.1, ease: 'power3.out' })
    const my = gsap.quickTo(rig, 'y', { duration: 1.1, ease: 'power3.out' })

    const onMove = (e: MouseEvent) => {
      const r = section.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width - 0.5
      const py = (e.clientY - r.top) / r.height - 0.5
      rx(px * 5)
      ry(-py * 4)
      mx(px * 14)
      my(py * 10)
    }
    const onLeave = () => { rx(0); ry(0); mx(0); my(0) }
    section.addEventListener('mousemove', onMove)
    section.addEventListener('mouseleave', onLeave)
    return () => {
      section.removeEventListener('mousemove', onMove)
      section.removeEventListener('mouseleave', onLeave)
      gsap.killTweensOf(rig)
    }
  }, [motion])

  // Reveal sutil del título cada ~9s: cada letra hace fade + desenfoque en
  // su lugar (chars en spans inline-block → sin reflow, el texto no se mueve).
  // Arranca tras el reveal inicial; re-lee el texto ya hidratado por CMS.
  useEffect(() => {
    if (prefersReducedMotion()) return
    const title = sectionRef.current?.querySelector('.hero-title')
    if (!title) return
    const lines = Array.from(title.querySelectorAll<HTMLElement>('.line'))
    if (!lines.length) return

    let intervalId: ReturnType<typeof setInterval> | undefined
    let hintTimer: ReturnType<typeof setTimeout> | undefined
    let charIndex = 0
    let chars: HTMLElement[] = []

    const splitLine = (line: HTMLElement): HTMLElement[] => {
      const text = line.textContent || ''
      line.textContent = ''
      return [...text].map((ch) => {
        const s = document.createElement('span')
        s.className = 'hero-char'
        s.style.animationDelay = `${charIndex++ * 0.045}s`
        s.textContent = ch === ' ' ? ' ' : ch
        s.style.display = 'inline-block'
        line.appendChild(s)
        return s
      })
    }

    /* `will-change` promueve cada letra a su propia capa de GPU y la MANTIENE
       mientras la declaracion siga puesta — no solo mientras dura la animacion.
       Fijarlo en el split eran ~12 capas retenidas toda la sesion para un reveal
       de medio segundo que ademas, en movil (`liteOnce`), corre una sola vez.
       Se pone justo antes del reveal y se saca al terminar la ultima letra. */
    const setHint = (on: boolean) => {
      chars.forEach((c) => { c.style.willChange = on ? 'opacity, filter, transform' : 'auto' })
    }

    // replay: quita la clase, fuerza reflow y la re-agrega → reinicia el CSS anim
    const replay = () => {
      if (typeof document !== 'undefined' && (document.body.classList.contains('contact-modal-open') || document.body.classList.contains('cms-modal-open'))) {
        return
      }
      setHint(true)
      title.classList.remove('anim-in')
      void (title as HTMLElement).offsetWidth
      title.classList.add('anim-in')
      // delay acumulado de la ultima letra (0.045s c/u) + duracion del keyframe
      clearTimeout(hintTimer)
      hintTimer = setTimeout(() => setHint(false), chars.length * 45 + 650)
    }

    // En móvil / equipos ligeros el shimmer del título corre UNA vez (entrada) y
    // no se repite: el replay perpetuo cada 9s se sentía forzado y competía con
    // el scroll. En desktop se mantiene el loop.
    const liteOnce = document.documentElement.classList.contains('perf-lite')
    const start = setTimeout(() => {
      const fulls = lines.map((l) => l.textContent || '')
      if (fulls.every((f) => !f)) return
      chars = lines.flatMap(splitLine)
      replay()
      if (!liteOnce) intervalId = setInterval(replay, 9000)
    }, 3200)

    return () => {
      clearTimeout(start)
      clearTimeout(hintTimer)
      if (intervalId) clearInterval(intervalId)
    }
  }, [])

  // "Vida" constante de los containers flotantes la da el CSS (.float-anim)

  return (
    <section id="presentacion" className="hero" ref={sectionRef} style={{ position: 'relative' }}>
      {isAdmin && (
        <button
          className="cms-hero-gear"
          title="Configure the General Carousel (Home Background)"
          aria-label="Configure the General Carousel (Home Background)"
          style={{ top: '100px', right: '30px', position: 'absolute', zIndex: 1100 }}
          onClick={(e) => { e.preventDefault(); openCarousel('hero') }}
        >
          <i className="fa-solid fa-layer-group"></i>
        </button>
      )}



      <div className="hero-grid">

        <div className="hero-content">
          <div className="badge">
            <span className="badge-dot" aria-hidden="true"></span>Visual Art Portfolio
          </div>
          <h1 className="hero-title">
            <span className="line-wrap"><span className="line">Lucia</span></span>
            <span className="line-wrap"><span className="line">Montaña</span></span>
          </h1>
          {/* cota técnica: se dibuja al entrar (instrumento blueprint) */}
          <div className="bp-measure" aria-hidden="true">
            <svg viewBox="0 0 600 14" preserveAspectRatio="none">
              <line className="bp-line-h" x1="0" y1="7" x2="600" y2="7" />
              <line className="bp-tick" x1="1" y1="0" x2="1" y2="14" />
              <line className="bp-tick" x1="599" y1="0" x2="599" y2="14" />
            </svg>
            <span className="bp-measure-label">{MEASURE_LABEL}</span>
          </div>
          <p className="hero-subtitle">
            Bachelor&apos;s degree on Animation and Videogames. Illustrator, Character / environment design and 3D generalist.
          </p>
        </div>

        <div className="hero-media-wrapper">
          <div className="media-container hero-primary float-anim">
            <div className="container-overlay" style={{ zIndex: 10 }}></div>
            <HeroMediaCarousel prefix="hero-main" label="Main Carousel — Home" readyGate="heroPanel" />
            <span className="bp-scanline" aria-hidden="true" style={{ zIndex: 10 }}></span>
            <Corners />
            <span className="bp-fig" style={{ zIndex: 10 }}>FIG.01 — KEYFRAME_A</span>
          </div>
          <div className="media-container hero-secondary float-anim-delayed">
            <div className="container-overlay" style={{ zIndex: 10 }}></div>
            <HeroMediaCarousel prefix="hero-sub" label="Secondary Carousel — Home" />
            <Corners />
            <span className="bp-fig" style={{ zIndex: 10 }}>FIG.02 — DETAIL</span>
          </div>

          {/* Engranajes exclusivos para los carruseles flotantes (principal y secundario) dentro de su contenedor. */}
          {isAdmin && (
            <>
              <button
                className="cms-hero-gear"
                title="Configurar Main Carousel — Home"
                aria-label="Configure the Main Carousel"
                style={{ top: 'calc(68% - 58px)', bottom: 'auto', right: '14px' }}
                onClick={(e) => { e.preventDefault(); openCarousel('hero-main') }}
              >
                <i className="fa-solid fa-layer-group"></i>
              </button>
              <button
                className="cms-hero-gear"
                title="Configurar Secondary Carousel — Home"
                aria-label="Configure the Secondary Carousel"
                style={{ top: 'auto', bottom: 'calc(15% + 14px)', right: 'calc(50% + 14px)' }}
                onClick={(e) => { e.preventDefault(); openCarousel('hero-sub') }}
              >
                <i className="fa-solid fa-layer-group"></i>
              </button>
            </>
          )}
        </div>
      </div>

      <WaveMarquee />
    </section>
  )
}

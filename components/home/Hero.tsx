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
import { ensureGSAP, gsap, ScrollTrigger, prefersReducedMotion } from '@/hooks/useGSAP'

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

// Espera a que el PageLoader suelte el body para arrancar la entrada
function whenLoaderDone(cb: () => void): () => void {
  if (!document.body.classList.contains('loading-active')) { cb(); return () => {} }
  const mo = new MutationObserver(() => {
    if (!document.body.classList.contains('loading-active')) {
      mo.disconnect()
      cb()
    }
  })
  mo.observe(document.body, { attributes: true, attributeFilter: ['class'] })
  return () => mo.disconnect()
}

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null)
  useCmsStore() // re-render al cambiar admin (muestra/oculta los engranajes)
  const isAdmin = state.isAdmin

  // Coreografía de entrada + parallax de scroll
  useEffect(() => {
    if (prefersReducedMotion()) return
    ensureGSAP()
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

      gsap.set('.hero-rail-fill', { scaleY: 0, transformOrigin: 'top center' })
      gsap.to('.hero-rail-fill', {
        scaleY: 1, ease: 'none',
        scrollTrigger: { trigger: sec, start: 'top 0%', end: 'bottom 50%', scrub: 0.6 },
      })

      const tl = gsap.timeline({ paused: true, defaults: { ease: 'power4.out' } })

      // estados iniciales (solo cuando la animación va a correr)
      gsap.set('.hero-title .line', { yPercent: 115, skewY: 4 })
      gsap.set('.badge', { autoAlpha: 0, y: 14 })
      gsap.set('.hero-subtitle', { autoAlpha: 0, y: 18 })
      gsap.set('.bp-line-h', { strokeDasharray: 600, strokeDashoffset: 600 })
      gsap.set('.bp-measure-label, .bp-fig, .bp-tick', { autoAlpha: 0 })
      gsap.set('.hero-media-wrapper .media-container', { autoAlpha: 0, clipPath: 'inset(0% 0% 100% 0%)' })
      gsap.set('.bp-corner', { autoAlpha: 0, scale: 0.4 })
      gsap.set('.hero-software-wave', { autoAlpha: 0, y: 24 })

      tl.to('.badge', { autoAlpha: 1, y: 0, duration: 0.7 }, 0.1)
        .to('.hero-title .line', { yPercent: 0, skewY: 0, duration: 1.3, stagger: 0.14 }, 0.18)
        .to('.bp-line-h', { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut' }, '-=0.7')
        .to('.bp-tick', { autoAlpha: 1, duration: 0.3 }, '-=0.25')
        .to('.bp-measure-label', { autoAlpha: 1, duration: 0.5 }, '-=0.3')
        .to('.hero-subtitle', { autoAlpha: 1, y: 0, duration: 0.9 }, '-=0.75')
        // media: wipe vertical (clip-path no pelea con la animación CSS de flotado)
        .to('.hero-primary', { autoAlpha: 1, clipPath: 'inset(0% 0% 0% 0%)', duration: 1.25, ease: 'expo.out' }, 0.5)
        .to('.hero-secondary', { autoAlpha: 1, clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'expo.out' }, 0.72)
        .to('.bp-corner', { autoAlpha: 1, scale: 1, duration: 0.45, stagger: 0.045, ease: 'power3.out' }, '-=0.9')
        .to('.bp-fig', { autoAlpha: 0.85, duration: 0.5 }, '-=0.5')
        .to('.hero-software-wave', { autoAlpha: 1, y: 0, duration: 0.9 }, '-=0.7')

      const cancelWait = whenLoaderDone(() => tl.play())
      return () => cancelWait()
    }, sectionRef)
    return () => ctx.revert()
  }, [])

  // Rig de profundidad: los planos responden al mouse (solo puntero fino)
  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    if (!fine || prefersReducedMotion()) return
    ensureGSAP()
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
  }, [])

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
    let charIndex = 0

    const splitLine = (line: HTMLElement): HTMLElement[] => {
      const text = line.textContent || ''
      line.textContent = ''
      return [...text].map((ch) => {
        const s = document.createElement('span')
        s.className = 'hero-char'
        s.style.animationDelay = `${charIndex++ * 0.045}s`
        s.textContent = ch === ' ' ? ' ' : ch
        s.style.display = 'inline-block'
        s.style.willChange = 'opacity, filter, transform'
        line.appendChild(s)
        return s
      })
    }

    // replay: quita la clase, fuerza reflow y la re-agrega → reinicia el CSS anim
    const replay = () => {
      title.classList.remove('anim-in')
      void (title as HTMLElement).offsetWidth
      title.classList.add('anim-in')
    }

    const start = setTimeout(() => {
      const fulls = lines.map((l) => l.textContent || '')
      if (fulls.every((f) => !f)) return
      lines.forEach(splitLine)
      replay()
      intervalId = setInterval(replay, 9000)
    }, 3200)

    return () => {
      clearTimeout(start)
      if (intervalId) clearInterval(intervalId)
    }
  }, [])

  // "Vida" constante de los containers flotantes la da el CSS (.float-anim)

  return (
    <section id="presentacion" className="hero" ref={sectionRef}>
      <div className="hero-rail" aria-hidden="true">
        <span className="hero-rail-fig">FILE 01 · HERO</span>
        <span className="hero-rail-track">
          <span className="hero-rail-fill" />
        </span>
        <span className="hero-rail-fig hero-rail-fig--end">END</span>
      </div>

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
          <div className="media-container hero-primary float-anim" data-container-id="hero-main">
            <div className="container-overlay" style={{ zIndex: 10 }}></div>
            <HeroMediaCarousel prefix="hero-main" defaultSlides={[]} label="Carrusel Principal — Portada" />
            <span className="bp-scanline" aria-hidden="true" style={{ zIndex: 10 }}></span>
            <Corners />
            <span className="bp-fig" style={{ zIndex: 10 }}>FIG.01 — KEYFRAME_A</span>
          </div>
          <div className="media-container hero-secondary float-anim-delayed" data-container-id="hero-sub">
            <div className="container-overlay" style={{ zIndex: 10 }}></div>
            <HeroMediaCarousel prefix="hero-sub" defaultSlides={[]} label="Carrusel Secundario — Portada" />
            <Corners />
            <span className="bp-fig" style={{ zIndex: 10 }}>FIG.02 — DETAIL</span>
          </div>

          {/* Engranajes FUERA de los media-container: dentro, la maquinaria de
              contenedor-vacío + la coreografía de entrada los ocultaban hasta
              subir una imagen. Como hijos del wrapper se ven siempre (igual que
              el del fondo). Posicionados en la esquina inferior derecha de cada uno. */}
          {isAdmin && (
            <>
              <button
                className="cms-hero-gear"
                title="Configurar Carrusel Principal — Portada"
                aria-label="Configurar Carrusel Principal"
                style={{ top: 'calc(68% - 58px)', bottom: 'auto', right: '14px' }}
                onClick={(e) => { e.preventDefault(); openCarousel('hero-main') }}
              >
                <i className="fa-solid fa-layer-group"></i>
              </button>
              <button
                className="cms-hero-gear"
                title="Configurar Carrusel Secundario — Portada"
                aria-label="Configurar Carrusel Secundario"
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

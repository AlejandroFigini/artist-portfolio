'use client'

/* Hero — coreografía de entrada GSAP (line-mask reveal tipo Lusion/
   Locomotive en Awwwards) + instrumentación blueprint: cota que se
   dibuja, marcos de registro FIG., scanline y rig de profundidad con
   el mouse. Los estados iniciales los setea GSAP dentro del effect:
   sin JS o con prefers-reduced-motion todo queda visible.
   El slideshow de fondo vive en Slideshow.tsx. */

import { useEffect, useRef } from 'react'
import WaveMarquee from './WaveMarquee'
import { ensureGSAP, gsap, prefersReducedMotion } from '@/hooks/useGSAP'

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

  // Coreografía de entrada + parallax de scroll
  useEffect(() => {
    if (prefersReducedMotion()) return
    ensureGSAP()
    const ctx = gsap.context(() => {
      // parallax del media principal al scrollear (port de script.js)
      gsap.to('.hero-primary .cms-media', {
        yPercent: 15,
        ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
      })

      const tl = gsap.timeline({ paused: true, defaults: { ease: 'power4.out' } })

      // estados iniciales (solo cuando la animación va a correr)
      gsap.set('.hero-title .line', { yPercent: 115, skewY: 4 })
      gsap.set('.badge', { autoAlpha: 0, y: 14 })
      gsap.set('.hero-subtitle, .scroll-indicator', { autoAlpha: 0, y: 18 })
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
        .to('.scroll-indicator', { autoAlpha: 1, y: 0, duration: 0.7 }, '-=0.55')

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

  // "Vida" constante de los containers flotantes la da el CSS (.float-anim)

  return (
    <section id="presentacion" className="hero" ref={sectionRef}>
      <div className="hero-grid">
        <div className="hero-content">
          <div className="badge" data-cms-key="hero_badge">
            <span className="badge-dot" aria-hidden="true"></span>Visual Art Portfolio
          </div>
          <h1 className="hero-title" data-cms-key="hero_title">
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
          <p className="hero-subtitle" data-cms-key="hero_desc">
            Bachelor&apos;s degree on Animation and Videogames. <br />
            Illustrator, Character / environment design and 3D generalist.
          </p>
          <div className="scroll-indicator">
            <div className="mouse">
              <div className="wheel"></div>
            </div>
            <span data-i18n="hero_cta">Discover Essence</span>
          </div>
        </div>

        <div className="hero-media-wrapper">
          <div className="media-container hero-primary float-anim" data-container-id="hero-main">
            <div className="container-overlay"></div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/portada-2.webp" alt="Hero Art" className="cms-media" />
            <span className="bp-scanline" aria-hidden="true"></span>
            <Corners />
            <span className="bp-fig">FIG.01 — KEYFRAME_A</span>
          </div>
          <div className="media-container hero-secondary float-anim-delayed" data-container-id="hero-sub">
            <div className="container-overlay"></div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/portada-3.webp" alt="Secondary Art" className="cms-media" />
            <Corners />
            <span className="bp-fig">FIG.02 — DETAIL</span>
          </div>
        </div>
      </div>

      <WaveMarquee />
    </section>
  )
}

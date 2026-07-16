'use client'

/* About — editorial cinematográfico con storytelling on-scroll.
   Layout: video/animación grande con foto retrato chica en esquina;
   ambos al nivel del título. Hooks CMS:
     - h2[data-i18n="about_title"]      → about.title
     - .about-lede                      → about.lede (editable)
     - .bio-content                     → about.desc
     - .about-spec (fields k/v)         → about.spec#i (cada uno)
     - .about-social (fields label/url) → about.social#i (cada uno)
     - .artist-photo-img (parent)       → about.photo
     - .about-video (parent)            → about.video
   El engine.ts indexa por selector y asigna data-cms-key automáticamente.
   Vacíos: cms-empty-overlay (solo icono, ver styles/about.css). */

import { useEffect, useRef } from 'react'
import { ensureGSAP, gsap, ScrollTrigger, prefersReducedMotion, typewriterRevealLoop, wordRevealLoop, type LoopHandle } from '@/hooks/useGSAP'

const SPECS = [
  { k: 'ROLE',      v: '3D Generalist & Animator' },
  { k: 'BASE',      v: 'Montevideo · GMT-3' },
  { k: 'PRACTICE',  v: 'Freelance, est. 2019' },
  { k: 'EDUCATION', v: 'B.A. Animation' },
]

const SOCIALS = [
  { href: 'https://www.instagram.com/',  label: 'Instagram',  icon: 'fa-instagram' },
  { href: 'https://www.artstation.com/', label: 'ArtStation', icon: 'fa-artstation' },
  { href: 'https://www.behance.net/',    label: 'Behance',    icon: 'fa-behance' },
  { href: 'https://www.linkedin.com/',   label: 'LinkedIn',   icon: 'fa-linkedin-in' },
  { href: 'https://vimeo.com/',          label: 'Vimeo',      icon: 'fa-vimeo-v' },
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

const TITLE = 'About'

export default function AboutSection() {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (prefersReducedMotion()) return
    ensureGSAP()
    const sec = sectionRef.current
    if (!sec) return

    let twTimeout: ReturnType<typeof setTimeout>
    let titleTw: LoopHandle | null = null
    let ledeTw: LoopHandle | null = null

    const ctx = gsap.context(() => {
      gsap.set('.about-title .line', { yPercent: 115, skewY: 4 })
      gsap.set('.about-fig', { autoAlpha: 0, y: 12 })
      gsap.set('.about-lede', { autoAlpha: 0, y: 22 })
      gsap.set('.about-bio p', { autoAlpha: 0, y: 22 })
      gsap.set('.about-video-container', { autoAlpha: 0, clipPath: 'inset(0% 100% 0% 0%)' })
      gsap.set('.about-corner', { autoAlpha: 0, scale: 0.4 })
      gsap.set('.about-portrait', { autoAlpha: 0, scale: 0.7, rotate: -6 })
      gsap.set('.about-meta-row', { autoAlpha: 0, x: -16 })
      gsap.set('.about-spec', { autoAlpha: 0, y: 14 })
      gsap.set('.about-social', { autoAlpha: 0, y: 10 })
      gsap.set('.about-rail-fill', { scaleY: 0, transformOrigin: 'top center' })

      const tl = gsap.timeline({ defaults: { ease: 'power4.out' }, paused: true })
      tl.to('.about-fig', { autoAlpha: 1, y: 0, duration: 0.4 }, 0)
        .to('.about-title .line', { yPercent: 0, skewY: 0, duration: 1.0, stagger: 0.1 }, 0.05)
        .to('.about-video-container', { autoAlpha: 1, clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'expo.out' }, '-=0.85')
        .to('.about-corner', { autoAlpha: 1, scale: 1, duration: 0.35, stagger: 0.04, ease: 'power3.out' }, '-=0.7')
        .to('.about-portrait', { autoAlpha: 1, scale: 1, rotate: 0, duration: 0.8, ease: 'back.out(1.6)' }, '-=0.6')
        .to('.about-portrait .bp-corner', { autoAlpha: 1, scale: 1, duration: 0.3, stagger: 0.04 }, '-=0.5')
        .to('.about-lede', { autoAlpha: 1, y: 0, duration: 0.7 }, '-=0.95')
        .to('.about-bio p', { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.12 }, '-=0.6')
        .to('.about-meta-row', { autoAlpha: 1, x: 0, duration: 0.5, stagger: 0.06, ease: 'power3.out' }, '-=0.5')
        .to('.about-spec', { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.06, ease: 'power3.out' }, '-=0.45')
        .to('.about-social', { autoAlpha: 1, y: 0, duration: 0.35, stagger: 0.05, ease: 'power3.out' }, '-=0.35')

      let played = false
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !played) {
            played = true
            tl.play()
            io.disconnect()
            const lineEl = sec.querySelector<HTMLElement>('.about-title .line')
            const ledeEl = sec.querySelector<HTMLElement>('.about-lede')
            twTimeout = setTimeout(() => {
              if (lineEl) titleTw = typewriterRevealLoop(lineEl, 8)
              if (ledeEl) ledeTw = wordRevealLoop(ledeEl, 8)
            }, (tl.duration() + 1) * 1000)
          }
        }
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 })
      io.observe(sec)

      gsap.to('.about-video', {
        scale: 1.05, duration: 7, ease: 'sine.inOut',
        yoyo: true, repeat: -1, delay: 1.8,
      })
      gsap.to('.about-portrait', {
        y: -10, rotate: 1.2, duration: 4.5, ease: 'sine.inOut',
        yoyo: true, repeat: -1, delay: 2.2,
      })

      gsap.to('.about-rail-fill', {
        scaleY: 1, ease: 'none',
        scrollTrigger: { trigger: sec, start: 'top 70%', end: 'bottom 50%', scrub: 0.6 },
      })

      ScrollTrigger.refresh()
    }, sectionRef)
    return () => { clearTimeout(twTimeout); titleTw?.kill(); ledeTw?.kill(); ctx.revert() }
  }, [])

  return (
    <section ref={sectionRef} className="about-section" aria-labelledby="about-title-h">
      {/* Riel-cota vertical decorativo */}
      <div className="about-rail" aria-hidden="true">
        <span className="about-rail-fig">FILE 02 · ABOUT</span>
        <span className="about-rail-track">
          <span className="about-rail-fill" />
        </span>
        <span className="about-rail-fig about-rail-fig--end">END</span>
      </div>

      <div className="about-frame">
        <div className="about-grid">
          {/* Columna izquierda: header + bio + meta */}
          <div className="about-copy">
            <div className="about-header">
              <span className="about-fig">FIG. 02 — Subject</span>
              <h2
                id="about-title-h"
                className="about-title"
                data-i18n="about_title"
              >
                <span className="line-wrap"><span className="line">{TITLE}</span></span>
              </h2>
              <p className="about-lede" data-i18n="about_lede">
                I design and animate characters and worlds. Working at the intersection
                of 3D, illustration, and visual storytelling.
              </p>
            </div>

            <div className="bio-content about-bio">
              <p>
                I am Lucía Montaña. I have spent years shaping characters and
                environments, combining traditional techniques with a modern 3D
                pipeline. Every piece begins with a hand-drawn sketch and finishes
                lookdev&apos;d for production integration.
              </p>
              <p>
                My work spans animated short films, editorial motion design,
                and game art. I thrive on projects where visual language takes
                center stage.
              </p>
            </div>

            <div className="about-meta">
              <div className="about-meta-block">
                <span className="about-meta-row about-meta-head">{"// SPECS"}</span>
                <ul className="about-specs">
                  {SPECS.map((s) => (
                    <li key={s.k} className="about-spec">
                      <span className="about-spec-k">{s.k}</span>
                      <span className="about-spec-v">{s.v}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="about-meta-block">
                <span className="about-meta-row about-meta-head">{"// CONTACT"}</span>
                <ul className="about-socials">
                  {SOCIALS.map((s) => (
                    <li key={s.label} className="about-social">
                      <a href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}>
                        <i className={`fa-brands ${s.icon}`} aria-hidden="true" />
                        <span className="about-social-label">{s.label}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Columna derecha: reel grande + foto independiente al lado.
              La foto es sibling del reel (no hija) → contenedor propio. */}
          <div className="about-media">
            {/* Manchas decorativas animadas detrás de los contenedores */}
            <span className="about-media-blob about-media-blob--a" aria-hidden="true" />
            <span className="about-media-blob about-media-blob--b" aria-hidden="true" />

            <div className="about-video-container">
              <video
                className="about-video"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
              />
              <div className="about-video-caption">
                <span>FIG. 02a</span>
                <span>Reel — Loop</span>
              </div>
              <div className="about-video-details">
                <span className="about-corner tl" />
                <span className="about-corner tr" />
                <span className="about-corner bl" />
                <span className="about-corner br" />
              </div>
            </div>

            <figure className="about-portrait">
              <Corners />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="artist-photo-img" alt="Retrato de Lucía Montaña" loading="lazy" decoding="async" />
              <figcaption className="about-portrait-cap">
                <span>FIG. 02b</span>
              </figcaption>
            </figure>
          </div>
        </div>
      </div>
    </section>
  )
}

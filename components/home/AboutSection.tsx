'use client'

/* About — ficha técnica blueprint (SUBJECT FILE): fondo de plano con
   grilla y glow, riel-cota vertical que se llena con el scroll (ref.
   side progress rails tipo Locomotive/Studio Freight en Awwwards),
   retrato 3/4 con marcas de registro FIG., specs como tabla técnica
   y statement display con el trazo-contorno del hero.
   Hooks CMS intactos: h2[data-i18n=about_title], .bio-content,
   .artist-photo-img (mount parent), .about-video (mount parent). */

import LiveClock from '@/components/ui/LiveClock'
import { useGSAP, gsap } from '@/hooks/useGSAP'

const SOCIALS = [
  { href: 'https://www.instagram.com/', label: 'Instagram' },
  { href: 'https://www.linkedin.com/', label: 'LinkedIn' },
  { href: 'https://www.artstation.com/', label: 'ArtStation' },
  { href: 'https://vimeo.com/', label: 'Vimeo' },
]

const SPECS = [
  { label: 'ROLE', value: '3D Generalist & Animator' },
  { label: 'EDUCATION', value: 'B.A. Animation — ORT' },
  { label: 'PRACTICE', value: 'Freelance est. 2019' },
  { label: 'BASE', value: 'Montevideo, UY · GMT-3' },
]

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

// Reveals on-scroll + riel-cota que se llena con el avance de la sección
function useAboutReveals() {
  useGSAP(() => {
    const enter = {
      scrollTrigger: { trigger: '.about-tech', start: 'top 72%', toggleActions: 'play none none none' },
    }

    const tl = gsap.timeline(enter)
    tl.fromTo('.about-tech h2[data-i18n="about_title"]', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' })
      // statement: máscara de línea, el mismo gesto del título del hero
      .fromTo('.about-statement .line',
        { yPercent: 115 },
        { yPercent: 0, duration: 1.1, stagger: 0.12, ease: 'power4.out' }, '-=0.3')
      .fromTo('.bio-content p', { opacity: 0, y: 15 }, { opacity: 1, y: 0, stagger: 0.13, duration: 0.7, ease: 'power3.out' }, '-=0.55')
      .fromTo('.about-specs .spec-row', { opacity: 0, x: -14 }, { opacity: 1, x: 0, stagger: 0.08, duration: 0.5, ease: 'power3.out' }, '-=0.5')
      .fromTo('.about-links a', { opacity: 0, y: 8 }, { opacity: 1, y: 0, stagger: 0.07, duration: 0.45, ease: 'power3.out' }, '-=0.4')

    // retrato: wipe vertical + corners en cascada (mismo lenguaje del hero)
    const media = gsap.timeline({
      scrollTrigger: { trigger: '.about-media', start: 'top 75%', toggleActions: 'play none none none' },
    })
    media
      .fromTo('.about-portrait', { autoAlpha: 0, clipPath: 'inset(0% 0% 100% 0%)' },
        { autoAlpha: 1, clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'expo.out' })
      .fromTo('.about-portrait .bp-corner', { autoAlpha: 0, scale: 0.4 },
        { autoAlpha: 1, scale: 1, duration: 0.4, stagger: 0.05, ease: 'power3.out' }, '-=0.6')
      .fromTo('.about-portrait-meta', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, '-=0.3')
      .fromTo('.about-reel', { autoAlpha: 0, clipPath: 'inset(100% 0% 0% 0%)' },
        { autoAlpha: 1, clipPath: 'inset(0% 0% 0% 0%)', duration: 1, ease: 'expo.out' }, '-=0.7')
      .fromTo('.about-reel .bp-corner', { autoAlpha: 0, scale: 0.4 },
        { autoAlpha: 1, scale: 1, duration: 0.4, stagger: 0.05, ease: 'power3.out' }, '-=0.5')

    // riel-cota: el relleno acompaña el avance de lectura de la sección
    gsap.fromTo('.about-rail-fill', { scaleY: 0 }, {
      scaleY: 1, ease: 'none',
      scrollTrigger: { trigger: '.about-tech', start: 'top 70%', end: 'bottom 45%', scrub: 0.6 },
    })

    // parallax sutil del retrato (profundidad, solo transform)
    gsap.fromTo('.about-portrait', { y: 30 }, {
      y: -30, ease: 'none',
      scrollTrigger: { trigger: '.about-tech', start: 'top bottom', end: 'bottom top', scrub: 1 },
    })
  })
}

export default function AboutSection() {
  useAboutReveals()

  return (
    <section className="about-tech">
      <div className="about-tech-frame">
        {/* riel-cota vertical: graduación + relleno scrubbed (aria oculto) */}
        <div className="about-rail" aria-hidden="true">
          <span className="about-rail-track">
            <span className="about-rail-fill"></span>
          </span>
          <span className="about-rail-label">FILE 02 — SUBJECT</span>
        </div>

        <div className="about-tech-grid">
          <div className="about-copy">
            <h2 data-i18n="about_title">About Me</h2>

            {/* declaración display — palabras clave con el trazo del hero */}
            <p className="about-statement" aria-label="I create characters that bring identity and life to every story.">
              <span className="line-wrap"><span className="line">I create characters</span></span>
              <span className="line-wrap"><span className="line">that bring <em>identity</em></span></span>
              <span className="line-wrap"><span className="line">&amp; <em>life</em> to every story.</span></span>
            </p>

            <div className="bio-content" data-i18n="about_text_1">
              <p>My name is <strong>Lucía Montaña</strong>, and I am a <strong>2D and 3D artist</strong> based in Montevideo, Uruguay.</p>
              <p>I specialize in both design and animation, with a strong passion for creating characters and designs that bring identity and life to my work. I truly love conveying emotions and stories to the audience in the best possible way.</p>
              <p>I hold a Bachelor&apos;s degree in <strong>Animation and Video Game Design</strong> from ORT University, Uruguay, and have been working as a freelance artist since 2019. I am now looking to broaden my horizons and be part of new projects!</p>
            </div>

            {/* specs: tabla técnica de ficha (label → valor) */}
            <dl className="about-specs">
              {SPECS.map((s) => (
                <div className="spec-row" key={s.label}>
                  <dt>{s.label}</dt>
                  <dd>{s.value}</dd>
                </div>
              ))}
            </dl>

            <div className="about-links">
              {SOCIALS.map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="about-link">
                  {s.label} ↗
                </a>
              ))}
            </div>
          </div>

          <div className="about-media">
            <figure className="about-portrait">
              <div className="artist-photo-wrapper">
                {/* contenedor CMS: el src lo inyecta el CMS */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="Lucía Montaña" className="artist-photo-img" fetchPriority="high" />
              </div>
              <Corners />
              <figcaption className="about-portrait-meta">
                <span className="bp-fig-label">FIG.03 — PORTRAIT</span>
                <span className="about-stamp"><LiveClock /></span>
              </figcaption>
            </figure>

            <figure className="about-reel">
              <div className="artist-video-wrapper">
                <video loop muted playsInline className="about-video" preload="metadata"></video>
              </div>
              <Corners />
              <figcaption className="about-reel-meta">
                <span className="bp-fig-label">FIG.04 — MOTION REEL</span>
              </figcaption>
            </figure>
          </div>
        </div>
      </div>
    </section>
  )
}

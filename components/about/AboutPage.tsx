'use client'

/* AboutPage (/about) — "Sobre la artista". Blueprint cinematic CLARO,
   minimalista + vivo. Ref visual: editorial tipo Cosmos/Locomotive
   (aire negativo + hairlines + reveals on-scroll).

   CMS: el retrato reusa el contenedor existente (.artist-photo-img →
   about.photo, registrado en engine.ts). El resto del contenido es
   estático (CMS-wireable después, ver enfoque A). El overlay vacío
   canónico lo inyecta el engine cuando CmsRoot está montado en la ruta.

   GSAP: estados iniciales se setean acá (sin JS / reduced-motion → todo
   visible). Intro corre al montar; el resto revela on-scroll. Auroras y
   float del retrato son CSS (ver styles/about-page.css). */

import { useEffect, useRef } from 'react'
import { ensureGSAP, gsap, ScrollTrigger, prefersReducedMotion } from '@/hooks/useGSAP'

const SPECS = [
  { k: 'ROLE',      v: '3D Generalist & Animator' },
  { k: 'BASE',      v: 'Montevideo · GMT-3' },
  { k: 'PRACTICE',  v: 'Freelance, est. 2019' },
  { k: 'EDUCATION', v: 'B.A. Animation' },
]

const TOOLS = [
  { name: 'Blender',            cat: 'Modeling / Render' },
  { name: 'ZBrush',             cat: 'Sculpting' },
  { name: 'Maya',               cat: 'Animation' },
  { name: 'Substance 3D',       cat: 'Texturing' },
  { name: 'Photoshop',          cat: 'Illustration' },
  { name: 'After Effects',      cat: 'Motion / Comp' },
]

const TIMELINE = [
  {
    year: '2024',
    role: 'Senior 3D Generalist',
    place: 'Freelance',
    desc: 'Character direction and lookdev for animated short films and commercial pieces.',
  },
  {
    year: '2022',
    role: '3D Artist & Animator',
    place: 'Studio · Game Art',
    desc: 'Modeling, rigging, and animation pipeline for game art and motion projects.',
  },
  {
    year: '2019',
    role: 'Freelance Start',
    place: 'Montevideo',
    desc: 'Early illustration and 3D modeling commissions combining traditional techniques and digital pipeline.',
  },
  {
    year: '2017',
    role: 'B.A. in Animation',
    place: 'Education',
    desc: 'Foundation in animation, visual storytelling, and cinematic language.',
  },
]

const SOCIALS = [
  { href: 'https://www.instagram.com/',  label: 'Instagram',  icon: 'fa-instagram' },
  { href: 'https://www.artstation.com/', label: 'ArtStation', icon: 'fa-artstation' },
  { href: 'https://www.behance.net/',    label: 'Behance',    icon: 'fa-behance' },
  { href: 'https://www.linkedin.com/',   label: 'LinkedIn',   icon: 'fa-linkedin-in' },
  { href: 'https://vimeo.com/',          label: 'Vimeo',      icon: 'fa-vimeo-v' },
]

export default function AboutPage() {
  const rootRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (prefersReducedMotion()) return
    ensureGSAP()
    const root = rootRef.current
    if (!root) return

    const ctx = gsap.context(() => {
      /* --- estados iniciales (solo cuando GSAP corre) --- */
      gsap.set('.ab-hero-eyebrow', { autoAlpha: 0, y: 14 })
      gsap.set('.ab-hero-name .ab-line', { yPercent: 118, skewY: 4 })
      gsap.set('.ab-hero-lede', { autoAlpha: 0, y: 22 })
      gsap.set('.ab-hero-meta span', { autoAlpha: 0, y: 10 })

      /* --- intro: corre al montar --- */
      gsap.timeline({ defaults: { ease: 'power4.out' } })
        .to('.ab-hero-eyebrow', { autoAlpha: 1, y: 0, duration: 0.6 }, 0)
        .to('.ab-hero-name .ab-line', { yPercent: 0, skewY: 0, duration: 1.1, stagger: 0.12 }, 0.08)
        .to('.ab-hero-lede', { autoAlpha: 1, y: 0, duration: 0.8 }, '-=0.7')
        .to('.ab-hero-meta span', { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.08 }, '-=0.5')

      /* --- helper de reveal on-scroll --- */
      const reveal = (target: string, vars: gsap.TweenVars = {}) =>
        gsap.from(target, {
          autoAlpha: 0,
          y: 26,
          duration: 0.85,
          ease: 'power3.out',
          scrollTrigger: { trigger: target, start: 'top 82%' },
          ...vars,
        })

      /* Retrato + bio */
      gsap.from('.ab-portrait', {
        autoAlpha: 0, scale: 0.92, duration: 1, ease: 'expo.out',
        scrollTrigger: { trigger: '.ab-about-grid', start: 'top 80%' },
      })
      reveal('.ab-about .ab-eyebrow')
      reveal('.ab-bio-text p', { stagger: 0.14 })
      reveal('.ab-spec', { y: 16, duration: 0.6, stagger: 0.08 })

      /* Tools */
      reveal('.ab-tools .ab-section-head', {})
      reveal('.ab-tool', { y: 22, duration: 0.6, stagger: 0.08 })

      /* Timeline: items en cascada + relleno del riel scrubbed */
      reveal('.ab-timeline-sec .ab-section-head', {})
      reveal('.ab-tl-item', { x: 18, y: 0, duration: 0.7, stagger: 0.12 })
      gsap.fromTo('.ab-tl-fill', { scaleY: 0 }, {
        scaleY: 1, ease: 'none',
        scrollTrigger: { trigger: '.ab-timeline', start: 'top 72%', end: 'bottom 62%', scrub: 0.6 },
      })

      /* Contacto */
      reveal('.ab-contact-title', { duration: 1 })
      reveal('.ab-contact-lede', {})
      reveal('.ab-contact-actions', { y: 16 })

      ScrollTrigger.refresh()
    }, rootRef)

    return () => ctx.revert()
  }, [])

  return (
    <main ref={rootRef} className="ab-main">
      {/* auroras a la deriva (vida de fondo) */}
      <span className="ab-aurora ab-aurora--a" aria-hidden="true" />
      <span className="ab-aurora ab-aurora--b" aria-hidden="true" />
      <span className="ab-aurora ab-aurora--c" aria-hidden="true" />

      {/* 1 · INTRO */}
      <header className="ab-hero ab-wrap">
        <span className="ab-eyebrow ab-hero-eyebrow">FILE 00 — ABOUT / LUCÍA MONTAÑA</span>
        <h1 className="ab-hero-name">
          <span className="ab-line-mask"><span className="ab-line">Lucía</span></span>
          <span className="ab-line-mask"><span className="ab-line ab-line--accent">Montaña</span></span>
        </h1>
        <p className="ab-hero-lede">
          I design and animate characters and worlds. Working at the intersection of
          3D, illustration, and visual storytelling.
        </p>
        <div className="ab-hero-meta">
          <span>Montevideo · UY</span>
          <span>3D Generalist</span>
          <span className="ab-meta-live">Available for projects</span>
        </div>
      </header>

      {/* 2 · RETRATO + BIO */}
      <section className="ab-section ab-about ab-wrap" aria-label="Biography">
        <div className="ab-about-grid">
          <figure className="ab-portrait">
            <span className="ab-corner tl" />
            <span className="ab-corner tr" />
            <span className="ab-corner bl" />
            <span className="ab-corner br" />
            {/* contenedor CMS: about.photo (engine indexa por .artist-photo-img) */}
            <img className="artist-photo-img" alt="Lucía Montaña Portrait" />
            <figcaption className="ab-portrait-cap">FIG. 01 — Subject</figcaption>
          </figure>

          <div className="ab-bio">
            <span className="ab-eyebrow">// Biography</span>
            <div className="ab-bio-text">
              <p>
                I am <strong>Lucía Montaña</strong>. I have spent years shaping characters and environments, combining traditional techniques with a modern 3D pipeline. Every piece begins with a hand-drawn sketch and finishes lookdev&apos;d for production integration.
              </p>
              <p>
                My work spans animated short films, editorial motion design, and game art. I thrive on projects where visual language takes center stage.
              </p>
            </div>

            <ul className="ab-specs">
              {SPECS.map((s) => (
                <li key={s.k} className="ab-spec">
                  <span className="ab-spec-k">{s.k}</span>
                  <span className="ab-spec-v">{s.v}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 3 · SOFTWARE / TOOLKIT */}
      <section className="ab-section ab-tools ab-wrap" aria-label="Software and tools">
        <div className="ab-section-head">
          <span className="ab-eyebrow">// Toolkit</span>
          <h2 className="ab-section-title">Day-to-day Software</h2>
        </div>
        <div className="ab-tools-grid">
          {TOOLS.map((t, i) => (
            <div key={t.name} className="ab-tool">
              <span className="ab-tool-idx">{String(i + 1).padStart(2, '0')}</span>
              <span className="ab-tool-name">{t.name}</span>
              <span className="ab-tool-cat">{t.cat}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 4 · EXPERIENCIA / TIMELINE */}
      <section className="ab-section ab-timeline-sec ab-wrap" aria-label="Career Timeline">
        <div className="ab-section-head">
          <span className="ab-eyebrow">// Career Timeline</span>
          <h2 className="ab-section-title">Where I come from</h2>
        </div>
        <div className="ab-timeline">
          <span className="ab-tl-track" aria-hidden="true"><span className="ab-tl-fill" /></span>
          {TIMELINE.map((e) => (
            <article key={e.year} className="ab-tl-item">
              <span className="ab-tl-node" aria-hidden="true" />
              <span className="ab-tl-year">{e.year}</span>
              <div className="ab-tl-content">
                <h3 className="ab-tl-role">{e.role}</h3>
                <span className="ab-tl-place">{e.place}</span>
                <p className="ab-tl-desc">{e.desc}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 5 · CONTACTO */}
      <section className="ab-section ab-contact ab-wrap" aria-label="Contact">
        <span className="ab-eyebrow">// Contact</span>
        <h2 className="ab-contact-title">Let&apos;s work <em>together</em>.</h2>
        <p className="ab-contact-lede">
          Have an animation, character, or 3D project in mind? Drop me a message and let&apos;s talk.
        </p>
        <div className="ab-contact-actions">
          <a className="ab-cta" href="mailto:hola@luciamontana.com">
            <i className="fa-solid fa-paper-plane" aria-hidden="true" />
            Get in touch
          </a>
          <ul className="ab-socials">
            {SOCIALS.map((s) => (
              <li key={s.label} className="ab-social">
                <a href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}>
                  <i className={`fa-brands ${s.icon}`} aria-hidden="true" />
                  <span>{s.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  )
}

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
import { useMotionReady, prefersReducedMotion, type LoopHandle } from '@/hooks/useGSAP'
import { sendGAEvent } from '@next/third-parties/google'
import HeroMediaCarousel from './HeroMediaCarousel'
import { useCmsStore, state } from '@/lib/cms/store'
import { SOCIAL_NETWORKS, socialHref } from '@/lib/social'
import { useSocial } from '@/components/ui/SocialProvider'

const openCarousel = (prefix: string) =>
  window.dispatchEvent(new CustomEvent('cms:carouselManager', { detail: { prefix } }))

const SPECS = [
  { k: 'ROLE',      v: '3D Generalist & Animator' },
  { k: 'BASE',      v: 'Montevideo · GMT-3' },
  { k: 'PRACTICE',  v: 'Freelance, est. 2019' },
  { k: 'EDUCATION', v: 'B.A. Animation' },
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
  const motion = useMotionReady() // GSAP llega en su propio chunk
  const sectionRef = useRef<HTMLElement>(null)
  useCmsStore()
  const isAdmin = state.isAdmin
  const { links } = useSocial()
  const nets = SOCIAL_NETWORKS.filter((n) => socialHref(n, links[n.id]))

  useEffect(() => {
    if (prefersReducedMotion()) return
    if (!motion) return
    const { gsap, ScrollTrigger, wordRevealLoop } = motion
    const sec = sectionRef.current
    if (!sec) return

    let twTimeout: ReturnType<typeof setTimeout>
    let ledeTw: LoopHandle | null = null

    const ctx = gsap.context(() => {
      /* Se anima el .about-title ENTERO, no el `.line` interno: about.title es
         contenedor CMS (data-cms-key) y el motor le reescribe el textContent al
         hidratar/traducir, borrando el <span class="line"> que el reveal
         apuntaba. Resultado: el título quedaba en opacity 1 sin animar mientras
         el lede sí entraba. Animar el elemento sobrevive al flatten. */
      gsap.set('.about-title', { autoAlpha: 0, y: 26 })
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

      /* Orden pedido: primero el TÍTULO, después el SUB-TEXTO (lede). Posiciones
         absolutas para que la secuencia sea explícita y no dependa del encadenado
         relativo. La instrumentación (fig/media/portrait/bio/meta) mantiene sus
         tiempos previos. */
      const tl = gsap.timeline({ defaults: { ease: 'power4.out' }, paused: true })
      tl.to('.about-fig', { autoAlpha: 1, y: 0, duration: 0.4 }, 0)
        .to('.about-title', { autoAlpha: 1, y: 0, duration: 0.9 }, 0)
        .to('.about-lede', { autoAlpha: 1, y: 0, duration: 0.7 }, 0.5)
        .to('.about-bio p', { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.12 }, 1.0)
        .to('.about-video-container', { autoAlpha: 1, clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'expo.out' }, 0.1)
        .to('.about-corner', { autoAlpha: 1, scale: 1, duration: 0.35, stagger: 0.04, ease: 'power3.out' }, 0.5)
        .to('.about-portrait', { autoAlpha: 1, scale: 1, rotate: 0, duration: 0.8, ease: 'back.out(1.6)' }, 0.85)
        .to('.about-portrait .bp-corner', { autoAlpha: 1, scale: 1, duration: 0.3, stagger: 0.04 }, 1.35)
        .to('.about-meta-row', { autoAlpha: 1, x: 0, duration: 0.5, stagger: 0.06, ease: 'power3.out' }, 1.3)
        .to('.about-spec', { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.06, ease: 'power3.out' }, 1.45)
        .to('.about-social', { autoAlpha: 1, y: 0, duration: 0.35, stagger: 0.05, ease: 'power3.out' }, 1.7)

      let played = false
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !played) {
            played = true
            tl.play()
            io.disconnect()
            const ledeEl = sec.querySelector<HTMLElement>('.about-lede')
            twTimeout = setTimeout(() => {
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



      ScrollTrigger.refresh()
    }, sectionRef)
    return () => { clearTimeout(twTimeout); ledeTw?.kill(); ctx.revert() }
  }, [motion])

  return (
    <section ref={sectionRef} className="about-section" aria-labelledby="about-title-h">


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
                  {nets.map((n) => (
                    <li key={n.id} className="about-social">
                      <a 
                        href={n.type === 'email' ? '#' : socialHref(n, links[n.id])} 
                        target={n.type === 'email' ? undefined : '_blank'} 
                        rel="noopener noreferrer" 
                        aria-label={n.label} 
                        onClick={(e) => {
                          if (n.type === 'email') {
                            e.preventDefault();
                            window.dispatchEvent(new CustomEvent('open-contact'));
                            sendGAEvent('event', 'email_click');
                          } else {
                            sendGAEvent('event', `social_click_${n.id}`);
                          }
                        }}
                      >
                        <i className={`${n.brand ? 'fa-brands' : 'fa-solid'} ${n.icon}`} aria-hidden="true" />
                        <span className="about-social-label">{n.label}</span>
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
              <HeroMediaCarousel prefix="about-carousel" label="About me Carousel" className="artist-photo-img cms-media" />
              <figcaption className="about-portrait-cap">
                <span>FIG. 02b</span>
              </figcaption>
              {isAdmin && (
                <button
                  className="cms-hero-gear"
                  title="Configure the About me Carousel"
                  aria-label="Configure the About me Carousel"
                  style={{ top: '10px', right: '10px', zIndex: 1100 }}
                  onClick={(e) => { e.preventDefault(); openCarousel('about-carousel') }}
                >
                  <i className="fa-solid fa-layer-group"></i>
                </button>
              )}
            </figure>
          </div>
        </div>
      </div>
    </section>
  )
}

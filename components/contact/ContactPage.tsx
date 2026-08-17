'use client'

/* ContactPage (/contact) — página de contacto dedicada.
   Blueprint cinematic (violeta, contenedores con esquinas, labels mono, grid
   blueprint de fondo, auroras). Secciones: hero, info cards, formulario inline,
   redes sociales, descarga CV. GSAP reveals on-scroll. */

import '@/styles/contact-page.css'

import { useEffect, useRef } from 'react'
import { useMotionReady, prefersReducedMotion } from '@/hooks/useGSAP'
import { useUiText } from '@/lib/cms/store'
import { SOCIAL_NETWORKS, socialHref } from '@/lib/social'
import { useSocial } from '@/components/ui/SocialProvider'
import { useSiteSettings } from '@/components/ui/SiteSettingsProvider'
import { useDownloadCv } from '@/hooks/useDownloadCv'
import { sendGAEvent } from '@next/third-parties/google'
import ContactForm from './ContactForm'

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

export default function ContactPage() {
  const motion = useMotionReady()
  const ui = useUiText()
  const { links } = useSocial()
  const { settings } = useSiteSettings()
  const { downloadCv, isDownloading } = useDownloadCv(settings.cvUrl, settings.cvName || 'CV.pdf')
  const mainRef = useRef<HTMLElement>(null)

  const nets = SOCIAL_NETWORKS.filter((n) => socialHref(n, links[n.id]))

  useEffect(() => {
    if (prefersReducedMotion()) return
    if (!motion) return
    const { gsap } = motion
    const main = mainRef.current
    if (!main) return

    const ctx = gsap.context(() => {
      /* Hero */
      gsap.set('.ct-hero__file', { autoAlpha: 0, y: 12 })
      gsap.set('.ct-hero__title', { autoAlpha: 0, y: 26 })
      gsap.set('.ct-hero__lede', { autoAlpha: 0, y: 18 })

      /* Info cards */
      gsap.set('.ct-info-card', { autoAlpha: 0, y: 22, scale: 0.97 })

      /* Form section */
      gsap.set('.ct-form-section .ct-section__head', { autoAlpha: 0, x: -16 })
      gsap.set('.ct-form-wrap', { autoAlpha: 0, y: 30 })

      /* Social */
      gsap.set('.ct-social-section .ct-section__head', { autoAlpha: 0, x: -16 })
      gsap.set('.ct-social-card', { autoAlpha: 0, y: 18, scale: 0.95 })

      /* CV */
      gsap.set('.ct-cv-section .ct-section__head', { autoAlpha: 0, x: -16 })
      gsap.set('.ct-cv-card', { autoAlpha: 0, y: 24 })

      /* Hero intro timeline */
      const heroTl = gsap.timeline({ defaults: { ease: 'power4.out' } })
      heroTl
        .to('.ct-hero__file', { autoAlpha: 1, y: 0, duration: 0.5 }, 0.1)
        .to('.ct-hero__title', { autoAlpha: 1, y: 0, duration: 0.9 }, 0.3)
        .to('.ct-hero__lede', { autoAlpha: 1, y: 0, duration: 0.7 }, 0.6)

      /* Info cards — IntersectionObserver trigger */
      const infoCards = main.querySelectorAll('.ct-info-card')
      const infoSection = main.querySelector('.ct-info-section')
      if (infoSection) {
        let infoPlayed = false
        const infoIo = new IntersectionObserver((entries) => {
          for (const e of entries) {
            if (e.isIntersecting && !infoPlayed) {
              infoPlayed = true
              gsap.to(infoCards, {
                autoAlpha: 1, y: 0, scale: 1,
                duration: 0.65, stagger: 0.1, ease: 'power3.out',
              })
              infoIo.disconnect()
            }
          }
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 })
        infoIo.observe(infoSection)
      }

      /* Form section */
      const formSection = main.querySelector('.ct-form-section')
      if (formSection) {
        let formPlayed = false
        const formIo = new IntersectionObserver((entries) => {
          for (const e of entries) {
            if (e.isIntersecting && !formPlayed) {
              formPlayed = true
              gsap.to('.ct-form-section .ct-section__head', { autoAlpha: 1, x: 0, duration: 0.5, ease: 'power3.out' })
              gsap.to('.ct-form-wrap', { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out', delay: 0.15 })
              formIo.disconnect()
            }
          }
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 })
        formIo.observe(formSection)
      }

      /* Social section */
      const socialSection = main.querySelector('.ct-social-section')
      if (socialSection) {
        let socialPlayed = false
        const socialIo = new IntersectionObserver((entries) => {
          for (const e of entries) {
            if (e.isIntersecting && !socialPlayed) {
              socialPlayed = true
              gsap.to('.ct-social-section .ct-section__head', { autoAlpha: 1, x: 0, duration: 0.5, ease: 'power3.out' })
              gsap.to('.ct-social-card', {
                autoAlpha: 1, y: 0, scale: 1,
                duration: 0.55, stagger: 0.08, ease: 'power3.out', delay: 0.15,
              })
              socialIo.disconnect()
            }
          }
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 })
        socialIo.observe(socialSection)
      }

      /* CV section */
      const cvSection = main.querySelector('.ct-cv-section')
      if (cvSection) {
        let cvPlayed = false
        const cvIo = new IntersectionObserver((entries) => {
          for (const e of entries) {
            if (e.isIntersecting && !cvPlayed) {
              cvPlayed = true
              gsap.to('.ct-cv-section .ct-section__head', { autoAlpha: 1, x: 0, duration: 0.5, ease: 'power3.out' })
              gsap.to('.ct-cv-card', { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out', delay: 0.15 })
              cvIo.disconnect()
            }
          }
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 })
        cvIo.observe(cvSection)
      }
    }, mainRef)

    return () => ctx.revert()
  }, [motion])

  return (
    <main ref={mainRef} className="ct-main">
      {/* Background decorations */}
      <div className="ct-grid-bg" aria-hidden="true" />
      <span className="ct-aurora ct-aurora--a" aria-hidden="true" />
      <span className="ct-aurora ct-aurora--b" aria-hidden="true" />
      <span className="ct-aurora ct-aurora--c" aria-hidden="true" />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="ct-hero" aria-labelledby="ct-title">
        <div className="ct-container">
          <span className="ct-hero__file" data-i18n="ct_file">{ui('ct_file')}</span>
          <h1 id="ct-title" className="ct-hero__title" data-i18n="ct_title">{ui('ct_title')}</h1>
          <p className="ct-hero__lede" data-i18n="ct_lede">{ui('ct_lede')}</p>
        </div>
      </section>

      {/* ── Info Cards ───────────────────────────────────────── */}
      <section className="ct-info-section" aria-label={ui('ct_info_h2')}>
        <div className="ct-container">
          <div className="ct-section__head">
            <span className="ct-section__fig">{ui('ct_info_title')}</span>
            <h2 className="ct-section__h2" data-i18n="ct_info_h2">{ui('ct_info_h2')}</h2>
          </div>
          <div className="ct-info-grid">
            {/* Email card */}
            <div className="ct-info-card">
              <Corners />
              <div className="ct-info-card__icon">
                <i className="fa-solid fa-envelope" />
              </div>
              <span className="ct-info-card__label" data-i18n="ct_email_label">{ui('ct_email_label')}</span>
              <a
                href="#ct-form-anchor"
                className="ct-info-card__value ct-info-card__value--link"
                onClick={(e) => {
                  e.preventDefault()
                  sendGAEvent('event', 'email_click')
                  document.getElementById('ct-form-anchor')?.scrollIntoView({ behavior: 'smooth' })
                }}
              >
                lumontana23@gmail.com
              </a>
            </div>

            {/* Location card */}
            <div className="ct-info-card">
              <Corners />
              <div className="ct-info-card__icon">
                <i className="fa-solid fa-location-dot" />
              </div>
              <span className="ct-info-card__label" data-i18n="ct_location_label">{ui('ct_location_label')}</span>
              <span className="ct-info-card__value">Montevideo, Uruguay</span>
            </div>

            {/* Status card */}
            <div className="ct-info-card">
              <Corners />
              <div className="ct-info-card__icon">
                <i className="fa-solid fa-signal" />
              </div>
              <span className="ct-info-card__label" data-i18n="ct_status_label">{ui('ct_status_label')}</span>
              <span className="ct-info-card__value ct-info-card__value--status">
                <span className="ct-status-dot" />
                {ui('ct_available')}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Contact Form ─────────────────────────────────────── */}
      <section className="ct-form-section" id="ct-form-anchor" aria-labelledby="ct-form-h2">
        <div className="ct-container">
          <div className="ct-section__head">
            <span className="ct-section__fig">{ui('ct_form_title')}</span>
            <h2 id="ct-form-h2" className="ct-section__h2" data-i18n="ct_form_h2">{ui('ct_form_h2')}</h2>
          </div>
          <div className="ct-form-wrap">
            <Corners />
            <span className="ct-form-wrap__fig">{ui('ct_form_fig')}</span>
            <ContactForm />
          </div>
        </div>
      </section>

      {/* ── Social ───────────────────────────────────────────── */}
      {nets.length > 0 && (
        <section className="ct-social-section" aria-labelledby="ct-social-h2">
          <div className="ct-container">
            <div className="ct-section__head">
              <span className="ct-section__fig">{ui('ct_social_title')}</span>
              <h2 id="ct-social-h2" className="ct-section__h2" data-i18n="ct_social_h2">{ui('ct_social_h2')}</h2>
            </div>
            <div className="ct-social-grid">
              {nets.map((n) => (
                <a
                  key={n.id}
                  href={n.type === 'email' ? '#ct-form-anchor' : socialHref(n, links[n.id])}
                  target={n.type === 'email' ? undefined : '_blank'}
                  rel="noopener noreferrer"
                  className="ct-social-card"
                  onClick={(e) => {
                    if (n.type === 'email') {
                      e.preventDefault()
                      sendGAEvent('event', 'email_click')
                      document.getElementById('ct-form-anchor')?.scrollIntoView({ behavior: 'smooth' })
                    } else {
                      sendGAEvent('event', `social_click_${n.id}`)
                    }
                  }}
                >
                  <Corners />
                  <i className={`${n.brand ? 'fa-brands' : 'fa-solid'} ${n.icon} ct-social-card__icon`} />
                  <span className="ct-social-card__name">{n.label}</span>
                  <i className="fa-solid fa-arrow-up-right-from-square ct-social-card__arrow" />
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CV Download ──────────────────────────────────────── */}
      <section className="ct-cv-section" aria-labelledby="ct-cv-h2">
        <div className="ct-container">
          <div className="ct-section__head">
            <span className="ct-section__fig">{ui('ct_cv_title')}</span>
            <h2 id="ct-cv-h2" className="ct-section__h2" data-i18n="ct_cv_h2">{ui('ct_cv_h2')}</h2>
          </div>
          <div className="ct-cv-card">
            <Corners />
            <div className="ct-cv-card__body">
              <div className="ct-cv-card__icon-wrap">
                <i className="fa-solid fa-file-pdf" />
              </div>
              <div className="ct-cv-card__text">
                <p className="ct-cv-card__title">Curriculum Vitae</p>
                <p className="ct-cv-card__desc" data-i18n="ct_cv_desc">{ui('ct_cv_desc')}</p>
              </div>
              <a
                className={`ct-cv-card__btn${!settings.cvUrl || isDownloading ? ' is-disabled' : ''}`}
                href={settings.cvUrl ? '/api/cv' : undefined}
                onClick={settings.cvUrl ? downloadCv : undefined}
                title={settings.cvUrl ? ui('download_cv') : ui('cv_unavailable')}
                aria-label={ui('download_cv')}
                aria-disabled={!settings.cvUrl || undefined}
              >
                <i className={`fa-solid ${isDownloading ? 'fa-spinner fa-spin' : 'fa-download'}`} />
                <span>{ui('download_cv')}</span>
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

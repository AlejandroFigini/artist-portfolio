'use client'

/* ContactPage (/contact) — página de contacto dedicada.
   Blueprint cinematic (violeta, contenedores con esquinas, labels mono, grid
   blueprint de fondo, auroras). Secciones: hero, info cards, formulario inline,
   redes sociales, descarga CV. GSAP reveals on-scroll. */

import '@/styles/contact-page.css'

import { useEffect, useRef } from 'react'
import { useMotionReady, prefersReducedMotion } from '@/hooks/useGSAP'
import { state, useCmsStore, useUiText } from '@/lib/cms/store'
import { useCmsText } from '@/lib/cms/content-context'
import HeroMediaCarousel from '@/components/home/HeroMediaCarousel'
import { SOCIAL_NETWORKS, socialHref } from '@/lib/social'
import { useSocial } from '@/components/ui/SocialProvider'
import { useSiteSettings } from '@/components/ui/SiteSettingsProvider'
import { useDownloadCv } from '@/hooks/useDownloadCv'
import { sendGAEvent } from '@next/third-parties/google'
import ContactForm from './ContactForm'

/* Texto base de los contenedores CMS del hero. `t()` devuelve esto mientras el
   admin no lo edite; una vez editado manda cms_data (y sus traducciones). */
const CT_TITLE = 'Get in touch'
const CT_LEDE =
  "Have a project in mind or just want to say hello? I'd love to hear from you. " +
  'Reach out through any of the channels below.'
const CT_STATUS = 'Available for projects'

/* Mismo gesto que el hero de la portada: el gestor de la colección se abre por
   evento, no por props (lo escucha CmsRoot). */
const openCarousel = (prefix: string) =>
  window.dispatchEvent(new CustomEvent('cms:carouselManager', { detail: { prefix } }))

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
  useCmsStore() // re-render al entrar/salir de admin (muestra/oculta el engranaje)
  const isAdmin = state.isAdmin
  // Resuelve contra el contenido del servidor: el hero de /contact sale escrito
  // en el HTML en vez de esperar a que hidrate.
  const text = useCmsText()
  const { links } = useSocial()
  const { settings } = useSiteSettings()
  const { downloadCv, isDownloading } = useDownloadCv(settings.cvUrl, settings.cvName || 'CV.pdf')
  const mainRef = useRef<HTMLElement>(null)

  /* Los 6 cuadros de redes son solo enlaces externos: el email tiene su propia
     tarjeta de info y el formulario, así que no duplica lugar en la grilla. */
  const socialNets = SOCIAL_NETWORKS.filter((n) => n.type !== 'email' && socialHref(n, links[n.id])).slice(0, 6)
  // Dirección visible = la que el admin configuró en Gestión (fuente única).
  const emailAddress = (links.email || '').split(',')[0].trim()

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
      /* La portada casi no se mueve al scrollear: mientras el hero sube, la capa
         baja una fracción de su propio alto y compensa la mayor parte de ese
         desplazamiento. Sigue recortada por el cover, que sí se va con la página.

         Arranca en 0 y no en un valor negativo: 0 es la posición en la que la
         capa está centrada sobre el cover (ver `.ct-hero__bg-inner`), así que
         la imagen se ve centrada al cargar y el recorrido gasta el margen
         superior. Con un rango simétrico el centro caía en la mitad del scroll
         y al entrar a la página se veía la mitad inferior de la imagen.

         `yPercent` y no píxeles: se recalcula solo al cambiar el viewport, sin
         medir el hero a mano ni refrescar el trigger en cada resize. */
      const bgInner = main.querySelector<HTMLElement>('.ct-hero__bg-inner')
      if (bgInner) {
        /* El recorrido sale de la geometría real, no de un número acá. El margen
           disponible es `|top|`, y gastarlo entero destaparía el borde superior,
           así que se usa el 96%. Derivarlo del CSS permite que el media query de
           móvil —que achica el margen para no recortar tanto la ilustración—
           ajuste el efecto sin tener que tocar también este archivo, y que los
           dos no se desincronicen. Como función, ScrollTrigger lo recalcula en
           cada refresh, así que también sobrevive a un cambio de viewport. */
        const recorrido = () => {
          const cs = getComputedStyle(bgInner)
          const alto = parseFloat(cs.height)
          if (!alto) return 0
          return (Math.abs(parseFloat(cs.top)) / alto) * 100 * 0.96
        }
        gsap.fromTo(
          bgInner,
          { yPercent: 0 },
          {
            yPercent: recorrido,
            ease: 'none',
            scrollTrigger: {
              trigger: '.ct-hero', start: 'top top', end: 'bottom top',
              scrub: true, invalidateOnRefresh: true,
            },
          },
        )
      }
    }, mainRef)

    return () => ctx.revert()
  }, [motion])

  /* Reveal de la sección Social, en su propio efecto y no en el general.

     Sus enlaces vienen de un fetch a `/api/social`, así que la sección se monta
     TARDE: medido en carga en frío, el chunk de GSAP está listo a los 682ms y
     `/api/social` resuelve a los 909ms. Con el reveal adentro del efecto
     general, `gsap.set` corría 227ms antes de que existiera un solo cuadro —no
     encontraba nada— y el IntersectionObserver se colgaba de una sección que
     todavía no estaba en el DOM. Resultado: la sección entera aparecía de
     golpe, y que a veces se viera animada dependía de que el fetch le ganara
     la carrera al chunk.

     Atado a `socialNets.length` corre recién cuando la sección existe. */
  useEffect(() => {
    if (prefersReducedMotion()) return
    if (!motion) return
    if (!socialNets.length) return
    const { gsap } = motion
    const section = mainRef.current?.querySelector('.ct-social-section')
    if (!section) return

    const ctx = gsap.context(() => {
      /* Esconder es lo peligroso, no animar. Esta sección se monta TARDE
         —espera al fetch—, así que para cuando corre esto el navegador ya pudo
         haber restaurado el scroll de una recarga en cualquier punto de la
         página. Si la sección ya está en pantalla, o ya quedó atrás, el
         `autoAlpha: 0` la apaga y el observer no vuelve a disparar nunca: se
         queda invisible para siempre. Es la regla del proyecto —un fallo no
         puede dejar contenido oculto—, así que solo se prepara el reveal
         cuando la sección está ÍNTEGRAMENTE por debajo del pliegue. */
      if (section.getBoundingClientRect().top < window.innerHeight) return

      gsap.set('.ct-social-section .ct-section__head', { autoAlpha: 0, x: -16 })
      gsap.set('.ct-social-card', { autoAlpha: 0, y: 18, scale: 0.95 })
      /* El contenedor de la animación no va en el stagger de los cuadros: es un
         bloque propio al lado de la grilla, no el séptimo de la fila. Arranca
         con ellos y sube más despacio. */
      gsap.set('.ct-social-anim-container', { autoAlpha: 0, y: 24 })

      let played = false
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !played) {
            played = true
            gsap.to('.ct-social-section .ct-section__head', { autoAlpha: 1, x: 0, duration: 0.5, ease: 'power3.out' })
            gsap.to('.ct-social-card', {
              autoAlpha: 1, y: 0, scale: 1,
              duration: 0.55, stagger: 0.08, ease: 'power3.out', delay: 0.15,
            })
            gsap.to('.ct-social-anim-container', {
              autoAlpha: 1, y: 0,
              duration: 0.8, ease: 'power3.out', delay: 0.15,
            })
            io.disconnect()
          }
        }
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 })
      io.observe(section)
      return () => io.disconnect()
    }, mainRef)

    return () => ctx.revert()
  }, [motion, socialNets.length])

  /* Detiene el vaivén de la portada cuando el hero sale de cuadro: es una
     animación infinita y no tiene por qué seguir corriendo donde nadie la ve.
     Solo eso — la portada está acotada al hero, así que sale de pantalla sola
     y no hace falta ocultar nada.

     Efecto aparte y sin depender de `motion` a propósito: no puede quedar
     supeditado a que el chunk de GSAP haya bajado. */
  useEffect(() => {
    const slot = mainRef.current?.querySelector<HTMLElement>('.ct-hero__bg-slot')
    const hero = mainRef.current?.querySelector('.ct-hero')
    if (!slot || !hero || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(
      ([e]) => slot.classList.toggle('is-parked', !e.isIntersecting),
      { rootMargin: '10% 0px' },
    )
    io.observe(hero)
    return () => { io.disconnect(); slot.classList.remove('is-parked') }
  }, [])

  /* Reel de la sección Social: reproduce solo en cuadro. Efecto aparte y sin
     depender de `motion` a propósito — el gate de reproducción no puede quedar
     supeditado a que el chunk de GSAP haya bajado. La pausa al salir la cubre
     además ViewportGate; acá está el arranque. */
  useEffect(() => {
    const v = mainRef.current?.querySelector<HTMLVideoElement>('.ct-social-anim')
    if (!v || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) void v.play().catch(() => {})
        else v.pause()
      },
      { threshold: 0.15 },
    )
    io.observe(v)
    return () => { io.disconnect(); v.pause() }
  }, [])

  return (
    <main ref={mainRef} className="ct-main">
      {/* Background decorations */}
      <div className="ct-grid-bg" aria-hidden="true" />
      <span className="ct-aurora ct-aurora--a" aria-hidden="true" />
      <span className="ct-aurora ct-aurora--b" aria-hidden="true" />
      <span className="ct-aurora ct-aurora--c" aria-hidden="true" />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="ct-hero" aria-labelledby="ct-title">
        {/* Portada por colección, igual que el hero de la portada: N slides con
            crossfade y el gestor detrás del engranaje. El contenedor es el slot;
            las slides se pintan adentro y se reemplazan sin tocarlo. */}
        <div className="ct-hero__bg-slot" aria-hidden="true">
          <div className="ct-hero__bg-inner">
            <HeroMediaCarousel prefix="contact-hero" label="Background Carousel — Contact" />
          </div>
        </div>
        {isAdmin && (
          <button
            className="cms-hero-gear ct-hero__gear"
            title="Configure the Background Carousel — Contact"
            aria-label="Configure the Background Carousel — Contact"
            onClick={(e) => { e.preventDefault(); openCarousel('contact-hero') }}
          >
            <i className="fa-solid fa-layer-group" />
          </button>
        )}
        <div className="ct-container">
          <div className="ct-hero-wrap">
            <Corners />
            <span className="ct-hero__file ct-section__fig" data-i18n="ct_file">{ui('ct_file')}</span>
            <h1 id="ct-title" className="ct-hero__title">{text('contact.hero.title#0', CT_TITLE)}</h1>
            <p className="ct-hero__lede">{text('contact.hero.lede#0', CT_LEDE)}</p>
          </div>
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
                {emailAddress || ui('ct_email_fallback')}
              </a>
            </div>

            {/* Location card */}
            <div className="ct-info-card">
              <Corners />
              <div className="ct-info-card__icon">
                <i className="fa-solid fa-location-dot" />
              </div>
              <span className="ct-info-card__label" data-i18n="ct_location_label">{ui('ct_location_label')}</span>
              <span className="ct-info-card__value" data-i18n="ct_location_value">{ui('ct_location_value')}</span>
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
                {/* Contenedor de texto propio: el estado lo edita la artista desde
                    el CMS, así que no puede salir de UI_TRANSLATIONS. El punto
                    verde queda fuera — el engine escribe el textContent entero. */}
                <span className="ct-status-text">{text('contact.status#0', CT_STATUS)}</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Social ───────────────────────────────────────────── */}
      {socialNets.length > 0 && (
        <section className="ct-social-section" aria-labelledby="ct-social-h2">
          <div className="ct-container">
            <div className="ct-section__head">
              <span className="ct-section__fig">{ui('ct_social_title')}</span>
              <h2 id="ct-social-h2" className="ct-section__h2" data-i18n="ct_social_h2">{ui('ct_social_h2')}</h2>
            </div>
            <div className="ct-social-layout">
              <div className="ct-social-grid">
                {socialNets.map((n) => (
                  <a
                    key={n.id}
                    href={socialHref(n, links[n.id])}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ct-social-card"
                    onClick={() => sendGAEvent('event', `social_click_${n.id}`)}
                  >
                    <Corners />
                    <i className={`${n.brand ? 'fa-brands' : 'fa-solid'} ${n.icon} ct-social-card__icon`} />
                    <span className="ct-social-card__name">{n.label}</span>
                    <i className="fa-solid fa-arrow-up-right-from-square ct-social-card__arrow" />
                  </a>
                ))}
              </div>
              {/* Contenedor primero, contenido después: el engine indexa el <video>
                  por `.ct-social-anim` y pinta el estado vacío estándar (marco
                  punteado + nube + nombre) sobre el padre mientras no haya media. */}
              <div className="ct-social-anim-container">
                <Corners />
                {/* Sin `autoplay`: /contact no monta HomeFx, así que nada lo
                    pausaba y el reel de la tercera sección bajaba y reproducía
                    en loop desde la carga, compitiendo con el formulario que es
                    el objetivo real de la ruta. Lo arranca el observer del
                    efecto de abajo, solo en cuadro. */}
                <video className="ct-social-anim" muted loop playsInline preload="none" />
              </div>
            </div>
          </div>
        </section>
      )}

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
                <p className="ct-cv-card__title" data-i18n="ct_cv_name">{ui('ct_cv_name')}</p>
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

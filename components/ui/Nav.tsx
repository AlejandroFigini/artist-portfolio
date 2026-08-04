'use client'

/* Nav — portado de shared-ui.js (NAV). Estado del menú en React:
   body.nav-open (hamburguesa), .dropdown.open, .lang-dropdown.active.
   Rediseño blueprint (styles/nav.css): visor de corchetes que enmarca
   el link activo/hover (ref. selectores HUD tipo Active Theory en
   Awwwards) + regla de progreso de lectura + encuadre al scrollear. */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ensureGSAP, gsap, prefersReducedMotion } from '@/hooks/useGSAP'
import { state, useCmsStore } from '@/lib/cms/store'
import { setLanguage } from '@/components/cms/engine'
import { ALL_LANGS, LANG_META, type Lang } from '@/lib/i18n'
import { SOCIAL_NETWORKS, socialHref } from '@/lib/social'
import { useSocial } from '@/components/ui/SocialProvider'
import { useSiteSettings } from '@/components/ui/SiteSettingsProvider'
import { sendGAEvent } from '@next/third-parties/google'

const ContactModal = lazy(() => import('@/components/ui/ContactModal'))

const GALLERY_LINKS = [
  { href: '/illustrations', icon: 'fa-paintbrush', label: 'Illustrations', i18n: 'nav_illustrations' },
  { href: '/animations', icon: 'fa-clapperboard', label: 'Animations', i18n: 'nav_animations' },
  { href: '/characters', icon: 'fa-user-astronaut', label: 'Characters', i18n: 'nav_characters' },
  { href: '/models-3d', icon: 'fa-cube', label: '3D Models', i18n: 'nav_3d' },
  { href: '/multimedia', icon: 'fa-photo-film', label: 'Multimedia', i18n: 'nav_multimedia' },
]

export default function Nav() {
  const pathname = usePathname()
  useCmsStore() // re-render al cambiar el idioma global
  const { links } = useSocial()
  const { settings } = useSiteSettings()
  // Con URL configurada se usa esa; sin configurar cae al home genérico de la
  // red (mismo patrón que About) — el menú Portfolio nunca queda vacío.
  const portfolioNets = SOCIAL_NETWORKS.filter((n) => socialHref(n, links[n.id]) || n.home)
  const [navOpen, setNavOpen] = useState(false)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [dropdown, setDropdown] = useState<'gallery' | 'portfolio' | null>(null)
  const [langOpen, setLangOpen] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const activeLang = LANG_META[state.lang]
  const headerRef = useRef<HTMLElement>(null)
  const linksRef = useRef<HTMLElement>(null)
  const viewfinderRef = useRef<HTMLSpanElement>(null)
  const progressRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    document.body.classList.toggle('nav-open', navOpen)
    return () => document.body.classList.remove('nav-open')
  }, [navOpen])

  useEffect(() => {
    const handler = () => { setContactOpen(true); setNavOpen(false); setDropdown(null); }
    window.addEventListener('open-contact', handler)
    return () => window.removeEventListener('open-contact', handler)
  }, [])

  useEffect(() => {
    const closeAll = () => { setDropdown(null); setLangOpen(false) }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeAll(); setNavOpen(false) }
    }
    const onClick = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) closeAll()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('click', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('click', onClick)
    }
  }, [])

  // header.scrolled (compacta la barra al scrollear; en legacy lo hacía ScrollTrigger)
  // + regla de progreso de lectura (scaleX según avance del documento)
  useEffect(() => {
    const onScroll = () => {
      headerRef.current?.classList.toggle('scrolled', window.scrollY > 50)
      const fill = progressRef.current
      if (fill) {
        const max = document.documentElement.scrollHeight - window.innerHeight
        fill.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`
      }
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Visor de corchetes: enmarca el link bajo el cursor y descansa en el activo.
  // Se activa/desactiva con el media query (la ventana puede cambiar de modo).
  useEffect(() => {
    const links = linksRef.current
    const finder = viewfinderRef.current
    if (!links || !finder) return
    const mq = window.matchMedia('(min-width: 993px) and (hover: hover)')
    ensureGSAP()
    const reduced = prefersReducedMotion()
    const PAD = 10

    const place = (el: HTMLElement | null, instant = false) => {
      if (!el) {
        gsap.to(finder, { autoAlpha: 0, duration: reduced ? 0 : 0.25 })
        return
      }
      // rects relativos al contenedor: los .dropbtn viven anidados en
      // .dropdown y su offsetLeft no es relativo a .nav-links
      const linksRect = links.getBoundingClientRect()
      const r = el.getBoundingClientRect()
      const vars = {
        x: r.left - linksRect.left - PAD,
        width: r.width + PAD * 2,
        autoAlpha: 1,
        duration: instant || reduced ? 0 : 0.45,
        ease: 'power3.out',
      }
      if (instant || reduced) gsap.set(finder, vars)
      else gsap.to(finder, { ...vars, overwrite: 'auto' })
    }

    const activeEl = (): HTMLElement | null => {
      if (pathname === '/') return links.querySelector<HTMLElement>('a[href="/"]')
      if (GALLERY_LINKS.some((l) => l.href === pathname)) return links.querySelector<HTMLElement>('#gallery-label')
      return null
    }

    // gracia anti-flicker: cruzar el hueco entre dropbtn y sub-opciones
    // dispara mouseleave un instante; el visor no debe volver a Feed
    let leaveTimer: number | undefined
    const onOver = (e: MouseEvent) => {
      window.clearTimeout(leaveTimer)
      const target = e.target as HTMLElement
      // dentro de un dropdown (botón o sub-opciones) el visor se ancla al
      // padre: el marco "contiene" la rama abierta y no se escapa a Feed
      const dd = target.closest<HTMLElement>('.nav-links .dropdown')
      if (dd) { place(dd.querySelector<HTMLElement>('.dropbtn')); return }
      const t = target.closest<HTMLElement>('.nav-links > a')
      if (t) place(t)
    }
    const onLeave = () => {
      window.clearTimeout(leaveTimer)
      leaveTimer = window.setTimeout(() => place(activeEl()), 180)
    }
    const onResize = () => { if (mq.matches) place(activeEl(), true) }

    const setup = () => {
      place(activeEl(), true)
      links.addEventListener('mouseover', onOver)
      links.addEventListener('mouseleave', onLeave)
    }
    const teardown = () => {
      window.clearTimeout(leaveTimer)
      links.removeEventListener('mouseover', onOver)
      links.removeEventListener('mouseleave', onLeave)
      gsap.set(finder, { autoAlpha: 0 })
    }
    const onMq = () => { if (mq.matches) setup(); else teardown() }

    if (mq.matches) setup()
    mq.addEventListener('change', onMq)
    window.addEventListener('resize', onResize)
    return () => {
      mq.removeEventListener('change', onMq)
      window.removeEventListener('resize', onResize)
      teardown()
      gsap.killTweensOf(finder)
    }
  }, [pathname])

  const closeNav = () => { setNavOpen(false); setDropdown(null) }
  const toggleDropdown = (name: 'gallery' | 'portfolio') =>
    setDropdown((d) => (d === name ? null : name))

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX === null) return
    const currentTouchX = e.targetTouches[0].clientX
    const diff = currentTouchX - touchStartX
    
    // Si se desliza hacia la derecha más de 50px y el menú está abierto
    if (diff > 50 && navOpen) {
      closeNav()
      setTouchStartX(null)
    }
  }

  return (
    <>
      <header ref={headerRef}>
        <div className="nav-container">
          <Link href="/" className="logo" onClick={closeNav}>
            Lucia Montaña <span className="highlight"><span className="logo-sep">|</span> Portfolio</span>
          </Link>
          <button
            className="nav-toggle"
            id="nav-toggle"
            aria-label="Open menu"
            aria-expanded={navOpen}
            onClick={() => setNavOpen((o) => !o)}
          >
            <span></span><span></span><span></span>
          </button>
          <nav 
            className="nav-links" 
            ref={linksRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
          >
            <div className="logo mobile-drawer-logo" onClick={closeNav}>
              Lucia Montaña <span className="separator">|</span> <span className="highlight inline-highlight">Portfolio</span>
            </div>
            <div className="nav-menu-scrollable">
              <Link href="/" data-i18n="nav_feed" onClick={closeNav}>Feed</Link>
              <div className={`dropdown${dropdown === 'gallery' ? ' open' : ''}`}>
                <div
                  className="dropbtn"
                  id="gallery-label"
                  onClick={(e) => { e.stopPropagation(); toggleDropdown('gallery') }}
                >
                  <span data-i18n="nav_gallery">Gallery</span> <i className="fa-solid fa-chevron-down" style={{ fontSize: '0.7em' }}></i>
                </div>
                <div className="dropdown-content">
                  {GALLERY_LINKS.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className={pathname === l.href ? 'active' : undefined}
                      onClick={closeNav}
                    >
                      <i className={`fa-solid ${l.icon}`}></i> <span data-i18n={l.i18n}>{l.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
              <div className={`dropdown${dropdown === 'portfolio' ? ' open' : ''}`}>
                <div
                  className="dropbtn"
                  onClick={(e) => { e.stopPropagation(); toggleDropdown('portfolio') }}
                >
                  <span data-i18n="nav_portfolio">Portfolio</span> <i className="fa-solid fa-chevron-down" style={{ fontSize: '0.7em' }}></i>
                </div>
                <div className="dropdown-content">
                  {portfolioNets.map((n) => (
                    n.type === 'email' ? (
                      <a key={n.id} href="#" onClick={(e) => { e.preventDefault(); setContactOpen(true); closeNav(); sendGAEvent('event', 'email_click') }}>
                        <i className={`fa-solid ${n.icon}`}></i> {n.label}
                      </a>
                    ) : (
                      <a key={n.id} href={socialHref(n, links[n.id]) || n.home} target="_blank" rel="noopener noreferrer" onClick={() => sendGAEvent('event', `social_click_${n.id}`)}>
                        <i className={`${n.brand ? 'fa-brands' : 'fa-solid'} ${n.icon}`}></i> {n.label}
                      </a>
                    )
                  ))}
                </div>
              </div>
              <Link href="/about" data-i18n="nav_about" onClick={closeNav}>About me</Link>
              <Link href="/#contacto" data-i18n="nav_contact" onClick={closeNav}>Contact</Link>
              {/* Gestión movido al dropdown de administrador en CmsRoot.tsx */}
              {/* visor blueprint: GSAP lo desliza entre links (styles/nav.css) */}
              <span className="nav-viewfinder" ref={viewfinderRef} aria-hidden="true"></span>
            </div>
            
            {/* Acciones móviles (duplicadas de la barra superior) */}
            <div className="mobile-drawer-actions">
              <button
                type="button"
                className="cv-min-btn"
                onClick={() => { setContactOpen(true); closeNav(); sendGAEvent('event', 'email_click') }}
              >
                <i className="fa-solid fa-envelope"></i><span>Email</span>
              </button>
              <a
                className={`cv-min-btn${settings.cvUrl ? '' : ' is-disabled'}`}
                href={settings.cvUrl || undefined}
                download={settings.cvUrl ? settings.cvName || 'CV.pdf' : undefined}
                target={settings.cvUrl ? '_blank' : undefined} rel="noopener noreferrer"
                onClick={() => sendGAEvent('event', 'cv_download')}
              >
                <i className="fa-solid fa-file-arrow-down"></i><span>CV</span>
              </a>
              <button
                className="login-min-btn"
                onClick={() => { closeNav(); document.querySelector<HTMLButtonElement>('#cms-auth-nav button')?.click(); }}
              >
                <i className="fa-solid fa-right-to-bracket"></i><span>Log in</span>
              </button>
              <div className="lang-selector-nav mobile-lang" style={{ display: 'flex' }}>
                <button
                  className="lang-btn"
                  onClick={(e) => { e.stopPropagation(); setLangOpen((o) => !o) }}
                >
                  {/* Bandera SVG inline de LANG_META: next/image no optimiza SVG. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={activeLang.svg} alt={activeLang.label} className="lang-flag-img" />
                  <span className="lang-code">{state.lang.toUpperCase()}</span>
                </button>
                <div className={`lang-dropdown${langOpen ? ' active' : ''}`}>
                  {ALL_LANGS.map((code) => (
                    <button
                      key={code}
                      className="lang-option"
                      onClick={() => { setLanguage(code as Lang); setLangOpen(false) }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={LANG_META[code].svg} alt={LANG_META[code].label} className="lang-flag-img" /> {LANG_META[code].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </nav>
          <div className="nav-actions">
            <button
              type="button"
              className="cv-min-btn"
              onClick={() => { setContactOpen(true); closeNav(); sendGAEvent('event', 'email_click') }}
              title="Contact me"
              aria-label="Contact me"
            >
              <i className="fa-solid fa-envelope"></i>
              <span>Email</span>
            </button>
            {/* Siempre presente; sin CV subido queda deshabilitado (sin href). */}
            <a
              className={`cv-min-btn${settings.cvUrl ? '' : ' is-disabled'}`} id="cv-download"
              href={settings.cvUrl || undefined}
              download={settings.cvUrl ? settings.cvName || 'CV.pdf' : undefined}
              target={settings.cvUrl ? '_blank' : undefined} rel="noopener noreferrer"
              title={settings.cvUrl ? 'Download CV' : 'CV not available yet'}
              aria-label="Download CV" aria-disabled={!settings.cvUrl || undefined}
              data-i18n-title="download_cv" data-i18n-aria="download_cv"
              onClick={() => sendGAEvent('event', 'cv_download')}
            >
              <i className="fa-solid fa-file-arrow-down"></i>
              <span data-i18n="cv">CV</span>
            </a>
            {/* cms.js renderiza aquí el botón de login / menú de sesión (Sesión 3) */}
            <div id="cms-auth-nav"></div>
            <div className="lang-selector-nav">
              <button
                className="lang-btn"
                id="lang-toggle-nav"
                aria-label="Change language"
                title="Language"
                onClick={(e) => { e.stopPropagation(); setLangOpen((o) => !o) }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={activeLang.svg} alt={activeLang.label} className="lang-flag-img" id="lang-flag-nav" />
                <span className="lang-code" id="lang-code-nav">{state.lang.toUpperCase()}</span>
              </button>
              <div className={`lang-dropdown${langOpen ? ' active' : ''}`} id="lang-dropdown-nav">
                {ALL_LANGS.map((code) => (
                  <button
                    key={code}
                    className="lang-option"
                    data-lang={code}
                    title={LANG_META[code].label}
                    onClick={() => { setLanguage(code as Lang); setLangOpen(false) }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={LANG_META[code].svg} alt={LANG_META[code].label} className="lang-flag-img" /> {LANG_META[code].label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* regla de progreso de lectura con graduación (styles/nav.css) */}
        <span className="nav-progress" aria-hidden="true">
          <span className="nav-progress-fill" ref={progressRef}></span>
        </span>
      </header>
      <div className="nav-backdrop" id="nav-backdrop" onClick={closeNav}></div>
      {contactOpen && (
        <Suspense fallback={null}>
          <ContactModal onClose={() => setContactOpen(false)} />
        </Suspense>
      )}
    </>
  )
}

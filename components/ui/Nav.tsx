'use client'

/* Nav — portado de shared-ui.js (NAV). Estado del menú en React:
   body.nav-open (hamburguesa), .dropdown.open, .lang-dropdown.active.
   Rediseño blueprint (styles/nav.css): visor de corchetes que enmarca
   el link activo/hover (ref. selectores HUD tipo Active Theory en
   Awwwards) + regla de progreso de lectura + encuadre al scrollear. */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useMotionReady, prefersReducedMotion } from '@/hooks/useGSAP'
import { state, useUiText } from '@/lib/cms/store'
import { setLanguage } from '@/components/cms/engine'
import { ALL_LANGS, LANG_META, type Lang } from '@/lib/i18n'
import { SOCIAL_NETWORKS, socialHref } from '@/lib/social'
import { useSocial } from '@/components/ui/SocialProvider'
import { useSiteSettings } from '@/components/ui/SiteSettingsProvider'
import { sendGAEvent } from '@next/third-parties/google'
import { useDownloadCv } from '@/hooks/useDownloadCv'
import { SITE_SECTIONS } from '@/lib/site-sections'
import { scrollToSection } from '@/lib/smooth-scroll'
import DecorAnim from '@/components/ui/DecorAnim'
import { animSources } from '@/lib/settings'

const ContactModal = lazy(() => import('@/components/ui/ContactModal'))

/* Las galerías son secciones del feed, no rutas: el menú ancla a la portada
   (ver lib/site-sections). Desde otra ruta el <Link> navega a /#id y el scroll
   lo hace SectionHashScroll al montar la portada. */
const GALLERY_LINKS = SITE_SECTIONS

export default function Nav() {
  const motion = useMotionReady() // GSAP llega en su propio chunk
  const pathname = usePathname()
  const ui = useUiText() // re-render al cambiar el idioma global
  const { links } = useSocial()
  const { settings } = useSiteSettings()
  const { downloadCv, isDownloading } = useDownloadCv(settings.cvUrl, settings.cvName || 'CV.pdf')
  // Con URL configurada se usa esa; sin configurar cae al home genérico de la
  // red (mismo patrón que About) — el menú Portfolio nunca queda vacío.
  const portfolioNets = SOCIAL_NETWORKS.filter((n) => socialHref(n, links[n.id]) || n.home)
  const [navOpen, setNavOpen] = useState(false)
  /* Origen del gesto en un ref y no en estado: se lee de forma síncrona dentro
     del propio handler y guardarlo en estado provocaba un render por cada
     touchstart sin que nada de la UI dependiera del valor. */
  const swipeOrigin = useRef<{ x: number; y: number } | null>(null)
  const [dropdown, setDropdown] = useState<'gallery' | 'portfolio' | null>(null)
  /* Qué selector de idioma está abierto. Antes era un booleano compartido por
     el de la barra superior y el del drawer: tocar el del drawer abría TAMBIÉN
     el de la barra (que en móvil aparece arriba, fuera del menú). Ahora cada
     uno se identifica y solo abre el suyo. */
  const [langMenu, setLangMenu] = useState<'bar' | 'drawer' | null>(null)
  const [contactOpen, setContactOpen] = useState(false)
  const activeLang = LANG_META[state.lang]
  const isAdmin = state.isAdmin
  const headerRef = useRef<HTMLElement>(null)
  const linksRef = useRef<HTMLElement>(null)
  const viewfinderRef = useRef<HTMLSpanElement>(null)
  const progressRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    document.body.classList.toggle('nav-open', navOpen)
    return () => document.body.classList.remove('nav-open')
  }, [navOpen])

  /* Cascada de entrada del drawer: cada opción recibe su posición en `--nav-i`
     y el CSS la convierte en `transition-delay` (styles/nav.css).

     Va por JS y no con `nth-child` porque en el drawer los desplegables son
     `display: contents`: sus opciones se VEN como hermanas de las principales
     pero son hijas de otro nodo, así que ningún selector estructural las
     numera en el orden en que se leen. `querySelectorAll` sí devuelve el orden
     del documento, que acá es el orden visual.

     Si esto no llegara a correr, el `var(--nav-i, 0)` del CSS hace que entren
     todas juntas — nunca quedan invisibles. */
  useEffect(() => {
    if (!navOpen) return
    const root = linksRef.current
    if (!root) return
    root
      .querySelectorAll<HTMLElement>(
        '.nav-menu-scrollable > a, .nav-menu-scrollable .dropbtn, .nav-menu-scrollable .dropdown-content a, .mobile-drawer-actions > *',
      )
      .forEach((el, i) => el.style.setProperty('--nav-i', String(i)))
  }, [navOpen])

  useEffect(() => {
    const handler = () => { setContactOpen(true); setNavOpen(false); setDropdown(null); }
    window.addEventListener('open-contact', handler)
    return () => window.removeEventListener('open-contact', handler)
  }, [])

  useEffect(() => {
    const closeAll = () => { setDropdown(null); setLangMenu(null) }
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
  //
  // El handler leía `scrollHeight` y escribía `transform` + `classList` en el
  // mismo tick, en cada evento de scroll: la escritura ensucia el layout y la
  // lectura del evento siguiente lo fuerza a recalcularse entero (el
  // "forced reflow" del reporte). Ahora el alto del documento se mide una vez
  // y se refresca solo cuando puede haber cambiado (resize / mutación del
  // contenido), y las escrituras van en un rAF: el scroll queda sin lecturas
  // de layout.
  useEffect(() => {
    let maxScroll = 0
    let frame = 0

    const measure = () => { maxScroll = document.documentElement.scrollHeight - window.innerHeight }

    const paint = () => {
      frame = 0
      const y = window.scrollY
      headerRef.current?.classList.toggle('scrolled', y > 50)
      const fill = progressRef.current
      if (fill) fill.style.transform = `scaleX(${maxScroll > 0 ? Math.min(1, y / maxScroll) : 0})`
    }

    const onScroll = () => { if (!frame) frame = requestAnimationFrame(paint) }
    // En pestaña oculta el rAF no corre: al volver, ponerse al día sin esperar
    // a que el usuario scrollee.
    const onVisible = () => { if (!document.hidden) { measure(); paint() } }

    measure()
    paint()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', measure)
    document.addEventListener('visibilitychange', onVisible)
    // Las secciones code-split montan después: el alto del documento crece.
    const ro = new ResizeObserver(measure)
    ro.observe(document.documentElement)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', measure)
      document.removeEventListener('visibilitychange', onVisible)
      ro.disconnect()
    }
  }, [])

  // Visor de corchetes: enmarca el link bajo el cursor y descansa en el activo.
  // Se activa/desactiva con el media query (la ventana puede cambiar de modo).
  useEffect(() => {
    const links = linksRef.current
    const finder = viewfinderRef.current
    if (!links || !finder) return
    const mq = window.matchMedia('(min-width: 993px) and (hover: hover)')
    if (!motion) return
    const { gsap } = motion
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
      if (pathname === '/about') return links.querySelector<HTMLElement>('a[href="/about"]')
      if (pathname === '/contact') return links.querySelector<HTMLElement>('a[href="/contact"]')
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
      const t = target.closest<HTMLElement>('.nav-menu-scrollable > a')
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
  }, [motion, pathname])

  const closeNav = () => { setNavOpen(false); setDropdown(null) }
  const toggleDropdown = (name: 'gallery' | 'portfolio') =>
    setDropdown((d) => (d === name ? null : name))

  /* Cerrar el drawer deslizando el dedo.
     El panel entra desde el borde izquierdo, así que el gesto de descarte es
     empujarlo de vuelta hacia la izquierda. Antes se cerraba al deslizar a la
     DERECHA, que es la dirección en la que el panel entra: por eso el gesto
     natural no hacía nada.
     Se compara contra el desplazamiento vertical para no confundir el scroll
     del menú con un swipe. */
  const SWIPE_CLOSE_PX = 55

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.targetTouches[0]
    swipeOrigin.current = { x: t.clientX, y: t.clientY }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const origin = swipeOrigin.current
    if (!origin || !navOpen) return
    const t = e.targetTouches[0]
    const dx = t.clientX - origin.x
    const dy = t.clientY - origin.y

    // Intención horizontal: el eje X tiene que dominar sobre el Y.
    if (Math.abs(dx) <= Math.abs(dy)) return
    if (dx < -SWIPE_CLOSE_PX) {
      closeNav()
      swipeOrigin.current = null
    }
  }

  const handleTouchEnd = () => { swipeOrigin.current = null }

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
            aria-label={ui('open_menu')}
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
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
          >
            <div className="logo mobile-drawer-logo" onClick={closeNav}>
              Lucia Montaña <span className="separator">|</span> <span className="highlight inline-highlight">Portfolio</span>
            </div>
            <div className="nav-menu-scrollable">
              <Link href="/" onClick={closeNav}>{ui('nav_feed')}</Link>
              <div className={`dropdown${dropdown === 'gallery' ? ' open' : ''}`}>
                <div
                  className="dropbtn"
                  id="gallery-label"
                  onClick={(e) => { e.stopPropagation(); toggleDropdown('gallery') }}
                >
                  <span>{ui('nav_gallery')}</span> <i className="fa-solid fa-chevron-down" style={{ fontSize: '0.7em' }}></i>
                </div>
                <div className="dropdown-content">
                  {GALLERY_LINKS.map((l) => (
                    <Link
                      key={l.id}
                      href={`/#${l.id}`}
                      onClick={(e) => {
                        closeNav()
                        // Ya en la portada no hay navegación: se ancla en el acto.
                        if (pathname !== '/') return
                        e.preventDefault()
                        window.history.replaceState(null, '', `/#${l.id}`)
                        scrollToSection(l.id, prefersReducedMotion())
                      }}
                    >
                      <i className={`fa-solid ${l.icon}`}></i> <span>{ui(l.i18n, l.label)}</span>
                    </Link>
                  ))}
                </div>
              </div>
              <div className={`dropdown${dropdown === 'portfolio' ? ' open' : ''}`}>
                <div
                  className="dropbtn"
                  onClick={(e) => { e.stopPropagation(); toggleDropdown('portfolio') }}
                >
                  <span>{ui('nav_portfolio')}</span> <i className="fa-solid fa-chevron-down" style={{ fontSize: '0.7em' }}></i>
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
              <Link href="/about" onClick={closeNav} className="highlight-link">{ui('nav_about')}</Link>
              <Link href="/contact" onClick={closeNav} className="highlight-link">{ui('nav_contact')}</Link>
              {/* Gestión movido al dropdown de administrador en CmsRoot.tsx */}
              {/* visor blueprint: GSAP lo desliza entre links (styles/nav.css) */}
              <span className="nav-viewfinder" ref={viewfinderRef} aria-hidden="true"></span>
            </div>
            
            {/* Acciones móviles (duplicadas de la barra superior) */}
            <div className="mobile-drawer-actions">
              <button
                type="button"
                className="cv-min-btn"
                title={ui('contact_me')}
                aria-label={ui('contact_me')}
                onClick={() => { setContactOpen(true); closeNav(); sendGAEvent('event', 'email_click') }}
              >
                <i className="fa-solid fa-envelope"></i><span>{ui('email')}</span>
              </button>
              {/* Sin CV subido va un <button disabled>, no un <a> sin href: un
                  ancla sin href no es un enlace —no tiene rol— así que
                  `aria-disabled` ahí está prohibido y los rastreadores lo
                  reportan como enlace muerto. `disabled` nativo dice lo mismo
                  sin ARIA. */}
              {settings.cvUrl ? (
                <a
                  className={`cv-min-btn${isDownloading ? ' is-disabled' : ''}`}
                  href="/api/cv"
                  onClick={downloadCv}
                  title={ui('download_cv')}
                  aria-label={ui('download_cv')}
                >
                  <i className={`fa-solid ${isDownloading ? 'fa-spinner fa-spin' : 'fa-file-arrow-down'}`}></i><span>{ui('cv')}</span>
                </a>
              ) : (
                <button
                  type="button"
                  className="cv-min-btn is-disabled"
                  disabled
                  title={ui('cv_unavailable')}
                  aria-label={ui('cv_unavailable')}
                >
                  <i className="fa-solid fa-file-arrow-down"></i><span>{ui('cv')}</span>
                </button>
              )}
              {/* Espejo del botón de sesión de la barra: CmsRoot lo renderiza
                  en un portal, así que se delega el click al original en vez de
                  duplicar la lógica de login/logout. */}
              <button
                className="login-min-btn"
                title={ui(isAdmin ? 'log_out' : 'log_in')}
                aria-label={ui(isAdmin ? 'log_out' : 'log_in')}
                onClick={() => {
                  closeNav()
                  document.querySelector<HTMLButtonElement>(`#cms-auth-nav [data-cms-auth="${isAdmin ? 'logout' : 'login'}"]`)?.click()
                }}
              >
                <i className={`fa-solid ${isAdmin ? 'fa-right-from-bracket' : 'fa-right-to-bracket'}`}></i>
                <span>{ui(isAdmin ? 'log_out' : 'log_in')}</span>
              </button>
              <div className="lang-selector-nav mobile-lang" style={{ display: 'flex' }}>
                <button
                  className="lang-btn"
                  onClick={(e) => { e.stopPropagation(); setLangMenu((m) => (m === 'drawer' ? null : 'drawer')) }}
                >
                  {/* Bandera SVG inline de LANG_META: next/image no optimiza SVG. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={activeLang.svg} alt={activeLang.label} className="lang-flag-img" />
                  <span className="lang-code">{state.lang.toUpperCase()}</span>
                </button>
                <div className={`lang-dropdown${langMenu === 'drawer' ? ' active' : ''}`}>
                  {ALL_LANGS.map((code) => (
                    <button
                      key={code}
                      className="lang-option"
                      onClick={() => { setLanguage(code as Lang); setLangMenu(null) }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={LANG_META[code].svg} alt={LANG_META[code].label} className="lang-flag-img" /> {LANG_META[code].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Contenedor primero, contenido después: el marco vive en
                `.nav-anim-slot` (styles/nav.css) y el archivo se asigna desde
                Gestión → Menu Animation. Overlay absoluto: no ocupa lugar en el
                flujo, así que ninguna opción del menú se corre. Corre mientras
                el drawer está abierto. */}
            <DecorAnim sources={animSources(settings, 'navAnimUrl')} className="nav-anim-slot" active={navOpen} rotateOn="toggle" />
          </nav>
          <div className="nav-actions">
            <button
              type="button"
              className="cv-min-btn"
              onClick={() => { setContactOpen(true); closeNav(); sendGAEvent('event', 'email_click') }}
              title={ui('contact_me')}
              aria-label={ui('contact_me')}
            >
              <i className="fa-solid fa-envelope"></i>
              <span>{ui('email')}</span>
            </button>
            {/* Siempre presente; sin CV subido queda deshabilitado (sin href). */}
            {settings.cvUrl ? (
              <a
                className={`cv-min-btn${isDownloading ? ' is-disabled' : ''}`} id="cv-download"
                href="/api/cv"
                onClick={downloadCv}
                title={ui('download_cv')}
                aria-label={ui('download_cv')}
              >
                <i className={`fa-solid ${isDownloading ? 'fa-spinner fa-spin' : 'fa-file-arrow-down'}`}></i>
                <span>{ui('cv')}</span>
              </a>
            ) : (
              <button
                type="button"
                className="cv-min-btn is-disabled" id="cv-download"
                disabled
                title={ui('cv_unavailable')}
                aria-label={ui('cv_unavailable')}
              >
                <i className="fa-solid fa-file-arrow-down"></i>
                <span>{ui('cv')}</span>
              </button>
            )}
            {/* cms.js renderiza aquí el botón de login / menú de sesión (Sesión 3) */}
            <div id="cms-auth-nav"></div>
            <div className="lang-selector-nav">
              <button
                className="lang-btn"
                id="lang-toggle-nav"
                aria-label={ui('change_language')}
                title={ui('language')}
                onClick={(e) => { e.stopPropagation(); setLangMenu((m) => (m === 'bar' ? null : 'bar')) }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={activeLang.svg} alt={activeLang.label} className="lang-flag-img" id="lang-flag-nav" />
                <span className="lang-code" id="lang-code-nav">{state.lang.toUpperCase()}</span>
              </button>
              <div className={`lang-dropdown${langMenu === 'bar' ? ' active' : ''}`} id="lang-dropdown-nav">
                {ALL_LANGS.map((code) => (
                  <button
                    key={code}
                    className="lang-option"
                    data-lang={code}
                    title={LANG_META[code].label}
                    onClick={() => { setLanguage(code as Lang); setLangMenu(null) }}
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

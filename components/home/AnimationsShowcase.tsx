'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useMotionReady, prefersReducedMotion, type LoopHandle } from '@/hooks/useGSAP'
import SoftwareDropdown from '@/components/home/SoftwareDropdown'
import { useUiText } from '@/lib/cms/store'
import { useCmsItems } from '@/lib/cms/content-context'
import { optimizedMediaSrc, videoPosterSrc } from '@/lib/utils'
import { sendGAEvent } from '@next/third-parties/google'

/* 6 contenedores = 2 filas de 3 en la grilla de escritorio. Al cambiar este
   número hay que acompañarlo en FIXED_SLOTS (`lib/cms/collections.ts`), que es
   de donde salen las claves `anim#0..n` del CMS. */
const CARD_COUNT = 6
/* Móvil: las 6 tarjetas apiladas obligaban a un scroll largo. La grilla pasa a
   páginas de ancho completo con scroll-snap (CSS puro, ver animations-showcase
   .css) — dos tarjetas por página, y estas flechas empujan de página en
   página. En escritorio la grilla no scrollea y las flechas están ocultas. */
const CARDS_PER_PAGE = 2
const PAGE_COUNT = Math.ceil(CARD_COUNT / CARDS_PER_PAGE)

type CardFields = { title: string; project: string; date: string; inspiration: string; desc: string }

function AnimCard({ index }: { index: number }) {
  /* `src` y `poster` desde el servidor: antes la tarjeta salía vacía y el motor
     del CMS le escribía la fuente después de hidratar. */
  const cmsRaw = useCmsItems()[`anim#${index}`] || ''
  const cmsSrc = cmsRaw ? optimizedMediaSrc(cmsRaw) : ''
  const cmsPoster = cmsRaw ? videoPosterSrc(cmsRaw) : ''
  const ui = useUiText()
  const videoRef = useRef<HTMLVideoElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [hasContent, setHasContent] = useState(!!cmsRaw)
  const [videoSrc, setVideoSrc] = useState(cmsSrc)
  const [showInfo, setShowInfo] = useState(false)
  const [fields, setFields] = useState<CardFields>({ title: '', project: '', date: '', inspiration: '', desc: '' })
  const infoTimerRef = useRef<ReturnType<typeof setTimeout>>(null)
  // Arranca alineado con lo que ya pinto el servidor: sin esto el primer sync
  // veria una transicion "vacio -> con contenido" que no ocurrio.
  const hasContentRef = useRef(!!cmsRaw)

  // ── Detect whether the video has real content ──
  // The CMS mutates the <video> element imperatively (sets/removes src).
  // We use multiple strategies to stay in sync:
  //   1. MutationObserver on src attribute + subtree (for <source> children)
  //   2. Media events (loadeddata, emptied)
  //   3. Polling fallback every 500ms (catches any edge case)
  useEffect(() => {
    const v = videoRef.current
    const c = cardRef.current
    if (!v || !c) return

    const checkHasContent = (): boolean => {
      // Check the attribute directly (not the .src property which resolves to full URL)
      const videoSrc = v.getAttribute('src')
      if (videoSrc) return true
      // Check <source> children
      const sourceEl = v.querySelector('source')
      if (sourceEl && sourceEl.getAttribute('src')) return true
      return false
    }

    const syncContent = () => {
      const has = checkHasContent()
      setHasContent(has)
      
      let srcVal = v.getAttribute('src') || ''
      if (!srcVal) {
        const sourceEl = v.querySelector('source')
        if (sourceEl) {
          srcVal = sourceEl.getAttribute('src') || ''
        }
      }
      setVideoSrc(srcVal)

      /* Rebobinar solo si el clip anterior había avanzado. ESCRIBIR
         `currentTime` obliga al navegador a resolver el recurso, así que en el
         primer sync anulaba el `preload="none"` de la tarjeta y bajaba el
         archivo entero de cada una, muy por debajo del fold (medido: 5,5 MB en
         dos tarjetas). Leerlo no cuesta nada. */
      if (has && !hasContentRef.current) {
        try { v.pause(); if (v.currentTime > 0) v.currentTime = 0 } catch {}
      }
      hasContentRef.current = has
    }

    const syncFields = () => setFields({
      title: c.getAttribute('data-title') || '',
      project: c.getAttribute('data-project') || '',
      date: c.getAttribute('data-date') || '',
      inspiration: c.getAttribute('data-inspiration') || '',
      desc: c.getAttribute('data-desc') || '',
    })

    // Initial sync
    syncContent()
    syncFields()

    // MutationObserver: watch src changes on <video> and any <source> children
    const mo = new MutationObserver(() => syncContent())
    mo.observe(v, { attributes: true, attributeFilter: ['src'], childList: true, subtree: true })

    // Data fields observer
    const moFields = new MutationObserver(syncFields)
    moFields.observe(c, { attributes: true, attributeFilter: ['data-title', 'data-project', 'data-date', 'data-inspiration', 'data-desc'] })

    // Media events
    v.addEventListener('loadeddata', syncContent)
    v.addEventListener('emptied', syncContent)

    /* Red de seguridad del sondeo: cubre el caso que el observer no ve, pero
       el único que reemplaza el contenido de una tarjeta es el motor del CMS
       con sesión abierta. Para el visitante eran seis temporizadores llamando
       a dos setState cada 500 ms de por vida, sobre un DOM que ya nadie toca. */
    const poll = setInterval(() => {
      if (document.body.classList.contains('is-admin')) syncContent()
    }, 500)

    return () => {
      mo.disconnect()
      moFields.disconnect()
      v.removeEventListener('loadeddata', syncContent)
      v.removeEventListener('emptied', syncContent)
      clearInterval(poll)
    }
  }, [])

  // Info timer for lightbox
  useEffect(() => {
    if (!expanded) return
    infoTimerRef.current = setTimeout(() => setShowInfo(true), 1000)
    return () => { if (infoTimerRef.current) clearTimeout(infoTimerRef.current) }
  }, [expanded])

  const handleMouseEnter = useCallback(() => {
    if (!hasContent) return
    const v = videoRef.current
    if (!v) return
    v.currentTime = 0
    v.play().catch(() => {})
    setPlaying(true)
  }, [hasContent])

  const handleMouseLeave = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    v.pause()
    // Rebobinar acá y no solo al entrar: si no, la tarjeta queda congelada en
    // el frame donde se cortó y la miniatura "recuerda" dónde quedó.
    try { if (v.currentTime > 0) v.currentTime = 0 } catch {}
    setPlaying(false)
  }, [])

  const togglePlay = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      v.play().catch(() => {})
      setPlaying(true)
    } else {
      v.pause()
      setPlaying(false)
    }
  }, [])

  const openExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded(true)
    sendGAEvent('event', 'fullscreen_open')
  }, [])

  const closeExpanded = useCallback(() => {
    setExpanded(false)
    setShowInfo(false)
    const v = videoRef.current
    if (v) { v.pause(); setPlaying(false) }
  }, [])

  return (
    <>
      <div
        ref={cardRef}
        className={`anim-card animation-item${hasContent ? '' : ' anim-card--empty'}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ '--card-i': index } as React.CSSProperties}
      >
        <div className="anim-card__media">
          <video
            ref={videoRef}
            className="anim-card__video anim-video"
            src={cmsSrc || undefined}
            poster={cmsPoster || undefined}
            muted
            loop
            playsInline
            preload="none"
            data-preload-defer=""
          />
          {!hasContent && (
            <div className="anim-card__placeholder" aria-hidden="true">
              <i className="fa-solid fa-film" />
            </div>
          )}
        </div>

        {hasContent && (
          <div className="anim-card__overlay">
            <div className="anim-card__info">
              <span className="anim-card__fig">FIG. 03{String.fromCharCode(97 + index)}</span>
              <h3 className="anim-card__title video-title">{fields.title}</h3>
              <span className="anim-card__meta">
                <span className="video-project"><i className="fa-solid fa-folder" aria-hidden="true" /> <span className="val">{fields.project}</span></span>
                <span className="video-date"><i className="fa-regular fa-calendar" aria-hidden="true" /> <span className="val">{fields.date}</span></span>
              </span>
            </div>
            <div className="anim-card__controls">
              <button
                type="button"
                className="anim-card__btn"
                onClick={togglePlay}
                aria-label={playing ? 'Pausar' : 'Reproducir'}
              >
                <i className={`fa-solid ${playing ? 'fa-pause' : 'fa-play'}`} />
              </button>
              <button
                type="button"
                className="anim-card__btn"
                onClick={openExpand}
                aria-label={ui('view_fullscreen')}
              >
                <i className="fa-solid fa-expand" />
              </button>
            </div>
          </div>
        )}
      </div>

      {expanded && hasContent && typeof document !== 'undefined' && createPortal(
        <div className={`lightbox ${showInfo ? 'info-open' : ''}`} style={{ display: 'flex', opacity: 1 }} onClick={closeExpanded}>
          <span className="lightbox-close" onClick={closeExpanded}>&times;</span>

          <div className="lightbox-wrapper">
            <video
              src={videoSrc}
              className="lightbox-content"
              autoPlay
              muted
              loop
              playsInline
              controls
              onClick={(e) => e.stopPropagation()}
            />

            <button
              type="button"
              className="info-toggle-btn"
              onClick={(e) => { e.stopPropagation(); setShowInfo((p) => !p) }}
              aria-label={ui('information')}
            >
              <i className="fa-solid fa-info" />
            </button>

            <div className={`lightbox-info-panel ${showInfo ? '' : 'hidden'}`} onClick={(e) => e.stopPropagation()}>
              {fields.title && <h3 className="info-title">{fields.title}</h3>}
              <div className="info-divider"></div>
              <div className="info-meta">
                {fields.date && <span className="info-date"><i className="fa-regular fa-calendar"></i> <span className="val">{fields.date}</span></span>}
                {fields.project && <span className="info-project"><i className="fa-solid fa-folder-open"></i> <span className="val">{fields.project}</span></span>}
              </div>
              {fields.desc && <p className="info-desc">{fields.desc}</p>}
              {fields.inspiration && <p className="info-inspiration"><i className="fa-solid fa-wand-magic-sparkles"></i> <b>{ui('inspiration')}:</b> <span className="val">{fields.inspiration}</span></p>}
              <div className="info-footer">
                <span><i className="fa-solid fa-palette"></i> LUCIA MONTAÑA</span>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

export default function AnimationsShowcase() {
  const motion = useMotionReady() // GSAP llega en su propio chunk
  const sectionRef = useRef<HTMLElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(0)
  const ui = useUiText()

  /* Se mide contra la página real y no contra `clientWidth`: el gap entre
     páginas hace que un paso no sea exactamente el ancho del viewport.
     El estado se adelanta acá y no se espera al evento `scroll`: con scroll
     suave ese evento llega tarde, y un segundo click antes de que llegara
     apuntaba de nuevo a la página actual (delta 0, el carrusel se trababa).
     El índice da la vuelta: pasada la última página se vuelve a la primera y
     al revés, así que las flechas nunca se agotan. */
  const goToPage = useCallback((next: number) => {
    const grid = gridRef.current
    const wrapped = ((next % PAGE_COUNT) + PAGE_COUNT) % PAGE_COUNT
    const target = grid?.children[wrapped] as HTMLElement | undefined
    if (!grid || !target) return
    setPage(wrapped)
    const delta = target.getBoundingClientRect().left - grid.getBoundingClientRect().left
    grid.scrollBy({ left: delta, behavior: 'smooth' })
  }, [])

  // El swipe nativo también mueve la página: las flechas leen de acá su estado.
  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const onScroll = () => {
      const left = grid.getBoundingClientRect().left
      let nearest = 0
      let best = Infinity
      Array.from(grid.children).forEach((pageEl, i) => {
        const d = Math.abs(pageEl.getBoundingClientRect().left - left)
        if (d < best) { best = d; nearest = i }
      })
      setPage(nearest)
    }
    grid.addEventListener('scroll', onScroll, { passive: true })
    return () => grid.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (prefersReducedMotion()) return
    if (!motion) return
    const { gsap, ScrollTrigger, typewriterRevealLoop, wordRevealLoop } = motion
    const sec = sectionRef.current
    if (!sec) return

    let titleTw: LoopHandle | null = null
    let descTw: LoopHandle | null = null

    const ctx = gsap.context(() => {
      gsap.set('.anim-showcase__fig', { autoAlpha: 0, y: 12 })
      gsap.set('.anim-showcase__title', { autoAlpha: 0 })
      gsap.set('.anim-showcase__desc', { autoAlpha: 0, y: 18 })
      gsap.set('.anim-card', { autoAlpha: 0, y: 40, scale: 0.95 })

      // fig + desc fade-up; el título entra letra por letra (typewriterRevealLoop).
      const tl = gsap.timeline({ defaults: { ease: 'power4.out' }, paused: true })
      tl.to('.anim-showcase__fig', { autoAlpha: 1, y: 0, duration: 0.4 }, 0)
        .to('.anim-showcase__desc', { autoAlpha: 1, y: 0, duration: 0.7 }, 0.45)
        // clearProps: tras la entrada GSAP suelta el transform inline para que
        // el float pasivo (CSS) lo controle limpio y fluido.
        .to('.anim-card', { autoAlpha: 1, y: 0, scale: 1, duration: 0.7, stagger: 0.1, ease: 'power3.out', clearProps: 'transform' }, '-=0.3')

      let played = false
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !played) {
            played = true
            tl.play()
            io.disconnect()
            const titleEl = sec.querySelector<HTMLElement>('.anim-showcase__title')
            const descEl = sec.querySelector<HTMLElement>('.anim-showcase__desc')
            if (titleEl) titleTw = typewriterRevealLoop(titleEl, 8)
            if (descEl) descTw = wordRevealLoop(descEl, 8)
          }
        }
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 })
      io.observe(sec)



      ScrollTrigger.refresh()
    }, sectionRef)
    return () => { titleTw?.kill(); descTw?.kill(); ctx.revert() }
  }, [motion])

  return (
    <section ref={sectionRef} className="anim-showcase" id="animations" aria-labelledby="anim-showcase-title">


      <div className="anim-showcase__frame">
        <div className="anim-showcase__header">
          <span className="anim-showcase__fig">FIG. 03 — Motion</span>
          <h2 id="anim-showcase-title" className="anim-showcase__title">Animations</h2>
          <p className="anim-showcase__desc" data-i18n="anim_desc">
            A selection of animations, motion graphics, and technical tests
            exploring movement, storytelling, and expression through characters and environments.
          </p>
          <SoftwareDropdown prefix="anim" count={4} />
        </div>

        <div className="anim-carousel">
          {/* Las páginas son `display: contents` en escritorio: desaparecen del
              layout y las tarjetas vuelven a ser ítems directos de la grilla. */}
          <div className="animations-grid" ref={gridRef}>
            {Array.from({ length: PAGE_COUNT }, (_, p) => (
              <div className="animations-grid__page" key={p}>
                {Array.from({ length: CARDS_PER_PAGE }, (_, j) => (
                  <AnimCard key={j} index={p * CARDS_PER_PAGE + j} />
                ))}
              </div>
            ))}
          </div>
          <button
            type="button"
            className="anim-carousel__arrow anim-carousel__arrow--prev"
            onClick={() => goToPage(page - 1)}
            aria-label={ui('previous')}
          >
            <i className="fa-solid fa-chevron-left" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="anim-carousel__arrow anim-carousel__arrow--next"
            onClick={() => goToPage(page + 1)}
            aria-label={ui('next')}
          >
            <i className="fa-solid fa-chevron-right" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  )
}

'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ensureGSAP, gsap, ScrollTrigger, prefersReducedMotion, typewriterRevealLoop, wordRevealLoop, type LoopHandle } from '@/hooks/useGSAP'
import SoftwareDropdown from '@/components/home/SoftwareDropdown'

const CARD_COUNT = 6

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

type CardFields = { title: string; project: string; date: string; inspiration: string; desc: string }

function AnimCard({ index }: { index: number }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [hasContent, setHasContent] = useState(false)
  const [videoSrc, setVideoSrc] = useState('')
  const [showInfo, setShowInfo] = useState(false)
  const [fields, setFields] = useState<CardFields>({ title: '', project: '', date: '', inspiration: '', desc: '' })
  const infoTimerRef = useRef<ReturnType<typeof setTimeout>>(null)
  const hasContentRef = useRef(false)

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

      // Only pause/reset if we just transitioned to having content
      if (has && !hasContentRef.current) { 
        try { v.pause(); v.currentTime = 0 } catch {} 
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

    // Polling fallback: catches any edge case the observer misses
    const poll = setInterval(syncContent, 500)

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
        <Corners />
        <div className="anim-card__media">
          <video
            ref={videoRef}
            className="anim-card__video anim-video"
            muted
            loop
            playsInline
            preload="metadata"
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
                aria-label="Ver en pantalla completa"
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
              aria-label="Información"
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
              {fields.inspiration && <p className="info-inspiration"><i className="fa-solid fa-wand-magic-sparkles"></i> <b>Inspiration:</b> <span className="val">{fields.inspiration}</span></p>}
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
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (prefersReducedMotion()) return
    ensureGSAP()
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

      gsap.set('.anim-showcase__rail-fill', { scaleY: 0, transformOrigin: 'top center' })
      gsap.to('.anim-showcase__rail-fill', {
        scaleY: 1, ease: 'none',
        scrollTrigger: { trigger: sec, start: 'top 70%', end: 'bottom 50%', scrub: 0.6 },
      })

      ScrollTrigger.refresh()
    }, sectionRef)
    return () => { titleTw?.kill(); descTw?.kill(); ctx.revert() }
  }, [])

  return (
    <section ref={sectionRef} className="anim-showcase" aria-labelledby="anim-showcase-title">
      <div className="anim-showcase__rail" aria-hidden="true">
        <span className="anim-showcase__rail-fig">FILE 03 · ANIMATIONS</span>
        <span className="anim-showcase__rail-track">
          <span className="anim-showcase__rail-fill" />
        </span>
        <span className="anim-showcase__rail-fig anim-showcase__rail-fig--end">END</span>
      </div>

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

        <div className="animations-grid">
          {Array.from({ length: CARD_COUNT }, (_, i) => (
            <AnimCard key={i} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}

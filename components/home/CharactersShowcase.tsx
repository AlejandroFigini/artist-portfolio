'use client'

/* Character Design (home) — panel destacado + riel-carrusel con autoavance
   y barra de progreso, en el mismo lenguaje visual que Animations (fondo
   claro con trama, FIG monospace, typewriter, lightbox por portal).
   Los contenedores .cd-* quedan registrados en el CMS (engine.ts) para que
   el contenido sea editable sin tocar código. */

import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ensureGSAP, gsap, ScrollTrigger, prefersReducedMotion, typewriterLoop } from '@/hooks/useGSAP'

const INTERVAL_MS = 6000
const CONCEPTS_PER = 3

type Character = {
  name: string; role: string; railRole: string; desc: string
  date: string; project: string; inspiration: string
}

const CHARACTERS: Character[] = [
  {
    name: 'Alessio', role: 'Main Design', railRole: 'Main',
    desc: 'Del boceto inicial al render 3D final: un estudio profundo de proporciones, texturizado orgánico y accesorios.',
    date: '2023', project: 'Character Design',
    inspiration: 'Personajes expresivos de base animal y narrativa cálida.',
  },
  {
    name: 'Jaffare', role: 'Stylized Design', railRole: 'Stylized',
    desc: 'Su desarrollo incluyó variaciones extensas de expresiones y poses, preservando la frescura del concept 2D original.',
    date: '2023', project: 'Character Design',
    inspiration: 'Formas estilizadas y siluetas legibles y audaces.',
  },
  {
    name: 'King', role: 'Complex Design', railRole: 'Complex',
    desc: 'Un trabajo intenso sobre formas duras y orgánicas entrelazadas. La retopología y el render jugaron un rol crucial.',
    date: '2023', project: 'Character Design',
    inspiration: 'Hard-surface fusionado con anatomía orgánica.',
  },
  {
    name: 'Leda', role: 'Fine Detail', railRole: 'Detail',
    desc: 'El concept art definió el tono visual de su trasfondo literario: cada tela, material y luz evoca melancolía e intriga.',
    date: '2023', project: 'Character Design',
    inspiration: 'Detalle fino y paletas de color refinadas y armónicas.',
  },
]

const TOTAL = String(CHARACTERS.length).padStart(2, '0')

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

// Imagen editable (bg-image) con placeholder y detección de contenido.
function CharImage({
  className, icon, onOpen,
}: { className: string; icon: string; onOpen: (src: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [hasMedia, setHasMedia] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => {
      const bg = el.style.backgroundImage
      setHasMedia(!!bg && bg !== 'none' && !bg.includes("url('')") && !bg.includes('url("")'))
    }
    check()
    const mo = new MutationObserver(check)
    mo.observe(el, { attributes: true, attributeFilter: ['style', 'data-full'] })
    return () => mo.disconnect()
  }, [])

  const open = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const el = ref.current
    const src = el?.getAttribute('data-full') || ''
    if (src) onOpen(src)
  }, [onOpen])

  return (
    <div
      ref={ref}
      className={`${className}${hasMedia ? ' has-media' : ''}`}
      data-full=""
      onClick={open}
    >
      <span className="cd-ph" aria-hidden="true"><i className={`fa-solid ${icon}`} /></span>
    </div>
  )
}

export default function CharactersShowcase() {
  const sectionRef = useRef<HTMLElement>(null)
  const [active, setActive] = useState(0)
  const [visible, setVisible] = useState(false)
  const [lightbox, setLightbox] = useState<{ src: string; char: Character } | null>(null)
  const [showInfo, setShowInfo] = useState(false)
  const infoTimerRef = useRef<ReturnType<typeof setTimeout>>(null)

  // Reveal de entrada + typewriter del título (mismo patrón que Animations).
  useEffect(() => {
    if (prefersReducedMotion()) return
    ensureGSAP()
    const sec = sectionRef.current
    if (!sec) return
    let twTimeout: ReturnType<typeof setTimeout>

    const ctx = gsap.context(() => {
      gsap.set('.char-showcase__fig', { autoAlpha: 0, y: 12 })
      gsap.set('.char-showcase__title .line', { yPercent: 115, skewY: 4 })
      gsap.set('.char-showcase__desc', { autoAlpha: 0, y: 18 })
      gsap.set('.cd-stage', { autoAlpha: 0, y: 40 })
      gsap.set('.cd-rail-item', { autoAlpha: 0, y: 24 })

      const tl = gsap.timeline({ defaults: { ease: 'power4.out' }, paused: true })
      tl.to('.char-showcase__fig', { autoAlpha: 1, y: 0, duration: 0.4 }, 0)
        .to('.char-showcase__title .line', { yPercent: 0, skewY: 0, duration: 1.0, stagger: 0.1 }, 0.05)
        .to('.char-showcase__desc', { autoAlpha: 1, y: 0, duration: 0.7 }, '-=0.6')
        .to('.cd-stage', { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out' }, '-=0.3')
        .to('.cd-rail-item', { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.08, ease: 'power3.out' }, '-=0.4')

      let played = false
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !played) {
            played = true
            tl.play()
            io.disconnect()
            const lineEl = sec.querySelector<HTMLElement>('.char-showcase__title .line')
            if (lineEl) twTimeout = setTimeout(() => typewriterLoop(lineEl, 8), (tl.duration() + 1) * 1000)
          }
        }
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 })
      io.observe(sec)
      ScrollTrigger.refresh()
    }, sectionRef)
    return () => { clearTimeout(twTimeout); ctx.revert() }
  }, [])

  // Visibilidad para el autoavance del carrusel.
  useEffect(() => {
    const sec = sectionRef.current
    if (!sec) return
    sec.style.setProperty('--cd-interval', `${INTERVAL_MS / 1000}s`)
    const io = new IntersectionObserver((entries) => setVisible(entries[0].isIntersecting), { threshold: 0.25 })
    io.observe(sec)
    return () => io.disconnect()
  }, [])

  // Barra de progreso + autoavance (solo en viewport, respeta reduced-motion).
  useEffect(() => {
    const sec = sectionRef.current
    if (!sec) return
    const bars = sec.querySelectorAll<HTMLElement>('.cd-rail-progress')
    bars.forEach((b) => b.classList.remove('run'))
    if (!visible) return
    const bar = bars[active]
    if (bar) { void bar.offsetWidth; bar.classList.add('run') }
    if (prefersReducedMotion()) return
    const t = setTimeout(() => setActive((a) => (a + 1) % CHARACTERS.length), INTERVAL_MS)
    return () => clearTimeout(t)
  }, [active, visible])

  // Panel de info del lightbox: se abre solo 1s después de ampliar.
  useEffect(() => {
    if (lightbox) {
      infoTimerRef.current = setTimeout(() => setShowInfo(true), 1000)
    } else {
      setShowInfo(false)
      if (infoTimerRef.current) clearTimeout(infoTimerRef.current)
    }
    return () => { if (infoTimerRef.current) clearTimeout(infoTimerRef.current) }
  }, [lightbox])

  const openLightbox = useCallback((char: Character) => (src: string) => setLightbox({ src, char }), [])
  const closeLightbox = useCallback(() => setLightbox(null), [])

  return (
    <section ref={sectionRef} className="char-showcase" aria-labelledby="char-showcase-title">
      <div className="char-showcase__rail" aria-hidden="true">
        <span className="char-showcase__rail-fig">FILE 04 · CHARACTERS</span>
        <span className="char-showcase__rail-track"><span className="char-showcase__rail-fill" /></span>
        <span className="char-showcase__rail-fig char-showcase__rail-fig--end">END</span>
      </div>

      <div className="char-showcase__frame">
        <div className="char-showcase__header">
          <span className="char-showcase__fig">FIG. 04 — Cast</span>
          <h2 id="char-showcase-title" className="char-showcase__title">
            <span className="line-wrap"><span className="line">Character Design</span></span>
          </h2>
          <p className="char-showcase__desc" data-i18n="characters_desc">
            Un elenco interactivo de mis creaciones. Cada personaje recorre el proceso
            completo: del concept inicial al diseño final, explorando forma, color y carácter.
          </p>
        </div>

        <div className="cd-stage">
          {CHARACTERS.map((c, i) => (
            <article
              key={c.name}
              className={`cd-panel${i === active ? ' active' : ''}`}
              data-index={i}
              data-date={c.date}
              data-project={c.project}
              data-inspiration={c.inspiration}
            >
              <div className="cd-media">
                <div className="cd-portrait-wrap" style={{ position: 'relative' }}>
                  <CharImage className="cd-portrait" icon="fa-user-astronaut" onOpen={openLightbox(c)} />
                </div>
                <div className="cd-concepts">
                  {Array.from({ length: CONCEPTS_PER }, (_, n) => (
                    <CharImage key={n} className="cd-concept" icon="fa-palette" onOpen={openLightbox(c)} />
                  ))}
                </div>
              </div>
              <div className="cd-info">
                <span className="cd-ghost" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                <span className="cd-counter"><b>{String(i + 1).padStart(2, '0')}</b> / {TOTAL}</span>
                <h3 className="cd-name">{c.name}</h3>
                <div className="cd-role">{c.role}</div>
                <p className="cd-desc">{c.desc}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="cd-rail" role="tablist" aria-label="Personajes">
          {CHARACTERS.map((c, i) => (
            <button
              key={c.name}
              type="button"
              className={`cd-rail-item${i === active ? ' active' : ''}`}
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
            >
              <span className="cd-rail-thumb">
                <span className="cd-ph" aria-hidden="true"><i className="fa-solid fa-user" /></span>
              </span>
              <span className="cd-rail-meta">
                <span className="cd-rail-name">{c.name}</span>
                <span className="cd-rail-role">{c.railRole}</span>
              </span>
              <span className="cd-rail-progress" />
            </button>
          ))}
        </div>
      </div>

      {lightbox && typeof document !== 'undefined' && createPortal(
        <div className="cd-lightbox" onClick={closeLightbox}>
          <button type="button" className="cd-lightbox__close" onClick={closeLightbox} aria-label="Cerrar">
            <i className="fa-solid fa-xmark" />
          </button>

          <div className={`cd-lightbox__media${showInfo ? ' is-shifted' : ''}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox.src} alt={lightbox.char.name} className="cd-lightbox__img" onClick={(e) => e.stopPropagation()} />

            <button
              type="button"
              className="cd-lightbox__info-btn"
              onClick={(e) => { e.stopPropagation(); setShowInfo((p) => !p) }}
              aria-label="Información"
            >
              <i className={`fa-solid ${showInfo ? 'fa-xmark' : 'fa-circle-info'}`} />
            </button>

            {showInfo && (
              <div className="cd-lightbox__info-panel" onClick={(e) => e.stopPropagation()}>
                <h3>{lightbox.char.name}</h3>
                <dl className="cd-lightbox__meta">
                  <div><dt>Rol</dt><dd>{lightbox.char.role}</dd></div>
                  <div><dt>Fecha</dt><dd>{lightbox.char.date}</dd></div>
                  <div><dt>Proyecto</dt><dd>{lightbox.char.project}</dd></div>
                  <div><dt>Inspiración</dt><dd>{lightbox.char.inspiration}</dd></div>
                  <div className="cd-lightbox__meta-block"><dt>Descripción</dt><dd>{lightbox.char.desc}</dd></div>
                </dl>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </section>
  )
}

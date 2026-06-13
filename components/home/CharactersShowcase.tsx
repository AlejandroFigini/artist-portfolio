'use client'

/* Character Design (home) — portado de index.html #personajes +
   script.js (initCharShowcase): crossfade entre paneles, riel con
   autoavance cada 6s y barra de progreso (.run), solo con la sección
   en viewport. Retratos/concepts abren lightbox si tienen imagen. */

import { useEffect, useRef, useState } from 'react'
import { openLightbox } from '@/components/ui/lightbox'
import { prefersReducedMotion } from '@/hooks/useGSAP'
import './characters-modern.css'

const INTERVAL_MS = 6000

const EXPAND_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
  </svg>
)

const CHARACTERS = [
  {
    name: 'Alessio', role: 'Main Design', railRole: 'Main Design',
    desc: 'The design process for this character ranged from initial sketches to the final 3D rendering. A deep study of proportions, organic texturing, and accessories.',
    date: '2023', project: 'Character Design',
    inspiration: 'Expressive animal-based characters and warm storytelling.',
  },
  {
    name: 'Jaffare', role: 'Stylized Design', railRole: 'Stylized',
    desc: 'The development of Jaffare included extensive variations of expressions and poses. Its modeling required meticulous work to preserve the freshness of the original 2D concept.',
    date: '2023', project: 'Character Design',
    inspiration: 'Stylized shapes and bold, readable silhouettes.',
  },
  {
    name: 'King', role: 'Complex Design', railRole: 'Complex',
    desc: "King's process distills an intense work on intertwined hard and organic shapes. Retopology and render configuration played a crucial role here.",
    date: '2023', project: 'Character Design',
    inspiration: 'Hard-surface forms blended with organic anatomy.',
  },
  {
    name: 'Leda', role: 'Fine Attention to Detail', railRole: 'Detail',
    desc: 'The concept art work for Leda defined the visual tone required by her literary background. Every piece of fabric, material, and lighting was selected to evoke melancholy and intrigue.',
    date: '2023', project: 'Character Design',
    inspiration: 'Fine detail and refined, harmonious color palettes.',
  },
]

const TOTAL = String(CHARACTERS.length).padStart(2, '0')

export default function CharactersShowcase() {
  const [active, setActive] = useState(0)
  const [visible, setVisible] = useState(false)
  const showcaseRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const showcase = showcaseRef.current
    if (!showcase) return
    showcase.style.setProperty('--cd-interval', `${INTERVAL_MS / 1000}s`)
    const io = new IntersectionObserver((entries) => setVisible(entries[0].isIntersecting), { threshold: 0.2 })
    io.observe(showcase)
    return () => io.disconnect()
  }, [])

  // Barra de progreso del rail + autoavance (solo en viewport)
  useEffect(() => {
    const showcase = showcaseRef.current
    if (!showcase) return
    const bars = showcase.querySelectorAll<HTMLElement>('.cd-rail-progress')
    bars.forEach((b) => b.classList.remove('run'))
    if (!visible) return
    const bar = bars[active]
    if (bar) {
      void bar.offsetWidth // reflow: reinicia la animación CSS
      bar.classList.add('run')
    }
    if (prefersReducedMotion()) return
    const timer = setTimeout(() => setActive((a) => (a + 1) % CHARACTERS.length), INTERVAL_MS)
    return () => clearTimeout(timer)
  }, [active, visible])

  const openFull = (el: HTMLElement, c: (typeof CHARACTERS)[number]) => {
    const full = el.getAttribute('data-full')
    if (!full) return
    openLightbox(full, c.name, c.desc, '', { date: c.date, project: c.project, inspiration: c.inspiration })
  }

  return (
    <section id="personajes" className="characters-section char-modern">
      {/* Fondo en movimiento moderno: malla de auroras a la deriva +
          barrido de luz, sobre lienzo oscuro. Capas GPU, aria oculto.
          Mismo lenguaje que la sección Animations. */}
      <div className="cm-bg" aria-hidden="true">
        <span className="cm-aurora cm-a1"></span>
        <span className="cm-aurora cm-a2"></span>
        <span className="cm-aurora cm-a3"></span>
        <span className="cm-beam"></span>
      </div>
      <div className="cd-blob-1"></div>
      <div className="cd-blob-2"></div>
      <div className="cd-blob-3"></div>
      <div className="char-section-spotlight"></div>
      <div className="section-title" data-scroll="reveal">
        <h2 className="section-typewriter" data-i18n="characters_title">Character Design</h2>
        {/* regla-cota: se llena con el avance de la sección (HomeFx scrub) */}
        <span className="title-rule" aria-hidden="true"><span className="title-rule-fill"></span></span>
        <p>Explore the interactive cast of my creations.</p>
        <a className="see-all-cta" href="/characters"><span>Explore all characters</span> <i className="fa-solid fa-arrow-right"></i></a>
      </div>

      <div className="cd-showcase" data-scroll="reveal" ref={showcaseRef}>
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
                <div
                  className="cd-portrait"
                  data-full=""
                  style={{ backgroundImage: "url('')" }}
                  onClick={(e) => openFull(e.currentTarget, c)}
                >
                  <span className="cd-portrait-tag">{EXPAND_ICON} View</span>
                </div>
                <div className="cd-concepts">
                  {[1, 2, 3].map((n) => (
                    <button
                      key={n}
                      className="cd-concept"
                      aria-label={`${c.name} concept ${n}`}
                      data-full=""
                      style={{ backgroundImage: "url('')" }}
                      onClick={(e) => openFull(e.currentTarget, c)}
                    ></button>
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

        <div className="cd-rail" role="tablist" aria-label="Characters">
          {CHARACTERS.map((c, i) => (
            <button
              key={c.name}
              className={`cd-rail-item${i === active ? ' active' : ''}`}
              data-index={i}
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
            >
              <span className="cd-rail-thumb" style={{ backgroundImage: "url('')" }}></span>
              <span className="cd-rail-meta">
                <span className="cd-rail-name">{c.name}</span>
                <span className="cd-rail-role">{c.railRole}</span>
              </span>
              <span className="cd-rail-progress"></span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

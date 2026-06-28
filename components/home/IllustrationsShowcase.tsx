'use client'

/* ILLUSTRATIONS SHOWCASE — bento de contenedores CMS (build limpio).
   Header idéntico al resto de secciones (fig + título Syne + desc, mismo
   reveal/typewriter). El bento (CSS grid, placement por nth-child) tila un
   rectángulo perfecto con formas variadas (cuadrado grande, tall, wide, 1×1).
   SISTEMA DE CONTENEDORES: celdas VACÍAS (sin <img src>); el engine las indexa
   como illustration#i, las marca cms-empty-slot (marco punteado + nube) y
   permite subir la ilustración después. */

import { useEffect, useRef } from 'react'
import { ensureGSAP, gsap, ScrollTrigger, prefersReducedMotion, typewriterRevealLoop, wordRevealLoop, type LoopHandle } from '@/hooks/useGSAP'
import { openLightbox } from '@/components/ui/lightbox'
const CELL_COUNT = 15
/* Abrir lightbox solo si la celda tiene contenido (img con src real). Vacía →
   el overlay del engine maneja el click (picker en admin). */
function onCellClick(e: React.MouseEvent<HTMLElement>) {
  const cell = e.currentTarget
  const src = cell.querySelector('img')?.getAttribute('src')
  if (!src) return
  openLightbox(src, cell.dataset.title, cell.dataset.desc, cell.dataset.link, {
    date: cell.dataset.date,
    project: cell.dataset.project,
    inspiration: cell.dataset.inspiration,
  })
}

function Cell() {
  return (
    <figure className="illu-cell" onClick={onCellClick}>
      {/* Sin src: contenedor vacío. El engine setea .src al subir contenido. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="illu-cell__img" data-eager="" decoding="async" alt="" />
      <span className="illu-cell__hud" aria-hidden="true">
        <i className="fa-solid fa-up-right-and-down-left-from-center" />
      </span>
    </figure>
  )
}

export default function IllustrationsShowcase() {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (prefersReducedMotion()) return
    ensureGSAP()
    const sec = sectionRef.current
    if (!sec) return

    let titleTw: LoopHandle | null = null
    let descTw: LoopHandle | null = null

    const ctx = gsap.context(() => {
      gsap.set('.illu-showcase__fig', { autoAlpha: 0, y: 12 })
      gsap.set('.illu-showcase__title', { autoAlpha: 0 })
      gsap.set('.illu-showcase__desc', { autoAlpha: 0, y: 18 })
      gsap.set('.illu-cell', { autoAlpha: 0, y: 40, scale: 0.96 })

      // fig + desc fade-up; el título entra letra por letra (igual a Animations/3D).
      const tl = gsap.timeline({ defaults: { ease: 'power4.out' }, paused: true })
      tl.to('.illu-showcase__fig', { autoAlpha: 1, y: 0, duration: 0.4 }, 0)
        .to('.illu-showcase__desc', { autoAlpha: 1, y: 0, duration: 0.7 }, 0.45)
        .to('.illu-cell', { autoAlpha: 1, y: 0, scale: 1, duration: 0.7, stagger: 0.06, ease: 'power3.out', clearProps: 'transform' }, '-=0.3')

      let played = false
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !played) {
            played = true
            tl.play()
            io.disconnect()
            const titleEl = sec.querySelector<HTMLElement>('.illu-showcase__title')
            const descEl = sec.querySelector<HTMLElement>('.illu-showcase__desc')
            if (titleEl) titleTw = typewriterRevealLoop(titleEl, 8)
            if (descEl) descTw = wordRevealLoop(descEl, 8)
          }
        }
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 })
      io.observe(sec)

      ScrollTrigger.refresh()
    }, sectionRef)
    return () => { titleTw?.kill(); descTw?.kill(); ctx.revert() }
  }, [])

  return (
    <section ref={sectionRef} className="illu-showcase" aria-labelledby="illu-showcase-title">
      <div className="illu-showcase__rail" aria-hidden="true">
        <span className="illu-showcase__rail-fig">FILE 06 · ILLUSTRATIONS</span>
        <span className="illu-showcase__rail-track">
          <span className="illu-showcase__rail-fill" />
        </span>
        <span className="illu-showcase__rail-fig illu-showcase__rail-fig--end">END</span>
      </div>

      <div className="illu-showcase__frame">
        <div className="illu-showcase__header">
          <span className="illu-showcase__fig">FIG. 06 — Illustration</span>
          <h2 id="illu-showcase-title" className="illu-showcase__title">Illustrations</h2>
          <p className="illu-showcase__desc">
            Una colección de ilustraciones — exploraciones de color, forma y
            narrativa visual a través de personajes, escenas y estudios.
          </p>
        </div>

        <div className="illu-masonry">
          {Array.from({ length: CELL_COUNT }, (_, i) => (
            <Cell key={i} />
          ))}
        </div>
      </div>
    </section>
  )
}

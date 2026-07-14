'use client'

/* Characters (home) — galería de personajes en paneles full-bleed con scroll
   horizontal (carrusel embla: drag + botones + snap; un panel domina el viewport
   y se asoma el siguiente). Cada personaje expone retrato + galería de concepts
   y su ficha (nombre / rol / descripción), con lightbox. Dinámico: cantidad y
   orden se gestionan desde el CMS (CharactersManager, evento `cms:charactersManager`),
   espejando ProjectsShowcase: el contenido se lee reactivamente de state.items y
   los contenedores quedan registrados en engine.ts para edición inline.
   Ref. visual: case-studies con scroll lateral (Awwwards / Active Theory). */

import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi,
} from '@/components/ui/carousel'
import AutoScroll from 'embla-carousel-auto-scroll'
import {
  ensureGSAP, gsap, ScrollTrigger, prefersReducedMotion,
  typewriterRevealLoop, wordRevealLoop, type LoopHandle,
} from '@/hooks/useGSAP'
import SoftwareDropdown from '@/components/home/SoftwareDropdown'
import { useCmsStore, state } from '@/lib/cms/store'
import { rescan } from '@/components/cms/engine'

const CONCEPTS_PER = 4

function readCount(): number {
  let count = 4
  try {
    const s = JSON.parse(state.items['char.settings'] || '')
    if (s && typeof s.count === 'number') count = s.count
  } catch {}
  return Math.max(0, count)
}

type Lightbox = { src: string; name: string; role: string; desc: string } | null

function Corners() {
  return (
    <>
      <span className="ch-corner tl" /><span className="ch-corner tr" />
      <span className="ch-corner bl" /><span className="ch-corner br" />
    </>
  )
}

/* Imagen editable (bg-image). El contenedor con data-cms-key queda registrado en
   el motor CMS (engine.ts), que maneja el estado vacío (marco punteado + subida)
   y las herramientas de edición inline. Acá pintamos el media reactivamente desde
   state.items y exponemos data-full para el lightbox. */
function CharMedia({
  cmsKey, className, onOpen,
}: { cmsKey: string; className: string; onOpen: (src: string) => void }) {
  useCmsStore()
  const src = state.items[cmsKey] || ''
  const has = !!src && !src.includes('placeholder')
  return (
    <div
      className={`${className}${has ? ' has-media' : ''}`}
      data-cms-key={cmsKey}
      data-full={has ? src : ''}
      style={has ? { backgroundImage: `url("${src}")` } : undefined}
      onClick={(e) => { e.stopPropagation(); if (has) onOpen(src) }}
    />
  )
}

function CharacterPanel({ index, total, onOpen }: { index: number; total: number; onOpen: (lb: Lightbox) => void }) {
  useCmsStore()
  const key = `char#${index}`
  const name = state.items[`${key}::name`] || ''
  const role = state.items[`${key}::role`] || ''
  const desc = state.items[`${key}::desc`] || ''
  const num = String(index + 1).padStart(2, '0')
  const tot = String(total).padStart(2, '0')

  const open = (src: string) => onOpen({ src, name: name || `Personaje ${num}`, role, desc })

  return (
    <article className="ch-panel" data-cms-key={key} data-name={name} data-role={role} data-desc={desc}>
      <Corners />
      <div className="ch-panel__media">
        <div className="ch-portrait-wrap">
          <CharMedia cmsKey={key} className="ch-portrait" onOpen={open} />
        </div>
        <div className="ch-concepts">
          {Array.from({ length: CONCEPTS_PER }, (_, m) => (
            <div className="ch-concept-cell" key={m}>
              <CharMedia cmsKey={`${key}::c${m}`} className="ch-concept" onOpen={open} />
            </div>
          ))}
        </div>
      </div>

      <div className="ch-panel__info">
        <span className="ch-ghost" aria-hidden="true">{num}</span>
        <span className="ch-counter"><b>{num}</b> / {tot}</span>
        <h3 className="ch-name">{name || `Character ${num}`}</h3>
        <div className="ch-role">{role || 'Character Role'}</div>
        <p className="ch-desc">
          {desc || 'Brief character description: from early concept to final design, exploring form, color, and personality.'}
        </p>
      </div>
    </article>
  )
}

export default function CharactersShowcase() {
  useCmsStore()
  const isAdmin = state.isAdmin
  const sectionRef = useRef<HTMLElement>(null)
  const [api, setApi] = useState<CarouselApi>()
  const [lightbox, setLightbox] = useState<Lightbox>(null)
  const [showInfo, setShowInfo] = useState(false)

  const count = readCount()

  // Firma del contenido visible → reInit de embla cuando cambian alta/baja/orden
  // o las imágenes (los clones/medidas se reconstruyen), igual que en Projects.
  const signature = Array.from({ length: count }, (_, i) =>
    [
      state.items[`char#${i}`] || '',
      state.items[`char#${i}::name`] || '',
      ...Array.from({ length: CONCEPTS_PER }, (_, m) => state.items[`char#${i}::c${m}`] || ''),
    ].join('|'),
  ).join('~')
  useEffect(() => {
    api?.reInit()
    if (state.isAdmin) {
      setTimeout(() => rescan(), 100)
    }
  }, [api, signature])

  // Reveal de entrada del encabezado + typewriter del título (patrón hermano).
  useEffect(() => {
    if (prefersReducedMotion()) return
    ensureGSAP()
    const sec = sectionRef.current
    if (!sec) return
    let titleTw: LoopHandle | null = null
    let descTw: LoopHandle | null = null
    const ctx = gsap.context(() => {
      gsap.set('.ch-showcase__fig', { autoAlpha: 0, y: 12 })
      gsap.set('.ch-showcase__desc', { autoAlpha: 0, y: 18 })
      gsap.set('.ch-panel', { autoAlpha: 0, y: 36 })
      const tl = gsap.timeline({ defaults: { ease: 'power4.out' }, paused: true })
      tl.to('.ch-showcase__fig', { autoAlpha: 1, y: 0, duration: 0.4 }, 0)
        .to('.ch-showcase__desc', { autoAlpha: 1, y: 0, duration: 0.7 }, 0.35)
        .to('.ch-panel', { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.12, ease: 'power3.out', clearProps: 'transform' }, '-=0.3')
      let played = false
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !played) {
            played = true
            tl.play()
            io.disconnect()
            const titleEl = sec.querySelector<HTMLElement>('.ch-showcase__title')
            const descEl = sec.querySelector<HTMLElement>('.ch-showcase__desc')
            if (titleEl) titleTw = typewriterRevealLoop(titleEl, 8)
            if (descEl) descTw = wordRevealLoop(descEl, 8)
          }
        }
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 })
      io.observe(sec)

      gsap.set('.ch-showcase__rail-fill', { scaleY: 0, transformOrigin: 'top center' })
      gsap.to('.ch-showcase__rail-fill', {
        scaleY: 1, ease: 'none',
        scrollTrigger: { trigger: sec, start: 'top 70%', end: 'bottom 50%', scrub: 0.6 },
      })

      ScrollTrigger.refresh()
    }, sectionRef)
    return () => { titleTw?.kill(); descTw?.kill(); ctx.revert() }
  }, [])

  // Panel de info del lightbox: aparece 1s después de ampliar.
  useEffect(() => {
    if (!lightbox) { setShowInfo(false); return }
    const t = setTimeout(() => setShowInfo(true), 1000)
    return () => clearTimeout(t)
  }, [lightbox])

  const openLightbox = useCallback((lb: Lightbox) => setLightbox(lb), [])
  const closeLightbox = useCallback(() => setLightbox(null), [])

  return (
    <section ref={sectionRef} className="ch-showcase" id="characters" aria-labelledby="ch-showcase-title">
      <div className="ch-showcase__rail" aria-hidden="true">
        <span className="ch-showcase__rail-fig">FILE 04 · CHARACTERS</span>
        <span className="ch-showcase__rail-track"><span className="ch-showcase__rail-fill" /></span>
        <span className="ch-showcase__rail-fig ch-showcase__rail-fig--end">END</span>
      </div>

      <div className="ch-showcase__inner">
        <header className="ch-showcase__header">
          <span className="ch-showcase__fig">FIG. 04 — Cast</span>
          <h2 id="ch-showcase-title" className="ch-showcase__title">Characters</h2>
          <p className="ch-showcase__desc" data-i18n="characters_desc">
            Character gallery: each piece explores its complete process — from early concept
            to final design, focusing on form, color, and personality.
          </p>
          <SoftwareDropdown prefix="char" count={3} />
          {isAdmin && (
            <button
              type="button"
              className="ch-showcase__manage"
              title="Gestionar personajes"
              aria-label="Gestionar personajes"
              onClick={() => window.dispatchEvent(new CustomEvent('cms:charactersManager'))}
            >
              <i className="fa-solid fa-gear" /> Gestionar
            </button>
          )}
        </header>

        {count === 0 ? (
          <div className="ch-empty">
            <i className="fa-solid fa-user-plus" />
            <span>{isAdmin ? 'Add characters from "Manage".' : 'Coming soon.'}</span>
          </div>
        ) : (
          <Carousel
            key={count}
            setApi={setApi}
            opts={{ align: 'center', loop: true, watchDrag: count > 1 }}
            // Cinta continua: AutoScroll mueve pixel a pixel (no snap-jump como
            // Autoplay), constante y sin pausas. stopOnInteraction:false → el
            // drag manual no la detiene para siempre, retoma sola. Respeta
            // prefers-reduced-motion (mismo criterio que el resto del sitio).
            plugins={count > 1 && !prefersReducedMotion() ? [
              AutoScroll({ speed: 0.7, stopOnInteraction: false, stopOnMouseEnter: false }),
            ] : []}
            className="ch-carousel"
          >
            <CarouselContent className="-ml-4 md:-ml-6">
              {Array.from({ length: count }).map((_, i) => (
                <CarouselItem key={i} className="pl-4 md:pl-6 basis-[92%] md:basis-[82%] lg:basis-[74%]">
                  <CharacterPanel index={i} total={count} onOpen={openLightbox} />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="ch-nav" />
            <CarouselNext className="ch-nav" />
          </Carousel>
        )}
      </div>

      {lightbox && typeof document !== 'undefined' && createPortal(
        <div className="ch-lightbox" onClick={closeLightbox}>
          <button type="button" className="ch-lightbox__close" onClick={closeLightbox} aria-label="Cerrar">
            <i className="fa-solid fa-xmark" />
          </button>
          <div className={`ch-lightbox__media${showInfo ? ' is-shifted' : ''}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox.src} alt={lightbox.name} className="ch-lightbox__img" onClick={(e) => e.stopPropagation()} />
            <button
              type="button"
              className="ch-lightbox__info-btn"
              onClick={(e) => { e.stopPropagation(); setShowInfo((p) => !p) }}
              aria-label="Información"
            >
              <i className={`fa-solid ${showInfo ? 'fa-xmark' : 'fa-circle-info'}`} />
            </button>
            {showInfo && (
              <div className="ch-lightbox__info-panel" onClick={(e) => e.stopPropagation()}>
                <h3>{lightbox.name}</h3>
                <dl className="ch-lightbox__meta">
                  {lightbox.role && <div><dt>Rol</dt><dd>{lightbox.role}</dd></div>}
                  {lightbox.desc && <div className="ch-lightbox__meta-block"><dt>Descripción</dt><dd>{lightbox.desc}</dd></div>}
                </dl>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </section>
  )
}

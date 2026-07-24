'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel'
import Autoplay from 'embla-carousel-autoplay'
import { useCmsStore, state } from '@/lib/cms/store'

// Shared hook for carousel reinitialization
import { useCarouselSync } from '@/components/ui/useCarouselSync'

import { rescan } from '@/components/cms/engine'

// El contenido se lee reactivamente desde el store (state.items) y se renderiza
// como JSX. Antes se leía vía data-attrs + MutationObserver, pero embla clona los
// slides al hacer loop/reInit y los clones quedaban sin el src/textos que el motor
// inyectaba imperativamente sólo en el nodo original → tarjetas en blanco.


function ProjectCard({ index }: { index: number }) {
  useCmsStore()
  const key = `proj#${index}`
  const imgSrc = state.items[key] || ''
  const title = state.items[`${key}::title`] || ''
  const startDate = state.items[`${key}::start_date`] || ''
  const summary = state.items[`${key}::summary`] || ''
  const hasImage = !!imgSrc && !imgSrc.includes('placeholder')

  return (
    <div
      data-content-id={key}
      className="project-item h-full group flex flex-col justify-between w-full bg-white rounded-lg shadow-sm hover:shadow-xl border border-gray-100 overflow-hidden hover:-translate-y-1.5 transition-all duration-500 ease-out"
    >
      {/* 1. Contenedor de Imagen (Formato apaisado 3:2 elegante con borde divisorio inferior) */}
      <div
        className="w-full aspect-[16/10] sm:aspect-[3/2] bg-gray-50 relative block shrink-0 overflow-hidden border-b border-gray-100/80"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="proj-card-img w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          loading="lazy" decoding="async"
          src={imgSrc || undefined}
          alt={title || `Project ${index + 1}`}
        />
        <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

        {!hasImage && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 bg-gray-100">
            <span className="text-sm tracking-widest uppercase" data-i18n="no_image">No image</span>
          </div>
        )}
      </div>

      {/* Contenedor de Textos y Botón (Amplios márgenes y perfecta distribución vertical) */}
      <div className="flex flex-col flex-1 justify-between p-6 sm:p-7" style={{ padding: 'clamp(1.4rem, 2vw, 1.75rem)' }}>
        <div>
          {/* Etiqueta / Meta */}
          <div className="flex items-center gap-3 mb-3" style={{ marginBottom: '0.85rem' }}>
            <span className="w-8 h-[1.5px] bg-[var(--accent)]"></span>
            <span className="proj-card-date text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
              {startDate || 'In progress'}
            </span>
          </div>

          {/* 2. Título (con altura mínima para alinear las tarjetas de al lado) */}
          <h3 className="proj-card-title min-h-[3.6rem] text-xl md:text-2xl font-extrabold text-gray-900 tracking-tight leading-snug line-clamp-2 group-hover:text-[var(--accent)] transition-colors duration-300 mb-3" style={{ marginBottom: '0.75rem', minHeight: '3.6rem' }}>
            {title || `Project Title ${index + 1}`}
          </h3>

          {/* 3. Breve descriptivo (altura fija para que los botones de pie queden alineados) */}
          <p className="proj-card-summary min-h-[4.2rem] text-gray-500 text-[0.9rem] leading-relaxed line-clamp-3 mb-5" style={{ marginBottom: '1.25rem', minHeight: '4.2rem' }}>
            {summary || "This is a brief descriptive placeholder text for the project. The actual summary will appear here once you add content from the panel."}
          </p>
        </div>

        {/* 4. Pie con Botón Leer Más y borde divisorio */}
        <div className="mt-auto pt-3 border-t border-gray-100/80 flex items-center justify-start" style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid rgba(229, 231, 235, 0.8)' }}>
          <button 
            className="group/link inline-flex items-center gap-2 text-[11px] font-semibold text-gray-400 tracking-[0.16em] uppercase relative pb-2 transition-colors duration-300 hover:text-[var(--accent)] cursor-pointer bg-transparent border-none shadow-none outline-none"
            type="button"
            onClick={(e) => e.preventDefault()}
          >
            Read more
            <i className="fa-solid fa-arrow-right text-[9px] transition-transform duration-300 group-hover/link:translate-x-1.5" />
            <span className="absolute left-0 w-full h-[1.5px] bg-[var(--accent)] origin-left scale-x-0 transition-transform duration-300 ease-out group-hover/link:scale-x-100" style={{ bottom: '-5px' }} />
          </button>
        </div>
      </div>
    </div>
  )
}

import { ensureGSAP, gsap, ScrollTrigger, prefersReducedMotion, typewriterRevealLoop, wordRevealLoop, type LoopHandle } from '@/hooks/useGSAP'

export default function ProjectsShowcase() {
  useCmsStore();
  const isAdmin = state.isAdmin;
  const sectionRef = useRef<HTMLElement>(null)
  const [carouselApi, setCarouselApi] = useState<CarouselApi>()

  let count = 4;
  try {
    const s = JSON.parse(state.items['proj.settings'] || '');
    if (s && typeof s.count === 'number' && s.count >= 0) {
      if (s.count !== 6 || state.items['proj#4'] || state.items['proj#5']) {
        count = s.count;
      }
    }
  } catch {}
  const displayCount = count > 0 ? count : 4

  const completedIndices: number[] = []
  if (count > 0) {
    for (let i = 0; i < count; i++) {
      const src = state.items[`proj#${i}`] || ''
      const title = state.items[`proj#${i}::title`] || ''
      const hasImage = !!src && !src.includes('placeholder')
      if (hasImage && !!title.trim()) {
        completedIndices.push(i)
      }
    }
  }

  // Embla clona los slides con loop:true y los clones son copias estáticas del
  // DOM; al cambiar contenido (alta/baja/reemplazo/reorden) sin reInit, los clones
  // quedan viejos → "la tarjeta vecina pierde/cambia la imagen". Firmamos todo el
  // contenido visible y reInit cuando cambia para que los clones se reconstruyan.
  const projSignature = Array.from({ length: count }, (_, i) =>
    [
      state.items[`proj#${i}`] || '',
      state.items[`proj#${i}::title`] || '',
      state.items[`proj#${i}::start_date`] || '',
      state.items[`proj#${i}::summary`] || '',
    ].join('|'),
  ).join('~')
  // Reinitialize carousel when content changes using shared hook
  useCarouselSync(carouselApi, projSignature, [displayCount])

  useEffect(() => {
    if (prefersReducedMotion()) return
    ensureGSAP()
    const sec = sectionRef.current
    if (!sec) return

    let titleTw: LoopHandle | null = null
    let descTw: LoopHandle | null = null

    const ctx = gsap.context(() => {
      gsap.set('.proj-showcase__fig', { autoAlpha: 0, y: 12 })
      gsap.set('.proj-showcase__title', { autoAlpha: 0 })
      gsap.set('.proj-showcase__desc', { autoAlpha: 0, y: 18 })
      gsap.set('.project-item', { autoAlpha: 0, y: 40, scale: 0.95 })

      const tl = gsap.timeline({ defaults: { ease: 'power4.out' }, paused: true })
      tl.to('.proj-showcase__fig', { autoAlpha: 1, y: 0, duration: 0.4 }, 0)
        .to('.proj-showcase__desc', { autoAlpha: 1, y: 0, duration: 0.7 }, 0.45)
        .to('.project-item', { autoAlpha: 1, y: 0, scale: 1, duration: 0.7, stagger: 0.1, ease: 'power3.out', clearProps: 'transform' }, '-=0.3')

      let played = false
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !played) {
            played = true
            tl.play()
            io.disconnect()
            const titleEl = sec.querySelector<HTMLElement>('.proj-showcase__title')
            const descEl = sec.querySelector<HTMLElement>('.proj-showcase__desc')
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
    <section ref={sectionRef} className="proj-showcase w-full">
      {/* Riel vertical decorativo */}


      <div className="proj-showcase__frame">
        {/* Encabezado de la sección */}
        <div style={{ marginBottom: '2rem', position: 'relative' }}>
          <span className="proj-showcase__fig text-xs tracking-[0.22em] text-[var(--accent)] uppercase mb-3 block">
            FIG. 03.5 — Work
          </span>
          <h2 className="proj-showcase__title text-4xl md:text-5xl font-bold text-gray-900" style={{ marginBottom: '1.25rem' }}>
            Featured Projects
          </h2>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <p className="proj-showcase__desc text-gray-600 max-w-[60ch] text-base md:text-lg">
              A curated selection of my featured projects and artwork.
            </p>
            {isAdmin && (
              <button 
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('cms:projectsManager'))}
                title="Gestionar proyectos"
                aria-label="Gestionar proyectos"
                className="proj-showcase__manage"
              >
                <i className="fa-solid fa-gear" /> Gestionar
              </button>
            )}
          </div>
        </div>

        {/* Carrusel de proyectos / Estado vacío (Equilibrado como sub-sección horizontal) */}
        <div className="w-full relative mt-3">
          {completedIndices.length === 0 && count === 0 ? (
            <div className="w-full min-h-[380px] md:min-h-[420px] flex flex-col items-center justify-center p-8 text-center border border-dashed border-gray-300/80 rounded-lg bg-white/60 shadow-sm transition-all duration-300">
              <div className="w-16 h-16 rounded-full bg-violet-50 border border-violet-200/60 flex items-center justify-center text-violet-600 mb-3 shadow-inner">
                <i className="fa-solid fa-layer-group text-xl opacity-80" />
              </div>
              <h3 className="text-lg font-bold text-gray-800">No hay proyectos destacados</h3>
            </div>
          ) : (
            <Carousel
              key={`${displayCount}-${completedIndices.join('-')}`}
              setApi={setCarouselApi}
              opts={{
                align: 'start',
                loop: true,
              }}
              plugins={[
                Autoplay({
                  delay: 4000,
                }),
              ]}
              className="w-full"
            >
              <CarouselContent className="-ml-4 py-4">
                {Array.from({ length: displayCount }, (_, i) => i).map((index) => (
                  <CarouselItem key={index} className="pl-4 basis-full sm:basis-1/2 md:basis-1/3 lg:basis-1/4 flex items-stretch py-3">
                    <div className="w-full h-full px-1 sm:px-1.5">
                      <ProjectCard index={index} />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>

              {/* Flechas minimalistas */}
              <button
                type="button"
                onClick={() => carouselApi?.scrollPrev()}
                aria-label="Previous slide"
                className="hidden md:flex absolute -left-16 lg:-left-20 xl:-left-24 top-1/2 -translate-y-1/2 z-20 w-11 h-11 md:w-12 md:h-12 rounded-full bg-white/95 border border-gray-200 text-gray-700 shadow-sm transition-all duration-300 items-center justify-center group/side active:scale-95 cursor-pointer outline-none"
              >
                <i className="fa-solid fa-arrow-left text-xs transition-transform duration-300 group-hover/side:-translate-x-0.5" />
              </button>

              <button
                type="button"
                onClick={() => carouselApi?.scrollNext()}
                aria-label="Next slide"
                className="hidden md:flex absolute -right-16 lg:-right-20 xl:-right-24 top-1/2 -translate-y-1/2 z-20 w-11 h-11 md:w-12 md:h-12 rounded-full bg-white/95 border border-gray-200 text-gray-700 shadow-sm transition-all duration-300 items-center justify-center group/side active:scale-95 cursor-pointer outline-none"
              >
                <i className="fa-solid fa-arrow-right text-xs transition-transform duration-300 group-hover/side:translate-x-0.5" />
              </button>
            </Carousel>
          )}
        </div>
      </div>
    </section>
  )
}

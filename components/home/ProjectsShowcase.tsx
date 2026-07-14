'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel'
import Autoplay from 'embla-carousel-autoplay'
import { useCmsStore, state } from '@/lib/cms/store'

// El contenido se lee reactivamente desde el store (state.items) y se renderiza
// como JSX. Antes se leía vía data-attrs + MutationObserver, pero embla clona los
// slides al hacer loop/reInit y los clones quedaban sin el src/textos que el motor
// inyectaba imperativamente sólo en el nodo original → tarjetas en blanco.
import { rescan } from '@/components/cms/engine'

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
      className="project-item h-full group flex flex-col justify-between w-full bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl hover:shadow-gray-200/50 hover:-translate-y-1 transition-all duration-500 ease-out"
    >
      {/* 1. Contenedor de Imagen */}
      <div
        className="w-full aspect-[4/3] bg-gray-50 relative block shrink-0 overflow-hidden"
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

      {/* Contenedor de Textos y Botón */}
      <div className="flex flex-col flex-1 justify-between" style={{ padding: '2.5rem' }}>
        <div>
          {/* Etiqueta / Meta */}
          <div className="flex items-center gap-3" style={{ marginBottom: '1.25rem' }}>
            <span className="w-8 h-[1px] bg-[var(--accent)]"></span>
            <span className="proj-card-date text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
              {startDate || 'In progress'}
            </span>
          </div>

          {/* 2. Título */}
          <h3 className="proj-card-title min-h-[3.6rem] text-2xl font-extrabold text-gray-900 tracking-tight leading-snug line-clamp-2 group-hover:text-[var(--accent)] transition-colors duration-300" style={{ marginBottom: '1rem' }}>
            {title || `Project Title ${index + 1}`}
          </h3>

          {/* 3. Breve descriptivo */}
          <p className="proj-card-summary min-h-[4.5rem] text-gray-500 text-[0.95rem] leading-relaxed line-clamp-3" style={{ marginBottom: '2.5rem' }}>
            {summary || "This is a brief descriptive placeholder text for the project. The actual summary will appear here once you add content from the panel."}
          </p>
        </div>

        {/* 4. Botón Leer Más (fijo abajo) */}
        <div className="mt-auto pt-4">
          <button 
            className="group/link inline-flex items-center gap-2 text-[11px] font-medium text-gray-400 tracking-[0.15em] uppercase relative pb-1 transition-colors duration-300 hover:text-[var(--accent)] cursor-pointer bg-transparent border-none shadow-none outline-none"
            type="button"
            onClick={(e) => e.preventDefault()}
          >
            Read more
            <i className="fa-solid fa-arrow-right text-[9px] transition-transform duration-300 group-hover/link:translate-x-1.5" />
            <span className="absolute left-0 bottom-0 w-full h-[1px] bg-[var(--accent)] origin-left scale-x-0 transition-transform duration-300 ease-out group-hover/link:scale-x-100" />
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
    if (s && typeof s.count === 'number') count = s.count;
  } catch {}
  // Sin proyectos cargados: mínimo visual de 4 tarjetas de ejemplo (mismos
  // placeholders que ya usa ProjectCard) para que la sección no se vea vacía.
  // No persiste nada ni afecta el conteo real que gestiona el admin.
  const displayCount = count > 0 ? count : 4

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
  useEffect(() => {
    if (!carouselApi) return
    carouselApi.reInit()
    const t = setTimeout(() => {
      carouselApi?.reInit()
      if (state.isAdmin) rescan()
    }, 60)
    return () => clearTimeout(t)
  }, [carouselApi, projSignature, displayCount])

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

      gsap.set('.proj-showcase__rail-fill', { scaleY: 0, transformOrigin: 'top center' })
      gsap.to('.proj-showcase__rail-fill', {
        scaleY: 1, ease: 'none',
        scrollTrigger: { trigger: sec, start: 'top 70%', end: 'bottom 50%', scrub: 0.6 },
      })

      ScrollTrigger.refresh()
    }, sectionRef)
    return () => { titleTw?.kill(); descTw?.kill(); ctx.revert() }
  }, [])

  return (
    <section ref={sectionRef} className="proj-showcase w-full bg-gray-50">
      {/* Riel vertical decorativo */}
      <div className="proj-showcase__rail" aria-hidden="true">
        <span className="proj-showcase__rail-fig">FILE 03.5 · PROJECTS</span>
        <span className="proj-showcase__rail-track">
          <span className="proj-showcase__rail-fill" />
        </span>
        <span className="proj-showcase__rail-fig proj-showcase__rail-fig--end">END</span>
      </div>

      <div className="proj-showcase__frame">
        {/* Encabezado de la sección */}
        <div style={{ marginBottom: '3rem', position: 'relative' }}>
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

        {/* Carrusel de proyectos */}
        <div className="w-full relative mt-4">
          <Carousel
            key={displayCount}
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
            <CarouselContent className="-ml-4 py-6">
              {Array.from({ length: displayCount }).map((_, i) => (
                <CarouselItem key={i} className="pl-4 basis-full md:basis-1/2 lg:basis-1/3 flex items-stretch py-4">
                  <div className="w-full h-full px-1.5 sm:px-2">
                    <ProjectCard index={i} />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            
            <CarouselPrevious className="hidden md:flex -left-12 lg:-left-16 bg-white border-gray-200 text-gray-900 hover:bg-[var(--accent)] hover:text-white hover:border-[var(--accent)] transition-colors duration-300 shadow-sm" />
            <CarouselNext className="hidden md:flex -right-12 lg:-right-16 bg-white border-gray-200 text-gray-900 hover:bg-[var(--accent)] hover:text-white hover:border-[var(--accent)] transition-colors duration-300 shadow-sm" />
          </Carousel>
        </div>
      </div>
    </section>
  )
}

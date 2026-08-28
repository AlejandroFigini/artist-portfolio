'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel'
import Autoplay, { type AutoplayType } from 'embla-carousel-autoplay'
import { useInViewRef } from '@/hooks/useInView'
import { useCmsItems, useCmsText } from '@/lib/cms/content-context'
import { canHover, mediaSrcSet, optimizedMediaSrc } from '@/lib/utils'
import { useCmsStore, state, useUiText } from '@/lib/cms/store'

// Shared hook for carousel reinitialization
import { useCarouselSync } from '@/components/ui/useCarouselSync'
import { COLLECTIONS } from '@/lib/cms/collections'
import { isEmptyMedia, itemKey, readSettings } from '@/lib/cms/collection'
import { DEFAULT_DURATION_MS } from '@/lib/cms/useCollection'


// El contenido se lee reactivamente (lib/cms/content-context: el payload del
// servidor primero, el store una vez cargado) y se renderiza
// como JSX. Antes se leía vía data-attrs + MutationObserver, pero embla clona los
// slides al hacer loop/reInit y los clones quedaban sin el src/textos que el motor
// inyectaba imperativamente sólo en el nodo original → tarjetas en blanco.


function ProjectCard({ id, index }: { id: string; index: number }) {
  useCmsStore()
  /* `useCmsItems` / `useCmsText` en lugar de `state.items` y `t()`: en el render
     del servidor el store está vacío, así que la tarjeta salía sin imagen y sin
     textos y todo aparecía recién después de hidratar. Ambos leen del contenido
     que el servidor ya mandó y pasan al store en cuanto el cliente lo carga —
     con la traducción aplicada, que es lo que `t()` garantizaba. */
  const items = useCmsItems()
  const text = useCmsText()
  const key = `proj#${id}`
  const imgSrc = items[key] || ''
  const title = text(`${key}::title`)
  const startDate = text(`${key}::start_date`)
  const summary = text(`${key}::summary`)
  const hasImage = !isEmptyMedia(imgSrc)

  const [isHovered, setIsHovered] = useState(false)
  const [activeSlide, setActiveSlide] = useState(0)

  const CONCEPTS_PER = 3
  const galleryKeys = [
    key,
    ...Array.from({ length: CONCEPTS_PER }, (_, m) => `${key}::c${m}`),
  ]

  /* La lista se recalcula en cada render (sale del store mutable), así que se
     reduce a una clave estable y el efecto depende del array derivado de ella.
     Antes la dependencia era la expresión `…join(',')` escrita inline, que el
     linter no puede verificar y dejaba `validConceptIndices` fuera del array. */
  const conceptsKey = [
    0,
    ...Array.from({ length: CONCEPTS_PER }, (_, m) => m + 1).filter((idx) =>
      !isEmptyMedia(items[`${key}::c${idx - 1}`])),
  ].join(',')

  const validConceptIndices = useMemo(() => conceptsKey.split(',').map(Number), [conceptsKey])

  /* El reset a la primera lámina vive en onMouseLeave, no acá: hacerlo con un
     setState síncrono dentro del efecto encadenaba un render extra por cada
     tarjeta al sacar el mouse. */
  useEffect(() => {
    if (!isHovered || validConceptIndices.length <= 1) return

    const duration = activeSlide === 0 ? 500 : 1300
    const timer = setTimeout(() => {
      const currentIdx = validConceptIndices.indexOf(activeSlide)
      const nextIdx = currentIdx !== -1 && currentIdx + 1 < validConceptIndices.length ? currentIdx + 1 : 0
      setActiveSlide(validConceptIndices[nextIdx])
    }, duration)

    return () => clearTimeout(timer)
  }, [isHovered, activeSlide, validConceptIndices])

  return (
    <div
      data-content-id={key}
      className="project-item h-full group flex flex-col justify-between w-full bg-white rounded-lg shadow-sm hover:shadow-xl border border-gray-100 overflow-hidden hover:-translate-y-1.5 transition-all duration-500 ease-out"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setActiveSlide(0) }}
    >
      {/* 1. Contenedor de Imagen (Formato apaisado 3:2 elegante con borde divisorio inferior) */}
      <div
        className="w-full aspect-[16/10] sm:aspect-[3/2] bg-gray-50 relative block shrink-0 overflow-hidden border-b border-gray-100/80"
      >
        {galleryKeys.map((gKey, idx) => {
          const src = items[gKey]
          const isMain = idx === 0
          
          // Si no es la principal y no tiene imagen, no la renderizamos
          if (!isMain && isEmptyMedia(src)) return null
          
          return (
            /* El engine del CMS reescribe el src de este nodo por DOM
               (data-cms-key); next/image envuelve y controla el suyo, así que
               rompería la edición en vivo. */
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={gKey}
              data-cms-key={isMain ? key : undefined}
              className={`${isMain ? 'proj-card-img' : 'proj-concept-img'} absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-out`}
              style={{
                opacity: activeSlide === idx ? 1 : 0,
                transform: `scale(${activeSlide === idx && isHovered ? 1.05 : 1})`,
                zIndex: activeSlide === idx ? 2 : 1,
              }}
              loading="lazy" decoding="async"
              src={isEmptyMedia(src) ? undefined : optimizedMediaSrc(src, 828)}
              srcSet={isEmptyMedia(src) ? undefined : mediaSrcSet(src, [384, 640, 828])}
              // 1 card por fila en móvil, hasta 4 en desktop
              sizes="(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 25vw"
              alt={title || `Project image ${idx}`}
            />
          )
        })}
        
        <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-10" />

        {!hasImage && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 bg-gray-100 z-0">
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
          <h3 className="proj-card-title min-h-[3.6rem] text-xl md:text-2xl font-normal font-[family-name:var(--font)] text-gray-900 tracking-tight leading-snug line-clamp-2 group-hover:text-[var(--accent)] transition-colors duration-300 mb-3" style={{ marginBottom: '0.75rem', minHeight: '3.6rem' }}>
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

import { useMotionReady, prefersReducedMotion, type LoopHandle } from '@/hooks/useGSAP'

export default function ProjectsShowcase() {
  const motion = useMotionReady() // GSAP llega en su propio chunk;
  useCmsStore();
  const ui = useUiText()
  const isAdmin = state.isAdmin;
  const sectionRef = useRef<HTMLElement>(null)
  const [carouselApi, setCarouselApi] = useState<CarouselApi>()

  /* La lista de proyectos también sale del contenido del servidor: leyéndola
     del store, en SSR no había ids y la sección entera se renderizaba sin una
     sola tarjeta. */
  const items = useCmsItems()
  const projSettings = readSettings(items, 'proj')
  const ids = projSettings.ids
  const spec = COLLECTIONS['proj']
  /* Intervalo de rotación, editable desde Gestionar proyectos (spec.duration).
     Autoplay recibe el delay al construirse, así que va también en la `key` del
     carrusel: sin remontar, un cambio de intervalo no se aplicaría hasta
     recargar. */
  const autoplayDelay = projSettings.duration ?? DEFAULT_DURATION_MS

  const completedIds = ids.filter((id) => {
    const key = itemKey(spec, id)
    return !isEmptyMedia(items[key]) && !!(items[`${key}::title`] || '').trim()
  })

  // Embla clona los slides con loop:true y los clones son copias estáticas del
  // DOM; al cambiar contenido sin reInit quedan viejos. Firmamos todo el
  // contenido visible para reconstruirlos cuando cambia.
  const projSignature = ids.map((id) => {
    const key = itemKey(spec, id)
    return [
      items[key] || '',
      items[`${key}::title`] || '',
      items[`${key}::start_date`] || '',
      items[`${key}::summary`] || '',
    ].join('|')
  }).join('~')

  useCarouselSync(carouselApi, projSignature, [ids.length])

  // Fuera de pantalla el autoplay sigue disparando scrolls (y repintando el
  // track) sin que nadie lo vea: se frena hasta que la sección vuelve.
  const inView = useInViewRef(sectionRef)
  /* Espejo del estado para los handlers de modal, que viven en otro efecto y
     no pueden leer `inView` del closure. Mismo patrón que CharactersShowcase. */
  const inViewRef = useRef(true)
  useEffect(() => {
    inViewRef.current = inView
    const autoplay = carouselApi?.plugins()?.autoplay
    if (!carouselApi || !autoplay) return
    const apply = () => { if (inView) autoplay.play(); else autoplay.stop() }
    apply()
    // `useCarouselSync` hace reInit al montar y al cambiar el contenido, y el
    // plugin arranca solo (playOnInit): hay que reaplicar el freno después.
    carouselApi.on('reInit', apply)
    return () => { carouselApi.off('reInit', apply) }
  }, [carouselApi, inView])

  // Pausar autoplay del carrusel cuando hay un modal abierto
  useEffect(() => {
    if (!carouselApi) return
    const onModalOpen = () => {
      try {
        const autoplay = carouselApi.plugins()?.autoplay as AutoplayType | undefined
        if (autoplay) autoplay.stop()
      } catch {}
    }
    const onModalClose = () => {
      try {
        const autoplay = carouselApi.plugins()?.autoplay as AutoplayType | undefined
        /* `inViewRef` es imprescindible: el freno por viewport solo se reaplica
           cuando CAMBIA `inView`. Sin este guard, abrir y cerrar el modal de
           contacto con la sección ya fuera de cuadro dejaba el autoplay
           corriendo hasta que el visitante volviera a entrar y salir de ella. */
        if (autoplay && inViewRef.current && !document.body.classList.contains('contact-modal-open') && !document.body.classList.contains('cms-modal-open')) {
          autoplay.play()
        }
      } catch {}
    }

    if (document.body.classList.contains('contact-modal-open') || document.body.classList.contains('cms-modal-open')) {
      onModalOpen()
    }

    window.addEventListener('modal:open', onModalOpen)
    window.addEventListener('modal:close', onModalClose)
    return () => {
      window.removeEventListener('modal:open', onModalOpen)
      window.removeEventListener('modal:close', onModalClose)
    }
  }, [carouselApi])

  useEffect(() => {
    if (prefersReducedMotion()) return
    if (!motion) return
    const { gsap, ScrollTrigger, typewriterRevealLoop, wordRevealLoop } = motion
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
        .to('.project-item', { autoAlpha: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.08, ease: 'power3.out', clearProps: 'transform' }, 0.3)

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
  }, [motion])

  return (
    <section ref={sectionRef} className="proj-showcase w-full" id="projects">
      {/* Riel vertical decorativo */}


      <div className="proj-showcase__frame">
        {/* Encabezado de la sección */}
        <div style={{ marginBottom: '2rem', position: 'relative' }}>
          <span className="proj-showcase__fig text-xs tracking-[0.22em] text-[var(--accent)] uppercase mb-3 block">
            FIG. 03.5 — Work
          </span>
          <h2 className="proj-showcase__title text-3xl md:text-4xl text-gray-900 leading-none tracking-tight" style={{ fontFamily: 'var(--font-display)', fontWeight: 200, marginBottom: '2rem' }}>
            Featured Projects
          </h2>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <p className="proj-showcase__desc text-gray-900 max-w-2xl text-base leading-relaxed" style={{ fontWeight: 200 }}>
              A curated selection of my featured projects and artwork.
            </p>
            {isAdmin && (
              <button 
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('cms:projectsManager'))}
                title="Manage projects"
                aria-label="Manage projects"
                className="proj-showcase__manage"
              >
                <i className="fa-solid fa-gear" /> Gestionar
              </button>
            )}
          </div>
        </div>

        {/* Carrusel de proyectos / Estado vacío (Equilibrado como sub-sección horizontal) */}
        <div className="w-full relative mt-3">
          {ids.length === 0 ? (
            <div className="w-full min-h-[380px] md:min-h-[420px] flex flex-col items-center justify-center p-8 text-center border border-dashed border-gray-300/80 rounded-lg bg-white/60 shadow-sm transition-all duration-300">
              <div className="w-16 h-16 rounded-full bg-violet-50 border border-violet-200/60 flex items-center justify-center text-violet-600 mb-3 shadow-inner">
                <i className="fa-solid fa-layer-group text-xl opacity-80" />
              </div>
              <h3 className="text-lg font-bold text-gray-800">{ui('no_projects')}</h3>
            </div>
          ) : (
            <Carousel
              key={`${ids.length}-${completedIds.join('-')}-${autoplayDelay}`}
              setApi={setCarouselApi}
              opts={{
                align: 'start',
                loop: true,
                dragFree: true,
              }}
              plugins={prefersReducedMotion() ? [] : [
                Autoplay({
                  delay: autoplayDelay,
                  stopOnMouseEnter: true,
                  stopOnInteraction: true,
                }),
              ]}
              className="w-full"
              onMouseEnter={() => {
                if (!canHover()) return
                const autoplay = carouselApi?.plugins()?.autoplay as AutoplayType | undefined
                if (autoplay) autoplay.stop()
              }}
              onMouseLeave={() => {
                if (!canHover()) return
                const autoplay = carouselApi?.plugins()?.autoplay as AutoplayType | undefined
                if (autoplay) autoplay.play()
              }}
            >
              <CarouselContent className="-ml-4 py-4">
                {ids.map((id, i) => (
                  <CarouselItem key={id} className="pl-4 basis-full sm:basis-1/2 md:basis-1/3 lg:basis-1/4 flex items-stretch py-3">
                    <div className="w-full h-full px-1 sm:px-1.5">
                      <ProjectCard id={id} index={i} />
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

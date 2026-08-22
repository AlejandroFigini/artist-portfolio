'use client'

/* eslint-disable react-hooks/set-state-in-effect */

/* Characters (home) — galería de personajes en paneles full-bleed con scroll
   horizontal (carrusel embla: drag + botones + snap; un panel domina el viewport
   y se asoma el siguiente). Cada personaje expone retrato + galería de concepts
   y su ficha (nombre / rol / descripción), con lightbox. Dinámico: cantidad y
   orden se gestionan desde el CMS (CharactersManager, evento `cms:charactersManager`),
   espejando ProjectsShowcase: el contenido se lee reactivamente de state.items y
   los contenedores quedan registrados en engine.ts para edición inline.
   Ref. visual: case-studies con scroll lateral (Awwwards / Active Theory). */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Carousel, CarouselContent, CarouselItem, type CarouselApi,
} from '@/components/ui/carousel'
import AutoScroll from 'embla-carousel-auto-scroll'
import { useMotionReady, prefersReducedMotion, type LoopHandle } from '@/hooks/useGSAP'
import SoftwareDropdown from '@/components/home/SoftwareDropdown'
import { useInViewRef } from '@/hooks/useInView'
import { canHover, optimizedMediaSrc } from '@/lib/utils'
import { useCmsStore, state, t, useUiText } from '@/lib/cms/store'
import { useCarouselSync } from '@/components/ui/useCarouselSync'
import { sendGAEvent } from '@next/third-parties/google'
import { COLLECTIONS } from '@/lib/cms/collections'
import { isEmptyMedia, itemKey } from '@/lib/cms/collection'
import { readCollectionIds } from '@/lib/cms/useCollection'

const CONCEPTS_PER = 3

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
  const has = !isEmptyMedia(src)
  return (
    <div
      className={`${className}${has ? ' has-media' : ''}`}
      data-cms-key={cmsKey}
      data-full={has ? src : ''}
      // el panel nunca pasa de ~480px CSS → 1080 cubre DPR2 sin traer el original
      style={has ? { backgroundImage: `url("${optimizedMediaSrc(src, 1080)}")` } : undefined}
      onClick={(e) => { e.stopPropagation(); if (has) onOpen(src) }}
    />
  )
}

function CharacterPanel({ id, index, total, onOpen, isHoveringRef }: { id: string; index: number; total: number; onOpen: (lb: Lightbox) => void; isHoveringRef?: React.MutableRefObject<boolean> }) {
  useCmsStore()
  const ui = useUiText()
  const [isHovered, setIsHovered] = useState(false)
  const [activeSlide, setActiveSlide] = useState(0) // 0 = retrato principal, 1..4 = concepts c0..c3

  const key = `char#${id}`
  const sampleNames = ['Elena — Paladin Concept', 'Kaelen — Shadow Wanderer', 'Lyra — Star Weaver', 'Thorne — Iron Juggernaut', 'Vael — Frost Blade', 'Zephyr — Sky Hunter', 'Nyx — Void Oracle', 'Orion — Solar Warden']
  const sampleRoles = ['Hero Concept & Turnaround', 'Dark Fantasy Character Design', 'Sci-Fi Protagonist Study', 'Mecha & Armor Lookdev', 'Cryo Warrior Visual Dev', 'Aero Scout Character Sheet', 'Mystic Entity Concept Art', 'Paladin Commander Sculpt']
  // Texto vía t(): este panel se re-renderiza desde el store, así que leer
  // state.items directo pisaría la traducción que aplicó setLanguage.
  const name = t(`${key}::name`, sampleNames[index % sampleNames.length] || '')
  const role = t(`${key}::role`, sampleRoles[index % sampleRoles.length] || '')
  const desc = t(`${key}::desc`, 'Full character exploration: from early rough thumbnails and silhouette studies to finalized lookdev, turnaround sheets, and expression breakdowns.')
  const num = String(index + 1).padStart(2, '0')
  const tot = String(total).padStart(2, '0')

  const galleryKeys = [
    key, // index 0: imagen principal
    ...Array.from({ length: CONCEPTS_PER }, (_, m) => `${key}::c${m}`), // indices 1..4: imagenes pequeñas
  ]

  // Incluimos el índice 0 (imagen principal) y filtramos qué índices (1 al 4) tienen imagen
  /* La lista se recalcula en cada render (sale del store mutable), así que se
     reduce a una clave estable y el efecto depende del array derivado de ella.
     Antes la dependencia era la expresión `…join(',')` escrita inline, que el
     linter no puede verificar y dejaba `validConceptIndices` fuera del array. */
  const conceptsKey = [
    0,
    ...Array.from({ length: CONCEPTS_PER }, (_, m) => m + 1).filter((idx) =>
      !isEmptyMedia(state.items[`${key}::c${idx - 1}`])),
  ].join(',')

  const validConceptIndices = useMemo(() => conceptsKey.split(',').map(Number), [conceptsKey])

  useEffect(() => {
    // Si no hay hover, o si solo está la imagen principal (length <= 1), se queda en 0
    if (!isHovered || validConceptIndices.length <= 1) {
      if (!isHovered) setActiveSlide(0)
      return
    }

    // La imagen principal (0) dura menos que los concepts secundarios
    const duration = activeSlide === 0 ? 500 : 1300

    // Si hay concepts válidos, cicla a través de ellos, incluyendo la imagen principal
    const timer = setTimeout(() => {
      const currentIdx = validConceptIndices.indexOf(activeSlide)
      const nextIdx = currentIdx !== -1 && currentIdx + 1 < validConceptIndices.length ? currentIdx + 1 : 0
      setActiveSlide(validConceptIndices[nextIdx])
    }, duration)

    return () => clearTimeout(timer)
  }, [isHovered, activeSlide, validConceptIndices])

  const open = (src: string) => onOpen({ src, name: name || `Character ${num}`, role, desc })

  /* El ciclo de concepts es una interacción de puntero fino. En táctil el
     navegador dispara mouseenter de compatibilidad al tocar/arrastrar pero
     nunca el mouseleave: `isHoveringRef` quedaba en true para siempre y, como
     es el freno del auto-scroll, el carrusel no volvía a moverse después de
     mover las tarjetas con el dedo. Sin hover real, no se entra al estado. */
  const handleMouseEnter = () => {
    if (!canHover()) return
    setIsHovered(true)
    // Siempre arranca mostrando la imagen principal y deja que el ciclo avance a las subimágenes
    setActiveSlide(0)
    if (isHoveringRef) isHoveringRef.current = true
  }

  const handleMouseLeave = () => {
    if (!canHover()) return
    setIsHovered(false)
    setActiveSlide(0) // vuelve a la imagen principal en el contenedor grande y quita el destacado
    if (isHoveringRef) isHoveringRef.current = false
  }

  return (
    <article
      className={`ch-panel ${isHovered ? 'is-hovered' : ''}`}
      data-name={name}
      data-role={role}
      data-desc={desc}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Corners />
      <div className="ch-panel__media">
        <div className="ch-portrait-wrap relative overflow-hidden">
          {galleryKeys.map((gKey, idx) => (
            <div
              key={gKey}
              className="absolute inset-0 w-full h-full transition-opacity duration-500 ease-in-out"
              style={{
                opacity: activeSlide === idx ? 1 : 0,
                pointerEvents: activeSlide === idx ? 'auto' : 'none',
                zIndex: activeSlide === idx ? 2 : 1,
              }}
            >
              <CharMedia cmsKey={gKey} className={`${gKey.includes('::c') ? 'ch-concept-slide' : 'ch-portrait'} w-full h-full`} onOpen={open} />
            </div>
          ))}
        </div>
        <div className="ch-concepts">
          {Array.from({ length: CONCEPTS_PER }, (_, m) => {
            const isFeatured = isHovered && activeSlide === m + 1
            return (
              <div
                className={`ch-concept-cell transition-all duration-300 ${isFeatured ? 'ring-1 ring-violet-400/30 z-10 opacity-100' : isHovered ? 'opacity-65' : 'opacity-100'}`}
                key={m}
                onMouseEnter={() => {
                  if (isHovered && canHover()) setActiveSlide(m + 1)
                }}
              >
                <CharMedia 
                  cmsKey={`${key}::c${m}`} 
                  className="ch-concept" 
                  onOpen={() => {
                    setIsHovered(true)
                    setActiveSlide(m + 1)
                  }} 
                />
              </div>
            )
          })}
        </div>
      </div>

      <div className="ch-panel__info">

        <span className="ch-counter"><b>{num}</b> / {tot}</span>
        <h3 className="ch-name">{name || `Character ${num}`}</h3>
        <div className="ch-role">{role || ui('character_role')}</div>
        <p className="ch-desc">
          {desc || 'Brief character description: from early concept to final design, exploring form, color, and personality.'}
        </p>
      </div>
    </article>
  )
}

export default function CharactersShowcase() {
  const motion = useMotionReady() // GSAP llega en su propio chunk
  useCmsStore()
  const ui = useUiText()
  const isAdmin = state.isAdmin
  const sectionRef = useRef<HTMLElement>(null)
  const isHoveringRef = useRef(false)
  const [api, setApi] = useState<CarouselApi>()
  const [lightbox, setLightbox] = useState<Lightbox>(null)
  const [showInfo, setShowInfo] = useState(false)
  const inView = useInViewRef(sectionRef)
  // Espejo en ref: los handlers de abajo (pointerUp/settle/modal) viven fuera
  // del ciclo de render y necesitan el valor actual sin re-suscribirse.
  const inViewRef = useRef(true)

  // El auto-scroll corre en rAF: fuera de pantalla se frena (nadie lo ve y
  // seguía repintando el track en cada frame).
  useEffect(() => {
    inViewRef.current = inView
    const autoScroll = api?.plugins()?.autoScroll
    if (!api || !autoScroll) return
    const apply = () => {
      if (!inViewRef.current) autoScroll.stop()
      else if (!isHoveringRef.current) autoScroll.play()
    }
    apply()
    // `useCarouselSync` hace reInit al montar y al cambiar el contenido, y el
    // plugin arranca solo (playOnInit): hay que reaplicar el freno después.
    api.on('reInit', apply)
    return () => { api.off('reInit', apply) }
  }, [api, inView])

  const ids = readCollectionIds('char')
  const spec = COLLECTIONS['char']

  const completedIds = ids.filter((id) => {
    const key = itemKey(spec, id)
    return !isEmptyMedia(state.items[key]) && !!(state.items[`${key}::name`] || '').trim()
  })

  // Firma del contenido visible → reInit de embla cuando cambian alta/baja/orden
  // o las imágenes (los clones/medidas se reconstruyen), igual que en Projects.
  const signature = ids.map((id) => {
    const key = itemKey(spec, id)
    return [
      state.items[key] || '',
      state.items[`${key}::name`] || '',
      ...Array.from({ length: CONCEPTS_PER }, (_, m) => state.items[`${key}::c${m}`] || ''),
    ].join('|')
  }).join('~')

  useCarouselSync(api, signature, [ids.length])

  // Retomar el movimiento automático casi instantáneamente (120ms) tras soltar el mouse o finalizar arrastre
  useEffect(() => {
    if (!api) return
    const autoScroll = api.plugins().autoScroll
    if (!autoScroll) return

    let timer: NodeJS.Timeout
    const isModalOpen = () => document.body.classList.contains('contact-modal-open') || document.body.classList.contains('cms-modal-open')

    const resumeFast = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (isHoveringRef.current || isModalOpen() || !inViewRef.current) return // NUNCA reanudar si el usuario está hover, hay modal abierto o la sección no se ve
        autoScroll.play()
      }, 0)
    }

    const onModalOpen = () => {
      try { autoScroll.stop() } catch {}
    }
    const onModalClose = () => {
      try {
        if (!isHoveringRef.current && !isModalOpen() && inViewRef.current) {
          autoScroll.play()
        }
      } catch {}
    }

    if (isModalOpen()) {
      onModalOpen()
    }

    api.on('pointerUp', resumeFast)
    api.on('settle', resumeFast)
    window.addEventListener('modal:open', onModalOpen)
    window.addEventListener('modal:close', onModalClose)

    return () => {
      clearTimeout(timer)
      api.off('pointerUp', resumeFast)
      api.off('settle', resumeFast)
      window.removeEventListener('modal:open', onModalOpen)
      window.removeEventListener('modal:close', onModalClose)
    }
  }, [api])

  // Reveal de entrada del encabezado + typewriter del título (patrón hermano).
  useEffect(() => {
    if (prefersReducedMotion()) return
    if (!motion) return
    const { gsap, ScrollTrigger, typewriterRevealLoop, wordRevealLoop } = motion
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
        .to('.ch-panel', { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.08, ease: 'power3.out', clearProps: 'transform' }, 0.4)
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
      }, { rootMargin: '0px 0px -25% 0px', threshold: 0.15 })
      io.observe(sec)



      ScrollTrigger.refresh()
    }, sectionRef)
    return () => { titleTw?.kill(); descTw?.kill(); ctx.revert() }
  }, [motion])

  // Panel de info del lightbox: aparece 1s después de ampliar.
  useEffect(() => {
    if (!lightbox) return
    const t = setTimeout(() => setShowInfo(true), 1000)
    return () => clearTimeout(t)
  }, [lightbox])

  const openLightbox = useCallback((lb: Lightbox) => {
    setLightbox(lb)
    setShowInfo(false)
    sendGAEvent('event', 'fullscreen_open')
  }, [])
  const closeLightbox = useCallback(() => {
    setLightbox(null)
    setShowInfo(false)
  }, [])

  // Si está vacío, se renderiza el estado vacío ocupando el mismo espacio de altura

  const isLoopable = completedIds.length > 0

  // Embla está en modo `loop`: con pocos paneles no hay contenido suficiente
  // para clonar la pista y el ciclo queda entrecortado. Repetimos los ids
  // reales hasta cubrir el mínimo — el `id` sigue siendo la clave del CMS,
  // la posición repetida sólo se usa para la key de React.
  //
  // PERO solo para el VISITANTE: cada panel duplicado reusa la misma clave
  // `char#<uid>`, así que en modo admin editar/subir contenido en un panel se
  // refleja en sus copias y parece "se aplica a todas las tarjetas". El admin
  // ve cada personaje UNA sola vez (edición 1:1); el loop estético con relleno
  // queda para quien no está editando.
  const MIN_LOOP_ITEMS = 6
  let renderIds = completedIds
  if (isLoopable && !isAdmin) {
    while (renderIds.length < MIN_LOOP_ITEMS) {
      renderIds = [...renderIds, ...completedIds]
    }
  }

  return (
    <section ref={sectionRef} className="ch-showcase" id="characters" aria-labelledby="ch-showcase-title">


      <div className="ch-showcase__inner">
        <header className="ch-showcase__header">
          <span className="ch-showcase__fig">FIG. 04 — Cast</span>
          <h2 id="ch-showcase-title" className="ch-showcase__title">Characters</h2>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4" style={{ marginBottom: '0.75rem' }}>
            <p className="ch-showcase__desc" data-i18n="characters_desc">
              Character gallery: each piece explores its complete process — from early concept
              to final design, focusing on form, color, and personality.
            </p>
            {isAdmin && (
              <button
                type="button"
                className="ch-showcase__manage"
                title="Manage characters"
                aria-label="Manage characters"
                onClick={() => window.dispatchEvent(new CustomEvent('cms:charactersManager'))}
              >
                <i className="fa-solid fa-gear" /> Gestionar
              </button>
            )}
          </div>
          <SoftwareDropdown prefix="char" count={3} />
        </header>

        <div className="ch-showcase__cards-container">
          {completedIds.length === 0 ? (
            <div className="w-full min-h-[520px] md:min-h-[580px] flex flex-col items-center justify-center p-8 text-center border border-dashed border-violet-300/60 rounded-2xl bg-white/60 shadow-sm transition-all duration-300">
              <div className="cms-placeholder-inner w-16 h-16 rounded-full bg-violet-50 border border-violet-200/60 flex items-center justify-center text-violet-600 mb-4 shadow-inner">
                <i className="fa-solid fa-user-astronaut text-xl opacity-80" />
              </div>
              <h3 className="cms-placeholder-inner text-lg font-bold text-gray-800">{ui('no_characters')}</h3>
            </div>
          ) : (
            <Carousel
              key={`${ids.length}-${signature}`}
              setApi={setApi}
              opts={{ align: 'start', loop: isLoopable, dragFree: true, watchDrag: true }}
              plugins={isLoopable && !prefersReducedMotion() ? [
                AutoScroll({ speed: 0.75, stopOnInteraction: false, stopOnMouseEnter: false }),
              ] : []}
              className="ch-carousel"
            >
              <CarouselContent className="-ml-3 md:-ml-4">
                {renderIds.map((id, i) => (
                  <CarouselItem key={`${id}-${i}`} className="pl-3 md:pl-4 basis-[88%] sm:basis-[340px] md:basis-[370px] lg:basis-[395px] xl:basis-[415px] flex">
                    <CharacterPanel id={id} index={i % completedIds.length} total={completedIds.length} onOpen={openLightbox} isHoveringRef={isHoveringRef} />
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          )}
        </div>
      </div>

      {lightbox && typeof document !== 'undefined' && createPortal(
        <div className={`lightbox ${showInfo ? 'info-open' : ''}`} style={{ display: 'flex', opacity: 1 }} onClick={closeLightbox}>
          <span className="lightbox-close" onClick={closeLightbox}>&times;</span>
          <div className="lightbox-wrapper">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox.src} alt={lightbox.name} className="lightbox-content" onClick={(e) => e.stopPropagation()} />
            <button
              type="button"
              className="info-toggle-btn"
              onClick={(e) => { e.stopPropagation(); setShowInfo((p) => !p) }}
              aria-label={ui('information')}
            >
              <i className="fa-solid fa-info" />
            </button>
            <div className={`lightbox-info-panel ${showInfo ? '' : 'hidden'}`} onClick={(e) => e.stopPropagation()}>
              <h3 className="info-title">{lightbox.name}</h3>
              <div className="info-divider"></div>
              <div className="info-meta">
                {lightbox.role && <span className="info-project"><i className="fa-solid fa-folder-open"></i> <span className="val">{lightbox.role}</span></span>}
              </div>
              <p className="info-desc">{lightbox.desc}</p>
              <div className="info-footer">
                <span><i className="fa-solid fa-palette"></i> LUCIA MONTAÑA</span>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </section>
  )
}

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

import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Carousel, CarouselContent, CarouselItem, type CarouselApi,
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
  try {
    const s = JSON.parse(state.items['char.settings'] || '')
    if (s && typeof s.count === 'number' && s.count >= 0) {
      return s.count
    }
  } catch {}
  return 8
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

function CharacterPanel({ index, total, onOpen, api, isHoveringRef }: { index: number; total: number; onOpen: (lb: Lightbox) => void; api?: CarouselApi; isHoveringRef?: React.MutableRefObject<boolean> }) {
  useCmsStore()
  const [isHovered, setIsHovered] = useState(false)
  const [activeSlide, setActiveSlide] = useState(0) // 0 = retrato principal, 1..4 = concepts c0..c3

  const key = `char#${index}`
  const sampleNames = ['Elena — Paladin Concept', 'Kaelen — Shadow Wanderer', 'Lyra — Star Weaver', 'Thorne — Iron Juggernaut', 'Vael — Frost Blade', 'Zephyr — Sky Hunter', 'Nyx — Void Oracle', 'Orion — Solar Warden']
  const sampleRoles = ['Hero Concept & Turnaround', 'Dark Fantasy Character Design', 'Sci-Fi Protagonist Study', 'Mecha & Armor Lookdev', 'Cryo Warrior Visual Dev', 'Aero Scout Character Sheet', 'Mystic Entity Concept Art', 'Paladin Commander Sculpt']
  const name = state.items[`${key}::name`] || sampleNames[index % sampleNames.length] || ''
  const role = state.items[`${key}::role`] || sampleRoles[index % sampleRoles.length] || ''
  const desc = state.items[`${key}::desc`] || 'Full character exploration: from early rough thumbnails and silhouette studies to finalized lookdev, turnaround sheets, and expression breakdowns.'
  const num = String(index + 1).padStart(2, '0')
  const tot = String(total).padStart(2, '0')

  const galleryKeys = [
    key, // index 0: imagen principal
    ...Array.from({ length: CONCEPTS_PER }, (_, m) => `${key}::c${m}`), // indices 1..4: imagenes pequeñas
  ]

  useEffect(() => {
    if (!isHovered) {
      setActiveSlide(0)
      return
    }
    // Al posar el mouse, cicla exclusivamente por las imágenes pequeñas (índices 1 al 4) en el contenedor grande
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev >= CONCEPTS_PER ? 1 : prev + 1))
    }, 1250)
    return () => clearInterval(timer)
  }, [isHovered])

  const open = (src: string) => onOpen({ src, name: name || `Personaje ${num}`, role, desc })

  const handleMouseEnter = () => {
    setIsHovered(true)
    setActiveSlide(1) // arranca mostrando la primera imagen pequeña (c0) y destacando su contenedor
    if (isHoveringRef) isHoveringRef.current = true
    api?.plugins().autoScroll?.stop()
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    setActiveSlide(0) // vuelve a la imagen principal en el contenedor grande y quita el destacado
    if (isHoveringRef) isHoveringRef.current = false
    setTimeout(() => {
      if (!isHoveringRef || !isHoveringRef.current) {
        api?.plugins().autoScroll?.play()
      }
    }, 50)
  }

  return (
    <article
      className={`ch-panel ${isHovered ? 'is-hovered' : ''}`}
      data-cms-key={key}
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
              <CharMedia cmsKey={gKey} className="ch-portrait w-full h-full" onOpen={open} />
            </div>
          ))}
        </div>
        <div className="ch-concepts">
          {Array.from({ length: CONCEPTS_PER }, (_, m) => {
            const isFeatured = isHovered && activeSlide === m + 1
            return (
              <div
                className={`ch-concept-cell transition-all duration-300 ${isFeatured ? 'ring-2 ring-violet-600 scale-[1.08] shadow-lg z-10 opacity-100' : isHovered ? 'opacity-65 scale-95' : 'opacity-100'}`}
                key={m}
                onMouseEnter={() => {
                  if (isHovered) setActiveSlide(m + 1)
                }}
              >
                <CharMedia cmsKey={`${key}::c${m}`} className="ch-concept" onOpen={open} />
              </div>
            )
          })}
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
  const isHoveringRef = useRef(false)
  const [api, setApi] = useState<CarouselApi>()
  const [lightbox, setLightbox] = useState<Lightbox>(null)
  const [showInfo, setShowInfo] = useState(false)

  const totalSlots = readCount()
  const completedIndices: number[] = []
  for (let i = 0; i < totalSlots; i++) {
    const src = state.items[`char#${i}`] || ''
    const name = state.items[`char#${i}::name`] || ''
    const hasImage = !!src && !src.includes('placeholder')
    if (hasImage && !!name.trim()) {
      completedIndices.push(i)
    }
  }

  // Firma del contenido visible → reInit de embla cuando cambian alta/baja/orden
  // o las imágenes (los clones/medidas se reconstruyen), igual que en Projects.
  const signature = Array.from({ length: totalSlots }, (_, i) =>
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
  }, [api, signature, totalSlots])

  // Retomar el movimiento automático casi instantáneamente (120ms) tras soltar el mouse o finalizar arrastre
  useEffect(() => {
    if (!api) return
    const autoScroll = api.plugins().autoScroll
    if (!autoScroll) return

    let timer: NodeJS.Timeout
    const resumeFast = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (isHoveringRef.current) return // Si el usuario está posado con el mouse en el carrusel o tarjeta, NUNCA reanudar
        autoScroll.play()
      }, 120)
    }

    api.on('pointerUp', resumeFast)
    api.on('settle', resumeFast)

    return () => {
      clearTimeout(timer)
      api.off('pointerUp', resumeFast)
      api.off('settle', resumeFast)
    }
  }, [api])

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
    if (!lightbox) return
    const t = setTimeout(() => setShowInfo(true), 1000)
    return () => clearTimeout(t)
  }, [lightbox])

  const openLightbox = useCallback((lb: Lightbox) => {
    setLightbox(lb)
    setShowInfo(false)
  }, [])
  const closeLightbox = useCallback(() => {
    setLightbox(null)
    setShowInfo(false)
  }, [])

  // Si está vacío, se renderiza el estado vacío ocupando el mismo espacio de altura

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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4" style={{ marginBottom: '0.75rem' }}>
            <p className="ch-showcase__desc" data-i18n="characters_desc">
              Character gallery: each piece explores its complete process — from early concept
              to final design, focusing on form, color, and personality.
            </p>
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
          </div>
          <SoftwareDropdown prefix="char" count={3} />
        </header>

        <div className="ch-showcase__cards-container">
          {completedIndices.length === 0 ? (
            <div className="w-full min-h-[520px] md:min-h-[580px] flex flex-col items-center justify-center p-8 text-center border border-dashed border-violet-300/60 rounded-2xl bg-white/60 shadow-sm transition-all duration-300">
              <div className="cms-placeholder-inner w-16 h-16 rounded-full bg-violet-50 border border-violet-200/60 flex items-center justify-center text-violet-600 mb-4 shadow-inner">
                <i className="fa-solid fa-user-astronaut text-xl opacity-80" />
              </div>
              <h3 className="cms-placeholder-inner text-lg font-bold text-gray-800">No hay personajes configurados</h3>
            </div>
          ) : (
            <Carousel
              key={completedIndices.join('-')}
              setApi={setApi}
              opts={{ align: 'center', loop: true, dragFree: true, watchDrag: true }}
              plugins={completedIndices.length > 1 && !prefersReducedMotion() ? [
                AutoScroll({ speed: 0.75, stopOnInteraction: false, stopOnMouseEnter: true }),
              ] : []}
              className="ch-carousel"
              onMouseEnter={() => {
                isHoveringRef.current = true
                api?.plugins().autoScroll?.stop()
              }}
              onMouseLeave={() => {
                isHoveringRef.current = false
                api?.plugins().autoScroll?.play()
              }}
            >
              <CarouselContent className="-ml-3 md:-ml-4">
                {completedIndices.map((index) => (
                  <CarouselItem key={index} className="pl-3 md:pl-4 basis-[88%] sm:basis-[360px] md:basis-[400px] lg:basis-[440px] xl:basis-[480px]">
                    <CharacterPanel index={index} total={completedIndices.length} onOpen={openLightbox} api={api} isHoveringRef={isHoveringRef} />
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          )}
        </div>
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

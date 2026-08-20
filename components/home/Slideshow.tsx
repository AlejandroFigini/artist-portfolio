'use client'

/* Hero slideshow — portado de script.js (initHeroSlideshow): crossfade
   GSAP con zoom sutil. CMS-aware: lee las slides y la duración directo del
   store (colección 'hero'), no de un evento — así no depende de si CmsRoot
   ya emitió antes de que este componente montara.
   Sin imágenes → fondo blanco (sin portadas estáticas). 1 imagen → fija,
   sin rotación. Con prefers-reduced-motion queda la primera slide fija. */

import { useEffect, useRef } from 'react'
import { useCarouselSync } from '@/components/ui/useCarouselSync'
import { useMotionReady, prefersReducedMotion } from '@/hooks/useGSAP'
import { state, useCmsStore } from '@/lib/cms/store'
import { COLLECTIONS } from '@/lib/cms/collections'
import { itemKey } from '@/lib/cms/collection'
import { readCollectionDuration, readCollectionIds } from '@/lib/cms/useCollection'
import { markLoaderGate } from '@/lib/loader-ready'
import { optimizedMediaSrc } from '@/lib/utils'

/* Anchos de `mediaSrcSet`. El fondo es un background-image (no acepta srcSet),
   así que elige uno a mano — pero de la MISMA escalera que usa el
   `<link rel=preload imagesrcset>` del server (app/(site)/page.tsx). Si el
   ancho no cayera en un peldaño de esa lista, el precargado y el que pide el
   div serían dos URLs distintas y la portada se bajaría dos veces. */
const BACKDROP_STEPS = [640, 828, 1200, 1920]

/* El fondo es 100vw × 100vh: pedir 1600px fijos en un teléfono era traer ~2.5×
   los píxeles necesarios. Las slides llegan por evento del CMS (nunca en SSR),
   así que leer `window` acá es seguro. */
function backdropWidth(): number {
  if (typeof window === 'undefined') return 1920
  const need = Math.ceil(window.innerWidth * Math.min(window.devicePixelRatio || 1, 2))
  return BACKDROP_STEPS.find((w) => w >= need) ?? BACKDROP_STEPS[BACKDROP_STEPS.length - 1]
}

export default function HeroSlideshow() {
  const motion = useMotionReady() // GSAP llega en su propio chunk
  const carouselRef = useRef<HTMLDivElement>(null)
  /* El fondo es `fixed` y de viewport completo, asi que nunca "sale de
     pantalla" por si solo: quien decide si se ve es el hero. Fuera de el, todas
     las secciones son opacas y lo tapan por completo. */
  const parkedRef = useRef(false)
  useCmsStore()
  const serverReady = state.serverReady
  // Solo las slides con imagen real. Vacío → [] → fondo blanco.
  const slides = readCollectionIds('hero')
    .map((id) => state.items[itemKey(COLLECTIONS['hero'], id)] || '')
    .filter((s) => s.trim() !== '')
  const intervalMs = readCollectionDuration('hero')
  // Firma primitiva y estable: dos renders con el mismo contenido dan el mismo
  // string, aunque `slides` sea un array nuevo por el .map().filter() de arriba.
  const slidesKey = slides.join('|')

  /* Gate del loader: el fondo no debe descubrirse pintándose. Se precarga y
     decodifica la primera slide con la MISMA URL que usa el div, así ya está
     en caché cuando el loader se va. Antes de serverReady las slides todavía
     no llegaron: marcar ahí daría el gate por cumplido de más. */
  useEffect(() => {
    if (!serverReady) return
    const first = slides[0]
    if (!first) { markLoaderGate('heroBackdrop'); return }
    let alive = true
    const done = () => { if (alive) markLoaderGate('heroBackdrop') }
    const img = new Image()
    img.src = optimizedMediaSrc(first, backdropWidth())
    img.decode().then(done, done)
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- slidesKey es la firma estable de `slides`
  }, [slidesKey, serverReady])

  /* Aparcar el fondo cuando el hero no esta en pantalla: deja de ser una capa
     viva durante los ~8500px restantes de scroll. El margen del 10% lo devuelve
     antes de que el borde del hero vuelva a asomar. */
  useEffect(() => {
    const el = carouselRef.current
    const hero = document.querySelector('.hero')
    if (!el || !hero) return
    const io = new IntersectionObserver(
      ([entry]) => {
        parkedRef.current = !entry.isIntersecting
        el.classList.toggle('is-parked', parkedRef.current)
      },
      { rootMargin: '10% 0px' },
    )
    io.observe(hero)
    return () => { io.disconnect(); el.classList.remove('is-parked') }
  }, [])

  useEffect(() => {
    if (prefersReducedMotion()) return
    if (!motion) return
    const { gsap } = motion
    const els = document.querySelectorAll('.hero-bg-carousel .carousel-slide')
    if (els.length < 2) return

    let current = 0
    gsap.fromTo(els[0], { opacity: 0 }, { opacity: 1, duration: 2.5, ease: 'power2.out' })
    if (els.length < 2) return

    const timer = setInterval(() => {
      // Aparcado: nadie lo esta viendo, no hay por que tejer un crossfade.
      if (parkedRef.current) return
      if (typeof document !== 'undefined' && (document.body.classList.contains('contact-modal-open') || document.body.classList.contains('cms-modal-open'))) {
        return
      }
      const next = (current + 1) % els.length
      /* Solo crossfade de opacidad. El zoom lentísimo (scale 1 → 1.03) obligaba
         a re-rasterizar la slide en cada frame ahora que el desenfoque vive en
         ella (styles/legacy/style.css → .carousel-slide). Un 3% de zoom bajo
         blur(8px) y un velo blanco al 70% no se percibe; el costo sí. */
      gsap.fromTo(els[next], { opacity: 0 }, { opacity: 1, duration: 3, ease: 'power1.inOut' })
      gsap.to(els[current], { opacity: 0, duration: 3, ease: 'power1.inOut' })
      current = next
    }, intervalMs)

    return () => {
      clearInterval(timer)
      gsap.killTweensOf(els)
    }
  }, [motion, slidesKey, intervalMs])

  // Sync with CMS admin changes using shared hook
  useCarouselSync(undefined, slidesKey)


  return (
    <>
      <div className="hero-bg-carousel" ref={carouselRef}>
        {slides.map((src, i) => (
          <div
            key={`${i}-${src}`}
            className="carousel-slide"
            style={{
              backgroundImage: `url('${optimizedMediaSrc(src, backdropWidth())}')`,
              opacity: 0,
            }}
          ></div>
        ))}
        <div className="carousel-overlay"></div>
      </div>
    </>
  )
}

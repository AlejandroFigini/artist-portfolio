'use client'

/* Hero slideshow — portado de script.js (initHeroSlideshow): crossfade
   GSAP con zoom sutil. CMS-aware: lee las slides y la duración directo del
   store (colección 'hero'), no de un evento — así no depende de si CmsRoot
   ya emitió antes de que este componente montara.
   Sin imágenes → fondo blanco (sin portadas estáticas). 1 imagen → fija,
   sin rotación. Con prefers-reduced-motion queda la primera slide fija. */

import { useEffect } from 'react'
import { useCarouselSync } from '@/components/ui/useCarouselSync'
import { ensureGSAP, gsap, prefersReducedMotion } from '@/hooks/useGSAP'
import { state, useCmsStore } from '@/lib/cms/store'
import { COLLECTIONS } from '@/lib/cms/collections'
import { itemKey } from '@/lib/cms/collection'
import { readCollectionDuration, readCollectionIds } from '@/lib/cms/useCollection'
import { optimizedMediaSrc } from '@/lib/utils'

/* El fondo es 100vw × 100vh: pedir 1600px fijos en un teléfono era traer ~2.5×
   los píxeles necesarios. Las slides llegan por evento del CMS (nunca en SSR),
   así que leer `window` acá es seguro. */
function backdropWidth(): number {
  if (typeof window === 'undefined') return 1600
  return Math.ceil(window.innerWidth * Math.min(window.devicePixelRatio || 1, 2))
}

export default function HeroSlideshow() {
  useCmsStore()
  // Solo las slides con imagen real. Vacío → [] → fondo blanco.
  const slides = readCollectionIds('hero')
    .map((id) => state.items[itemKey(COLLECTIONS['hero'], id)] || '')
    .filter((s) => s.trim() !== '')
  const intervalMs = readCollectionDuration('hero')
  // Firma primitiva y estable: dos renders con el mismo contenido dan el mismo
  // string, aunque `slides` sea un array nuevo por el .map().filter() de arriba.
  const slidesKey = slides.join('|')

  useEffect(() => {
    if (prefersReducedMotion()) return
    ensureGSAP()
    const els = document.querySelectorAll('.hero-bg-carousel .carousel-slide')
    if (els.length < 2) return

    let current = 0
    gsap.fromTo(els[0], { opacity: 0 }, { opacity: 1, duration: 2.5, ease: 'power2.out' })
    if (els.length < 2) return

    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && (document.body.classList.contains('contact-modal-open') || document.body.classList.contains('cms-modal-open'))) {
        return
      }
      const next = (current + 1) % els.length
      // Separamos la animación de fade in y la de zoom para que el zoom sea constante y lentísimo
      gsap.fromTo(els[next], { opacity: 0 }, { opacity: 1, duration: 3, ease: 'power1.inOut' })
      gsap.fromTo(els[next], { scale: 1 }, { scale: 1.03, duration: (intervalMs / 1000) + 3, ease: 'none' })
      gsap.to(els[current], { opacity: 0, duration: 3, ease: 'power1.inOut' })
      current = next
    }, intervalMs)

    return () => {
      clearInterval(timer)
      gsap.killTweensOf(els)
    }
  }, [slidesKey, intervalMs])

  // Sync with CMS admin changes using shared hook
  useCarouselSync(undefined, slidesKey)


  return (
    <>
      <div className="hero-bg-carousel">
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

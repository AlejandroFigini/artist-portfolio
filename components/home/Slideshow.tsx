'use client'

/* Hero slideshow — portado de script.js (initHeroSlideshow): crossfade
   GSAP con zoom sutil. CMS-aware: CmsRoot emite 'cms:hero' con las
   slides (hero.slide#i) y la duración (hero.settings) del backend.
   Sin imágenes → fondo blanco (sin portadas estáticas). 1 imagen → fija,
   sin rotación. Con prefers-reduced-motion queda la primera slide fija. */

import { useEffect, useState } from 'react'
import { ensureGSAP, gsap, prefersReducedMotion } from '@/hooks/useGSAP'
import { useCmsStore, state } from '@/lib/cms/store'

const DEFAULT_INTERVAL_MS = 6000

type HeroDetail = { slides: string[]; duration: number }

export default function HeroSlideshow() {
  useCmsStore()
  const isAdmin = state.isAdmin
  const [slides, setSlides] = useState<string[]>([])
  const [intervalMs, setIntervalMs] = useState(DEFAULT_INTERVAL_MS)

  // contenido del CMS (CmsRoot → evento tras el fetch de /api/content)
  useEffect(() => {
    const onHero = (e: Event) => {
      const { slides: cmsSlides, duration } = (e as CustomEvent<HeroDetail>).detail
      // Solo las slides con imagen real. Vacío → []  → fondo blanco.
      setSlides(cmsSlides.filter((s) => s && s.trim() !== ''))
      if (duration) setIntervalMs(duration)
    }
    window.addEventListener('cms:hero', onHero)
    return () => window.removeEventListener('cms:hero', onHero)
  }, [])

  useEffect(() => {
    if (prefersReducedMotion()) return
    ensureGSAP()
    const els = document.querySelectorAll('.hero-bg-carousel .carousel-slide')
    if (els.length < 2) return

    let current = 0
    gsap.set(els[0], { opacity: 1 })
    const timer = setInterval(() => {
      const next = (current + 1) % els.length
      gsap.fromTo(els[next], { scale: 1, opacity: 0 }, { scale: 1.05, opacity: 1, duration: 3, ease: 'power1.inOut' })
      gsap.to(els[current], { opacity: 0, duration: 3, ease: 'power1.inOut' })
      current = next
    }, intervalMs)

    return () => {
      clearInterval(timer)
      gsap.killTweensOf(els)
    }
  }, [slides, intervalMs])

  return (
    <>
      <div className="hero-bg-carousel">
        {slides.map((src, i) => (
          <div
            key={`${i}-${src}`}
            className="carousel-slide"
            style={{ backgroundImage: `url('${src}')`, ...(i === 0 ? { opacity: 1 } : {}) }}
          ></div>
        ))}
        <div className="carousel-overlay"></div>
      </div>
    </>
  )
}

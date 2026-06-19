'use client'

import { useEffect, useState } from 'react'
import { ensureGSAP, gsap, prefersReducedMotion } from '@/hooks/useGSAP'
import { useCmsStore, state } from '@/lib/cms/store'

type HeroDetail = { slides: string[]; duration: number }

type Props = {
  prefix: string
  defaultSlides: string[]
  className?: string
}

const DEFAULT_INTERVAL_MS = 6000

export default function HeroMediaCarousel({ prefix, defaultSlides, className = 'cms-media' }: Props) {
  useCmsStore()
  const isAdmin = state.isAdmin
  const [slides, setSlides] = useState<string[]>(defaultSlides)
  const [intervalMs, setIntervalMs] = useState(DEFAULT_INTERVAL_MS)

  // contenido del CMS
  useEffect(() => {
    // When CmsRoot loads it dispatches cms:hero. But our prefix might be different.
    // Actually, CmsRoot currently only broadcasts `cms:hero`.
    // I need to make CmsRoot broadcast `cms:hero-main` and `cms:hero-sub` too!
    const onCarousel = (e: Event) => {
      const { slides: cmsSlides, duration } = (e as CustomEvent<HeroDetail>).detail
      const real = cmsSlides.filter((s) => s && s.trim() !== '')
      if (real.length) setSlides(cmsSlides.map((s, i) => s || defaultSlides[i % defaultSlides.length]))
      if (duration) setIntervalMs(duration)
    }
    window.addEventListener(`cms:${prefix}`, onCarousel)
    return () => window.removeEventListener(`cms:${prefix}`, onCarousel)
  }, [prefix, defaultSlides])

  useEffect(() => {
    if (prefersReducedMotion()) return
    ensureGSAP()
    const els = document.querySelectorAll(`.${prefix}-carousel-slide`)
    if (els.length < 2) return

    let current = 0
    gsap.set(els[0], { opacity: 1 })
    const timer = setInterval(() => {
      const next = (current + 1) % els.length
      // The floating images don't need the scale, just crossfade
      gsap.fromTo(els[next], { opacity: 0 }, { opacity: 1, duration: 2, ease: 'power1.inOut' })
      gsap.to(els[current], { opacity: 0, duration: 2, ease: 'power1.inOut' })
      current = next
    }, intervalMs)

    return () => {
      clearInterval(timer)
      gsap.killTweensOf(els)
    }
  }, [slides, intervalMs, prefix])

  return (
    <>
      {slides.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${i}-${src}`}
          src={src}
          alt={`Slide ${i}`}
          className={`${className} ${prefix}-carousel-slide`}
          style={{
            position: 'absolute',
            top: 0, left: 0, width: '100%', height: '100%',
            objectFit: 'cover',
            opacity: i === 0 ? 1 : 0,
            zIndex: i === 0 ? 1 : 0
          }}
        />
      ))}
      {isAdmin && (
        <button
          className="cms-hero-gear"
          title={`Configurar Carrusel (${prefix})`}
          style={{ position: 'absolute', bottom: '1rem', right: '1rem', zIndex: 100 }}
          onClick={(e) => {
            e.preventDefault()
            window.dispatchEvent(new CustomEvent('cms:carouselManager', { detail: { prefix } }))
          }}
        >
          <i className="fa-solid fa-layer-group"></i>
        </button>
      )}
    </>
  )
}

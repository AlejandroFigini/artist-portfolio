'use client'

/* Reveal on-scroll — portado de gallery-common.js (reveal + stagger).
   Marca html.has-reveal (el CSS solo oculta si el JS está activo) y
   agrega .in vía IntersectionObserver. Respeta prefers-reduced-motion. */

import { useEffect } from 'react'

type StaggerOpts = { selector: string; step?: number }

export function useReveal(stagger?: StaggerOpts) {
  useEffect(() => {
    document.documentElement.classList.add('has-reveal')

    if (stagger) {
      const step = stagger.step ?? 60
      document.querySelectorAll<HTMLElement>(stagger.selector).forEach((el, i) => {
        el.style.transitionDelay = `${i * step}ms`
      })
    }

    const els = document.querySelectorAll<HTMLElement>('.reveal')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || !('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('in'))
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return
          const t = e.target as HTMLElement
          t.classList.add('in')
          // limpiar el delay de cascada para que no afecte hover/tilt luego
          setTimeout(() => { t.style.transitionDelay = '' }, 900)
          io.unobserve(t)
        })
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

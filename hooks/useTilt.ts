'use client'

/* Tilt 3D por puntero — portado de gallery-common.js (tilt).
   Solo mouse fino y sin prefers-reduced-motion. */

import { useEffect } from 'react'

export function useTilt(selector: string, opts: { max?: number } = {}) {
  useEffect(() => {
    const FINE_POINTER = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!FINE_POINTER || REDUCED) return

    const max = opts.max ?? 8
    const cleanups: (() => void)[] = []

    document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      const onEnter = () => { el.style.transition = 'transform 0.12s ease-out' }
      const onMove = (e: PointerEvent) => {
        const r = el.getBoundingClientRect()
        const px = (e.clientX - r.left) / r.width - 0.5
        const py = (e.clientY - r.top) / r.height - 0.5
        el.style.transform =
          `perspective(800px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg) translateY(-6px)`
      }
      const onLeave = () => { el.style.transition = ''; el.style.transform = '' }
      el.addEventListener('pointerenter', onEnter)
      el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerleave', onLeave)
      cleanups.push(() => {
        el.removeEventListener('pointerenter', onEnter)
        el.removeEventListener('pointermove', onMove)
        el.removeEventListener('pointerleave', onLeave)
        el.style.transition = ''
        el.style.transform = ''
      })
    })
    return () => cleanups.forEach((fn) => fn())
  }, [selector, opts.max])
}

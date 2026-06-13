'use client'

/* Wrapper de GSAP para React — useEffect + gsap.context con cleanup
   automático (ctx.revert mata tweens y ScrollTriggers del scope).
   Respeta prefers-reduced-motion: el setup no corre si está activo. */

import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

let registered = false

export function ensureGSAP() {
  if (!registered) {
    gsap.registerPlugin(ScrollTrigger)
    registered = true
  }
  return gsap
}

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useGSAP(setup: () => void, deps: unknown[] = []) {
  useEffect(() => {
    if (prefersReducedMotion()) return
    ensureGSAP()
    const ctx = gsap.context(setup)
    return () => ctx.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

export { gsap, ScrollTrigger }

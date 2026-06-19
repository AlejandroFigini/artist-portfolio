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

export function typewriterLoop(lineEl: HTMLElement, intervalSec = 8) {
  const text = lineEl.textContent || ''
  if (!text) return null
  lineEl.innerHTML = text
    .split('')
    .map((c) => `<span class="tw-char" style="display:inline-block">${c === ' ' ? '&nbsp;' : c}</span>`)
    .join('')
  const chars = lineEl.querySelectorAll<HTMLElement>('.tw-char')
  const tl = gsap.timeline({ repeat: -1, delay: intervalSec })
  tl.set(chars, { autoAlpha: 0 })
    .to(chars, { autoAlpha: 1, duration: 0.04, stagger: 0.07, ease: 'none' })
    .set({}, {}, `+=${intervalSec}`)
  return tl
}

// Reveal por palabras en loop — pensado para párrafos (más fluido que el
// typewriter char-by-char). Cada intervalSec re-revela el texto en cascada.
export function wordRevealLoop(el: HTMLElement, intervalSec = 8) {
  const text = (el.textContent || '').trim()
  if (!text) return null
  el.innerHTML = text
    .split(/(\s+)/)
    .map((w) => (/^\s+$/.test(w) ? w : `<span class="tw-word" style="display:inline-block">${w}</span>`))
    .join('')
  const words = el.querySelectorAll<HTMLElement>('.tw-word')
  const tl = gsap.timeline({ repeat: -1, delay: intervalSec })
  tl.set(words, { autoAlpha: 0, y: 8 })
    .to(words, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.045, ease: 'power2.out' })
    .set({}, {}, `+=${intervalSec}`)
  return tl
}

export { gsap, ScrollTrigger }

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

/* Toggle "Pausar animaciones" (SettingsPanel) activo. */
export function motionOffActive() {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('motion-off')
}

/* Guard único de "no animar" para todos los setups GSAP del sitio:
   prefers-reduced-motion del sistema O el toggle "Pausar animaciones".
   Los componentes lo chequean al montar → con la pausa activa ningún
   setup corre (nada queda en autoAlpha 0 esperando reveal: contenido
   visible estático). */
export function prefersReducedMotion() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches || motionOffActive()
}

export function useGSAP(setup: () => void, deps: unknown[] = []) {
  useEffect(() => {
    if (prefersReducedMotion() || motionOffActive()) return
    ensureGSAP()
    const ctx = gsap.context(setup)
    return () => ctx.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

// ----- Pausa global (toggle "Pausar animaciones") ----------------------------
// Mata toda la coreografía GSAP viva: loops de reveal (dejan el texto pleno),
// tweens en curso (saltan a estado final) y ScrollTriggers (quedan completados
// y deshabilitados → nada más "aparece" al scrollear).
const liveLoops = new Set<LoopHandle>()

export function killAllMotion() {
  ensureGSAP()
  liveLoops.forEach((h) => h.kill())
  liveLoops.clear()
  ScrollTrigger.getAll().forEach((st) => { try { st.animation?.progress(1); st.disable(false) } catch {} })
  gsap.globalTimeline.getChildren(true, true, false).forEach((t) => { try { t.progress(1); t.kill() } catch {} })
}

// Reactiva ScrollTriggers (los loops de reveal muertos vuelven al recargar).
export function resumeMotion() {
  ensureGSAP()
  ScrollTrigger.getAll().forEach((st) => { try { st.enable() } catch {} })
}

// Handle killable para animaciones en loop manejadas con recursión.
export type LoopHandle = { kill: () => void }

type BuildFn = (text: string) => string
type AnimFn = (targets: NodeListOf<HTMLElement>, onDone: () => void) => gsap.core.Tween

// Motor compartido de reveal en loop. Recursión con delayedCall: cada ciclo
// RE-LEE el textContent (clave: si el CMS editó el texto, el ciclo siguiente
// toma el valor nuevo en vez de revertir al original), reconstruye el HTML y
// anima los spans recién creados. Preserva .cms-tools (no rompe la edición).
function revealLoop(el: HTMLElement, intervalSec: number, build: BuildFn, animate: AnimFn): LoopHandle {
  gsap.set(el, { autoAlpha: 1 })
  let killed = false
  let tween: gsap.core.Tween | null = null
  let wait: gsap.core.Tween | null = null
  let lastText = el.textContent || ''

  const detachTools = () => {
    const t = el.querySelector(':scope > .cms-tools')
    if (t) t.remove()
    return t
  }

  const cycle = () => {
    if (killed) return
    // pausa global activada mid-loop → dejar el texto pleno y no re-animar
    if (motionOffActive()) { wait = gsap.delayedCall(intervalSec, cycle); return }
    const tools = detachTools()
    const text = el.textContent || ''
    lastText = text
    if (!text.trim()) {
      if (tools) el.appendChild(tools)
      wait = gsap.delayedCall(intervalSec, cycle)
      return
    }
    el.innerHTML = build(text)
    const targets = el.querySelectorAll<HTMLElement>('.tw-char, .tw-word')
    tween = animate(targets, () => {
      el.textContent = text
      if (tools) el.appendChild(tools)
      wait = gsap.delayedCall(intervalSec, cycle)
    })
  }
  cycle()

  const handle: LoopHandle = {
    kill: () => {
      killed = true
      tween?.kill()
      wait?.kill()
      const tools = detachTools()
      el.textContent = lastText
      if (tools) el.appendChild(tools)
      liveLoops.delete(handle)
    },
  }
  liveLoops.add(handle)
  return handle
}

// Reveal letra por letra LOOPING — para títulos de sección con repetición.
export function typewriterRevealLoop(el: HTMLElement, intervalSec = 8): LoopHandle {
  return revealLoop(
    el,
    intervalSec,
    (text) =>
      text
        .split('')
        .map((c) => `<span class="tw-char" style="display:inline-block">${c === ' ' ? '&nbsp;' : c}</span>`)
        .join(''),
    (targets, onDone) =>
      gsap.from(targets, { autoAlpha: 0, duration: 0.05, stagger: 0.06, ease: 'none', onComplete: onDone }),
  )
}

// Reveal por palabras en loop — para párrafos (más fluido que char-by-char).
export function wordRevealLoop(el: HTMLElement, intervalSec = 8): LoopHandle {
  return revealLoop(
    el,
    intervalSec,
    (text) =>
      text
        .split(/(\s+)/)
        .map((w) => (/^\s+$/.test(w) ? w : `<span class="tw-word" style="display:inline-block">${w}</span>`))
        .join(''),
    (targets, onDone) =>
      gsap.from(targets, { autoAlpha: 0, y: 8, duration: 0.4, stagger: 0.045, ease: 'power2.out', onComplete: onDone }),
  )
}

export { gsap, ScrollTrigger }

'use client'

/* Façade de GSAP para React. NO importa `gsap` de forma estática a propósito:
   el runtime vive en `hooks/gsap-runtime` y se trae con `import()`, así GSAP +
   ScrollTrigger (~149 KB crudos) quedan en su propio chunk y no bloquean ni la
   descarga ni el parseo del primer viewport.

   Uso en componentes:

     const motion = useMotionReady()
     useEffect(() => {
       if (!motion || prefersReducedMotion()) return
       const { gsap, ScrollTrigger } = motion
       const ctx = gsap.context(() => { ... })
       return () => ctx.revert()
     }, [motion])

   `motion` arranca en null y pasa al runtime cuando el chunk llegó: React
   vuelve a correr el efecto solo, con el mismo cleanup de siempre. Si el chunk
   ya estaba cargado (navegación interna) el primer render ya lo devuelve, sin
   frame de espera. */

import { useEffect, useState } from 'react'
import { prefersReducedMotion } from './motion-flags'

export { motionOffActive, prefersReducedMotion } from './motion-flags'
export type { LoopHandle } from './motion-flags'

export type MotionRuntime = typeof import('./gsap-runtime')

let runtime: MotionRuntime | null = null
let pending: Promise<MotionRuntime> | null = null

/* `html.motion-pending` (boot script del layout) mantiene ocultos los elementos
   que el setup de GSAP va a poner en autoAlpha 0, así no se ven enteros durante
   los ms que tarda el chunk.

   NO se saca al resolver el runtime: entre que resuelve y que los efectos de los
   componentes corren hay un render de por medio, y sacarla ahí devuelve el mismo
   parpadeo. GSAP escribe `visibility` inline al revelar, y lo inline gana contra
   un selector de clase — así que la clase puede quedarse mientras la coreografía
   hace su trabajo. Solo la saca el failsafe, para que un chunk que nunca llegó no
   deje contenido escondido. */
const PENDING_FAILSAFE_MS = 2500

if (typeof window !== 'undefined') {
  window.setTimeout(() => document.documentElement.classList.remove('motion-pending'), PENDING_FAILSAFE_MS)
}

/** Trae el chunk de GSAP (idempotente). El plugin se registra en el módulo. */
export function loadGSAP(): Promise<MotionRuntime> {
  if (runtime) return Promise.resolve(runtime)
  if (!pending) pending = import('./gsap-runtime').then((m) => (runtime = m))
  return pending
}

/* La descarga arranca al EVALUARSE este módulo, no en el efecto de
   `useMotionReady`. Next no emite preload para un `import()` de runtime, así que
   el chunk no se descubría hasta que React corría los efectos: medido en
   producción, los 16 chunks iniciales arrancaban todos a los ~1.0s y el de GSAP
   recién a los 4.1s, para terminar a los 5.4s. La coreografía del hero no podía
   empezar hasta entonces y el elemento LCP es justamente uno de sus targets.

   Evaluar el módulo pasa mientras corre el bundle inicial, antes de que termine
   la hidratación: adelanta el pedido sin volver a meter GSAP en el bundle
   crítico (sigue siendo su propio chunk, y se ejecuta igual de tarde). */
if (typeof window !== 'undefined') void loadGSAP()

/** Runtime ya cargado, o null mientras el chunk viaja. */
export function useMotionReady(): MotionRuntime | null {
  const [m, setM] = useState<MotionRuntime | null>(runtime)
  useEffect(() => {
    if (m) return
    let alive = true
    loadGSAP().then((mod) => { if (alive) setM(mod) })
    return () => { alive = false }
  }, [m])
  return m
}

export function useGSAP(setup: (m: MotionRuntime) => void, deps: unknown[] = []) {
  const motion = useMotionReady()
  useEffect(() => {
    if (!motion || prefersReducedMotion()) return
    const ctx = motion.gsap.context(() => setup(motion))
    return () => ctx.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motion, ...deps])
}

/* Congelar la coreografía global mientras hay un modal arriba. No-op si el
   runtime nunca se cargó: no hay timeline que pausar, y traerlo para eso sería
   bajar 149 KB al abrir un modal. */
export function pauseGlobalMotion() { try { runtime?.gsap.globalTimeline.pause() } catch {} }
export function playGlobalMotion() { try { runtime?.gsap.globalTimeline.play() } catch {} }

/* Toggle "Pausar animaciones": si GSAP nunca se cargó no hay nada que matar,
   pero sí que reanudar cuando el usuario lo vuelve a prender. */
export function killAllMotion(): Promise<void> {
  if (runtime) runtime.killAllMotion()
  return Promise.resolve()
}

export function resumeMotion(): Promise<void> {
  return loadGSAP().then((m) => m.resumeMotion())
}

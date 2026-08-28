'use client'

/* SmoothScroll — inercia de scroll a nivel documento (Lenis).
   Ref. de comportamiento: gigabyte.com/Motherboard/X870E-AORUS-PRO-X3D.

   Se engancha al ticker de GSAP en vez de abrir su propio rAF: es la
   integración recomendada de Lenis + ScrollTrigger y evita dos loops
   compitiendo por el mismo frame. Por eso espera al runtime de GSAP, que ya
   viaja en su propio chunk (hooks/useGSAP).

   No se monta si el usuario pidió menos movimiento: `prefers-reduced-motion` o
   el toggle "Pausar animaciones" dejan el scroll nativo del navegador. */

import { useEffect } from 'react'
import { useMotionReady, prefersReducedMotion, motionOffActive } from '@/hooks/useGSAP'
import { setSmoothScroller } from '@/lib/smooth-scroll'

// Curva de frenado: arranque directo y cola larga (exponencial invertida).
const EASE = (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t))

export default function SmoothScroll() {
  const motion = useMotionReady()

  useEffect(() => {
    if (!motion || prefersReducedMotion() || motionOffActive()) return
    /* En un dispositivo táctil Lenis no aporta NADA: `syncTouch` está en false
       a propósito (sincronizarlo pelea con el arrastre de los carruseles) y el
       scroll del sistema ya es inercial. Lo que sí deja es coste: su chunk
       entra en la ventana del evento `load` —que es lo que retiene la pantalla
       de carga— y queda un rAF permanente en el ticker de GSAP llamando a
       `ScrollTrigger.update` en cada scroll, justo en el aparato que menos
       margen tiene. Sin Lenis, `scrollToElement` (lib/smooth-scroll) cae solo
       al `scrollIntoView` nativo. */
    if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) return
    let disposed = false
    let dispose: (() => void) | undefined

    import('lenis').then(({ default: Lenis }) => {
      if (disposed) return
      const lenis = new Lenis({
        duration: 1.4,
        /* Un poco mas de recorrido por muesca de rueda que el 1.0 por defecto */
        wheelMultiplier: 1.15,
        easing: EASE,
        smoothWheel: true,
        /* El táctil queda nativo: sincronizarlo pelea con el arrastre de los
           carruseles (Embla) y en móvil el scroll del sistema ya es inercial. */
        syncTouch: false,
        anchors: true,
      })
      const { gsap, ScrollTrigger } = motion
      const tick = (time: number) => lenis.raf(time * 1000) // gsap da segundos
      lenis.on('scroll', ScrollTrigger.update)
      gsap.ticker.add(tick)
      // `lagSmoothing(0)` se mudó a hooks/gsap-runtime: hace falta monte o no
      // monte Lenis, y en táctil ya no se monta.
      setSmoothScroller(lenis)

      dispose = () => {
        gsap.ticker.remove(tick)
        setSmoothScroller(null)
        lenis.destroy()
      }
    }).catch(() => {})

    return () => {
      disposed = true
      dispose?.()
    }
  }, [motion])

  return null
}

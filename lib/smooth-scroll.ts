/* Registro del scroll suave (Lenis). La instancia la crea
   components/ui/SmoothScroll.tsx; acá vive el puntero para que cualquier
   componente pueda pedir un scroll programado sin importar la librería.

   Sin Lenis (reduced-motion, "Pausar animaciones", chunk que no llegó) el
   fallback es el scroll nativo. */

type SmoothScroller = { scrollTo: (target: HTMLElement | number, opts?: Record<string, unknown>) => void }

let scroller: SmoothScroller | null = null

export function setSmoothScroller(instance: SmoothScroller | null) {
  scroller = instance
}

/** Lleva el viewport al elemento. `reduced` fuerza el salto sin animación. */
export function scrollToElement(el: Element, reduced = false) {
  if (scroller && !reduced) {
    scroller.scrollTo(el as HTMLElement)
    return
  }
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
}

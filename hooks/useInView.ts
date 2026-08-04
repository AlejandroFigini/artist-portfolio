'use client'

/* useInViewRef — ¿el elemento está en pantalla?
   Las animaciones CSS ya las congela `.section-inactive` (HomeFx + legacy).
   Esto cubre lo que CSS no alcanza: loops de JS y carruseles (embla), que
   siguen corriendo rAF y timers aunque la sección esté fuera del viewport. */

import { useEffect, useState, type RefObject } from 'react'

export function useInViewRef(
  ref: RefObject<Element | null>,
  rootMargin = '0px',
  threshold = 0,
): boolean {
  // Sin IntersectionObserver se asume visible: nunca dejar el carrusel frenado.
  const [inView, setInView] = useState(true)

  useEffect(() => {
    const el = ref.current
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin, threshold })
    io.observe(el)
    return () => io.disconnect()
  }, [ref, rootMargin, threshold])

  return inView
}

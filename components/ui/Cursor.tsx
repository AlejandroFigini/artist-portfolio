'use client'

/* Cursor custom GSAP — rediseño delicado: punto + anillo fino que
   respira al pasar sobre interactivos ('expand') y se abre un poco
   más sobre media grande ('peek'). Sin etiquetas ni rellenos.
   Delegación de eventos (mouseover): sobrevive a re-renders.
   Solo puntero fino, sin reduced-motion. Estilos: styles/cursor.css */

import { useEffect, useRef } from 'react'
import { ensureGSAP, gsap, prefersReducedMotion } from '@/hooks/useGSAP'

// media grande: el anillo pasa a modo "peek" (más abierto, más tenue)
const PEEK_SELECTOR = '.about-portrait, .about-reel, .media-container, .animation-item'

const INTERACTIVE_SELECTOR = 'a, button, .soft-pill, .indicator-dot'

export default function Cursor() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const cursor = ref.current
    if (!cursor) return
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    if (!fine || prefersReducedMotion()) return

    ensureGSAP()

    gsap.set(cursor, { opacity: 0 })
    const xTo = gsap.quickTo(cursor, 'x', { duration: 0.08, ease: 'power3.out' })
    const yTo = gsap.quickTo(cursor, 'y', { duration: 0.08, ease: 'power3.out' })

    const onMove = (e: MouseEvent) => {
      gsap.set(cursor, { opacity: 1 })
      xTo(e.clientX)
      yTo(e.clientY)
    }
    const onDocLeave = () => { gsap.to(cursor, { opacity: 0, duration: 0.3 }) }
    const onOver = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      // interactivo gana sobre peek (un botón dentro de un media container)
      if (t.closest(INTERACTIVE_SELECTOR)) {
        cursor.classList.add('expand')
        cursor.classList.remove('peek')
        return
      }
      if (t.closest(PEEK_SELECTOR)) {
        cursor.classList.add('peek')
        cursor.classList.remove('expand')
        return
      }
      cursor.classList.remove('expand', 'peek')
    }

    window.addEventListener('mousemove', onMove)
    document.documentElement.addEventListener('mouseleave', onDocLeave)
    document.addEventListener('mouseover', onOver)
    return () => {
      window.removeEventListener('mousemove', onMove)
      document.documentElement.removeEventListener('mouseleave', onDocLeave)
      document.removeEventListener('mouseover', onOver)
      gsap.killTweensOf(cursor)
    }
  }, [])

  return (
    <div className="custom-cursor" id="custom-cursor" ref={ref}>
      <span className="cursor-dot"></span>
    </div>
  )
}

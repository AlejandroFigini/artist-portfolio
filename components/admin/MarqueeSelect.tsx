'use client'

/* Selección por arrastre (marquee) para las grillas de Contenidos. Con el modo
   de selección múltiple activo, arrastrar con el mouse dibuja un rectángulo y
   marca todas las tarjetas que toca — sin tener que ir una por una ni caer en
   "seleccionar todo".

   Las tarjetas se identifican por `data-sel-type` / `data-sel-key` (los pone
   MediaCard), así que este componente no sabe nada del modelo de datos: envuelve
   cualquier grilla y devuelve los pares seleccionados. */

import { useCallback, useEffect, useRef, useState } from 'react'

export type SelPick = { type: string; val: string }

type Box = { left: number; top: number; width: number; height: number }

/* No arrancar un marquee desde un control: el checkbox, el menú de la tarjeta y
   los enlaces tienen que seguir respondiendo al click normal. */
const INTERACTIVE = 'button, a, input, select, textarea, label, .cms-dropdown, .cms-info-tip'

/** Umbral en px antes de considerar que hubo arrastre (y no un click). */
const DRAG_THRESHOLD = 4

const overlap = (a: DOMRect, b: Box, host: DOMRect) =>
  a.left < host.left + b.left + b.width &&
  a.right > host.left + b.left &&
  a.top < host.top + b.top + b.height &&
  a.bottom > host.top + b.top

type Props = {
  /** Solo con el modo de selección múltiple activo. */
  active: boolean
  /** Se llama al empezar el arrastre: el padre congela la selección previa. */
  onStart: () => void
  /** Tarjetas dentro del rectángulo, en cada movimiento. */
  onChange: (picks: SelPick[]) => void
  className?: string
  children: React.ReactNode
}

export default function MarqueeSelect({ active, onStart, onChange, className, children }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const origin = useRef<{ x: number; y: number } | null>(null)
  const moved = useRef(false)
  const [box, setBox] = useState<Box | null>(null)

  const stop = useCallback(() => {
    origin.current = null
    setBox(null)
    document.body.classList.remove('cms-marquee-active')
  }, [])

  // El arrastre puede terminar fuera del host (o con la ventana perdiendo foco).
  useEffect(() => {
    if (!box) return
    const onUp = () => {
      /* El pointerup sobre una tarjeta dispara su click, que abre la vista
         previa: tras un arrastre eso no es lo que el usuario pidió. Se come el
         click siguiente, una sola vez. */
      if (moved.current) {
        const swallow = (ev: MouseEvent) => { ev.stopPropagation(); ev.preventDefault() }
        document.addEventListener('click', swallow, { capture: true, once: true })
        // Si no hubo click (soltó sobre el fondo), no dejar el listener colgado.
        setTimeout(() => document.removeEventListener('click', swallow, { capture: true }), 0)
      }
      stop()
    }
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('blur', stop)
    return () => {
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('blur', stop)
    }
  }, [box, stop])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Táctil queda fuera: ahí el arrastre es scroll de la página.
    if (!active || e.pointerType !== 'mouse' || e.button !== 0) return
    if ((e.target as HTMLElement).closest(INTERACTIVE)) return
    origin.current = { x: e.clientX, y: e.clientY }
    moved.current = false
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const from = origin.current
    const host = hostRef.current
    if (!from || !host) return
    const dx = e.clientX - from.x
    const dy = e.clientY - from.y
    if (!moved.current && Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return

    if (!moved.current) {
      moved.current = true
      onStart()
      document.body.classList.add('cms-marquee-active')
    }

    const hostRect = host.getBoundingClientRect()
    const next: Box = {
      left: Math.min(from.x, e.clientX) - hostRect.left,
      top: Math.min(from.y, e.clientY) - hostRect.top,
      width: Math.abs(dx),
      height: Math.abs(dy),
    }
    setBox(next)

    const picks: SelPick[] = []
    host.querySelectorAll<HTMLElement>('[data-sel-key]').forEach((card) => {
      if (!overlap(card.getBoundingClientRect(), next, hostRect)) return
      picks.push({ type: card.dataset.selType || '', val: card.dataset.selKey || '' })
    })
    onChange(picks)
  }

  return (
    <div
      ref={hostRef}
      className={className}
      style={{ position: 'relative' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
    >
      {children}
      {box && (
        <div
          className="cms-marquee"
          aria-hidden="true"
          style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
        />
      )}
    </div>
  )
}

'use client'

/* Reloj en vivo MVD — portado de interactions.js (initLiveClock).
   SSR muestra el sello estático; el tick reemplaza el texto sin
   re-render de React (textContent directo, 1 vez por segundo). */

import { useEffect, useRef } from 'react'

export default function LiveClock() {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const timeStr = new Date().toLocaleTimeString('es-UY', {
        timeZone: 'America/Montevideo',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
      el.textContent = `MVD // ${timeStr} UTC-3`
    }
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [])

  return <span id="live-mvd-clock" ref={ref} suppressHydrationWarning>COORD // MVD_UY</span>
}

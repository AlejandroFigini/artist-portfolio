'use client'

/* Google Analytics fuera de la ventana de carga.

   `<GoogleAnalytics>` monta un `next/script` con estrategia afterInteractive:
   gtag.js son ~160 KB transferidos (de los cuales Lighthouse mide ~69 KB que no
   se ejecutan) y dos tareas largas de ~95 ms y ~62 ms, todo compitiendo con la
   hidratación y con los fetches que la pantalla de carga está esperando.

   Nada de eso es crítico para pintar la página, así que se monta cuando el
   navegador ya no tiene trabajo pendiente: después del evento `load` y del
   primer hueco de idle. Si el visitante interactúa antes, se monta ahí mismo
   para no perder el evento.

   Contrapartida: una visita que se va antes de que el navegador quede libre no
   registra page_view. */

import { useEffect, useState } from 'react'
import { GoogleAnalytics } from '@next/third-parties/google'

const IDLE_TIMEOUT_MS = 2000
const WAKE_EVENTS = ['pointerdown', 'keydown', 'touchstart'] as const

export default function DeferredAnalytics({ gaId }: { gaId: string }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (mounted) return
    let done = false
    let idleId = 0

    const arm = () => {
      if (done) return
      done = true
      cleanup()
      setMounted(true)
    }

    const scheduleIdle = () => {
      if (done) return
      const ric = window.requestIdleCallback
      if (ric) idleId = ric(arm, { timeout: IDLE_TIMEOUT_MS })
      else idleId = window.setTimeout(arm, IDLE_TIMEOUT_MS)
    }

    const cleanup = () => {
      window.removeEventListener('load', scheduleIdle)
      WAKE_EVENTS.forEach((e) => window.removeEventListener(e, arm))
      if (!idleId) return
      if (window.cancelIdleCallback) window.cancelIdleCallback(idleId)
      else clearTimeout(idleId)
    }

    WAKE_EVENTS.forEach((e) => window.addEventListener(e, arm, { once: true, passive: true }))
    if (document.readyState === 'complete') scheduleIdle()
    else window.addEventListener('load', scheduleIdle, { once: true })

    return cleanup
  }, [mounted])

  return mounted ? <GoogleAnalytics gaId={gaId} /> : null
}

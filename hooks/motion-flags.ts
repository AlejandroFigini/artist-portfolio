'use client'

/* Hoja del grafo de motion: no importa GSAP, así que puede viajar en el bundle
   inicial. Lo consultan tanto el façade (hooks/useGSAP) como el runtime
   (hooks/gsap-runtime) sin crear un ciclo entre ellos. */

/** Toggle "Pausar animaciones" (SettingsPanel) activo. */
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

/** Handle killable para animaciones en loop manejadas con recursión. */
export type LoopHandle = { kill: () => void }

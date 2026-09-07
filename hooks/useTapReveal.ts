'use client'

/* REGLA TÁCTIL DEL OVERLAY — un toque muestra la ficha, el botón abre la pieza.

   Con puntero fino el overlay de una pieza (ficha + controles) es el `:hover`
   de cada hoja. Sin hover no hay estado intermedio, y hasta ahora cada sección
   lo resolvía a su manera: Game Dev dejaba la ficha y los controles SIEMPRE
   encendidos —tapando la celda entera— e Illustrations no los mostraba nunca,
   con el toque abriendo la pantalla completa de una.

   La regla es una sola y vale para todo el sitio: en táctil, un toque sobre la
   pieza muestra su overlay y otro lo esconde; la pantalla completa la abre
   SOLO su botón. Un toque fuera cierra. Con puntero fino el hook no hace nada
   —devuelve `false` y el llamador sigue su camino de siempre—, así que el
   hover de cada hoja queda intacto.

   El estado se pinta con la clase `is-tap-revealed` sobre el contenedor de la
   pieza; cada hoja declara qué muestra con esa clase dentro de
   `@media (hover: none)`. */

import { useCallback, useEffect, useRef, useState } from 'react'

export const TAP_REVEAL_CLASS = 'is-tap-revealed'

/** El puntero no puede posarse (dedo, lápiz). Se consulta al tocar y no al
 *  renderizar: en el servidor no hay `matchMedia`, y un valor de render sería
 *  una diferencia de hidratación. */
function isCoarsePointer() {
  return typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches
}

export function useTapReveal<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T>(null)
  const [revealed, setRevealed] = useState(false)

  // Tocar fuera cierra: si no, el overlay quedaría abierto al irse de la pieza.
  useEffect(() => {
    if (!revealed) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setRevealed(false)
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [revealed])

  /** Alterna el overlay y devuelve `true` si el toque se consumió ahí —el
   *  llamador tiene que abortar su propia acción (abrir pantalla completa). */
  const consumeTap = useCallback((e: React.MouseEvent) => {
    if (!enabled || !isCoarsePointer()) return false
    e.stopPropagation()
    e.preventDefault()
    setRevealed((r) => !r)
    return true
  }, [enabled])

  return { ref, revealed, consumeTap }
}

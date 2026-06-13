'use client'

/* Handler de teclado compartido — reemplaza el esc() de admin.js:L28
   que cms.js llamaba cruzado. */

import { useEffect } from 'react'

export function useKeyHandler(key: string, handler: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => { if (e.key === key) handler() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [key, handler, enabled])
}

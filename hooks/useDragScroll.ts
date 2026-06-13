'use client'

/* Scroll horizontal con arrastre + rueda — portado de gallery-common.js
   (dragScroll). Un arrastre no dispara el click (p.ej. abrir lightbox). */

import { useEffect, type RefObject } from 'react'

export function useDragScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let down = false, startX = 0, startScroll = 0, moved = false

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      down = true
      moved = false
      startX = e.clientX
      startScroll = el.scrollLeft
      el.classList.add('dragging')
    }
    const onMove = (e: PointerEvent) => {
      if (!down) return
      const dx = e.clientX - startX
      if (Math.abs(dx) > 4) moved = true
      el.scrollLeft = startScroll - dx
    }
    const onUp = () => {
      down = false
      el.classList.remove('dragging')
    }
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el.scrollLeft += e.deltaY
        e.preventDefault()
      }
    }
    const onClick = (e: MouseEvent) => {
      if (moved) {
        e.stopPropagation()
        e.preventDefault()
      }
    }

    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('click', onClick, true)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('click', onClick, true)
    }
  }, [ref])
}

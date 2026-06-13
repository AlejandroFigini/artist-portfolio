'use client'

/* Masonry de ilustraciones del index — port de cms.js: ilustraciones
   agregadas por admin (visibles para todos) + slots "agregar" en modo
   admin. Opera sobre #illustrations-container (IllustrationsSection). */

import type { Dispatch } from '@/lib/commands'
import { openLightbox } from '@/components/ui/lightbox'
import { state, type AddedIllu } from '@/lib/cms/store'

const EXPAND_SVG =
  '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>'

export function createGalleryItem(src: string, title: string, desc: string, link: string): HTMLElement {
  const item = document.createElement('div')
  item.className = 'gallery-item fade-in visible cms-added'
  item.dataset.title = title || 'Ilustración'
  item.dataset.desc = desc || ''
  item.dataset.link = link || ''
  const wrapper = document.createElement('div')
  wrapper.className = 'drift-wrapper'
  wrapper.style.width = '100%'
  wrapper.style.height = '100%'
  const img = document.createElement('img')
  // img-loaded: la grilla oculta imágenes hasta cargar; al agregarse
  // dinámicamente se marca cargada de entrada (port del comentario legacy)
  img.className = 'img-loaded'
  img.decoding = 'async'
  img.src = src
  img.alt = title || ''
  const overlay = document.createElement('div')
  overlay.className = 'gallery-overlay'
  overlay.innerHTML = '<button class="expand-btn">' + EXPAND_SVG + '</button>'
  wrapper.appendChild(img)
  wrapper.appendChild(overlay)
  item.appendChild(wrapper)
  item.addEventListener('click', () => {
    const cur = item.querySelector('img')
    openLightbox(cur ? cur.src : src, item.dataset.title, item.dataset.desc, item.dataset.link)
  })
  return item
}

export function renderAddedIllu() {
  const grid = document.getElementById('illustrations-container')
  if (!grid) return
  state.addedIllu.forEach((a: AddedIllu) => {
    if (grid.querySelector(`[data-added-id="${a.id}"]`)) return
    const item = createGalleryItem(a.dataUrl, a.title, a.desc, a.link)
    item.setAttribute('data-added-id', a.id)
    const slot = grid.querySelector('.cms-add-slot')
    if (slot) grid.insertBefore(item, slot)
    else grid.appendChild(item)
  })
}

export function addGallerySlots(dispatch: Dispatch) {
  const grid = document.getElementById('illustrations-container')
  if (!grid || grid.querySelector('.cms-add-slot')) return
  for (let i = 0; i < 3; i++) {
    const slot = document.createElement('button')
    slot.type = 'button'
    slot.className = 'cms-add-slot'
    slot.innerHTML = '<i class="fa-solid fa-plus"></i><span>Agregar ilustración</span>'
    slot.addEventListener('click', () => dispatch({ type: 'addIllustration' }))
    grid.appendChild(slot)
  }
}

export function removeGallerySlots() {
  document.querySelectorAll('.cms-add-slot').forEach((s) => s.remove())
}

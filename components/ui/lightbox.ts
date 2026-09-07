'use client'

/* Lightbox — funciones portadas de script.js (scope global legacy).
   Operan imperativamente sobre el markup de Lightboxes.tsx (ids fijos),
   igual que el original. En Sesión 3 esto puede pasar a CommandContext. */

import { ui } from '@/lib/i18n'
import { state } from '@/lib/cms/store'
import { lockPageScroll, unlockPageScroll } from '@/lib/smooth-scroll'

export type LightboxMeta = { date?: string; project?: string; inspiration?: string }

/* Qué lightbox tiene tomado el bloqueo de scroll. Sin este registro, un cierre
   repetido (click de fondo + Escape, o cerrar sin haber abierto) desbalancearía
   el contador de lockPageScroll y dejaría la página trabada. */
const scrollLocked = new Set<string>()

function lockFor(id: string) {
  if (scrollLocked.has(id)) return
  scrollLocked.add(id)
  lockPageScroll()
}

function unlockFor(id: string) {
  if (!scrollLocked.delete(id)) return
  unlockPageScroll()
}

function setField(lb: HTMLElement, selector: string, value?: string) {
  const el = lb.querySelector(selector)
  if (!el) return
  const valEl = el.querySelector('.val') || el
  if (value) {
    valEl.textContent = value
    el.classList.remove('hidden')
  } else {
    el.classList.add('hidden')
  }
}

function showLightbox(lb: HTMLElement, after?: () => void) {
  const panel = lb.querySelector('.lightbox-info-panel')
  if (panel) panel.classList.add('hidden')
  lb.classList.remove('info-open')
  document.body.classList.add('lightbox-open')
  lockFor(lb.id)
  lb.style.display = 'flex'
  setTimeout(() => {
    lb.style.opacity = '1'
    after?.()
  }, 10)
  // Auto-mostrar el panel de info al abrir
  if (panel) {
    setTimeout(() => {
      panel.classList.remove('hidden')
      lb.classList.add('info-open')
    }, 650)
  }
}

export function openLightbox(src: string, title?: string, desc?: string, link?: string, meta?: LightboxMeta) {
  const lb = document.getElementById('image-lightbox')
  const img = document.getElementById('lightbox-img') as HTMLImageElement | null
  if (!lb || !img) return
  img.src = src
  const titleEl = lb.querySelector<HTMLElement>('.info-title')
  const linkSlot = lb.querySelector<HTMLElement>('.info-link-slot')
  if (titleEl) titleEl.innerText = title || 'Illustration'
  setField(lb, '.lb-desc', desc || 'A piece from my collection.')
  setField(lb, '.lb-date', meta?.date)
  setField(lb, '.lb-project', meta?.project)
  setField(lb, '.lb-inspiration', meta?.inspiration)
  /* El ancla se construye acá y no viaja en el markup: sin URL no existe, así
     no queda un enlace sin href para los rastreadores. Se acepta solo http(s)
     — el valor lo escribe el admin desde el CMS, y un `javascript:` en un href
     se ejecutaría al hacer click. */
  if (linkSlot) {
    linkSlot.textContent = ''
    const safe = (() => {
      if (!link) return ''
      try {
        const u = new URL(link, window.location.href)
        return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : ''
      } catch { return '' }
    })()
    if (safe) {
      const a = document.createElement('a')
      a.className = 'info-link'
      a.target = '_blank'
      a.rel = 'noopener'
      a.href = safe
      const icon = document.createElement('i')
      icon.className = 'fa-solid fa-up-right-from-square'
      a.append(icon, document.createTextNode(` ${ui('view_original_post', state.lang)}`))
      linkSlot.appendChild(a)
    }
  }
  showLightbox(lb)
}

export function closeLightbox() {
  const lb = document.getElementById('image-lightbox')
  if (!lb) return
  lb.style.opacity = '0'
  document.body.classList.remove('lightbox-open')
  unlockFor(lb.id)
  setTimeout(() => { lb.style.display = 'none' }, 300)
}

export function openVideoLightbox(src: string, title?: string, desc?: string, meta?: LightboxMeta, poster?: string) {
  const lb = document.getElementById('video-lightbox')
  const vid = document.getElementById('lightbox-video') as HTMLVideoElement | null
  if (!lb || !vid) return
  /* El póster va ANTES del src: asignar `src` deja el elemento en readyState 0
     y sin póster no hay nada que pintar hasta que decodifica el primer frame.
     Sin póster se quita el anterior, que sería el del clip que se cerró. */
  if (poster) vid.setAttribute('poster', poster)
  else vid.removeAttribute('poster')
  vid.src = src
  const titleEl = lb.querySelector<HTMLElement>('.info-title')
  if (titleEl) titleEl.innerText = title || 'Animation'
  setField(lb, '.lb-desc', desc || 'Action sequence study.')
  setField(lb, '.lb-date', meta?.date)
  setField(lb, '.lb-project', meta?.project)
  setField(lb, '.lb-inspiration', meta?.inspiration)
  showLightbox(lb, () => { vid.play().catch(() => {}) })
}

export function closeVideoLightbox() {
  const lb = document.getElementById('video-lightbox')
  if (!lb) return
  lb.style.opacity = '0'
  document.body.classList.remove('lightbox-open')
  unlockFor(lb.id)
  setTimeout(() => {
    lb.style.display = 'none'
    const vid = document.getElementById('lightbox-video') as HTMLVideoElement | null
    if (vid) {
      vid.pause()
      vid.src = ''
      vid.removeAttribute('poster')
    }
  }, 300)
}

export function toggleLightboxInfo(e: React.MouseEvent<HTMLButtonElement>) {
  e.stopPropagation()
  const btn = e.currentTarget
  const lb = btn.closest<HTMLElement>('.lightbox')
  const panel = btn.parentElement?.querySelector('.lightbox-info-panel')
  if (panel) {
    const willShow = panel.classList.contains('hidden')
    panel.classList.toggle('hidden')
    if (lb) lb.classList.toggle('info-open', willShow)
  }
}

export function handleLightboxClick(e: React.MouseEvent, type: 'image' | 'video') {
  if ((e.target as HTMLElement).classList.contains('lightbox')) {
    if (type === 'video') closeVideoLightbox()
    else closeLightbox()
  }
}

'use client'

/* Lightbox — funciones portadas de script.js (scope global legacy).
   Operan imperativamente sobre el markup de Lightboxes.tsx (ids fijos),
   igual que el original. En Sesión 3 esto puede pasar a CommandContext. */

export type LightboxMeta = { date?: string; project?: string; inspiration?: string }

function applyLightboxMeta(lb: HTMLElement, meta: LightboxMeta = {}) {
  const setField = (selector: string, value?: string) => {
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
  setField('.info-date', meta.date)
  setField('.info-project', meta.project)
  setField('.info-inspiration', meta.inspiration)
}

function showLightbox(lb: HTMLElement, after?: () => void) {
  const panel = lb.querySelector('.lightbox-info-panel')
  if (panel) panel.classList.add('hidden')
  lb.classList.remove('info-open')
  document.body.classList.add('lightbox-open')
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
  const descEl = lb.querySelector<HTMLElement>('.info-desc')
  const linkEl = lb.querySelector<HTMLAnchorElement>('.info-link')
  if (titleEl) titleEl.innerText = title || 'Illustration'
  if (descEl) descEl.innerText = desc || 'A piece from my collection.'
  applyLightboxMeta(lb, meta)
  if (linkEl) {
    if (link) {
      linkEl.href = link
      linkEl.style.display = ''
    } else {
      linkEl.removeAttribute('href')
      linkEl.style.display = 'none'
    }
  }
  showLightbox(lb)
}

export function closeLightbox() {
  const lb = document.getElementById('image-lightbox')
  if (!lb) return
  lb.style.opacity = '0'
  document.body.classList.remove('lightbox-open')
  setTimeout(() => { lb.style.display = 'none' }, 300)
}

export function openVideoLightbox(src: string, title?: string, desc?: string, meta?: LightboxMeta) {
  const lb = document.getElementById('video-lightbox')
  const vid = document.getElementById('lightbox-video') as HTMLVideoElement | null
  if (!lb || !vid) return
  vid.src = src
  const titleEl = lb.querySelector<HTMLElement>('.info-title')
  const descEl = lb.querySelector<HTMLElement>('.info-desc')
  if (titleEl) titleEl.innerText = title || 'Animation'
  if (descEl) descEl.innerText = desc || 'Action sequence study.'
  applyLightboxMeta(lb, meta)
  showLightbox(lb, () => { vid.play().catch(() => {}) })
}

export function closeVideoLightbox() {
  const lb = document.getElementById('video-lightbox')
  if (!lb) return
  lb.style.opacity = '0'
  document.body.classList.remove('lightbox-open')
  setTimeout(() => {
    lb.style.display = 'none'
    const vid = document.getElementById('lightbox-video') as HTMLVideoElement | null
    if (vid) {
      vid.pause()
      vid.src = ''
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

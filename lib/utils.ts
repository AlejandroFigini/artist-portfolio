/* Utilidades compartidas CMS/Admin — unifica las copias duplicadas de
   cms.js (L145, L1571) y admin.js (L29-L57). */

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/* cn — merge de clases Tailwind (shadcn convention). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/* ¿El dispositivo tiene un puntero que puede "posarse" sobre algo?
   En táctil el navegador emite mouseenter/mouseover de compatibilidad al tocar,
   pero NO el mouseleave correspondiente: cualquier estado abierto en el enter
   queda pegado hasta que se toque otro elemento. Las interacciones de hover
   se condicionan a esto en vez de a un ancho de pantalla. */
export function canHover(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

export function fmtBytes(n?: number | null): string {
  if (n == null) return '—'
  if (n < 1024) return n + ' B'
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1048576).toFixed(2) + ' MB'
}

const p2 = (x: number) => ('0' + x).slice(-2)

export function fmtDate(ts: number): string {
  const d = new Date(ts)
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`
}

export function fmtDateOnly(ts: number): string {
  const d = new Date(ts)
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`
}

export function fmtTimeOnly(ts: number): string {
  const d = new Date(ts)
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`
}

export function isVideo(type?: string | null, name?: string | null): boolean {
  return !!((type && (type.includes('webm') || type.includes('video'))) || (name && /\.webm$/i.test(name)))
}

export function basename(src?: string): string {
  if (!src) return ''
  if (src.startsWith('data:')) return '(uploaded file)'
  try { return decodeURIComponent(src.split('/').pop()!.split('?')[0]) }
  catch { return src.split('/').pop() || '' }
}

export function approxDataUrlBytes(s: string): number {
  const i = s.indexOf(',')
  return i < 0 ? 0 : Math.round((s.length - i - 1) * 0.75)
}

// Miniatura optimizada de Cloudinary (igual que admin.js thumb())
export function cloudinaryThumb(src: string, video?: boolean): string {
  if (!src || !src.includes('res.cloudinary.com')) return src
  let t = src.replace('/upload/', '/upload/c_fill,w_150,h_150,q_auto,f_auto/')
  if (video) t = t.replace(/\.webm|\.mp4|\.mov/i, '.jpg')
  return t
}

/* Escalera ÚNICA de anchos de Cloudinary. `uploadBuffer` pre-genera (eager) estos
   mismos anchos al subir, así que pedir uno de la escalera SIEMPRE da un hit: la
   derivada ya existe. Pedir un ancho arbitrario (el medido × DPR: 375, 750, 1103…)
   obliga a Cloudinary a generarla on-the-fly y hasta que termina devuelve 404 → el
   contenedor queda en negro. Por eso el ancho se redondea HACIA ARRIBA a la
   escalera y nunca se sirve el número crudo. Cambiar esta lista obliga a cambiar
   el `eager` de lib/storage.ts. */
/* Un asset de Cloudinary NO es contenido de galería si es un documento o si es un
   archivo de configuración del sitio. El picker lista todo lo que existe en la
   cuenta para no perderse contenido subido; sin este filtro entraban también el CV
   en PDF y los iconos del sitio, que no son asignables a ningún contenedor.
   El reconciliador y la auditoría NO usan este filtro a propósito: ellos tienen que
   ver la cuenta entera. */
export function isGalleryAsset(r: { resource_type?: string; public_id?: string }): boolean {
  if (r.resource_type === 'raw') return false // documentos (CV en PDF)
  // Assets heredados que se subieron con el nombre de la clave de ajustes.
  const base = (r.public_id || '').split('/').pop() || ''
  return !base.toLowerCase().startsWith('settings.')
}

export const CLOUDINARY_WIDTHS = [640, 1200, 1920] as const

/** Ancho de la escalera inmediatamente >= al pedido (el mayor si se pasa). */
export function snapCloudinaryWidth(width: number): number {
  return CLOUDINARY_WIDTHS.find((w) => w >= width) ?? CLOUDINARY_WIDTHS[CLOUDINARY_WIDTHS.length - 1]
}

// Optimización general de imágenes de Cloudinary para el frontend (f_auto, q_auto, ancho máximo)
export function cloudinaryOptimize(src?: string | null, opts: { width?: number; quality?: string } = {}): string {
  if (!src || typeof src !== 'string' || !src.includes('res.cloudinary.com')) return src || ''
  if (src.includes('f_auto') && src.includes('q_auto')) return src
  const w = opts.width ? `,w_${snapCloudinaryWidth(opts.width)},c_limit` : ''
  const q = opts.quality || 'auto'
  return src.replace('/upload/', `/upload/f_auto,q_${q}${w}/`)
}

/* Retry ante 404 de una derivada de Cloudinary. La primera vez que se pide una
   derivada (f_auto en imagen, transcode en video) Cloudinary la GENERA on-the-fly:
   hasta que termina puede dar 404 y el contenedor queda negro (al subir y en la
   primera visita, más en celular con video). Ante error se reintenta la misma URL
   con backoff (para entonces ya está generada); si tras varios intentos sigue
   fallando, se cae al ORIGINAL sin transformar (siempre servible). Se attachea
   una sola vez por elemento; sirve para media del engine y para <video>/<img> de
   React (vía ref callback). `original` es opcional (fallback); si no se pasa, se
   usa el data-cms-src del elemento. */
export function attachMediaRetry(el: HTMLImageElement | HTMLVideoElement, original?: string): void {
  if (!el || el.dataset.cldRetry) return
  el.dataset.cldRetry = '1'
  let tries = 0
  const setSrc = (url: string) => {
    if (el instanceof HTMLVideoElement) {
      const s = el.querySelector('source')
      if (s) s.setAttribute('src', url); else el.setAttribute('src', url)
      try { el.load(); if (el.autoplay) void el.play().catch(() => {}) } catch {}
    } else {
      el.src = url
    }
  }
  const cur = (): string => {
    if (el instanceof HTMLVideoElement) {
      const s = el.querySelector('source')
      return (s ? s.getAttribute('src') : el.getAttribute('src')) || ''
    }
    return el.getAttribute('src') || ''
  }
  const declareDead = (src: string) => {
    el.dataset.cldDone = '1'
    el.dataset.cldDead = '1'
    el.dispatchEvent(new CustomEvent('cms:media-dead', { bubbles: true, detail: { src } }))
  }

  el.addEventListener('error', () => {
    if (el.dataset.cldDead) return
    const c = cur()
    /* También se cubre la media que NO es de Cloudinary (rutas `/uploads/` que
       quedaron en el índice, restos de desarrollo local). Antes se salía acá y el
       contenedor se quedaba roto para siempre: no había derivada que esperar, pero
       tampoco fallback. La diferencia es el presupuesto de reintentos — en
       Cloudinary un 404 puede ser una derivada generándose, acá no puede ser otra
       cosa que un archivo que no está. */
    const isCloudinary = c.includes('res.cloudinary.com')
    /* Ya se había caído a la URL original y ESA también falla → el asset no existe.
       Sin esta rama el evento casi nunca salía: la URL que falla primero es la
       transformada (f_auto,w_640…), nunca igual a la original, así que se agotaban
       los reintentos, se caía al original, y `cldDone` bloqueaba el error siguiente
       — el contenedor quedaba negro igual. */
    if (el.dataset.cldFellBack) return declareDead(c.split('?')[0])
    if (el.dataset.cldDone) return
    /* Si lo que falló YA es el original sin transformar, el asset no existe: no hay
       derivada pendiente que esperar. Reintentar son 4 requests y ~7s de contenedor
       en negro para terminar cayendo a la misma URL muerta. Se corta acá y se avisa
       para que el contenedor muestre su estado vacío en vez de quedar negro. */
    const orig0 = (original || el.dataset.cmsSrc || '').split('?')[0]
    if (orig0 && c.split('?')[0] === orig0) return declareDead(orig0)
    tries++
    if (tries > (isCloudinary ? 4 : 1)) {
      const orig = original || el.dataset.cmsSrc || ''
      if (orig && !c.startsWith(orig.split('?')[0])) {
        // NO se marca cldDone: si el original también falla hay que poder enterarse.
        el.dataset.cldFellBack = '1'
        setSrc(orig)
      } else {
        declareDead(c.split('?')[0])
      }
      return
    }
    // Siempre desde la URL LIMPIA (sin query previa) + un único `?_r=N`: evita
    // acumular params malformados (`&_r=2?_r=3`) entre reintentos.
    const bust = c.split('?')[0] + '?_r=' + tries
    window.setTimeout(() => { if (!el.dataset.cldDone) setSrc(bust) }, 700 * tries)
  })
  // Carga OK: resetea el contador y reabre el retry (si más tarde se asigna otro
  // contenido recién subido al mismo elemento, vuelve a reintentar).
  const ok = () => { tries = 0; delete el.dataset.cldDone; delete el.dataset.cldFellBack; delete el.dataset.cldDead }
  el.addEventListener('load', ok)
  el.addEventListener('loadeddata', ok)
}

// Anchos que acepta el optimizador de Next (deviceSizes + imageSizes por
// defecto). Pedir uno fuera de la lista devuelve 400.
const NEXT_IMAGE_WIDTHS = [16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840]

/* Sirve la imagen al tamaño en que se ve, no al original.
   Cloudinary (prod) → transformación en el CDN; rutas propias `/uploads/*`
   (local) → optimizador de Next (AVIF/WebP + resize). Sin `width` no toca nada. */
export function optimizedMediaSrc(src?: string | null, width?: number): string {
  if (!src || typeof src !== 'string') return src || ''
  if (src.includes('res.cloudinary.com')) return cloudinaryOptimize(src, { width })
  if (!width) return src
  // data:/blob: ya son locales; el SVG lo rechaza el optimizador de Next
  if (/^(data|blob):/.test(src) || /\.svg(\?|#|$)/i.test(src)) return src

  const path = src.startsWith('/') && !src.startsWith('//')
    ? src
    : (() => {
        if (typeof window === 'undefined') return null
        try {
          const u = new URL(src, window.location.href)
          return u.origin === window.location.origin ? u.pathname + u.search : null
        } catch { return null }
      })()
  if (!path || path.startsWith('/_next/image')) return src

  const w = NEXT_IMAGE_WIDTHS.find((x) => x >= width) ?? NEXT_IMAGE_WIDTHS[NEXT_IMAGE_WIDTHS.length - 1]
  return `/_next/image?url=${encodeURIComponent(path)}&w=${w}&q=75`
}

/* srcSet para que el navegador elija el ancho según viewport y DPR.
   SSR-safe: no mira `window`, a diferencia de calcular el ancho a mano. */
export function mediaSrcSet(src?: string | null, widths: number[] = [640, 828, 1200, 1920]): string | undefined {
  if (!src || typeof src !== 'string' || /^(data|blob):/.test(src) || /\.svg(\?|#|$)/i.test(src)) return undefined
  const set = widths.map((w) => `${optimizedMediaSrc(src, w)} ${w}w`)
  // Sin variantes reales (origen externo no optimizable) el srcSet no aporta
  return set.some((s, i) => s !== `${src} ${widths[i]}w`) ? set.join(', ') : undefined
}

export function getFileExtension(filename?: string | null): string {
  if (!filename) return ''
  const lastDot = filename.lastIndexOf('.')
  return lastDot > 0 ? filename.slice(lastDot) : ''
}

export function getFileBasename(filename?: string | null): string {
  if (!filename) return ''
  const lastDot = filename.lastIndexOf('.')
  return lastDot > 0 ? filename.slice(0, lastDot) : filename
}

export function ensureExtension(name: string, originalFilename: string): string {
  if (!name || !name.trim()) return originalFilename
  const trimmed = name.trim()
  const ext = getFileExtension(originalFilename)
  if (!ext) return trimmed
  
  if (trimmed.toLowerCase().endsWith(ext.toLowerCase())) {
    return trimmed
  }
  
  const nameLastDot = trimmed.lastIndexOf('.')
  if (nameLastDot > 0) {
    const possibleExt = trimmed.slice(nameLastDot)
    if (/^\.[a-zA-Z0-9]{1,5}$/.test(possibleExt)) {
      return trimmed.slice(0, nameLastDot) + ext
    }
  }
  
  return trimmed + ext
}

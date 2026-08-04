/* Utilidades compartidas CMS/Admin — unifica las copias duplicadas de
   cms.js (L145, L1571) y admin.js (L29-L57). */

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/* cn — merge de clases Tailwind (shadcn convention). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
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

// Optimización general de imágenes de Cloudinary para el frontend (f_auto, q_auto, ancho máximo)
export function cloudinaryOptimize(src?: string | null, opts: { width?: number; quality?: string } = {}): string {
  if (!src || typeof src !== 'string' || !src.includes('res.cloudinary.com')) return src || ''
  if (src.includes('f_auto') && src.includes('q_auto')) return src
  const w = opts.width ? `,w_${opts.width},c_limit` : ''
  const q = opts.quality || 'auto'
  return src.replace('/upload/', `/upload/f_auto,q_${q}${w}/`)
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

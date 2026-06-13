/* Helpers de media — realMedia portado de gallery-common.js;
   validateFile/fileToDataURL portados de cms.js (validación en el
   boundary de uploads: tipo MIME real + tamaño máximo). */

import { MAX_BYTES } from '@/lib/cms/store'

export function realMedia(el: HTMLImageElement | HTMLVideoElement | null): boolean {
  if (!el) return false
  if (el.tagName === 'IMG') {
    const s = el.getAttribute('src') || ''
    return !!s && s.slice(0, 14) !== 'data:image/gif'
  }
  if (el.tagName === 'VIDEO') {
    const v = el as HTMLVideoElement
    return !!(v.currentSrc || v.getAttribute('src'))
  }
  return false
}

/** null si es válido; mensaje de error si no. accept: 'webp' (imagen) | 'webm' (video) */
export function validateFile(file: File, accept?: string): string | null {
  if (file.size > MAX_BYTES) return 'El archivo supera el límite de 25 MB.'
  if (accept === 'webp' && !file.type.startsWith('image/')) return 'Debe ser un archivo de imagen válido.'
  if (accept === 'webm' && !file.type.startsWith('video/')) return 'Debe ser un archivo de video válido.'
  return null
}

export function fileToDataURL(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

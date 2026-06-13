/* Utilidades compartidas CMS/Admin — unifica las copias duplicadas de
   cms.js (L145, L1571) y admin.js (L29-L57). */

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
  if (src.startsWith('data:')) return '(archivo subido)'
  try { return decodeURIComponent(src.split('/').pop()!.split('?')[0]) }
  catch { return src.split('/').pop() || '' }
}

export function approxDataUrlBytes(s: string): number {
  const i = s.indexOf(',')
  return i < 0 ? 0 : Math.round((s.length - i - 1) * 0.75)
}

// Miniatura optimizada de Cloudinary (igual que admin.js thumb())
export function cloudinaryThumb(src: string, video?: boolean): string {
  if (!src.includes('res.cloudinary.com')) return src
  let t = src.replace('/upload/', '/upload/c_fill,w_150,h_150,q_auto,f_auto/')
  if (video) t = t.replace(/\.webm|\.mp4|\.mov/i, '.jpg')
  return t
}

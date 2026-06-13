/* Cliente del backend Express (server.js legacy, sin cambios).
   Las rutas /api/* se proxean al Express vía rewrite (next.config.ts). */

export type ContentItems = Record<string, string>

export type LoginResponse = {
  success: boolean
  require2FA?: boolean
  message?: string
  error?: string
}

export type UploadResponse = {
  success: boolean
  secure_url: string
  final_bytes: number
  final_format: string
  original_size: number
  original_name: string
  asset_id?: string
  error?: string
}

export async function getContent(): Promise<ContentItems> {
  const r = await fetch('/api/content', { cache: 'no-store' })
  if (!r.ok) return {}
  const data = await r.json()
  return (data && data.items) || {}
}

export async function saveContent(items: ContentItems): Promise<void> {
  const r = await fetch('/api/content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => null)
    throw new Error((err && err.error) || `Error del servidor (${r.status})`)
  }
}

export async function login(user: string, pass: string, code: string | null): Promise<LoginResponse> {
  const r = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, pass, code }),
  })
  return r.json()
}

export async function uploadMedia(base64Data: string, originalSize: number, originalName: string): Promise<UploadResponse> {
  const r = await fetch('/api/upload-test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Data, originalSize, originalName }),
  })
  const data = await r.json()
  if (!data.success) throw new Error(data.error || 'Error en la subida')
  return data
}

export async function deleteMedia(url: string): Promise<void> {
  await fetch('/api/delete-media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
}

/* Cliente del backend Express (server.js legacy, sin cambios).
   Las rutas /api/* se proxean al Express vía rewrite (next.config.ts). */

export type ContentItems = Record<string, string>

export type AccountUser = { username: string; totpEnabled: boolean }

export type LoginResponse = {
  success: boolean
  require2FA?: boolean
  message?: string
  error?: string
  user?: AccountUser
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
  let r: Response
  try {
    r = await fetch('/api/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
  } catch {
    // Backend Express no disponible → persistencia solo local (el caller ya
    // guardó en localStorage). No bloquea el CMS en desarrollo sin backend.
    return
  }
  if (r.ok) return
  // 5xx = backend caído o sin DB. El contenido ya quedó en localStorage,
  // así que degradamos en silencio en vez de bloquear el CMS.
  if (r.status >= 500) return
  // 4xx con error legible (ej. payload inválido) sí se reporta.
  const text = await r.text().catch(() => '')
  let msg = ''
  try { msg = (JSON.parse(text) as { error?: string }).error || '' } catch { /* sin JSON → degradar */ }
  if (msg) throw new Error(msg)
}

export async function login(user: string, pass: string, code: string | null): Promise<LoginResponse> {
  const r = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, pass, code }),
  })
  return r.json()
}

export async function logout(): Promise<void> {
  try { await fetch('/api/logout', { method: 'POST' }) } catch {}
}

/* Sesión actual (fuente de verdad de "estoy logeado"): 200 = sesión válida. */
export async function getAccount(): Promise<AccountUser | null> {
  try {
    const r = await fetch('/api/account', { cache: 'no-store' })
    if (!r.ok) return null
    const data = await r.json()
    return data.user || null
  } catch {
    return null
  }
}

export async function updateAccount(payload: {
  username?: string
  currentPassword?: string
  newPassword?: string
}): Promise<AccountUser> {
  const r = await fetch('/api/account', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((data as { error?: string }).error || 'Error actualizando la cuenta')
  return (data as { user: AccountUser }).user
}

export type UserRow = AccountUser & { lastLoginAt: string | null; createdAt: string }

export async function getUsers(): Promise<UserRow[]> {
  const r = await fetch('/api/users', { cache: 'no-store' })
  if (!r.ok) return []
  const data = await r.json().catch(() => ({}))
  return (data as { users?: UserRow[] }).users || []
}

export async function twoFa(payload:
  | { action: 'setup' }
  | { action: 'enable'; code: string }
  | { action: 'disable'; password: string },
): Promise<{ secret?: string; uri?: string }> {
  const r = await fetch('/api/account/2fa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((data as { error?: string }).error || 'Error de 2FA')
  return data as { secret?: string; uri?: string }
}

export async function uploadMedia(base64Data: string, originalSize: number, originalName: string, section?: string): Promise<UploadResponse> {
  // Fallback local: si el backend (Cloudinary) no está disponible, se usa el
  // propio dataURL como fuente. Permite seleccionar/subir imágenes sin backend
  // en desarrollo (se persisten en los overrides locales).
  const localFallback = (): UploadResponse => ({
    success: true,
    secure_url: base64Data,
    final_bytes: originalSize,
    final_format: (originalName.split('.').pop() || 'webp').toLowerCase(),
    original_size: originalSize,
    original_name: originalName,
  })

  let r: Response
  try {
    r = await fetch('/api/upload-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Data, originalSize, originalName, section }),
    })
  } catch {
    return localFallback() // backend no corre → usar dataURL local
  }
  if (!r.ok) {
    const text = await r.text()
    try {
      const data = JSON.parse(text)
      throw new Error(data.error || 'Error en la subida')
    } catch {
      return localFallback() // backend inalcanzable → dataURL local
    }
  }
  return r.json()
}

export async function deleteMedia(url: string): Promise<void> {
  await fetch('/api/delete-media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
}

export type LangMaps = Record<string, Record<string, string>>

/* Traducciones: trae todos los idiomas (es base + en/pt/fr). El cliente las
   aplica al cambiar de idioma; el admin exporta el JSON para mandarlo a Claude. */
export async function getTranslations(): Promise<LangMaps> {
  try {
    const r = await fetch('/api/translations', { cache: 'no-store' })
    if (!r.ok) return {}
    const data = await r.json()
    return (data && data.items) || {}
  } catch {
    return {}
  }
}

/* Importa el JSON traducido (en/pt/fr) que devolvió Claude → persiste en BD. */
export async function importTranslations(items: LangMaps): Promise<{ imported: number }> {
  const r = await fetch('/api/translations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((data as { error?: string }).error || 'Error importando traducciones')
  return { imported: (data as { imported?: number }).imported || 0 }
}

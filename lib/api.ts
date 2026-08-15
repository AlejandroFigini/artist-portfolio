/* Cliente del backend Express (server.js legacy, sin cambios).
   Las rutas /api/* se proxean al Express vía rewrite (next.config.ts). */

export type ContentItems = Record<string, string>

export type AccountUser = { username: string; role: string; needsSetup?: boolean; totpEnabled: boolean }

export type LoginResponse = {
  success: boolean
  require2FA?: boolean
  message?: string
  error?: string
  user?: AccountUser & { needsSetup?: boolean }
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
  try { await fetch('/api/logout', { method: 'POST' }) } catch { }
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
  if (!r.ok) throw new Error((data as { error?: string }).error || 'Error updating the account')
  return (data as { user: AccountUser }).user
}

export type UserRow = AccountUser & { lastLoginAt: string | null; createdAt: string; isBlocked?: boolean; sessionTtlMinutes?: number | null; demoLockIntervalMinutes?: number | null; demoLockAt?: string | null }

export async function getUsers(): Promise<UserRow[]> {
  const r = await fetch('/api/users', { cache: 'no-store' })
  if (!r.ok) return []
  const data = await r.json().catch(() => ({}))
  return (data as { users?: UserRow[] }).users || []
}

export async function createUser(payload: { username: string; password: string; role: string }): Promise<void> {
  const r = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((data as { error?: string }).error || 'Error creating user')
}

/* Unión discriminada por `action`: cada acción declara exactamente los campos
   que necesita, así el compilador impide mandar `role` en un `block` o pedir
   un `ttl` sin minutos. El route handler valida lo mismo en runtime. */
export type AdminUserUpdate =
  | { action: 'block'; is_blocked: boolean }
  | { action: 'role'; role: string }
  | { action: 'reset' }
  | { action: 'ttl'; session_ttl_minutes: number | null }
  | { action: 'kill_sessions' }
  | { action: 'credentials'; newUsername?: string; newPassword?: string }
  // Auto-bloqueo recurrente del demo: intervalo en minutos (null/0 lo desactiva).
  | { action: 'demo_lock'; demo_lock_interval_minutes: number | null }

export async function updateUserAdmin(username: string, payload: AdminUserUpdate): Promise<void> {
  const r = await fetch(`/api/users/${encodeURIComponent(username)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((data as { error?: string }).error || 'Error updating user')
}

export async function deleteUserAdmin(username: string): Promise<void> {
  const r = await fetch(`/api/users/${encodeURIComponent(username)}`, {
    method: 'DELETE',
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((data as { error?: string }).error || 'Error deleting user')
}

/* Política global de sesiones (solo owner) — ver app/api/admin/sessions. */
export async function getSessionPolicy(): Promise<{ maxMinutes: number | null }> {
  const r = await fetch('/api/admin/sessions', { cache: 'no-store' })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((data as { error?: string }).error || 'Error loading session policy')
  return { maxMinutes: (data as { maxMinutes?: number | null }).maxMinutes ?? null }
}

export async function setSessionPolicy(maxMinutes: number | null): Promise<void> {
  const r = await fetch('/api/admin/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ maxMinutes }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((data as { error?: string }).error || 'Error saving session policy')
}

export async function resetAllSessions(): Promise<number> {
  const r = await fetch('/api/admin/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'reset_all' }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((data as { error?: string }).error || 'Error resetting sessions')
  return (data as { killed?: number }).killed ?? 0
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
  if (!r.ok) throw new Error((data as { error?: string }).error || '2FA error')
  return data as { secret?: string; uri?: string }
}

/* Sube un archivo por multipart. Recibe el Blob/File tal cual: no se convierte
   a base64, que inflaba el cuerpo un 33% y lo materializaba entero en memoria
   de los dos lados. */
export async function uploadMedia(
  file: Blob,
  originalName: string,
  section?: string,
  mediaState?: 'used' | 'unused' | 'trash',
): Promise<UploadResponse> {
  /* Fallback local: si el backend NO CORRE (error de red), se usa el propio
     archivo como data URL para poder seguir trabajando sin servidor.
     Ojo: solo para fallo de red. Si el servidor responde un error, ese error
     se propaga — antes el `throw` vivía dentro del try y su propio catch lo
     tragaba, así que un rechazo del servidor (por ejemplo un SVG bloqueado)
     terminaba guardándose igual en local, en silencio. */
  const localFallback = async (): Promise<UploadResponse> => ({
    success: true,
    secure_url: await blobToDataUrl(file),
    final_bytes: file.size,
    final_format: (originalName.split('.').pop() || 'webp').toLowerCase(),
    original_size: file.size,
    original_name: originalName,
  })

  const body = new FormData()
  // Sin Content-Type manual: el navegador arma el boundary del multipart.
  body.append('file', file, originalName)
  body.append('name', originalName)
  if (section) body.append('section', section)
  if (mediaState) body.append('mediaState', mediaState)

  let r: Response
  try {
    r = await fetch('/api/upload-test', { method: 'POST', body })
  } catch {
    return localFallback() // backend no corre → dataURL local
  }

  if (!r.ok) {
    const data = await r.json().catch(() => null)
    throw new Error((data as { error?: string } | null)?.error || `Upload failed (HTTP ${r.status})`)
  }
  return r.json()
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function deleteMedia(url: string): Promise<void> {
  await fetch('/api/delete-media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
}

/** Mueve un asset de Cloudinary a una nueva carpeta. Devuelve la nueva URL. */
export async function moveMedia(url: string, newFolder: string): Promise<{ newUrl: string }> {
  try {
    const r = await fetch('/api/move-media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, newFolder }),
    })
    if (!r.ok) return { newUrl: url }
    const data = await r.json()
    return { newUrl: (data as { newUrl?: string }).newUrl || url }
  } catch {
    return { newUrl: url }
  }
}

/** Crea la estructura de carpetas vacías en Cloudinary según la taxonomía del sitio. */
export async function scaffoldCloudinaryFolders(): Promise<void> {
  try {
    await fetch('/api/scaffold-folders', { method: 'POST' })
  } catch {
    // best-effort: no romper si falla
  }
}

/** Verifica en lote si las URLs de Cloudinary existen. Devuelve las que no existen.
 *  Silencioso si el backend no responde (devuelve array vacío = "todo OK"). */
export async function verifyMedia(urls: string[]): Promise<{ url: string; exists: boolean }[]> {
  if (!urls.length) return []
  try {
    const r = await fetch('/api/verify-media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls }),
    })
    if (!r.ok) return []
    const data = await r.json()
    return (data as { results?: { url: string; exists: boolean }[] }).results || []
  } catch {
    return [] // backend no disponible → asumir todo OK
  }
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
export async function importTranslations(items: LangMaps): Promise<{ imported: number; skipped: number }> {
  const r = await fetch('/api/translations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((data as { error?: string }).error || 'Error importing translations')
  const d = data as { imported?: number; skipped?: number }
  return { imported: d.imported || 0, skipped: d.skipped || 0 }
}

/* Renombra claves de `cms_translations` (clave vieja → clave nueva), sin
   tocar sus valores. Lo usa la migración de colecciones (índice → uid): sin
   esto, cada fila traducida sigue apuntando a la clave legacy que la
   migración ya vació en `cms_data` y el contenido traducido queda huérfano. */
export async function renameTranslations(renames: Record<string, string>): Promise<void> {
  const r = await fetch('/api/translations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ renames }),
  })
  if (!r.ok) {
    const data = await r.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || 'Error renaming translations')
  }
}

// ----- Estado compartido CMS (sync entre dispositivos) -----------------------

export type CmsStatePayload = {
  used_content?: Record<string, unknown>
  unused?: unknown[]
  retired?: string[]
  trash?: unknown[]
  media_meta?: Record<string, unknown>
  audit?: unknown[]
  container_names?: Record<string, string>
}

/* Trae el estado CMS compartido del servidor. Degrada a {} sin backend. */
export async function getState(): Promise<CmsStatePayload> {
  try {
    const r = await fetch('/api/app-state', { cache: 'no-store' })
    if (!r.ok) return {}
    return await r.json()
  } catch {
    return {}
  }
}

/* Límite de la spec de Fetch para cuerpos con `keepalive`. Pasarse NO da error de
   red: el navegador rechaza la request con TypeError ANTES de salir a la red.
   Margen para headers + el resto del request group. */
const KEEPALIVE_MAX_BYTES = 60 * 1024

/* Persiste (parcial) el estado CMS al servidor.
   `keepalive` SOLO en el flush de beforeunload y solo si el cuerpo entra en el
   límite. Antes iba en todas las llamadas: `media_meta` (342 entradas en prod)
   empujaba el payload de `persistUsed` por encima de 64 KiB, el navegador lo
   rechazaba y el `catch {}` se lo tragaba → used_content nunca se pudo volver a
   escribir y quedó vacío en la DB. */
export async function saveState(payload: CmsStatePayload, opts: { unload?: boolean } = {}): Promise<boolean> {
  const body = JSON.stringify(payload)
  const size = new Blob([body]).size
  const useKeepalive = !!opts.unload && size <= KEEPALIVE_MAX_BYTES

  if (opts.unload && !useKeepalive) {
    /* Demasiado grande para keepalive. sendBeacon no tiene ese límite duro y
       sobrevive al unload; si tampoco entra, se pierde — pero se avisa en vez de
       fingir que se guardó. */
    const ok = typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function'
      && navigator.sendBeacon('/api/app-state', new Blob([body], { type: 'application/json' }))
    if (!ok) console.error('[saveState] payload de', size, 'bytes no se pudo enviar en unload')
    return ok
  }

  try {
    const r = await fetch('/api/app-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      ...(useKeepalive ? { keepalive: true } : {}),
    })
    if (!r.ok) console.error('[saveState] el servidor rechazó el estado:', r.status)
    return r.ok
  } catch (err) {
    // backend no disponible → el estado sigue en localStorage
    console.error('[saveState] no se pudo persistir el estado:', err)
    return false
  }
}

// ----- Auditoría Cloudinary vs Gestión ----------------------------------------

export type CloudinaryResourceInfo = {
  asset_id: string
  public_id: string
  secure_url: string
  resource_type: string
  format: string
  bytes: number
  /* Carpeta: cosmética. NO usarla para decidir el estado del ciclo de vida —
     para eso está `state`, que sale del tag (con fallback a carpeta para los
     assets subidos antes del cambio). */
  folder: string
  tags: string[]
  state: 'used' | 'unused' | 'trash' | null
  created_at: string
}

/** Lista todos los recursos de Cloudinary bajo portfolio/.
 *  Silencioso si el backend no responde (devuelve array vacío). */
export async function listCloudinaryResources(): Promise<{ resources: CloudinaryResourceInfo[]; error?: string }> {
  try {
    const r = await fetch('/api/cloudinary-sync', { cache: 'no-store' })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      return { resources: [], error: data.error || `HTTP ${r.status}` }
    }
    return { resources: (data.resources as CloudinaryResourceInfo[]) || [], error: data.error }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { resources: [], error: message || 'Network error' }
  }
}

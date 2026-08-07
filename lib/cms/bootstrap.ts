'use client'

/* Lectura del payload que el server embebe en el HTML (ver
   lib/cms-bootstrap-server.ts). Se parsea una sola vez: el arranque del CMS lo
   consulta en el primer efecto, antes de que exista ningún fetch. */

export type CmsBootstrap = {
  items: Record<string, string>
  translations: Record<string, Record<string, string>>
  retired: string[]
}

const CMS_BOOTSTRAP_ID = '__cms_bootstrap__'

let cached: CmsBootstrap | null | undefined

/** Payload embebido, o null si no está (SSR, o el server no pudo leer la DB). */
export function readCmsBootstrap(): CmsBootstrap | null {
  if (cached !== undefined) return cached
  cached = null
  if (typeof document === 'undefined') return null
  const el = document.getElementById(CMS_BOOTSTRAP_ID)
  if (!el?.textContent) return null
  try {
    const parsed = JSON.parse(el.textContent) as Partial<CmsBootstrap>
    if (!parsed || typeof parsed.items !== 'object' || parsed.items === null) return null
    cached = {
      items: parsed.items as Record<string, string>,
      translations: (parsed.translations || {}) as Record<string, Record<string, string>>,
      retired: Array.isArray(parsed.retired) ? parsed.retired : [],
    }
  } catch {
    cached = null
  }
  return cached
}

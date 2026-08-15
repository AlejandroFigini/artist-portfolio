import { NextResponse } from 'next/server'
import { setAssetState, type MediaState } from '@/lib/storage'
import { requireRole } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* Mapa carpeta → estado. Los callers siguen hablando en carpetas (`getCloudinaryFolder`
   devuelve `portfolio/en-uso`…) porque la carpeta es lo que el admin ve en Cloudinary;
   acá adentro eso se traduce al estado real, que viaja como tag. */
const STATE_BY_FOLDER: Record<string, MediaState> = {
  'portfolio/en-uso': 'used',
  'portfolio/sin-usar': 'unused',
  'portfolio/basurero': 'trash',
}

/* POST /api/move-media → cambia el ESTADO del asset (tag), no su ubicación física.
   La URL de entrega NO cambia: por eso `newUrl` siempre es la URL de entrada, y
   eso ahora es la respuesta correcta, no un fallo disimulado. */
export async function POST(req: Request) {
  const auth = await requireRole(req, ['owner', 'admin', 'demo'])
  if ('deny' in auth) return auth.deny

  let body: { url?: string; newFolder?: string; targetFolder?: string; state?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const url = body.url
  const folder = body.newFolder || body.targetFolder || ''

  if (auth.user.role === 'demo') {
    return NextResponse.json({ success: true, newUrl: url })
  }

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }

  const state = (body.state as MediaState) || STATE_BY_FOLDER[folder]
  if (!state) {
    return NextResponse.json({ error: 'Unknown target state' }, { status: 400 })
  }

  /* Un fallo se reporta como fallo. Antes esta ruta devolvía siempre
     `{ success: true, newUrl: url }`, así que "falló el movimiento" y "ya estaba
     bien" eran indistinguibles en las cuatro capas del stack. */
  const res = await setAssetState(url, state)
  if (!res.ok) {
    console.error('[move-media] no se pudo aplicar el estado:', state, res.reason)
    return NextResponse.json({ error: 'Could not update media state' }, { status: 502 })
  }

  return NextResponse.json({ success: true, newUrl: url, state })
}

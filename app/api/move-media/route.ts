import { NextResponse } from 'next/server'
import { setAssetState, type MediaState } from '@/lib/storage'
import { requireRole } from '@/lib/auth'
import { getPool, hasDb, ensureDb } from '@/lib/db'

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

  let body: { url?: string; newFolder?: string; targetFolder?: string; state?: string; ignoreKeys?: string[] }
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

  /* Refcount EN EL SERVIDOR. Sacar de "en uso" un asset que algún contenedor
     sigue mostrando es la desincronización en la otra dirección: los bytes
     quedan clasificados como descartables (y el vaciado de papelera después los
     destruye) mientras la web los sigue pidiendo. El cliente ya tiene su propia
     cuenta de referencias, pero es exactamente el tipo de decisión que no puede
     depender de que una pestaña tenga el estado fresco. */
  if (state !== 'used' && hasDb) {
    try {
      await ensureDb()
      const base = url.split('?')[0].split('#')[0].split('/').pop() || ''
      if (base) {
        /* `ignoreKeys` = contenedores que el cliente está vaciando en este mismo
           gesto. Su borrado en `cms_data` va con debounce y puede no haber
           aterrizado todavía, así que sin esta exclusión el guard bloquearía el
           flujo legítimo "se quita de contenedor -> sin usar". */
        const ignore = Array.isArray(body.ignoreKeys) ? body.ignoreKeys.filter((k) => typeof k === 'string') : []
        const { rows } = await getPool()!.query(
          "SELECT key FROM cms_data WHERE value LIKE '%' || $1 || '%' AND NOT (key = ANY($2::varchar[])) LIMIT 5",
          [base, ignore],
        )
        if (rows.length > 0) {
          const keys = (rows as { key: string }[]).map((r) => r.key)
          return NextResponse.json(
            { error: `Still used by ${keys.length} container(s): ${keys.join(', ')}.`, keys },
            { status: 409 },
          )
        }
      }
    } catch (err) {
      console.error('[move-media] no se pudo verificar referencias:', err)
      return NextResponse.json({ error: 'Could not verify references' }, { status: 503 })
    }
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

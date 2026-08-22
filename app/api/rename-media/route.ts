import { NextResponse } from 'next/server'
import { setAssetDisplayName } from '@/lib/storage'
import { requireRole } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* Límite propio, no de Cloudinary: un nombre de archivo más largo que esto no
   entra en ninguna tarjeta y solo sirve para inflar el JSONB de cms_state. */
const MAX_NAME = 120

/* La barra es el ÚNICO carácter que Cloudinary prohíbe en display_name (separa
   carpetas). Los de control se sacan porque no se ven pero viajan igual. */
const CONTROL_CHARS = /[\x00-\x1f\x7f]/g

/* POST /api/rename-media → { url, name } → cambia el NOMBRE VISIBLE del asset.
   Toca `display_name` en Cloudinary, que no forma parte de la URL de entrega:
   ninguna referencia guardada en cms_data / cms_state se invalida. El nombre
   dentro del CMS lo actualiza el cliente (`renameMediaEverywhere`) recién
   cuando esta ruta confirma. */
export async function POST(req: Request) {
  const auth = await requireRole(req, ['owner', 'admin', 'demo'])
  if ('deny' in auth) return auth.deny

  let body: { url?: unknown; name?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const url = typeof body.url === 'string' ? body.url : ''
  const raw = typeof body.name === 'string' ? body.name : ''
  if (!url) return NextResponse.json({ error: 'url is required' }, { status: 400 })

  const name = raw.replace(CONTROL_CHARS, '').trim()
  if (!name) return NextResponse.json({ error: 'The file name cannot be empty.' }, { status: 400 })
  if (name.length > MAX_NAME) {
    return NextResponse.json({ error: `The file name cannot exceed ${MAX_NAME} characters.` }, { status: 400 })
  }
  if (name.includes('/') || name.includes('\\')) {
    return NextResponse.json({ error: 'The file name cannot contain slashes.' }, { status: 400 })
  }

  // Demo no escribe en Cloudinary; el panel refleja el cambio solo en su sesión.
  if (auth.user.role === 'demo') {
    return NextResponse.json({ success: true, name, applied: 'demo' })
  }

  const res = await setAssetDisplayName(url, name)
  if (!res.ok) {
    return NextResponse.json({ error: res.reason }, { status: 502 })
  }

  return NextResponse.json({ success: true, name, applied: res.applied })
}

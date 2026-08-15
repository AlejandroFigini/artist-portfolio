import { NextResponse } from 'next/server'
import { deleteAsset } from '@/lib/storage'
import { requireRole } from '@/lib/auth'
import { getPool, hasDb, ensureDb } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* POST /api/delete-media → borra un asset por su URL (Cloudinary o archivo local). */
export async function POST(req: Request) {
  const auth = await requireRole(req, ['owner', 'admin', 'demo'])
  if ('deny' in auth) return auth.deny

  let body: { url?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const { url } = body

  if (auth.user.role === 'demo') {
    return NextResponse.json({ success: true })
  }

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  /* Guarda de referencias EN EL SERVIDOR. Hasta acá el cliente era lo único entre
     un contenedor vivo y un asset destruido: bastaba una pestaña con estado viejo
     para borrar los bytes de una imagen que la web sigue mostrando, y el 404 era
     irreversible. Un asset puede estar referenciado por varios contenedores (en
     prod hay 56 referencias sobre 44 assets), así que se consulta por el nombre
     del archivo, que es lo estable entre la URL guardada y la real. */
  if (hasDb) {
    try {
      await ensureDb()
      const base = url.split('?')[0].split('#')[0].split('/').pop() || ''
      if (base) {
        const { rows } = await getPool()!.query(
          "SELECT key FROM cms_data WHERE value LIKE '%' || $1 || '%' LIMIT 5",
          [base],
        )
        if (rows.length > 0) {
          const keys = (rows as { key: string }[]).map((r) => r.key)
          return NextResponse.json(
            { error: `Still used by ${keys.length} container(s): ${keys.join(', ')}. Remove it from them first.` },
            { status: 409 },
          )
        }
      }
    } catch (err) {
      /* Sin poder verificar no se borra: no hay forma de deshacer un destroy. */
      console.error('[delete-media] no se pudo verificar referencias:', err)
      return NextResponse.json({ error: 'Could not verify references; deletion aborted' }, { status: 503 })
    }
  }

  try {
    /* Un destroy fallido se reporta. Antes se devolvía `success: true` pasara lo
       que pasara: el cliente borraba su registro y el objeto quedaba vivo y
       facturado en Cloudinary sin que nadie lo supiera. */
    const res = await deleteAsset(url)
    if (!res.ok) {
      console.error('[delete-media] destroy falló:', url, res.reason)
      return NextResponse.json({ error: 'Could not delete the asset' }, { status: 502 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[delete-media] error:', err)
    return NextResponse.json({ error: 'Error deleting asset' }, { status: 500 })
  }
}

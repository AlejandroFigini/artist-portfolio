import { NextResponse } from 'next/server'
import { listAllCloudinaryResources, hasCloudinary } from '@/lib/storage'
import { requireSession } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* GET /api/media/sizes → { sizes: { <url sin query>: bytes }, complete }

   El peso que mostraba el panel salía de `POST /api/resolve-sizes`, que hace un
   HEAD contra la URL de entrega y se queda con el `content-length`. Tres motivos
   por los que ese número no podía coincidir con Cloudinary:

   - el HEAD mide lo que la CDN ENTREGA (recodificado si la URL lleva
     transformaciones), no el original que Cloudinary factura y lista;
   - estaba topeado en 150 URLs por request y nadie iteraba: con el repositorio
     por encima de eso, el resto quedaba en 0 sin avisar;
   - la papelera nunca se le pasaba, así que su peso era siempre 0.

   Cloudinary ya publica `bytes` por asset en el mismo listado que usa la
   auditoría. Esa es la cifra, y esta ruta la expone tal cual para que la barra
   lateral, las cabeceras de cada apartado y las tarjetas usen exactamente el
   mismo número que el panel de sincronización. */
export async function GET(req: Request) {
  const auth = await requireSession(req)
  if ('deny' in auth) return auth.deny

  if (!hasCloudinary) {
    // En local el almacenamiento es el disco: lo pesa `resolve-sizes`.
    return NextResponse.json({ sizes: {}, complete: false, source: 'local' })
  }

  try {
    const { resources, complete } = await listAllCloudinaryResources()
    const sizes: Record<string, number> = {}
    for (const r of resources) {
      const url = (r.secure_url || '').split('?')[0].split('#')[0]
      if (url && r.bytes > 0) sizes[url] = r.bytes
    }
    /* `complete: false` viaja al cliente para que NO pise tamaños conocidos con
       una lectura parcial: un listado truncado dejaría archivos reales en 0. */
    return NextResponse.json({ sizes, complete, source: 'cloudinary' })
  } catch (err) {
    console.error('[media/sizes] error:', err)
    return NextResponse.json({ error: 'Error reading sizes' }, { status: 500 })
  }
}

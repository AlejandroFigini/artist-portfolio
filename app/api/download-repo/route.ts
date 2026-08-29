import { NextResponse } from 'next/server'
import { createRepoArchive, hasCloudinary } from '@/lib/storage'
import { requireRole } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* GET /api/download-repo → arma un ZIP con EXACTAMENTE los mismos archivos que
   el panel cuenta en "Total Repository" y devuelve su URL.

   La construcción vive en `lib/storage → createRepoArchive`, que parte del
   mismo listado que audita el panel en vez de volver a describir el conjunto
   con un prefijo y un `resource_type`. Se devuelven también las cifras que
   Cloudinary reporta para el archivo generado y las que el panel esperaba: si
   no coinciden, el cliente lo dice en vez de entregar un ZIP corto en silencio,
   que es lo que venía pasando. */
export async function GET(req: Request) {
  const auth = await requireRole(req, ['owner', 'admin'])
  if ('deny' in auth) return auth.deny

  if (!hasCloudinary) {
    return NextResponse.json({ error: 'Cloudinary is not configured in this environment.' }, { status: 400 })
  }

  try {
    const archive = await createRepoArchive()
    return NextResponse.json(archive)
  } catch (err) {
    console.error('[download-repo] error:', err)
    /* El motivo importa: "el listado vino truncado" y "no hay nada que bajar"
       llevan a acciones distintas y el admin no puede adivinarlas desde un
       mensaje genérico. Son mensajes propios, no detalle de Cloudinary. */
    const message = err instanceof Error ? err.message : ''
    const known = /Cloudinary|repository|nothing to download/i.test(message)
    return NextResponse.json(
      { error: known ? message : 'Failed to generate the archive.' },
      { status: 500 },
    )
  }
}

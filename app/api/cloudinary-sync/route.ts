import { NextResponse } from 'next/server'
import { listAllCloudinaryResources, hasCloudinary, getFolderMode } from '@/lib/storage'
import { requireSession } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* GET /api/list-cloudinary → lista todos los recursos del folder portfolio/
   en Cloudinary (image, video, raw). Para auditoría de sincronización. */
export async function GET(req: Request) {
  const auth = await requireSession(req)
  if ('deny' in auth) return auth.deny

  /* Ni el cloud name ni fragmentos de la API key salen en la respuesta: son
     datos de infraestructura y el detalle del error de Cloudinary puede
     incluirlos. Va al log del servidor, al cliente solo un mensaje genérico. */
  if (!hasCloudinary) {
    console.error('[cloudinary-sync] faltan credenciales de Cloudinary en el entorno')
    return NextResponse.json({
      resources: [],
      error: 'Cloudinary is not configured in this environment.',
    }, { status: 400 })
  }

  try {
    /* `folderMode` decide solo si además se espeja la carpeta visual: el estado
       del ciclo de vida vive en tags y funciona igual en los dos modos. Se expone
       para poder verificarlo sin adivinar en qué modo corre el account. */
    const [{ resources, complete }, folderMode] = await Promise.all([
      listAllCloudinaryResources(),
      getFolderMode(),
    ])
    const untagged = resources.filter((r) => !r.tags.some((t) => t.startsWith('state:'))).length
    return NextResponse.json({
      resources,
      count: resources.length,
      /* Un listado truncado no puede pasar por total: quien compare necesita
         saber que 0 recursos puede significar "falló la lectura". */
      complete,
      folderMode,
      // Assets que todavía clasifican por carpeta (subidos antes del cambio a tags).
      untagged,
    })
  } catch (err) {
    console.error('[cloudinary-sync] error:', err)
    return NextResponse.json({ error: 'Error listing resources' }, { status: 500 })
  }
}

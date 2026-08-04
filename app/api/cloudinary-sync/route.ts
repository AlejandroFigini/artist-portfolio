import { NextResponse } from 'next/server'
import { listAllCloudinaryResources, hasCloudinary } from '@/lib/storage'
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
      error: 'Cloudinary no está configurado en este entorno.',
    }, { status: 400 })
  }

  try {
    const resources = await listAllCloudinaryResources()
    return NextResponse.json({ resources, count: resources.length })
  } catch (err) {
    console.error('[cloudinary-sync] error:', err)
    return NextResponse.json({ error: 'Error listing resources' }, { status: 500 })
  }
}

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

  if (!hasCloudinary) {
    return NextResponse.json({ resources: [], message: 'Cloudinary not configured' })
  }

  try {
    const resources = await listAllCloudinaryResources()
    return NextResponse.json({ resources })
  } catch (err) {
    console.error('[list-cloudinary] error:', err)
    return NextResponse.json({ error: 'Error listing Cloudinary resources' }, { status: 500 })
  }
}

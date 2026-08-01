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
    return NextResponse.json({ resources: [], error: 'Cloudinary environment variables missing (CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET)' }, { status: 400 })
  }

  try {
    const resources = await listAllCloudinaryResources()
    return NextResponse.json({ resources, count: resources.length })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[cloudinary-sync] error:', err)
    return NextResponse.json({ error: message || 'Error listing Cloudinary resources' }, { status: 500 })
  }
}

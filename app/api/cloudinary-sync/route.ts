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

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || ''
  const apiKey = process.env.CLOUDINARY_API_KEY || ''
  const maskedKey = apiKey ? `${apiKey.slice(0, 4)}***${apiKey.slice(-2)}` : 'MISSING'

  if (!hasCloudinary) {
    return NextResponse.json({
      resources: [],
      error: `Cloudinary variables missing in environment (Cloud Name: "${cloudName || 'EMPTY'}", API Key: "${maskedKey}")`
    }, { status: 400 })
  }

  try {
    const resources = await listAllCloudinaryResources()
    return NextResponse.json({
      resources,
      count: resources.length,
      debug: { cloudName, apiKey: maskedKey }
    })
  } catch (err: any) {
    let message = 'Error listing resources'
    if (err instanceof Error) {
      message = err.message
    } else if (err && typeof err === 'object') {
      if (err.error && err.error.message) message = err.error.message
      else if (err.message) message = err.message
      else message = JSON.stringify(err)
    } else {
      message = String(err)
    }
    console.error('[cloudinary-sync] error:', err)
    return NextResponse.json({
      error: `Cloudinary error on cloud "${cloudName}": ${message}`
    }, { status: 500 })
  }
}

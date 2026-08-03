import { NextResponse } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'
import { requireRole } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = await requireRole(req, ['owner', 'admin'])
  if ('deny' in auth) return auth.deny

  if (!process.env.CLOUDINARY_API_KEY) {
    return NextResponse.json({ error: 'Cloudinary not configured' }, { status: 400 })
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })

  try {
    const url = cloudinary.utils.download_zip_url({
      prefixes: 'portfolio',
      resource_type: 'auto',
      target_public_id: 'artist-portfolio-repo',
      use_original_filename: true,
    })
    
    return NextResponse.json({ url })
  } catch (err) {
    console.error('[download-repo] error:', err)
    return NextResponse.json({ error: 'Failed to generate archive URL' }, { status: 500 })
  }
}

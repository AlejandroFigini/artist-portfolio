import { NextResponse } from 'next/server'
import { getSiteSettingsServer } from '@/lib/site-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const settings = await getSiteSettingsServer()
  const res = NextResponse.json(settings)
  res.headers.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  return res
}

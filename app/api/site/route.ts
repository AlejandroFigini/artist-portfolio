import { NextResponse } from 'next/server'
import { getSiteSettingsServer } from '@/lib/site-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const settings = await getSiteSettingsServer()
  return NextResponse.json(settings)
}

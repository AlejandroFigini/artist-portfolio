import { NextResponse } from 'next/server'
import { getSiteSettingsServer } from '@/lib/site-server'
import { hasDb } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const settings = await getSiteSettingsServer()
  // `hasDb` le dice al cliente si el server es autoritativo: con DB, sus valores
  // (aunque vacíos) mandan y NO se resucitan overrides locales viejos. Sin DB
  // (dev/mock) el cliente cae a cms_overrides_v1. (Fix del flash de contenido
  // removido en el loader.)
  const res = NextResponse.json({ ...settings, hasDb })
  res.headers.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  return res
}

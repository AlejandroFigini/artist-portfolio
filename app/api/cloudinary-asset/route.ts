import { NextResponse } from 'next/server'
import { resolveAssetId } from '@/lib/storage'
import { requireSession } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* GET /api/cloudinary-asset?url=<secure_url> → { assetId }
   El `asset_id` es lo único que acepta la ficha de la consola de Cloudinary y
   no viaja en la URL del archivo, así que lo resuelve el servidor (la Admin API
   necesita credenciales). Solo sesión de admin: expone metadatos de la cuenta. */
export async function GET(req: Request) {
  const auth = await requireSession(req)
  if ('deny' in auth) return auth.deny

  const url = new URL(req.url).searchParams.get('url') || ''
  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

  const assetId = await resolveAssetId(url)
  return NextResponse.json({ assetId })
}

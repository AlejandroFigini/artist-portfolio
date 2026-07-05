import { NextResponse } from 'next/server'
import { scaffoldFolders } from '@/lib/storage'
import { getAllFolderPaths } from '@/lib/cms/pages'
import { requireSession } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* POST /api/scaffold-folders → crea la estructura de carpetas vacías en Cloudinary
   según la taxonomía de páginas y secciones del sitio. Idempotente. */
export async function POST(req: Request) {
  const auth = await requireSession(req)
  if ('deny' in auth) return auth.deny

  try {
    const paths = getAllFolderPaths()
    const result = await scaffoldFolders(paths)
    return NextResponse.json({ success: true, ...result, total: paths.length })
  } catch (err) {
    console.error('[scaffold-folders] error:', err)
    return NextResponse.json({ error: 'Error creando carpetas' }, { status: 500 })
  }
}

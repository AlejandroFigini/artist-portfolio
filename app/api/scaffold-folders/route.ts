import { NextResponse } from 'next/server'
import { scaffoldFolders } from '@/lib/storage'
import { getAllFolderPaths } from '@/lib/cms/pages'
import { requireRole } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* POST /api/scaffold-folders → crea la estructura de carpetas vacías en Cloudinary
   según la taxonomía de páginas y secciones del sitio. Idempotente. */
export async function POST(req: Request) {
  /* Crea estructura en el Cloudinary de PRODUCCIÓN: no es algo que deba poder
     disparar el rol `demo`, cuyo criterio general es no tener repercusión real.
     Antes alcanzaba con tener sesión de cualquier tipo. */
  const auth = await requireRole(req, ['owner', 'admin'])
  if ('deny' in auth) return auth.deny

  try {
    const paths = getAllFolderPaths()
    const result = await scaffoldFolders(paths)
    return NextResponse.json({ success: true, ...result, total: paths.length })
  } catch (err) {
    console.error('[scaffold-folders] error:', err)
    return NextResponse.json({ error: 'Error creating folders' }, { status: 500 })
  }
}

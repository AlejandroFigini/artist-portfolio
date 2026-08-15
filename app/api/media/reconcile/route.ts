import { NextResponse } from 'next/server'
import { getPool, hasDb, ensureDb } from '@/lib/db'
import { listAllCloudinaryResources, hasCloudinary, setAssetState, type MediaState } from '@/lib/storage'
import { requireRole } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* Reconciliador DB ↔ Cloudinary.
   La DB manda: `cms_data` dice qué contenedor apunta a qué URL, y eso NO se
   deduce de Cloudinary. Cloudinary solo aporta qué bytes existen y con qué tag.
   Por eso `apply` únicamente:
     - reescribe la URL de un contenedor cuyo asset se movió de lugar (`url-stale`)
     - alinea el tag de estado del asset con lo que la DB implica (`state-drift`)
   Nunca borra nada, y nunca escribe estado de la DB tomando a Cloudinary como
   verdad: eso convertiría un error de lectura en pérdida de datos. */

type Finding = {
  kind: 'url-stale' | 'state-drift' | 'untagged' | 'orphan-cloudinary' | 'missing-cloudinary'
  key?: string
  url?: string
  publicId?: string
  detail: string
  fixedTo?: string
}

/** Nombre de archivo del public_id, sin carpeta ni extensión. Es lo único estable
 *  entre una URL vieja (con la carpeta adentro) y el asset ya movido. */
function basenameOf(publicIdOrUrl: string): string {
  const noQuery = publicIdOrUrl.split('?')[0].split('#')[0]
  const last = noQuery.split('/').pop() || ''
  return last.replace(/\.[a-zA-Z0-9]+$/, '').toLowerCase()
}

async function reconcile(apply: boolean) {
  await ensureDb()
  const pool = getPool()!

  const { rows } = await pool.query('SELECT key, value FROM cms_data')
  const refs = (rows as { key: string; value: string }[])
    .filter((r) => typeof r.value === 'string' && r.value.includes('res.cloudinary.com'))

  const resources = await listAllCloudinaryResources()
  /* Lectura no concluyente → abortar. Clasificar contra una lista vacía marcaría
     TODO el contenido como roto, y con `apply` eso sería destructivo. */
  if (resources.length === 0) {
    throw new Error('Cloudinary devolvió 0 recursos: lectura no concluyente, se aborta')
  }

  const byUrl = new Map(resources.map((r) => [r.secure_url.split('?')[0], r]))
  const byBasename = new Map<string, typeof resources>()
  for (const r of resources) {
    const b = basenameOf(r.public_id)
    if (!byBasename.has(b)) byBasename.set(b, [])
    byBasename.get(b)!.push(r)
  }

  const findings: Finding[] = []
  // Un asset puede estar referenciado por varios contenedores (refcount).
  const referenced = new Set<string>()
  const repairs: { key: string; url: string }[] = []

  for (const { key, value } of refs) {
    const clean = value.split('?')[0]
    const hit = byUrl.get(clean)
    if (hit) {
      referenced.add(hit.public_id)
      continue
    }
    /* La URL guardada no existe en Cloudinary. Buscar el mismo archivo en otra
       carpeta: es exactamente el daño que dejaba el rename al mover de estado. */
    const candidates = byBasename.get(basenameOf(clean)) || []
    if (candidates.length === 1) {
      const target = candidates[0]
      referenced.add(target.public_id)
      findings.push({
        kind: 'url-stale', key, url: value, publicId: target.public_id,
        detail: `el asset existe en ${target.public_id}, la DB apunta a una URL muerta`,
        fixedTo: target.secure_url,
      })
      repairs.push({ key, url: target.secure_url })
    } else {
      findings.push({
        kind: 'missing-cloudinary', key, url: value,
        detail: candidates.length === 0
          ? 'no existe ningún asset con ese nombre en Cloudinary'
          : `${candidates.length} candidatos con el mismo nombre: ambiguo, requiere decisión manual`,
      })
    }
  }

  /* Estado esperado: referenciado ⇒ used. El tag solo decide sin-usar vs basurero
     para los NO referenciados.
     `hasStateTag` distingue "tiene tag" de "se dedujo de la carpeta": los assets
     subidos antes de que el estado viviera en tags no tienen ninguno y hay que
     escribirles el que corresponde (backfill), aunque su estado deducido ya sea
     el correcto. Mientras no se haga, conviven los dos mecanismos. */
  const drift: { url: string; state: MediaState }[] = []
  for (const r of resources) {
    const hasStateTag = r.tags.some((t) => t.startsWith('state:'))
    const expected: MediaState | null = referenced.has(r.public_id) ? 'used' : r.state

    if (!expected) {
      findings.push({ kind: 'orphan-cloudinary', publicId: r.public_id, url: r.secure_url, detail: 'no referenciado y sin tag ni carpeta que lo clasifique' })
      continue
    }
    if (!hasStateTag) {
      findings.push({
        kind: 'untagged', publicId: r.public_id, url: r.secure_url,
        detail: `sin tag de estado; se deduce ${expected} (${referenced.has(r.public_id) ? 'referenciado' : 'por carpeta'})`,
      })
      drift.push({ url: r.secure_url, state: expected })
      continue
    }
    if (r.state !== expected) {
      findings.push({
        kind: 'state-drift', publicId: r.public_id, url: r.secure_url,
        detail: `referenciado por un contenedor pero marcado como ${r.state ?? 'sin estado'}`,
      })
      drift.push({ url: r.secure_url, state: expected })
    }
  }

  let applied = 0
  if (apply) {
    if (repairs.length) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        // Escritura ACOTADA a las keys reparadas: nunca el mapa entero.
        await client.query(
          `UPDATE cms_data AS c SET value = v.url, updated_at = CURRENT_TIMESTAMP
           FROM (SELECT * FROM UNNEST($1::varchar[], $2::text[]) AS t(key, url)) AS v
           WHERE c.key = v.key`,
          [repairs.map((r) => r.key), repairs.map((r) => r.url)],
        )
        await client.query('COMMIT')
        applied += repairs.length
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {})
        throw err
      } finally {
        client.release()
      }
    }
    for (const d of drift) {
      const res = await setAssetState(d.url, d.state)
      if (res.ok) applied++
    }
  }

  return {
    checked: refs.length,
    cloudinaryAssets: resources.length,
    findings,
    counts: findings.reduce<Record<string, number>>((a, f) => ({ ...a, [f.kind]: (a[f.kind] || 0) + 1 }), {}),
    applied,
  }
}

/* GET → diagnóstico, no toca nada. */
export async function GET(req: Request) {
  const auth = await requireRole(req, ['owner', 'admin', 'demo'])
  if ('deny' in auth) return auth.deny
  if (!hasCloudinary) return NextResponse.json({ error: 'Cloudinary is not configured in this environment.' }, { status: 409 })
  if (!hasDb) return NextResponse.json({ error: 'No database in this environment.' }, { status: 409 })
  try {
    return NextResponse.json(await reconcile(false))
  } catch (err) {
    console.error('[reconcile GET] error:', err)
    return NextResponse.json({ error: 'Reconciliation failed' }, { status: 500 })
  }
}

/* POST → aplica las reparaciones. Solo owner/admin: el demo no escribe. */
export async function POST(req: Request) {
  const auth = await requireRole(req, ['owner', 'admin', 'demo'])
  if ('deny' in auth) return auth.deny
  if (auth.user.role === 'demo') return NextResponse.json({ applied: 0, findings: [], counts: {} })
  if (!hasCloudinary) return NextResponse.json({ error: 'Cloudinary is not configured in this environment.' }, { status: 409 })
  if (!hasDb) return NextResponse.json({ error: 'No database in this environment.' }, { status: 409 })
  try {
    return NextResponse.json(await reconcile(true))
  } catch (err) {
    console.error('[reconcile POST] error:', err)
    return NextResponse.json({ error: 'Reconciliation failed' }, { status: 500 })
  }
}

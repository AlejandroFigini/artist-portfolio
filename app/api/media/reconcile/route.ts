import { NextResponse } from 'next/server'
import { getPool, hasDb, ensureDb } from '@/lib/db'
import { listAllCloudinaryResources, hasCloudinary, setAssetState } from '@/lib/storage'
import { auditMedia, isMediaValue, IncompleteListingError, type CmsIndex, type CmsRow } from '@/lib/media-audit'
import { requireRole } from '@/lib/auth'
import { existsSync } from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* Reconciliador DB ↔ Cloudinary.
   La DB manda: `cms_data` dice qué contenedor apunta a qué URL, y eso NO se
   deduce de Cloudinary. Cloudinary solo aporta qué bytes existen y con qué tag.
   La clasificación vive en `lib/media-audit` (pura, testeable); acá queda la
   lectura, la escritura y las guardas de seguridad.

   `apply` únicamente:
     - reescribe la URL de un contenedor cuyo asset se movió de lugar (`url-stale`)
     - alinea el tag de estado del asset con lo que la DB implica (`state-drift`)
     - vacía contenedores cuyo archivo local ya no existe (`ghost`)
   Nunca borra bytes de Cloudinary, y nunca escribe estado de la DB tomando a
   Cloudinary como verdad: eso convertiría un error de lectura en pérdida de datos.

   `purge` agrega lo destructivo y por eso es opt-in explícito: vacía también los
   contenedores cuya URL de Cloudinary ya no tiene asset detrás, y levanta las
   guardas de proporción. Sólo tiene sentido cuando se aceptó que el sitio quedó
   apuntando a archivos borrados a mano en Cloudinary. */

/** Con Cloudinary configurado el almacenamiento ES Cloudinary: una ruta
 *  `/uploads/` (resto de desarrollo local) no existe. En local se mira el disco. */
const localAssetExists = (relPath: string): boolean =>
  hasCloudinary ? false : existsSync(path.join(process.cwd(), 'public', relPath))

async function reconcile(apply: boolean, purge: boolean) {
  await ensureDb()
  const pool = getPool()!

  const { rows } = await pool.query('SELECT key, value FROM cms_data')
  const cmsRows = rows as CmsRow[]

  const listing = await listAllCloudinaryResources()

  const { rows: stateRows } = await pool.query(
    "SELECT key, value FROM cms_state WHERE key IN ('used_content','unused','trash','media_meta')",
  )
  const stateByKey: Record<string, unknown> = {}
  for (const r of stateRows as { key: string; value: unknown }[]) stateByKey[r.key] = r.value

  const index: CmsIndex = {
    usedContent: (stateByKey.used_content || {}) as CmsIndex['usedContent'],
    unused: (Array.isArray(stateByKey.unused) ? stateByKey.unused : []) as CmsIndex['unused'],
    trash: (Array.isArray(stateByKey.trash) ? stateByKey.trash : []) as CmsIndex['trash'],
    mediaMeta: (stateByKey.media_meta || {}) as CmsIndex['mediaMeta'],
  }

  // Lanza IncompleteListingError si el listado de Cloudinary vino truncado.
  const report = auditMedia({ rows: cmsRows, listing, index, localAssetExists })

  let applied = 0
  if (apply) {
    if (report.repairs.length) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        // Escritura ACOTADA a las keys reparadas: nunca el mapa entero.
        await client.query(
          `UPDATE cms_data AS c SET value = v.url, updated_at = CURRENT_TIMESTAMP
           FROM (SELECT * FROM UNNEST($1::varchar[], $2::text[]) AS t(key, url)) AS v
           WHERE c.key = v.key`,
          [report.repairs.map((r) => r.key), report.repairs.map((r) => r.url)],
        )
        await client.query('COMMIT')
        applied += report.repairs.length
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {})
        throw err
      } finally {
        client.release()
      }
    }
    for (const d of report.drift) {
      const res = await setAssetState(d.url, d.state)
      if (res.ok) applied++
    }

    /* Los contenedores a vaciar. Sin `purge` sólo los de ruta local muerta, que
       es el comportamiento histórico; con `purge` también los que apuntan a una
       URL de Cloudinary sin asset detrás. */
    const toBlank = purge ? [...report.ghostKeys, ...report.deadKeys] : report.ghostKeys
    if (toBlank.length) {
      /* Guarda de cordura: si CASI TODO diera fantasma, lo esperable es que haya
         fallado la lectura del almacenamiento, no que los datos estén mal. Con
         `purge` se acepta explícitamente que sí están mal (Cloudinary vaciado a
         mano), y la guarda cedería a una decisión ya tomada. */
      const totalMedia = cmsRows.filter((r) => isMediaValue(r.value)).length
      if (!purge && totalMedia > 0 && toBlank.length > totalMedia * 0.5) {
        throw new Error(
          `${toBlank.length}/${totalMedia} referencias darían fantasma: lectura no concluyente, se aborta`,
        )
      }
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        /* El contenedor queda vacío, que es lo que el visitante YA ve: la URL da
           404 y el fallback pinta el estado vacío. Esto hace que la base diga lo
           mismo que la pantalla. No se borra la fila: la clave sigue existiendo
           para que el contenedor se pueda volver a llenar. */
        await client.query(
          `UPDATE cms_data SET value = '', updated_at = CURRENT_TIMESTAMP
           WHERE key = ANY($1::varchar[])`,
          [toBlank],
        )
        await client.query('COMMIT')
        applied += toBlank.length
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {})
        throw err
      } finally {
        client.release()
      }
    }

    /* Con `purge` el índice tiene que perder también las entradas que apuntan a
       los contenedores recién vaciados; `auditMedia` ya las excluyó de
       `nextUsed/nextUnused/nextTrash` por ser fantasmas. */
    if (report.indexChanged) {
      /* Guarda: esta reparación SACA entradas de sin-usar/papelera. Si el cálculo
         estuviera mal, el peor caso sería vaciar el índice — el mismo daño que ya
         pasó en producción. Una reparación legítima nunca vacía una colección que
         tenía contenido, así que si eso ocurre se aborta en vez de escribir.
         Con `purge` sí puede vaciarla: es exactamente lo que se pidió cuando ya
         no queda un solo byte en Cloudinary. */
      const vaciaria =
        (index.unused.length > 0 && report.nextUnused.length === 0 && report.referencedSrcCount === 0) ||
        (Object.keys(index.usedContent).length > 0 && Object.keys(report.nextUsed).length === 0)
      if (!purge && vaciaria) {
        throw new Error('la reparación del índice vaciaría una colección con datos: se aborta')
      }
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        for (const [k, v] of [
          ['used_content', report.nextUsed] as const,
          ['unused', report.nextUnused] as const,
          ['trash', report.nextTrash] as const,
        ]) {
          await client.query(
            `INSERT INTO cms_state (key, value, updated_at)
             VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
             ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = CURRENT_TIMESTAMP`,
            [k, JSON.stringify(v)],
          )
        }
        await client.query('COMMIT')
        /* Cuenta TODO lo que este bloque escribió: los index-drift (contenedores
           reclasificados) y los ghost de índice (entradas sin archivo detrás que
           nextUsed/nextUnused/nextTrash ya excluyeron). */
        applied += report.findings.filter((f) => f.kind === 'index-drift' || (f.kind === 'ghost' && !f.key)).length
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {})
        throw err
      } finally {
        client.release()
      }
    }
  }

  return {
    checked: report.checked,
    cloudinaryAssets: report.cloudinaryAssets,
    findings: report.findings,
    counts: report.counts,
    // Vistas para el panel de auditoría.
    matching: report.matching,
    stale: report.stale,
    missing: report.missing,
    orphaned: report.orphaned,
    stateDrift: report.stateDrift,
    // Cuánto podría reparar / vaciar un apply, para poder avisar antes de hacerlo.
    repairable: report.repairs.length + report.drift.length,
    purgeable: report.ghostKeys.length + report.deadKeys.length,
    applied,
  }
}

/** El listado truncado es la única condición no clasificable, y no es un bug del
 *  servidor: es Cloudinary sin responder. 503 y un mensaje que lo diga. */
function handleError(err: unknown, tag: string) {
  if (err instanceof IncompleteListingError) {
    console.error(`[${tag}]`, err.message)
    return NextResponse.json(
      { error: 'Could not read the full Cloudinary listing. Comparison aborted to avoid acting on partial data.' },
      { status: 503 },
    )
  }
  console.error(`[${tag}] error:`, err)
  return NextResponse.json({ error: 'Reconciliation failed' }, { status: 500 })
}

/* GET → diagnóstico, no toca nada. */
export async function GET(req: Request) {
  const auth = await requireRole(req, ['owner', 'admin', 'demo'])
  if ('deny' in auth) return auth.deny
  if (!hasCloudinary) return NextResponse.json({ error: 'Cloudinary is not configured in this environment.' }, { status: 409 })
  if (!hasDb) return NextResponse.json({ error: 'No database in this environment.' }, { status: 409 })
  try {
    return NextResponse.json(await reconcile(false, false))
  } catch (err) {
    return handleError(err, 'reconcile GET')
  }
}

/* POST → aplica las reparaciones. Solo owner/admin: el demo no escribe.
   `{ purge: true }` habilita además el vaciado de contenedores sin archivo. */
export async function POST(req: Request) {
  const auth = await requireRole(req, ['owner', 'admin', 'demo'])
  if ('deny' in auth) return auth.deny
  if (auth.user.role === 'demo') return NextResponse.json({ applied: 0, findings: [], counts: {} })
  if (!hasCloudinary) return NextResponse.json({ error: 'Cloudinary is not configured in this environment.' }, { status: 409 })
  if (!hasDb) return NextResponse.json({ error: 'No database in this environment.' }, { status: 409 })
  const body = await req.json().catch(() => ({}))
  const purge = (body as { purge?: unknown }).purge === true
  try {
    return NextResponse.json(await reconcile(true, purge))
  } catch (err) {
    return handleError(err, 'reconcile POST')
  }
}

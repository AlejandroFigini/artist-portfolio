import { NextResponse } from 'next/server'
import { getPool, hasDb, ensureDb } from '@/lib/db'
import { listAllCloudinaryResources, hasCloudinary, setAssetState, type MediaState } from '@/lib/storage'
import { requireRole } from '@/lib/auth'
import { existsSync } from 'node:fs'
import path from 'node:path'

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
  kind: 'url-stale' | 'state-drift' | 'untagged' | 'orphan-cloudinary' | 'missing-cloudinary' | 'index-drift' | 'ghost'
  key?: string
  url?: string
  publicId?: string
  detail: string
  fixedTo?: string
}

/** Identidad de una URL para comparar: sin query ni fragmento. */
function srcKey(v: string): string {
  return (v || '').split('?')[0].split('#')[0]
}

/** Un valor de `cms_data` que apunta a un archivo (no texto, no color, no fecha). */
function isMediaValue(v: unknown): v is string {
  return typeof v === 'string' && (v.includes('res.cloudinary.com') || v.startsWith('/uploads/'))
}

type UsedEntry = {
  key: string; label: string; section: string; kind: 'image' | 'video' | 'text'
  src: string; name: string; size: number | null; original: boolean; ts?: number; type?: string
}
type LooseEntry = { key?: string; src?: string; dataUrl?: string; [k: string]: unknown }
type MediaMetaRow = { name?: string; size?: number; type?: string; ts?: number; label?: string; section?: string }

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

  /* ---- Índice del CMS (cms_state) ----------------------------------------
     La regla adoptada: un asset referenciado por al menos un valor de `cms_data`
     está EN USO, punto. Si además figura en `unused`/`trash`, el índice se
     contradice a sí mismo: el panel lo ofrece como descartable mientras un
     contenedor lo está mostrando, y vaciar la papelera después destruiría los
     bytes. El tag de Cloudinary ya se alinea arriba; acá se alinea el índice.
     Se toma la URL FINAL (después de la reparación de `url-stale`), si no se
     compararía contra una URL que este mismo run está por reescribir. */
  const fixedByKey = new Map(repairs.map((r) => [r.key, r.url]))
  const referencedSrcs = new Set<string>()
  const refByKey = new Map<string, string>()
  for (const r of rows as { key: string; value: string }[]) {
    if (!isMediaValue(r.value)) continue
    const url = fixedByKey.get(r.key) || r.value
    /* Los archivos de AJUSTES (CV, favicon, icono de buscador) cuentan como
       referenciados —no se pueden descartar— pero NO son contenido de galería:
       no van al índice de la biblioteca. Sin esta distinción esta reparación
       metía el CV en `used_content`, que es justo lo que el picker excluye. */
    referencedSrcs.add(srcKey(url))
    if (r.key.startsWith('settings.')) continue
    refByKey.set(r.key, url)
  }

  const { rows: stateRows } = await pool.query(
    "SELECT key, value FROM cms_state WHERE key IN ('used_content','unused','trash','media_meta')",
  )
  const stateByKey: Record<string, unknown> = {}
  for (const r of stateRows as { key: string; value: unknown }[]) stateByKey[r.key] = r.value

  const usedContent = (stateByKey.used_content || {}) as Record<string, UsedEntry>
  const unusedList = (Array.isArray(stateByKey.unused) ? stateByKey.unused : []) as LooseEntry[]
  const trashList = (Array.isArray(stateByKey.trash) ? stateByKey.trash : []) as LooseEntry[]
  const mediaMeta = (stateByKey.media_meta || {}) as Record<string, MediaMetaRow>

  const entrySrc = (e: LooseEntry) => srcKey((e.src || e.dataUrl || '') as string)

  // 1) Lo referenciado no puede estar en sin-usar ni en papelera.
  const nextUnused = unusedList.filter((e) => !referencedSrcs.has(entrySrc(e)))
  const nextTrash = trashList.filter((e) => !referencedSrcs.has(entrySrc(e)))
  for (const e of [...unusedList, ...trashList]) {
    if (!referencedSrcs.has(entrySrc(e))) continue
    findings.push({
      kind: 'index-drift', url: entrySrc(e),
      detail: 'figura como descartable en el índice pero un contenedor lo está usando',
    })
  }

  /* 2) Lo referenciado tiene que estar en `used_content`, si no desaparece del
        panel. Sacarlo de `unused` sin agregarlo acá lo volvería invisible. */
  const nextUsed: Record<string, UsedEntry> = { ...usedContent }
  for (const [key, url] of refByKey) {
    if (nextUsed[key] && srcKey(nextUsed[key].src) === srcKey(url)) continue
    const mm = mediaMeta[srcKey(url)] || mediaMeta[url] || {}
    const fileName = decodeURIComponent(srcKey(url).split('/').pop() || '')
    const isVideo = /\.(webm|mp4|mov|m4v)$/i.test(fileName) || url.includes('/video/upload/')
    findings.push({
      kind: 'index-drift', key, url,
      detail: nextUsed[key] ? 'el índice apunta a otra URL que el contenedor' : 'un contenedor lo usa pero no figura en el índice',
    })
    nextUsed[key] = {
      key,
      label: mm.label || nextUsed[key]?.label || fileName,
      section: mm.section || nextUsed[key]?.section || '',
      kind: isVideo ? 'video' : 'image',
      src: url,
      name: mm.name || fileName,
      size: mm.size ?? nextUsed[key]?.size ?? null,
      original: nextUsed[key]?.original ?? false,
      ts: mm.ts ?? nextUsed[key]?.ts,
      type: mm.type ?? nextUsed[key]?.type,
    }
  }

  /* ---- 3) Fantasmas: lo que la web muestra y no existe en ningun lado ------
     El requisito es que la web y Cloudinary coincidan. Una entrada del indice o
     una referencia de `cms_data` que apunta a bytes inexistentes rompe eso: el
     panel la cuenta como contenido real y no hay archivo detras.
     En produccion el almacenamiento ES Cloudinary, asi que una ruta `/uploads/`
     (resto de desarrollo local) no existe. En local se verifica contra el disco.
     Este bloque es la razon por la que el panel decia 102 y Cloudinary 89: el
     reconciliador solo miraba valores con `res.cloudinary.com`, asi que las
     rutas locales no se examinaban nunca. */
  const assetExists = (raw: string): boolean => {
    const clean = srcKey(raw)
    if (!clean) return false
    if (clean.includes('res.cloudinary.com')) {
      if (byUrl.has(clean)) return true
      return (byBasename.get(basenameOf(clean)) || []).length === 1
    }
    if (clean.startsWith('/uploads/')) {
      // Con Cloudinary configurado el disco local no es el almacenamiento.
      if (hasCloudinary) return false
      return existsSync(path.join(process.cwd(), 'public', clean))
    }
    // Ni URL de Cloudinary ni ruta de subida: no es un archivo.
    return false
  }

  // 3a) Referencias de `cms_data` a media inexistente. Solo valores que SON media:
  //     un texto suelto no es una referencia rota, es contenido.
  const ghostKeys: string[] = []
  for (const r of rows as { key: string; value: string }[]) {
    if (!isMediaValue(r.value)) continue
    if (fixedByKey.has(r.key)) continue // este run ya lo repara a una URL viva
    if (assetExists(r.value)) continue
    if (r.value.includes('res.cloudinary.com')) continue // ya sale como missing-cloudinary
    ghostKeys.push(r.key)
    findings.push({
      kind: 'ghost', key: r.key, url: r.value,
      detail: 'el contenedor apunta a un archivo que no existe en el almacenamiento',
    })
  }

  // 3b) Entradas del indice sin archivo detras. Son entradas de MEDIA: si su src
  //     no resuelve, no representan nada.
  const ghostEntry = (e: LooseEntry) => {
    const src = entrySrc(e)
    return !!src && !assetExists(src)
  }
  const ghostsInIndex: string[] = []
  for (const e of [...Object.values(nextUsed) as LooseEntry[], ...nextUnused, ...nextTrash]) {
    if (!ghostEntry(e)) continue
    ghostsInIndex.push(entrySrc(e))
    findings.push({
      kind: 'ghost', url: entrySrc(e),
      detail: 'figura en el indice del panel pero no hay archivo detras',
    })
  }

  const cleanUnused = nextUnused.filter((e) => !ghostEntry(e))
  const cleanTrash = nextTrash.filter((e) => !ghostEntry(e))
  const cleanUsed: Record<string, UsedEntry> = {}
  for (const [k, v] of Object.entries(nextUsed)) {
    if (ghostEntry(v as LooseEntry)) continue
    cleanUsed[k] = v
  }

  const indexChanged =
    cleanUnused.length !== unusedList.length ||
    cleanTrash.length !== trashList.length ||
    Object.keys(cleanUsed).length !== Object.keys(usedContent).length ||
    Object.entries(cleanUsed).some(([k, v]) => srcKey(usedContent[k]?.src || '') !== srcKey(v.src))

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

    if (ghostKeys.length) {
      /* Guarda de cordura: si CASI TODO diera fantasma, lo que falló es la
         lectura del almacenamiento, no los datos. Vaciar los contenedores ahí
         sería convertir un error de lectura en pérdida de contenido. */
      const totalMedia = (rows as { value: string }[]).filter((r) => isMediaValue(r.value)).length
      if (totalMedia > 0 && ghostKeys.length > totalMedia * 0.5) {
        throw new Error(
          `${ghostKeys.length}/${totalMedia} referencias darían fantasma: lectura no concluyente, se aborta`,
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
          [ghostKeys],
        )
        await client.query('COMMIT')
        applied += ghostKeys.length
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {})
        throw err
      } finally {
        client.release()
      }
    }

    if (indexChanged) {
      /* Guarda: esta reparación SACA entradas de sin-usar/papelera. Si el cálculo
         estuviera mal, el peor caso sería vaciar el índice — el mismo daño que ya
         pasó en producción. Una reparación legítima nunca vacía una colección que
         tenía contenido, así que si eso ocurre se aborta en vez de escribir. */
      const vaciaria =
        (unusedList.length > 0 && cleanUnused.length === 0 && referencedSrcs.size === 0) ||
        (Object.keys(usedContent).length > 0 && Object.keys(cleanUsed).length === 0)
      if (vaciaria) {
        throw new Error('la reparación del índice vaciaría una colección con datos: se aborta')
      }
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        for (const [k, v] of [
          ['used_content', cleanUsed] as const,
          ['unused', cleanUnused] as const,
          ['trash', cleanTrash] as const,
        ]) {
          await client.query(
            `INSERT INTO cms_state (key, value, updated_at)
             VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
             ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = CURRENT_TIMESTAMP`,
            [k, JSON.stringify(v)],
          )
        }
        await client.query('COMMIT')
        applied += findings.filter((f) => f.kind === 'index-drift').length
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {})
        throw err
      } finally {
        client.release()
      }
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

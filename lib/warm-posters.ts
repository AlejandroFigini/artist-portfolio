import 'server-only'
import type { Pool } from 'pg'
import { hasCloudinary } from '@/lib/storage'
import { optimizedMediaSrc, videoPosterSrc } from '@/lib/utils'

/* Pre-calienta las derivadas de los videos que YA estaban subidos.
 *
 * Al subir un video, `uploadBuffer` (lib/storage.ts) le pide a Cloudinary que
 * pre-genere la variante de entrega (`f_auto,q_auto`, obligatoria porque
 * Safari/iOS no reproduce webm) y el póster del primer frame. Los videos
 * anteriores a eso no las tienen: `eager` es un parámetro de la request de
 * subida, y esa request ya ocurrió — Cloudinary no vuelve a mirar el asset.
 * Resultado: la PRIMERA visita dispara la generación on-the-fly y hasta que
 * termina devuelve 404 → contenedor negro varios segundos, en móvil peor.
 *
 * Pedir cada derivada UNA vez desde acá la genera y la deja cacheada para
 * siempre, así no la paga el primer visitante. Es exactamente el mismo GET que
 * haría el navegador: no usa la API de Cloudinary ni credenciales extra.
 *
 * Corre como migración de datos (lib/db.ts), una sola vez por deploy limpio.
 */

const CONCURRENCY = 4

/** Las dos URLs que el sitio pide de cada video. */
function derivativesOf(src: string): { url: string; ranged: boolean }[] {
  return [
    // El video pesa megas y no hace falta bajarlo: con Range igual se genera.
    { url: optimizedMediaSrc(src), ranged: true },
    { url: videoPosterSrc(src), ranged: false },
  ].filter((d) => !!d.url)
}

async function warmOne(url: string, ranged: boolean): Promise<boolean> {
  try {
    const res = await fetch(url, ranged ? { headers: { Range: 'bytes=0-1' } } : undefined)
    return res.ok
  } catch {
    return false
  }
}

async function pool_(items: string[], worker: (src: string) => Promise<void>): Promise<void> {
  const queue = [...items]
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      for (let item = queue.shift(); item; item = queue.shift()) await worker(item)
    }),
  )
}

export async function warmVideoPosters(pool: Pool): Promise<void> {
  if (!hasCloudinary) return // local: los uploads van a disco, no hay derivadas

  const { rows } = await pool.query<{ value: string }>(
    "SELECT DISTINCT value FROM cms_data WHERE value LIKE '%res.cloudinary.com%/video/upload/%'",
  )
  const videos = rows.map((r) => r.value)
  if (videos.length === 0) return

  let failed = 0
  await pool_(videos, async (src) => {
    const results = await Promise.all(derivativesOf(src).map((d) => warmOne(d.url, d.ranged)))
    if (results.some((ok) => !ok)) failed++
  })

  console.log(`[warm-posters] ${videos.length - failed}/${videos.length} videos pre-calentados`)
  /* Un fallo acá NO es fatal: la derivada se generará on-the-fly en la primera
     visita, que es exactamente el comportamiento que había antes. Se tira para
     que la migración no quede marcada y se reintente en el próximo arranque. */
  if (failed > 0) throw new Error(`${failed} video(s) sin pre-calentar`)
}

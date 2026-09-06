'use client'

/* Precalentado de media que el visitante todavía no ve.

   Hay contenido que solo aparece por interacción —los decorados de los paneles
   que se abren— y contenido que vive lejos del fold. Todo eso arranca en
   `preload="none"` / `loading="lazy"` para no pelearle ancho de banda al primer
   pintado: medido, 5 instancias de DecorAnim con "metadata" bajaban 5,6 MB
   antes del primer scroll. El precio de ese diferido es que la primera vez que
   el elemento aparece el archivo todavía no existe, y el contenedor se ve
   vacío hasta que decodifica.

   Acá se mueve ese precio a la ventana muerta: DESPUÉS del evento `load`. La
   espera no es cosmética. Un pedido lanzado antes RETRASA el propio `load`, y
   el gate `windowLoad` de la pantalla de carga espera justamente a ese evento
   — precalentar mientras el loader está arriba lo retiene a sí mismo.

   Fail-open por diseño: sin `requestIdleCallback`, con ahorro de datos activo o
   si algo falla, no se precalienta nada y queda el comportamiento de siempre
   (el archivo se baja recién cuando el elemento aparece). Nunca al revés: un
   fallo acá no puede dejar contenido invisible. */

type NetworkInformation = { saveData?: boolean; effectiveType?: string }

/** ¿Vale gastar datos en algo que el visitante puede no llegar a mirar? */
export function canWarmMedia(): boolean {
  if (typeof navigator === 'undefined') return false
  const conn = (navigator as Navigator & { connection?: NetworkInformation }).connection
  // Sin la API (Safari/Firefox) se asume que sí: es el caso de escritorio.
  if (!conn) return true
  if (conn.saveData) return false
  return conn.effectiveType !== '2g' && conn.effectiveType !== 'slow-2g'
}

/** Cancela el hueco reservado, sea `requestIdleCallback` o el `setTimeout`. */
function cancelIdle(id: number) {
  if (window.cancelIdleCallback) window.cancelIdleCallback(id)
  else window.clearTimeout(id)
}

type IdleOpts = {
  /** Tope del `requestIdleCallback`: si no hay hueco, corre igual. */
  timeout?: number
  /** Espera del respaldo cuando no existe `requestIdleCallback` (Safari). */
  fallbackMs?: number
}

/** Corre `fn` una sola vez, después de `load` y en el primer hueco de idle.
 *  Devuelve el cleanup, listo para retornar desde un `useEffect`. */
export function afterLoadIdle(fn: () => void, { timeout = 3000, fallbackMs = 400 }: IdleOpts = {}): () => void {
  if (typeof window === 'undefined') return () => {}

  let idleId: number | undefined
  const schedule = () => {
    const ric = window.requestIdleCallback
    idleId = ric ? ric(() => fn(), { timeout }) : window.setTimeout(fn, fallbackMs)
  }

  if (document.readyState === 'complete') {
    schedule()
    return () => { if (idleId !== undefined) cancelIdle(idleId) }
  }
  window.addEventListener('load', schedule, { once: true })
  return () => {
    window.removeEventListener('load', schedule)
    if (idleId !== undefined) cancelIdle(idleId)
  }
}

/* Un mismo archivo alimenta varios contenedores: el desplegable de software es
   EL MISMO clip en Animations, Characters, 3D y GameDev. Si los cuatro
   precalientan a la vez, las cuatro requests salen antes de que ninguna termine
   y la caché no las puede unificar — medido: 1,28 MB bajados CUATRO veces,
   5,1 MB por un archivo.

   Con este registro la primera instancia paga la descarga y el resto espera a
   que el archivo esté en caché; recién ahí suben su propio `preload`, que sale
   del disco. La descarga va sobre un <video> suelto, no sobre un `fetch`,
   para que la request tenga exactamente la misma forma (Range) que la que hará
   después el elemento real y golpee la misma entrada de caché. */
const warmed = new Map<string, Promise<void>>()

/** Deja `url` en la caché HTTP. Una sola descarga aunque la pidan N veces. */
export function warmVideoOnce(url: string): Promise<void> {
  const running = warmed.get(url)
  if (running) return running

  const done = new Promise<void>((resolve) => {
    const probe = document.createElement('video')
    probe.muted = true
    probe.playsInline = true
    probe.preload = 'auto'
    const finish = () => {
      /* Soltar la fuente libera el decoder y el buffer del elemento suelto. La
         caché HTTP es otra cosa y no se toca: el archivo sigue ahí. */
      probe.removeAttribute('src')
      probe.load()
      resolve()
    }
    // `error` también resuelve: un fallo deja el comportamiento de siempre.
    probe.addEventListener('loadeddata', finish, { once: true })
    probe.addEventListener('error', finish, { once: true })
    probe.src = url
  })

  warmed.set(url, done)
  return done
}

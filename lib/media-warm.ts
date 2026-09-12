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

/* Precalentado ESPECULATIVO: paneles que el visitante puede no abrir nunca (el
   desplegable de software, el panel de ajustes, el menú móvil). Más estricto
   que `canWarmMedia`, que sigue rigiendo la media que el visitante SÍ va a ver
   al scrollear — bajarle el listón a esa rompería la marca `has-frame` y las
   tarjetas quedarían invisibles hasta reproducirse (ver HomeFx).
   Acá el criterio es al revés: en un teléfono son megabytes de pura
   especulación compitiendo por el mismo caño 4G que la media que el visitante
   está por mirar. El tier lo calcula el boot script antes del primer paint. */
export function canWarmSpeculative(): boolean {
  if (!canWarmMedia()) return false
  const conn = (navigator as Navigator & { connection?: NetworkInformation }).connection
  if (conn?.effectiveType === '3g') return false
  return !(window as Window & { PERF?: { lite?: boolean } }).PERF?.lite
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
    /* `canplaythrough` y `suspend` antes que `loadeddata`: lo que se quiere
       dejar en la caché es el ARCHIVO, no el primer frame. Con `loadeddata`
       la sonda se soltaba apenas decodificaba un cuadro y el resto del clip
       se bajaba después, al reproducirlo — justo la demora que esto evita.
       `suspend` es la señal de que el navegador dejó de pedir por su cuenta
       (con `preload="auto"` eso es "ya tengo todo"), y cubre a los motores
       que no emiten `canplaythrough`. `error` resuelve igual: un fallo deja
       el comportamiento de siempre, nunca cuelga la cadena. */
    const SETTLE = ['canplaythrough', 'suspend', 'error'] as const
    SETTLE.forEach((ev) => probe.addEventListener(ev, finish, { once: true }))
    probe.src = url
  })

  warmed.set(url, done)
  return done
}

/** Posición absoluta del centro del elemento en el documento. */
function docCenterY(el: Element): number {
  const r = el.getBoundingClientRect()
  return window.scrollY + r.top + r.height / 2
}

/* PRECALENTADO DE TODA LA MEDIA DIFERIDA DE LA PÁGINA.

   El sitio entero arranca en `preload="none"`: medido en producción sobre un
   teléfono de 390px, con la portada COMPLETAMENTE cargada y asentada, los 24
   <video> de contenido seguían en `readyState` 0. O sea que cada animación
   empezaba a bajarse recién al acercarse a ella, y lo que se veía durante esa
   descarga era el fondo del contenedor. Ése es el segundo de espera que se
   reporta, y es la misma causa del recuadro oscuro y del parpadeo.

   Lo que cuesta arreglarlo: medido con HEAD sobre las 19 URLs distintas de la
   portada a `w_640`, la portada entera pesa 6,57 MB de video — entre 33 KB y
   1,2 MB por archivo. Es poco, y es exactamente lo que hay que tener listo.

   Reglas de esta barrida, cada una por un fallo ya pisado:
   - DESPUÉS de `load` y en idle. Un pedido lanzado antes retrasa el propio
     evento `load`, y el gate `windowLoad` de la pantalla de carga lo espera.
   - A la CACHÉ, no a los elementos reales. Subir los 24 <video> a
     `preload="auto"` los deja a todos con decoder y buffer vivos, y iOS limita
     cuántos puede sostener a la vez: pasado el tope deja de cargar los que
     siguen. La sonda de `warmVideoOnce` baja el archivo, lo suelta y deja los
     bytes en la caché HTTP; el elemento real los levanta de disco cuando le
     toca, en milisegundos en vez de segundos.
   - DE A UNO. En paralelo las 19 descargas se pelean el mismo caño y ninguna
     termina; en serie, la primera —la que el visitante está por mirar— llega
     entera antes de que empiece la segunda.
   - POR CERCANÍA al viewport de arranque, no por orden de documento: quien
     entra por un enlace a `#animations` tiene que recibir esa sección primero.
   - Nunca con ahorro de datos ni en 2g (`canWarmMedia`). */
export function warmAllDeferredVideos(selector: string): () => void {
  if (typeof document === 'undefined') return () => {}
  let cancelled = false

  const cancelIdle = afterLoadIdle(() => {
    void (async () => {
      if (cancelled || !canWarmMedia()) return
      const anchor = window.scrollY + window.innerHeight / 2
      const urls: string[] = []
      const seen = new Set<string>()
      Array.from(document.querySelectorAll<HTMLVideoElement>(selector))
        .map((v) => ({ url: v.getAttribute('src') || '', d: Math.abs(docCenterY(v) - anchor) }))
        .filter((x) => !!x.url)
        .sort((a, b) => a.d - b.d)
        .forEach((x) => { if (!seen.has(x.url)) { seen.add(x.url); urls.push(x.url) } })

      for (const url of urls) {
        // Se re-consulta en cada vuelta: la red puede cambiar a mitad de la barrida.
        if (cancelled || !canWarmMedia()) return
        await warmVideoOnce(url)
      }
    })()
  }, { timeout: 4000, fallbackMs: 600 })

  return () => { cancelled = true; cancelIdle() }
}

/* REPRODUCIR SIN HUECO.

   `play()` sobre un <video> que todavía no decodificó un cuadro deja el
   contenedor mostrando su propio fondo hasta que el archivo llega. Con
   `preload="none"` eso es SIEMPRE: el elemento no pidió un solo byte.
   Y es justo lo que delata la asimetría que se reporta — con el ahorro de
   energía activo el autoplay se deniega, no hay `play()`, el póster se queda
   puesto y se ve el primer cuadro quieto; sin ahorro de energía sí hay
   `play()` y aparece el hueco.
   Acá la reproducción espera a tener cuadro. Devuelve su cancelador: quien
   tiene un "dejá de querer reproducir" propio (salir de cuadro, sacar el
   puntero) lo llama y el play que estaba en cola no se dispara tarde. */
export function playWhenReady(v: HTMLVideoElement): () => void {
  if (v.readyState >= 2) { void v.play().catch(() => {}); return () => {} }
  /* Sin esto el elemento nunca llega a `readyState` 2 por su cuenta:
     `preload="none"` no pide nada y `metadata` se planta en 1 (hay cabecera,
     no hay cuadro). Subirlo acá es tardío pero honesto — el que lo tenía que
     haber adelantado es el precalentado de arriba. */
  if (v.preload !== 'auto') {
    v.preload = 'auto'
    if (v.getAttribute('src') || v.querySelector('source[src]')) v.load()
  }
  let cancelled = false
  const on = () => { if (!cancelled) void v.play().catch(() => {}) }
  v.addEventListener('loadeddata', on, { once: true })
  return () => { cancelled = true; v.removeEventListener('loadeddata', on) }
}

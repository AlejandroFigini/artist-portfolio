/* Gate `media`: la pantalla de carga espera a que TODA la media de la portada
 * esté lista antes de irse.
 *
 * Hasta acá el loader tenía seis gates y ninguno miraba un <video> ni una
 * imagen de sección: cerraba con el documento cargado, y recién ahí empezaba a
 * traerse el contenido a medida que el visitante scrolleaba. De ahí la queja
 * real: llegás a Animations y la tarjeta muestra el póster quieto mientras el
 * clip todavía baja. Ahora el loader no se va hasta que cada pieza terminó.
 *
 * QUÉ CUENTA COMO "LISTA":
 * - <video> → `canplaythrough` (hay buffer para reproducir de corrido). No
 *   alcanza `loadeddata`: eso es UN frame decodificado, así que el contenedor
 *   deja de estar negro pero la reproducción igual se corta a los dos
 *   segundos, que es exactamente lo que se está tratando de eliminar.
 * - <img> → `load`.
 *
 * CADA PIEZA RESUELVE SU PARTE, BIEN O MAL. Un archivo roto cuenta igual que uno
 * cargado: no puede dejar la pantalla de carga puesta para siempre. Es la misma
 * regla que el resto de los gates (lib/loader-ready.ts) — no hay temporizador de
 * cierre en ninguna parte, cada operación cierra la suya al terminar. Y también
 * cierra el navegador que deja de bajar teniendo ya con qué seguir, que es la
 * salida sin reloj para un archivo que se queda a mitad de camino.
 *
 * `preload="none"` y `loading="lazy"` se promueven acá. Es deliberado y es lo
 * contrario de lo que hace HomeFx: allá la media se difiere para no competir
 * con el arranque, acá se pide toda junta PORQUE el arranque no termina hasta
 * tenerla. Los dos caminos conviven: cuando HomeFx corre su barrido después de
 * `load`, ya está todo en caché y no vuelve a pedir nada.
 */

import { markLoaderGate } from '@/lib/loader-ready'

/* El <video> de la propia pantalla de carga queda afuera: es el único que se
   reproduce MIENTRAS el loader está puesto, va en `preload="metadata"` a
   propósito (con `auto` retiene el evento `load` que el gate `windowLoad`
   espera) y esperarlo sería esperarse a sí mismo. */
const VIDEO_SEL = 'main video, .main-footer video'
const IMG_SEL = 'main img, .main-footer img'

/** Ahorro de datos activo: el visitante pidió explícitamente NO gastar. Se
 *  respeta y el gate se da por cumplido — la media sigue llegando diferida por
 *  el camino de siempre (HomeFx). */
function saveDataOn(): boolean {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  return !!conn?.saveData
}

export function trackLoaderMedia(): () => void {
  if (typeof document === 'undefined') return () => {}
  if (saveDataOn()) { markLoaderGate('media'); return () => {} }

  const cleanups: (() => void)[] = []
  let alive = true

  /* Denominador vivo: el motor del CMS puede pintar media después de hidratar,
     así que el total crece a medida que aparece. `markLoaderGate` nunca
     retrocede, de modo que si crece la barra se queda quieta un momento pero
     jamás miente hacia atrás. Mismo patrón que el conteo de scripts de
     `trackWindowLoad`. */
  let total = 0
  let done = 0
  const seen = new WeakSet<Element>()

  /* El gate NO puede llegar a 1 hasta que el descubrimiento esté cerrado.
     `markLoaderGate` es monótono a propósito (la barra nunca retrocede), y eso
     tiene un filo: si el primer escaneo corre antes de que exista el contenido
     —`<main>` todavía sin montar, o el motor del CMS sin pintar— el total es 0,
     la fracción da 1 y el gate queda cumplido PARA SIEMPRE. Todo lo que
     aparezca después ya no lo puede bajar.
     Medido en producción antes de este cierre: el loader se iba a los 4s con
     4 de 25 videos y 16 de 95 imágenes, y 94 seguían en `lazy`. En local no se
     veía porque hay menos contenido y llega antes.
     Hasta que se sella, se reporta como mucho 0.99: la barra avanza pero el
     loader no se puede ir. */
  let sealed = false
  const report = () => {
    if (!alive) return
    const frac = total === 0 ? 1 : done / total
    markLoaderGate('media', sealed ? frac : Math.min(frac, 0.99))
  }

  /* Sellado = el navegador terminó de cargar el documento. A esa altura están
     en el DOM tanto las secciones (las pinta el servidor) como el contenido que
     el motor del CMS aplica al hidratar, así que un último escaneo cierra la
     lista. Es un EVENTO, no un reloj. */
  const seal = () => {
    if (sealed || !alive) return
    scan()
    sealed = true
    report()
  }

  const settle = () => { done++; report() }

  /* `isReady` se re-evalúa en cada evento en vez de cerrar con el primero: hay
     eventos que solo a veces significan "listo". `suspend` es el caso: el
     navegador lo emite tanto cuando terminó de bufferear como cuando decidió
     pausar la descarga apenas empezó, así que solo cuenta con `readyState`
     suficiente. Sin esa distinción un `suspend` temprano cerraría el gate con
     el video todavía vacío, que es justo lo que este gate viene a evitar. */
  const watch = (el: Element, events: readonly string[], isReady: (ev?: string) => boolean) => {
    if (seen.has(el)) return
    seen.add(el)
    total++
    let settled = false
    const on = (e: Event) => {
      if (settled || !isReady(e.type)) return
      settled = true
      events.forEach((ev) => el.removeEventListener(ev, on))
      settle()
    }
    if (isReady()) { settled = true; settle(); return }
    events.forEach((ev) => el.addEventListener(ev, on))
    cleanups.push(() => { if (!settled) events.forEach((ev) => el.removeEventListener(ev, on)) })
  }

  const VIDEO_EVENTS = ['canplaythrough', 'error', 'abort', 'emptied', 'suspend', 'stalled'] as const
  const IMG_EVENTS = ['load', 'error'] as const

  /* Listo, por cualquiera de estos caminos, y ninguno depende de un reloj
     nuestro:
     - hay buffer para reproducir de corrido (`readyState` 4);
     - el elemento no va a cargar nunca (error, o fuente inservible);
     - el navegador dejó de bajar teniendo ya con qué seguir;
     - `stalled` con al menos un frame decodificado. Ese evento lo emite el
       navegador cuando deja de llegarle data, y es la única salida para una
       conexión que se cuelga sin cortar: sin esto, un archivo que nunca
       termina ni falla dejaría la pantalla de carga puesta para siempre. Se
       exige el frame porque con él el contenedor ya no está vacío, que es lo
       que este gate viene a garantizar; sin frame se sigue esperando. */
  const videoReady = (v: HTMLVideoElement, ev?: string) =>
    v.readyState >= 4 || !!v.error || v.networkState === 3 /* NETWORK_NO_SOURCE */
    || (v.networkState === 1 /* NETWORK_IDLE */ && v.readyState >= 3)
    || (ev === 'stalled' && v.readyState >= 2)

  const scan = () => {
    if (!alive) return

    document.querySelectorAll<HTMLVideoElement>(VIDEO_SEL).forEach((v) => {
      // Sin fuente no hay nada que esperar; el contenedor vacío ya se ve solo.
      if (!v.getAttribute('src') && !v.querySelector('source[src]')) return
      /* `preload` primero y `load()` después: asignar el atributo por sí solo no
         reinicia una carga que ya se descartó con `preload="none"`. */
      if (v.preload !== 'auto') v.preload = 'auto'
      watch(v, VIDEO_EVENTS, (ev) => videoReady(v, ev))
      // HAVE_ENOUGH_DATA ya alcanzado → `watch` cerró; si no, se pide la carga.
      if (v.readyState < 4 && v.networkState !== 2 /* NETWORK_LOADING */) {
        try { v.load() } catch {}
      }
    })

    document.querySelectorAll<HTMLImageElement>(IMG_SEL).forEach((img) => {
      if (!img.getAttribute('src') && !img.getAttribute('srcset')) return
      // `lazy` no baja nada mientras el overlay del loader tapa la página.
      if (img.loading === 'lazy') img.loading = 'eager'
      /* `complete` es ESTADO y se puede consultar al montar: una imagen que
         pintó el servidor puede haber terminado antes de que esto corra, y su
         `load` no vuelve. No se mira `naturalWidth` — vale 0 de forma
         transitoria mientras el navegador reevalúa el candidato del srcSet, y
         tratarlo como fallo es un bug ya pisado en este proyecto. */
      watch(img, IMG_EVENTS, () => img.complete)
    })

    report()
  }

  scan()

  /* Media que aparece después: secciones que hidratan tarde y todo lo que
     escribe el motor del CMS. Microtask y no rAF — rAF no se agenda en una
     pestaña de fondo y el gate quedaría colgado. */
  let queued = false
  const mo = new MutationObserver((records) => {
    if (queued) return
    if (!records.some((r) => r.addedNodes.length > 0)) return
    queued = true
    queueMicrotask(() => { queued = false; scan() })
  })
  mo.observe(document.body, { childList: true, subtree: true })

  if (document.readyState === 'complete') queueMicrotask(seal)
  else window.addEventListener('load', seal, { once: true })

  return () => {
    alive = false
    window.removeEventListener('load', seal)
    mo.disconnect()
    cleanups.forEach((fn) => fn())
  }
}

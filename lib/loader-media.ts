/* Gate `media`: la pantalla de carga espera a la media del PRIMER VIEWPORT.
 *
 * Historia corta, porque la primera versión de este archivo se equivocó de
 * población y hay que no repetirlo.
 *
 * v1 bloqueaba con TODA la media de la portada y, para conseguirla, promovía
 * cada <video> a `preload="auto"` y cada <img> a `loading="eager"`. Medido en
 * producción con arranque en frío: 10,7 MB descargados antes de que el telón se
 * levantara, 7,1 MB de ellos video. En fibra eran 3-7 s; en 4G, decenas. Y aun
 * así la página seguía cargando después, porque el barrido solo miraba
 * `<img>`/`<video>` dentro de `main`: los 118 fondos CSS, los pósters y lo que
 * vive fuera de `main` no los esperaba nadie.
 *
 * Las dos quejas eran el mismo error: el gate apuntaba a la población
 * equivocada. El visitante ve UN viewport cuando se levanta el telón. Esperar
 * media que está 8000 px más abajo es tiempo que paga por algo que todavía no
 * mira, y encima le quita ancho de banda a lo que sí está mirando.
 *
 * Entonces:
 * - BLOQUEA lo que está en el primer viewport (con un 20% de margen). Nada más.
 * - PROMUEVE solo eso. Lo de abajo conserva su `preload="none"` y su
 *   `loading="lazy"`, que están puestos a propósito (ver HeroMediaCarousel y
 *   app/(site)/page.tsx) y los levanta HomeFx un viewport antes de que el
 *   visitante llegue.
 * - Cubre las tres formas en que esta página pinta media, no solo una: el
 *   elemento (<img>/<video>), el `poster` de un <video> —que es lo que se ve
 *   mientras el clip no decodifica— y el `background-image` en estilo inline,
 *   que es como se pintan la portada, las burbujas y los personajes.
 *
 * QUÉ CUENTA COMO "LISTA": el primer frame decodificado (`readyState >= 2`).
 * No es un número elegido acá: es exactamente el umbral con el que
 * components/ui/ViewportGate marca `has-frame`, o sea el punto en que este
 * sitio considera que un <video> muestra contenido en vez de un rectángulo
 * negro. Pedir `canplaythrough` (readyState 4) obliga a bajar el clip entero, y
 * eso era el grueso de los 7,1 MB.
 *
 * NADA PUEDE COLGAR EL TELÓN, y sin un solo temporizador nuestro: un archivo
 * roto cierra por `error`, una fuente inservible por `networkState`, y una
 * conexión que se cuelga sin cortar por `stalled`. Es la misma regla que el
 * resto de los gates (lib/loader-ready.ts).
 */

import { markLoaderGate } from '@/lib/loader-ready'
import { canWarmMedia } from '@/lib/media-warm'

/* Un 20% más que el alto de la ventana: lo que asoma apenas se levanta el telón
   cuenta como primer viewport. Más que eso ya es scroll, y de eso se encarga
   HomeFx con su propio margen de un viewport entero. */
const FIRST_VIEW_RATIO = 1.2

/* El <video> de la propia pantalla de carga queda afuera: va en
   `preload="metadata"` a propósito (con `auto` retiene el evento `load`, que es
   lo que espera el gate `windowLoad`) y esperarlo sería esperarse a sí mismo. */
const VIDEO_SEL = 'video:not(.loader-gallop)'
const IMG_SEL = 'img'
/* Los fondos de contenido de este sitio se escriben SIEMPRE como estilo inline
   —engine.ts, Slideshow, CharactersShowcase—; en las hojas de estilo no hay un
   solo `url()` de media. Así que alcanza con un selector, y no hace falta
   barrer `getComputedStyle` sobre el documento entero. */
const BG_SEL = '[style*="background-image"]'

/** URL real de un `background-image`, ignorando degradados y data URIs. */
function bgUrlOf(el: HTMLElement): string {
  const raw = el.style.backgroundImage
  if (!raw || raw === 'none') return ''
  const m = raw.match(/url\(["']?(?!data:)([^"')]+)["']?\)/)
  return m ? m[1] : ''
}

export function trackLoaderMedia(): () => void {
  if (typeof document === 'undefined') return () => {}
  /* Con ahorro de datos o en 2g el gate se da por cumplido: el telón se levanta
     rápido y el contenido entra por detrás. Es la contrapartida aceptada — mejor
     eso que retener un teléfono lento un minuto. Se usa el mismo predicado que
     el resto del sitio para que no se separen. */
  if (!canWarmMedia()) { markLoaderGate('media'); return () => {} }

  const cleanups: (() => void)[] = []
  let alive = true
  let total = 0
  let done = 0
  const seen = new WeakSet<Element>()
  const seenUrls = new Set<string>()

  /* El gate NO puede llegar a 1 hasta que el descubrimiento esté cerrado.
     `markLoaderGate` es monótono a propósito (la barra nunca retrocede) y eso
     tiene un filo: si el primer escaneo corre antes de que exista el contenido,
     el total da 0, la fracción da 1 y el gate queda cumplido PARA SIEMPRE.
     Medido: con ese agujero el telón se levantaba a los 4 s con 4 de 25 videos
     listos. Hasta sellar se reporta como mucho 0.99. */
  let sealed = false
  const report = () => {
    if (!alive) return
    const frac = total === 0 ? 1 : done / total
    markLoaderGate('media', sealed ? frac : Math.min(frac, 0.99))
  }
  const settle = () => { done++; report() }

  /** ¿Está en el primer viewport? Sin layout todavía (rect en cero) se
   *  considera que NO: equivocarse hacia afuera lo cubre HomeFx un rato
   *  después, equivocarse hacia adentro retiene el telón. */
  const inFirstView = (el: Element): boolean => {
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) return false
    return r.top < window.innerHeight * FIRST_VIEW_RATIO && r.bottom > 0
  }

  /* `isReady` se re-evalúa en CADA evento en vez de cerrar con el primero: hay
     eventos que solo a veces significan "listo" (`suspend` lo emite el
     navegador tanto al terminar de bufferear como al pausar la descarga apenas
     empezó). */
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

  /** Espera una URL suelta (póster o fondo CSS), que no tiene elemento con
   *  eventos propios. La <img> no agrega bytes: es la misma URL que ya está
   *  pidiendo el elemento, así que sale de la caché. */
  const watchUrl = (url: string) => {
    if (!url || seenUrls.has(url)) return
    seenUrls.add(url)
    total++
    const img = new Image()
    let settled = false
    const finish = () => { if (!settled) { settled = true; settle() } }
    img.onload = finish
    img.onerror = finish
    img.src = url
    /* `complete` es ESTADO y se consulta al montar: la imagen puede haber
       terminado antes y su `load` no vuelve. NO se mira `naturalWidth`: vale 0
       de forma transitoria mientras el navegador reevalúa el candidato del
       srcSet, y tratarlo como fallo es un bug ya pisado en este proyecto. */
    if (img.complete) finish()
  }

  /* `loadeddata` es imprescindible en esta lista: es el único evento que se
     emite AL LLEGAR a readyState 2, que es el umbral que espera el gate. Sin
     él, bajar el umbral no cambia nada — el elemento llega a tener frame y
     nadie se entera hasta `canplaythrough`. */
  const VIDEO_EVENTS = ['loadeddata', 'canplay', 'canplaythrough', 'error', 'abort', 'emptied', 'suspend', 'stalled'] as const
  const IMG_EVENTS = ['load', 'error'] as const

  /* Listo por cualquiera de estos caminos, ninguno con reloj propio:
     - hay un frame decodificado (el mismo umbral que `has-frame`);
     - el elemento no va a cargar nunca (error, o fuente inservible);
     - `stalled`: el navegador avisa que dejó de llegarle data. Es la única
       salida para una conexión que se cuelga sin cortar. */
  const videoReady = (v: HTMLVideoElement, ev?: string) =>
    v.readyState >= 2 || !!v.error || v.networkState === 3 /* NETWORK_NO_SOURCE */
    || ev === 'stalled'

  const scan = () => {
    if (!alive) return

    document.querySelectorAll<HTMLVideoElement>(VIDEO_SEL).forEach((v) => {
      if (seen.has(v)) return
      if (!v.getAttribute('src') && !v.querySelector('source[src]')) return
      if (!inFirstView(v)) return
      /* Promoción SOLO de lo que se bloquea. `auto` y no `metadata`: con
         `metadata` el readyState se queda en 1 —hay cabecera pero no frame— y
         ninguna de las salidas de `videoReady` cubre ese estado, así que el
         telón no se levantaría nunca. No se revierte al cerrar: son los pocos
         que están EN PANTALLA, y ahí `auto` es lo correcto. */
      if (v.preload !== 'auto') v.preload = 'auto'
      watch(v, VIDEO_EVENTS, (ev) => videoReady(v, ev))
      if (v.readyState < 2 && v.networkState !== 2 /* NETWORK_LOADING */) {
        try { v.load() } catch {}
      }
      // El póster es lo que se ve mientras el clip no decodifica.
      watchUrl(v.getAttribute('poster') || '')
    })

    document.querySelectorAll<HTMLImageElement>(IMG_SEL).forEach((img) => {
      if (seen.has(img)) return
      if (!img.getAttribute('src') && !img.getAttribute('srcset')) return
      if (!inFirstView(img)) return
      // `lazy` no baja nada mientras el overlay del loader tapa la página.
      if (img.loading === 'lazy') img.loading = 'eager'
      watch(img, IMG_EVENTS, () => img.complete)
    })

    document.querySelectorAll<HTMLElement>(BG_SEL).forEach((el) => {
      if (!inFirstView(el)) return
      watchUrl(bgUrlOf(el))
    })

    report()
  }

  scan()

  /* Media que aparece o cambia después: secciones que hidratan tarde, y el
     motor del CMS, que escribe `src`/`style` como ATRIBUTO (no agrega nodos).
     Sin `attributes` esas piezas dependían de que el escaneo final del sellado
     cayera después del motor — funcionaba por suerte, no por diseño.
     Microtask y no rAF: rAF no se agenda en una pestaña de fondo y el gate
     quedaría colgado. */
  let queued = false
  const mo = new MutationObserver(() => {
    if (queued) return
    queued = true
    queueMicrotask(() => { queued = false; scan() })
  })
  mo.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'srcset', 'poster', 'style'],
  })

  /* Sellado con el evento `load`: a esa altura están en el DOM las secciones
     (las pinta el servidor) y lo que el motor aplica al hidratar, así que un
     último escaneo cierra la lista. Ya no es circular como en v1: ahora solo se
     promueve el primer viewport, así que este gate no retiene `load` con
     decenas de descargas propias. */
  const seal = () => {
    if (sealed || !alive) return
    scan()
    sealed = true
    report()
  }
  if (document.readyState === 'complete') queueMicrotask(seal)
  else window.addEventListener('load', seal, { once: true })

  return () => {
    alive = false
    window.removeEventListener('load', seal)
    mo.disconnect()
    cleanups.forEach((fn) => fn())
  }
}

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

  /* POBLACIÓN CONGELADA. Es la parte más delicada del archivo y ya falló de las
     dos maneras posibles:
     - Si se marca ANTES de que exista el contenido, el total da 0, la fracción
       da 1 y `markLoaderGate` —que es monótono— deja el gate cumplido PARA
       SIEMPRE. Medido: el telón se iba a los 4 s con 4 de 25 videos listos.
     - Si la población nunca deja de crecer, la fracción nunca llega a 1 y la
       barra se clava justo por debajo del 100%. Medido en producción: 99%
       eterno. La causa era la cinta de burbujas: se mueve escribiendo `style`,
       el observador escuchaba `style`, y en cada rescan entraban burbujas
       nuevas al primer viewport. Denominador infinito.
     La salida es la misma para las dos: la lista se cierra de una vez, en el
     primer escaneo que encuentra algo, y no se vuelve a tocar. Antes de cerrar
     no se marca nada; después, la fracción es honesta y termina. */
  let frozen = false
  const report = () => {
    if (!alive) return
    /* Antes de congelar NO se marca nada. El tope de 0.99 que había acá era
       peor: si la población nunca terminaba de cerrarse, la barra se quedaba
       clavada justo por debajo del 100% para siempre. Con la población fija,
       la fracción es honesta y termina. */
    if (!frozen) return
    markLoaderGate('media', total === 0 ? 1 : done / total)
  }
  const settle = () => { done++; report() }

  /** ¿Está en el primer viewport? Sin layout todavía (rect en cero) se
   *  considera que NO: equivocarse hacia afuera lo cubre HomeFx un rato
   *  después, equivocarse hacia adentro retiene el telón. */
  const inFirstView = (el: Element): boolean => {
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) return false
    /* También los costados: las slides del carrusel y las burbujas de la cinta
       están a la ALTURA correcta pero corridas a la derecha. Contarlas era
       esperar cosas que nadie ve. */
    return r.top < window.innerHeight * FIRST_VIEW_RATIO && r.bottom > 0
      && r.left < window.innerWidth && r.right > 0
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

  const IMG_EVENTS = ['load', 'error'] as const

  const scan = () => {
    if (!alive || frozen) return

    /* De un <video> se espera el PÓSTER, nunca el frame.
       Que el elemento decodifique lo decide el navegador, no la página: iOS
       Safari ignora `preload="auto"` y no baja nada hasta que el clip se
       reproduce —y en modo bajo consumo no se reproduce—; un componente que
       remonta su <video> (DecorAnim, `key={current}`) deja desconectado el que
       se estaba mirando. En los dos casos `readyState` se queda en 0 sin
       `error` ni `stalled`, porque no hay descarga en curso que pueda
       atascarse. Esperarlo era el 98% eterno.
       Lo que el visitante ve mientras el clip no decodifica es el póster, y un
       póster es una imagen: termina siempre, bien o mal. Sin póster (media que
       no vino de Cloudinary) no se espera nada: la regla `has-frame` ya deja
       ver el fondo del contenedor, nunca un rectángulo negro.
       Tampoco se promueve el `preload`: con `auto` el video retiene el evento
       `load`, y eso tomaba de rehén al gate `windowLoad`. */
    document.querySelectorAll<HTMLVideoElement>(VIDEO_SEL).forEach((v) => {
      if (seen.has(v)) return
      seen.add(v)
      if (!inFirstView(v)) return
      watchUrl(v.getAttribute('poster') || '')
    })

    document.querySelectorAll<HTMLImageElement>(IMG_SEL).forEach((img) => {
      if (seen.has(img)) return
      if (!img.getAttribute('src') && !img.getAttribute('srcset')) return
      if (!inFirstView(img)) return
      // `lazy` no baja nada mientras el overlay del loader tapa la página.
      if (img.loading === 'lazy') img.loading = 'eager'
      /* `error` cierra por sí mismo, sin depender de que `complete` pase a true:
         el navegador lo hace, pero atar el cierre de un archivo roto a un
         efecto secundario de otra propiedad es justo el tipo de detalle que
         deja un telón puesto. */
      watch(img, IMG_EVENTS, (ev) => ev === 'error' || img.complete)
    })

    document.querySelectorAll<HTMLElement>(BG_SEL).forEach((el) => {
      if (!inFirstView(el)) return
      watchUrl(bgUrlOf(el))
    })

    /* El primer escaneo que encuentra algo CIERRA la lista. La media del primer
       viewport la pinta el servidor, así que ya está en el DOM cuando corre
       esto; lo que aparezca después es contenido que se mueve (cintas,
       carruseles) o que está más abajo, y de eso se encarga HomeFx. */
    if (total > 0) { frozen = true; report() }
  }

  scan()

  /* Solo hasta que la lista se cierra, y solo por `childList`. NUNCA por
     `style`: ése es el canal de las animaciones —GSAP y las cintas escriben
     estilo en cada frame— y escucharlo era lo que hacía crecer el denominador
     sin fin. `src`/`poster` tampoco hacen falta: lo que el motor del CMS
     rellena tarde está mayormente fuera del primer viewport, y meterlo no vale
     el riesgo de volver a abrir la lista.
     Microtask y no rAF: rAF no se agenda en una pestaña de fondo. */
  let queued = false
  const mo = new MutationObserver(() => {
    if (queued || frozen) return
    queued = true
    queueMicrotask(() => { queued = false; scan(); if (frozen) mo.disconnect() })
  })
  mo.observe(document.body, { childList: true, subtree: true })
  if (frozen) mo.disconnect()

  /* RED FINAL: `load` libera el gate, esté la lista cerrada o no.
     Después de `load` el navegador terminó con todo lo que iba a pedir por su
     cuenta. Lo que siga pendiente es algo que decidió NO bajar —lazy, fuera de
     cuadro, video que no precarga— y esperarlo es esperar algo que puede no
     pasar nunca. La versión anterior hacía `if (frozen) return` acá, así que
     una lista ya cerrada con un elemento colgado quedaba sin rescate: la barra
     se clavaba en 98-99%. Es un evento del navegador, no un reloj. */
  const seal = () => {
    if (!alive) return
    frozen = true
    mo.disconnect()
    markLoaderGate('media')
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

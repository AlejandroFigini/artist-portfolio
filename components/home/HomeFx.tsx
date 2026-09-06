'use client'

/* Efectos globales del index — render null. Porta de script.js:
   - Observer principal de reveals (.visible) + typewriter de títulos
   - section-inactive: pausa animaciones CSS de secciones fuera de viewport
   - Motor de autoplay de videos (obs/decor/about) + pausa de .anim-video
   Todo respeta prefers-reduced-motion. */

import { useEffect } from 'react'
import { whenLoaderDone } from '@/lib/loader-ready'
import { afterLoadIdle, canWarmMedia } from '@/lib/media-warm'

const REVEAL_SELECTOR = [
  '.fade-in', '.presentation-container', '.section-title', '.animations-grid',
  '.cd-showcase', '.model-row', '.bio-content', '.media-stack', '.model-text',
  '.model-visual-wrapper', '.model-visual-grid-wrapper',
].join(', ')

const TYPEWRITER_SPEED = 0.1

// Port de htmlToLetterSpans (script.js): texto → spans .letter por carácter
function htmlToLetterSpans(htmlStr: string): Node[] {
  const tmp = document.createElement('div')
  tmp.innerHTML = htmlStr
  const out: Node[] = []
  tmp.childNodes.forEach((node) => {
    if (node.nodeType === 3) {
      for (const ch of node.textContent || '') {
        const s = document.createElement('span')
        s.className = 'letter'
        s.innerHTML = ch === ' ' ? '&nbsp;' : ch
        out.push(s)
      }
    } else if (node.nodeType === 1) {
      const el = node as HTMLElement
      if (el.tagName === 'BR') {
        out.push(document.createElement('br'))
      } else {
        const wrap = document.createElement(el.tagName)
        wrap.className = el.className
        for (const ch of el.textContent || '') {
          const s = document.createElement('span')
          s.className = 'letter'
          s.innerHTML = ch === ' ' ? '&nbsp;' : ch
          wrap.appendChild(s)
        }
        out.push(wrap)
      }
    }
  })
  return out
}

function typewrite(el: HTMLElement, htmlStr: string, speedFactor = TYPEWRITER_SPEED) {
  el.innerHTML = ''
  htmlToLetterSpans(htmlStr).forEach((n) => el.appendChild(n))
  let d = 0
  el.querySelectorAll<HTMLElement>('.letter').forEach((letter) => {
    letter.style.animation = `fadeLetter 0.6s ${d * speedFactor}s forwards cubic-bezier(0.2,0.8,0.2,1)`
    d++
  })
}

// Corta toda coreografía de entrada: marca todo visible y completa los
// typewriters. Lo usa el toggle "Pausar animaciones" (SettingsPanel).
export function revealAllNow() {
  document.querySelectorAll(REVEAL_SELECTOR).forEach((el) => el.classList.add('visible'))
  document.querySelectorAll<HTMLElement>('.section-typewriter').forEach((t) => {
    if (t.dataset.text) t.innerHTML = t.dataset.text
    t.classList.add('visible')
    t.dataset.animated = 'true'
  })
}

const motionOff = () => document.documentElement.classList.contains('motion-off')

export default function HomeFx() {
  /* Precalentado de las secciones code-split (next/dynamic en page.tsx): se
     bajan sus chunks antes de que el visitante scrollee, así hidratan en vez de
     montar tarde sobre el sitio ya visible.

     DESPUÉS del evento `load`, no antes. Un <script> insertado en el documento
     mientras la carga sigue en curso —y así es como el bundler trae un chunk
     dinámico— RETRASA el propio evento `load`. Y el gate `windowLoad` de la
     pantalla de carga espera justamente a ese evento. Precalentar en idle
     mientras el loader estaba arriba se retenía a sí mismo: seis chunks de
     secciones que están abajo del fold metidos dentro de la espera, que en un
     teléfono son segundos con la barra clavada en el mismo punto.
     Esperar a `load` los saca de esa ventana sin perder el precalentado: el
     visitante todavía no llegó a scrollear. */
  useEffect(() => afterLoadIdle(() => {
    void Promise.all([
      import('@/components/home/AboutSection'),
      import('@/components/home/AnimationsShowcase'),
      import('@/components/home/ProjectsShowcase'),
      import('@/components/home/CharactersShowcase'),
      import('@/components/home/ModelsShowcase'),
      import('@/components/home/GameDevShowcase'),
      import('@/components/home/IllustrationsShowcase'),
    ]).catch(() => {})
  }, { timeout: 2000, fallbackMs: 200 }), [])

  // Reveals (.visible) + typewriter de section-typewriter
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const els = document.querySelectorAll(REVEAL_SELECTOR)
    const titles = document.querySelectorAll<HTMLElement>('.section-typewriter')

    // "Pausar animaciones" activo o reduced-motion → sin coreografía de
    // entrada: todo visible desde el arranque.
    if (reduced || motionOff() || !('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('visible'))
      return
    }

    // Preparar typewriter: guardar el texto y vaciar hasta que entre en viewport
    titles.forEach((title) => {
      if (!title.dataset.text) title.dataset.text = title.innerHTML
      title.innerHTML = ''
    })

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return
          const t = e.target as HTMLElement
          t.classList.add('visible')
          if (t.classList.contains('section-typewriter') && !t.dataset.animated) {
            // con "Pausar animaciones" activado mid-sesión: texto completo directo
            if (motionOff()) { t.innerHTML = t.dataset.text || ''; t.dataset.animated = 'true' }
            else {
              typewrite(t, t.dataset.text || '')
              t.dataset.animated = 'true'
            }
          }
          io.unobserve(t)
        })
      },
      { threshold: 0.1 },
    )
    /* Recién observar cuando la pantalla de carga se fue. `IntersectionObserver`
       no sabe de oclusión: un elemento tapado por el overlay del loader cuenta
       igual como visible, así que sin esto los reveals y los typewriters de lo
       que está arriba del fold se reproducen enteros detrás del telón y el
       visitante se encuentra la página quieta. Antes casi no se notaba porque
       el loader duraba un temporizador corto; ahora dura la carga real. */
    const cancelWait = whenLoaderDone(() => {
      els.forEach((el) => io.observe(el))
      titles.forEach((el) => io.observe(el))
    })
    return () => {
      cancelWait()
      io.disconnect()
      // restaurar títulos si el componente se desmonta a mitad de animación
      titles.forEach((t) => { if (t.dataset.text && !t.dataset.animated) t.innerHTML = t.dataset.text })
    }
  }, [])

  /* `section-inactive` se mudó a components/ui/ViewportGate, montado en el
     layout de (site): acá solo cubría las rutas que montan HomeFx y dejaba
     /about, /contact y /multimedia animando fuera de cuadro. */

  /* preload diferido: los <video> arrancan en preload="none" (12 en la portada
     = 12 fetches parciales de archivos de hasta 5 MB antes de que nadie los
     mire). Al acercarse al viewport se los sube de nivel.

     El destino es "auto", no "metadata". Con "metadata" el `readyState` se
     queda en 1: hay metadata pero NO frame decodificado, y la regla `has-frame`
     pide 2 — o sea que la tarjeta seguía invisible hasta que el hover la
     reproducía, que es exactamente el segundo de espera que se veía. "auto" es
     lo único que garantiza un frame antes de la interacción.
     Con ahorro de datos se queda en "metadata": el comportamiento de antes. */
  useEffect(() => {
    const vids = document.querySelectorAll<HTMLVideoElement>('video[data-preload-defer]')
    if (!vids.length || !('IntersectionObserver' in window)) return
    const target = canWarmMedia() ? 'auto' : 'metadata'
    /* Dos contenedores pueden compartir archivo (las celdas de GameDev repiten
       clip). Con "auto" eso son dos descargas COMPLETAS del mismo video si
       entran juntos en cuadro, así que solo el primero de cada fuente arranca;
       el segundo espera a que el primero tenga frame y sale de la caché. */
    const firstBySrc = new Map<string, HTMLVideoElement>()
    const pending: (() => void)[] = []
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (!e.isIntersecting) return
        const v = e.target as HTMLVideoElement
        io.unobserve(v)
        if (v.preload !== 'none') return
        const bump = () => {
          v.preload = target
          if (v.currentSrc || v.src || v.querySelector('source[src]')) v.load()
        }
        const src = v.getAttribute('src') || ''
        const first = src ? firstBySrc.get(src) : undefined
        if (!first) {
          if (src) firstBySrc.set(src, v)
          bump()
        } else if (first.readyState >= 2) {
          bump()
        } else {
          first.addEventListener('loadeddata', bump, { once: true })
          pending.push(() => first.removeEventListener('loadeddata', bump))
        }
      }),
      /* Un viewport completo de anticipación, no 300px fijos: en un teléfono
         eso es un tercio de pantalla y el video entraba en cuadro sin haber
         decodificado su primer frame todavía. */
      { rootMargin: '100% 0px' },
    )
    vids.forEach((v) => io.observe(v))
    return () => { io.disconnect(); pending.forEach((off) => off()) }
  }, [])

  /* Imágenes que viven dentro de un carrusel. Una slide desplazada fuera de
     pantalla NO está en el viewport, así que `loading="lazy"` no pide un byte
     hasta que el carrusel la trae al centro — y ahí se ve el hueco mientras
     baja. El observer no puede ir sobre la imagen (una slide corrida a la
     derecha nunca interseca): va sobre el CONTENEDOR marcado con
     `data-warm-near`, y al acercarse pasa a `eager` todo lo que tenga adentro,
     clones de embla incluidos. Cambiar `loading` de lazy a eager reanuda la
     carga diferida en el acto. */
  useEffect(() => {
    const hosts = document.querySelectorAll<HTMLElement>('[data-warm-near]')
    if (!hosts.length || !('IntersectionObserver' in window) || !canWarmMedia()) return
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (!e.isIntersecting) return
        io.unobserve(e.target)
        e.target.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach((img) => { img.loading = 'eager' })
      }),
      { rootMargin: '100% 0px' },
    )
    hosts.forEach((h) => io.observe(h))
    return () => io.disconnect()
  }, [])

  // Motor de autoplay: obs/decor/about se reproducen en viewport;
  // .anim-video (hover-play) solo se pausa al salir
  useEffect(() => {
    const playObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const vid = entry.target as HTMLVideoElement
          if (entry.isIntersecting) {
            if (vid.paused) vid.play().catch(() => {})
          } else if (!vid.paused) {
            vid.pause()
          }
        })
      },
      { threshold: 0.1 },
    )
    document.querySelectorAll('.obs-video, .decor-video, .about-video').forEach((v) => playObserver.observe(v))

    const pauseObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const vid = entry.target as HTMLVideoElement
          if (!entry.isIntersecting && !vid.paused) vid.pause()
        })
      },
      { threshold: 0 },
    )
    document.querySelectorAll('.anim-video').forEach((v) => pauseObserver.observe(v))

    /* Red de seguridad para el autoplay denegado. El observer pide `play()` una
       sola vez, al entrar en viewport; si el navegador lo rechaza (iOS en bajo
       consumo, o política de autoplay antes de cualquier interacción) la promesa
       se descarta y NADIE reintenta — el observer no vuelve a disparar sobre ese
       elemento hasta que salga y vuelva a entrar. Un video ya visible al cargar
       queda pausado para siempre y hay que tocarle el botón.
       El primer gesto del visitante, en cualquier parte de la página, habilita la
       reproducción: se aprovecha para reintentar sobre lo que esté en pantalla. */
    const retryOnGesture = () => {
      document.querySelectorAll<HTMLVideoElement>('.obs-video, .decor-video, .about-video').forEach((v) => {
        const r = v.getBoundingClientRect()
        if (v.paused && r.bottom > 0 && r.top < window.innerHeight) void v.play().catch(() => {})
      })
    }
    document.addEventListener('pointerdown', retryOnGesture, { once: true, passive: true })

    return () => {
      document.removeEventListener('pointerdown', retryOnGesture)
      playObserver.disconnect()
      pauseObserver.disconnect()
    }
  }, [])

  return null
}

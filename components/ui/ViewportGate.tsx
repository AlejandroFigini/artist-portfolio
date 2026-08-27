'use client'

/* ViewportGate — regla dura del sitio: nada corre si no se ve.

   Vive en el layout de (site), así que aplica en TODAS las rutas. Antes esto
   estaba dentro de HomeFx, que solo monta en la portada y en las cuatro
   galerías: /about, /contact y /multimedia se quedaban sin ningún freno —
   sus animaciones CSS corrían para siempre y sus videos no se pausaban nunca.

   Hace tres cosas y ninguna más:

   1. `.section-inactive` sobre las secciones fuera de cuadro. La clase la
      consume styles/legacy/style.css (`animation-play-state: paused`), así que
      congela TODA la animación CSS de esa rama del árbol.

   2. Red universal de video: pausa cualquier <video> que se va de pantalla.
      SOLO PAUSA — nunca arranca nada por su cuenta. Es deliberado: las tarjetas
      de Animations son hover-to-play y el coverflow 3D solo reproduce su slide
      activa; si esta red reprodujera lo que ve, les pisaría la lógica. Cada
      sección sigue decidiendo QUÉ reproducir; acá solo se garantiza que nada
      siga sonando fuera de cuadro, incluidas las secciones que se agreguen
      mañana sin acordarse de gatear.

   3. Pestaña oculta (`visibilitychange`). Un <video muted> en una pestaña de
      fondo NO se pausa solo: sigue decodificando. En un teléfono eso es la
      pantalla apagada o la app en segundo plano gastando batería. Se pausa todo
      lo que estuviera reproduciendo y, al volver, se reanuda únicamente lo que
      pausó este componente y sigue en cuadro. */

import { useEffect } from 'react'

const SECTION_SEL = 'main > section, .main-footer'

/* Margen de la barra: una sección que asoma se considera activa un poco antes
   de entrar, para que su animación de reveal no arranque ya empezada. */
const SECTION_MARGIN = '120px 0px'

function isOnScreen(el: Element): boolean {
  const r = el.getBoundingClientRect()
  return r.bottom > 0 && r.top < (window.innerHeight || 0) && r.width > 0 && r.height > 0
}

export default function ViewportGate() {
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return

    // ----- 1 y 2: observers, con los nodos ya vistos memorizados -------------
    const seenSections = new WeakSet<Element>()
    const seenVideos = new WeakSet<Element>()

    const sectionIo = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.target.classList.toggle('section-inactive', !e.isIntersecting)),
      { rootMargin: SECTION_MARGIN, threshold: 0 },
    )

    const videoIo = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) return
        const v = e.target as HTMLVideoElement
        if (!v.paused) v.pause()
      }),
      { threshold: 0 },
    )

    const scan = () => {
      document.querySelectorAll(SECTION_SEL).forEach((s) => {
        if (seenSections.has(s)) return
        seenSections.add(s)
        sectionIo.observe(s)
      })
      document.querySelectorAll('video').forEach((v) => {
        if (seenVideos.has(v)) return
        seenVideos.add(v)
        videoIo.observe(v)
      })
    }

    scan()

    /* Las secciones con `next/dynamic` y los <video> que pinta el motor del CMS
       aparecen después del montaje. Se re-escanea solo cuando la mutación
       agregó nodos —`childList`, nunca `attributes`: el motor reescribe `src` y
       `poster` todo el tiempo y eso no cambia QUÉ hay que observar— y como
       mucho una vez por frame. */
    let queued = 0
    const mo = new MutationObserver((records) => {
      if (queued) return
      const added = records.some((r) => r.addedNodes.length > 0)
      if (!added) return
      queued = requestAnimationFrame(() => { queued = 0; scan() })
    })
    mo.observe(document.body, { childList: true, subtree: true })

    // ----- 3: pestaña oculta -------------------------------------------------
    let pausedByGate: HTMLVideoElement[] = []
    const onVisibility = () => {
      if (document.hidden) {
        pausedByGate = [...document.querySelectorAll<HTMLVideoElement>('video')].filter((v) => !v.paused)
        pausedByGate.forEach((v) => v.pause())
        return
      }
      /* Al volver: solo lo que pausó este componente y sigue en cuadro. Un video
         que salió de pantalla mientras la pestaña estaba oculta no revive. */
      pausedByGate.forEach((v) => {
        if (v.isConnected && isOnScreen(v)) void v.play().catch(() => {})
      })
      pausedByGate = []
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      sectionIo.disconnect()
      videoIo.disconnect()
      mo.disconnect()
      if (queued) cancelAnimationFrame(queued)
      document.removeEventListener('visibilitychange', onVisibility)
      document.querySelectorAll(SECTION_SEL).forEach((s) => s.classList.remove('section-inactive'))
    }
  }, [])

  return null
}

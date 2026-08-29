'use client'

/* Hero slideshow — portado de script.js (initHeroSlideshow): crossfade
   GSAP con zoom sutil. CMS-aware: lee las slides y la duración directo del
   store (colección 'hero'), no de un evento — así no depende de si CmsRoot
   ya emitió antes de que este componente montara.
   Sin imágenes → fondo blanco (sin portadas estáticas). 1 imagen → fija,
   sin rotación. Con prefers-reduced-motion queda la primera slide fija. */

import { useEffect, useRef, useState } from 'react'
import { useCarouselSync } from '@/components/ui/useCarouselSync'
import { useMotionReady, prefersReducedMotion } from '@/hooks/useGSAP'
import { state, useCmsStore } from '@/lib/cms/store'
import { COLLECTIONS } from '@/lib/cms/collections'
import { itemKey } from '@/lib/cms/collection'
import { readSettings } from '@/lib/cms/collection'
import { DEFAULT_DURATION_MS } from '@/lib/cms/useCollection'
import { useCmsItems } from '@/lib/cms/content-context'
import { markLoaderGate } from '@/lib/loader-ready'
import { optimizedMediaSrc } from '@/lib/utils'

/* Anchos de `mediaSrcSet`. El fondo es un background-image (no acepta srcSet),
   así que elige uno a mano — pero de la MISMA escalera que usa el
   `<link rel=preload imagesrcset>` del server (app/(site)/page.tsx). Si el
   ancho no cayera en un peldaño de esa lista, el precargado y el que pide el
   div serían dos URLs distintas y la portada se bajaría dos veces. */
const BACKDROP_STEPS = [640, 828, 1200, 1920]

/* El fondo es 100vw × 100vh: pedir 1600px fijos en un teléfono era traer ~2.5×
   los píxeles necesarios.

   Solo se puede resolver en el CLIENTE, porque depende del viewport. El
   contenido de las slides ahora SÍ viaja en el HTML del servidor, así que el
   `background-image` se pinta recién después de montar: si el servidor eligiera
   un ancho a ciegas, el navegador se bajaría esa variante y despues la que
   quiere el cliente. Medido cuando pasaba: `portada-3.webp` se descargaba en
   640, 1080 Y 1920 — en un teléfono, la variante de 1920px del fondo antes de
   hidratar. El `<link rel=preload>` de app/(site)/page.tsx ya cubre la descarga
   temprana con la misma escalera de anchos, así que no se pierde nada. */
function backdropWidth(): number {
  const need = Math.ceil(window.innerWidth * Math.min(window.devicePixelRatio || 1, 2))
  return BACKDROP_STEPS.find((w) => w >= need) ?? BACKDROP_STEPS[BACKDROP_STEPS.length - 1]
}

export default function HeroSlideshow() {
  const motion = useMotionReady() // GSAP llega en su propio chunk
  const carouselRef = useRef<HTMLDivElement>(null)
  /* El fondo es `fixed` y de viewport completo, asi que nunca "sale de
     pantalla" por si solo: quien decide si se ve es el hero. Fuera de el, todas
     las secciones son opacas y lo tapan por completo. */
  const parkedRef = useRef(false)
  /* Ancho de la variante del fondo. `null` hasta montar: el servidor no puede
     saberlo y emitir un ancho a ciegas duplica la descarga (ver backdropWidth). */
  const [bgWidth, setBgWidth] = useState<number | null>(null)
  /* El efecto del crossfade publica acá su función de armado para que el
     observer de aparcado —que ya existe y es el único que mira al hero— la
     llame. Sin esto harían falta dos IntersectionObserver sobre el mismo
     elemento, o reiniciar el crossfade entero en cada entrada y salida. */
  const armRef = useRef<(() => void) | null>(null)
  useCmsStore()
  const serverReady = state.serverReady
  /* Solo las slides con imagen real. Vacío → [] → fondo blanco.
     Se lee del contexto y no de `state.items` para que el fondo del hero salga
     pintado en el HTML del servidor: leyendo del store, en SSR estaba vacío y
     el `background-image` recién aparecía después de hidratar. */
  const items = useCmsItems()
  const heroSettings = readSettings(items, 'hero')
  const slides = heroSettings.ids
    .map((id) => items[itemKey(COLLECTIONS['hero'], id)] || '')
    .filter((s) => s.trim() !== '')
  const intervalMs = heroSettings.duration ?? DEFAULT_DURATION_MS
  // Firma primitiva y estable: dos renders con el mismo contenido dan el mismo
  // string, aunque `slides` sea un array nuevo por el .map().filter() de arriba.
  const slidesKey = slides.join('|')

  // El viewport recién se conoce en el cliente.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- depende del viewport, no es derivable en el servidor
    setBgWidth(backdropWidth())
  }, [])

  /* Gate del loader: el fondo no debe descubrirse pintándose. Se precarga la
     primera slide con la MISMA URL que usa el div, así ya está en caché cuando
     el loader se va. Antes de serverReady las slides todavía no llegaron:
     marcar ahí daría el gate por cumplido de más.

     Quien cierra el gate es `onload`/`onerror`, NO `decode()`. `decode()` se
     cuelga: medido en el navegador, sobre una imagen que descarga bien devuelve
     una promesa que no resuelve ni rechaza en varios segundos. Mientras el
     contenido llegaba después de hidratar esto no se notaba, porque el efecto
     corría primero con `slides` vacío y el gate se cerraba por el camino de
     `!first`; desde que la slide viaja en el HTML del servidor, la primera
     pasada ya tiene fuente y el loader quedaba esperando esa promesa para
     siempre (barra clavada en 79% = 11/14 del peso).
     `decode()` se conserva como mejor caso —deja el bitmap listo y evita el
     salto al pintar— pero ya no es quien decide. */
  useEffect(() => {
    if (!serverReady) return
    const first = slides[0]
    if (!first) { markLoaderGate('heroBackdrop'); return }
    let alive = true
    const done = () => { if (alive) markLoaderGate('heroBackdrop') }
    const img = new Image()
    img.onload = done
    img.onerror = done
    img.src = optimizedMediaSrc(first, backdropWidth())
    // Ya estaba en caché: los eventos de carga no vuelven a emitirse.
    if (img.complete) done()
    void img.decode().then(done, done)
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- slidesKey es la firma estable de `slides`
  }, [slidesKey, serverReady])

  /* Aparcar el fondo cuando el hero no esta en pantalla: deja de ser una capa
     viva durante los ~8500px restantes de scroll. El margen del 10% lo devuelve
     antes de que el borde del hero vuelva a asomar. */
  useEffect(() => {
    const el = carouselRef.current
    const hero = document.querySelector('.hero')
    if (!el || !hero) return
    const io = new IntersectionObserver(
      ([entry]) => {
        parkedRef.current = !entry.isIntersecting
        el.classList.toggle('is-parked', parkedRef.current)
        armRef.current?.()
      },
      { rootMargin: '10% 0px' },
    )
    io.observe(hero)
    return () => { io.disconnect(); el.classList.remove('is-parked') }
  }, [])

  useEffect(() => {
    if (prefersReducedMotion()) return
    if (!motion) return
    const { gsap } = motion
    const els = document.querySelectorAll('.hero-bg-carousel .carousel-slide')
    if (els.length < 2) return

    let current = 0
    gsap.fromTo(els[0], { opacity: 0 }, { opacity: 1, duration: 2.5, ease: 'power2.out' })
    if (els.length < 2) return

    const tick = () => {
      if (typeof document !== 'undefined' && (document.body.classList.contains('contact-modal-open') || document.body.classList.contains('cms-modal-open'))) {
        return
      }
      const next = (current + 1) % els.length
      /* Solo crossfade de opacidad. El zoom lentísimo (scale 1 → 1.03) obligaba
         a re-rasterizar la slide en cada frame ahora que el desenfoque vive en
         ella (styles/legacy/style.css → .carousel-slide). Un 3% de zoom bajo
         blur(8px) y un velo blanco al 70% no se percibe; el costo sí. */
      gsap.fromTo(els[next], { opacity: 0 }, { opacity: 1, duration: 3, ease: 'power1.inOut' })
      gsap.to(els[current], { opacity: 0, duration: 3, ease: 'power1.inOut' })
      current = next
    }

    /* Aparcado = el hero no esta en pantalla. Antes el temporizador seguia
       corriendo y hacia early-return: despertaba la CPU cada `intervalMs`
       durante los ~8500px de scroll restantes sin tejer nada. Ahora se apaga
       y se vuelve a armar cuando el hero reaparece. */
    let timer: ReturnType<typeof setInterval> | undefined
    const arm = () => {
      if (parkedRef.current) {
        if (timer) { clearInterval(timer); timer = undefined }
        return
      }
      if (!timer) timer = setInterval(tick, intervalMs)
    }
    armRef.current = arm
    arm()

    return () => {
      armRef.current = null
      if (timer) clearInterval(timer)
      gsap.killTweensOf(els)
    }
  }, [motion, slidesKey, intervalMs])

  // Sync with CMS admin changes using shared hook
  useCarouselSync(undefined, slidesKey)


  return (
    <>
      <div className="hero-bg-carousel" ref={carouselRef}>
        {slides.map((src, i) => (
          <div
            key={`${i}-${src}`}
            className="carousel-slide"
            style={{
              backgroundImage: bgWidth ? `url('${optimizedMediaSrc(src, bgWidth)}')` : undefined,
              opacity: 0,
            }}
          ></div>
        ))}
        <div className="carousel-overlay"></div>
      </div>
    </>
  )
}

'use client'

import { useEffect, useReducer } from 'react'
import { ensureGSAP, gsap, prefersReducedMotion } from '@/hooks/useGSAP'
import { useCmsStore, state } from '@/lib/cms/store'

type Props = {
  prefix: string
  defaultSlides: string[]
  className?: string
  label?: string
}

const DEFAULT_DURATION_MS = 7000

// Lee las slides + duración DIRECTO de state.items (fuente de verdad tras la
// hidratación). No depende del evento `cms:${prefix}` → sin race ni eventos
// perdidos en remount/Fast-Refresh.
function readCarousel(prefix: string): { slides: string[]; duration: number } {
  let count = 3
  let duration = DEFAULT_DURATION_MS
  try {
    const s = JSON.parse(state.items[`${prefix}.settings`] || '')
    if (s && typeof s.count === 'number') count = s.count
    if (s && typeof s.duration === 'number') duration = s.duration
  } catch {}
  const slides: string[] = []
  // count puede ser 0/1 tras limpiar: respetarlo (no `|| 3`).
  const n = Number.isFinite(count) ? Math.max(0, count) : 3
  for (let i = 0; i < n; i++) slides.push(state.items[`${prefix}.slide#${i}`] || '')
  return { slides, duration }
}

export default function HeroMediaCarousel({ prefix, defaultSlides, className = 'cms-media', label = 'Carrusel de portada' }: Props) {
  useCmsStore() // re-render en cada cambio del store (hidratación, admin, etc.)
  const [, force] = useReducer((x: number) => x + 1, 0)

  // El upload actualiza state.items y dispara `cms:${prefix}` (applyMedia →
  // broadcastCarousel). Re-leemos state.items en vivo al recibirlo.
  useEffect(() => {
    const onCarousel = () => force()
    window.addEventListener(`cms:${prefix}`, onCarousel)
    return () => window.removeEventListener(`cms:${prefix}`, onCarousel)
  }, [prefix])

  const { slides, duration } = readCarousel(prefix)
  // Si todavía no hay nada en state (pre-hidratación) y se pasaron defaults, usarlos.
  const hasAny = slides.some((s) => s && s.trim() !== '')
  const panels = (hasAny || slides.length ? slides : defaultSlides)
  const finalPanels = panels.length ? panels : ['']
  const slidesKey = finalPanels.join('|')

  useEffect(() => {
    if (prefersReducedMotion()) return
    ensureGSAP()
    // TODOS los paneles entran al crossfade (imagen o contenedor vacío) -> el
    // carrusel rota entre todas las diapositivas; las vacías muestran su contenedor.
    const els = document.querySelectorAll<HTMLElement>(`.${prefix}-carousel-slide`)
    if (els.length === 0) return
    gsap.set(els, { opacity: 0 })
    gsap.set(els[0], { opacity: 1 })
    if (els.length < 2) return

    let current = 0
    const timer = setInterval(() => {
      const next = (current + 1) % els.length
      gsap.fromTo(els[next], { opacity: 0 }, { opacity: 1, duration: 1.6, ease: 'power1.inOut' })
      gsap.to(els[current], { opacity: 0, duration: 1.6, ease: 'power1.inOut' })
      current = next
    }, duration)

    return () => {
      clearInterval(timer)
      gsap.killTweensOf(els)
    }
    // slidesKey cambia cuando se sube/quita una imagen → re-arma el crossfade.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slidesKey, duration, prefix])

  return (
    <>
      {finalPanels.map((src, i) => {
        const isFilled = !!(src && src.trim() !== '')
        return (
          <div
            key={`${i}-${src || 'empty'}`}
            className={`${prefix}-carousel-slide hero-slide-panel`}
            style={{ position: 'absolute', inset: 0, opacity: i === 0 ? 1 : 0, zIndex: i === 0 ? 1 : 0 }}
          >
            {isFilled ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt=""
                className={className}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div className="hero-carousel-empty" aria-hidden="true">
                <i className="fa-solid fa-cloud-arrow-up" />
                <span>{label}</span>
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

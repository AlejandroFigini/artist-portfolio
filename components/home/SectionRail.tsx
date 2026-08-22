'use client'

/* SectionRail — riel lateral de secciones de la portada.
   Ref. visual: rail de secciones de gigabyte.com/PC-Case/GB-AC601G-GLOBAL
   (lista fija a la derecha que marca la sección en curso al scrollear).
   Acá se reinterpreta en clave blueprint: corchete de encuadre arriba,
   regla con ticks y barra de gradiente abajo, mismo violeta del nav.

   Aparece al entrar About y se va al llegar al footer. Solo desktop ancho:
   abajo de 1400px no hay margen libre y taparía contenido (ver CSS). */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useUiText } from '@/lib/cms/store'
import { scrollToElement } from '@/lib/smooth-scroll'

type RailSection = { selector: string; i18n: string; label: string }

/* Orden = orden de montaje en app/(site)/page.tsx. Se resuelve por clase
   porque las secciones bajan por next/dynamic y montan tarde. */
const SECTIONS: RailSection[] = [
  { selector: '.about-section', i18n: 'nav_about', label: 'About me' },
  { selector: '.anim-showcase', i18n: 'nav_animations', label: 'Animations' },
  { selector: '.proj-showcase', i18n: 'rail_projects', label: 'Projects' },
  { selector: '.ch-showcase', i18n: 'nav_characters', label: 'Characters' },
  { selector: '.m3d-showcase', i18n: 'nav_3d', label: '3D Models' },
  { selector: '.illu-showcase', i18n: 'nav_illustrations', label: 'Illustrations' },
]

// Fracción del viewport que define "estoy en esta sección"
const ACTIVE_LINE = 0.45
// A partir de acá el riel entra (techo de About cruzando el 40% de pantalla)
const ENTER_LINE = 0.4
// Cuánto dura en pantalla el nombre de la sección en la barra inferior
const FLASH_MS = 1000
// El footer asomando esto de pantalla saca el riel
const EXIT_LINE = 0.9

const isReduced = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
  document.documentElement.classList.contains('motion-off')

export default function SectionRail() {
  const ui = useUiText()
  const [visible, setVisible] = useState(false)
  const [active, setActive] = useState(0)
  /* En la barra inferior (móvil/tablet) no entran los labels: el nombre de la
     sección aparece al entrar en ella y se retira solo. `seq` fuerza el
     remontaje para que la animación vuelva a correr al repetir sección. */
  const [flash, setFlash] = useState<{ seq: number; i: number } | null>(null)
  const frame = useRef(0)
  const flashSeq = useRef(0)
  const lastFlashed = useRef(-1)
  const railRef = useRef<HTMLElement>(null)
  const lastProgress = useRef(-1)

  useEffect(() => {
    const measure = () => {
      const vh = window.innerHeight
      const about = document.querySelector(SECTIONS[0].selector)
      const footer = document.querySelector('.main-footer')
      if (!about) { setVisible(false); return }

      const started = about.getBoundingClientRect().top <= vh * ENTER_LINE
      const reachedFooter = footer ? footer.getBoundingClientRect().top <= vh * EXIT_LINE : false
      setVisible(started && !reachedFooter)

      // Última sección cuyo techo ya pasó la línea activa
      const tops = SECTIONS.map((s) => {
        const el = document.querySelector(s.selector)
        return el ? el.getBoundingClientRect().top : Infinity
      })
      let current = 0
      tops.forEach((top, i) => { if (top <= vh * ACTIVE_LINE) current = i })
      setActive(current)

      /* Cuánto se lleva recorrido de la sección en curso (0→1). Pinta el
         segmento que va del punto activo al siguiente, así el color avanza con
         el scroll y no a saltos de sección. */
      const line = vh * ACTIVE_LINE
      const from = tops[current]
      const to = tops[current + 1]
      const span = Number.isFinite(to) ? to - from : vh
      const within = span > 0 ? Math.min(1, Math.max(0, (line - from) / span)) : 0
      // paso de 0.5% — evita reescribir la variable en cada frame
      const quantized = Math.round(within * 200) / 200
      if (quantized !== lastProgress.current) {
        lastProgress.current = quantized
        railRef.current?.style.setProperty('--srail-frac', String(quantized))
      }
    }

    const onScroll = () => {
      if (frame.current) return
      frame.current = requestAnimationFrame(() => {
        frame.current = 0
        measure()
      })
    }

    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  useEffect(() => {
    if (!visible) { lastFlashed.current = -1; setFlash(null); return }
    if (lastFlashed.current === active) return
    lastFlashed.current = active
    flashSeq.current += 1
    setFlash({ seq: flashSeq.current, i: active })
    const t = window.setTimeout(() => setFlash(null), FLASH_MS)
    return () => clearTimeout(t)
  }, [active, visible])

  const goTo = useCallback((selector: string) => {
    const el = document.querySelector(selector)
    if (el) scrollToElement(el, isReduced())
  }, [])

  return (
    <nav
      ref={railRef}
      className={[
        'srail',
        visible ? 'srail--in' : '',
        active === SECTIONS.length - 1 ? 'srail--last' : '',
      ].filter(Boolean).join(' ')}
      /* --n = último índice: la salida usa el orden inverso de la entrada */
      style={{ '--n': SECTIONS.length - 1 } as React.CSSProperties}
      aria-label={ui('rail_sections', 'Sections')}
      aria-hidden={!visible}
    >
      {flash && (
        <span key={flash.seq} className="srail__flash" aria-hidden="true">
          {ui(SECTIONS[flash.i].i18n, SECTIONS[flash.i].label)}
        </span>
      )}
      <span className="srail__cap srail__cap--start" aria-hidden="true" />
      <ul className="srail__list">
        {SECTIONS.map((s, i) => (
          <li
            key={s.selector}
            className={[
              'srail__row',
              i < active ? 'is-past' : '',
              i === active ? 'is-active' : '',
              /* el segmento de esta fila es el que se está pintando ahora */
              i === active + 1 ? 'is-ahead' : '',
            ].filter(Boolean).join(' ')}
            style={{ '--i': i } as React.CSSProperties}
          >
            <button
              type="button"
              className="srail__item"
              onClick={() => goTo(s.selector)}
              tabIndex={visible ? 0 : -1}
              aria-current={i === active ? 'true' : undefined}
            >
              <span className="srail__label">{ui(s.i18n, s.label)}</span>
              <span className="srail__dot" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <span className="srail__cap srail__cap--end" aria-hidden="true" />
    </nav>
  )
}

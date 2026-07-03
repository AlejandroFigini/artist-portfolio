'use client'

/* Efectos globales del index — render null. Porta de script.js:
   - Observer principal de reveals (.visible) + typewriter de títulos
   - section-inactive: pausa animaciones CSS de secciones fuera de viewport
   - Motor de autoplay de videos (obs/decor/about) + pausa de .anim-video
   Todo respeta prefers-reduced-motion. */

import { useEffect } from 'react'

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
    els.forEach((el) => io.observe(el))
    titles.forEach((el) => io.observe(el))
    return () => {
      io.disconnect()
      // restaurar títulos si el componente se desmonta a mitad de animación
      titles.forEach((t) => { if (t.dataset.text && !t.dataset.animated) t.innerHTML = t.dataset.text })
    }
  }, [])

  // section-inactive: pausar animaciones CSS fuera de viewport
  useEffect(() => {
    const blocks = document.querySelectorAll('main > section, .main-footer')
    if (!blocks.length || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.target.classList.toggle('section-inactive', !e.isIntersecting)),
      { rootMargin: '120px 0px', threshold: 0 },
    )
    blocks.forEach((b) => io.observe(b))
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

    return () => {
      playObserver.disconnect()
      pauseObserver.disconnect()
    }
  }, [])

  return null
}

'use client'

/* Runtime de GSAP — el ÚNICO módulo que importa `gsap` de forma estática.

   Nadie lo importa directo: se llega por `loadGSAP()` (hooks/useGSAP), que hace
   `import()` dinámico. Así GSAP + ScrollTrigger quedan en su propio chunk
   (~149 KB crudos) en vez de viajar en el bundle inicial de cada página y
   ejecutarse antes de que la portada esté pintada.

   Todo lo que toca `gsap` vive acá; el módulo façade solo tiene helpers puros. */

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { motionOffActive } from './motion-flags'
import type { LoopHandle } from './motion-flags'

gsap.registerPlugin(ScrollTrigger)

// ----- Pausa global (toggle "Pausar animaciones") ----------------------------
// Mata toda la coreografía GSAP viva: loops de reveal (dejan el texto pleno),
// tweens en curso (saltan a estado final) y ScrollTriggers (quedan completados
// y deshabilitados → nada más "aparece" al scrollear).
const liveLoops = new Set<LoopHandle>()

export function killAllMotion() {
  liveLoops.forEach((h) => h.kill())
  liveLoops.clear()
  ScrollTrigger.getAll().forEach((st) => { try { st.animation?.progress(1); st.disable(false) } catch {} })
  gsap.globalTimeline.getChildren(true, true, false).forEach((t) => { try { t.progress(1); t.kill() } catch {} })
}

// Reactiva ScrollTriggers (los loops de reveal muertos vuelven al recargar).
export function resumeMotion() {
  ScrollTrigger.getAll().forEach((st) => { try { st.enable() } catch {} })
}

type BuildFn = (text: string) => string
type AnimFn = (targets: NodeListOf<HTMLElement>, onDone: () => void) => gsap.core.Tween

// Motor compartido de reveal en loop. Recursión con delayedCall: cada ciclo
// RE-LEE el textContent (clave: si el CMS editó el texto, el ciclo siguiente
// toma el valor nuevo en vez de revertir al original), reconstruye el HTML y
// anima los spans recién creados. Preserva .cms-tools (no rompe la edición).
function revealLoop(el: HTMLElement, intervalSec: number, build: BuildFn, animate: AnimFn): LoopHandle {
  gsap.set(el, { autoAlpha: 1 })
  /* En móvil / equipos ligeros (html.perf-lite) el reveal corre UNA sola vez —
     es la entrada del texto— y no se repite. El re-revelado perpetuo cada 8s
     se sentía forzado y, corriendo en 6 secciones a la vez, robaba el main
     thread justo cuando el scroll dispara los reveals de imágenes (se veían
     poco fluidos). En desktop se conserva el loop. */
  const runOnce = typeof document !== 'undefined' && document.documentElement.classList.contains('perf-lite')
  let killed = false
  let tween: gsap.core.Tween | null = null
  let wait: gsap.core.Tween | null = null
  let lastText = el.textContent || ''

  const detachTools = () => {
    const t = el.querySelector(':scope > .cms-tools')
    if (t) t.remove()
    return t
  }

  /* El loop arranca cuando la sección entra en cuadro y NO se apagaba nunca:
     seis secciones × título + descripción = once loops reconstruyendo su
     innerHTML en spans y animándolos cada 8s para siempre, incluidas las
     secciones que quedaron muy arriba o muy abajo. Se salta el ciclo mientras
     el elemento está fuera del viewport: no hay nada que mirar y el texto ya
     quedó pleno del ciclo anterior. */
  const onScreen = () => {
    const r = el.getBoundingClientRect()
    return r.bottom > 0 && r.top < (window.innerHeight || 0) && r.width > 0
  }

  const cycle = () => {
    /* `killed` se asignaba en kill() pero no se consultaba en ningún lado: un
       callback que cayera justo después de kill() reprogramaba el ciclo y el
       loop revivía. Se comprueba acá y en el callback de animate. */
    if (killed) return
    // pausa global o modal abierto mid-loop → dejar el texto pleno y no re-animar
    const modalOpen = typeof document !== 'undefined' && (document.body.classList.contains('contact-modal-open') || document.body.classList.contains('cms-modal-open'))
    if (motionOffActive() || modalOpen || !onScreen()) { wait = gsap.delayedCall(intervalSec, cycle); return }
    const tools = detachTools()
    const text = el.textContent || ''
    lastText = text
    if (!text.trim()) {
      if (tools) el.appendChild(tools)
      wait = gsap.delayedCall(intervalSec, cycle)
      return
    }
    el.innerHTML = build(text)
    const targets = el.querySelectorAll<HTMLElement>('.tw-char, .tw-word')
    tween = animate(targets, () => {
      if (killed) return
      el.textContent = text
      if (tools) el.appendChild(tools)
      if (runOnce) { liveLoops.delete(handle); return } // móvil: una sola pasada, sin re-loop
      wait = gsap.delayedCall(intervalSec, cycle)
    })
  }
  cycle()

  const handle: LoopHandle = {
    kill: () => {
      killed = true
      tween?.kill()
      wait?.kill()
      const tools = detachTools()
      el.textContent = lastText
      if (tools) el.appendChild(tools)
      liveLoops.delete(handle)
    },
  }
  liveLoops.add(handle)
  return handle
}

/* El texto sale de `el.textContent` (sin escapar) y vuelve a entrar por
   `innerHTML` en cada ciclo: sin esto, un `<` o un `&` escrito desde el CMS se
   re-parsearía como markup en el reveal siguiente. */
const HTML_ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' }
const escapeHtml = (s: string) => s.replace(/[&<>]/g, (c) => HTML_ENTITIES[c])

// Reveal letra por letra LOOPING — para títulos de sección con repetición.
export function typewriterRevealLoop(el: HTMLElement, intervalSec = 8): LoopHandle {
  return revealLoop(
    el,
    intervalSec,
    (text) =>
      text
        .split('')
        .map((c) => `<span class="tw-char" style="display:inline-block">${c === ' ' ? '&nbsp;' : escapeHtml(c)}</span>`)
        .join(''),
    (targets, onDone) =>
      gsap.from(targets, { autoAlpha: 0, duration: 0.05, stagger: 0.06, ease: 'none', onComplete: onDone }),
  )
}

// Reveal por palabras en loop — para párrafos (más fluido que char-by-char).
export function wordRevealLoop(el: HTMLElement, intervalSec = 8): LoopHandle {
  return revealLoop(
    el,
    intervalSec,
    (text) =>
      text
        .split(/(\s+)/)
        .map((w) => (/^\s+$/.test(w) ? w : `<span class="tw-word" style="display:inline-block">${escapeHtml(w)}</span>`))
        .join(''),
    (targets, onDone) =>
      gsap.from(targets, { autoAlpha: 0, y: 8, duration: 0.4, stagger: 0.045, ease: 'power2.out', onComplete: onDone }),
  )
}

export { gsap, ScrollTrigger }

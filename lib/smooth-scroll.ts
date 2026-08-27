/* Registro del scroll suave (Lenis). La instancia la crea
   components/ui/SmoothScroll.tsx; acá vive el puntero para que cualquier
   componente pueda pedir un scroll programado sin importar la librería.

   Sin Lenis (reduced-motion, "Pausar animaciones", chunk que no llegó) el
   fallback es el scroll nativo. */

type SmoothScroller = {
  scrollTo: (target: HTMLElement | number, opts?: Record<string, unknown>) => void
  stop?: () => void
  start?: () => void
}

let scroller: SmoothScroller | null = null

export function setSmoothScroller(instance: SmoothScroller | null) {
  scroller = instance
}

/* Bloqueo del scroll de fondo mientras hay un panel abierto. Contador: los
   modales se apilan (gestor de colección → picker → subida) y el último en
   cerrarse es el que libera.

   No alcanza con `overflow: hidden` en el body: Lenis escucha la rueda sobre
   window y sigue desplazando igual, y esa regla vive en admin.css (diferido),
   así que un visitante podía scrollear detrás del modal antes de que la hoja
   llegara. Se para el scroller Y se bloquea el nativo, compensando el ancho de
   la barra para que el fondo no salte. */
let scrollLocks = 0
let prevRootOverflow = ''
let prevBodyOverflow = ''
let prevPaddingRight = ''

export function lockPageScroll() {
  if (typeof document === 'undefined') return
  if (++scrollLocks > 1) return
  scroller?.stop?.()
  const root = document.documentElement
  const { body } = document
  const gutter = window.innerWidth - root.clientWidth
  prevRootOverflow = root.style.overflow
  prevBodyOverflow = body.style.overflow
  prevPaddingRight = body.style.paddingRight
  /* Sobre el ELEMENTO RAIZ, no solo sobre el body: el `overflow` del body se
     propaga al viewport unicamente cuando el de <html> es `visible`, y la hoja
     del sitio lo deja en `clip` — asi que bloquear solo el body no frenaba la
     rueda. La barra se compensa con padding para que el fondo no salte. */
  root.style.overflow = 'hidden'
  body.style.overflow = 'hidden'
  if (gutter > 0) body.style.paddingRight = `${gutter}px`
}

export function unlockPageScroll() {
  if (typeof document === 'undefined' || scrollLocks === 0) return
  if (--scrollLocks > 0) return
  document.documentElement.style.overflow = prevRootOverflow
  document.body.style.overflow = prevBodyOverflow
  document.body.style.paddingRight = prevPaddingRight
  scroller?.start?.()
}

/** Lleva el viewport al elemento. `reduced` fuerza el salto sin animación. */
export function scrollToElement(el: Element, reduced = false) {
  if (scroller && !reduced) {
    scroller.scrollTo(el as HTMLElement)
    return
  }
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
}

/* Cuánto se espera a que aparezca una sección antes de rendirse. Las secciones
   de la portada bajan por `next/dynamic`: al llegar desde otra ruta con
   `/#characters`, el destino todavía no está en el DOM. */
const SECTION_WAIT_MS = 8000

/** Lleva el viewport a la sección `id`, esperando a que monte si hace falta. */
export function scrollToSection(id: string, reduced = false) {
  if (typeof document === 'undefined') return
  // Ya montada (el caso normal: anclar dentro de la propia portada): se ancla
  // en el acto, sin pasar por un frame de espera.
  const mounted = document.getElementById(id)
  if (mounted) { scrollToElement(mounted, reduced); return }

  const deadline = Date.now() + SECTION_WAIT_MS
  const attempt = () => {
    const el = document.getElementById(id)
    if (el) {
      // Un frame más: la sección recién montada todavía no tiene layout, y
      // medirla en el mismo tick devuelve la posición equivocada.
      requestAnimationFrame(() => scrollToElement(el, reduced))
      return
    }
    if (Date.now() > deadline) return
    requestAnimationFrame(attempt)
  }
  requestAnimationFrame(attempt)
}

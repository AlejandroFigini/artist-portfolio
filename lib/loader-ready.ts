/* Gates de la pantalla de carga.

   Antes el loader se cerraba por RELOJ: cada gate tenía su propio techo
   (4–8s) y encima había un failsafe global. En 4G lento esos techos vencían
   antes que la carga real, así que el loader se iba con el navegador todavía
   bajando la página — el síntoma que se reporta en móvil.

   Acá ya no hay ningún temporizador. Cada gate se resuelve cuando su
   operación TERMINA (bien o mal): una imagen que dispara `onerror` cierra su
   gate igual que una que carga, y un fetch que falla cierra el suyo por el
   `.finally()`. El loader se va recién cuando están todos.

   El gate más importante es `windowLoad`: es el evento del propio navegador
   que marca que terminó de bajar el documento y sus subrecursos. Sin él el
   loader no puede saber si "el navegador sigue cargando". */

/* `windowLoad` es necesario pero NO suficiente: el contenido del CMS lo
   inyecta React DESPUÉS de hidratar, y lo que se agrega después del evento
   `load` ya no lo retiene. Por eso siguen estando los gates de contenido del
   primer viewport. Las secciones de abajo del fold se precargan mientras el
   loader está arriba (HomeFx) pero no lo retienen: el visitante no las ve
   hasta scrollear. */
export type LoaderGate =
  | 'serverState'   // contenido del CMS mergeado (state.serverReady)
  | 'fonts'         // familia del hero cargada → sin FOUT ni reflow de títulos
  | 'i18n'          // traducciones traídas y aplicadas al DOM
  | 'heroBackdrop'  // primera slide del fondo decodificada
  | 'heroPanel'     // primera imagen del carrusel principal pintada
  | 'windowLoad'    // el navegador terminó de cargar el documento

/* El peso define cuánto aporta cada uno a la barra. `windowLoad` es el que
   más tarda en la vida real, así que se lleva la porción más grande. */
const WEIGHTS: Record<LoaderGate, number> = {
  serverState: 3,
  fonts: 1,
  i18n: 1,
  heroBackdrop: 3,
  heroPanel: 2,
  windowLoad: 4,
}

const GATE_IDS = Object.keys(WEIGHTS) as LoaderGate[]
const TOTAL_WEIGHT = GATE_IDS.reduce((sum, id) => sum + WEIGHTS[id], 0)

/* Fracción cumplida de cada gate (0..1). Casi todos son binarios, pero
   `windowLoad` avanza por etapas (`document.readyState`) para que la barra no
   se quede congelada varios segundos en el tramo más largo. */
const done = new Map<LoaderGate, number>()
const listeners = new Set<() => void>()
let progress = 0

function recompute() {
  const sum = GATE_IDS.reduce((acc, id) => acc + WEIGHTS[id] * (done.get(id) ?? 0), 0)
  /* Monótona por construcción: la barra nunca puede retroceder aunque una
     fuente de progreso reporte de menos. */
  const next = Math.max(progress, sum / TOTAL_WEIGHT)
  if (next === progress) return
  progress = next
  listeners.forEach((fn) => fn())
}

/** Marca un gate como listo (o parcialmente listo). Nunca retrocede. */
export function markLoaderGate(id: LoaderGate, ratio = 1) {
  const clamped = Math.min(Math.max(ratio, 0), 1)
  if ((done.get(id) ?? 0) >= clamped) return
  done.set(id, clamped)
  recompute()
}

export function subscribeLoaderGates(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

/** Progreso real 0..1 — lo que pinta la barra y lo que decide el cierre. */
export function loaderProgress(): number {
  return progress
}

/** Snapshot para SSR: en el servidor no hay gates resueltos. */
export function loaderProgressServer(): number {
  return 0
}

/* Alimenta `windowLoad`.

   Dos caminos, y hacen falta LOS DOS. El componente monta al hidratar, y en un
   teléfono lento eso puede caer después de que el evento `load` ya se disparó:
   suscribirse ahí sin mirar `readyState` deja el gate colgado para siempre —
   y ya no hay failsafe que rescate esa situación.

   Mismo patrón que components/ui/DeferredAnalytics.tsx. */
export function trackWindowLoad(): () => void {
  if (typeof document === 'undefined') return () => {}

  const settle = () => markLoaderGate('windowLoad')

  if (document.readyState === 'complete') {
    /* Ya cargó: el evento no vuelve. Se difiere a un microtask para no llamar
       a setState sincrónicamente dentro del efecto que monta. No se usa rAF:
       en una pestaña de fondo no correría y el gate quedaría colgado. */
    queueMicrotask(settle)
    return () => {}
  }

  /* Crédito parcial mientras baja: sin esto la barra se queda quieta en el
     tramo más largo de la espera y parece que se colgó. */
  const onReadyState = () => {
    if (document.readyState === 'interactive') markLoaderGate('windowLoad', 0.5)
    else if (document.readyState === 'complete') settle()
  }
  onReadyState()

  /* Vuelta desde bfcache (atrás/adelante, gesto de swipe en iOS): no hay
     documento nuevo ni evento `load`, la página YA está cargada por
     definición. Sin esto el gate no se resolvería nunca en ese camino. */
  const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) settle() }

  window.addEventListener('load', settle, { once: true })
  document.addEventListener('readystatechange', onReadyState)
  window.addEventListener('pageshow', onPageShow)
  return () => {
    window.removeEventListener('load', settle)
    document.removeEventListener('readystatechange', onReadyState)
    window.removeEventListener('pageshow', onPageShow)
  }
}

/* Espera a que el loader suelte el body para arrancar una coreografía de
   entrada. Vive acá —y no en un componente— porque ahora lo necesitan tanto la
   portada (Hero) como el observer de reveals (HomeFx): con el loader durando lo
   que dura la carga real, una animación disparada antes se reproduce entera
   detrás del telón y el visitante encuentra la página quieta. */
export function whenLoaderDone(cb: () => void): () => void {
  if (typeof document === 'undefined') return () => {}
  if (!document.body.classList.contains('loading-active')) { cb(); return () => {} }
  const mo = new MutationObserver(() => {
    if (!document.body.classList.contains('loading-active')) {
      mo.disconnect()
      cb()
    }
  })
  mo.observe(document.body, { attributes: true, attributeFilter: ['class'] })
  return () => mo.disconnect()
}

/* Gates de la pantalla de carga.

   Antes el loader solo esperaba un temporizador + el JSON del CMS: se cerraba
   con los datos en memoria pero con la página todavía sin pintar (fuentes sin
   cargar, portada del hero sin decodificar, secciones code-split sin hidratar).
   De ahí los cortes al terminar.

   Acá cada pieza crítica declara un gate. El loader se va cuando todos están
   resueltos (o cuando cada uno agota su propio techo de espera: un gate colgado
   nunca deja el sitio bloqueado). El peso define cuánto aporta a la barra. */

/* Solo entra acá lo que ocupa el primer viewport. Las secciones de abajo del
   fold se siguen precargando mientras el loader está arriba (HomeFx), pero ya
   no lo retienen: el visitante no las ve hasta scrollear, y esperarlas metía
   la descarga de tres chunks enteros adentro del LCP. */
export type LoaderGate =
  | 'serverState'   // contenido del CMS mergeado (state.serverReady)
  | 'fonts'         // document.fonts.ready → sin FOUT ni reflow de títulos
  | 'i18n'          // traducciones traídas y aplicadas al DOM
  | 'heroBackdrop'  // primera slide del fondo decodificada
  | 'heroPanel'     // primera imagen del carrusel principal pintada

type GateSpec = { weight: number; timeoutMs: number }

const GATES: Record<LoaderGate, GateSpec> = {
  serverState: { weight: 3, timeoutMs: 8000 },
  fonts: { weight: 1, timeoutMs: 4000 },
  i18n: { weight: 1, timeoutMs: 5000 },
  heroBackdrop: { weight: 3, timeoutMs: 7000 },
  heroPanel: { weight: 2, timeoutMs: 7000 },
}

const GATE_IDS = Object.keys(GATES) as LoaderGate[]
const TOTAL_WEIGHT = GATE_IDS.reduce((sum, id) => sum + GATES[id].weight, 0)

const resolved = new Set<LoaderGate>()
const listeners = new Set<() => void>()
let timers: number[] = []
let progress = 0

function recompute() {
  const done = GATE_IDS.reduce((sum, id) => (resolved.has(id) ? sum + GATES[id].weight : sum), 0)
  const next = done / TOTAL_WEIGHT
  if (next === progress) return
  progress = next
  listeners.forEach((fn) => fn())
}

/** Marca un gate como listo. Idempotente: llamarlo dos veces no hace nada. */
export function markLoaderGate(id: LoaderGate) {
  if (resolved.has(id)) return
  resolved.add(id)
  recompute()
}

/** Arranca el techo de espera de cada gate. Idempotente. */
export function startLoaderGateTimers() {
  if (timers.length || typeof window === 'undefined') return
  timers = GATE_IDS.map((id) =>
    window.setTimeout(() => markLoaderGate(id), GATES[id].timeoutMs),
  )
}

export function stopLoaderGateTimers() {
  timers.forEach((t) => clearTimeout(t))
  timers = []
}

export function subscribeLoaderGates(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

/** Progreso real 0..1 — lo que pinta la barra. */
export function loaderProgress(): number {
  return progress
}

/** Snapshot para SSR: en el servidor no hay gates resueltos. */
export function loaderProgressServer(): number {
  return 0
}

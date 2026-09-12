import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/* Precalentado de media (lib/media-warm.ts).

   Estos tests existen por lo que se MIDIÓ en producción sobre un teléfono de
   390px: con la portada completamente cargada y asentada, los 24 <video> de
   contenido seguían en `readyState` 0. Ninguno había pedido un byte. Por eso
   cada animación se hacía esperar la primera vez que se la miraba, y lo que se
   veía durante esa espera era el fondo del contenedor.

   Cada caso de acá fija una de las reglas de la barrida — todas con un fallo
   detrás, propio o documentado en CLAUDE.md:
   - nada antes del evento `load` (el gate `windowLoad` del loader lo espera);
   - un archivo se baja UNA vez aunque lo pidan N contenedores;
   - de a uno, no en paralelo;
   - primero lo más cerca del viewport de arranque;
   - nunca con ahorro de datos ni en 2g;
   - `play()` nunca antes de tener cuadro.

   El entorno de vitest es 'node': el DOM se arma a mano, chico a propósito. */

type Listener = (e: { type: string }) => void

class FakeVideo {
  muted = false
  playsInline = false
  preload = 'none'
  readyState = 0
  paused = true
  playCalls = 0
  loadCalls = 0
  attrs: Record<string, string> = {}
  listeners: Record<string, Listener[]> = {}
  rect = { top: 0, height: 100 }
  private _src = ''

  constructor(src = '', top = 0) {
    if (src) this.attrs.src = src
    this.rect.top = top
  }
  /** Asignar `src` ES la petición de red: es el gancho de "empezó a bajar". */
  set src(v: string) { this._src = v; this.attrs.src = v; probes.push(this) }
  get src() { return this._src }

  getAttribute(n: string) { return this.attrs[n] ?? null }
  removeAttribute(n: string) { delete this.attrs[n] }
  querySelector() { return null }
  getBoundingClientRect() { return { top: this.rect.top, height: this.rect.height } }
  load() { this.loadCalls++ }
  play() { this.playCalls++; this.paused = false; return Promise.resolve() }
  addEventListener(t: string, fn: Listener) { (this.listeners[t] ||= []).push(fn) }
  removeEventListener(t: string, fn: Listener) {
    this.listeners[t] = (this.listeners[t] || []).filter((f) => f !== fn)
  }
  fire(t: string) { (this.listeners[t] || []).slice().forEach((fn) => fn({ type: t })) }
}

let probes: FakeVideo[] = []
let dom: FakeVideo[] = []
let idleJobs: (() => void)[] = []
let timers: { fn: () => void; cleared: boolean }[] = []
let loadListeners: Listener[] = []

/** Deja correr la cadena de promesas de la barrida. */
const tick = async (n = 6) => { for (let i = 0; i < n; i++) await Promise.resolve() }

function installDom(opts: { readyState?: string; conn?: unknown } = {}) {
  probes = []
  dom = []
  idleJobs = []
  timers = []
  loadListeners = []
  const g = globalThis as unknown as Record<string, unknown>
  g.document = {
    readyState: opts.readyState ?? 'complete',
    createElement: () => new FakeVideo(),
    querySelectorAll: () => dom,
    addEventListener: () => {},
    removeEventListener: () => {},
  }
  g.window = {
    scrollY: 0,
    innerHeight: 800,
    requestIdleCallback: (fn: () => void) => { idleJobs.push(fn); return idleJobs.length },
    cancelIdleCallback: () => {},
    /* `setTimeout` va a su propia lista: acá lo usa SOLO el tope por archivo
       de `warmVideoOnce` (el hueco de idle lo da `requestIdleCallback`), así
       que los tests pueden vencerlo a mano sin tocar la barrida. */
    setTimeout: (fn: () => void) => { timers.push({ fn, cleared: false }); return timers.length },
    clearTimeout: (id: number) => { const t = timers[id - 1]; if (t) t.cleared = true },
    addEventListener: (t: string, fn: Listener) => { if (t === 'load') loadListeners.push(fn) },
    removeEventListener: () => {},
  }
  Object.defineProperty(globalThis, 'navigator', {
    value: { connection: opts.conn ?? { saveData: false, effectiveType: '4g' } },
    configurable: true,
    writable: true,
  })
}

/** Dispara el hueco de idle que reservó `afterLoadIdle`. */
const runIdle = () => { idleJobs.splice(0).forEach((fn) => fn()) }
/** Vence los topes por archivo que siguen vivos. */
const runTimers = () => { timers.filter((t) => !t.cleared).forEach((t) => { t.cleared = true; t.fn() }) }
const fireLoad = () => { loadListeners.splice(0).forEach((fn) => fn({ type: 'load' })) }

async function fresh() {
  vi.resetModules()
  return import('@/lib/media-warm')
}

afterEach(() => {
  const g = globalThis as unknown as Record<string, unknown>
  delete g.document
  delete g.window
})

describe('warmAllDeferredVideos', () => {
  beforeEach(() => { vi.resetModules() })

  it('no pide NADA antes del evento load', async () => {
    installDom({ readyState: 'loading' })
    dom = [new FakeVideo('/a.webm', 10)]
    const m = await fresh()
    m.warmAllDeferredVideos('video')
    runIdle()
    await tick()
    /* Un pedido lanzado antes de `load` RETRASA ese evento, y el gate
       `windowLoad` de la pantalla de carga espera justamente a él: precalentar
       con el telón puesto es retenerlo a sí mismo. */
    expect(probes).toHaveLength(0)

    fireLoad()
    runIdle()
    await tick()
    expect(probes).toHaveLength(1)
  })

  it('baja de a UNO: el segundo no arranca hasta que el primero termina', async () => {
    installDom()
    dom = [new FakeVideo('/a.webm', 0), new FakeVideo('/b.webm', 50)]
    const m = await fresh()
    m.warmAllDeferredVideos('video')
    runIdle()
    await tick()
    expect(probes).toHaveLength(1)

    probes[0].fire('canplaythrough')
    await tick()
    expect(probes).toHaveLength(2)
  })

  it('un mismo archivo en varios contenedores se baja una sola vez', async () => {
    installDom()
    // Las celdas de GameDev repiten clip: tres contenedores, un archivo.
    dom = [new FakeVideo('/x.webm', 0), new FakeVideo('/x.webm', 10), new FakeVideo('/x.webm', 20)]
    const m = await fresh()
    m.warmAllDeferredVideos('video')
    runIdle()
    await tick()
    expect(probes).toHaveLength(1)

    probes[0].fire('canplaythrough')
    await tick()
    expect(probes).toHaveLength(1)
  })

  /* Quien entra por un enlace a #animations tiene que recibir esa sección
     primero, no la portada entera en orden de documento. */
  it('empieza por lo mas cerca del viewport de arranque', async () => {
    installDom()
    dom = [new FakeVideo('/lejos.webm', 4000), new FakeVideo('/cerca.webm', 300), new FakeVideo('/medio.webm', 1500)]
    const m = await fresh()
    m.warmAllDeferredVideos('video')
    runIdle()
    await tick()
    expect(probes[0].src).toBe('/cerca.webm')

    probes[0].fire('canplaythrough')
    await tick()
    expect(probes[1].src).toBe('/medio.webm')
  })

  it('con ahorro de datos no baja nada', async () => {
    installDom({ conn: { saveData: true, effectiveType: '4g' } })
    dom = [new FakeVideo('/a.webm', 0)]
    const m = await fresh()
    m.warmAllDeferredVideos('video')
    runIdle()
    await tick()
    expect(probes).toHaveLength(0)
  })

  it('en 2g no baja nada', async () => {
    installDom({ conn: { saveData: false, effectiveType: '2g' } })
    dom = [new FakeVideo('/a.webm', 0)]
    const m = await fresh()
    m.warmAllDeferredVideos('video')
    runIdle()
    await tick()
    expect(probes).toHaveLength(0)
  })

  it('el cleanup corta la barrida a mitad de camino', async () => {
    installDom()
    dom = [new FakeVideo('/a.webm', 0), new FakeVideo('/b.webm', 10)]
    const m = await fresh()
    const stop = m.warmAllDeferredVideos('video')
    runIdle()
    await tick()
    expect(probes).toHaveLength(1)

    stop()
    probes[0].fire('canplaythrough')
    await tick()
    expect(probes).toHaveLength(1)
  })

  it('un archivo roto no traba la cola: el siguiente arranca igual', async () => {
    installDom()
    dom = [new FakeVideo('/roto.webm', 0), new FakeVideo('/b.webm', 10)]
    const m = await fresh()
    m.warmAllDeferredVideos('video')
    runIdle()
    await tick()
    probes[0].fire('error')
    await tick()
    expect(probes).toHaveLength(2)
  })

  /* Una conexión que se cuelga sin cortar no emite `canplaythrough` ni
     `suspend`. Como la barrida es SERIAL, sin tope esa sonda se lleva puesto
     todo lo que venía detrás: el resto de la portada no se precalienta nunca. */
  it('una descarga colgada no traba la cola: el tope la suelta', async () => {
    installDom()
    dom = [new FakeVideo('/colgada.webm', 0), new FakeVideo('/b.webm', 10)]
    const m = await fresh()
    m.warmAllDeferredVideos('video')
    runIdle()
    await tick()
    expect(probes).toHaveLength(1)

    // La sonda nunca emite nada. Vence el tope.
    runTimers()
    await tick()
    expect(probes).toHaveLength(2)
  })

  it('el tope se cancela cuando el archivo llega bien', async () => {
    installDom()
    dom = [new FakeVideo('/a.webm', 0)]
    const m = await fresh()
    m.warmAllDeferredVideos('video')
    runIdle()
    await tick()
    probes[0].fire('canplaythrough')
    await tick()
    // Sin cancelar, el tope volveria a resolver una promesa ya resuelta y
    // dejaria un reloj vivo por archivo durante 20s.
    expect(timers.every((t) => t.cleared)).toBe(true)
  })

  /* Lo que se quiere dejar en la caché es el ARCHIVO, no el primer cuadro.
     Soltando la sonda en `loadeddata` el resto del clip se bajaba después, al
     reproducirlo — justo la demora que esto viene a sacar. */
  it('no da por precalentado un archivo con solo el primer cuadro', async () => {
    installDom()
    dom = [new FakeVideo('/a.webm', 0), new FakeVideo('/b.webm', 10)]
    const m = await fresh()
    m.warmAllDeferredVideos('video')
    runIdle()
    await tick()
    probes[0].fire('loadeddata')
    await tick()
    expect(probes).toHaveLength(1)

    probes[0].fire('suspend')
    await tick()
    expect(probes).toHaveLength(2)
  })
})

describe('playWhenReady', () => {
  beforeEach(() => { vi.resetModules(); installDom() })

  it('con cuadro decodificado reproduce en el acto', async () => {
    const m = await fresh()
    const v = new FakeVideo('/a.webm')
    v.readyState = 2
    m.playWhenReady(v as unknown as HTMLVideoElement)
    expect(v.playCalls).toBe(1)
  })

  /* LA REGRESIÓN. `play()` sin cuadro arranca la reproducción sobre un
     elemento que no tiene nada que pintar: lo que queda a la vista durante
     toda la descarga es el fondo del contenedor. La asimetría que lo delata:
     con el ahorro de energía activo el play se deniega, el póster se queda
     puesto y se ve el primer cuadro quieto; sin ahorro de energía aparece el
     hueco. */
  it('sin cuadro NO reproduce: espera a tenerlo', async () => {
    const m = await fresh()
    const v = new FakeVideo('/a.webm')
    m.playWhenReady(v as unknown as HTMLVideoElement)
    expect(v.playCalls).toBe(0)
    // Y mientras tanto pide el archivo, que con preload="none" nadie pidió.
    expect(v.preload).toBe('auto')
    expect(v.loadCalls).toBe(1)

    v.fire('loadeddata')
    expect(v.playCalls).toBe(1)
  })

  it('cancelado, el play en cola ya no se dispara', async () => {
    const m = await fresh()
    const v = new FakeVideo('/a.webm')
    const cancel = m.playWhenReady(v as unknown as HTMLVideoElement)
    cancel()
    v.fire('loadeddata')
    /* Si no, un video que salió de cuadro mientras bajaba arranca solo detrás
       del fold — la regla del sitio es que nada corre si no se ve. */
    expect(v.playCalls).toBe(0)
  })

  it('no vuelve a pedir el archivo si ya estaba en auto', async () => {
    const m = await fresh()
    const v = new FakeVideo('/a.webm')
    v.preload = 'auto'
    m.playWhenReady(v as unknown as HTMLVideoElement)
    expect(v.loadCalls).toBe(0)
  })
})

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/* Gate `media` (lib/loader-media.ts). Estos tests existen por dos regresiones
   REALES, las dos con la pantalla de carga puesta delante del visitante:

   1. La lista se cerraba antes de que existiera el contenido: total 0 →
      fracción 1 → gate cumplido para siempre. El telón se levantaba con 4 de 25
      videos cargados.
   2. La lista no se cerraba nunca: la cinta de burbujas se mueve escribiendo
      `style`, el observador escuchaba `style`, y en cada rescan entraban
      elementos nuevos al primer viewport. Denominador infinito → 99% eterno.

   El entorno de vitest es 'node', así que el DOM se arma a mano. Es un stub
   chico a propósito: solo lo que este módulo toca. */

type Listener = (e: { type: string }) => void

class FakeEl {
  tag: string
  attrs: Record<string, string>
  rect: { top: number; bottom: number; left: number; right: number; width: number; height: number }
  listeners: Record<string, Listener[]> = {}
  complete = false
  readyState = 0
  networkState = 1
  error: unknown = null
  preload = 'none'
  loading = 'lazy'
  style: { backgroundImage: string }

  constructor(tag: string, attrs: Record<string, string> = {}, top = 0, bg = '', left = 0) {
    this.tag = tag
    this.attrs = attrs
    this.rect = { top, bottom: top + 100, left, right: left + 100, width: 100, height: 100 }
    this.style = { backgroundImage: bg }
  }
  getAttribute(n: string) { return this.attrs[n] ?? null }
  getBoundingClientRect() { return this.rect }
  querySelector() { return null }
  addEventListener(t: string, fn: Listener) { (this.listeners[t] ||= []).push(fn) }
  removeEventListener(t: string, fn: Listener) {
    this.listeners[t] = (this.listeners[t] || []).filter((f) => f !== fn)
  }
  fire(t: string) { (this.listeners[t] || []).forEach((fn) => fn({ type: t })) }
  /** Marca el elemento como listo y avisa, igual que haría el navegador. */
  becomeReady() {
    if (this.tag === 'img') { this.complete = true; this.fire('load') }
    else { this.readyState = 2; this.fire('loadeddata') }
  }
}

let els: FakeEl[] = []
let moCallbacks: (() => void)[] = []
let winListeners: Record<string, Listener[]> = {}
const images: { onload?: () => void; onerror?: () => void; complete: boolean }[] = []

function matches(el: FakeEl, sel: string): boolean {
  if (sel.startsWith('video')) return el.tag === 'video'
  if (sel === 'img') return el.tag === 'img'
  if (sel.startsWith('[style')) return !!el.style.backgroundImage
  return false
}

function installDom() {
  els = []
  moCallbacks = []
  winListeners = {}
  images.length = 0
  const g = globalThis as unknown as Record<string, unknown>
  g.document = {
    readyState: 'loading',
    body: {},
    querySelectorAll: (sel: string) => els.filter((e) => matches(e, sel)),
    addEventListener: () => {},
    removeEventListener: () => {},
  }
  g.window = {
    innerHeight: 800,
    innerWidth: 400,
    addEventListener: (t: string, fn: Listener) => { (winListeners[t] ||= []).push(fn) },
    removeEventListener: () => {},
  }
  // En Node `navigator` es solo-lectura: hay que redefinirlo.
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true, writable: true })
  g.MutationObserver = class {
    constructor(cb: () => void) { moCallbacks.push(cb) }
    observe() {}
    disconnect() {}
  }
  g.Image = class {
    onload?: () => void
    onerror?: () => void
    complete = false
    set src(_v: string) { images.push(this) }
    constructor() { images.push(this) }
  }
}

/** Resuelve todas las <Image> pendientes (pósters y fondos CSS). */
function resolveImages() {
  images.splice(0).forEach((i) => i.onload?.())
}

/** Hace fallar todas las <Image> pendientes, como un 404. */
function failImages() {
  images.splice(0).forEach((i) => i.onerror?.())
}

/* `loaderProgress()` es el progreso de TODOS los gates; `media` pesa 4 de 18.
   Con el gate cumplido y el resto sin tocar, el total vale exactamente eso. */
const MEDIA_LISTO = 4 / 18

async function fresh() {
  vi.resetModules()
  const ready = await import('@/lib/loader-ready')
  const media = await import('@/lib/loader-media')
  return { ...ready, ...media }
}

describe('gate media', () => {
  beforeEach(() => { vi.resetModules(); installDom() })
  afterEach(() => {
    const g = globalThis as unknown as Record<string, unknown>
    delete g.document; delete g.window
    delete g.MutationObserver; delete g.Image
  })

  it('llega a 1 cuando la media del primer viewport termina', async () => {
    const v = new FakeEl('video', { src: '/a.webm' }, 10)
    const i = new FakeEl('img', { src: '/b.webp' }, 20)
    els = [v, i]
    const m = await fresh()
    m.trackLoaderMedia()
    expect(m.loaderProgress()).toBeLessThan(1)
    v.becomeReady(); i.becomeReady(); resolveImages()
    expect(m.loaderProgress()).toBeCloseTo(MEDIA_LISTO, 10)
  })

  /* LA REGRESIÓN DEL 99% ETERNO. La cinta de burbujas mueve elementos dentro y
     fuera del primer viewport todo el tiempo; si cada rescan los suma, el
     denominador crece para siempre y la barra nunca cierra. */
  it('termina aunque siga apareciendo media despues de cerrar la lista', async () => {
    const v = new FakeEl('video', { src: '/a.webm' }, 10)
    els = [v]
    const m = await fresh()
    m.trackLoaderMedia()

    // La cinta arrastra 50 burbujas nuevas al primer viewport.
    for (let n = 0; n < 50; n++) els.push(new FakeEl('div', {}, 5, `url('/bubble${n}.webp')`))
    moCallbacks.forEach((cb) => cb())
    await Promise.resolve()

    // Solo termina de cargar lo que ya estaba: el gate igual tiene que cerrar.
    v.becomeReady(); resolveImages()
    expect(m.loaderProgress()).toBeCloseTo(MEDIA_LISTO, 10)
  })

  /* LA OTRA REGRESIÓN: sin contenido todavía en el DOM, el gate NO puede darse
     por cumplido — si no, el telón se levanta con la página a medio cargar. */
  it('no se da por cumplido si todavia no hay nada que esperar', async () => {
    els = []
    const m = await fresh()
    m.trackLoaderMedia()
    expect(m.loaderProgress()).toBe(0)
  })

  it('si nunca aparece media, `load` cierra el gate igual', async () => {
    els = []
    const m = await fresh()
    m.trackLoaderMedia()
    expect(m.loaderProgress()).toBe(0)
    winListeners['load']?.forEach((fn) => fn({ type: 'load' }))
    expect(m.loaderProgress()).toBeCloseTo(MEDIA_LISTO, 10)
  })

  it('no espera media que esta fuera del primer viewport', async () => {
    const cerca = new FakeEl('img', { src: '/a.webp' }, 10)
    const lejos = new FakeEl('img', { src: '/b.webp' }, 9000)
    els = [cerca, lejos]
    const m = await fresh()
    m.trackLoaderMedia()
    cerca.becomeReady(); resolveImages()
    // `lejos` no cargo nunca y el gate igual cierra: no estaba en la lista.
    expect(m.loaderProgress()).toBeCloseTo(MEDIA_LISTO, 10)
  })

  /* LA REGRESIÓN DEL 98%. Que un <video> decodifique un frame lo decide el
     NAVEGADOR, no la página: iOS Safari ignora `preload="auto"` y no baja nada
     hasta que el clip se reproduce, y en modo bajo consumo no se reproduce.
     Ese video se queda en readyState 0 sin emitir `error` ni `stalled` — no
     hay descarga en curso que pueda atascarse. Si el gate lo espera, el telón
     no se levanta nunca. Lo que se ve mientras tanto es el PÓSTER, y un póster
     es una imagen: siempre termina, bien o mal. */
  it('un video que el navegador nunca decodifica no retiene el telon', async () => {
    const v = new FakeEl('video', { src: '/a.webm', poster: '/a.jpg' }, 10)
    els = [v]
    const m = await fresh()
    m.trackLoaderMedia()
    // El video NUNCA emite nada. Solo carga su póster.
    resolveImages()
    expect(m.loaderProgress()).toBeCloseTo(MEDIA_LISTO, 10)
  })

  /* Un <video> que el componente remonta (DecorAnim usa `key={current}`) deja
     desconectado el elemento que se estaba mirando: no emite ningún evento más.
     Mismo desenlace: no puede retener el telón. */
  it('un video sin poster no se espera', async () => {
    const v = new FakeEl('video', { src: '/a.webm' }, 10)
    const i = new FakeEl('img', { src: '/b.webp' }, 20)
    els = [v, i]
    const m = await fresh()
    m.trackLoaderMedia()
    i.becomeReady()
    expect(m.loaderProgress()).toBeCloseTo(MEDIA_LISTO, 10)
  })

  /* `load` es la red final, y tiene que rescatar TAMBIÉN una lista ya cerrada.
     Después de `load` el navegador terminó con todo lo que iba a pedir por su
     cuenta; lo que siga pendiente es algo que decidió no bajar (lazy, fuera de
     cuadro), y esperarlo es esperar algo que puede no pasar nunca. */
  it('despues de load el gate se libera aunque quede algo pendiente', async () => {
    const colgada = new FakeEl('img', { src: '/nunca.webp' }, 10)
    els = [colgada]
    const m = await fresh()
    m.trackLoaderMedia()
    expect(m.loaderProgress()).toBe(0)
    winListeners['load']?.forEach((fn) => fn({ type: 'load' }))
    expect(m.loaderProgress()).toBeCloseTo(MEDIA_LISTO, 10)
  })

  /* El primer viewport también tiene bordes a los costados. Las slides del
     carrusel y las burbujas de la cinta están a la ALTURA correcta pero corridas
     a la derecha: si se cuentan, el gate espera cosas que nadie ve. */
  it('no cuenta lo que esta fuera del viewport hacia los costados', async () => {
    const visible = new FakeEl('img', { src: '/a.webp' }, 10, '', 0)
    const aLaDerecha = new FakeEl('img', { src: '/b.webp' }, 10, '', 5000)
    els = [visible, aLaDerecha]
    const m = await fresh()
    m.trackLoaderMedia()
    visible.becomeReady()
    expect(m.loaderProgress()).toBeCloseTo(MEDIA_LISTO, 10)
  })

  /* De un <video> se espera el póster, así que el caso roto que importa es el
     póster roto: un 404 tiene que cerrar su parte igual que una imagen que
     cargó, o el telón queda puesto por un archivo que no existe. */
  it('un poster roto no deja el telon puesto', async () => {
    const v = new FakeEl('video', { src: '/a.webm', poster: '/roto.jpg' }, 10)
    els = [v]
    const m = await fresh()
    m.trackLoaderMedia()
    failImages()
    expect(m.loaderProgress()).toBeCloseTo(MEDIA_LISTO, 10)
  })

  it('una imagen rota no deja el telon puesto', async () => {
    const img = new FakeEl('img', { src: '/roto.webp' }, 10)
    els = [img]
    const m = await fresh()
    m.trackLoaderMedia()
    img.fire('error')
    expect(m.loaderProgress()).toBeCloseTo(MEDIA_LISTO, 10)
  })
})

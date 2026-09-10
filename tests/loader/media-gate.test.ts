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
  rect: { top: number; bottom: number; width: number; height: number }
  listeners: Record<string, Listener[]> = {}
  complete = false
  readyState = 0
  networkState = 1
  error: unknown = null
  preload = 'none'
  loading = 'lazy'
  style: { backgroundImage: string }

  constructor(tag: string, attrs: Record<string, string> = {}, top = 0, bg = '') {
    this.tag = tag
    this.attrs = attrs
    this.rect = { top, bottom: top + 100, width: 100, height: 100 }
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

  it('un archivo roto no deja el telon puesto', async () => {
    const v = new FakeEl('video', { src: '/roto.webm' }, 10)
    els = [v]
    const m = await fresh()
    m.trackLoaderMedia()
    v.error = new Error('404')
    v.fire('error')
    resolveImages()
    expect(m.loaderProgress()).toBeCloseTo(MEDIA_LISTO, 10)
  })
})

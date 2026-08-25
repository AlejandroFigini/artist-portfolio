import { describe, it, expect, beforeEach, vi } from 'vitest'

/* Los gates viven en estado de módulo (uno por documento), así que cada test
   reimporta el módulo limpio. */
async function fresh() {
  vi.resetModules()
  return import('@/lib/loader-ready')
}

const ALL = ['serverState', 'fonts', 'i18n', 'heroBackdrop', 'heroPanel', 'windowLoad'] as const

describe('loader gates', () => {
  beforeEach(() => vi.resetModules())

  it('arranca en 0 y el snapshot de SSR también', async () => {
    const m = await fresh()
    expect(m.loaderProgress()).toBe(0)
    expect(m.loaderProgressServer()).toBe(0)
  })

  it('llega exactamente a 1 con todos los gates resueltos', async () => {
    const m = await fresh()
    ALL.forEach((id) => m.markLoaderGate(id))
    expect(m.loaderProgress()).toBe(1)
  })

  it('no llega a 1 mientras falte el gate del navegador', async () => {
    const m = await fresh()
    ALL.filter((id) => id !== 'windowLoad').forEach((id) => m.markLoaderGate(id))
    // Es la condición de la que se colgaba el bug: contenido listo pero el
    // navegador todavía bajando.
    expect(m.loaderProgress()).toBeLessThan(1)
  })

  it('reparte por peso: windowLoad es 4 de 14', async () => {
    const m = await fresh()
    m.markLoaderGate('windowLoad')
    expect(m.loaderProgress()).toBeCloseTo(4 / 14, 10)
  })

  it('acepta crédito parcial y lo completa después', async () => {
    const m = await fresh()
    m.markLoaderGate('windowLoad', 0.5)
    expect(m.loaderProgress()).toBeCloseTo(2 / 14, 10)
    m.markLoaderGate('windowLoad')
    expect(m.loaderProgress()).toBeCloseTo(4 / 14, 10)
  })

  it('es monótona: un reporte menor no hace retroceder la barra', async () => {
    const m = await fresh()
    m.markLoaderGate('windowLoad')
    m.markLoaderGate('windowLoad', 0.2)
    expect(m.loaderProgress()).toBeCloseTo(4 / 14, 10)
  })

  it('clampea el ratio fuera de rango', async () => {
    const m = await fresh()
    m.markLoaderGate('fonts', 5)
    m.markLoaderGate('i18n', -3)
    expect(m.loaderProgress()).toBeCloseTo(1 / 14, 10)
  })

  it('avisa a los suscriptores solo cuando el progreso sube', async () => {
    const m = await fresh()
    const spy = vi.fn()
    const off = m.subscribeLoaderGates(spy)
    m.markLoaderGate('fonts')
    expect(spy).toHaveBeenCalledTimes(1)
    m.markLoaderGate('fonts') // idempotente
    expect(spy).toHaveBeenCalledTimes(1)
    off()
    m.markLoaderGate('i18n')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('sin document no explota y devuelve limpiadores inertes', async () => {
    const m = await fresh()
    expect(() => m.trackWindowLoad()()).not.toThrow()
    expect(() => m.whenLoaderDone(() => {})()).not.toThrow()
  })
})

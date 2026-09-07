/* INERCIA DE ARRASTRE — cintas horizontales de rAF (galería 3D, cintas de
   Game Dev).

   Las dos cintas mueven su offset 1:1 con el dedo y al soltar se quedaban
   clavadas: el recorrido de un gesto era exactamente el largo del dedo, que en
   un teléfono son ~250px contra una cinta de varios miles. Se sentía como que
   "no se mueve". Con inercia el gesto sale con la velocidad del dedo y frena
   exponencialmente, que es lo que hace cualquier scroll táctil del sistema.

   Vive acá y no en cada cinta porque son dos implementaciones distintas del
   mismo comportamiento: la constante de frenado tiene que ser una sola. */

/** Constante de tiempo del frenado (ms). Recorrido extra ≈ velocidad × TAU. */
const TAU = 320
/** Techo de velocidad (px/ms): un salto del puntero no dispara la cinta. */
const MAX = 2.6
/** Piso (px/ms) por debajo del cual la cinta se da por detenida. */
const MIN = 0.02
/** Último movimiento más viejo que esto ⇒ el dedo estaba quieto al soltar. */
const STALE_MS = 90

/** Velocidad suavizada del arrastre en px/ms, acotada. */
export function trackFlick(prev: number, dx: number, dt: number): number {
  if (dt <= 0) return prev
  const raw = Math.max(-MAX, Math.min(MAX, dx / dt))
  return prev * 0.7 + raw * 0.3
}

/** Velocidad de salida al soltar. `age` = ms desde el último movimiento. */
export function releaseFlick(v: number, age: number): number {
  return age > STALE_MS || Math.abs(v) < MIN ? 0 : v
}

/** Frenado exponencial de un frame. Devuelve 0 al tocar el piso. */
export function decayFlick(v: number, dt: number): number {
  const next = v * Math.exp(-dt / TAU)
  return Math.abs(next) < MIN ? 0 : next
}

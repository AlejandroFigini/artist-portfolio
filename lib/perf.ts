/* Tier de performance — el BOOT_SCRIPT del layout define window.PERF
   antes del primer paint (igual que el <head> legacy). Acá solo se
   tipa y se expone con defaults seguros para SSR. */

export type PerfTier = {
  lite: boolean
  tier: 'lite' | 'full'
  dprCap: number
  particleScale: number
  shadowBlur: boolean
  reduced: boolean
  downgrade: () => void
}

declare global {
  interface Window { PERF?: PerfTier }
}

const DEFAULTS: PerfTier = {
  lite: false, tier: 'full', dprCap: 2, particleScale: 1, shadowBlur: true, reduced: false, downgrade: () => {},
}

export function perf(): PerfTier {
  return (typeof window !== 'undefined' && window.PERF) || DEFAULTS
}

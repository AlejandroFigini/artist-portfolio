'use client'

/* Envío de eventos a Google Analytics, sin arrastrar el paquete.
 *
 * `@next/third-parties/google` se publica como CommonJS transpilado y expone un
 * único punto de entrada (`./google`), así que importar `sendGAEvent` de ahí no
 * se puede tree-shakear: entra el barrel entero — el componente de GA, el de
 * GTM, el de Google Maps y el de YouTube, con `next/script` y
 * `third-party-capital` detrás. Y como Nav, Footer y las secciones se importan
 * desde el layout del sitio, todo eso viajaba en el chunk de primera carga de
 * CUALQUIER ruta pública. Justo lo que components/ui/DeferredAnalytics.tsx
 * existe para evitar.
 *
 * La función que se necesitaba de todo eso es esta. `GoogleAnalytics` se sigue
 * importando del paquete real en DeferredAnalytics, que monta después de `load`
 * y por lo tanto se lleva el barrel a su propio chunk.
 *
 * El original empuja el objeto `arguments`; acá se empuja el array de rest, que
 * para el procesador de gtag es lo mismo (lee por índice y por `length`).
 * Antes de que GA monte no hay `dataLayer` y el evento se descarta — igual que
 * con la implementación original, que tampoco lo encolaba. */

export function sendGAEvent(...args: unknown[]): void {
  if (typeof window === 'undefined') return
  const dl = (window as Window & { dataLayer?: unknown[] }).dataLayer
  if (!dl) return
  dl.push(args)
}

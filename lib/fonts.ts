/* Fuentes del sitio — self-hosted por next/font (build time).

   Antes venían de una <link rel="stylesheet"> a fonts.googleapis.com: una hoja
   render-blocking en un origen extra (DNS + TLS + CSS + los .woff2 recién
   después). En 4G lento eso solo era ~1.3s antes del primer pixel.

   next/font descarga las familias en el build y las sirve desde el mismo
   origen, sin request de terceros, con `display: swap` y las métricas de
   fallback calculadas (adjustFontFallback) para que el intercambio no mueva
   el layout.

   Todas son variables: se omite `weight` a propósito → un solo archivo cubre
   todo el rango de pesos que usa el CSS.

   Solo Jakarta se precarga: es la que pinta el texto del primer viewport
   (--font / --font-display). Las otras tres son de detalle (cotas blueprint,
   badges, cuerpos secundarios) y bajan cuando el layout ya está en pantalla. */

import { Plus_Jakarta_Sans, Raleway, Inter, Fira_Code } from 'next/font/google'

export const fontSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jakarta',
  preload: true,
})

export const fontRaleway = Raleway({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-raleway',
  preload: false,
})

export const fontInter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  preload: false,
})

export const fontMono = Fira_Code({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
  preload: false,
})

/** Clases de las cuatro familias — se aplican juntas en <html>. */
export const fontVariables = [
  fontSans.variable,
  fontRaleway.variable,
  fontInter.variable,
  fontMono.variable,
].join(' ')

/* Familia que pinta el texto del primer viewport (--font y --font-display salen
   de esta). Es la única cuyo reflow se vería al irse la pantalla de carga, así
   que es la única que el gate `fonts` tiene que esperar — ver PageLoader.
   next/font genera el nombre con hash en el build; se lee de acá y no se
   escribe a mano. */
export const CRITICAL_FONT_FAMILY = fontSans.style.fontFamily

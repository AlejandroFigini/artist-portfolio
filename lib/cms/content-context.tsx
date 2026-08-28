'use client'

/* Contenido del CMS disponible DURANTE EL RENDER, incluido el del servidor.

   El problema que resuelve. `state` (lib/cms/store) es un singleton de módulo
   que solo se puebla en el cliente, dentro del primer efecto de CmsRoot. Los
   componentes que pintan contenido editable leen de ahí, así que en el render
   del servidor ese mapa está vacío y emiten su estado vacío: medido sobre la
   portada, el HTML salía con 95 items de contenido embebidos como JSON inerte
   y CERO `<img>` con una URL real. La primera imagen del sitio no entraba al
   DOM hasta que el visitante bajaba y ejecutaba ~1 MB de JavaScript.

   El servidor YA tiene el contenido (lib/cms-bootstrap-server). Lo único que
   faltaba era hacérselo llegar al árbol de React en vez de dejarlo como texto
   inerte. Eso es lo que hace este contexto.

   Por qué contexto y no escribir el store en el servidor: `state` es una
   variable de módulo compartida por TODAS las requests del proceso. Escribirla
   desde el render filtraría el contenido de una visita a otra.

   Coherencia de hidratación. `state.itemsLoaded` recién se enciende en el
   efecto de CmsRoot, así que el PRIMER render del cliente lee todavía del
   contexto — exactamente el mismo mapa que usó el servidor, y por lo tanto el
   mismo marcado. Recién cuando el store queda listo se pasa a leer de él, ya
   con las ediciones locales y el idioma aplicados. */

import { createContext, useContext } from 'react'
import { state, t, useCmsStore } from './store'
import type { CmsBootstrap } from './bootstrap'

const EMPTY: CmsBootstrap = { items: {}, translations: {}, retired: [] }

const CmsContentContext = createContext<CmsBootstrap>(EMPTY)

export function CmsContentProvider({
  value,
  children,
}: {
  value: CmsBootstrap | null
  children: React.ReactNode
}) {
  return <CmsContentContext.Provider value={value ?? EMPTY}>{children}</CmsContentContext.Provider>
}

/** El payload tal cual lo mandó el servidor. Sin overrides locales. */
export function useCmsBootstrap(): CmsBootstrap {
  return useContext(CmsContentContext)
}

/* Mapa de contenido vigente para este render: el store una vez que el cliente
   lo cargó, el payload del servidor hasta entonces. Suscribe al store para
   repintar cuando el contenido en vivo lo reemplaza. */
export function useCmsItems(): Record<string, string> {
  useCmsStore()
  const boot = useContext(CmsContentContext)
  return state.itemsLoaded ? state.items : boot.items
}

/* Igual que `t()` del store, pero resolviendo contra el payload del servidor
   mientras el cliente todavía no cargó el suyo. Devuelve una función y no un
   valor para que un componente pueda resolver varias claves con una sola
   suscripción.

   El idioma no entra en juego en el servidor: la elección vive en
   localStorage y se aplica al hidratar, así que el HTML sale siempre en el
   idioma base y el motor lo traduce después — igual que hasta ahora, solo que
   antes el punto de partida era el texto de muestra del JSX y ahora es el
   contenido real. */
/* QUE NO conviene resolver por acá.

   Un texto pasa a estar controlado por React en cuanto se lee con este hook, y
   hay contenedores cuyo contenido lo posee OTRO mecanismo que muta el DOM:

   - Los títulos y bajadas de sección (.anim-showcase__title / __desc y sus
     equivalentes en char, proj, m3d, illu, más .about-lede). Los reveal loops
     de hooks/gsap-runtime les reescriben el innerHTML en spans por letra o por
     palabra. Si React repinta ese nodo porque cambió el valor, borra los spans
     y corta la animación — que es la firma visual del sitio.
   - Los que llevan `data-i18n` (p. ej. h2[data-i18n="about_title"]), que muta
     `applyStaticTranslations`.
   - .bio-content, donde el motor reemplaza con textContent un <div> que en el
     JSX tiene <p> adentro: React y el motor no coinciden en la estructura.

   Y el rédito es chico: medido sobre la base real, de los contenedores bajo
   reveal loop solo DOS tenían valor propio; el resto muestra el texto por
   defecto del JSX, que ya viaja en el HTML del servidor. No vale la pena. */
export function useCmsText(): (key: string, fallback?: string) => string {
  useCmsStore()
  const boot = useContext(CmsContentContext)
  return (key: string, fallback = '') =>
    state.itemsLoaded ? t(key, fallback) : boot.items[key] || fallback
}

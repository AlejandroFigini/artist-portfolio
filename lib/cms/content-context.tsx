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
import { state, useCmsStore } from './store'
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

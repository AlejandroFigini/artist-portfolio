'use client'

/* Provee los enlaces sociales (id → url) a Nav y Footer en TODAS las páginas.
   El valor inicial VIENE DEL SERVIDOR: las claves `social.*` son contenido
   normal, así que ya viajan dentro del bootstrap que el layout embebe en el
   HTML. Antes se pedían otra vez por `/api/social` al hidratar — un XHR más y
   una consulta más a Postgres por visita, en la ventana en que el loader
   todavía está esperando el evento `load`.
   `/api/social` sigue existiendo: lo usa Gestión para releer después de
   guardar. El admin también actualiza el mapa en vivo vía setLinks. */

import { createContext, useContext, useState } from 'react'

type SocialMap = Record<string, string>

const SocialContext = createContext<{ links: SocialMap; setLinks: (m: SocialMap) => void }>({
  links: {},
  setLinks: () => {},
})

export const useSocial = () => useContext(SocialContext)

export function SocialProvider({ initial, children }: { initial?: SocialMap; children: React.ReactNode }) {
  const [links, setLinks] = useState<SocialMap>(initial ?? {})

  return <SocialContext.Provider value={{ links, setLinks }}>{children}</SocialContext.Provider>
}

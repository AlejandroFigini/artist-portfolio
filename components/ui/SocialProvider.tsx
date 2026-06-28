'use client'

/* Provee los enlaces sociales (id → url) a Nav y Footer en TODAS las páginas.
   Carga una vez desde /api/social (lectura liviana). El admin actualiza el mapa
   en vivo vía setLinks tras guardar en Gestión. */

import { createContext, useContext, useEffect, useState } from 'react'

type SocialMap = Record<string, string>

const SocialContext = createContext<{ links: SocialMap; setLinks: (m: SocialMap) => void }>({
  links: {},
  setLinks: () => {},
})

export const useSocial = () => useContext(SocialContext)

export function SocialProvider({ children }: { children: React.ReactNode }) {
  const [links, setLinks] = useState<SocialMap>({})

  useEffect(() => {
    fetch('/api/social', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { items: {} }))
      .then((d) => setLinks(d.items || {}))
      .catch(() => {})
  }, [])

  return <SocialContext.Provider value={{ links, setLinks }}>{children}</SocialContext.Provider>
}

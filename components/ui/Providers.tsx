'use client'

/* Providers globales de UI (toast + modal). Client boundary fino:
   children siguen siendo Server Components (composición). */

import { ToastProvider } from './Toast'
import { ModalProvider } from './Modal'
import { SocialProvider } from './SocialProvider'
import { SiteSettingsProvider } from './SiteSettingsProvider'
import PageLoader from './PageLoader'
import { CmsContentProvider } from '@/lib/cms/content-context'
import type { CmsBootstrap } from '@/lib/cms/bootstrap'
import type { SiteSettings } from '@/lib/settings'

/* Las URLs de las redes son claves `social.<id>` del mismo mapa de contenido
   que ya mandó el servidor: se derivan acá en vez de pedirlas por su endpoint
   al hidratar. */
function socialLinksOf(content?: CmsBootstrap | null): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(content?.items ?? {})) {
    if (key.startsWith('social.')) out[key.slice('social.'.length)] = value
  }
  return out
}

export default function Providers({
  children,
  initialSettings,
  initialContent,
  serverAuthoritative,
}: {
  children: React.ReactNode
  initialSettings?: SiteSettings
  /* Contenido del CMS leído en el servidor. Va por el árbol de React —y no
     solo como JSON inerte en el HTML— para que los componentes puedan pintarlo
     en el render del servidor. Ver lib/cms/content-context. */
  initialContent?: CmsBootstrap | null
  /* ¿Hay base de datos? Con base, `initialSettings` es la verdad y no hace
     falta pedir `/api/site`; sin base (dev/mock) se cae a los overrides
     locales. Es el único dato que ese fetch aportaba. */
  serverAuthoritative?: boolean
}) {
  return (
    <CmsContentProvider value={initialContent ?? null}>
      <ToastProvider>
        <ModalProvider>
          <SocialProvider initial={socialLinksOf(initialContent)}>
            <SiteSettingsProvider initialSettings={initialSettings} serverAuthoritative={serverAuthoritative}>
              <PageLoader />
              {children}
            </SiteSettingsProvider>
          </SocialProvider>
        </ModalProvider>
      </ToastProvider>
    </CmsContentProvider>
  )
}

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

export default function Providers({
  children,
  initialSettings,
  initialContent,
}: {
  children: React.ReactNode
  initialSettings?: SiteSettings
  /* Contenido del CMS leído en el servidor. Va por el árbol de React —y no
     solo como JSON inerte en el HTML— para que los componentes puedan pintarlo
     en el render del servidor. Ver lib/cms/content-context. */
  initialContent?: CmsBootstrap | null
}) {
  return (
    <CmsContentProvider value={initialContent ?? null}>
      <ToastProvider>
        <ModalProvider>
          <SocialProvider>
            <SiteSettingsProvider initialSettings={initialSettings}>
              <PageLoader />
              {children}
            </SiteSettingsProvider>
          </SocialProvider>
        </ModalProvider>
      </ToastProvider>
    </CmsContentProvider>
  )
}

'use client'

/* Providers globales de UI (toast + modal). Client boundary fino:
   children siguen siendo Server Components (composición). */

import { ToastProvider } from './Toast'
import { ModalProvider } from './Modal'
import { SocialProvider } from './SocialProvider'
import { SiteSettingsProvider } from './SiteSettingsProvider'
import PageLoader from './PageLoader'
import type { SiteSettings } from '@/lib/settings'

export default function Providers({ children, initialSettings }: { children: React.ReactNode; initialSettings?: SiteSettings }) {
  return (
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
  )
}

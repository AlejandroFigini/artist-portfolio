'use client'

/* Providers globales de UI (toast + modal). Client boundary fino:
   children siguen siendo Server Components (composición). */

import { ToastProvider } from './Toast'
import { ModalProvider } from './Modal'
import { SocialProvider } from './SocialProvider'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ModalProvider>
        <SocialProvider>{children}</SocialProvider>
      </ModalProvider>
    </ToastProvider>
  )
}

import type { Metadata } from 'next'
import ContactPage from '@/components/contact/ContactPage'

/* Ruta /contact — página de contacto dedicada. Layout raíz monta CmsRoot,
   SocialProvider y SiteSettingsProvider, así que todo está disponible. */

export const metadata: Metadata = {
  title: 'Contact | Lucía Montaña',
  description:
    'Get in touch with Lucía Montaña — 3D Generalist & Animator based in Montevideo. Send a message, download CV, or find social links.',
}

export default function ContactRoute() {
  return <ContactPage />
}

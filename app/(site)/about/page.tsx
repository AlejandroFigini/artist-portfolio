import type { Metadata } from 'next'
import CmsRoot from '@/components/cms/CmsRoot'
import AboutPage from '@/components/about/AboutPage'

/* Ruta /about — página dedicada "sobre la artista". Monta CmsRoot para
   que el retrato (about.photo) hidrate, muestre el overlay vacío y sea
   editable desde el panel, igual que en la home. */

export const metadata: Metadata = {
  title: 'Sobre mí | Lucía Montaña',
  description:
    'Lucía Montaña — 3D Generalist & Animator basada en Montevideo. Biografía, software y trayectoria.',
}

export default function AboutRoute() {
  return (
    <>
      <CmsRoot />
      <AboutPage />
    </>
  )
}

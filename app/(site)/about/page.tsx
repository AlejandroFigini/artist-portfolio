import type { Metadata } from 'next'
import AboutPage from '@/components/about/AboutPage'

/* Ruta /about — página dedicada "sobre la artista". El layout raíz ya monta
   CmsRoot para que el retrato (about.photo) hidrate, muestre el overlay vacío y sea
   editable desde el panel, igual que en la home. */

export const metadata: Metadata = {
  title: 'About | Lucía Montaña',
  description:
    'Lucía Montaña — 3D Generalist & Animator based in Montevideo. Biography, software, and career timeline.',
}

export default function AboutRoute() {
  return (
    <>
      <AboutPage />
    </>
  )
}

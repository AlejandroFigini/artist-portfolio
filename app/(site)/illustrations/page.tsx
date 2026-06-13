import type { Metadata } from 'next'
import IllustrationsGallery from '@/components/gallery/IllustrationsGallery'

export const metadata: Metadata = { title: 'Illustrations | Lucia Montaña' }

export default function IllustrationsPage() {
  return <IllustrationsGallery />
}

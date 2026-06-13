import type { Metadata } from 'next'
import MultimediaGallery from '@/components/gallery/MultimediaGallery'

export const metadata: Metadata = { title: 'Multimedia | Lucia Montaña' }

export default function MultimediaPage() {
  return <MultimediaGallery />
}

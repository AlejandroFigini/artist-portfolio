import type { Metadata } from 'next'
import Models3DGallery from '@/components/gallery/Models3DGallery'

export const metadata: Metadata = { title: '3D Models | Lucia Montaña' }

export default function Models3DPage() {
  return <Models3DGallery />
}

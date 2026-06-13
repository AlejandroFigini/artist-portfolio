import type { Metadata } from 'next'
import AnimationsGallery from '@/components/gallery/AnimationsGallery'

export const metadata: Metadata = { title: 'Animations | Lucia Montaña' }

export default function AnimationsPage() {
  return <AnimationsGallery />
}

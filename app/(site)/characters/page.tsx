import type { Metadata } from 'next'
import CharactersGallery from '@/components/gallery/CharactersGallery'

export const metadata: Metadata = { title: 'Character Design | Lucia Montaña' }

export default function CharactersPage() {
  return <CharactersGallery />
}

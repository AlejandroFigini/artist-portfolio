import type { Metadata } from 'next'
import CharactersShowcase from '@/components/home/CharactersShowcase'
import HomeFx from '@/components/home/HomeFx'

export const metadata: Metadata = {
  title: 'Characters | Lucía Montaña',
  description: 'Character designs and concepts by Lucía Montaña.',
}

export default function CharactersRoute() {
  return (
    <>
      <HomeFx />
      <main className="pt-24 pb-16">
        <CharactersShowcase />
      </main>
    </>
  )
}

import type { Metadata } from 'next'
import IllustrationsShowcase from '@/components/home/IllustrationsShowcase'
import HomeFx from '@/components/home/HomeFx'

export const metadata: Metadata = {
  title: 'Illustrations | Lucía Montaña',
  description: 'Digital and traditional illustrations by Lucía Montaña.',
}

export default function IllustrationsRoute() {
  return (
    <>
      <HomeFx />
      <main className="pt-24 pb-16">
        <IllustrationsShowcase />
      </main>
    </>
  )
}

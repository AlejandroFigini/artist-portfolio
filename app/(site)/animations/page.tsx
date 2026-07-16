import type { Metadata } from 'next'
import AnimationsShowcase from '@/components/home/AnimationsShowcase'
import HomeFx from '@/components/home/HomeFx'

export const metadata: Metadata = {
  title: 'Animations | Lucía Montaña',
  description: 'Animations showcase by Lucía Montaña.',
}

export default function AnimationsRoute() {
  return (
    <>
      <HomeFx />
      <main className="pt-24 pb-16">
        <AnimationsShowcase />
      </main>
    </>
  )
}

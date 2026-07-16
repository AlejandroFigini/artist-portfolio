import type { Metadata } from 'next'
import ModelsShowcase from '@/components/home/ModelsShowcase'
import HomeFx from '@/components/home/HomeFx'

export const metadata: Metadata = {
  title: '3D Models | Lucía Montaña',
  description: '3D modeling, sculpting, and texturing projects by Lucía Montaña.',
}

export default function Models3DRoute() {
  return (
    <>
      <HomeFx />
      <main className="pt-24 pb-16">
        <ModelsShowcase />
      </main>
    </>
  )
}

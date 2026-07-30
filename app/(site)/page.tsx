import dynamic from 'next/dynamic'
import HomeFx from '@/components/home/HomeFx'
import HeroSlideshow from '@/components/home/Slideshow'
import Hero from '@/components/home/Hero'
import AboutSection from '@/components/home/AboutSection'
import AnimationsShowcase from '@/components/home/AnimationsShowcase'
import ProjectsShowcase from '@/components/home/ProjectsShowcase'

const CharactersShowcase = dynamic(() => import('@/components/home/CharactersShowcase'))
const ModelsShowcase = dynamic(() => import('@/components/home/ModelsShowcase'))
const IllustrationsShowcase = dynamic(() => import('@/components/home/IllustrationsShowcase'))

/* Index — portada. Reconstrucción sección por sección: por ahora solo el
   Hero. HomeFx concentra los efectos globales (reveals, typewriter,
   section-inactive, autoplay de videos). */

export default function HomePage() {
  return (
    <>
      <HomeFx />
      <HeroSlideshow />
      <main>
        <Hero />
        <AboutSection />
        <AnimationsShowcase />
        <ProjectsShowcase />
        <CharactersShowcase />
        <ModelsShowcase />
        <IllustrationsShowcase />
      </main>
    </>
  )
}

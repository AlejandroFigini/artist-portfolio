import HomeFx from '@/components/home/HomeFx'
import HeroSlideshow from '@/components/home/Slideshow'
import Hero from '@/components/home/Hero'
import AboutSection from '@/components/home/AboutSection'
import AnimationsShowcase from '@/components/home/AnimationsShowcase'
import ProjectsShowcase from '@/components/home/ProjectsShowcase'
import CharactersShowcase from '@/components/home/CharactersShowcase'
import ModelsShowcase from '@/components/home/ModelsShowcase'
import IllustrationsShowcase from '@/components/home/IllustrationsShowcase'

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

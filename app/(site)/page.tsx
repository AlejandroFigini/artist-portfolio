import PageLoader from '@/components/ui/PageLoader'
import Cursor from '@/components/ui/Cursor'
import CmsRoot from '@/components/cms/CmsRoot'
import HomeFx from '@/components/home/HomeFx'
import HeroSlideshow from '@/components/home/Slideshow'
import Hero from '@/components/home/Hero'
import AboutSection from '@/components/home/AboutSection'
import AnimationsShowcase from '@/components/home/AnimationsShowcase'
import CharactersShowcase from '@/components/home/CharactersShowcase'
import ModelsShowcase from '@/components/home/ModelsShowcase'

/* Index — portada. Reconstrucción sección por sección: por ahora solo el
   Hero. HomeFx concentra los efectos globales (reveals, typewriter,
   section-inactive, autoplay de videos). */

export default function HomePage() {
  return (
    <>
      <PageLoader />
      <CmsRoot />
      <HomeFx />
      <Cursor />
      <div className="film-grain-overlay"></div>
      <HeroSlideshow />
      <main>
        <Hero />
        <AboutSection />
        <AnimationsShowcase />
        <CharactersShowcase />
        <ModelsShowcase />
      </main>
    </>
  )
}

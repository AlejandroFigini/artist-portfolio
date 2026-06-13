import PageLoader from '@/components/ui/PageLoader'
import Cursor from '@/components/ui/Cursor'
import CmsRoot from '@/components/cms/CmsRoot'
import HomeFx from '@/components/home/HomeFx'
import HeroSlideshow from '@/components/home/Slideshow'
import Hero from '@/components/home/Hero'
import AboutSection from '@/components/home/AboutSection'
import AnimationsShowcase from '@/components/home/AnimationsShowcase'
import CharactersShowcase from '@/components/home/CharactersShowcase'
import Models3DSection from '@/components/home/Models3DSection'
import IllustrationsSection from '@/components/home/IllustrationsSection'

/* Index — portado de index.html. HomeFx concentra los efectos globales
   (reveals, typewriter, section-inactive, autoplay de videos). */

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
        <Models3DSection />
        <IllustrationsSection />
      </main>
    </>
  )
}

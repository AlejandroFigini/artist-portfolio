import dynamic from 'next/dynamic'
import ReactDOM from 'react-dom'
import HomeFx from '@/components/home/HomeFx'
import HeroSlideshow from '@/components/home/Slideshow'
import Hero from '@/components/home/Hero'
import AboutSection from '@/components/home/AboutSection'
import AnimationsShowcase from '@/components/home/AnimationsShowcase'
import ProjectsShowcase from '@/components/home/ProjectsShowcase'
import { getHeroPreloadServer } from '@/lib/hero-server'
import { mediaSrcSet, optimizedMediaSrc } from '@/lib/utils'

const CharactersShowcase = dynamic(() => import('@/components/home/CharactersShowcase'))
const ModelsShowcase = dynamic(() => import('@/components/home/ModelsShowcase'))
const IllustrationsShowcase = dynamic(() => import('@/components/home/IllustrationsShowcase'))

/* Index — portada. HomeFx concentra los efectos globales (reveals, typewriter,
   section-inactive, autoplay de videos). */

/* Las dos imágenes del primer viewport se piden desde el HTML, no después de
   hidratar. `imageSrcSet`/`imageSizes` replican exactamente los del elemento
   que las va a pintar (Slideshow y SmoothImage) para que el candidato que
   elige el navegador sea el mismo y la descarga se reuse en vez de duplicarse. */
const BACKDROP_SIZES = '100vw'
const PANEL_SIZES = '(max-width: 768px) 90vw, 50vw'

function preloadHeroImage(src: string, sizes: string, priority: boolean) {
  if (!src) return
  const srcSet = mediaSrcSet(src)
  ReactDOM.preload(optimizedMediaSrc(src, 1200), {
    as: 'image',
    fetchPriority: priority ? 'high' : 'auto',
    ...(srcSet ? { imageSrcSet: srcSet, imageSizes: sizes } : {}),
  })
}

export default async function HomePage() {
  const hero = await getHeroPreloadServer()
  preloadHeroImage(hero.panel, PANEL_SIZES, true)
  preloadHeroImage(hero.backdrop, BACKDROP_SIZES, false)

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

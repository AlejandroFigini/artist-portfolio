import dynamic from 'next/dynamic'
import ReactDOM from 'react-dom'
import HomeFx from '@/components/home/HomeFx'
import HeroSlideshow from '@/components/home/Slideshow'
import Hero from '@/components/home/Hero'
import SectionRail from '@/components/home/SectionRail'
import SectionHashScroll from '@/components/home/SectionHashScroll'
import { getHeroPreloadServer } from '@/lib/hero-server'
import { getSiteSettingsServer } from '@/lib/site-server'
import { mediaSrcSet, optimizedMediaSrc, videoPosterSrc } from '@/lib/utils'

/* Todo lo que está abajo del fold va por `next/dynamic`. No es por el peso
   total —el HTML se sigue renderizando en el server, así que el contenido está
   igual— sino por CUÁNDO baja su JavaScript.

   El primer pintado es bandwidth-bound: medido en producción, en los primeros
   3.2s bajan ~305 KB y 238 KB son JavaScript que el FCP no necesita, pero que
   le pelea el ancho de banda a la hoja de estilos (33 KB que sola tardan 884ms
   y acompañada 2094ms). Sacando estas secciones de la primera ola, la portada
   compite contra menos.

   HomeFx las precalienta en idle, así que siguen hidratando antes de que el
   visitante llegue a scrollearlas. */
const AboutSection = dynamic(() => import('@/components/home/AboutSection'))
const AnimationsShowcase = dynamic(() => import('@/components/home/AnimationsShowcase'))
const ProjectsShowcase = dynamic(() => import('@/components/home/ProjectsShowcase'))
const CharactersShowcase = dynamic(() => import('@/components/home/CharactersShowcase'))
const ModelsShowcase = dynamic(() => import('@/components/home/ModelsShowcase'))
const GameDevShowcase = dynamic(() => import('@/components/home/GameDevShowcase'))
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
  const [hero, settings] = await Promise.all([getHeroPreloadServer(), getSiteSettingsServer()])
  preloadHeroImage(hero.panel, PANEL_SIZES, true)
  preloadHeroImage(hero.backdrop, BACKDROP_SIZES, false)

  /* Póster de la pantalla de carga. Es lo PRIMERO que se ve del sitio y es un
     <video>: hasta que decodifica su primer frame el recuadro pinta negro. El
     póster tapa ese hueco, pero el <video> vive dentro de Providers (body), así
     que su descarga arranca recién cuando el parser llega ahí y compite con
     prioridad baja. Pedido desde el <head> y en alta, sale con la primera ola.
     Solo en la portada: es la única ruta donde el loader se muestra. */
  const loaderPoster = videoPosterSrc(settings.loaderVideo)
  if (loaderPoster) ReactDOM.preload(loaderPoster, { as: 'image', fetchPriority: 'high' })

  return (
    <>
      <HomeFx />
      <HeroSlideshow />
      <main className="feed-main">
        <Hero />
        <AboutSection />
        <AnimationsShowcase />
        <ProjectsShowcase />
        <CharactersShowcase />
        <ModelsShowcase />
        <GameDevShowcase />
        <IllustrationsShowcase />
      </main>
      <SectionRail />
      <SectionHashScroll />
    </>
  )
}

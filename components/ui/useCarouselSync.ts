// Shared hook to reinitialize Embla carousel when its content changes.
// All carousel components (ProjectsShowcase, CharactersShowcase, HeroMediaCarousel, Slideshow, etc.)
// can import and use this hook to keep cloned slides in sync with the CMS store.

import { useEffect, type DependencyList } from 'react'
import { type CarouselApi } from '@/components/ui/carousel'
import { useCmsStore } from '@/lib/cms/store'

/**
 * Re‑initialize the carousel when the provided signature changes.
 * @param api            Embla carousel API instance (may be undefined initially).
 * @param signature      A string that uniquely represents the carousel content (e.g. concatenated slide data).
 * @param extraDeps      Additional dependency array items (e.g. display count) that should trigger a re‑init.
 */
export function useCarouselSync(
  api: CarouselApi | undefined,
  signature: string,
  extraDeps: DependencyList = []
) {
  // Ensure the component re‑renders when CMS store changes.
  useCmsStore()

   
  useEffect(() => {
    if (!api) return
    // Re-initialize Embla to rebuild cloned slides.
    api.reInit()
    /* El spread es la API del hook: cada carrusel aporta sus propias
       dependencias extra. El linter no puede verificar un array variádico. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, signature, ...extraDeps])
}

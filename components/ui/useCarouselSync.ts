// Shared hook to reinitialize Embla carousel when its content changes.
// All carousel components (ProjectsShowcase, CharactersShowcase, HeroMediaCarousel, Slideshow, etc.)
// can import and use this hook to keep cloned slides in sync with the CMS store.

import { useEffect } from 'react'
import { type CarouselApi } from '@/components/ui/carousel'
import { useCmsStore, state } from '@/lib/cms/store'
import { rescan } from '@/components/cms/engine'

/**
 * Re‑initialize the carousel when the provided signature changes.
 * @param api            Embla carousel API instance (may be undefined initially).
 * @param signature      A string that uniquely represents the carousel content (e.g. concatenated slide data).
 * @param extraDeps      Additional dependency array items (e.g. display count) that should trigger a re‑init.
 */
export function useCarouselSync(
  api: CarouselApi | undefined,
  signature: string,
  extraDeps: any[] = []
) {
  // Ensure the component re‑renders when CMS store changes.
  useCmsStore()

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!api) return
    // Re‑initialize Embla to rebuild cloned slides.
    api.reInit()
    // If admin, trigger a short rescan to update engine.
    if (state.isAdmin) {
      const t = setTimeout(() => rescan(), 100)
      return () => clearTimeout(t)
    }
  }, [api, signature, ...extraDeps])
}

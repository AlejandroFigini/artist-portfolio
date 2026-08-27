'use client'

/* Ancla de llegada a la portada. El menú y el pie apuntan a `/#characters`,
   `/#projects`, … y el navegador no puede resolver ese fragmento solo: las
   secciones bajan por `next/dynamic` y no existen en el DOM cuando la ruta
   monta.

   Espera a que el loader suelte el body (si no, la coreografía de entrada
   corre con la página ya desplazada) y recién ahí ancla, dándole a la sección
   el tiempo que necesite para montar. */

import { useEffect } from 'react'
import { prefersReducedMotion } from '@/hooks/motion-flags'
import { whenLoaderDone } from '@/lib/loader-ready'
import { scrollToSection } from '@/lib/smooth-scroll'
import { sectionIdFromHash } from '@/lib/site-sections'

export default function SectionHashScroll() {
  useEffect(() => {
    const id = sectionIdFromHash(window.location.hash)
    if (!id) return
    return whenLoaderDone(() => scrollToSection(id, prefersReducedMotion()))
  }, [])

  return null
}

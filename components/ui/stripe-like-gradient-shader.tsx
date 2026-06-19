'use client'

/* Stripe-like animated gradient (WebGL via gradflow). Paleta violeta
   priorizada para integrar con la estética blueprint del proyecto.
   Llena su contenedor padre (w-full h-full). Ref: https://gradflow.meera.dev/ */

import { useEffect, useState } from 'react'
import { GradFlow } from 'gradflow'

type GradientShaderProps = {
  className?: string
}

/* Fallback estático (sin animación) para prefers-reduced-motion. */
const STATIC_VIOLET =
  'radial-gradient(120% 100% at 18% 30%, #7c3aed 0%, #4c1d95 38%, #100921 100%)'

export const StripeGradientShader = ({ className }: GradientShaderProps) => {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  if (reduced) {
    return <div className={className} style={{ background: STATIC_VIOLET }} aria-hidden="true" />
  }

  return (
    <GradFlow
      className={className}
      config={{
        color1: { r: 109, g: 40, b: 217 }, // violet-700 (acento)
        color2: { r: 49, g: 17, b: 99 }, // violeta profundo
        color3: { r: 12, g: 8, b: 24 }, // base casi negra violeta
        speed: 0.4,
        scale: 1,
        type: 'stripe',
        noise: 0.08,
      }}
    />
  )
}

export default StripeGradientShader

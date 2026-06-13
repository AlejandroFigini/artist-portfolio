'use client'

/* CircularGallery — galería 3D circular con auto-rotación + rotación
   ligada al scroll. Integrado desde un componente externo y adaptado al
   proyecto: tokens shadcn (bg-card/border-border) reemplazados por la
   paleta blueprint, respeta prefers-reduced-motion y el switch .motion-off,
   pausa la rotación fuera de viewport (perf), y soporta contenedores
   vacíos (placeholder blueprint) mientras no hay contenido. */

import React, { useState, useEffect, useRef, useCallback, HTMLAttributes } from 'react'

const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' ')

const motionDisabled = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.body.classList.contains('motion-off'))

// Tipo de un ítem de la galería (el contenedor; photo.url vacío = placeholder)
export interface GalleryItem {
  common: string
  binomial: string
  photo: {
    url: string
    text: string
    pos?: string
    by: string
  }
}

interface CircularGalleryProps extends HTMLAttributes<HTMLDivElement> {
  items: GalleryItem[]
  /** Distancia de los ítems al centro. */
  radius?: number
  /** Velocidad de auto-rotación cuando no se hace scroll. */
  autoRotateSpeed?: number
}

const CircularGallery = React.forwardRef<HTMLDivElement, CircularGalleryProps>(
  ({ items, className, radius = 600, autoRotateSpeed = 0.02, ...props }, ref) => {
    const [rotation, setRotation] = useState(0)
    const [isScrolling, setIsScrolling] = useState(false)
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const animationFrameRef = useRef<number | null>(null)
    const rootRef = useRef<HTMLDivElement | null>(null)
    const inViewRef = useRef(true)

    // Rotación ligada al scroll (desactivada con reduced-motion)
    useEffect(() => {
      if (motionDisabled()) return
      const handleScroll = () => {
        setIsScrolling(true)
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)

        const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight
        const scrollProgress = scrollableHeight > 0 ? window.scrollY / scrollableHeight : 0
        setRotation(scrollProgress * 360)

        scrollTimeoutRef.current = setTimeout(() => setIsScrolling(false), 150)
      }

      window.addEventListener('scroll', handleScroll, { passive: true })
      return () => {
        window.removeEventListener('scroll', handleScroll)
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
      }
    }, [])

    // Pausar todo el trabajo cuando la galería no está en viewport (perf)
    useEffect(() => {
      const node = rootRef.current
      if (!node || !('IntersectionObserver' in window)) return
      const io = new IntersectionObserver(
        (entries) => { inViewRef.current = entries[0].isIntersecting },
        { threshold: 0 },
      )
      io.observe(node)
      return () => io.disconnect()
    }, [])

    // Auto-rotación cuando no se hace scroll (gated por viewport + reduced-motion)
    useEffect(() => {
      if (motionDisabled()) return
      const autoRotate = () => {
        if (!isScrolling && inViewRef.current) setRotation((prev) => prev + autoRotateSpeed)
        animationFrameRef.current = requestAnimationFrame(autoRotate)
      }
      animationFrameRef.current = requestAnimationFrame(autoRotate)
      return () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
      }
    }, [isScrolling, autoRotateSpeed])

    const setRefs = useCallback(
      (node: HTMLDivElement | null) => {
        rootRef.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
      },
      [ref],
    )
    const anglePerItem = 360 / items.length

    return (
      <div
        ref={setRefs}
        role="region"
        aria-label="Circular 3D Gallery"
        className={cn('relative w-full h-full flex items-center justify-center', className)}
        style={{ perspective: '2000px' }}
        {...props}
      >
        <div
          className="relative w-full h-full"
          style={{ transform: `rotateY(${rotation}deg)`, transformStyle: 'preserve-3d' }}
        >
          {items.map((item, i) => {
            const itemAngle = i * anglePerItem
            const totalRotation = rotation % 360
            const relativeAngle = (itemAngle + totalRotation + 360) % 360
            const normalizedAngle = Math.abs(relativeAngle > 180 ? 360 - relativeAngle : relativeAngle)
            const opacity = Math.max(0.3, 1 - normalizedAngle / 180)
            const hasPhoto = !!item.photo.url

            return (
              <div
                key={`${item.common}-${i}`}
                role="group"
                aria-label={item.common}
                className="absolute w-[300px] h-[400px]"
                style={{
                  transform: `rotateY(${itemAngle}deg) translateZ(${radius}px)`,
                  left: '50%',
                  top: '50%',
                  marginLeft: '-150px',
                  marginTop: '-200px',
                  opacity,
                  transition: 'opacity 0.3s linear',
                }}
              >
                <div className="relative w-full h-full rounded-lg shadow-2xl overflow-hidden group border border-[var(--container-border,rgba(167,139,250,0.18))] bg-white/[0.04] backdrop-blur-lg">
                  {hasPhoto ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={item.photo.url}
                      alt={item.photo.text}
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{ objectPosition: item.photo.pos || 'center' }}
                    />
                  ) : (
                    /* contenedor vacío: placeholder blueprint (editable por CMS luego) */
                    <div className="cg-placeholder absolute inset-0" aria-hidden="true">
                      <span className="cg-ph-fig">{`FIG.${String(i + 1).padStart(2, '0')}`}</span>
                      <i className="fa-regular fa-image cg-ph-icon"></i>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black/80 to-transparent text-white">
                    <h2 className="text-xl font-bold">{item.common}</h2>
                    <em className="text-sm italic opacity-80">{item.binomial}</em>
                    {hasPhoto && <p className="text-xs mt-2 opacity-70">Photo by: {item.photo.by}</p>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  },
)

CircularGallery.displayName = 'CircularGallery'

export { CircularGallery }

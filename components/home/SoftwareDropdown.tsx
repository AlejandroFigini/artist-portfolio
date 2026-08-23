'use client'

/* SoftwareDropdown — desplegable de software reutilizable (Animations,
   Character Design, 3D). Clases visuales neutras .sw-* (estilo único en
   software-dropdown.css) + clases {prefix}-soft-icon / {prefix}-soft-name
   como hooks del CMS, para que cada sección tenga su propio set de logos
   (keys {prefix}.soft#i / {prefix}.softname#i registradas en engine.ts).

   El hover (abrir/cerrar) lo maneja CSS puro; el estado React es solo para
   apertura por click (sticky), que se cierra al clickear fuera. */

import { useEffect, useRef, useState } from 'react'
import DecorAnim from '@/components/ui/DecorAnim'
import { useSiteSettings } from '@/components/ui/SiteSettingsProvider'
import { animSources } from '@/lib/settings'

function SoftwareItem({ prefix, index }: { prefix: string; index: number }) {
  const iconRef = useRef<HTMLSpanElement>(null)
  const nameRef = useRef<HTMLSpanElement>(null)
  const [hasImg, setHasImg] = useState(false)

  useEffect(() => {
    // texto default solo si el span está vacío (el CMS lo sobreescribe al hidratar)
    if (nameRef.current && !(nameRef.current.textContent || '').trim()) {
      nameRef.current.textContent = `Software ${index + 1}`
    }
    const el = iconRef.current
    if (!el) return
    const checkImg = () => {
      const bg = el.style.backgroundImage
      setHasImg(!!bg && bg !== 'none' && !bg.includes("url('')") && !bg.includes('url("")'))
    }
    checkImg()
    const moImg = new MutationObserver(checkImg)
    moImg.observe(el, { attributes: true, attributeFilter: ['style', 'data-full'] })
    return () => moImg.disconnect()
  }, [index])

  // El contenedor SIEMPRE se renderiza (regla del proyecto: contenedor
  // presente aunque no tenga contenido). El engine inyecta el overlay
  // vacío (.cms-empty-overlay) sobre .sw-icon-wrap cuando no hay logo;
  // el CSS ya oculta icono/click para el visitante — acá no se gatea nada.
  return (
    <li className="sw-item" role="menuitem">
      <span className="sw-icon-wrap">
        <span ref={iconRef} className={`sw-icon ${prefix}-soft-icon`} data-full="" aria-hidden="true">
          {!hasImg && <i className="fa-solid fa-cube sw-ph" />}
        </span>
      </span>
      <span ref={nameRef} className={`sw-name ${prefix}-soft-name`} />
    </li>
  )
}

export default function SoftwareDropdown({ prefix, count = 6 }: { prefix: string; count?: number }) {
  const [open, setOpen] = useState(false)
  /* El panel también se abre por hover/foco, y eso lo maneja CSS puro: sin
     espejarlo en React la animación no sabría que está a la vista. El hover
     solo cuenta con puntero fino, igual que el media query del CSS — en táctil
     el :hover queda clavado tras el tap y el panel se daría por abierto. */
  const [pointerOpen, setPointerOpen] = useState(false)
  const hoverCapable = useRef(false)
  const ref = useRef<HTMLDivElement>(null)
  const { settings } = useSiteSettings()
  const animSrcs = animSources(settings, 'softwareAnimUrl')

  useEffect(() => {
    hoverCapable.current = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  }, [])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const shown = open || pointerOpen

  return (
    <div
      ref={ref}
      className={`sw-dropdown${open ? ' is-open' : ''}`}
      onMouseEnter={() => { if (hoverCapable.current) setPointerOpen(true) }}
      onMouseLeave={() => setPointerOpen(false)}
      onFocus={() => setPointerOpen(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPointerOpen(false) }}
    >
      <button
        type="button"
        className="sw-trigger"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <i className="fa-solid fa-layer-group" aria-hidden="true" />
        <span data-i18n="software">Software</span>
        <i className="fa-solid fa-chevron-down sw-chev" aria-hidden="true" />
      </button>
      <ul className="sw-list" role="menu">
        {Array.from({ length: count }, (_, i) => (
          <SoftwareItem key={i} prefix={prefix} index={i} />
        ))}
        {/* Decorado al pie del panel: mismo circuito que las demás animaciones
            (Gestión → Software Panel Animation). Un solo ajuste para los tres
            desplegables; cada uno rota por su cuenta al cerrarse. */}
        {animSrcs.length > 0 && (
          <li className="sw-anim-row" aria-hidden="true">
            <DecorAnim sources={animSrcs} className="sw-anim" active={shown} rotateOn="toggle" />
          </li>
        )}
      </ul>
    </div>
  )
}

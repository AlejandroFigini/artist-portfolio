'use client'

/* SoftwareDropdown — desplegable de software reutilizable (Animations,
   Character Design, 3D). Clases visuales neutras .sw-* (estilo único en
   software-dropdown.css) + clases {prefix}-soft-icon / {prefix}-soft-name
   como hooks del CMS, para que cada sección tenga su propio set de logos
   (keys {prefix}.soft#i / {prefix}.softname#i registradas en engine.ts).

   El hover (abrir/cerrar) lo maneja CSS puro; el estado React es solo para
   apertura por click (sticky), que se cierra al clickear fuera. */

import { useEffect, useRef, useState } from 'react'

function SoftwareItem({ prefix, index }: { prefix: string; index: number }) {
  const iconRef = useRef<HTMLSpanElement>(null)
  const nameRef = useRef<HTMLSpanElement>(null)
  const [hasImg, setHasImg] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

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

    const checkAdmin = () => setIsAdmin(document.body.classList.contains('is-admin'))
    checkAdmin()
    const moAdmin = new MutationObserver(checkAdmin)
    moAdmin.observe(document.body, { attributes: true, attributeFilter: ['class'] })

    return () => { moImg.disconnect(); moAdmin.disconnect() }
  }, [index])

  const hidden = !isAdmin && !hasImg

  return (
    <li className={`sw-item${hidden ? ' is-hidden' : ''}`} role="menuitem">
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
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div ref={ref} className={`sw-dropdown${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="sw-trigger"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <i className="fa-solid fa-layer-group" aria-hidden="true" />
        <span>Software</span>
        <i className="fa-solid fa-chevron-down sw-chev" aria-hidden="true" />
      </button>
      <ul className="sw-list" role="menu">
        {Array.from({ length: count }, (_, i) => (
          <SoftwareItem key={i} prefix={prefix} index={i} />
        ))}
      </ul>
    </div>
  )
}

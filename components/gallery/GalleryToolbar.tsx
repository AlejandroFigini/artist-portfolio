'use client'

/* Toolbar de filtros — portada de gallery-common.js (dropdownFilter).
   El legacy renderizaba chips y los convertía a dropdown en runtime;
   acá se renderiza el dropdown (.gfilter) directo con estado React. */

import { useEffect, useRef, useState } from 'react'

export type GalleryFilterDef = { id: string; label: string; i18n?: string }

type Props = {
  filters: GalleryFilterDef[]
  active: string
  onChange: (id: string) => void
  count: number
  countId: string
  countLabel: string
  countI18n?: string
  ariaLabel: string
  className?: string
}

export default function GalleryToolbar({
  filters, active, onChange, count, countId, countLabel, countI18n, ariaLabel, className,
}: Props) {
  const [open, setOpen] = useState(false)
  const ddRef = useRef<HTMLDivElement>(null)
  const current = filters.find((f) => f.id === active) ?? filters[0]

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!ddRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={`gallery-toolbar${className ? ` ${className}` : ''}`} role="toolbar" aria-label={ariaLabel}>
      <div ref={ddRef} className={`gfilter${open ? ' open' : ''}`}>
        <button
          type="button"
          className="gfilter-trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <i className="fa-solid fa-sliders"></i>
          <span className="gfilter-current" data-i18n={current.i18n}>{current.label}</span>
          <i className="fa-solid fa-chevron-down gfilter-caret"></i>
        </button>
        <ul className="gfilter-list" role="listbox">
          {filters.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                role="option"
                aria-selected={f.id === active}
                className={`gfilter-opt${f.id === active ? ' active' : ''}`}
                data-i18n={f.i18n}
                onClick={() => { onChange(f.id); setOpen(false) }}
              >
                {f.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <span className="gallery-count">
        <b id={countId}>{count}</b> <span data-i18n={countI18n}>{countLabel}</span>
      </span>
    </div>
  )
}

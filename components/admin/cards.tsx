'use client'

/* Tarjetas de media del panel — port de usedCard/unusedCard/trashCard/
   repoCard de admin.js (thumb Cloudinary, meta, dropdown de acciones,
   checkbox de selección múltiple). */

import { fmtBytes, fmtDateOnly, fmtTimeOnly, isVideo, cloudinaryThumb } from '@/lib/utils'
import { state, getFormat, getContainerMeta, type UnusedEntry, type UsedEntry } from '@/lib/cms/store'

/** Nombre de archivo sin su extensión (para el título de la tarjeta). */
const stripExt = (name?: string) => (name ? name.replace(/\.[^./\\]+$/, '') : '')

export type CardType = 'used' | 'unused' | 'trash' | 'repo'
export type AnyEntry = (UsedEntry | UnusedEntry) & {
  key?: string
  _idx?: number
  _state?: 'used' | 'unused' | 'trash'
  deletedAt?: number
  ts?: number
  type?: string
  dataUrl?: string
  reason?: UnusedEntry['reason']
}

export type MenuAction = {
  icon: string
  color?: string
  label: string
  onClick: () => void
}

export function Thumb({ e }: { e: AnyEntry }) {
  const src = e.src || e.dataUrl
  const vid = isVideo(e.type || (e as UsedEntry).kind, e.name)
  const thumbStyle: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: 'inherit' }
  return (
    <div className="cms-mlib-thumb-wrap" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {!src ? (
        <span className="cms-mlib-noimg" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'inherit' }}><i className={`fa-solid fa-${vid ? 'film' : 'image'}`}></i></span>
      ) : src.includes('res.cloudinary.com') ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={cloudinaryThumb(src, vid)} alt="" loading="lazy" style={thumbStyle} />
      ) : vid ? (
        <video src={src} muted playsInline preload="metadata" style={thumbStyle} />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={src} alt="" loading="lazy" style={thumbStyle} />
      )}
      <div className="cms-mlib-thumb-overlay"><i className="fa-solid fa-magnifying-glass-plus"></i></div>
    </div>
  )
}

type MediaCardProps = {
  e: AnyEntry
  cardType: CardType
  tags?: React.ReactNode
  actions: MenuAction[]
  multiSelect?: boolean
  selected?: boolean
  onToggleSelect?: (checked: boolean) => void
  onView: () => void
}

export function MediaCard({ e, cardType, tags, actions, multiSelect, selected, onToggleSelect, onView }: MediaCardProps) {
  const ts = cardType === 'trash' ? e.deletedAt : e.ts
  // Título = nombre del archivo sin extensión; el nombre completo y el formato
  // van como datos. "Contenedor" = a qué contenedor pertenece (vacío si a ninguno).
  const title = stripExt(e.name) || e.label || '—'
  // contenedor al que pertenece; si es una subida directa reciente → "Recién subido"
  const occs = e.src && cardType === 'used' ? Object.values(state.usedContent).filter(u => u.src === e.src) : []
  const occCount = cardType === 'used' ? occs.length : (e.src ? Object.values(state.usedContent).filter(u => u.src === e.src).length : 0)
  const isUnusedOrTrash = cardType === 'unused' || cardType === 'trash' || e._state === 'unused' || e._state === 'trash'
  const containerLabel = isUnusedOrTrash ? 'Previous container:' : (occCount > 1 && cardType === 'used' ? 'Containers:' : 'Container:')
  const containerBase = cardType === 'used' && occCount > 1
    ? occs.map(u => u.label || (u.key ? getContainerMeta(u.key).label : '') || u.key).join(', ')
    : (e.key ? getContainerMeta(e.key).label : (e.reason === 'upload' ? 'Just uploaded' : ''))
  return (
    <div
      className="cms-mlib-item"
      data-card-type={cardType}
      onClick={(ev) => {
        const t = ev.target as HTMLElement
        if (t.closest('.cms-mlib-actions') || t.closest('.cms-multi-check')) return
        onView()
      }}
    >
      {/* check de selección en el espacio libre por encima del tag */}
      {multiSelect && onToggleSelect && (
        <input
          type="checkbox" className="cms-multi-check" checked={!!selected}
          onChange={(ev) => onToggleSelect(ev.target.checked)}
          onClick={(ev) => ev.stopPropagation()}
        />
      )}
      {/* columna de la miniatura: el tag va ARRIBA de la imagen, con el mismo ancho que ella */}
      <div className="cms-mlib-thumb-col">
        {tags && <div className="cms-mlib-tag-top">{tags}</div>}
        <Thumb e={e} />
      </div>
      <div className="cms-mlib-info">
        <div className="cms-mlib-label" style={{ color: 'var(--accent)' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={title}>
            {title}
          </span>
        </div>
        <div className="cms-mlib-meta">
          <div className="cms-mlib-meta-truncate"><strong>Name:</strong> <span title={e.name || '—'}>{e.name || '—'}</span></div>
          <div><strong>Format:</strong> {getFormat(e)}</div>
          <div><strong>Size:</strong> {fmtBytes(e.size)}</div>
          <div><strong>Upload date:</strong> {ts ? fmtDateOnly(ts) : '—'}</div>
          <div><strong>Upload time:</strong> {ts ? fmtTimeOnly(ts) : '—'}</div>
          <div><strong>Uses:</strong> <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{occCount === 0 ? '0 times' : `${occCount} ${occCount === 1 ? 'time' : 'times'}`}</span></div>
          <div className="cms-mlib-meta-truncate"><strong>{containerLabel}</strong> <span title={containerBase} style={{ color: 'var(--accent)', fontWeight: 600 }}>{containerBase || '—'}</span></div>
        </div>
        {actions.length > 0 && (
          <div className="cms-mlib-actions">
            <div className="cms-dropdown">
              <button type="button" className="cms-iconbtn"><i className="fa-solid fa-ellipsis-vertical"></i></button>
              <div className="cms-dropdown-menu">
                {actions.map((a, i) => (
                  <button key={i} type="button" className="cms-dropdown-item" onClick={a.onClick} style={a.color === 'danger' ? { color: '#ef4444' } : undefined}>
                    <i className={`fa-solid ${a.icon}`} style={a.color && a.color !== 'danger' ? { color: a.color } : undefined}></i> {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


'use client'

/* Tarjetas de media del panel — port de usedCard/unusedCard/trashCard/
   repoCard de admin.js (thumb Cloudinary, meta, dropdown de acciones,
   checkbox de selección múltiple). */

import { fmtBytes, fmtDateOnly, fmtTimeOnly, isVideo, cloudinaryThumb } from '@/lib/utils'
import { getFormat, sumSizes, groupBySection, type UnusedEntry, type UsedEntry } from '@/lib/cms/store'

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
  return (
    <div className="cms-mlib-thumb-wrap">
      {!src ? (
        <span className="cms-mlib-noimg"><i className={`fa-solid fa-${vid ? 'film' : 'image'}`}></i></span>
      ) : src.includes('res.cloudinary.com') ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={cloudinaryThumb(src, vid)} alt="" loading="lazy" style={{ objectFit: 'cover' }} />
      ) : vid ? (
        <span className="cms-mlib-noimg"><i className="fa-solid fa-film"></i></span>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={src} alt="" loading="lazy" style={{ objectFit: 'cover' }} />
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
      {multiSelect && onToggleSelect && (
        <input
          type="checkbox" className="cms-multi-check" checked={!!selected}
          onChange={(ev) => onToggleSelect(ev.target.checked)}
          onClick={(ev) => ev.stopPropagation()}
        />
      )}
      <Thumb e={e} />
      <div className="cms-mlib-info">
        {(e.label || tags) && (
          <div className="cms-mlib-label">
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={e.label}>
              {e.label}
            </span>
            {tags}
          </div>
        )}
        <div className="cms-mlib-meta">
          <div><strong>Nombre:</strong> {e.name || '—'}</div>
          <div><strong>Formato:</strong> {getFormat(e)}</div>
          <div><strong>Tamaño:</strong> {fmtBytes(e.size)}</div>
          <div><strong>Fecha de subida:</strong> {ts ? fmtDateOnly(ts) : '—'}</div>
          <div><strong>Hora de subida:</strong> {ts ? fmtTimeOnly(ts) : '—'}</div>
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

type GroupsProps = {
  arr: AnyEntry[]
  emptyMsg: string
  renderCard: (e: AnyEntry) => React.ReactNode
  multiSelect?: boolean
  onSelectGroup?: (items: AnyEntry[], checked: boolean) => void
}

export function CardGroups({ arr, emptyMsg, renderCard, multiSelect, onSelectGroup }: GroupsProps) {
  if (!arr.length) return <p className="cms-admin-sub">{emptyMsg}</p>
  return (
    <>
      {groupBySection(arr).map((g) => (
        <div className="admin-group" key={g.section}>
          <div className="admin-group-head">
            <h4 style={{ display: 'flex', alignItems: 'center' }}>
              {g.section}
              {multiSelect && onSelectGroup && (
                <input
                  type="checkbox" title="Seleccionar toda la sección"
                  style={{ marginLeft: '0.5rem', transform: 'scale(1.2)', cursor: 'pointer' }}
                  onChange={(ev) => onSelectGroup(g.items, ev.target.checked)}
                />
              )}
            </h4>
            <span className="admin-badge">{g.items.length} archivos · {fmtBytes(sumSizes(g.items))}</span>
          </div>
          <div className="cms-mlib-grid">{g.items.map(renderCard)}</div>
        </div>
      ))}
    </>
  )
}

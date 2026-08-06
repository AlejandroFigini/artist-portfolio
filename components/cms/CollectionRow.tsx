'use client'

/* Fila de un item de colección. Rinde la variante simple (solo miniatura) o la
   rica (miniatura + título + editar info + conceptos) según lo que declare la
   spec. Una sola fila para las seis colecciones. */

import { state } from '@/lib/cms/store'
import { isEmptyMedia, itemKey } from '@/lib/cms/collection'
import type { CollectionSpec } from '@/lib/cms/collections'

type Props = {
  spec: CollectionSpec
  id: string
  index: number
  total: number
  onPick: (key: string) => void
  onEditInfo: (key: string) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}

const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.45rem',
  background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)',
  flexWrap: 'wrap',
}

export default function CollectionRow({
  spec, id, index, total, onPick, onEditInfo, onMove, onRemove,
}: Props) {
  const key = itemKey(spec, id)
  const src = state.items[key] || ''
  const empty = isEmptyMedia(src)
  const rich = !!spec.fields
  const titleField = spec.fields?.[0]
  const title = titleField ? state.items[`${key}::${titleField.key}`] || '' : ''
  const subField = spec.fields?.[1]
  const subValue = subField ? state.items[`${key}::${subField.key}`] || '' : ''
  const positional = `${spec.itemNoun[0].toUpperCase()}${spec.itemNoun.slice(1)} ${index + 1}`
  const subtitle = subValue || positional

  return (
    <div style={rowStyle}>
      <div
        title={empty ? 'No image' : undefined}
        style={{
          position: 'relative', width: rich ? 64 : 84, height: rich ? 64 : 50,
          borderRadius: rich ? 6 : 4, flexShrink: 0, backgroundSize: 'cover',
          backgroundPosition: 'center', backgroundColor: 'var(--bg-primary)',
          backgroundImage: empty ? undefined : `url("${src}")`,
          border: empty ? '1px dashed #b45309' : '1px solid var(--border)',
        }}
      >
        {empty && (
          <i
            className="fa-solid fa-image"
            style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#b45309', opacity: 0.55, fontSize: '1rem',
            }}
          />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 160, fontSize: '0.85rem', fontWeight: 600 }}>
        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>
          {title || positional}
        </div>
        {rich ? (
          <div style={{ fontSize: '0.75rem', color: empty ? '#b45309' : 'var(--text-secondary)', fontWeight: 400, marginTop: 2 }}>
            {subtitle}{empty && ' — no image'}
          </div>
        ) : empty && (
          <div style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 400, marginTop: 2 }}>
            no image
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
        <button type="button" className="cms-icon-btn" title="Change image" aria-label="Change image" onClick={() => onPick(key)}>
          <i className="fa-solid fa-image"></i>
        </button>

        {rich && (
          <button type="button" className="cms-icon-btn" title="Edit info" aria-label="Edit info" onClick={() => onEditInfo(key)}>
            <i className="fa-solid fa-pen-to-square"></i>
          </button>
        )}

        {!!spec.concepts && (
          <>
            <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 0.2rem' }} />
            {Array.from({ length: spec.concepts }, (_, m) => {
              const cKey = `${key}::c${m}`
              const cSrc = state.items[cKey] || ''
              const cEmpty = isEmptyMedia(cSrc)
              return (
                <button
                  key={m}
                  type="button"
                  className="cms-icon-btn"
                  style={{
                    width: 34, height: 34, padding: 0, position: 'relative', overflow: 'hidden',
                    border: cEmpty ? '1px dashed var(--border)' : '1px solid var(--accent)',
                  }}
                  title={`Concept image #${m + 1} (${cEmpty ? 'Empty — click to upload' : 'Uploaded — click to change'})`}
                  onClick={() => onPick(cKey)}
                >
                  {cEmpty
                    ? <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary)' }}>C{m + 1}</span>
                    : <div style={{ position: 'absolute', inset: 0, backgroundSize: 'cover', backgroundPosition: 'center', backgroundImage: `url("${cSrc}")` }} />}
                </button>
              )
            })}
          </>
        )}

        <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 0.2rem' }} />

        <button type="button" className="cms-icon-btn" title="Move up" aria-label="Move up" disabled={index === 0} onClick={() => onMove(-1)}>
          <i className="fa-solid fa-chevron-up"></i>
        </button>
        <button type="button" className="cms-icon-btn" title="Move down" aria-label="Move down" disabled={index === total - 1} onClick={() => onMove(1)}>
          <i className="fa-solid fa-chevron-down"></i>
        </button>
        <button type="button" className="cms-icon-btn cms-icon-btn--danger" title="Delete" aria-label="Delete" onClick={onRemove}>
          <i className="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
  )
}

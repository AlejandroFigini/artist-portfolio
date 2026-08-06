'use client'

/* Gestor único de colecciones. Reemplaza CarouselManager, ProjectsManager y
   CharactersManager: la única diferencia entre ellos era qué campos y cuántos
   conceptos declaraba la colección, y eso ahora vive en la spec.
   Un solo botón de guardado: no hay "guardar estructura" previo porque el uid
   existe apenas se agrega el item. */

import { useState } from 'react'
import { CmsModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { isEmptyMedia, itemKey } from '@/lib/cms/collection'
import type { CollectionSpec } from '@/lib/cms/collections'
import { useCollection } from '@/lib/cms/useCollection'
import { state, useCmsStore } from '@/lib/cms/store'
import CollectionRow from './CollectionRow'

type Props = {
  spec: CollectionSpec
  show?: boolean
  onClose: () => void
  onPickImage: (key: string) => void
  onEditInfo: (key: string) => void
}

export default function CollectionManager({ spec, show = true, onClose, onPickImage, onEditInfo }: Props) {
  const toast = useToast()
  useCmsStore()
  const col = useCollection(spec)
  const [saving, setSaving] = useState(false)
  const [showInfo, setShowInfo] = useState(false)

  const filled = col.ids.filter((id) => !isEmptyMedia(state.items[itemKey(spec, id)])).length
  const hasEmpty = filled < col.ids.length
  const atMax = spec.max !== undefined && col.ids.length >= spec.max

  const status = col.dirty
    ? { color: '#047857', icon: 'fa-circle-check', label: 'Ready to save', title: 'Pending changes ready to be saved' }
    : hasEmpty
      ? { color: '#b45309', icon: 'fa-triangle-exclamation', label: `${filled}/${col.ids.length} with image`, title: 'Some items have no image yet' }
      : { color: '#64748b', icon: 'fa-check', label: 'No changes', title: 'Everything is saved' }

  const onSave = () => {
    setSaving(true)
    col.commit()
      .then(() => { toast('Saved successfully'); setSaving(false) })
      .catch(() => { toast('Error saving changes', 'error'); setSaving(false) })
  }

  const onAdd = () => {
    if (atMax) { toast(`Maximum ${spec.max} ${spec.itemNoun}s`, 'error'); return }
    col.add()
  }

  return (
    <CmsModal
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>{spec.label}</span>
          <span
            style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
            onMouseEnter={() => setShowInfo(true)}
            onMouseLeave={() => setShowInfo(false)}
          >
            <button
              type="button"
              className="cms-icon-btn"
              style={{ border: 'none', background: 'transparent', padding: '0.1rem 0.25rem', color: 'var(--text-secondary)', fontSize: '0.9em' }}
              aria-label="Help"
              aria-expanded={showInfo}
              onFocus={() => setShowInfo(true)}
              onBlur={() => setShowInfo(false)}
            >
              <i className="fa-solid fa-circle-info"></i>
            </button>
            {showInfo && (
              <div
                role="tooltip"
                style={{
                  position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 50, width: 300,
                  padding: '0.6rem 0.8rem', borderRadius: 8, background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)', fontSize: '0.8rem', fontWeight: 400,
                  color: 'var(--text-secondary)', lineHeight: 1.55,
                  boxShadow: '0 6px 20px rgba(0, 0, 0, 0.18)', textTransform: 'none', letterSpacing: 'normal',
                }}
              >
                Add, reorder or remove {spec.itemNoun}s, then press <strong>Save</strong>.
                {spec.max !== undefined && <> Maximum {spec.max}.</>}
                {spec.duration && <> One {spec.itemNoun} means a static image, with no rotation.</>}
              </div>
            )}
          </span>
        </span>
      }
      wide={!!spec.fields}
      show={show}
      onClose={onClose}
      actions={[]}
    >
      <div className="cms-carousel-manager">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <span title={status.title} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', fontWeight: 600, color: status.color }}>
            <i className={`fa-solid ${status.icon}`}></i>{status.label}
          </span>
          <span style={{ flex: 1 }} />
          {spec.duration && (
            <label title="Duration between slides (seconds)" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <i className="fa-solid fa-clock"></i>
              <input
                type="number" min={2} max={30}
                value={Math.round(col.duration / 1000)}
                onChange={(e) => col.setDuration(Math.max(2, parseInt(e.target.value, 10) || 7) * 1000)}
                style={{ width: 54, padding: '0.35rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', textAlign: 'center' }}
              />
            </label>
          )}
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Total: <strong>{col.ids.length}</strong>
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {col.ids.map((id, i) => (
            <CollectionRow
              key={id}
              spec={spec}
              id={id}
              index={i}
              total={col.ids.length}
              onPick={onPickImage}
              onEditInfo={onEditInfo}
              onMove={(dir) => col.move(id, dir)}
              onRemove={() => col.remove(id)}
            />
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '0.25rem' }}>
            <button
              type="button"
              className="cms-btn"
              style={{ padding: '0.45rem 0.8rem', fontSize: '0.8rem', borderStyle: 'dashed' }}
              disabled={atMax}
              title={atMax ? `Maximum ${spec.max} ${spec.itemNoun}s` : `Add new ${spec.itemNoun}`}
              onClick={onAdd}
            >
              <i className="fa-solid fa-plus"></i> Add {spec.itemNoun}
            </button>
          </div>
        </div>

        <div className="cms-modal-actions" style={{ justifyContent: 'flex-end', gap: '0.35rem' }}>
          <button
            type="button"
            className="cms-btn cms-btn--primary"
            style={{ margin: 0 }}
            disabled={saving || !col.dirty}
            title={col.dirty ? undefined : 'No changes recorded'}
            onClick={onSave}
          >
            {saving
              ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Saving…</>
              : <><i className="fa-solid fa-floppy-disk"></i> Save</>}
          </button>
        </div>
      </div>
    </CmsModal>
  )
}

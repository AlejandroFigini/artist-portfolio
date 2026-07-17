'use client'

/* eslint-disable react-hooks/immutability */

/* Modales de texto e info del sitio — port de cms.js: editText(),
   editInfoPage(), confirmMovePage(), openExport(). */

import { useRef, useState } from 'react'
import { CmsModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { state, recordAudit, persistUsed, performRenameContainer, type FieldValue, emit } from '@/lib/cms/store'
import {
  elementsByKey, metaByKey, applyStored, persistOverrides, moveToUnusedSite, deleteProjectSite, computeFields,
} from './engine'

// Etiqueta amigable para la página actual a partir del pathname.
function currentPageLabel(): string {
  if (typeof window === 'undefined') return 'Feed principal'
  const p = window.location.pathname
  if (p === '/' || p === '') return 'Feed principal'
  return p.replace(/^\/+|\/+$/g, '').split('/').map((s) =>
    s.charAt(0).toUpperCase() + s.slice(1)
  ).join(' / ')
}

type KeyProps = { cmsKey: string; onClose: () => void }

function ContainerNameRow({ editingName, setEditingName, nameRef, label, commitRename }: {
  editingName: boolean
  setEditingName: (v: boolean) => void
  nameRef: React.RefObject<HTMLInputElement | null>
  label: string
  commitRename: () => void
}) {
  return (
    <div style={{ marginTop: '0.55rem', paddingTop: '0.55rem', borderTop: '1px solid rgba(124,58,237,0.12)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      {editingName ? (
        <label className="cms-field" style={{ flex: 1, margin: 0 }}>
          <span>Container name</span>
          <input ref={nameRef} type="text" defaultValue={label} autoFocus style={{ fontWeight: 400 }} onBlur={commitRename} onKeyDown={(e) => { if (e.key === 'Enter') commitRename() }} />
        </label>
      ) : (
        <div className="cms-meta-line" style={{ flex: 1 }}>
          <strong>Container:</strong> <span style={{ opacity: 0.85 }}>{label}</span>
        </div>
      )}
      <button
        type="button"
        title={editingName ? 'Save name' : 'Rename container'}
        aria-label={editingName ? 'Save name' : 'Rename container'}
        onClick={() => { if (editingName) commitRename(); else setEditingName(true) }}
        style={{
          background: 'none', border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)',
          borderRadius: '6px', padding: '0.35rem 0.5rem', cursor: 'pointer',
          color: 'var(--accent)', fontSize: '0.78rem', flexShrink: 0,
          transition: 'background 0.2s, border-color 0.2s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 12%, transparent)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
      >
        <i className={`fa-solid ${editingName ? 'fa-check' : 'fa-pen'}`} />
      </button>
    </div>
  )
}

export function EditTextModal({ cmsKey, onClose }: KeyProps) {
  const toast = useToast()
  const el = elementsByKey[cmsKey]
  const meta = metaByKey[cmsKey]
  const taRef = useRef<HTMLTextAreaElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const [editingName, setEditingName] = useState(false)
  const initial = (state.items[cmsKey] != null ? state.items[cmsKey] : el?.textContent || '').trim()
  const [page] = useState(() => currentPageLabel())

  if (!el || !meta) return null

  const commitRename = () => {
    const newName = nameRef.current?.value.trim()
    if (newName && newName !== meta.label) {
      performRenameContainer(cmsKey, newName)
      meta.label = newName
    }
    setEditingName(false)
  }

  return (
    <CmsModal
      title="Edit text" zIndex={100050}
      onClose={() => { commitRename(); onClose() }}
      actions={[
        { label: 'Cancel', onClick: () => { commitRename() } },
        { label: 'Save', primary: true, onClick: () => {
          commitRename()
          const v = taRef.current?.value ?? ''
          state.items[cmsKey] = v
          applyStored(cmsKey, v)
          persistOverrides().catch(() => toast('Network error while syncing with server', 'error'))
          recordAudit({ section: meta.section, label: meta.label, kind: 'text', summary: 'Container updated' })
          toast('Container updated')
        } },
      ]}
    >
      <div className="cms-upload">
        <div className="cms-up-head">
          <div className="cms-meta-line"><strong>Page:</strong> <span style={{ opacity: 0.85 }}>{page}</span></div>
          <div className="cms-meta-line"><strong>Section:</strong> <span style={{ opacity: 0.85 }}>{meta.section}</span></div>
          <ContainerNameRow editingName={editingName} setEditingName={setEditingName} nameRef={nameRef} label={meta.label} commitRename={commitRename} />
        </div>
        <label className="cms-field" style={{ marginTop: '0.75rem' }}>
          <span>Text</span>
          <textarea ref={taRef} rows={4} defaultValue={initial} autoFocus />
        </label>
      </div>
    </CmsModal>
  )
}

export function EditInfoModal({ cmsKey, onClose }: { cmsKey: string; onClose: () => void }) {
  const toast = useToast()
  const meta = metaByKey[cmsKey]
  const el = elementsByKey[cmsKey] || null
  const [fields] = useState<FieldValue[]>(() => {
    return (meta && computeFields(cmsKey, el, meta)) || []
  })
  const valuesRef = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({})
  const nameRef = useRef<HTMLInputElement>(null)
  const [editingName, setEditingName] = useState(false)
  const [page] = useState(() => currentPageLabel())

  const requiredDefs = (meta?.fields || []).filter((d) => !d.optional)
  const requiredKeys = requiredDefs.map((d) => d.key)
  const requiredLabels = requiredDefs.map((d) => d.label).join(', ')
  const isComplete = () => requiredKeys.every((k) => {
    const inp = valuesRef.current[k]
    const v = inp ? inp.value : (fields.find((f) => f.key === k)?.value ?? '')
    return v.trim() !== ''
  })
  const [fieldsComplete, setFieldsComplete] = useState(() => isComplete())
  const recheckFields = () => setFieldsComplete(isComplete())

  const cont = meta.container && el ? el.closest<HTMLElement>(meta.container) : el

  const commitRename = () => {
    const newName = nameRef.current?.value.trim()
    if (newName && newName !== meta.label) {
      performRenameContainer(cmsKey, newName)
      meta.label = newName
    }
    setEditingName(false)
  }

  return (
    <CmsModal
      title="Edit information"
      wide
      onClose={() => { commitRename(); onClose() }}
      actions={[
        { label: 'Cancel', onClick: () => { commitRename() } },
        {
          label: 'Save',
          primary: true,
          disabled: !fieldsComplete,
          title: !fieldsComplete ? `Por favor completa los campos requeridos (${requiredLabels}) antes de guardar` : undefined,
          onClick: () => {
            commitRename()
            let changed = false
            fields.forEach((f) => {
              const inp = valuesRef.current[f.key]
              if (!inp) return
              const v = inp.value
              if (v !== f.value) {
                const compositeKey = cmsKey + '::' + f.key
                state.items[compositeKey] = v
                const def = meta.fields!.find((d) => d.key === f.key)
                if (def && cont) def.set(cont, v)
                const used = state.usedContent[cmsKey]
                const ff = used?.fields?.find((z) => z.key === f.key)
                if (ff) ff.value = v
                recordAudit({ section: meta.section, label: meta.label, kind: 'metadata', summary: `Field "${f.label}" updated` })
                changed = true
              }
            })
            persistOverrides().catch(() => toast('Network error while syncing with server', 'error'))
            persistUsed()
            emit()
            toast(changed ? 'Container updated' : 'No changes')
          }
        },
      ]}
    >
      <div className="cms-upload">
        <div className="cms-up-head">
          <div className="cms-meta-line"><strong>Page:</strong> <span style={{ opacity: 0.85 }}>{page}</span></div>
          <div className="cms-meta-line"><strong>Section:</strong> <span style={{ opacity: 0.85 }}>{meta.section}</span></div>
          <ContainerNameRow editingName={editingName} setEditingName={setEditingName} nameRef={nameRef} label={meta.label} commitRename={commitRename} />
        </div>
        <div className="cms-up-fields" style={{ marginTop: '0.75rem' }}>
          <div className="cms-fields-title">Information</div>
          {fields.map((f) => (
            <label className="cms-field" key={f.key}>
              <span>{f.label} {requiredKeys.includes(f.key) && <span style={{ color: '#ef4444' }}>*</span>}</span>
              {f.textarea ? (
                <textarea rows={2} defaultValue={f.value} ref={(n) => { valuesRef.current[f.key] = n }} onChange={recheckFields} />
              ) : (
                <input type={f.key.includes('date') ? 'date' : 'text'} defaultValue={f.value} ref={(n) => { valuesRef.current[f.key] = n }} onChange={recheckFields} />
              )}
            </label>
          ))}
        </div>
      </div>
    </CmsModal>
  )
}

export function ConfirmMoveModal({ cmsKey, onClose }: KeyProps) {
  const toast = useToast()
  const meta = metaByKey[cmsKey]
  if (!meta) return null
  // Mostrar el nombre del ARCHIVO actual (no el del contenedor).
  const fileName = state.usedContent[cmsKey]?.name || meta.label
  // Proyectos: la papelera ELIMINA la tarjeta (reindexa el carrusel) pero archiva
  // la imagen a no usados. Resto: solo vacía el slot conservando el contenedor.
  const isProject = /^proj#\d+$/.test(cmsKey)

  if (isProject) {
    return (
      <CmsModal
        title="Delete card" zIndex={100050}
        onClose={onClose}
        actions={[
          { label: 'Cancel', onClick: () => {} },
          { label: 'Delete card', primary: true, onClick: () => {
            deleteProjectSite(cmsKey).catch(() => toast('Error deleting', 'error'))
            toast('Card deleted · image moved to unused')
          } },
        ]}
      >
        <div className="cms-confirm-body">
          Are you sure you want to delete this project card?
        </div>
      </CmsModal>
    )
  }

  return (
    <CmsModal
      title="Move to unused" zIndex={100050}
      onClose={onClose}
      actions={[
        { label: 'Cancel', onClick: () => {} },
        { label: 'Move to unused', primary: true, onClick: () => {
          moveToUnusedSite(cmsKey)
          toast('Moved to unused')
        } },
      ]}
    >
      <div className="cms-confirm-body">
        You are about to move &quot;<strong>{fileName}</strong>&quot; to <strong>unused content</strong>.
        <div className="cms-confirm-warn">
          <i className="fa-solid fa-triangle-exclamation"></i> It will be removed from the site; the space will become free
          to upload other content. You can restore it from Management.
        </div>
      </div>
    </CmsModal>
  )
}

export function ExportModal({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const value = JSON.stringify({ version: 1, items: state.items }, null, 2)
  return (
    <CmsModal
      title="Content (what backend would save)"
      wide
      onClose={onClose}
      actions={[
        { label: 'Copy', onClick: () => {
          navigator.clipboard?.writeText(value).then(() => toast('Copied')).catch(() => {})
          return false
        } },
        { label: 'Close', primary: true, onClick: () => {} },
      ]}
    >
      <textarea className="cms-textarea" readOnly rows={12} value={value} />
    </CmsModal>
  )
}

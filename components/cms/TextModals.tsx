'use client'

/* Modales de texto e info del sitio — port de cms.js: editText(),
   editInfoPage(), confirmMovePage(), openExport(). */

import { useRef, useState } from 'react'
import { CmsModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { state, recordAudit, persistUsed, performRenameContainer } from '@/lib/cms/store'
import {
  elementsByKey, metaByKey, applyStored, persistOverrides, moveToUnusedSite, computeFields,
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
          <span>Nombre del contenedor</span>
          <input ref={nameRef} type="text" defaultValue={label} autoFocus style={{ fontWeight: 400 }} onBlur={commitRename} onKeyDown={(e) => { if (e.key === 'Enter') commitRename() }} />
        </label>
      ) : (
        <div className="cms-meta-line" style={{ flex: 1 }}>
          <strong>Contenedor:</strong> <span style={{ opacity: 0.85 }}>{label}</span>
        </div>
      )}
      <button
        type="button"
        title={editingName ? 'Guardar nombre' : 'Renombrar contenedor'}
        aria-label={editingName ? 'Guardar nombre' : 'Renombrar contenedor'}
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
      title="Editar texto"
      onClose={() => { commitRename(); onClose() }}
      actions={[
        { label: 'Cancelar', onClick: () => { commitRename() } },
        { label: 'Guardar', primary: true, onClick: () => {
          commitRename()
          const v = taRef.current?.value ?? ''
          state.items[cmsKey] = v
          applyStored(cmsKey, v)
          persistOverrides().catch(() => toast('Error de red al sincronizar con el servidor', 'error'))
          recordAudit({ section: meta.section, label: meta.label, kind: 'texto', summary: 'Contenedor actualizado' })
          toast('Contenedor actualizado')
        } },
      ]}
    >
      <div className="cms-upload">
        <div className="cms-up-head">
          <div className="cms-meta-line"><strong>Página:</strong> <span style={{ opacity: 0.85 }}>{page}</span></div>
          <div className="cms-meta-line"><strong>Sección:</strong> <span style={{ opacity: 0.85 }}>{meta.section}</span></div>
          <ContainerNameRow editingName={editingName} setEditingName={setEditingName} nameRef={nameRef} label={meta.label} commitRename={commitRename} />
        </div>
        <label className="cms-field" style={{ marginTop: '0.75rem' }}>
          <span>Texto</span>
          <textarea ref={taRef} rows={4} defaultValue={initial} autoFocus />
        </label>
      </div>
    </CmsModal>
  )
}

export function EditInfoModal({ cmsKey, onClose }: KeyProps) {
  const toast = useToast()
  const el = elementsByKey[cmsKey]
  const meta = metaByKey[cmsKey]
  const [fields] = useState(() => (el && meta ? computeFields(cmsKey, el, meta) || [] : []))
  const valuesRef = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({})
  const nameRef = useRef<HTMLInputElement>(null)
  const [editingName, setEditingName] = useState(false)
  const [page] = useState(() => currentPageLabel())

  if (!el || !meta || !meta.fields) return null
  const cont = meta.container ? el.closest<HTMLElement>(meta.container) : el

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
      title="Editar información"
      wide
      onClose={() => { commitRename(); onClose() }}
      actions={[
        { label: 'Cancelar', onClick: () => { commitRename() } },
        { label: 'Guardar', primary: true, onClick: () => {
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
              recordAudit({ section: meta.section, label: meta.label, kind: 'metadata', summary: `Campo "${f.label}" actualizado` })
              changed = true
            }
          })
          persistOverrides().catch(() => toast('Error de red al sincronizar con el servidor', 'error'))
          persistUsed()
          toast(changed ? 'Contenedor actualizado' : 'Sin cambios')
        } },
      ]}
    >
      <div className="cms-upload">
        <div className="cms-up-head">
          <div className="cms-meta-line"><strong>Página:</strong> <span style={{ opacity: 0.85 }}>{page}</span></div>
          <div className="cms-meta-line"><strong>Sección:</strong> <span style={{ opacity: 0.85 }}>{meta.section}</span></div>
          <ContainerNameRow editingName={editingName} setEditingName={setEditingName} nameRef={nameRef} label={meta.label} commitRename={commitRename} />
        </div>
        <div className="cms-up-fields" style={{ marginTop: '0.75rem' }}>
          <div className="cms-fields-title">Información</div>
          {fields.map((f) => (
            <label className="cms-field" key={f.key}>
              <span>{f.label}</span>
              {f.textarea ? (
                <textarea rows={2} defaultValue={f.value} ref={(n) => { valuesRef.current[f.key] = n }} />
              ) : (
                <input type={f.key === 'date' ? 'date' : 'text'} defaultValue={f.value} ref={(n) => { valuesRef.current[f.key] = n }} />
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
  return (
    <CmsModal
      title="Mover a no usados"
      onClose={onClose}
      actions={[
        { label: 'Cancelar', onClick: () => {} },
        { label: 'Mover a no usados', primary: true, onClick: () => {
          moveToUnusedSite(cmsKey)
          toast('Movido a no usados')
        } },
      ]}
    >
      <div className="cms-confirm-body">
        Vas a mover «<strong>{fileName}</strong>» a <strong>contenidos no usados</strong>.
        <div className="cms-confirm-warn">
          <i className="fa-solid fa-triangle-exclamation"></i> Se quitará del sitio; el espacio queda libre
          para subir otro contenido. Podrás restaurarlo desde Gestión.
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
      title="Contenido (lo que el backend guardaría)"
      wide
      onClose={onClose}
      actions={[
        { label: 'Copiar', onClick: () => {
          navigator.clipboard?.writeText(value).then(() => toast('Copiado')).catch(() => {})
          return false
        } },
        { label: 'Cerrar', primary: true, onClick: () => {} },
      ]}
    >
      <textarea className="cms-textarea" readOnly rows={12} value={value} />
    </CmsModal>
  )
}

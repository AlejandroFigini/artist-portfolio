'use client'

/* Modales de texto e info del sitio — port de cms.js: editText(),
   editInfoPage(), confirmMovePage(), openExport(). */

import { useRef, useState } from 'react'
import { CmsModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { state, recordAudit, persistUsed } from '@/lib/cms/store'
import {
  elementsByKey, metaByKey, applyStored, persistOverrides, moveToUnusedSite, computeFields,
} from './engine'

type KeyProps = { cmsKey: string; onClose: () => void }

export function EditTextModal({ cmsKey, onClose }: KeyProps) {
  const toast = useToast()
  const el = elementsByKey[cmsKey]
  const meta = metaByKey[cmsKey]
  const taRef = useRef<HTMLTextAreaElement>(null)
  const initial = (state.items[cmsKey] != null ? state.items[cmsKey] : el?.textContent || '').trim()

  if (!el || !meta) return null

  return (
    <CmsModal
      title="Editar texto"
      onClose={onClose}
      actions={[
        { label: 'Cancelar', onClick: () => {} },
        { label: 'Guardar', primary: true, onClick: () => {
          const v = taRef.current?.value ?? ''
          state.items[cmsKey] = v
          applyStored(cmsKey, v)
          persistOverrides().catch(() => toast('Error de red al sincronizar con el servidor', 'error'))
          recordAudit({ section: meta.section, label: meta.label, kind: 'texto', summary: 'Texto actualizado' })
          toast('Texto actualizado')
        } },
      ]}
    >
      <div>
        <p className="cms-meta-line">
          <strong>Contenedor:</strong> {meta.label} &nbsp;·&nbsp; <strong>Sección:</strong> {meta.section}
        </p>
        <textarea ref={taRef} className="cms-textarea" rows={4} defaultValue={initial} autoFocus />
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

  if (!el || !meta || !meta.fields) return null
  const cont = meta.container ? el.closest<HTMLElement>(meta.container) : el

  return (
    <CmsModal
      title="Editar información"
      wide
      onClose={onClose}
      actions={[
        { label: 'Cancelar', onClick: () => {} },
        { label: 'Guardar', primary: true, onClick: () => {
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
          toast(changed ? 'Información actualizada' : 'Sin cambios')
        } },
      ]}
    >
      <div className="cms-upload">
        <div className="cms-up-head">
          <div className="cms-meta-line"><strong>Sección:</strong> {meta.section}</div>
          <div className="cms-meta-line"><strong>Contenido:</strong> {meta.label}</div>
        </div>
        <div className="cms-up-fields">
          <div className="cms-fields-title">Información (se muestra en pantalla completa)</div>
          {fields.map((f) => (
            <label className="cms-field" key={f.key}>
              <span>{f.label}</span>
              {f.textarea ? (
                <textarea rows={2} defaultValue={f.value} ref={(n) => { valuesRef.current[f.key] = n }} />
              ) : (
                <input type="text" defaultValue={f.value} ref={(n) => { valuesRef.current[f.key] = n }} />
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
        Vas a mover «<strong>{meta.label}</strong>» a <strong>contenidos no usados</strong>.
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

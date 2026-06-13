'use client'

/* Agregar ilustración a la masonry — port de cms.js openAddIllustration():
   preview local + campos de info; guarda en addedIllu (dataURL) y la
   inserta en la grilla. */

import { useEffect, useRef, useState } from 'react'
import { CmsModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { fmtBytes } from '@/lib/utils'
import { validateFile, fileToDataURL } from '@/lib/media'
import { state, persistAdded, persistMedia, recordAudit, emit } from '@/lib/cms/store'
import { createGalleryItem } from './gallery'
import { rescan, seedUsedContent } from './engine'

const FIELD_DEFS = [
  { key: 'title', label: 'Título' },
  { key: 'date', label: 'Fecha' },
  { key: 'project', label: 'Proyecto' },
  { key: 'inspiration', label: 'Inspiración' },
  { key: 'desc', label: 'Descripción (al ver en pantalla completa)', textarea: true },
  { key: 'link', label: 'Link al repositorio (Instagram, ArtStation, etc.)' },
]

export default function AddIllustrationModal({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [objUrl, setObjUrl] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fieldRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({})

  useEffect(() => () => { if (objUrl) URL.revokeObjectURL(objUrl) }, [objUrl])

  const onPick = (f: File | undefined) => {
    if (!f) return
    const err = validateFile(f, 'webp')
    if (err) { toast(err, 'error'); return }
    if (objUrl) URL.revokeObjectURL(objUrl)
    setFile(f)
    setObjUrl(URL.createObjectURL(f))
  }

  const add = (): void | false => {
    if (!file) { toast('Seleccioná una imagen .webp', 'error'); return false }
    const val = (k: string) => fieldRefs.current[k]?.value || ''
    fileToDataURL(file).then((dataUrl) => {
      const entry = {
        id: 'illu_added_' + Date.now(), dataUrl,
        title: val('title') || 'Ilustración', desc: val('desc'), link: val('link'),
        name: file.name, size: file.size, type: file.type, ts: Date.now(),
      }
      state.addedIllu.push(entry)
      persistAdded()
      state.mediaMeta['added:' + entry.id] = {
        name: entry.name, size: entry.size, type: entry.type, ts: entry.ts,
        label: 'Ilustración agregada — ' + entry.title, section: 'Ilustraciones',
      }
      persistMedia()
      const grid = document.getElementById('illustrations-container')
      if (grid) {
        const item = createGalleryItem(entry.dataUrl, entry.title, entry.desc, entry.link)
        item.setAttribute('data-added-id', entry.id)
        const slot = grid.querySelector('.cms-add-slot')
        if (slot) grid.insertBefore(item, slot)
        else grid.appendChild(item)
      }
      rescan()
      seedUsedContent()
      recordAudit({
        section: 'Ilustraciones', label: 'Ilustración agregada — ' + entry.title, kind: 'imagen',
        summary: 'Ilustración agregada', file: { name: entry.name, size: entry.size, type: entry.type },
      })
      emit()
      toast('Ilustración agregada')
      onClose()
    })
    return false
  }

  return (
    <CmsModal
      title="Agregar ilustración" wide onClose={onClose}
      actions={[
        { label: 'Cancelar', onClick: () => {} },
        { label: 'Agregar', primary: true, onClick: add },
      ]}
    >
      <div className="cms-upload">
        <div className="cms-up-head">
          <div className="cms-meta-line"><strong>Sección:</strong> Ilustraciones</div>
          <div className="cms-meta-line"><strong>Acción:</strong> Agregar nueva ilustración</div>
          <div className="cms-meta-line cms-up-accept"><strong>Formato:</strong> imagen .webp (máx 25 MB)</div>
        </div>
        <div className="cms-up-preview">
          {objUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={objUrl} alt="" />
          ) : (
            <span className="cms-up-empty">Sin archivo seleccionado</span>
          )}
        </div>
        {file && (
          <div className="cms-up-fileinfo">
            <strong>Archivo:</strong> {file.name} &nbsp;·&nbsp; <strong>Peso:</strong> {fmtBytes(file.size)}
          </div>
        )}
        <button type="button" className="cms-btn" onClick={() => inputRef.current?.click()}>Seleccionar .webp</button>
        <input
          ref={inputRef} type="file" accept=".webp,image/webp" style={{ display: 'none' }}
          onChange={(e) => onPick(e.target.files?.[0])}
        />
        <div className="cms-up-fields">
          <div className="cms-fields-title">Datos del contenido</div>
          {FIELD_DEFS.map((f) => (
            <label className="cms-field" key={f.key}>
              <span>{f.label}</span>
              {f.textarea ? (
                <textarea rows={2} ref={(n) => { fieldRefs.current[f.key] = n }} />
              ) : (
                <input type="text" ref={(n) => { fieldRefs.current[f.key] = n }} />
              )}
            </label>
          ))}
        </div>
      </div>
    </CmsModal>
  )
}

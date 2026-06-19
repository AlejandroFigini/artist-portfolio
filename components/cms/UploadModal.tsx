'use client'

/* Subida de media a Cloudinary — port de cms.js editMedia(): formulario
   con nombre + campos de info, fase de subida bloqueada, vista de éxito
   con ahorro de compresión. El archivo ya viene validado (CmsRoot). */

import { useRef, useState } from 'react'
import { CmsModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { uploadMedia, type UploadResponse } from '@/lib/api'
import { fmtBytes } from '@/lib/utils'
import { fileToDataURL } from '@/lib/media'
import {
  state, recordAudit, persistUnused, persistUsed, persistRetired, performRenameContainer, type FieldValue,
} from '@/lib/cms/store'
import {
  elementsByKey, metaByKey, applyMedia, persistOverrides, clearEmptySlot, computeFields, syncWaveGroups, refreshTools,
} from './engine'

const CLOUDINARY_CONSOLE =
  'https://console.cloudinary.com/app/c-a240be86a764a00eb530a9f52db056/assets/media_library/search/asset'

type Props = { cmsKey: string; file: File; onClose: (success?: boolean) => void }

export default function UploadModal({ cmsKey, file, onClose }: Props) {
  const toast = useToast()
  const meta = metaByKey[cmsKey]
  const isVid = file.type.includes('video')
  const [phase, setPhase] = useState<'form' | 'uploading' | 'done' | 'error'>('form')
  const [result, setResult] = useState<UploadResponse | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const containerRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const fieldRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({})
  const [fields] = useState<FieldValue[]>(() => {
    const el = elementsByKey[cmsKey]
    return (el && meta && computeFields(cmsKey, el, meta)) || []
  })
  // Solo los campos NO opcionales deben completarse antes de habilitar la subida.
  const requiredDefs = (meta?.fields || []).filter((d) => !d.optional)
  const requiredKeys = requiredDefs.map((d) => d.key)
  const requiredLabels = requiredDefs.map((d) => d.label).join(', ')
  const isComplete = (read: (k: string) => string) => requiredKeys.every((k) => read(k).trim() !== '')
  const [fieldsComplete, setFieldsComplete] = useState(() =>
    isComplete((k) => fields.find((f) => f.key === k)?.value ?? ''))
  const recheckFields = () => setFieldsComplete(isComplete((k) => fieldRefs.current[k]?.value ?? ''))

  if (!meta) return null

  const doUpload = (): false => {
    const finalName = nameRef.current?.value.trim() || file.name
    const newContainerName = containerRef.current?.value.trim()
    if (newContainerName && newContainerName !== meta.label) {
      performRenameContainer(cmsKey, newContainerName)
      meta.label = newContainerName
    }
    // capturar valores de campos ANTES de cambiar de fase (port del legacy)
    const fieldValues = fields.map((f) => ({ f, val: fieldRefs.current[f.key]?.value ?? f.value }))
    setPhase('uploading')

    fileToDataURL(file)
      .then((base64) => uploadMedia(base64, file.size, finalName))
      .then((data) => {
        // versión anterior → no usados
        const prev = state.usedContent[cmsKey]
        if (prev) {
          state.unused.push({
            key: cmsKey, src: prev.src, dataUrl: prev.src, name: prev.name, size: prev.size,
            type: prev.kind === 'video' ? 'video/webm' : 'image/webp', ts: Date.now(),
            label: prev.label, section: prev.section, original: prev.original, reason: 'replaced',
          })
          persistUnused()
        }

        state.items[cmsKey] = data.secure_url
        applyMedia(cmsKey, data.secure_url)

        const el = elementsByKey[cmsKey]
        const cont = meta.container && el ? el.closest<HTMLElement>(meta.container) : el
        fieldValues.forEach(({ f, val }) => {
          if (val !== f.value) {
            state.items[cmsKey + '::' + f.key] = val
            const def = meta.fields?.find((d) => d.key === f.key)
            if (def && cont) def.set(cont, val)
            recordAudit({ section: meta.section, label: meta.label, kind: 'metadata', summary: `Campo "${f.label}" actualizado` })
          }
        })
        persistOverrides().catch(() => toast('Error de red al sincronizar con el servidor', 'error'))

        state.usedContent[cmsKey] = {
          key: cmsKey, label: meta.label, section: meta.section, kind: meta.kind as 'image' | 'video',
          src: data.secure_url, name: finalName, size: data.final_bytes, original: false,
        }
        persistUsed()

        const ri = state.retired.indexOf(cmsKey)
        if (ri >= 0) { state.retired.splice(ri, 1); persistRetired() }
        clearEmptySlot(cmsKey)
        refreshTools(cmsKey)
        if (cmsKey.startsWith('hero.wave')) syncWaveGroups()

        recordAudit({
          section: meta.section, label: meta.label,
          kind: meta.accept === 'webp' ? 'imagen' : 'video',
          summary: (meta.accept === 'webp' ? 'Imagen' : 'Video') + ' reemplazado',
          file: { name: finalName, size: data.final_bytes, type: data.final_format },
        })

        setResult({ ...data, original_name: finalName })
        setPhase('done')
      })
      .catch((err: Error) => {
        setErrorMsg(err.message)
        setPhase('error')
      })
    return false
  }

  const actions =
    phase === 'form'
      ? [
          { label: 'Cancelar', onClick: () => onClose(false) },
          {
            label: 'Comprimir y subir a Cloudinary', primary: true,
            disabled: !fieldsComplete,
            title: fieldsComplete ? undefined : `Completá los campos obligatorios (${requiredLabels}) antes de subir`,
            onClick: doUpload,
          },
        ]
      : phase === 'uploading'
        ? []
        : [{ label: phase === 'done' ? 'Cerrar y actualizar' : 'Cerrar', primary: true, onClick: () => onClose(phase === 'done') }]

  return (
    <CmsModal title="Subir contenido" wide locked={phase === 'uploading'} onClose={() => onClose(phase === 'done')} actions={actions}>
      {phase === 'form' && (
        <div className="cms-upload cms-upload--compact">
          <div className="cms-up-head">
            <div className="cms-meta-line"><strong>Página:</strong> <span style={{ opacity: 0.85 }}>Feed principal</span></div>
            <div className="cms-meta-line"><strong>Sección:</strong> <span style={{ opacity: 0.85 }}>{meta.section}</span></div>
          </div>
          <label className="cms-field" style={{ marginTop: '0.75rem' }}>
            <span>Nombre del contenedor</span>
            <input ref={containerRef} type="text" defaultValue={meta.label} style={{ fontWeight: 400 }} />
          </label>
          <label className="cms-field" style={{ marginTop: '0.6rem' }}>
            <span>Nombre del archivo</span>
            <input ref={nameRef} type="text" defaultValue={file.name} />
          </label>
          <div style={{ display: 'flex', gap: '1.2rem', fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            <div><span style={{ fontWeight: 400 }}>Tamaño:</span> <span style={{ fontFamily: "'Fira Code', monospace", fontWeight: 400 }}>{fmtBytes(file.size)}</span></div>
            <div><span style={{ fontWeight: 400 }}>Formato:</span> <span style={{ fontWeight: 400 }}>{file.type || 'Archivo'}</span></div>
          </div>
          {fields.length > 0 && (
            <div className="cms-up-fields" style={{ marginTop: '0.8rem' }}>
              <div className="cms-fields-title">Datos del contenido</div>
              {fields.map((f) => (
                <label className="cms-field" key={f.key}>
                  <span>{f.label}</span>
                  {f.textarea ? (
                    <textarea rows={2} defaultValue={f.value} ref={(n) => { fieldRefs.current[f.key] = n }} onChange={recheckFields} />
                  ) : (
                    <input
                      type={f.key === 'date' ? 'date' : 'text'}
                      defaultValue={f.value}
                      ref={(n) => { fieldRefs.current[f.key] = n }}
                      onChange={recheckFields}
                    />
                  )}
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {phase === 'uploading' && (
        <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
          <i className="fa-solid fa-circle-notch fa-spin fa-3x" style={{ color: 'var(--accent)' }}></i>
          <h3 style={{ marginTop: '1rem', color: 'var(--text-primary)' }}>Subiendo y comprimiendo...</h3>
          <p className="cms-admin-sub">Esto puede tardar unos segundos dependiendo del tamaño.</p>
        </div>
      )}

      {phase === 'done' && result && (
        <div className="cms-upload-done">
          <div className="cms-upload-done__head">
            <i className="fa-solid fa-circle-check" style={{ color: 'var(--accent)' }}></i>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>Subida exitosa</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                <strong>Se colocará en:</strong> {meta.label} &middot; {meta.section}
              </div>
            </div>
          </div>
          <div className="cms-upload-done__grid">
            <div className="cms-upload-done__preview">
              {isVid ? (
                <video src={result.secure_url} controls style={{ width: '100%', maxHeight: '34vh', objectFit: 'contain', borderRadius: 6, display: 'block', background: '#000' }}></video>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={result.secure_url} alt="Subida" style={{ width: '100%', maxHeight: '34vh', objectFit: 'contain', borderRadius: 6, display: 'block' }} />
              )}
            </div>
            <ul className="cms-upload-done__meta">
              <li><strong>Archivo:</strong> <span>{result.original_name}</span></li>
              <li><strong>Tipo:</strong> {isVid ? 'Video' : 'Imagen'} &middot; {result.final_format}</li>
              <li>
                <strong>Tamaño:</strong>{' '}
                <span style={{ fontFamily: "'Fira Code', monospace" }}>{fmtBytes(result.final_bytes)}</span>{' '}
                <span style={{ fontSize: '0.78rem', opacity: 0.7 }}>(inicial: {fmtBytes(file.size)})</span>
              </li>
              <li>
                <strong style={{ color: 'var(--accent)' }}>Ahorro:</strong>{' '}
                <strong style={{ color: 'var(--accent)', fontFamily: "'Fira Code', monospace" }}>
                  {file.size > result.final_bytes ? Math.round((1 - result.final_bytes / file.size) * 100) + '%' : '0%'}
                </strong>
              </li>
              {result.asset_id && (
                <li>
                  <a
                    href={`${CLOUDINARY_CONSOLE}/${encodeURIComponent(result.asset_id)}/manage/summary?q=&view_mode=mosaic&context=manage`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ color: '#a78bfa', textDecoration: 'none', fontSize: '0.78rem' }}
                  >
                    <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '0.72rem' }}></i> Ver en Cloudinary
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div style={{ color: '#ef4444', padding: '1rem', background: 'rgba(239,68,68,0.1)', borderRadius: 8 }}>
          <i className="fa-solid fa-circle-exclamation"></i> Error: {errorMsg}
        </div>
      )}
    </CmsModal>
  )
}

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
  state, recordAudit, persistUnused, persistUsed, persistRetired, type FieldValue,
} from '@/lib/cms/store'
import {
  elementsByKey, metaByKey, applyMedia, persistOverrides, clearEmptySlot, computeFields, syncWaveGroups,
} from './engine'

const CLOUDINARY_CONSOLE =
  'https://console.cloudinary.com/app/c-a240be86a764a00eb530a9f52db056/assets/media_library/search/asset'

type Props = { cmsKey: string; file: File; onClose: () => void }

export default function UploadModal({ cmsKey, file, onClose }: Props) {
  const toast = useToast()
  const meta = metaByKey[cmsKey]
  const isVid = file.type.includes('video')
  const [phase, setPhase] = useState<'form' | 'uploading' | 'done' | 'error'>('form')
  const [result, setResult] = useState<UploadResponse | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)
  const fieldRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({})
  const [fields] = useState<FieldValue[]>(() => {
    const el = elementsByKey[cmsKey]
    return (el && meta && computeFields(cmsKey, el, meta)) || []
  })

  if (!meta) return null

  const doUpload = (): false => {
    const finalName = nameRef.current?.value.trim() || file.name
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
          { label: 'Cancelar', onClick: () => {} },
          { label: 'Comprimir y subir a Cloudinary', primary: true, onClick: doUpload },
        ]
      : phase === 'uploading'
        ? []
        : [{ label: phase === 'done' ? 'Cerrar y actualizar' : 'Cerrar', primary: true, onClick: () => {} }]

  return (
    <CmsModal title="Subir contenido" wide locked={phase === 'uploading'} onClose={onClose} actions={actions}>
      {phase === 'form' && (
        <div className="cms-upload">
          <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: 12, border: '1px solid var(--border)' }}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                Nombre del archivo
              </label>
              <input
                ref={nameRef}
                type="text"
                className="cms-field"
                defaultValue={file.name}
                style={{ width: '100%', padding: '0.6rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'inherit' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <div><strong>Tamaño:</strong> <span style={{ fontFamily: "'Fira Code', monospace" }}>{fmtBytes(file.size)}</span></div>
              <div><strong>Formato:</strong> {file.type || 'Archivo'}</div>
            </div>
            <p className="cms-admin-sub" style={{ margin: '1rem 0 0' }}>Se procesará con IA en la nube para máxima optimización.</p>
          </div>
          {fields.length > 0 && (
            <div className="cms-up-fields" style={{ marginTop: '1.5rem' }}>
              <div className="cms-fields-title">Datos del contenido</div>
              {fields.map((f) => (
                <label className="cms-field" key={f.key}>
                  <span>{f.label}</span>
                  {f.textarea ? (
                    <textarea rows={2} defaultValue={f.value} ref={(n) => { fieldRefs.current[f.key] = n }} />
                  ) : (
                    <input type="text" defaultValue={f.value} ref={(n) => { fieldRefs.current[f.key] = n }} />
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
        <div style={{ padding: '1.5rem', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <i className="fa-solid fa-cloud-arrow-up" style={{ color: 'var(--accent)' }}></i> Subida exitosa
          </h3>
          <div style={{ background: 'var(--bg-primary)', padding: '1rem', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            <div><strong style={{ color: 'var(--text-primary)' }}>Archivo:</strong> <span style={{ fontWeight: 500 }}>{result.original_name}</span></div>
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>Tamaño:</strong>{' '}
              <span style={{ fontFamily: "'Fira Code', monospace" }}>{fmtBytes(result.final_bytes)}</span>{' '}
              <span style={{ fontSize: '0.8rem' }}>(inicial: {fmtBytes(file.size)})</span>
            </div>
            <div><strong style={{ color: 'var(--text-primary)' }}>Tipo de contenido:</strong> {isVid ? 'Video' : 'Imagen'}</div>
            <div><strong style={{ color: 'var(--text-primary)' }}>Formato:</strong> {result.final_format}</div>
            <div style={{ marginTop: '0.4rem' }}>
              <strong style={{ color: 'var(--accent)' }}>Ahorro de tamaño:</strong>{' '}
              <strong style={{ color: 'var(--accent)', fontFamily: "'Fira Code', monospace" }}>
                {file.size > result.final_bytes ? Math.round((1 - result.final_bytes / file.size) * 100) + '%' : '0%'}
              </strong>
            </div>
            {result.asset_id && (
              <div style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px dashed var(--border)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Enlace en Cloudinary:</strong><br />
                <a
                  href={`${CLOUDINARY_CONSOLE}/${encodeURIComponent(result.asset_id)}/manage/summary?q=&view_mode=mosaic&context=manage`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ color: '#a78bfa', textDecoration: 'none', fontSize: '0.85rem', wordBreak: 'break-all' }}
                >
                  <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '0.75rem' }}></i> Ver en consola
                </a>
              </div>
            )}
          </div>
          {isVid ? (
            <video src={result.secure_url} controls style={{ maxWidth: '100%', borderRadius: 8, display: 'block' }}></video>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={result.secure_url} alt="Subida" style={{ maxWidth: '100%', maxHeight: '40vh', objectFit: 'contain', borderRadius: 8, display: 'block', margin: '0 auto' }} />
          )}
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

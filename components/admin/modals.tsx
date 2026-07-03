'use client'

/* Modales del panel de gestión — port de admin.js: viewMediaModal,
   renameContainerModal, openAssociateContainerModal, editInfo y la
   subida directa a Cloudinary (sección "Subir contenido"). */

import { useRef, useState } from 'react'
import { CmsModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { uploadMedia, type UploadResponse } from '@/lib/api'
import { fmtBytes, fmtDateOnly, fmtTimeOnly, isVideo } from '@/lib/utils'
import { fileToDataURL } from '@/lib/media'
import {
  state, getFormat, getContainerMeta, kindOf, recordAudit, emit,
  performRenameContainer, associateUnusedToContainer, associateUsedToContainer,
  loadJSON, saveJSON, LS, persistUsed, persistUnused,
} from '@/lib/cms/store'
import { buildPageTree } from '@/lib/cms/pages'
import type { AnyEntry } from './cards'

type CloseProp = { onClose: () => void }

const toggleSet = (upd: (u: (prev: Set<string>) => Set<string>) => void, id: string) =>
  upd((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })

// ----- Renombrar contenedor ----------------------------------------------------

export function RenameContainerModal({ cmsKey, onClose }: CloseProp & { cmsKey: string }) {
  const current =
    state.usedContent[cmsKey]?.label ||
    state.unused.find((x) => x.key === cmsKey)?.label ||
    state.containerNames[cmsKey] || cmsKey
  const inputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  return (
    <CmsModal
      title="Renombrar contenedor" onClose={onClose}
      actions={[
        { label: 'Cancelar', onClick: () => {} },
        { label: 'Guardar', primary: true, onClick: () => {
          const newLabel = inputRef.current?.value.trim() || ''
          if (!newLabel) { toast('El nombre no puede estar vacío.', 'error'); return false }
          performRenameContainer(cmsKey, newLabel)
        } },
      ]}
    >
      <div className="cms-upload">
        <div className="cms-meta-line" style={{ marginBottom: '1rem' }}><strong>Contenedor actual:</strong> {current}</div>
        <div className="cms-field" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <span>Nuevo nombre del contenedor:</span>
          <input ref={inputRef} type="text" className="cms-input" style={{ width: '100%' }} defaultValue={current} autoFocus />
        </div>
      </div>
    </CmsModal>
  )
}

// ----- Asociar a contenedor ------------------------------------------------------

type AssociateProps = CloseProp & { item: AnyEntry; isUnused: boolean; unusedIdx: number }

export function AssociateContainerModal({ item, isUnused, unusedIdx, onClose }: AssociateProps) {
  const itemKind = kindOf(item)
  const allKeys = Array.from(new Set([...Object.keys(state.usedContent), ...state.retired]))
  // contenedores compatibles → entradas del árbol Página → Sección (mismo orden que "En uso")
  const containers = allKeys
    .map((k) => { const meta = getContainerMeta(k); return { key: k, section: meta.section, size: 0, meta, occ: state.usedContent[k] } })
    .filter((c) => c.meta.kind === itemKind)
  const tree = buildPageTree(containers)

  const [openPages, setOpenPages] = useState<Set<string>>(() => new Set())
  const [openSecs, setOpenSecs] = useState<Set<string>>(() => new Set())

  const choose = (targetKey: string) => {
    if (isUnused) associateUnusedToContainer(unusedIdx, targetKey)
    else associateUsedToContainer((item as { key?: string }).key || '', targetKey)
    onClose()
  }

  const contBadge = (n: number) => `${n} contenedor${n === 1 ? '' : 'es'}`

  return (
    <CmsModal title="Asociar a nuevo contenedor" wide onClose={onClose} actions={[{ label: 'Cancelar', onClick: () => {} }]}>
      <div className="cms-upload" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
        <p className="cms-admin-sub" style={{ marginBottom: '1rem' }}>
          Asociar el archivo <strong>{item.name || '—'}</strong> a un contenedor.
        </p>
        <div className="admin-tree">
          {tree.map((page) => {
            const pOpen = openPages.has(page.id)
            return (
              <div className="admin-tree-page" key={page.id}>
                <div className={`admin-tree-row admin-tree-row--page${pOpen ? ' open' : ''}`}>
                  <button type="button" className="admin-tree-rowbtn" onClick={() => toggleSet(setOpenPages, page.id)} aria-expanded={pOpen}>
                    <i className="fa-solid fa-chevron-right admin-tree-caret"></i>
                    <i className={`fa-solid ${page.icon} admin-tree-icon`}></i>
                    <span className="admin-tree-label">{page.label}</span>
                    {page.count > 0 && <span className="admin-badge">{contBadge(page.count)}</span>}
                  </button>
                </div>
                {pOpen && (
                  <div className="admin-tree-sections">
                    {page.sections.length === 0 && (
                      <p className="cms-admin-sub admin-tree-empty">Esta página todavía no tiene secciones.</p>
                    )}
                    {page.sections.map((s) => {
                      const sid = `${page.id}:${s.id}`
                      const sOpen = openSecs.has(sid)
                      return (
                        <div className="admin-tree-section" key={sid}>
                          <div className={`admin-tree-row admin-tree-row--section${sOpen ? ' open' : ''}`}>
                            <button type="button" className="admin-tree-rowbtn" onClick={() => toggleSet(setOpenSecs, sid)} aria-expanded={sOpen}>
                              <i className="fa-solid fa-chevron-right admin-tree-caret"></i>
                              <span className="admin-tree-label">{s.label}</span>
                              {s.count > 0 && <span className="admin-badge">{contBadge(s.count)}</span>}
                            </button>
                          </div>
                          {sOpen && (
                            <div className="admin-tree-content" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              {s.count === 0
                                ? <p className="cms-admin-sub admin-tree-empty">Sin contenedores compatibles en esta sección.</p>
                                : s.items.map((c) => (
                                <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.7rem', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', textAlign: 'left', minWidth: 0, flex: 1 }}>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{c.meta.label}</span>
                                    <div style={{ fontSize: '0.75rem' }}>
                                      {c.occ ? (
                                        <>
                                          <span className="cms-tag" style={{ background: '#eab308', color: '#000' }}>Ocupado</span>{' '}
                                          <span style={{ opacity: 0.7 }} title={c.occ.name}>({c.occ.name || 'archivo'})</span>
                                        </>
                                      ) : (
                                        <span className="cms-tag" style={{ background: '#22c55e', color: '#fff' }}>Libre</span>
                                      )}
                                    </div>
                                  </div>
                                  <button type="button" className="cms-btn cms-btn--sm" style={{ padding: '4px 10px' }} onClick={() => choose(c.key)}>
                                    Seleccionar
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </CmsModal>
  )
}

// ----- Editar información (variante admin: campos de usedContent) -------------------

export function AdminEditInfoModal({ cmsKey, onClose }: CloseProp & { cmsKey: string }) {
  const entry = state.usedContent[cmsKey]
  const fields = entry?.fields || []
  const refs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({})

  if (!entry) return null

  return (
    <CmsModal
      title="Editar información" wide onClose={onClose}
      actions={fields.length === 0
        ? [{ label: 'Cerrar', primary: true, onClick: () => {} }]
        : [
            { label: 'Cancelar', onClick: () => {} },
            { label: 'Guardar', primary: true, onClick: () => {
              const items = loadJSON<Record<string, string>>(LS.OVERRIDES, {})
              let changed = false
              fields.forEach((f) => {
                const v = refs.current[f.key]?.value
                if (v != null && v !== f.value) {
                  items[cmsKey + '::' + f.key] = v
                  f.value = v
                  changed = true
                }
              })
              saveJSON(LS.OVERRIDES, items)
              persistUsed()
              if (changed) recordAudit({ user: 'superadmin', section: entry.section, label: entry.label, summary: 'Información editada' })
              emit()
            } },
          ]}
    >
      <div className="cms-upload">
        <div className="cms-up-head">
          <div className="cms-meta-line"><strong>Sección:</strong> {entry.section}</div>
          <div className="cms-meta-line"><strong>Contenido:</strong> {entry.label}</div>
        </div>
        {fields.length === 0 ? (
          <p className="cms-admin-sub">Este contenido no tiene campos de información editables.</p>
        ) : (
          <div className="cms-up-fields">
            <div className="cms-fields-title">Información (se muestra en pantalla completa)</div>
            {fields.map((f) => (
              <label className="cms-field" key={f.key}>
                <span>{f.label}</span>
                {f.textarea ? (
                  <textarea rows={2} defaultValue={f.value} ref={(n) => { refs.current[f.key] = n }} />
                ) : (
                  <input type="text" defaultValue={f.value} ref={(n) => { refs.current[f.key] = n }} />
                )}
              </label>
            ))}
          </div>
        )}
      </div>
    </CmsModal>
  )
}

// ----- Vista previa de contenido -----------------------------------------------------

type ViewProps = CloseProp & {
  e: AnyEntry
  cardType: 'used' | 'unused' | 'trash' | 'repo'
  menu: { label: React.ReactNode; onClick: () => void }[]
}

export function ViewMediaModal({ e, cardType, menu, onClose }: ViewProps) {
  const src = e.src || e.dataUrl
  if (!src || src === 'null' || src === 'undefined') return null
  const vid = isVideo(e.type || (e as { kind?: string }).kind, e.name)
  const ts = cardType === 'trash' || (cardType === 'repo' && e._state === 'trash') ? e.deletedAt : e.ts

  return (
    <CmsModal
      title="Vista previa de contenido" wide compactActions onClose={onClose}
      actions={[
        // la acción cierra esta vista previa y abre el modal/confirm correspondiente;
        // devolver false evita que CmsModal dispare onClose por segunda vez (pisaba el setModal)
        ...menu.map((m) => ({ label: m.label, onClick: () => { onClose(); m.onClick(); return false as const } })),
        { label: <><i className="fa-solid fa-xmark" style={{ marginRight: 6 }}></i> Cerrar</>, primary: true, onClick: () => {} },
      ]}
    >
      <div>
        {vid ? (
          <video src={src} controls autoPlay style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: 8, display: 'block', margin: '0 auto' }}></video>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={src} alt="" style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: 8, display: 'block', margin: '0 auto' }} />
        )}
        <div style={{ marginTop: '1.5rem', textAlign: 'left', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 8, border: '1px solid var(--border)' }}>
          {e.label && <h4 style={{ marginBottom: '0.5rem', color: 'var(--accent)', fontWeight: 700 }}>{e.label}</h4>}
          <div className="cms-mlib-meta" style={{ fontSize: '0.9rem', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <div><strong>Nombre:</strong> {e.name || '—'}</div>
            <div><strong>Formato:</strong> {getFormat(e)}</div>
            <div><strong>Tamaño:</strong> {fmtBytes(e.size)}</div>
            <div><strong>Fecha de subida:</strong> {ts ? fmtDateOnly(ts) : '—'}</div>
            <div><strong>Hora de subida:</strong> {ts ? fmtTimeOnly(ts) : '—'}</div>
          </div>
        </div>
      </div>
    </CmsModal>
  )
}

// ----- Subida directa (sección "Subir contenido") --------------------------------------

export function AdminUploadModal({ file, onClose }: CloseProp & { file: File }) {
  const [phase, setPhase] = useState<'form' | 'uploading' | 'done' | 'error'>('form')
  const [result, setResult] = useState<UploadResponse | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)
  const isVid = file.type.includes('video')

  const doUpload = () => {
    const finalName = nameRef.current?.value.trim() || file.name
    setPhase('uploading')
    fileToDataURL(file)
      .then((base64) => uploadMedia(base64, file.size, finalName))
      .then((data) => {
        // historial de las últimas 3 subidas (LS_UPLOAD_TEST)
        const hist = loadJSON<Record<string, unknown>[]>(LS.UPLOAD_TEST, [])
        hist.unshift({ ...data, origSize: file.size, origType: file.type, originalName: finalName, ts: Date.now() })
        if (hist.length > 4) hist.length = 4
        saveJSON(LS.UPLOAD_TEST, hist)
        // entra al repositorio como "sin usar"
        state.unused.push({
          src: data.secure_url, dataUrl: data.secure_url, name: finalName, size: data.final_bytes,
          type: isVid ? 'video/webm' : 'image/webp', ts: Date.now(),
          label: finalName, section: '', original: true, reason: 'upload',
        })
        persistUnused()
        emit()
        setResult({ ...data, original_name: finalName })
        setPhase('done')
      })
      .catch((err: Error) => { setErrorMsg(err.message); setPhase('error') })
    return false as const
  }

  const actions =
    phase === 'form'
      ? [
          { label: 'Cancelar', onClick: () => {} },
          { label: 'Comprimir y subir en Cloudinary', primary: true, onClick: doUpload },
        ]
      : phase === 'uploading'
        ? []
        : [{ label: phase === 'done' ? 'Cerrar y actualizar' : 'Cerrar', primary: true, onClick: () => {} }]

  return (
    <CmsModal title="Subir nuevo contenido" wide locked={phase === 'uploading'} onClose={onClose} actions={actions}>
      {phase === 'form' && (
        <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: 12, border: '1px solid var(--border)' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Nombre del archivo</label>
            <input ref={nameRef} type="text" className="cms-field" defaultValue={file.name}
              style={{ width: '100%', padding: '0.6rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <div><strong>Tamaño:</strong> <span style={{ fontFamily: "'Fira Code', monospace" }}>{fmtBytes(file.size)}</span></div>
            <div><strong>Tipo de contenido:</strong> {isVid ? 'Video' : 'Imagen'}</div>
            <div><strong>Formato:</strong> {file.type || 'Archivo'}</div>
          </div>
          <p className="cms-admin-sub" style={{ margin: '1rem 0 0' }}>Se procesará con IA en la nube para máxima optimización.</p>
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
            <div><strong style={{ color: 'var(--text-primary)' }}>Archivo:</strong> {result.original_name}</div>
            <div><strong style={{ color: 'var(--text-primary)' }}>Tamaño:</strong> <span style={{ fontFamily: "'Fira Code', monospace" }}>{fmtBytes(result.final_bytes)}</span> <span style={{ fontSize: '0.8rem' }}>(inicial: {fmtBytes(file.size)})</span></div>
            <div><strong style={{ color: 'var(--text-primary)' }}>Formato:</strong> {result.final_format}</div>
            <div style={{ marginTop: '0.4rem' }}>
              <strong style={{ color: 'var(--accent)' }}>Ahorro de tamaño:</strong>{' '}
              <strong style={{ color: 'var(--accent)', fontFamily: "'Fira Code', monospace" }}>
                {file.size > result.final_bytes ? Math.round((1 - result.final_bytes / file.size) * 100) + '%' : '0%'}
              </strong>
            </div>
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

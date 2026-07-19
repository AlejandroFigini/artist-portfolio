'use client'

/* Modales del panel de gestión — port de admin.js: viewMediaModal,
   renameContainerModal, openAssociateContainerModal, editInfo y la
   subida directa a Cloudinary (sección "Subir contenido"). */

import { useRef, useState } from 'react'
import { CmsModal, useModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { uploadMedia, type UploadResponse } from '@/lib/api'
import { fmtBytes, fmtDateOnly, fmtTimeOnly, isVideo, getFileBasename, getFileExtension, ensureExtension } from '@/lib/utils'
import { fileToDataURL } from '@/lib/media'
import {
  state, getFormat, getContainerMeta, kindOf, recordAudit, emit,
  performRenameContainer, associateUnusedToContainer, associateUsedToContainer,
  loadJSON, saveJSON, LS, persistUsed, persistUnused, recordMediaMeta, getAllKnownContainerKeys,
  moveUsedToUnused, type UsedEntry,
} from '@/lib/cms/store'
import { buildPageTree, getPageAndSectionInfo } from '@/lib/cms/pages'
import { Thumb, type AnyEntry } from './cards'

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
      title="Rename container" onClose={onClose}
      actions={[
        { label: 'Cancel', onClick: () => {} },
        { label: 'Save', primary: true, onClick: () => {
          const newLabel = inputRef.current?.value.trim() || ''
          if (!newLabel) { toast('Name cannot be empty.', 'error'); return false }
          performRenameContainer(cmsKey, newLabel)
        } },
      ]}
    >
      <div className="cms-upload">
        <div className="cms-meta-line" style={{ marginBottom: '1rem' }}><strong>Current container:</strong> {current}</div>
        <div className="cms-field" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <span>New container name:</span>
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
  const allKeys = getAllKnownContainerKeys()
  // contenedores compatibles → entradas del árbol Página → Sección (mismo orden que "En uso")
  const containers = allKeys
    .map((k) => { const meta = getContainerMeta(k); return { key: k, section: meta.section, size: 0, meta, occ: state.usedContent[k] } })
  const tree = buildPageTree(containers)

  const [openPages, setOpenPages] = useState<Set<string>>(() => new Set())
  const [openSecs, setOpenSecs] = useState<Set<string>>(() => new Set())

  const choose = (targetKey: string) => {
    if (isUnused) associateUnusedToContainer(unusedIdx, targetKey)
    else associateUsedToContainer((item as { key?: string }).key || '', targetKey)
    onClose()
  }

  const contBadge = (n: number) => `${n} container${n === 1 ? '' : 's'}`

  return (
    <CmsModal title="Associate with container" wide onClose={onClose} actions={[{ label: 'Cancel', onClick: () => {} }]}>
      <div className="cms-upload" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1rem', padding: '0.6rem', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
            <Thumb e={item} />
          </div>
          <div style={{ overflow: 'hidden' }}>
            <strong style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name || item.label || '—'}</strong>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{kindOf(item) === 'video' ? 'Video / Animation' : 'Image'} {item.size ? `· ${fmtBytes(item.size)}` : ''}</span>
          </div>
        </div>
        <div className="admin-tree">
          {tree.map((page) => {
            const pOpen = openPages.has(page.id)
            const pageOcc = page.sections.reduce((acc, sec) => acc + sec.items.filter(c => c.occ).length, 0)
            return (
              <div className="admin-tree-page" key={page.id}>
                <div className={`admin-tree-row admin-tree-row--page${pOpen ? ' open' : ''}`}>
                  <button type="button" className="admin-tree-rowbtn" onClick={() => toggleSet(setOpenPages, page.id)} aria-expanded={pOpen}>
                    <i className="fa-solid fa-chevron-right admin-tree-caret"></i>
                    <i className={`fa-solid ${page.icon} admin-tree-icon`}></i>
                    <span className="admin-tree-label">{page.label}</span>
                    {page.count > 0 && (
                      <span style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center', marginLeft: 'auto' }}>
                        <span className="admin-badge">{contBadge(page.count)}</span>
                        <span className="admin-badge" style={{ background: 'color-mix(in srgb, var(--accent) 15%, var(--bg-secondary))', color: 'var(--accent)', border: '1px solid color-mix(in srgb, var(--accent) 30%, var(--border))' }}>
                          {pageOcc} in use
                        </span>
                      </span>
                    )}
                  </button>
                </div>
                {pOpen && (
                  <div className="admin-tree-sections">
                    {page.sections.length === 0 && (
                      <p className="cms-admin-sub admin-tree-empty">This page has no sections yet.</p>
                    )}
                    {page.sections.map((s) => {
                      const sid = `${page.id}:${s.id}`
                      const sOpen = openSecs.has(sid)
                      const secOcc = s.items.filter(c => c.occ).length
                      return (
                        <div className="admin-tree-section" key={sid}>
                          <div className={`admin-tree-row admin-tree-row--section${sOpen ? ' open' : ''}`}>
                            <button type="button" className="admin-tree-rowbtn" onClick={() => toggleSet(setOpenSecs, sid)} aria-expanded={sOpen}>
                              <i className="fa-solid fa-chevron-right admin-tree-caret"></i>
                              <span className="admin-tree-label">{s.label}</span>
                              {s.count > 0 && (
                                <span style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center', marginLeft: 'auto' }}>
                                  <span className="admin-badge">{contBadge(s.count)}</span>
                                  <span className="admin-badge" style={{ background: 'color-mix(in srgb, var(--accent) 15%, var(--bg-secondary))', color: 'var(--accent)', border: '1px solid color-mix(in srgb, var(--accent) 30%, var(--border))' }}>
                                    {secOcc} in use
                                  </span>
                                </span>
                              )}
                            </button>
                          </div>
                          {sOpen && (
                            <div className="admin-tree-content" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              {s.count === 0
                                ? <p className="cms-admin-sub admin-tree-empty">No containers in this section.</p>
                                : s.items.map((c) => {
                                  const isCompat = c.meta.kind === itemKind
                                  return (
                                  <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.7rem', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', minWidth: 0, flex: 1 }}>
                                      {c.occ && (
                                        <div style={{ width: '40px', height: '40px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border)', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                          <Thumb e={c.occ} />
                                        </div>
                                      )}
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', textAlign: 'left', minWidth: 0, flex: 1 }}>
                                        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{c.meta.label}</span>
                                        <div style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                          {!isCompat && (
                                            <span className="cms-tag" style={{ background: '#ef4444', color: '#fff' }}>
                                              Incompatible ({c.meta.kind === 'video' ? 'requires video' : 'requires image'})
                                            </span>
                                          )}
                                          {c.occ ? (
                                            <>
                                              <span className="cms-tag" style={{ background: '#eab308', color: '#000' }}>In use</span>
                                              <span style={{ opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.occ.name}>({c.occ.name || 'file'})</span>
                                            </>
                                          ) : (
                                            <span className="cms-tag" style={{ background: '#22c55e', color: '#fff' }}>Free</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      className="cms-btn cms-btn--sm"
                                      style={{ padding: '4px 10px', flexShrink: 0, opacity: isCompat ? 1 : 0.4, cursor: isCompat ? 'pointer' : 'not-allowed' }}
                                      disabled={!isCompat}
                                      onClick={() => { if (isCompat) choose(c.key) }}
                                    >
                                      Select
                                    </button>
                                  </div>
                                  )
                                })}
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
      title="Edit Information" wide onClose={onClose}
      actions={fields.length === 0
        ? [{ label: 'Close', primary: true, onClick: () => {} }]
        : [
            { label: 'Cancel', onClick: () => {} },
            { label: 'Save', primary: true, onClick: () => {
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
              if (changed) recordAudit({ user: 'superadmin', section: entry.section, label: entry.label, summary: 'Information edited' })
              emit()
            } },
          ]}
    >
      <div className="cms-upload">
        <div className="cms-up-head">
          <div className="cms-meta-line"><strong>Section:</strong> {entry.section}</div>
          <div className="cms-meta-line"><strong>Content:</strong> {entry.label}</div>
        </div>
        {fields.length === 0 ? (
          <p className="cms-admin-sub">This content has no editable information fields.</p>
        ) : (
          <div className="cms-up-fields">
            <div className="cms-fields-title">Information (shown in full screen)</div>
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

export function SelectContainerActionModal({
  action,
  occs,
  onSelect,
  onClose,
}: {
  action: 'editInfo' | 'rename' | 'remove'
  occs: UsedEntry[]
  onSelect: (key: string) => void
  onClose: () => void
}) {
  const { confirm } = useModal()
  const title = action === 'editInfo'
    ? 'Select container to edit info'
    : action === 'rename'
    ? 'Select container to rename'
    : 'Select container to remove content from'

  return (
    <CmsModal title={title} onClose={onClose} actions={[{ label: 'Cancel', onClick: () => {} }]}>
      <div style={{ padding: '0.3rem 0' }}>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          This file is currently used in <strong>{occs.length} containers</strong>. Select which container you want to {action === 'editInfo' ? 'edit details for' : action === 'rename' ? 'rename' : 'remove this content from'}:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '55vh', overflowY: 'auto' }}>
          {occs.map((u) => {
            const info = getPageAndSectionInfo(u)
            const label = u.label || (u.key ? getContainerMeta(u.key).label : '') || u.key
            return (
              <div
                key={u.key}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
                  padding: '0.75rem 1rem', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                  borderRadius: '8px', cursor: action !== 'remove' ? 'pointer' : 'default'
                }}
                onClick={action !== 'remove' ? () => { onClose(); onSelect(u.key) } : undefined}
              >
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.92rem' }}>{label}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    <strong>Page:</strong> {info.page} · <strong>Section:</strong> {info.section}
                  </div>
                </div>
                <button
                  type="button"
                  className={action === 'remove' ? 'cms-btn cms-btn--sm cms-batch-danger' : 'cms-btn cms-btn--sm cms-btn--primary'}
                  onClick={(ev) => {
                    ev.stopPropagation()
                    if (action === 'remove') {
                      const otherCount = occs.length - 1
                      if (otherCount > 0) {
                        confirm('Remove from container',
                          `Remove content from "${label}"? The file will stay active in ${otherCount} other container${otherCount > 1 ? 's' : ''}.`,
                          () => { moveUsedToUnused(u.key); onClose() })
                      } else {
                        confirm('Move to Unused',
                          `Remove content from "${label}" and move to Unused?`,
                          () => { moveUsedToUnused(u.key); onClose() })
                      }
                    } else {
                      onClose()
                      onSelect(u.key)
                    }
                  }}
                >
                  <i className={`fa-solid ${action === 'editInfo' ? 'fa-pen' : action === 'rename' ? 'fa-signature' : 'fa-xmark'}`} style={{ marginRight: '0.35rem' }}></i>
                  {action === 'editInfo' ? 'Edit info' : action === 'rename' ? 'Rename' : 'Remove'}
                </button>
              </div>
            )
          })}
        </div>
        {action === 'remove' && occs.length > 1 && (
          <div style={{ marginTop: '1.2rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
            <button
              type="button"
              className="cms-btn cms-btn--sm cms-batch-danger"
              style={{ width: '100%', padding: '0.65rem' }}
              onClick={() => {
                confirm('Move all to Unused',
                  `Remove this file from ALL ${occs.length} containers and move it to Unused?`,
                  () => {
                    occs.forEach(u => moveUsedToUnused(u.key))
                    onClose()
                  })
              }}
            >
              <i className="fa-solid fa-folder-closed" style={{ marginRight: '0.4rem' }}></i>
              Remove from ALL ({occs.length}) containers & Move to Unused
            </button>
          </div>
        )}
      </div>
    </CmsModal>
  )
}

export function ViewMediaModal({ e, cardType, menu, onClose }: ViewProps) {
  const src = e.src || e.dataUrl
  if (!src || src === 'null' || src === 'undefined') return null
  const vid = isVideo(e.type || (e as { kind?: string }).kind, e.name)
  const ts = cardType === 'trash' || (cardType === 'repo' && e._state === 'trash') ? e.deletedAt : e.ts
  const occs = e.src && cardType === 'used' ? Object.values(state.usedContent).filter(u => u.src === e.src) : []
  const occCount = cardType === 'used' ? occs.length : (e.src ? Object.values(state.usedContent).filter(u => u.src === e.src).length : 0)
  const containerBase = e.key ? getContainerMeta(e.key).label : ''
  const isUnusedOrTrash = cardType === 'unused' || cardType === 'trash' || e._state === 'unused' || e._state === 'trash'
  const containerLabel = isUnusedOrTrash ? 'Previous container:' : 'Container:'

  return (
    <CmsModal
      title="Content Preview" wide compactActions onClose={onClose}
      actions={[
        // la acción cierra esta vista previa y abre el modal/confirm correspondiente;
        // devolver false evita que CmsModal dispare onClose por segunda vez (pisaba el setModal)
        ...menu.map((m) => ({ label: m.label, onClick: () => { onClose(); m.onClick(); return false as const } })),
        { label: <><i className="fa-solid fa-xmark" style={{ marginRight: 6 }}></i> Close</>, primary: true, onClick: () => {} },
      ]}
    >
      <div>
        {vid ? (
          <video src={src} controls autoPlay style={{ maxWidth: '100%', maxHeight: '40vh', borderRadius: 8, display: 'block', margin: '0 auto' }}></video>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={src} alt="" style={{ maxWidth: '100%', maxHeight: '40vh', borderRadius: 8, display: 'block', margin: '0 auto' }} />
        )}
        <div style={{ marginTop: '1.5rem', textAlign: 'left', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 8, border: '1px solid var(--border)' }}>
          <h4 style={{ marginBottom: '0.5rem', color: 'var(--accent)', fontWeight: 700 }}>{getFileBasename(e.name || e.label || 'Untitled')}</h4>
          <div className="cms-mlib-meta" style={{ fontSize: '0.9rem', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <div><strong>File name:</strong> {e.name || '—'}</div>
            <div><strong>Format:</strong> {getFormat(e)}</div>
            <div><strong>Size:</strong> {fmtBytes(e.size)}</div>
            <div><strong>Upload date:</strong> {ts ? `${fmtDateOnly(ts)} ${fmtTimeOnly(ts)}` : '—'}</div>
            <div>
              <strong>Cloudinary link:</strong>{' '}
              <a href={src} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>Open in new tab <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '0.8em', marginLeft: '2px' }}></i></a>
            </div>
            {occCount > 1 && (
              <div><strong>Uses:</strong> <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{`${occCount} times`}</span></div>
            )}
            {cardType === 'used' && occs.length > 1 ? (
              <div style={{ marginTop: '0.4rem', borderTop: '1px solid var(--border)', paddingTop: '0.4rem' }}>
                <strong style={{ display: 'block', marginBottom: '0.3rem' }}>Containers in use ({occs.length}):</strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {occs.map((u) => {
                    const info = getPageAndSectionInfo(u)
                    return (
                      <div key={u.key} style={{ fontSize: '0.84rem', background: 'var(--bg-primary)', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{u.label || (u.key ? getContainerMeta(u.key).label : '') || u.key}</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{info.page} / {info.section}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div><strong>{containerLabel}</strong> <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{containerBase || '—'}</span></div>
            )}
          </div>
        </div>
      </div>
    </CmsModal>
  )
}

// ----- Subida directa (sección "Subir contenido") --------------------------------------

export function AdminUploadModal({ files, onClose }: CloseProp & { files: File[] }) {
  const [phase, setPhase] = useState<'form' | 'uploading' | 'done' | 'error'>('form')
  const [results, setResults] = useState<(UploadResponse & { original_name: string; isVid: boolean })[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const [progressIndex, setProgressIndex] = useState(0)
  const nameRef = useRef<HTMLInputElement>(null)

  const [singleDuplicate, setSingleDuplicate] = useState(() => {
    if (files.length !== 1) return false
    const rawName = getFileBasename(files[0].name)
    const finalName = ensureExtension(rawName, files[0].name)
    const nameLower = finalName.toLowerCase()
    return Object.values(state.usedContent).some(u => u.name?.toLowerCase() === nameLower) || state.unused.some(u => u.name?.toLowerCase() === nameLower)
  })

  const [multiDuplicates] = useState<string[]>(() => {
    if (files.length <= 1) return []
    return files.filter(f => {
      const rawName = getFileBasename(f.name)
      const finalName = ensureExtension(rawName, f.name)
      const nameLower = finalName.toLowerCase()
      return Object.values(state.usedContent).some(u => u.name?.toLowerCase() === nameLower) || state.unused.some(u => u.name?.toLowerCase() === nameLower)
    }).map(f => f.name)
  })

  const checkSingleDuplicate = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (files.length !== 1) return
    const rawName = e.target.value.trim()
    if (!rawName) {
      setSingleDuplicate(false)
      return
    }
    const finalName = ensureExtension(rawName, files[0].name)
    const nameLower = finalName.toLowerCase()
    setSingleDuplicate(Object.values(state.usedContent).some(u => u.name?.toLowerCase() === nameLower) || state.unused.some(u => u.name?.toLowerCase() === nameLower))
  }

  const doUpload = () => {
    void (async () => {
      setPhase('uploading')
      setErrorMsg('')
      const uploaded: (UploadResponse & { original_name: string; isVid: boolean })[] = []
      
      try {
        for (let i = 0; i < files.length; i++) {
          setProgressIndex(i + 1)
          const file = files[i]
          const isVid = file.type.includes('video') || /\.(webm|mp4|mov)$/i.test(file.name)
          const rawName = (files.length === 1 && nameRef.current?.value.trim()) || getFileBasename(file.name)
          const finalName = ensureExtension(rawName, file.name)
          const base64 = await fileToDataURL(file)
          const data = await uploadMedia(base64, file.size, finalName, 'Direct uploads', 'unused')
          
          // historial de las últimas 3 subidas (LS_UPLOAD_TEST)
          const hist = loadJSON<Record<string, unknown>[]>(LS.UPLOAD_TEST, [])
          hist.unshift({ ...data, origSize: file.size, origType: file.type, originalName: finalName, ts: Date.now() })
          if (hist.length > 3) hist.length = 3
          saveJSON(LS.UPLOAD_TEST, hist)
          
          // entra al repositorio como "sin usar"
          state.unused.push({
            src: data.secure_url, dataUrl: data.secure_url, name: finalName, size: data.final_bytes,
            type: isVid ? 'video/webm' : 'image/webp', ts: Date.now(),
            label: finalName, section: '', original: true, reason: 'upload',
          })
          recordMediaMeta('', data.secure_url, { name: finalName, size: data.final_bytes, type: isVid ? 'video/webm' : 'image/webp', label: finalName, section: 'Direct uploads' })
          uploaded.push({ ...data, original_name: finalName, isVid })
        }
        
        persistUnused()
        emit()
        setResults(uploaded)
        setPhase('done')
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        setErrorMsg(msg)
        setPhase('error')
      }
    })()
    return false as const
  }

  const actions =
    phase === 'form'
      ? [
          { label: 'Cancel', onClick: () => {} },
          { label: files.length > 1 ? `Compress and upload ${files.length} files` : 'Compress and upload to Cloudinary', primary: true, disabled: singleDuplicate || multiDuplicates.length > 0, onClick: doUpload },
        ]
      : phase === 'uploading'
        ? []
        : [{ label: phase === 'done' ? 'Close and update' : 'Close', primary: true, onClick: () => {} }]

  return (
    <CmsModal title="Upload New Content" wide locked={phase === 'uploading'} onClose={onClose} actions={actions}>
      {phase === 'form' && (
        <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: 12, border: '1px solid var(--border)' }}>
          {files.length === 1 ? (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>File name</label>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <input ref={nameRef} type="text" className="cms-field" defaultValue={getFileBasename(files[0].name)}
                    onChange={checkSingleDuplicate}
                    style={{ flex: 1, width: '100%', padding: '0.6rem', borderRadius: 8, borderTopRightRadius: getFileExtension(files[0].name) ? 0 : 8, borderBottomRightRadius: getFileExtension(files[0].name) ? 0 : 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'inherit' }} />
                  {getFileExtension(files[0].name) && (
                    <span style={{ padding: '0.6rem 0.75rem', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderLeft: 0, borderRadius: '0 8px 8px 0', color: 'var(--text-secondary)', fontFamily: "'Fira Code', monospace", fontSize: '0.85rem', userSelect: 'none' }}>
                      {getFileExtension(files[0].name)}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <div><strong>Size:</strong> <span style={{ fontFamily: "'Fira Code', monospace" }}>{fmtBytes(files[0].size)}</span></div>
                <div><strong>Content type:</strong> {files[0].type.includes('video') ? 'Video' : 'Image'}</div>
                <div><strong>Format:</strong> {files[0].type || 'File'}</div>
              </div>
              {singleDuplicate && (
                <div style={{ padding: '0.75rem', marginTop: '1rem', background: 'color-mix(in srgb, #ef4444 15%, transparent)', border: '1px solid #ef4444', borderRadius: 8, color: '#ef4444', fontSize: '0.85rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <i className="fa-solid fa-triangle-exclamation" style={{ marginTop: '0.2rem' }}></i>
                  <div>
                    <strong style={{ display: 'block', marginBottom: '0.2rem' }}>Name already in use</strong>
                    There is already a file with this exact name in the repository. Please rename the file above to avoid conflicts.
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.6rem' }}>
                  <i className="fa-solid fa-layer-group" style={{ color: 'var(--accent)', marginRight: '0.4rem' }}></i>
                  {files.length} files selected for upload:
                </label>
                <div style={{ maxHeight: '250px', overflowY: 'auto', background: 'var(--bg-primary)', padding: '0.8rem', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {files.map((f, i) => {
                    const isDup = multiDuplicates.includes(f.name)
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', paddingBottom: '0.4rem', borderBottom: i < files.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <span style={{ fontWeight: 500, color: isDup ? '#ef4444' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                          <i className={`fa-solid ${f.type.includes('video') ? 'fa-film' : 'fa-image'}`} style={{ color: isDup ? '#ef4444' : 'var(--text-secondary)', marginRight: '0.5rem' }}></i>
                          {f.name}
                        </span>
                        <span style={{ fontFamily: "'Fira Code', monospace", color: isDup ? '#ef4444' : 'var(--text-secondary)', fontSize: '0.8rem' }}>{isDup ? 'Duplicate' : fmtBytes(f.size)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <strong>Total size:</strong> <span style={{ fontFamily: "'Fira Code', monospace" }}>{fmtBytes(files.reduce((acc, f) => acc + f.size, 0))}</span>
              </div>
              {multiDuplicates.length > 0 && (
                <div style={{ padding: '0.75rem', marginTop: '1rem', background: 'color-mix(in srgb, #ef4444 15%, transparent)', border: '1px solid #ef4444', borderRadius: 8, color: '#ef4444', fontSize: '0.85rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <i className="fa-solid fa-triangle-exclamation" style={{ marginTop: '0.2rem' }}></i>
                  <div>
                    <strong style={{ display: 'block', marginBottom: '0.2rem' }}>Duplicate names detected</strong>
                    {multiDuplicates.length} file(s) already exist in the repository with the same name. Please remove or rename them on your PC before uploading.
                  </div>
                </div>
              )}
            </>
          )}
          <p className="cms-admin-sub" style={{ margin: '1rem 0 0' }}>Processed with cloud AI for maximum optimization.</p>
        </div>
      )}
      {phase === 'uploading' && (
        <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
          <i className="fa-solid fa-circle-notch fa-spin fa-3x" style={{ color: 'var(--accent)' }}></i>
          <h3 style={{ marginTop: '1rem', color: 'var(--text-primary)' }}>
            {files.length > 1 ? `Uploading file ${progressIndex} of ${files.length}...` : 'Uploading and compressing...'}
          </h3>
          <p className="cms-admin-sub">This may take a few seconds depending on file size.</p>
        </div>
      )}
      {phase === 'done' && results.length > 0 && (
        <div style={{ padding: '1.5rem', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-secondary)', maxHeight: '65vh', overflowY: 'auto' }}>
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <i className="fa-solid fa-cloud-arrow-up" style={{ color: 'var(--accent)' }}></i>{' '}
            {results.length > 1 ? `${results.length} files uploaded successfully` : 'Upload successful'}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {results.map((result, i) => (
              <div key={i} style={{ background: 'var(--bg-primary)', padding: '1rem', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1rem' }}>
                  <div><strong style={{ color: 'var(--text-primary)' }}>File:</strong> {result.original_name}</div>
                  <div><strong style={{ color: 'var(--text-primary)' }}>Final size:</strong> <span style={{ fontFamily: "'Fira Code', monospace" }}>{fmtBytes(result.final_bytes)}</span></div>
                  <div><strong style={{ color: 'var(--text-primary)' }}>Format:</strong> {result.final_format}</div>
                </div>
                {result.isVid ? (
                  <video src={result.secure_url} controls style={{ maxWidth: '100%', maxHeight: '30vh', borderRadius: 8, display: 'block', margin: '0 auto' }}></video>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={result.secure_url} alt="Upload" style={{ maxWidth: '100%', maxHeight: '30vh', objectFit: 'contain', borderRadius: 8, display: 'block', margin: '0 auto' }} />
                )}
              </div>
            ))}
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

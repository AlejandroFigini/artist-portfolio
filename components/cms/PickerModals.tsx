'use client'

/* eslint-disable react-hooks/immutability */

/* Selectores de contenido — port de cms.js openContentPicker() (subir
   desde PC vs repositorio, con renombrado inline del contenedor) y
   openRepoPicker() (grilla del repo filtrada por tipo compatible). */

import { Fragment, useRef, useState } from 'react'
import { CmsModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { fmtBytes, fmtDateOnly, fmtTimeOnly, cloudinaryThumb } from '@/lib/utils'
import {
  state, getFormat, recordAudit, persistUnused, persistUsed, persistRetired, performRenameContainer, recordMediaMeta, retireUsedEntryToUnused, cloudinaryMove, verifySingleUrl, purgeUrlsFromAllState, emit,
} from '@/lib/cms/store'
import { getCloudinaryFolder, getPageAndSectionInfo } from '@/lib/cms/pages'
import {
  elementsByKey, metaByKey, applyMedia, persistOverrides, clearEmptySlot, computeFields,
  syncWaveGroups, refreshTools, refreshContainerLabel,
} from './engine'

// ----- Content Picker ---------------------------------------------------------

type ContentPickerProps = {
  cmsKey: string
  onLocal: () => void
  onRepo: () => void
  onClose: () => void
}

export function ContentPickerModal({ cmsKey, onLocal, onRepo, onClose }: ContentPickerProps) {
  const toast = useToast()
  const meta = metaByKey[cmsKey]
  const nameRef = useRef<HTMLInputElement>(null)
  const [editingName, setEditingName] = useState(false)

  if (!meta) return null
  const isVideo = meta.kind === 'video'

  const commitRename = () => {
    const newName = nameRef.current?.value.trim()
    if (newName && newName !== meta.label) {
      performRenameContainer(cmsKey, newName)
      meta.label = newName
      refreshContainerLabel(cmsKey)
      toast('Container updated')
    }
    setEditingName(false)
  }

  return (
    <CmsModal title="What would you like to do?" zIndex={100050} onClose={() => { commitRename(); onClose() }} actions={[{ label: 'Cancel', onClick: () => { commitRename() } }]}>
      <div>
        <div className="cms-up-head">
          <div className="cms-meta-line"><strong>Page:</strong> <span style={{ opacity: 0.85 }}>Main feed</span></div>
          <div className="cms-meta-line"><strong>Section:</strong> <span style={{ opacity: 0.85 }}>{meta.section}</span></div>
          <div className="cms-meta-line"><strong>Required type:</strong> <span style={{ opacity: 0.85 }}>{isVideo ? 'Video' : 'Image'}</span></div>
          <div className="cms-container-name-row" style={{ marginTop: '0.55rem', paddingTop: '0.55rem', borderTop: '1px solid rgba(124,58,237,0.12)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {editingName ? (
              <label className="cms-field" style={{ flex: 1, margin: 0 }}>
                <span>Container name</span>
                <input ref={nameRef} type="text" defaultValue={meta.label} autoFocus style={{ fontWeight: 400 }} onBlur={commitRename} onKeyDown={(e) => { if (e.key === 'Enter') commitRename() }} />
              </label>
            ) : (
              <div className="cms-meta-line" style={{ flex: 1 }}>
                <strong>Container:</strong> <span style={{ opacity: 0.85 }}>{meta.label}</span>
              </div>
            )}
            <button
              type="button"
              title={editingName ? 'Save name' : 'Rename container'}
              aria-label={editingName ? 'Save name' : 'Rename container'}
              onMouseDown={(e) => e.preventDefault()}
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
        </div>
        <div className="cms-picker-grid">
          <button type="button" className="cms-picker-option" onClick={onLocal}>
            <i className="fa-solid fa-file-arrow-up"></i>
            <span className="cms-picker-title">Upload from your PC</span>
            <span className="cms-picker-desc">Select a new file from your computer to upload and assign here.</span>
          </button>
          <button type="button" className="cms-picker-option" onClick={onRepo}>
            <i className="fa-solid fa-cloud"></i>
            <span className="cms-picker-title">Use from repository</span>
            <span className="cms-picker-desc">Choose a file that was previously uploaded to the content repository.</span>
          </button>
        </div>
      </div>
    </CmsModal>
  )
}

// ----- Repo Picker ------------------------------------------------------------

type RepoEntry = {
  src: string
  name?: string
  size?: number | null
  label?: string
  section?: string
  kind: 'image' | 'video'
  _state: 'usado' | 'sin usar'
  _key?: string
  ts?: number
  type?: string
}

type RepoPickerProps = {
  cmsKey: string
  onClose: () => void
  onSuccess?: () => void
}

const FILTERS = [
  { value: 'all', label: 'Repository', icon: 'fa-database', colorClass: 'cms-filter-repo' },
  { value: 'usado', label: 'In use', icon: 'fa-circle-check', colorClass: 'cms-filter-used' },
  { value: 'sin usar', label: 'Unused', icon: 'fa-box-archive', colorClass: 'cms-filter-unused' },
] as const

export function RepoPickerModal({ cmsKey, onClose, onSuccess }: RepoPickerProps) {
  const toast = useToast()
  const meta = metaByKey[cmsKey]
  const isVideoSlot = meta?.kind === 'video'
  const [filter, setFilter] = useState<'all' | 'usado' | 'sin usar'>('all')
  const [selected, setSelected] = useState<RepoEntry | null>(null)
  const [confirmEntry, setConfirmEntry] = useState<RepoEntry | null>(null)
  const [verifying, setVerifying] = useState(false)

  const [all] = useState<RepoEntry[]>(() => {
    const list: RepoEntry[] = []
    const seenSrc = new Set<string>()
    Object.keys(state.usedContent).forEach((k) => {
      const e = state.usedContent[k]
      if (!e.src || seenSrc.has(e.src)) return
      seenSrc.add(e.src)
      list.push({ src: e.src, name: e.name, size: e.size, label: e.label, section: e.section, kind: e.kind as 'image' | 'video', _state: 'usado', _key: k, ts: e.ts, type: e.type })
    })
    state.unused.forEach((e) => {
      const eIsVid = !!((e.type && (e.type.includes('video') || e.type.includes('webm'))) || (e.name && /\.webm$/i.test(e.name)))
      const src = e.src || e.dataUrl || ''
      if (!src || seenSrc.has(src)) return
      seenSrc.add(src)
      list.push({ src, name: e.name, size: e.size, label: e.label, section: e.section, kind: eIsVid ? 'video' : 'image', _state: 'sin usar', _key: e.key, ts: e.ts, type: e.type })
    })
    return list
  })

  if (!meta) return null
  const filteredRaw = filter === 'all' ? all : all.filter((e) => e._state === filter)
  const filtered = [...filteredRaw].sort((a, b) => {
    const aCompat = (a.kind === 'video') === isVideoSlot ? 0 : 1
    const bCompat = (b.kind === 'video') === isVideoSlot ? 0 : 1
    if (aCompat !== bCompat) return aCompat - bCompat
    if (filter === 'all') {
      const aState = a._state === 'sin usar' ? 0 : 1
      const bState = b._state === 'sin usar' ? 0 : 1
      if (aState !== bState) return aState - bState
    }
    return (b.ts || 0) - (a.ts || 0)
  })

  const performAssign = (moveFromOld: boolean) => {
    if (!selected) return
    const src = selected.src
    if (!src) return

    state.items[cmsKey] = src
    applyMedia(cmsKey, src)

    if (cmsKey !== 'loader.gallop' && cmsKey !== 'settings.faviconUrl') {
      if (moveFromOld && selected._key && selected._key !== cmsKey) {
        delete state.usedContent[selected._key]
        delete state.items[selected._key]
        if (!state.retired.includes(selected._key)) state.retired.push(selected._key)
        applyMedia(selected._key, '')
      }

      const prev = state.usedContent[cmsKey]
      if (prev && prev.src) {
        retireUsedEntryToUnused(prev, 'replaced', [cmsKey])
      }

      state.usedContent[cmsKey] = {
        key: cmsKey, label: meta.label, section: meta.section, kind: meta.kind as 'image' | 'video',
        src, name: selected.name || 'media', size: selected.size ?? null, original: false,
        fields: computeFields(cmsKey, elementsByKey[cmsKey], meta),
        ts: selected.ts || Date.now(), type: selected.type || (meta.kind === 'video' ? 'video/webm' : 'image/webp'),
      }

      if (selected._state === 'sin usar') {
        const idx = state.unused.findIndex(u => u.src === src)
        if (idx !== -1) {
          state.unused.splice(idx, 1)
          persistUnused()
        }
      }

      persistUsed()
      cloudinaryMove(src, getCloudinaryFolder(meta.section))
      recordMediaMeta(cmsKey, src, { name: selected.name || 'media', size: selected.size ?? 0, type: selected.type || (meta.kind === 'video' ? 'video/webm' : 'image/webp'), label: meta.label, section: meta.section })
      persistOverrides().catch(() => toast('Network error while syncing with server', 'error'))
    } else {
      recordMediaMeta(cmsKey, src, { name: selected.name || 'media', size: selected.size ?? 0, type: selected.type || (meta.kind === 'video' ? 'video/webm' : 'image/webp'), label: meta.label, section: meta.section })
      emit()
    }

    const ri = state.retired.indexOf(cmsKey)
    if (ri >= 0) { state.retired.splice(ri, 1); persistRetired() }
    clearEmptySlot(cmsKey)
    refreshTools(cmsKey)
    if (cmsKey.startsWith('hero.wave')) syncWaveGroups()

    recordAudit({
      section: meta.section, label: meta.label, kind: meta.kind === 'video' ? 'video' : 'image',
      summary: moveFromOld ? `Content moved from previous container (${selected.name || 'existing file'})` : `Content assigned/reused from repository (${selected.name || 'existing file'})`,
    })
    toast(moveFromOld ? 'Content moved successfully' : 'Content assigned successfully')
    setConfirmEntry(null)
    if (onSuccess) onSuccess()
  }

  const assign = (): void | false => {
    if (!selected) { toast('Select a content first', 'error'); return false }
    if ((selected.kind === 'video') !== isVideoSlot) {
      toast(`This content is incompatible (requires ${isVideoSlot ? 'video' : 'image'})`, 'error')
      return false
    }
    const src = selected.src
    if (!src) { toast('Selected content has no valid resource', 'error'); return false }

    // Verificar que el contenido siga existiendo en Cloudinary antes de asignar
    if (src.includes('cloudinary.com')) {
      setVerifying(true)
      verifySingleUrl(src).then((exists) => {
        setVerifying(false)
        if (!exists) {
          toast('This content no longer exists in Cloudinary and was removed from the repository', 'error')
          purgeUrlsFromAllState([src])
          emit()
          return
        }
        if (selected._state === 'usado' && selected._key && selected._key !== cmsKey) {
          setConfirmEntry(selected)
        } else {
          performAssign(false)
        }
      })
      return false
    }

    if (selected._state === 'usado' && selected._key && selected._key !== cmsKey) {
      setConfirmEntry(selected)
      return false
    }

    performAssign(false)
  }

  return (
<CmsModal
      title="Choose from repository" wide className="cms-modal--repo-picker" zIndex={100050} onClose={onClose}
      actions={[
        { label: 'Cancel', onClick: () => {} },
        { label: verifying ? 'Verifying...' : 'Use this content', primary: true, onClick: verifying ? () => false as const : assign },
      ]}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div className="cms-up-head" style={{ flexShrink: 0 }}>
          <div className="cms-meta-line"><strong>Page:</strong> <span style={{ opacity: 0.85 }}>Main feed</span></div>
          <div className="cms-meta-line"><strong>Section:</strong> <span style={{ opacity: 0.85 }}>{meta.section}</span></div>
          <div className="cms-meta-line"><strong>Container:</strong> <span style={{ opacity: 0.85 }}>{meta.label}</span></div>
        </div>
        <div className="cms-repo-filter-bar" style={{ flexShrink: 0 }}>
          {FILTERS.map((f) => (
            <button
              key={f.value} type="button"
              className={`cms-repo-filter-btn ${f.colorClass}${filter === f.value ? ' active' : ''}`}
              onClick={() => { setFilter(f.value); setSelected(null) }}
            >
              <i className={`fa-solid ${f.icon}`}></i> {f.label}
            </button>
          ))}
        </div>
        {selected && (() => {
          const occCount = selected.src ? Object.values(state.usedContent).filter(u => u.src === selected.src).length : 0
          const ts = selected.ts
          return (
            <div style={{ flexShrink: 0, marginBottom: '0.8rem', padding: '0.75rem 1rem', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ width: '100%' }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                  <span>Selected: <span style={{ color: 'var(--accent)' }}>{selected.name || selected.label || 'media'}</span></span>
                  {selected._state === 'usado' ? (
                    <span style={{ background: '#10b981', color: '#ffffff', fontSize: '0.66rem', padding: '0.15rem 0.45rem', borderRadius: '3px', fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase' }}>In Use</span>
                  ) : (
                    <span style={{ background: '#d97706', color: '#ffffff', fontSize: '0.66rem', padding: '0.15rem 0.45rem', borderRadius: '3px', fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase' }}>Unused</span>
                  )}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.35rem', display: 'flex', gap: '1.4rem', flexWrap: 'wrap', alignItems: 'center', lineHeight: 1.4 }}>
                  <span><strong>Format:</strong> {getFormat(selected)}</span>
                  <span><strong>Size:</strong> {fmtBytes(selected.size)}</span>
                  <span><strong>Upload date:</strong> {ts ? fmtDateOnly(ts) : '—'}</span>
                  <span><strong>Upload time:</strong> {ts ? fmtTimeOnly(ts) : '—'}</span>
                  <span><strong>Uses:</strong> <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{occCount === 0 ? '0 times' : `${occCount} ${occCount === 1 ? 'time' : 'times'}`}</span></span>
                </div>
              </div>
            </div>
          )
        })()}
        <div className="cms-repo-grid-container" style={{ flex: 1, overflowY: 'auto', minHeight: 0, border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem 0.85rem', background: 'var(--bg-primary)' }}>
          <div className="cms-repo-grid">
            {filtered.length === 0 && (
              <div className="cms-repo-empty">
                <i className="fa-solid fa-box-open" style={{ fontSize: '2rem', marginBottom: '0.5rem', display: 'block', color: 'var(--accent)' }}></i>
                No content available of this type.
              </div>
            )}
            {filtered.map((entry, i) => {
              const isCompat = (entry.kind === 'video') === isVideoSlot
              const prevCompat = i > 0 && (filtered[i - 1].kind === 'video') === isVideoSlot
              const showHeader = !isCompat && (i === 0 || prevCompat)
              return (
                <Fragment key={i}>
                  {showHeader && (
                    <div style={{ gridColumn: '1 / -1', marginTop: i > 0 ? '0.8rem' : 0, paddingTop: i > 0 ? '0.8rem' : 0, borderTop: i > 0 ? '1px dashed var(--border)' : 'none', color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <i className="fa-solid fa-ban" style={{ color: '#ef4444' }}></i>
                      <span>Incompatible content ({isVideoSlot ? 'Images' : 'Videos'} — not selectable for this container)</span>
                    </div>
                  )}
                  <div
                    className={`cms-repo-thumb${!isCompat ? ' incompat' : ''}${selected && selected.src === entry.src ? ' selected' : ''}`}
                    onClick={() => {
                      if (!isCompat) return
                      setSelected(entry)
                    }}
                  >
                    <div className="cms-repo-thumb-top">
                      {entry._state === 'usado' ? (
                        <span className="cms-tag cms-tag--uso">In Use</span>
                      ) : (
                        <span className="cms-tag cms-tag--nouso">Unused</span>
                      )}
                    </div>
                    <div className="cms-repo-thumb-media">
                      {(() => {
                        const vid = entry.kind === 'video' || (entry.type && entry.type.includes('video')) || /\.webm|\.mp4|\.mov/i.test(entry.name || '')
                        if (!entry.src) {
                          return <div className="cms-repo-thumb-icon" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className={`fa-solid fa-${vid ? 'film' : 'image'}`}></i></div>
                        }
                        if (entry.src.includes('res.cloudinary.com')) {
                          /* eslint-disable-next-line @next/next/no-img-element */
                          return <img className="cms-repo-thumb-img" src={cloudinaryThumb(entry.src, vid)} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        }
                        if (vid) {
                          return <video className="cms-repo-thumb-img" src={entry.src} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        }
                        /* eslint-disable-next-line @next/next/no-img-element */
                        return <img className="cms-repo-thumb-img" src={entry.src} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      })()}
                    </div>
                    <div style={{ padding: '0.55rem 0.65rem', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }} title={entry.name || entry.label || '—'}>
                        {entry.name || entry.label || '—'}
                      </div>
                    </div>
                  </div>
                </Fragment>
              )
            })}
          </div>
        </div>
      </div>
      {confirmEntry && (
        <CmsModal
          title="Content in use" zIndex={100060}
          onClose={() => setConfirmEntry(null)}
          actions={[
            { label: 'Cancel', onClick: () => { setConfirmEntry(null); return false } },
            {
              label: (
                <>
                  <i className="fa-solid fa-copy" style={{ marginRight: '0.4rem' }}></i> Reuse
                </>
              ),
              primary: true,
              onClick: () => { performAssign(false) }
            },
            {
              label: (
                <>
                  <i className="fa-solid fa-arrow-right-arrow-left" style={{ marginRight: '0.4rem' }}></i> Move
                </>
              ),
              primary: true,
              onClick: () => { performAssign(true) }
            }
          ]}
        >
          <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
            <div style={{ fontSize: '2.5rem', color: 'var(--c-nouso, #f59e0b)', marginBottom: '0.8rem' }}>
              <i className="fa-solid fa-triangle-exclamation"></i>
            </div>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', lineHeight: 1.5, color: 'var(--text-primary)', fontWeight: 500 }}>
              This content is already being used across the site:
            </p>
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.8rem 1rem', marginBottom: '1.2rem', textAlign: 'left', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <div style={{ marginBottom: '0.45rem', fontSize: '0.88rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                <span><strong>Page:</strong></span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{getPageAndSectionInfo(confirmEntry).page}</span>
              </div>
              <div style={{ marginBottom: '0.45rem', fontSize: '0.88rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                <span><strong>Section:</strong></span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{getPageAndSectionInfo(confirmEntry).section}</span>
              </div>
              <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span><strong>Container:</strong></span>
                <span style={{ color: 'var(--accent)', fontWeight: 600, fontFamily: 'var(--font-display, inherit)' }}>{confirmEntry.label || confirmEntry._key}</span>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Do you want to <strong>move it</strong> (will be removed from previous container) or <strong>reuse it</strong> (will remain in both)?
            </p>
          </div>
        </CmsModal>
      )}
    </CmsModal>
  )
}

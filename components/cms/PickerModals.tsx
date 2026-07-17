'use client'

/* eslint-disable react-hooks/immutability */

/* Selectores de contenido — port de cms.js openContentPicker() (subir
   desde PC vs repositorio, con renombrado inline del contenedor) y
   openRepoPicker() (grilla del repo filtrada por tipo compatible). */

import { useRef, useState } from 'react'
import { CmsModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { fmtBytes, cloudinaryThumb } from '@/lib/utils'
import {
  state, recordAudit, persistUnused, persistUsed, persistRetired, performRenameContainer, recordMediaMeta, retireUsedEntryToUnused, cloudinaryMove, verifySingleUrl, purgeUrlsFromAllState, emit,
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
  src: string; name?: string; size?: number | null; label?: string; section?: string;
  kind: 'image' | 'video'; _state: 'usado' | 'sin usar'; _key?: string; ts?: number; type?: string;
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
  const filtered = filter === 'all' ? all : all.filter((e) => e._state === filter)

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
      title="Choose from repository" wide zIndex={100050} onClose={onClose}
      actions={[
        { label: 'Cancel', onClick: () => {} },
        { label: verifying ? 'Verifying...' : 'Use this content', primary: true, onClick: verifying ? () => false as const : assign },
      ]}
    >
      <div>
        <div className="cms-up-head">
          <div className="cms-meta-line"><strong>Page:</strong> <span style={{ opacity: 0.85 }}>Main feed</span></div>
          <div className="cms-meta-line"><strong>Section:</strong> <span style={{ opacity: 0.85 }}>{meta.section}</span></div>
          <div className="cms-meta-line"><strong>Container:</strong> <span style={{ opacity: 0.85 }}>{meta.label}</span></div>
          <div className="cms-meta-line"><strong>Showing:</strong> <span style={{ opacity: 0.85 }}>{isVideoSlot ? 'Videos' : 'Images'} available in repository</span></div>
        </div>
        <div className="cms-repo-filter-bar">
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
        <div className="cms-repo-grid">
          {filtered.length === 0 && (
            <div className="cms-repo-empty">
              <i className="fa-solid fa-box-open" style={{ fontSize: '2rem', marginBottom: '0.5rem', display: 'block', color: 'var(--accent)' }}></i>
              No content available of this type.
            </div>
          )}
          {filtered.map((entry, i) => {
            const isCompat = (entry.kind === 'video') === isVideoSlot
            return (
            <div
              key={i}
              className={`cms-repo-thumb${selected === entry ? ' selected' : ''}`}
              style={{ opacity: isCompat ? 1 : 0.45, cursor: isCompat ? 'pointer' : 'not-allowed' }}
              onClick={() => { if (isCompat) setSelected(entry); else toast(`Incompatible content (requires ${isVideoSlot ? 'video' : 'image'})`, 'error') }}
            >
              <div className="cms-mlib-tag-top" style={{ padding: '0.35rem 0.35rem 0 0.35rem', display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                {!isCompat && (
                  <span className="cms-tag" style={{ background: '#ef4444', color: '#fff' }}>Incompatible</span>
                )}
                {entry._state === 'usado' ? (
                  <span className="cms-tag cms-tag--uso">In Use</span>
                ) : (
                  <span className="cms-tag cms-tag--nouso">Unused</span>
                )}
              </div>
              {entry.kind === 'video' ? (
                entry.src ? (
                  entry.src.includes('res.cloudinary.com') ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img className="cms-repo-thumb-img" src={cloudinaryThumb(entry.src, true)} alt="" loading="lazy" />
                  ) : (
                    <video className="cms-repo-thumb-img" src={entry.src} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  )
                ) : (
                  <div className="cms-repo-thumb-icon"><i className="fa-solid fa-film"></i></div>
                )
              ) : entry.src ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img className="cms-repo-thumb-img" src={entry.src.startsWith('data:') ? entry.src : cloudinaryThumb(entry.src, false)} alt="" loading="lazy" />
              ) : (
                <div className="cms-repo-thumb-icon"><i className="fa-solid fa-image"></i></div>
              )}
              <div className="cms-repo-thumb-info">
                <div style={{ fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.name || entry.label || '—'}</div>
                {entry._state === 'usado' && (
                  <div style={{ fontSize: '0.74rem', color: 'var(--accent)', marginTop: '3px', lineHeight: 1.4, borderTop: '1px solid var(--border)', paddingTop: '3px' }}>
                    <div><strong>Page:</strong> {getPageAndSectionInfo(entry).page}</div>
                    <div><strong>Section:</strong> {getPageAndSectionInfo(entry).section}</div>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><strong>Container:</strong> {entry.label || entry._key || '—'}</div>
                  </div>
                )}
                {entry.size ? <div style={{ fontSize: '0.75rem', marginTop: 2 }}><strong>Size:</strong> <span style={{ fontWeight: 400 }}>{fmtBytes(entry.size)}</span></div> : null}
              </div>
            </div>
            )
          })}
        </div>
        {selected && (
          <div style={{ marginTop: '1.2rem', padding: '0.8rem 1rem', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Selected: <span style={{ color: 'var(--accent)' }}>{selected.name || selected.label || 'media'}</span>
              </div>
              {selected._state === 'usado' ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem', lineHeight: 1.4 }}>
                  <span className="cms-tag cms-tag--uso" style={{ marginRight: '0.5rem', padding: '0.15rem 0.45rem', fontSize: '0.72rem' }}>In Use</span>
                  <strong>Page:</strong> {getPageAndSectionInfo(selected).page} · <strong>Section:</strong> {getPageAndSectionInfo(selected).section} · <strong>Container:</strong> {selected.label || selected._key}
                </div>
              ) : (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  <span className="cms-tag cms-tag--nouso" style={{ marginRight: '0.5rem', padding: '0.15rem 0.45rem', fontSize: '0.72rem' }}>Unused</span>
                  Ready to assign to current container
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {confirmEntry && (
        <CmsModal
          title="Content in use"
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

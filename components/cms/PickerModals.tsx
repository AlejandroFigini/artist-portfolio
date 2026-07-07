'use client'

/* Selectores de contenido — port de cms.js openContentPicker() (subir
   desde PC vs repositorio, con renombrado inline del contenedor) y
   openRepoPicker() (grilla del repo filtrada por tipo compatible). */

import { useRef, useState } from 'react'
import { CmsModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { fmtBytes, cloudinaryThumb } from '@/lib/utils'
import {
  state, recordAudit, persistUnused, persistUsed, persistRetired, performRenameContainer, recordMediaMeta, retireUsedEntryToUnused, cloudinaryMove, verifySingleUrl, purgeUrlsFromAllState, emit, persistOverridesLocal,
} from '@/lib/cms/store'
import { getCloudinaryFolder } from '@/lib/cms/pages'
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
      toast('Contenedor actualizado')
    }
    setEditingName(false)
  }

  return (
    <CmsModal title="¿Qué deseas hacer?" onClose={() => { commitRename(); onClose() }} actions={[{ label: 'Cancelar', onClick: () => { commitRename() } }]}>
      <div>
        <div className="cms-up-head">
          <div className="cms-meta-line"><strong>Página:</strong> <span style={{ opacity: 0.85 }}>Feed principal</span></div>
          <div className="cms-meta-line"><strong>Sección:</strong> <span style={{ opacity: 0.85 }}>{meta.section}</span></div>
          <div className="cms-meta-line"><strong>Tipo requerido:</strong> <span style={{ opacity: 0.85 }}>{isVideo ? 'Video' : 'Imagen'}</span></div>
          <div className="cms-container-name-row" style={{ marginTop: '0.55rem', paddingTop: '0.55rem', borderTop: '1px solid rgba(124,58,237,0.12)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {editingName ? (
              <label className="cms-field" style={{ flex: 1, margin: 0 }}>
                <span>Nombre del contenedor</span>
                <input ref={nameRef} type="text" defaultValue={meta.label} autoFocus style={{ fontWeight: 400 }} onBlur={commitRename} onKeyDown={(e) => { if (e.key === 'Enter') commitRename() }} />
              </label>
            ) : (
              <div className="cms-meta-line" style={{ flex: 1 }}>
                <strong>Contenedor:</strong> <span style={{ opacity: 0.85 }}>{meta.label}</span>
              </div>
            )}
            <button
              type="button"
              title={editingName ? 'Guardar nombre' : 'Renombrar contenedor'}
              aria-label={editingName ? 'Guardar nombre' : 'Renombrar contenedor'}
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
            <span className="cms-picker-title">Subir desde tu PC</span>
            <span className="cms-picker-desc">Selecciona un archivo nuevo de tu computadora para subirlo y asignarlo aquí.</span>
          </button>
          <button type="button" className="cms-picker-option" onClick={onRepo}>
            <i className="fa-solid fa-cloud"></i>
            <span className="cms-picker-title">Usar desde repositorio</span>
            <span className="cms-picker-desc">Elige un archivo que ya fue subido previamente al repositorio de contenidos.</span>
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
  { value: 'all', label: 'Repositorio', icon: 'fa-database', colorClass: 'cms-filter-repo' },
  { value: 'usado', label: 'En uso', icon: 'fa-circle-check', colorClass: 'cms-filter-used' },
  { value: 'sin usar', label: 'Sin usar', icon: 'fa-box-archive', colorClass: 'cms-filter-unused' },
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
      if (isVideoSlot !== (e.kind === 'video')) return
      if (!e.src || seenSrc.has(e.src)) return
      seenSrc.add(e.src)
      list.push({ src: e.src, name: e.name, size: e.size, label: e.label, section: e.section, kind: e.kind as 'image' | 'video', _state: 'usado', _key: k, ts: e.ts, type: e.type })
    })
    state.unused.forEach((e) => {
      const eIsVid = !!((e.type && (e.type.includes('video') || e.type.includes('webm'))) || (e.name && /\.webm$/i.test(e.name)))
      if (isVideoSlot !== eIsVid) return
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
      persistOverrides().catch(() => toast('Error de red al sincronizar con el servidor', 'error'))
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
      section: meta.section, label: meta.label, kind: meta.kind === 'video' ? 'video' : 'imagen',
      summary: moveFromOld ? `Contenido movido desde contenedor anterior (${selected.name || 'archivo existente'})` : `Contenido asignado/reusado desde repositorio (${selected.name || 'archivo existente'})`,
    })
    toast(moveFromOld ? 'Contenido movido correctamente' : 'Contenido asignado correctamente')
    setConfirmEntry(null)
    if (onSuccess) onSuccess()
  }

  const assign = (): void | false => {
    if (!selected) { toast('Seleccioná un contenido primero', 'error'); return false }
    const src = selected.src
    if (!src) { toast('El contenido seleccionado no tiene un recurso válido', 'error'); return false }

    // Verificar que el contenido siga existiendo en Cloudinary antes de asignar
    if (src.includes('cloudinary.com')) {
      setVerifying(true)
      verifySingleUrl(src).then((exists) => {
        setVerifying(false)
        if (!exists) {
          toast('Este contenido ya no existe en Cloudinary y fue eliminado del repositorio', 'error')
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
      title="Elegir del repositorio" wide onClose={onClose}
      actions={[
        { label: 'Cancelar', onClick: () => {} },
        { label: verifying ? 'Verificando...' : 'Usar este contenido', primary: true, onClick: verifying ? () => false as const : assign },
      ]}
    >
      <div>
        <div className="cms-up-head">
          <div className="cms-meta-line"><strong>Página:</strong> <span style={{ opacity: 0.85 }}>Feed principal</span></div>
          <div className="cms-meta-line"><strong>Sección:</strong> <span style={{ opacity: 0.85 }}>{meta.section}</span></div>
          <div className="cms-meta-line"><strong>Contenedor:</strong> <span style={{ opacity: 0.85 }}>{meta.label}</span></div>
          <div className="cms-meta-line"><strong>Mostrando:</strong> <span style={{ opacity: 0.85 }}>{isVideoSlot ? 'Videos' : 'Imágenes'} disponibles en el repositorio</span></div>
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
              No hay contenido disponible de este tipo.
            </div>
          )}
          {filtered.map((entry, i) => (
            <div
              key={i}
              className={`cms-repo-thumb${selected === entry ? ' selected' : ''}`}
              onClick={() => setSelected(entry)}
            >
              <div className="cms-mlib-tag-top" style={{ padding: '0.35rem 0.35rem 0 0.35rem' }}>
                {entry._state === 'usado' ? (
                  <span className="cms-tag cms-tag--uso">En Uso</span>
                ) : (
                  <span className="cms-tag cms-tag--nouso">Sin Usar</span>
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
                <span style={{ fontWeight: 400 }}>{entry.name || entry.label || '—'}</span><br />
                {entry.size ? <><strong>Tamaño:</strong> <span style={{ fontWeight: 400 }}>{fmtBytes(entry.size)}</span> </> : ''}
              </div>
            </div>
          ))}
        </div>
      </div>
      {confirmEntry && (
        <CmsModal
          title="Contenido en uso"
          onClose={() => setConfirmEntry(null)}
          actions={[
            { label: 'Cancelar', onClick: () => { setConfirmEntry(null); return false } },
            {
              label: (
                <>
                  <i className="fa-solid fa-copy" style={{ marginRight: '0.4rem' }}></i> Reusar
                </>
              ),
              primary: true,
              onClick: () => { performAssign(false) }
            },
            {
              label: (
                <>
                  <i className="fa-solid fa-arrow-right-arrow-left" style={{ marginRight: '0.4rem' }}></i> Mover
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
              Este contenido ya se está usando en el contenedor:
            </p>
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.6rem', marginBottom: '1.2rem', fontFamily: 'var(--font-display, inherit)', fontWeight: 600, color: 'var(--accent)' }}>
              {confirmEntry.label || confirmEntry._key}
            </div>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              ¿Deseas <strong>moverlo</strong> (se quitará del contenedor anterior) o <strong>reusarlo</strong> (se mantendrá en ambos)?
            </p>
          </div>
        </CmsModal>
      )}
    </CmsModal>
  )
}

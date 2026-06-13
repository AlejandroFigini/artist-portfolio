'use client'

/* Selectores de contenido — port de cms.js openContentPicker() (subir
   desde PC vs repositorio, con renombrado inline del contenedor) y
   openRepoPicker() (grilla del repo filtrada por tipo compatible). */

import { useState } from 'react'
import { CmsModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { fmtBytes, cloudinaryThumb } from '@/lib/utils'
import {
  state, recordAudit, persistUnused, persistUsed, persistRetired,
} from '@/lib/cms/store'
import {
  elementsByKey, metaByKey, applyMedia, persistOverrides, clearEmptySlot, computeFields,
  syncWaveGroups, renameContainerSite,
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
  const [renaming, setRenaming] = useState(false)
  const [label, setLabel] = useState(meta?.label || 'Asignar contenido')
  const [draft, setDraft] = useState(label)

  if (!meta) return null

  const doRename = () => {
    const newName = draft.trim()
    if (newName && newName !== label) {
      renameContainerSite(cmsKey, newName)
      setLabel(newName)
      toast('Contenedor renombrado')
    }
    setRenaming(false)
  }

  return (
    <CmsModal title="¿Qué deseas hacer?" onClose={onClose} actions={[{ label: 'Cancelar', onClick: () => {} }]}>
      <div>
        <div className="cms-up-head">
          <div className="cms-meta-line"><strong>Página:</strong> Principal</div>
          <div className="cms-meta-line"><strong>Sección:</strong> {meta.section}</div>
          <div className="cms-meta-line cms-container-editable">
            <strong>Contenedor:</strong>{' '}
            {renaming ? (
              <>
                <input
                  type="text" className="cms-rename-inline" value={draft} autoFocus
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') doRename(); if (e.key === 'Escape') setRenaming(false) }}
                />
                <button type="button" className="cms-rename-confirm" onClick={doRename}>
                  <i className="fa-solid fa-check"></i>
                </button>
              </>
            ) : (
              <>
                <span className="cms-container-name-text">{label}</span>
                <button
                  type="button" className="cms-rename-pencil" title="Renombrar contenedor"
                  onClick={() => { setDraft(label); setRenaming(true) }}
                >
                  <i className="fa-solid fa-pencil"></i>
                </button>
              </>
            )}
          </div>
          <div className="cms-meta-line"><strong>Tipo requerido:</strong> {meta.kind === 'video' ? 'Video' : 'Imagen'}</div>
        </div>
        <div className="cms-picker-grid">
          <button type="button" className="cms-picker-option" onClick={() => { onClose(); onLocal() }}>
            <i className="fa-solid fa-file-arrow-up"></i>
            <span className="cms-picker-title">Subir desde tu PC</span>
            <span className="cms-picker-desc">Selecciona un archivo nuevo de tu computadora para subirlo y asignarlo aquí.</span>
          </button>
          <button type="button" className="cms-picker-option" onClick={() => { onClose(); onRepo() }}>
            <i className="fa-solid fa-cloud"></i>
            <span className="cms-picker-title">Usar desde repositorio</span>
            <span className="cms-picker-desc">Elige un archivo que ya fue subido previamente al repositorio de contenidos.</span>
          </button>
        </div>
      </div>
    </CmsModal>
  )
}

// ----- Repo Picker --------------------------------------------------------------

type RepoEntry = {
  src: string
  name: string
  size: number | null
  label: string
  section: string
  kind: 'image' | 'video'
  _state: 'usado' | 'sin usar'
  _key?: string
}

const FILTERS = [
  { value: 'all', label: 'Repositorio', icon: 'fa-database', colorClass: 'cms-filter-repo' },
  { value: 'usado', label: 'En uso', icon: 'fa-circle-check', colorClass: 'cms-filter-used' },
  { value: 'sin usar', label: 'Sin usar', icon: 'fa-box-archive', colorClass: 'cms-filter-unused' },
] as const

export function RepoPickerModal({ cmsKey, onClose }: { cmsKey: string; onClose: () => void }) {
  const toast = useToast()
  const meta = metaByKey[cmsKey]
  const isVideoSlot = meta?.kind === 'video'
  const [filter, setFilter] = useState<string>('all')
  const [selected, setSelected] = useState<RepoEntry | null>(null)

  const [all] = useState<RepoEntry[]>(() => {
    const list: RepoEntry[] = []
    Object.keys(state.usedContent).forEach((k) => {
      const e = state.usedContent[k]
      if (isVideoSlot !== (e.kind === 'video')) return
      list.push({ src: e.src, name: e.name, size: e.size, label: e.label, section: e.section, kind: e.kind as 'image' | 'video', _state: 'usado', _key: k })
    })
    state.unused.forEach((e) => {
      const eIsVid = !!((e.type && (e.type.includes('video') || e.type.includes('webm'))) || (e.name && /\.webm$/i.test(e.name)))
      if (isVideoSlot !== eIsVid) return
      list.push({ src: e.src || e.dataUrl || '', name: e.name, size: e.size, label: e.label, section: e.section, kind: eIsVid ? 'video' : 'image', _state: 'sin usar', _key: e.key })
    })
    return list
  })

  if (!meta) return null
  const filtered = filter === 'all' ? all : all.filter((e) => e._state === filter)

  const assign = (): void | false => {
    if (!selected) { toast('Seleccioná un contenido primero', 'error'); return false }
    const src = selected.src
    if (!src) { toast('El contenido seleccionado no tiene un recurso válido', 'error'); return false }

    const prev = state.usedContent[cmsKey]
    if (prev) {
      state.unused.push({
        key: cmsKey, src: prev.src, dataUrl: prev.src, name: prev.name, size: prev.size,
        type: prev.kind === 'video' ? 'video/webm' : 'image/webp', ts: Date.now(),
        label: prev.label, section: prev.section, original: prev.original, reason: 'replaced',
      })
      persistUnused()
    }

    state.items[cmsKey] = src
    applyMedia(cmsKey, src)

    state.usedContent[cmsKey] = {
      key: cmsKey, label: meta.label, section: meta.section, kind: meta.kind as 'image' | 'video',
      src, name: selected.name, size: selected.size, original: false,
      fields: computeFields(cmsKey, elementsByKey[cmsKey], meta),
    }
    persistUsed()
    persistOverrides().catch(() => toast('Error de red al sincronizar con el servidor', 'error'))

    const ri = state.retired.indexOf(cmsKey)
    if (ri >= 0) { state.retired.splice(ri, 1); persistRetired() }
    clearEmptySlot(cmsKey)
    if (cmsKey.startsWith('hero.wave')) syncWaveGroups()

    recordAudit({
      section: meta.section, label: meta.label, kind: meta.kind === 'video' ? 'video' : 'imagen',
      summary: `Contenido asignado desde repositorio (${selected.name || 'archivo existente'})`,
    })
    toast('Contenido asignado correctamente')
  }

  return (
    <CmsModal
      title="Elegir del repositorio" wide onClose={onClose}
      actions={[
        { label: 'Cancelar', onClick: () => {} },
        { label: 'Usar este contenido', primary: true, onClick: assign },
      ]}
    >
      <div>
        <div className="cms-up-head">
          <div className="cms-meta-line"><strong>Asignar a:</strong> {meta.label} ({meta.section})</div>
          <div className="cms-meta-line"><strong>Mostrando:</strong> {isVideoSlot ? 'Videos' : 'Imágenes'} disponibles en el repositorio</div>
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
              {entry.kind === 'video' ? (
                <div className="cms-repo-thumb-icon"><i className="fa-solid fa-film"></i></div>
              ) : entry.src ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img className="cms-repo-thumb-img" src={entry.src.startsWith('data:') ? entry.src : cloudinaryThumb(entry.src)} alt="" loading="lazy" />
              ) : (
                <div className="cms-repo-thumb-icon"><i className="fa-solid fa-image"></i></div>
              )}
              <div className="cms-repo-thumb-info">
                <strong>{entry.name || entry.label || '—'}</strong><br />
                {entry.size ? fmtBytes(entry.size) : ''} <span style={{ opacity: 0.7 }}>· {entry._state}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </CmsModal>
  )
}

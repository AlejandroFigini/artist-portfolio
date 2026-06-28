'use client'

/* Selectores de contenido — port de cms.js openContentPicker() (subir
   desde PC vs repositorio, con renombrado inline del contenedor) y
   openRepoPicker() (grilla del repo filtrada por tipo compatible). */

import { useRef, useState } from 'react'
import { CmsModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { fmtBytes, cloudinaryThumb } from '@/lib/utils'
import {
  state, recordAudit, persistUnused, persistUsed, persistRetired, performRenameContainer,
} from '@/lib/cms/store'
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
      refreshContainerLabel(cmsKey) // refresca overlay + tooltips en vivo (sin recargar)
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
              // mousedown preventDefault → el input no pierde foco antes del click,
              // evita el doble disparo onBlur+onClick que dejaba la edición abierta.
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
          <button type="button" className="cms-picker-option" onClick={() => { onClose(); onLocal() }}>
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

export function RepoPickerModal({ cmsKey, onClose, onSuccess }: { cmsKey: string; onClose: () => void; onSuccess?: () => void }) {
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
    if (prev && prev.src) {
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
    refreshTools(cmsKey)
    if (cmsKey.startsWith('hero.wave')) syncWaveGroups()

    recordAudit({
      section: meta.section, label: meta.label, kind: meta.kind === 'video' ? 'video' : 'imagen',
      summary: `Contenido asignado desde repositorio (${selected.name || 'archivo existente'})`,
    })
    toast('Contenido asignado correctamente')
    if (onSuccess) onSuccess()
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
              {entry.kind === 'video' ? (
                <div className="cms-repo-thumb-icon"><i className="fa-solid fa-film"></i></div>
              ) : entry.src ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img className="cms-repo-thumb-img" src={entry.src.startsWith('data:') ? entry.src : cloudinaryThumb(entry.src)} alt="" loading="lazy" />
              ) : (
                <div className="cms-repo-thumb-icon"><i className="fa-solid fa-image"></i></div>
              )}
              <div className="cms-repo-thumb-info">
                <span style={{ fontWeight: 400 }}>{entry.name || entry.label || '—'}</span><br />
                {entry.size ? <><strong>Tamaño:</strong> <span style={{ fontWeight: 400 }}>{fmtBytes(entry.size)}</span> </> : ''}
                <span style={{ opacity: 0.7, fontWeight: 400 }}>· {entry._state}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </CmsModal>
  )
}

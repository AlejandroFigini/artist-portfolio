'use client'

/* eslint-disable react-hooks/immutability */

import { useEffect, useState } from 'react'
import { CmsModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { saveContent } from '@/lib/api'
import { state, loadJSON, saveJSON, LS, persistUnused, persistUsed, emit, useCmsStore, retireUsedEntryToUnused } from '@/lib/cms/store'
import { elementsByKey, currentSrcOf, ensureProjectMeta, rescan } from './engine'

type Props = { show?: boolean; onClose: () => void; onPickImage: (key: string) => void; onEditInfo?: (key: string) => void }

function parseSettings() {
  const settings = { count: 4 }
  try {
    const parsed = JSON.parse(state.items['proj.settings'] || '')
    if (parsed && typeof parsed.count === 'number' && parsed.count >= 0) {
      settings.count = parsed.count
    }
  } catch {}
  return settings
}

const slideSrc = (vKey: string) =>
  state.items[vKey] || currentSrcOf(elementsByKey[vKey] || null) || ''

export default function ProjectsManager({ show = true, onClose, onPickImage, onEditInfo }: Props) {
  const toast = useToast()
  const storeVersion = useCmsStore()
  const [settings] = useState(() => parseSettings())
  const [original, setOriginal] = useState<string[]>(() =>
    Array.from({ length: settings.count }, (_, i) => `proj#${i}`))
  // El manager se desmonta al abrir el picker/upload y se re-monta al cerrar.
  // Los proyectos "pendientes" (añadidos sin guardar) viven en state.items como
  // proj#new_*; los recuperamos aquí para que no se pierdan en el re-montaje.
  const pendingNew = () =>
    Object.keys(state.items)
      .filter((k) => {
        if (!/^proj#new_\d+$/.test(k)) return false
        const src = state.items[k] || ''
        const title = state.items[`${k}::title`] || ''
        return !!src && !src.includes('placeholder') && !!title.trim()
      })
      .sort((a, b) => Number(a.split('_')[1]) - Number(b.split('_')[1]))
  const [projects, setProjects] = useState<string[]>(() => [...original, ...pendingNew()])
  const [saving, setSaving] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [nextNewId, setNextNewId] = useState(() => {
    const ids = pendingNew().map((k) => Number(k.split('_')[1]))
    return ids.length ? Math.max(...ids) + 1 : settings.count
  })

  const dirty = projects.length !== original.length || projects.some((s, i) => s !== original[i])

  const status = dirty
    ? { color: '#2563eb', icon: 'fa-circle-info', label: 'Save changes', title: 'Save project order/list to apply updates' }
    : projects.length === 0
      ? { color: '#b45309', icon: 'fa-triangle-exclamation', label: '0 projects', title: 'No projects added yet' }
      : !dirty
        ? { color: '#64748b', icon: 'fa-check', label: 'No changes', title: 'All project changes are saved' }
        : { color: '#047857', icon: 'fa-circle-check', label: 'Ready to save', title: 'Pending changes ready to be saved' }

  // Al subir un proyecto, UploadModal escribe proj#new_* en el store y hace emit().
  // El gestor sigue montado (el picker/upload trabajan encima), así que nos
  // suscribimos para mergear el pendiente en vivo — antes había que cerrar y
  // reabrir el gestor para que apareciera.
  useEffect(() => {
    setTimeout(() => {
      const currentPending = pendingNew()
      const add = currentPending.filter((k) => !projects.includes(k))
      
      const hasPending = projects.some(k => k.startsWith('proj#new_')) && currentPending.some(k => k.startsWith('proj#new_'))
      
      if (add.length > 0 || hasPending) {
        saveGraph(add.length > 0 ? [...projects, ...add] : projects)
      }
      setNextNewId((n) => {
        const ids = pendingNew().map((k) => Number(k.split('_')[1]))
        return ids.length ? Math.max(n, Math.max(...ids) + 1) : n
      })
    }, 0)
  }, [storeVersion, projects])

  const saveGraph = async (finalProjects: string[]) => {
    const oldData: Record<string, string | undefined> = {}
    
    // Respalda las llaves reales y temporales
    const allRelevantKeys = Object.keys(state.items).filter(k => 
      k.startsWith('proj#')
    )
    allRelevantKeys.forEach((k) => { oldData[k] = state.items[k] })

    // Limpia el estado actual de los proyectos
    allRelevantKeys.forEach(k => { delete state.items[k] })

    // Reconstruye mapeando las llaves virtuales (vKey) a llaves reales (realKey)
    finalProjects.forEach((vKey, i) => {
      const realKey = `proj#${i}`
      if (oldData[vKey]) state.items[realKey] = oldData[vKey]!
      else state.items[realKey] = ''

      const fieldPrefix = `${vKey}::`
      Object.keys(oldData).forEach(oldKey => {
        if (oldKey.startsWith(fieldPrefix)) {
          const suffix = oldKey.replace(fieldPrefix, '')
          state.items[`${realKey}::${suffix}`] = oldData[oldKey]!
        }
      })
    })

    // Papelera: marca los originales eliminados como "no usados"
    original.forEach((k) => {
      if (finalProjects.includes(k)) return
      const prev = state.usedContent[k]
      if (prev) {
        retireUsedEntryToUnused(prev, 'retired', [k])
        delete state.usedContent[k]
      }
    })
    persistUnused()
    persistUsed()

    const newCount = finalProjects.length
    const payload: Record<string, string> = { [`proj.settings`]: JSON.stringify({ count: newCount }) }
    state.items[`proj.settings`] = payload[`proj.settings`]
    for (let i = 0; i < Math.max(original.length, newCount); i++) {
      const rk = `proj#${i}`
      if (state.items[rk] === undefined) state.items[rk] = ''
      payload[rk] = state.items[rk]
    }
    Object.keys(state.items).filter(k => k.startsWith('proj#')).forEach(k => {
      payload[k] = state.items[k]
    })

    // El POST de /api/content es upsert (no borra). Las llaves temporales
    // proj#new_* ya promovidas a reales quedarían en la DB y reaparecerían como
    // pendientes (duplicando) en la próxima sesión → las vaciamos explícitamente.
    Object.keys(oldData).forEach((k) => { if (k.startsWith('proj#new')) payload[k] = '' })

    const overrides = loadJSON<Record<string, string>>(LS.OVERRIDES, {})
    Object.keys(overrides).forEach(k => {
      if (k.startsWith('proj#')) delete overrides[k]
    })
    Object.keys(payload).forEach((k) => { overrides[k] = payload[k] })
    saveJSON(LS.OVERRIDES, overrides)

    await saveContent(payload)
    
    emit()
    // El contenido lo pinta React (ProjectCard lee de state.items). rescan sólo
    // re-indexa la(s) card(s) nueva(s) para los controles de edición de admin.
    setTimeout(() => rescan(), 80)
    setTimeout(() => rescan(), 300)

    const fresh = Array.from({ length: newCount }, (_, i) => `proj#${i}`)
    setOriginal(fresh)
    setProjects(fresh)
  }

  const onSaveGraph = () => {
    setSaving(true)
    saveGraph(projects)
      .then(() => { toast('Changes saved successfully'); setSaving(false) })
      .catch(() => { toast('Error saving changes', 'error'); setSaving(false) })
  }

  const move = (idx: number, dir: -1 | 1) => {
    const next = projects.slice()
    ;[next[idx], next[idx + dir]] = [next[idx + dir], next[idx]]
    setProjects(next)
    saveGraph(next)
  }

  // Permite forzar el render después de interactuar con el UploadModal
  // ya que los datos de UploadModal van directamente al estado global.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [dummy, setDummy] = useState(0)
  
  return (
    <CmsModal
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>Projects Manager</span>
          <span
            style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
            onMouseEnter={() => setShowInfo(true)}
            onMouseLeave={() => setShowInfo(false)}
          >
            <button
              type="button"
              className="cms-icon-btn"
              style={{ border: 'none', background: 'transparent', padding: '0.1rem 0.25rem', color: 'var(--text-secondary)', fontSize: '0.9em' }}
              aria-label="Help"
              aria-expanded={showInfo}
              onFocus={() => setShowInfo(true)}
              onBlur={() => setShowInfo(false)}
            >
              <i className="fa-solid fa-circle-info"></i>
            </button>
            {showInfo && (
              <div role="tooltip" style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 50, width: 310, padding: '0.6rem 0.8rem', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-secondary)', lineHeight: 1.55, boxShadow: '0 6px 20px rgba(0, 0, 0, 0.18)', textTransform: 'none', letterSpacing: 'normal' }}>
                Manage your Featured Projects list.<br />
                Click <strong>Change image / edit info</strong> to update title, summary, date, or cover.<br />
                Reorder projects with up/down buttons or add new items at the bottom.
              </div>
            )}
          </span>
        </span>
      }
      wide
      show={show}
      onClose={onClose}
      actions={[]}
    >
      <div className="cms-carousel-manager">
        {/* Barra: estado conciso | total */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <span title={status.title} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', fontWeight: 600, color: status.color }}>
            <i className={`fa-solid ${status.icon}`}></i>{status.label}
          </span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Total: <strong>{projects.length}</strong> {projects.length === 1 ? 'project' : 'projects'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {projects.map((vKey, i) => {
            const title = state.items[`${vKey}::title`] || `Project #${i + 1} (Untitled)`
            const src = slideSrc(vKey)
            const empty = !src || src.trim() === '' || src === 'url("")' || src === 'url()'
            return (
              <div key={vKey} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.45rem', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div title={empty ? 'No image' : undefined} style={{ position: 'relative', width: 84, height: 50, borderRadius: 4, flexShrink: 0, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: 'var(--bg-primary)', backgroundImage: `url("${src}")`, border: empty ? '1px dashed #b45309' : '1px solid var(--border)' }}>
                  {empty && <i className="fa-solid fa-image" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b45309', opacity: 0.55, fontSize: '1rem' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0, fontSize: '0.85rem', fontWeight: 600 }}>
                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>
                    {title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400, marginTop: 2 }}>
                    Project {i + 1} {empty && <span style={{ color: '#b45309' }}>· no image</span>}
                  </div>
                </div>
                <button
                  type="button"
                  className="cms-icon-btn"
                  title="Subir o elegir nueva imagen"
                  aria-label="Subir o elegir nueva imagen"
                  onClick={async () => {
                    let targetKey = vKey
                    if (dirty || vKey.startsWith('proj#new_')) {
                      await saveGraph(projects)
                      const idx = projects.indexOf(vKey)
                      if (idx !== -1) targetKey = `proj#${idx}`
                    }
                    ensureProjectMeta(targetKey)
                    onPickImage(targetKey)
                  }}
                >
                  <i className="fa-solid fa-image"></i>
                </button>
                <button
                  type="button"
                  className="cms-icon-btn"
                  title="Editar info (título, descripción, fecha)"
                  aria-label="Editar info (título, descripción, fecha)"
                  onClick={async () => {
                    let targetKey = vKey
                    if (dirty || vKey.startsWith('proj#new_')) {
                      await saveGraph(projects)
                      const idx = projects.indexOf(vKey)
                      if (idx !== -1) targetKey = `proj#${idx}`
                    }
                    ensureProjectMeta(targetKey)
                    if (onEditInfo) {
                      onEditInfo(targetKey)
                    } else {
                      window.dispatchEvent(new CustomEvent('cms:editInfo', { detail: { key: targetKey } }))
                    }
                  }}
                >
                  <i className="fa-solid fa-pen-to-square"></i>
                </button>
                <button type="button" className="cms-icon-btn" title="Move up" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                  <i className="fa-solid fa-chevron-up"></i>
                </button>
                <button type="button" className="cms-icon-btn" title="Move down" aria-label="Move down" disabled={i === projects.length - 1} onClick={() => move(i, 1)}>
                  <i className="fa-solid fa-chevron-down"></i>
                </button>
                <button type="button" className="cms-icon-btn cms-icon-btn--danger" title="Delete project" aria-label="Delete project" onClick={() => { const next = projects.filter((_, j) => j !== i); setProjects(next); saveGraph(next); }}>
                  <i className="fa-solid fa-trash"></i>
                </button>
              </div>
            )
          })}
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '0.25rem' }}>
            <button
              type="button"
              className="cms-btn"
              style={{ padding: '0.45rem 0.8rem', fontSize: '0.8rem', borderStyle: 'dashed' }}
              title="Add new project"
              onClick={() => {
                const newKey = `proj#new_${nextNewId}`
                setNextNewId((n) => n + 1)
                ensureProjectMeta(newKey)
                onPickImage(newKey)
              }}
            >
              <i className="fa-solid fa-plus"></i> Add project
            </button>
          </div>
        </div>

        <div className="cms-modal-actions" style={{ justifyContent: 'flex-end', gap: '0.35rem' }}>
          {dirty && (
            <button
              type="button"
              className="cms-btn cms-btn--primary"
              disabled={saving}
              onClick={onSaveGraph}
            >
              {saving ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Saving...</> : 'Save changes'}
            </button>
          )}
        </div>
      </div>
    </CmsModal>
  )
}

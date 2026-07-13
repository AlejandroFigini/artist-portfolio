'use client'

import { useEffect, useState } from 'react'
import { CmsModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { saveContent } from '@/lib/api'
import { state, loadJSON, saveJSON, LS, persistUnused, persistUsed, emit, useCmsStore, retireUsedEntryToUnused } from '@/lib/cms/store'
import { elementsByKey, currentSrcOf, ensureProjectMeta, rescan } from './engine'

type Props = { show?: boolean; onClose: () => void; onPickImage: (key: string) => void }

function parseSettings() {
  const settings = { count: 6 }
  try {
    const parsed = JSON.parse(state.items['proj.settings'] || '')
    if (parsed && typeof parsed.count === 'number') settings.count = parsed.count
  } catch {}
  return settings
}

const slideSrc = (vKey: string) =>
  state.items[vKey] || currentSrcOf(elementsByKey[vKey] || null) || ''

export default function ProjectsManager({ show = true, onClose, onPickImage }: Props) {
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
      .filter((k) => /^proj#new_\d+$/.test(k) && !!state.items[k])
      .sort((a, b) => Number(a.split('_')[1]) - Number(b.split('_')[1]))
  const [projects, setProjects] = useState<string[]>(() => [...original, ...pendingNew()])
  const [saving, setSaving] = useState(false)
  const [nextNewId, setNextNewId] = useState(() => {
    const ids = pendingNew().map((k) => Number(k.split('_')[1]))
    return ids.length ? Math.max(...ids) + 1 : settings.count
  })

  const dirty = projects.length !== original.length || projects.some((s, i) => s !== original[i])

  // Al subir un proyecto, UploadModal escribe proj#new_* en el store y hace emit().
  // El gestor sigue montado (el picker/upload trabajan encima), así que nos
  // suscribimos para mergear el pendiente en vivo — antes había que cerrar y
  // reabrir el gestor para que apareciera.
  useEffect(() => {
    setProjects((prev) => {
      const add = pendingNew().filter((k) => !prev.includes(k))
      return add.length ? [...prev, ...add] : prev
    })
    setNextNewId((n) => {
      const ids = pendingNew().map((k) => Number(k.split('_')[1]))
      return ids.length ? Math.max(n, Math.max(...ids) + 1) : n
    })
     
  }, [storeVersion])

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
    setTimeout(() => rescan(), 100)

    const fresh = Array.from({ length: newCount }, (_, i) => `proj#${i}`)
    setOriginal(fresh)
    setProjects(fresh)
  }

  const onSaveGraph = () => {
    setSaving(true)
    saveGraph(projects)
      .then(() => { toast('Changes saved successfully'); setSaving(false); onClose() })
      .catch(() => { toast('Error saving changes', 'error'); setSaving(false) })
  }

  const move = (idx: number, dir: -1 | 1) => {
    setProjects((s) => {
      const next = s.slice()
      const tmp = next[idx + dir]
      next[idx + dir] = next[idx]
      next[idx] = tmp
      return next
    })
  }

  // Permite forzar el render después de interactuar con el UploadModal
  // ya que los datos de UploadModal van directamente al estado global.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [dummy, setDummy] = useState(0)
  
  return (
    <CmsModal title="Projects Manager" wide show={show} onClose={onClose} actions={[]}>
      <div className="cms-carousel-manager">
        <p style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Add, reorder, edit, or delete projects. Changes will take effect when you click "Save Changes".
        </p>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
          <button
            type="button" className="cms-btn"
            onClick={() => {
              const newKey = `proj#new_${nextNewId}`
              setProjects((s) => [...s, newKey])
              setNextNewId((n) => n + 1)
              ensureProjectMeta(newKey)
              onPickImage(newKey)
              
              // Poll to update thumbnail after upload finishes
              let ticks = 0
              const iv = setInterval(() => {
                setDummy(d => d + 1)
                ticks++
                if (ticks > 60) clearInterval(iv) // Stop after 30s
              }, 500)
            }}
          >
            <i className="fa-solid fa-plus"></i> Add Project
          </button>
          {dirty && (
            <span style={{ fontSize: '0.85rem', color: '#f59e0b', fontWeight: 600 }}>
              <i className="fa-solid fa-triangle-exclamation"></i> Unsaved changes
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {projects.map((vKey, i) => {
            const title = state.items[`${vKey}::title`] || `Project #${i + 1} (Untitled)`
            const src = slideSrc(vKey)
            return (
              <div key={vKey} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ width: 100, height: 60, borderRadius: 4, backgroundSize: 'cover', backgroundPosition: 'center', backgroundImage: `url("${src}")`, backgroundColor: '#e5e7eb', flexShrink: 0 }}>
                  {!src && <div style={{width: '100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#9ca3af', fontSize:'0.7rem'}}>No IMG</div>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: 'block', marginBottom: '0.3rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {title}
                  </strong>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button" className="cms-btn"
                      onClick={() => {
                        ensureProjectMeta(vKey)
                        onPickImage(vKey)
                        setTimeout(() => setDummy(d => d+1), 500) // trigger re-render in case of new meta
                      }}
                    >
                      <i className="fa-solid fa-pen"></i> Edit Info / IMG
                    </button>
                    <button type="button" className="cms-btn" title="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                      <i className="fa-solid fa-arrow-up"></i>
                    </button>
                    <button type="button" className="cms-btn" title="Move down" disabled={i === projects.length - 1} onClick={() => move(i, 1)}>
                      <i className="fa-solid fa-arrow-down"></i>
                    </button>
                    <button type="button" className="cms-btn" title="Delete" style={{ color: '#ef4444' }} onClick={() => setProjects((s) => s.filter((_, j) => j !== i))}>
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
          {projects.length === 0 && (
             <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No projects found. Add one.</div>
          )}
        </div>

        <div className="cms-modal-actions" style={{ justifyContent: 'space-between', marginTop: '2rem' }}>
          <div></div>
          <button
            type="button" className="cms-btn cms-btn--primary"
            disabled={saving || !dirty}
            style={!dirty ? { opacity: 0.5 } : undefined}
            onClick={onSaveGraph}
          >
            {saving ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Saving...</> : 'Save Changes'}
          </button>
        </div>
      </div>
    </CmsModal>
  )
}

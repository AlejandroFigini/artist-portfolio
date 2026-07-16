'use client'

/* eslint-disable react-hooks/immutability */

/* Gestión de Characters — espejo de ProjectsManager para la sección dinámica
   de personajes: alta / baja / reorden y edición de retrato + concepts + ficha.
   Las keys virtuales (char#i / char#new_*) se remapean a reales (char#i) al
   guardar; los sufijos ::name/::role/::desc/::cM viajan con cada personaje. */

import { useEffect, useState } from 'react'
import { CmsModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { saveContent } from '@/lib/api'
import { state, loadJSON, saveJSON, LS, persistUnused, persistUsed, emit, useCmsStore, retireUsedEntryToUnused } from '@/lib/cms/store'
import { elementsByKey, currentSrcOf, ensureCharacterMeta, rescan } from './engine'

type Props = {
  show?: boolean
  onClose: () => void
  onPickImage: (key: string) => void
  onEditInfo?: (key: string) => void
}

const CONCEPTS_PER = 4

function parseSettings() {
  const settings = { count: 8 }
  try {
    const parsed = JSON.parse(state.items['char.settings'] || '')
    if (parsed && typeof parsed.count === 'number' && parsed.count >= 0) {
      settings.count = parsed.count
    }
  } catch {}
  return settings
}

const portraitSrc = (vKey: string) =>
  state.items[vKey] || currentSrcOf(elementsByKey[vKey] || null) || ''

export default function CharactersManager({ show = true, onClose, onPickImage, onEditInfo }: Props) {
  const toast = useToast()
  const storeVersion = useCmsStore()
  const [settings] = useState(() => parseSettings())
  const [original, setOriginal] = useState<string[]>(() =>
    Array.from({ length: settings.count }, (_, i) => `char#${i}`))

  const pendingNew = () =>
    Object.keys(state.items)
      .filter((k) => {
        if (!/^char#new_\d+$/.test(k)) return false
        const src = state.items[k] || ''
        const name = state.items[`${k}::name`] || ''
        return !!src && !src.includes('placeholder') && !!name.trim()
      })
      .sort((a, b) => Number(a.split('_')[1]) - Number(b.split('_')[1]))
  const [characters, setCharacters] = useState<string[]>(() => [...original, ...pendingNew()])
  const [saving, setSaving] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [nextNewId, setNextNewId] = useState(() => {
    const ids = pendingNew().map((k) => Number(k.split('_')[1]))
    return ids.length ? Math.max(...ids) + 1 : settings.count
  })

  const dirty = characters.length !== original.length || characters.some((s, i) => s !== original[i])

  const status = dirty
    ? { color: '#2563eb', icon: 'fa-circle-info', label: 'Save changes', title: 'Save character order/list to apply updates' }
    : characters.length === 0
      ? { color: '#b45309', icon: 'fa-triangle-exclamation', label: '0 characters', title: 'No characters added yet' }
      : !dirty
        ? { color: '#64748b', icon: 'fa-check', label: 'No changes', title: 'All character changes are saved' }
        : { color: '#047857', icon: 'fa-circle-check', label: 'Ready to save', title: 'Pending changes ready to be saved' }

  // Mergea en vivo los personajes pendientes (char#new_*) creados desde el picker.
  useEffect(() => {
    setTimeout(() => {
      setCharacters((prev) => {
        const add = pendingNew().filter((k) => !prev.includes(k))
        return add.length ? [...prev, ...add] : prev
      })
      setNextNewId((n) => {
        const ids = pendingNew().map((k) => Number(k.split('_')[1]))
        return ids.length ? Math.max(n, Math.max(...ids) + 1) : n
      })
    }, 0)
  }, [storeVersion])

  const saveGraph = async (finalChars: string[]) => {
    const oldData: Record<string, string | undefined> = {}
    const allKeys = Object.keys(state.items).filter((k) => k.startsWith('char#'))
    allKeys.forEach((k) => { oldData[k] = state.items[k] })
    allKeys.forEach((k) => { delete state.items[k] })

    // Reconstruye: vKey (virtual) → realKey (char#i), arrastrando todos los ::sufijos
    finalChars.forEach((vKey, i) => {
      const realKey = `char#${i}`
      state.items[realKey] = oldData[vKey] || ''
      const prefix = `${vKey}::`
      Object.keys(oldData).forEach((oldKey) => {
        if (oldKey.startsWith(prefix)) {
          state.items[`${realKey}::${oldKey.slice(prefix.length)}`] = oldData[oldKey]!
        }
      })
    })

    // Papelera: los originales eliminados → "no usados" (retrato + concepts).
    original.forEach((k) => {
      if (finalChars.includes(k)) return
      ;[k, ...Array.from({ length: CONCEPTS_PER }, (_, m) => `${k}::c${m}`)].forEach((mk) => {
        const prev = state.usedContent[mk]
        if (prev) {
          retireUsedEntryToUnused(prev, 'deleted', [mk])
          delete state.usedContent[mk]
        }
      })
    })
    persistUnused()
    persistUsed()

    const newCount = finalChars.length
    const payload: Record<string, string> = { 'char.settings': JSON.stringify({ count: newCount }) }
    state.items['char.settings'] = payload['char.settings']
    Object.keys(state.items).filter((k) => k.startsWith('char#')).forEach((k) => { payload[k] = state.items[k] })

    // Vacía en la DB las keys temporales (char#new_*) ya promovidas (upsert no borra).
    Object.keys(oldData).forEach((k) => { if (k.startsWith('char#new')) payload[k] = '' })

    const overrides = loadJSON<Record<string, string>>(LS.OVERRIDES, {})
    Object.keys(overrides).forEach((k) => { if (k.startsWith('char#')) delete overrides[k] })
    Object.keys(payload).forEach((k) => { overrides[k] = payload[k] })
    saveJSON(LS.OVERRIDES, overrides)

    await saveContent(payload)
    emit()
    setTimeout(() => rescan(), 100)

    const fresh = Array.from({ length: newCount }, (_, i) => `char#${i}`)
    setOriginal(fresh)
    setCharacters(fresh)
  }

  const onSaveGraph = () => {
    setSaving(true)
    saveGraph(characters)
      .then(() => { toast('Changes saved successfully'); setSaving(false) })
      .catch(() => { toast('Error saving changes', 'error'); setSaving(false) })
  }

  const move = (idx: number, dir: -1 | 1) => {
    setCharacters((s) => {
      const next = s.slice()
      ;[next[idx], next[idx + dir]] = [next[idx + dir], next[idx]]
      return next
    })
  }

  const pick = (key: string) => {
    ensureCharacterMeta(key)
    onPickImage(key)
  }

  return (
    <CmsModal
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>Characters Manager</span>
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
              <div role="tooltip" style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 50, width: 320, padding: '0.6rem 0.8rem', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-secondary)', lineHeight: 1.55, boxShadow: '0 6px 20px rgba(0, 0, 0, 0.18)', textTransform: 'none', letterSpacing: 'normal' }}>
                Manage your Character Design list.<br />
                Click <strong>image</strong> or <strong>edit info</strong> icon to update portrait, name, role, and description.<br />
                Click <strong>C1–C4</strong> buttons to upload or change concept art images.<br />
                Reorder characters with up/down arrows or add new items at the bottom.
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
            Total: <strong>{characters.length}</strong> {characters.length === 1 ? 'character' : 'characters'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {characters.map((vKey, i) => {
            const name = state.items[`${vKey}::name`] || `Character #${i + 1} (Untitled)`
            const role = state.items[`${vKey}::role`] || `Character ${i + 1}`
            const src = portraitSrc(vKey)
            const empty = !src || src.trim() === '' || src === 'url("")' || src === 'url()'
            return (
              <div key={vKey} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.45rem', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)', flexWrap: 'wrap' }}>
                <div title={empty ? 'No portrait' : undefined} style={{ position: 'relative', width: 64, height: 64, borderRadius: 6, flexShrink: 0, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: 'var(--bg-primary)', backgroundImage: src ? `url("${src}")` : undefined, border: empty ? '1px dashed #b45309' : '1px solid var(--border)' }}>
                  {empty && <i className="fa-solid fa-user" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b45309', opacity: 0.55, fontSize: '1.2rem' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 160, fontSize: '0.85rem', fontWeight: 600 }}>
                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>
                    {name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400, marginTop: 2 }}>
                    {role} {empty && <span style={{ color: '#b45309' }}>· no portrait</span>}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="cms-icon-btn"
                    title="Change portrait image"
                    aria-label="Change portrait image"
                    onClick={async () => {
                      let targetKey = vKey
                      if (dirty || vKey.startsWith('char#new_')) {
                        await saveGraph(characters)
                        const idx = characters.indexOf(vKey)
                        if (idx !== -1) targetKey = `char#${idx}`
                      }
                      pick(targetKey)
                    }}
                  >
                    <i className="fa-solid fa-image"></i>
                  </button>
                  <button
                    type="button"
                    className="cms-icon-btn"
                    title="Edit info (Name, Role, Description)"
                    aria-label="Edit info (Name, Role, Description)"
                    onClick={async () => {
                      let targetKey = vKey
                      if (dirty || vKey.startsWith('char#new_')) {
                        await saveGraph(characters)
                        const idx = characters.indexOf(vKey)
                        if (idx !== -1) targetKey = `char#${idx}`
                      }
                      ensureCharacterMeta(targetKey)
                      if (onEditInfo) {
                        onEditInfo(targetKey)
                      } else {
                        window.dispatchEvent(new CustomEvent('cms:editInfo', { detail: { key: targetKey } }))
                      }
                    }}
                  >
                    <i className="fa-solid fa-pen-to-square"></i>
                  </button>

                  <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 0.2rem' }} />

                  {Array.from({ length: CONCEPTS_PER }, (_, m) => {
                    const cKey = `${vKey}::c${m}`
                    const cSrc = portraitSrc(cKey)
                    return (
                      <button
                        key={m}
                        type="button"
                        className="cms-icon-btn"
                        style={{ width: 34, height: 34, padding: 0, position: 'relative', overflow: 'hidden', border: cSrc ? '1px solid var(--accent)' : '1px dashed var(--border)' }}
                        title={`Concept art #${m + 1} (${cSrc ? 'Uploaded - Click to change' : 'Empty - Click to upload'})`}
                        onClick={async () => {
                          let targetKey = cKey
                          if (dirty || vKey.startsWith('char#new_')) {
                            await saveGraph(characters)
                            const idx = characters.indexOf(vKey)
                            if (idx !== -1) targetKey = `char#${idx}::c${m}`
                          }
                          pick(targetKey)
                        }}
                      >
                        {cSrc ? (
                          <div style={{ width: '100%', height: '100%', backgroundSize: 'cover', backgroundPosition: 'center', backgroundImage: `url("${cSrc}")` }} />
                        ) : (
                          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>C{m + 1}</span>
                        )}
                      </button>
                    )
                  })}

                  <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 0.2rem' }} />

                  <button type="button" className="cms-icon-btn" title="Move up" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                    <i className="fa-solid fa-chevron-up"></i>
                  </button>
                  <button type="button" className="cms-icon-btn" title="Move down" aria-label="Move down" disabled={i === characters.length - 1} onClick={() => move(i, 1)}>
                    <i className="fa-solid fa-chevron-down"></i>
                  </button>
                  <button type="button" className="cms-icon-btn cms-icon-btn--danger" title="Delete character" aria-label="Delete character" onClick={() => setCharacters((s) => s.filter((_, j) => j !== i))}>
                    <i className="fa-solid fa-trash"></i>
                  </button>
                </div>
              </div>
            )
          })}
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '0.25rem' }}>
            <button
              type="button"
              className="cms-btn"
              style={{ padding: '0.45rem 0.8rem', fontSize: '0.8rem', borderStyle: 'dashed' }}
              title="Add new character"
              onClick={() => {
                const newKey = `char#new_${nextNewId}`
                setNextNewId((n) => n + 1)
                ensureCharacterMeta(newKey)
                onPickImage(newKey)
              }}
            >
              <i className="fa-solid fa-plus"></i> Add character
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

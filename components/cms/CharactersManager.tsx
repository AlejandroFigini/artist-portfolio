'use client'

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

type Props = { show?: boolean; onClose: () => void; onPickImage: (key: string) => void }

const CONCEPTS_PER = 4

function parseSettings() {
  const settings = { count: 4 }
  try {
    const parsed = JSON.parse(state.items['char.settings'] || '')
    if (parsed && typeof parsed.count === 'number') settings.count = parsed.count
  } catch {}
  return settings
}

const portraitSrc = (vKey: string) =>
  state.items[vKey] || currentSrcOf(elementsByKey[vKey] || null) || ''

export default function CharactersManager({ show = true, onClose, onPickImage }: Props) {
  const toast = useToast()
  const storeVersion = useCmsStore()
  const [settings] = useState(() => parseSettings())
  const [original, setOriginal] = useState<string[]>(() =>
    Array.from({ length: settings.count }, (_, i) => `char#${i}`))

  const pendingNew = () =>
    Object.keys(state.items)
      .filter((k) => /^char#new_\d+$/.test(k) && !!state.items[k])
      .sort((a, b) => Number(a.split('_')[1]) - Number(b.split('_')[1]))
  const [characters, setCharacters] = useState<string[]>(() => [...original, ...pendingNew()])
  const [saving, setSaving] = useState(false)
  const [nextNewId, setNextNewId] = useState(() => {
    const ids = pendingNew().map((k) => Number(k.split('_')[1]))
    return ids.length ? Math.max(...ids) + 1 : settings.count
  })
  // fuerza re-render tras volver del picker/upload (escriben al store global)
  const [, setTick] = useState(0)

  const dirty = characters.length !== original.length || characters.some((s, i) => s !== original[i])

  // Mergea en vivo los personajes pendientes (char#new_*) creados desde el picker.
  useEffect(() => {
    setCharacters((prev) => {
      const add = pendingNew().filter((k) => !prev.includes(k))
      return add.length ? [...prev, ...add] : prev
    })
    setNextNewId((n) => {
      const ids = pendingNew().map((k) => Number(k.split('_')[1]))
      return ids.length ? Math.max(n, Math.max(...ids) + 1) : n
    })
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
      .then(() => { toast('Changes saved successfully'); setSaving(false); onClose() })
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
    setTimeout(() => setTick((t) => t + 1), 500)
  }

  return (
    <CmsModal title="Characters Manager" wide show={show} onClose={onClose} actions={[]}>
      <div className="cms-carousel-manager">
        <p style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Add, reorder, edit, or delete characters. Each character has a portrait, up to {CONCEPTS_PER} concepts, and info (name / role / description). Changes take effect when saved.
        </p>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
          <button
            type="button" className="cms-btn"
            onClick={() => {
              const newKey = `char#new_${nextNewId}`
              setCharacters((s) => [...s, newKey])
              setNextNewId((n) => n + 1)
              pick(newKey)
            }}
          >
            <i className="fa-solid fa-plus"></i> Add Character
          </button>
          {dirty && (
            <span style={{ fontSize: '0.85rem', color: '#f59e0b', fontWeight: 600 }}>
              <i className="fa-solid fa-triangle-exclamation"></i> Unsaved changes
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {characters.map((vKey, i) => {
            const name = state.items[`${vKey}::name`] || `Character #${i + 1} (Untitled)`
            const src = portraitSrc(vKey)
            return (
              <div key={vKey} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.6rem', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ width: 70, height: 70, borderRadius: 6, backgroundSize: 'cover', backgroundPosition: 'center', backgroundImage: src ? `url("${src}")` : undefined, backgroundColor: '#e5e7eb', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '0.65rem' }}>
                  {!src && 'No IMG'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: 'block', marginBottom: '0.4rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</strong>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <button type="button" className="cms-btn cms-btn--sm" onClick={() => pick(vKey)}>
                      <i className="fa-solid fa-user"></i> Portrait / Info
                    </button>
                    {Array.from({ length: CONCEPTS_PER }, (_, m) => (
                      <button key={m} type="button" className="cms-btn cms-btn--sm" title={`Concept ${m + 1}`} onClick={() => pick(`${vKey}::c${m}`)}>
                        <i className="fa-solid fa-palette"></i> {m + 1}
                      </button>
                    ))}
                    <button type="button" className="cms-btn cms-btn--sm" title="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                      <i className="fa-solid fa-arrow-up"></i>
                    </button>
                    <button type="button" className="cms-btn cms-btn--sm" title="Move down" disabled={i === characters.length - 1} onClick={() => move(i, 1)}>
                      <i className="fa-solid fa-arrow-down"></i>
                    </button>
                    <button type="button" className="cms-btn cms-btn--sm" title="Delete" style={{ color: '#ef4444' }} onClick={() => setCharacters((s) => s.filter((_, j) => j !== i))}>
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
          {characters.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No characters found. Add one.</div>
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

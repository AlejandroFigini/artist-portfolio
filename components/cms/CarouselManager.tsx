'use client'

/* Gestión del carrusel de portada — port de cms.js openCarouselManager():
   reordenar/eliminar/añadir slides (guardar grafo) + duración (guardar
   configuración, recarga). Mismas claves hero.slide#i / hero.settings. */

import { useState } from 'react'
import { CmsModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { saveContent } from '@/lib/api'
import { state, loadJSON, saveJSON, LS, persistUnused, persistUsed, archiveMediaKey, useCmsStore, emit, scheduleSyncToServer, flushSyncToServer } from '@/lib/cms/store'
import { elementsByKey, currentSrcOf, seedUsedContent, broadcastCarousel } from './engine'

const MIN_SLIDES = 0
const MAX_SLIDES = 4

type Props = { prefix: string; show?: boolean; onClose: () => void; onPickImage: (key: string) => void }

function parseSettings(prefix: string) {
  let count = 0
  let duration = 7
  try {
    const s = JSON.parse(state.items[`${prefix}.settings`] || '{}')
    if (typeof s.count === 'number' && s.count >= 0) count = s.count
    if (typeof s.duration === 'number' && s.duration > 0) duration = Math.max(2, s.duration / 1000)
  } catch {}

  // Si el count en settings es 0 (ej. subieron imagen directamente al placeholder vacío),
  // inferimos el count contando cuántas slides consecutivas tienen URL en state.items
  if (count === 0) {
    while (state.items[`${prefix}.slide#${count}`]) {
      count++
    }
  }

  return { count: Math.min(MAX_SLIDES, count), duration: duration * 1000 }
}

const slideSrc = (vKey: string, prefix: string) => state.items[vKey] || ''

export default function CarouselManager({ prefix, show = true, onClose, onPickImage }: Props) {
  const toast = useToast()
  useCmsStore()
  const [settings] = useState(() => parseSettings(prefix))
  // Permite count:0 (carrusel vacío).
  const initialCount = Math.max(0, settings.count)
  const [original, setOriginal] = useState<string[]>(() =>
    Array.from({ length: initialCount }, (_, i) => `${prefix}.slide#${i}`))
  const [slides, setSlides] = useState<string[]>(original)
  const [duration, setDuration] = useState(settings.duration / 1000)
  const [initialDuration, setInitialDuration] = useState(settings.duration / 1000)
  const [initialSrcs, setInitialSrcs] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    for (let i = 0; i < initialCount; i++) {
      const k = `${prefix}.slide#${i}`
      map[k] = slideSrc(k, prefix)
    }
    return map
  })
  const [saving, setSaving] = useState(false)
  const [showInfo, setShowInfo] = useState(false)

  const isEmptySlide = (k: string) => {
    const src = slideSrc(k, prefix)
    return !src || src.trim() === '' || src === 'url("")' || src === 'url()'
  }
  const dirty = slides.length !== original.length || slides.some((s, i) => s !== original[i])
  const hasEmpty = slides.some(isEmptySlide)
  const filledCount = slides.filter((k) => !isEmptySlide(k)).length

  const durationChanged = duration !== initialDuration
  const imageChanged = slides.some((vKey) => slideSrc(vKey, prefix) !== (initialSrcs[vKey] || ''))
  const hasChanges = dirty || durationChanged || imageChanged

  // Estado compacto (chip): color + icono + tooltip. El detalle vive en el tooltip,
  // no en texto plano → panel minimalista.
  const status = dirty
    ? { color: '#2563eb', icon: 'fa-circle-info', label: 'Save structure', title: 'Save structure to enable image uploading' }
    : (hasEmpty || (slides.length > 0 && filledCount < 1))
      ? { color: '#b45309', icon: 'fa-triangle-exclamation', label: `${filledCount}/${slides.length} with image`, title: 'Missing images: complete or remove empty slides' }
      : !hasChanges
        ? { color: '#64748b', icon: 'fa-check', label: 'No changes', title: 'No changes recorded in carousel' }
        : { color: '#047857', icon: 'fa-circle-check', label: 'Ready to save', title: 'All slides have images and there are pending changes' }

  // Reescribe slide#0..n según el orden actual y manda el payload (port saveGraph)
  const saveGraph = async (finalSlides: string[]) => {
    // 1. Recopilar todos los datos y entradas usadas de todas las diapositivas (reales y virtuales)
    const allKnownSlideKeys = new Set<string>([
      ...original,
      ...slides,
      ...finalSlides,
      ...Object.keys(state.items).filter((k) => k.startsWith(`${prefix}.slide#`)),
      ...Object.keys(state.usedContent).filter((k) => k.startsWith(`${prefix}.slide#`)),
    ])

    const oldData: Record<string, string> = {}
    const oldUsed: Record<string, any> = {}
    allKnownSlideKeys.forEach((k) => {
      const src = slideSrc(k, prefix)
      if (src) oldData[k] = src
      if (state.usedContent[k]) oldUsed[k] = state.usedContent[k]
    })

    // 2. slides eliminadas → archivar a "sin usar"
    allKnownSlideKeys.forEach((k) => {
      if (finalSlides.includes(k)) return
      archiveMediaKey(k, 'deleted')
      delete state.items[k]
      delete state.usedContent[k]
    })

    // 3. Preparar los nuevos datos de diapositivas
    const newItems: Record<string, string> = {}
    const newUsed: Record<string, any> = {}
    
    finalSlides.forEach((vKey, i) => {
      const realKey = `${prefix}.slide#${i}`
      const src = oldData[vKey] || state.items[vKey] || ''
      if (src) {
        newItems[realKey] = src
        const usedEntry = oldUsed[vKey] || state.usedContent[vKey]
        if (usedEntry) {
          newUsed[realKey] = { ...usedEntry, key: realKey }
        }
      }
    })

    // 4. Limpiar TODAS las keys asociadas a este carrusel
    allKnownSlideKeys.forEach((k) => {
      delete state.items[k]
      delete state.usedContent[k]
    })
    
    // 5. Insertar las nuevas y limpiar sobrantes
    Object.entries(newItems).forEach(([k, v]) => {
      state.items[k] = v
    })
    Object.entries(newUsed).forEach(([k, v]) => {
      state.usedContent[k] = v
    })

    persistUnused()
    persistUsed()

    const newCount = finalSlides.length
    const payload: Record<string, string> = { [`${prefix}.settings`]: JSON.stringify({ count: newCount, duration: duration * 1000 }) }
    state.items[`${prefix}.settings`] = payload[`${prefix}.settings`]
    for (let i = 0; i < Math.max(original.length, newCount); i++) {
      const rk = `${prefix}.slide#${i}`
      if (i >= newCount || state.items[rk] === undefined) {
        state.items[rk] = ''
      }
      payload[rk] = state.items[rk]
    }

    const overrides = loadJSON<Record<string, string>>(LS.OVERRIDES, {})
    Object.keys(payload).forEach((k) => { overrides[k] = payload[k] })
    Object.keys(overrides).forEach((k) => {
      if (k.startsWith(`${prefix}.slide#`) && !(k in payload)) {
        delete overrides[k]
      }
    })
    saveJSON(LS.OVERRIDES, overrides)
    scheduleSyncToServer('overrides')

    await saveContent(payload)
    const fresh = Array.from({ length: newCount }, (_, i) => `${prefix}.slide#${i}`)
    setOriginal(fresh)
    setSlides(fresh)
    const newSrcs: Record<string, string> = {}
    fresh.forEach((k) => { newSrcs[k] = slideSrc(k, prefix) })
    setInitialSrcs(newSrcs)
    setInitialDuration(duration)
    emit()
    broadcastCarousel(prefix)
  }

  // Guardar Grafo: persiste la estructura pero NO cierra el modal — el usuario
  // sigue editando (subir imágenes a las nuevas slides) en la misma sesión.
  const onSaveGraph = () => {
    setSaving(true)
    saveGraph(slides)
      .then(() => { toast('Structure saved successfully'); setSaving(false) })
      .catch(() => { toast('Error saving structure', 'error'); setSaving(false) })
  }

  const persistSettings = async (finalSlides: string[]) => {
    const dur = Math.max(1, Math.round(duration) || 7)
    if (finalSlides.length !== slides.length || dirty) await saveGraph(finalSlides)
    const payload = { [`${prefix}.settings`]: JSON.stringify({ count: finalSlides.length, duration: dur * 1000 }) }
    state.items[`${prefix}.settings`] = payload[`${prefix}.settings`]
    const overrides = loadJSON<Record<string, string>>(LS.OVERRIDES, {})
    overrides[`${prefix}.settings`] = payload[`${prefix}.settings`]
    saveJSON(LS.OVERRIDES, overrides)
    scheduleSyncToServer('overrides')
    await saveContent(payload)
    emit()
    broadcastCarousel(prefix)
  }

  // Guardar Configuración: NO se permiten diapositivas vacías. Todas deben tener
  // imagen (o eliminarse). Puede haber 0 imágenes (se elimina el carrusel).
  const onSaveSettings = () => {
    if (dirty) { toast('Save structure first', 'error'); return }
    if (!hasChanges) { toast('No changes recorded', 'error'); return }
    if (hasEmpty || (slides.length > 0 && filledCount < 1)) {
      toast('All slides must have an image (or remove empty ones)', 'error')
      return
    }
    setSaving(true)
    persistSettings(slides)
      .then(async () => { 
        toast('Carousel saved successfully')
        // Ensure pending state updates (like removing from unused) are saved before reloading
        try { await flushSyncToServer() } catch {}
        window.location.reload() 
      })
      .catch(() => { toast('Error saving settings', 'error'); setSaving(false) })
  }

  const move = (idx: number, dir: -1 | 1) => {
    setSlides((s) => {
      const next = s.slice()
      const tmp = next[idx + dir]
      next[idx + dir] = next[idx]
      next[idx] = tmp
      return next
    })
  }

  const addSlide = () => {
    if (slides.length >= MAX_SLIDES) { toast(`Maximum ${MAX_SLIDES} slides`, 'error'); return }
    // Cap + id único derivado del estado (puro): no excede MAX ni duplica keys.
    setSlides((s) => {
      if (s.length >= MAX_SLIDES) return s
      const ids = s.map((k) => (k.startsWith('new_slide_') ? Number(k.slice(10)) : -1)).filter(Number.isFinite)
      return [...s, `new_slide_${(ids.length ? Math.max(...ids) : -1) + 1}`]
    })
  }

  return (
    <CmsModal
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>Carousel Manager</span>
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
              <div role="tooltip" style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 50, width: 300, padding: '0.6rem 0.8rem', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-secondary)', lineHeight: 1.55, boxShadow: '0 6px 20px rgba(0, 0, 0, 0.18)', textTransform: 'none', letterSpacing: 'normal' }}>
                Minimum {MIN_SLIDES}, maximum {MAX_SLIDES} slides · 1 slide = static image (no rotation).<br />
                All slides must have an image to save the carousel.<br />
                Flow: <strong>Add</strong> → <strong>Save structure</strong> → <strong>Change image</strong> → <strong>Save carousel</strong>.
              </div>
            )}
          </span>
        </span>
      }
      show={show}
      onClose={onClose}
      actions={[]}
    >
      <div className="cms-carousel-manager">
        {/* Barra: estado conciso | duración */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <span title={status.title} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', fontWeight: 600, color: status.color }}>
            <i className={`fa-solid ${status.icon}`}></i>{status.label}
          </span>
          <span style={{ flex: 1 }} />
          <label title="Duration between slides (seconds)" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <i className="fa-solid fa-clock"></i>
            <input
              type="number" min={2} max={30} value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value, 10) || 7)}
              style={{ width: 54, padding: '0.35rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', textAlign: 'center' }}
            />
          </label>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {slides.map((vKey, i) => {
            const empty = isEmptySlide(vKey)
            return (
              <div key={vKey} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.45rem', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div title={empty ? 'No image' : undefined} style={{ position: 'relative', width: 84, height: 50, borderRadius: 4, flexShrink: 0, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: 'var(--bg-primary)', backgroundImage: `url("${slideSrc(vKey, prefix)}")`, border: empty ? '1px dashed #b45309' : '1px solid var(--border)' }}>
                  {empty && <i className="fa-solid fa-image" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b45309', opacity: 0.55, fontSize: '1rem' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0, fontSize: '0.85rem', fontWeight: 600 }}>
                  Slide {i + 1}
                  {empty && <span style={{ marginLeft: 6, fontWeight: 400, fontSize: '0.75rem', color: '#b45309' }}>· no image</span>}
                </div>
                <button type="button" className="cms-icon-btn" disabled={vKey.startsWith('new_slide_') || dirty} title={vKey.startsWith('new_slide_') || dirty ? 'Save structure first' : 'Change image'} aria-label="Change image" onClick={() => onPickImage(vKey)}>
                  <i className="fa-solid fa-arrow-up-from-bracket"></i>
                </button>
                <button type="button" className="cms-icon-btn" title="Move up" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                  <i className="fa-solid fa-chevron-up"></i>
                </button>
                <button type="button" className="cms-icon-btn" title="Move down" aria-label="Move down" disabled={i === slides.length - 1} onClick={() => move(i, 1)}>
                  <i className="fa-solid fa-chevron-down"></i>
                </button>
                <button type="button" className="cms-icon-btn cms-icon-btn--danger" title={slides.length <= MIN_SLIDES ? `Minimum ${MIN_SLIDES} slide` : 'Delete'} aria-label="Delete" disabled={slides.length <= MIN_SLIDES} onClick={() => setSlides((s) => (s.length <= MIN_SLIDES ? s : s.filter((_, j) => j !== i)))}>
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
              disabled={slides.length >= MAX_SLIDES}
              title={slides.length >= MAX_SLIDES ? `Maximum ${MAX_SLIDES} slides` : 'Add new slide'}
              onClick={addSlide}
            >
              <i className="fa-solid fa-plus"></i> Add slide
            </button>
          </div>
        </div>

        <div className="cms-modal-actions" style={{ justifyContent: 'flex-end', gap: '0.35rem' }}>
          {dirty && (
            <button
              type="button"
              className="cms-btn cms-btn--primary"
              style={{ margin: 0 }}
              disabled={saving || slides.length < MIN_SLIDES || slides.length > MAX_SLIDES}
              onClick={onSaveGraph}
            >
              {saving ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Saving…</> : <><i className="fa-solid fa-diagram-project"></i> Save structure</>}
            </button>
          )}
          <button
            type="button" className="cms-btn cms-btn--primary"
            style={{ margin: 0 }}
            disabled={saving || dirty || !hasChanges || hasEmpty || (slides.length > 0 && filledCount < 1)}
            title={dirty ? 'Save structure first' : !hasChanges ? 'No changes recorded' : hasEmpty ? 'Complete or remove empty slides' : (slides.length > 0 && filledCount < 1) ? 'Add at least one image' : undefined}
            onClick={onSaveSettings}
          >
            {saving ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Saving…</> : <><i className="fa-solid fa-floppy-disk"></i> Save carousel</>}
          </button>
        </div>
      </div>
    </CmsModal>
  )
}


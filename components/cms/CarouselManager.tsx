'use client'

/* Gestión del carrusel de portada — port de cms.js openCarouselManager():
   reordenar/eliminar/añadir slides (guardar grafo) + duración (guardar
   configuración, recarga). Mismas claves hero.slide#i / hero.settings. */

import { useState } from 'react'
import { CmsModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { saveContent } from '@/lib/api'
import { state, loadJSON, saveJSON, LS, persistUnused, persistUsed, retireUsedEntryToUnused, useCmsStore } from '@/lib/cms/store'
import { elementsByKey, currentSrcOf, seedUsedContent } from './engine'

const MIN_SLIDES = 1
const MAX_SLIDES = 4

type Props = { prefix: string; show?: boolean; onClose: () => void; onPickImage: (key: string) => void }

function parseSettings(prefix: string) {
  const settings = { count: 1, duration: 7000 }
  try {
    const parsed = JSON.parse(state.items[`${prefix}.settings`] || '')
    if (parsed) Object.assign(settings, parsed)
  } catch {}
  // count puede ser 0 (carrusel recién limpiado): se respeta; arriba se clampa a [0, MAX].
  settings.count = Number.isFinite(settings.count) ? Math.min(MAX_SLIDES, Math.max(0, settings.count)) : 1
  settings.duration = settings.duration || 7000
  return settings
}

const slideSrc = (vKey: string, prefix: string) =>
  vKey.startsWith(`${prefix}.slide#`)
    ? state.items[vKey] || currentSrcOf(elementsByKey[vKey] || null)
    : ''

export default function CarouselManager({ prefix, show = true, onClose, onPickImage }: Props) {
  const toast = useToast()
  useCmsStore()
  const [settings] = useState(() => parseSettings(prefix))
  // Siempre ≥1 fila para editar (incluso tras limpiar, count:0 → 1 fila vacía).
  const initialCount = Math.max(1, settings.count)
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
    ? { color: '#2563eb', icon: 'fa-circle-info', label: 'Guardá la estructura', title: 'Guardá la estructura para habilitar la subida de imágenes' }
    : (hasEmpty || filledCount < 1)
      ? { color: '#b45309', icon: 'fa-triangle-exclamation', label: `${filledCount}/${slides.length} con imagen`, title: 'Faltan imágenes: completá o eliminá las diapositivas vacías' }
      : !hasChanges
        ? { color: '#64748b', icon: 'fa-check', label: 'Sin cambios', title: 'No se registraron cambios en el carrusel' }
        : { color: '#047857', icon: 'fa-circle-check', label: 'Listo para guardar', title: 'Todas las diapositivas tienen imagen y hay cambios pendientes' }

  // Reescribe slide#0..n según el orden actual y manda el payload (port saveGraph)
  const saveGraph = async (finalSlides: string[]) => {
    const oldData: Record<string, string | undefined> = {}
    original.forEach((k) => { oldData[k] = state.items[k] })

    finalSlides.forEach((vKey, i) => {
      const realKey = `${prefix}.slide#${i}`
      if (vKey.startsWith(`${prefix}.slide#`) && oldData[vKey]) state.items[realKey] = oldData[vKey]!
      else delete state.items[realKey]
    })

    // slides eliminadas → no usados
    original.forEach((k) => {
      if (finalSlides.includes(k)) return
      const prev = state.usedContent[k]
      if (prev) {
        retireUsedEntryToUnused(prev, 'deleted', [k])
        delete state.usedContent[k]
      }
    })
    persistUnused()
    persistUsed()

    const newCount = finalSlides.length
    const payload: Record<string, string> = { [`${prefix}.settings`]: JSON.stringify({ count: newCount, duration: duration * 1000 }) }
    state.items[`${prefix}.settings`] = payload[`${prefix}.settings`]
    for (let i = 0; i < Math.max(original.length, newCount); i++) {
      const rk = `${prefix}.slide#${i}`
      if (state.items[rk] === undefined) state.items[rk] = ''
      payload[rk] = state.items[rk]
    }

    const overrides = loadJSON<Record<string, string>>(LS.OVERRIDES, {})
    // Aplica el payload, pero limpia los keys huérfanos (vacíos por encima del
    // newCount) para no dejar basura en el storage tras una poda.
    Object.keys(payload).forEach((k) => { overrides[k] = payload[k] })
    for (let i = newCount; i < original.length; i++) {
      delete overrides[`${prefix}.slide#${i}`]
    }
    saveJSON(LS.OVERRIDES, overrides)

    await saveContent(payload)
    seedUsedContent()
    const fresh = Array.from({ length: newCount }, (_, i) => `${prefix}.slide#${i}`)
    setOriginal(fresh)
    setSlides(fresh)
    const newSrcs: Record<string, string> = {}
    fresh.forEach((k) => { newSrcs[k] = slideSrc(k, prefix) })
    setInitialSrcs(newSrcs)
    setInitialDuration(duration)
  }

  // Guardar Grafo: persiste la estructura pero NO cierra el modal — el usuario
  // sigue editando (subir imágenes a las nuevas slides) en la misma sesión.
  const onSaveGraph = () => {
    setSaving(true)
    saveGraph(slides)
      .then(() => { toast('Grafo guardado correctamente'); setSaving(false) })
      .catch(() => { toast('Error guardando el grafo', 'error'); setSaving(false) })
  }

  const persistSettings = async (finalSlides: string[]) => {
    const dur = Math.max(1, Math.round(duration) || 7)
    if (finalSlides.length !== slides.length || dirty) await saveGraph(finalSlides)
    const payload = { [`${prefix}.settings`]: JSON.stringify({ count: finalSlides.length, duration: dur * 1000 }) }
    state.items[`${prefix}.settings`] = payload[`${prefix}.settings`]
    const overrides = loadJSON<Record<string, string>>(LS.OVERRIDES, {})
    overrides[`${prefix}.settings`] = payload[`${prefix}.settings`]
    saveJSON(LS.OVERRIDES, overrides)
    await saveContent(payload)
    seedUsedContent()
  }

  // Guardar Configuración: NO se permiten diapositivas vacías. Todas deben tener
  // imagen (o eliminarse). Mínimo 1 imagen (1 sola = imagen única, sin rotación).
  const onSaveSettings = () => {
    if (dirty) { toast('Guardá el grafo primero', 'error'); return }
    if (!hasChanges) { toast('No se registraron cambios', 'error'); return }
    if (hasEmpty || filledCount < 1) {
      toast('Todas las diapositivas deben tener imagen (o eliminá las vacías)', 'error')
      return
    }
    setSaving(true)
    persistSettings(slides)
      .then(() => { toast('Carrusel guardado correctamente'); window.location.reload() })
      .catch(() => { toast('Error guardando configuración', 'error'); setSaving(false) })
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
    if (slides.length >= MAX_SLIDES) { toast(`Máximo ${MAX_SLIDES} diapositivas`, 'error'); return }
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
          <span>Gestión de Carrusel</span>
          <span
            style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
            onMouseEnter={() => setShowInfo(true)}
            onMouseLeave={() => setShowInfo(false)}
          >
            <button
              type="button"
              className="cms-icon-btn"
              style={{ border: 'none', background: 'transparent', padding: '0.1rem 0.25rem', color: 'var(--text-secondary)', fontSize: '0.9em' }}
              aria-label="Ayuda"
              aria-expanded={showInfo}
              onFocus={() => setShowInfo(true)}
              onBlur={() => setShowInfo(false)}
            >
              <i className="fa-solid fa-circle-info"></i>
            </button>
            {showInfo && (
              <div role="tooltip" style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 50, width: 300, padding: '0.6rem 0.8rem', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-secondary)', lineHeight: 1.55, boxShadow: '0 6px 20px rgba(0, 0, 0, 0.18)', textTransform: 'none', letterSpacing: 'normal' }}>
                Mínimo {MIN_SLIDES}, máximo {MAX_SLIDES} diapositivas · 1 sola = imagen fija (sin rotación).<br />
                Todas las diapositivas deben tener imagen para guardar el carrusel.<br />
                Flujo: <strong>Añadir</strong> → <strong>Guardar estructura</strong> → <strong>Cambiar imagen</strong> → <strong>Guardar carrusel</strong>.
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
          <label title="Duración entre diapositivas (segundos)" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
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
                <div title={empty ? 'Sin imagen' : undefined} style={{ position: 'relative', width: 84, height: 50, borderRadius: 4, flexShrink: 0, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: 'var(--bg-primary)', backgroundImage: `url("${slideSrc(vKey, prefix)}")`, border: empty ? '1px dashed #b45309' : '1px solid var(--border)' }}>
                  {empty && <i className="fa-solid fa-image" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b45309', opacity: 0.55, fontSize: '1rem' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0, fontSize: '0.85rem', fontWeight: 600 }}>
                  Diapositiva {i + 1}
                  {empty && <span style={{ marginLeft: 6, fontWeight: 400, fontSize: '0.75rem', color: '#b45309' }}>· sin imagen</span>}
                </div>
                <button type="button" className="cms-icon-btn" disabled={vKey.startsWith('new_slide_') || dirty} title={vKey.startsWith('new_slide_') || dirty ? 'Guardá la estructura primero' : 'Cambiar imagen'} aria-label="Cambiar imagen" onClick={() => onPickImage(vKey)}>
                  <i className="fa-solid fa-arrow-up-from-bracket"></i>
                </button>
                <button type="button" className="cms-icon-btn" title="Subir" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)}>
                  <i className="fa-solid fa-chevron-up"></i>
                </button>
                <button type="button" className="cms-icon-btn" title="Bajar" aria-label="Bajar" disabled={i === slides.length - 1} onClick={() => move(i, 1)}>
                  <i className="fa-solid fa-chevron-down"></i>
                </button>
                <button type="button" className="cms-icon-btn cms-icon-btn--danger" title={slides.length <= MIN_SLIDES ? `Mínimo ${MIN_SLIDES} diapositiva` : 'Eliminar'} aria-label="Eliminar" disabled={slides.length <= MIN_SLIDES} onClick={() => setSlides((s) => (s.length <= MIN_SLIDES ? s : s.filter((_, j) => j !== i)))}>
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
              title={slides.length >= MAX_SLIDES ? `Máximo ${MAX_SLIDES} diapositivas` : 'Añadir nueva diapositiva'}
              onClick={addSlide}
            >
              <i className="fa-solid fa-plus"></i> Añadir diapositiva
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
              {saving ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Guardando…</> : <><i className="fa-solid fa-diagram-project"></i> Guardar estructura</>}
            </button>
          )}
          <button
            type="button" className="cms-btn cms-btn--primary"
            style={{ margin: 0 }}
            disabled={saving || dirty || !hasChanges || hasEmpty || filledCount < 1}
            title={dirty ? 'Guardá la estructura primero' : !hasChanges ? 'No se registraron cambios' : hasEmpty ? 'Completá o eliminá las diapositivas vacías' : filledCount < 1 ? 'Agregá al menos una imagen' : undefined}
            onClick={onSaveSettings}
          >
            {saving ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Guardando…</> : <><i className="fa-solid fa-floppy-disk"></i> Guardar carrusel</>}
          </button>
        </div>
      </div>
    </CmsModal>
  )
}


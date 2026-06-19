'use client'

/* Gestión del carrusel de portada — port de cms.js openCarouselManager():
   reordenar/eliminar/añadir slides (guardar grafo) + duración (guardar
   configuración, recarga). Mismas claves hero.slide#i / hero.settings. */

import { useState } from 'react'
import { CmsModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { saveContent } from '@/lib/api'
import { state, loadJSON, saveJSON, LS, persistUnused, persistUsed } from '@/lib/cms/store'
import { elementsByKey, currentSrcOf } from './engine'

const MIN_SLIDES = 2
const MAX_SLIDES = 5

type Props = { prefix: string; show?: boolean; onClose: () => void; onPickImage: (key: string) => void }

function parseSettings(prefix: string) {
  const settings = { count: 2, duration: 7000 }
  try {
    const parsed = JSON.parse(state.items[`${prefix}.settings`] || '')
    if (parsed) Object.assign(settings, parsed)
  } catch {}
  settings.count = settings.count || 2
  settings.duration = settings.duration || 7000
  return settings
}

const slideSrc = (vKey: string, prefix: string) =>
  vKey.startsWith(`${prefix}.slide#`)
    ? state.items[vKey] || currentSrcOf(elementsByKey[vKey] || null)
    : ''

export default function CarouselManager({ prefix, show = true, onClose, onPickImage }: Props) {
  const toast = useToast()
  const [settings] = useState(() => parseSettings(prefix))
  const [original, setOriginal] = useState<string[]>(() =>
    Array.from({ length: settings.count }, (_, i) => `${prefix}.slide#${i}`))
  const [slides, setSlides] = useState<string[]>(original)
  const [duration, setDuration] = useState(settings.duration / 1000)
  const [saving, setSaving] = useState(false)
  const [nextNewId, setNextNewId] = useState(settings.count)

  const isEmptySlide = (k: string) => {
    const src = slideSrc(k, prefix)
    return !src || src.trim() === '' || src === 'url("")' || src === 'url()'
  }
  const dirty = slides.length !== original.length || slides.some((s, i) => s !== original[i])
  const hasEmpty = slides.some(isEmptySlide)
  const filledCount = slides.filter((k) => !isEmptySlide(k)).length

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
        state.unused.push({
          key: k, src: prev.src, dataUrl: prev.src, name: prev.name, size: prev.size,
          type: prev.kind === 'video' ? 'video/webm' : 'image/webp', ts: Date.now(),
          label: prev.label, section: prev.section, original: prev.original, reason: 'deleted',
        })
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
    const fresh = Array.from({ length: newCount }, (_, i) => `${prefix}.slide#${i}`)
    setOriginal(fresh)
    setSlides(fresh)
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
  }

  // Guardar Configuración: poda las slides vacías de forma automática
  // (regla del CMS: no se persisten slides sin imagen). Bloquea si quedan <2.
  const onSaveSettings = () => {
    const keep = slides.filter((k) => !isEmptySlide(k))
    if (keep.length < MIN_SLIDES) {
      toast(`Necesitas al menos ${MIN_SLIDES} imágenes para guardar el carrusel`, 'error')
      return
    }
    const pruned = slides.length - keep.length
    setSaving(true)
    persistSettings(keep)
      .then(() => {
        if (pruned > 0) toast(`Carrusel guardado. Se eliminaron ${pruned} diapositiva(s) vacía(s).`)
        else toast('Carrusel guardado correctamente')
        window.location.reload()
      })
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

  return (
    <CmsModal title="Gestión de Carrusel" show={show} onClose={onClose} actions={[]}>
      <div className="cms-carousel-manager">
        <p style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Configura el carrusel. Mínimo {MIN_SLIDES} y máximo {MAX_SLIDES} diapositivas.
        </p>
        <div
          style={{
            marginBottom: '1rem', padding: '0.6rem 0.8rem', borderRadius: 8, fontSize: '0.85rem',
            ...(dirty
              ? { background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.35)', color: '#1e40af' }
              : hasEmpty
                ? { background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.4)', color: '#92400e' }
                : { background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#065f46' }
            ),
          }}
        >
          {dirty
            ? <><i className="fa-solid fa-circle-info" style={{ marginRight: 6 }}></i>Guardá el grafo para habilitar la asignación de imágenes en las nuevas diapositivas.</>
            : hasEmpty
              ? <><i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 6 }}></i>{filledCount} de {slides.length} diapositiva(s) con imagen. Al guardar configuración, las {slides.length - filledCount} vacía(s) se eliminarán automáticamente.</>
              : <><i className="fa-solid fa-circle-check" style={{ marginRight: 6 }}></i>{filledCount} diapositiva(s) listas para guardar.</>
          }
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
              Duración (segundos)
            </label>
            <input
              type="number" min={2} max={30} value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value, 10) || 7)}
              style={{ width: 80, padding: '0.4rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
            />
          </div>
          <div style={{ marginTop: '1.2rem' }}>
            <button
              type="button" className="cms-btn"
              disabled={slides.length >= MAX_SLIDES}
              title={slides.length >= MAX_SLIDES ? `Máximo ${MAX_SLIDES} diapositivas permitidas` : undefined}
              onClick={() => {
                if (slides.length >= MAX_SLIDES) { toast(`Máximo ${MAX_SLIDES} diapositivas permitidas`, 'error'); return }
                setSlides((s) => [...s, `new_slide_${nextNewId}`])
                setNextNewId((n) => n + 1)
              }}
            >
              <i className="fa-solid fa-plus"></i> Añadir Slide
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {slides.map((vKey, i) => (
            <div key={vKey} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ width: 100, height: 60, borderRadius: 4, backgroundSize: 'cover', backgroundPosition: 'center', backgroundImage: `url("${slideSrc(vKey, prefix)}")` }}></div>
              <div style={{ flex: 1 }}>
                <strong style={{ display: 'block', marginBottom: '0.3rem' }}>Slide {i + 1}</strong>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button" className="cms-btn"
                    disabled={vKey.startsWith('new_slide_') || dirty}
                    title={vKey.startsWith('new_slide_') || dirty ? 'Guarda el grafo primero para editar' : undefined}
                    onClick={() => onPickImage(vKey)}
                  >
                    Cambiar Imagen
                  </button>
                  <button type="button" className="cms-btn" title="Subir" disabled={i === 0 || hasEmpty} onClick={() => move(i, -1)}>
                    <i className="fa-solid fa-arrow-up"></i>
                  </button>
                  <button type="button" className="cms-btn" title="Bajar" disabled={i === slides.length - 1 || hasEmpty} onClick={() => move(i, 1)}>
                    <i className="fa-solid fa-arrow-down"></i>
                  </button>
                  <button type="button" className="cms-btn" title={slides.length <= MIN_SLIDES ? `Mínimo ${MIN_SLIDES} diapositivas requeridas` : "Eliminar"} disabled={slides.length <= MIN_SLIDES} style={slides.length <= MIN_SLIDES ? {} : { color: '#ef4444' }} onClick={() => setSlides((s) => s.filter((_, j) => j !== i))}>
                    <i className="fa-solid fa-trash"></i>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="cms-modal-actions" style={{ justifyContent: 'space-between' }}>
          <div>
            {dirty && (
              <button type="button" className="cms-btn cms-btn--primary" disabled={saving || slides.length < MIN_SLIDES || slides.length > MAX_SLIDES} onClick={onSaveGraph}>
                {saving ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Guardando...</> : 'Guardar Grafo'}
              </button>
            )}
          </div>
          <button
            type="button" className="cms-btn cms-btn--primary"
            disabled={saving || dirty || filledCount < MIN_SLIDES}
            style={(dirty || filledCount < MIN_SLIDES) ? { opacity: 0.5 } : undefined}
            title={dirty ? 'Debes guardar el grafo primero' : filledCount < MIN_SLIDES ? `Mínimo ${MIN_SLIDES} imágenes para guardar` : undefined}
            onClick={onSaveSettings}
          >
            {saving ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Guardando...</> : 'Guardar Configuración'}
          </button>
        </div>
      </div>
    </CmsModal>
  )
}

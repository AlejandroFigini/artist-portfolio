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

const MAX_SLIDES = 7

type Props = { onClose: () => void; onPickImage: (key: string) => void }

function parseSettings() {
  const settings = { count: 3, duration: 7000 }
  try {
    const parsed = JSON.parse(state.items['hero.settings'] || '')
    if (parsed) Object.assign(settings, parsed)
  } catch {}
  settings.count = settings.count || 3
  settings.duration = settings.duration || 7000
  return settings
}

const slideSrc = (vKey: string) =>
  vKey.startsWith('hero.slide#')
    ? state.items[vKey] || currentSrcOf(elementsByKey[vKey] || null)
    : ''

export default function CarouselManager({ onClose, onPickImage }: Props) {
  const toast = useToast()
  const [settings] = useState(parseSettings)
  const [original, setOriginal] = useState<string[]>(() =>
    Array.from({ length: settings.count }, (_, i) => `hero.slide#${i}`))
  const [slides, setSlides] = useState<string[]>(original)
  const [duration, setDuration] = useState(settings.duration / 1000)
  const [saving, setSaving] = useState(false)
  const [nextNewId, setNextNewId] = useState(settings.count)

  const dirty = slides.length !== original.length || slides.some((s, i) => s !== original[i])
  const hasEmpty = slides.some((k) => {
    const src = slideSrc(k)
    return !src || src.trim() === '' || src === 'url("")' || src === 'url()'
  })

  // Reescribe hero.slide#0..n según el orden actual y manda el payload (port saveGraph)
  const saveGraph = async (finalSlides: string[]) => {
    const oldData: Record<string, string | undefined> = {}
    original.forEach((k) => { oldData[k] = state.items[k] })

    finalSlides.forEach((vKey, i) => {
      const realKey = `hero.slide#${i}`
      if (vKey.startsWith('hero.slide#') && oldData[vKey]) state.items[realKey] = oldData[vKey]!
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
    const payload: Record<string, string> = { 'hero.settings': JSON.stringify({ count: newCount, duration: duration * 1000 }) }
    state.items['hero.settings'] = payload['hero.settings']
    for (let i = 0; i < Math.max(original.length, newCount); i++) {
      const rk = `hero.slide#${i}`
      if (state.items[rk] === undefined) state.items[rk] = ''
      payload[rk] = state.items[rk]
    }

    const overrides = loadJSON<Record<string, string>>(LS.OVERRIDES, {})
    Object.keys(payload).forEach((k) => { overrides[k] = payload[k] })
    saveJSON(LS.OVERRIDES, overrides)

    await saveContent(payload)
    const fresh = Array.from({ length: newCount }, (_, i) => `hero.slide#${i}`)
    setOriginal(fresh)
    setSlides(fresh)
  }

  const onSaveGraph = () => {
    setSaving(true)
    saveGraph(slides)
      .then(() => toast('Grafo guardado correctamente'))
      .catch(() => toast('Error guardando el grafo', 'error'))
      .finally(() => setSaving(false))
  }

  const onSaveSettings = () => {
    setSaving(true)
    const dur = Math.max(1, Math.round(duration) || 7)
    const run = async () => {
      // limpiar slides vacías antes de guardar config (port del flujo legacy)
      const finalSlides = slides.filter((k) => {
        const src = slideSrc(k)
        return src && src.trim() !== '' && src !== 'url("")'
      })
      if (finalSlides.length !== slides.length || dirty) await saveGraph(finalSlides)
      const payload = { 'hero.settings': JSON.stringify({ count: finalSlides.length || slides.length, duration: dur * 1000 }) }
      state.items['hero.settings'] = payload['hero.settings']
      const overrides = loadJSON<Record<string, string>>(LS.OVERRIDES, {})
      overrides['hero.settings'] = payload['hero.settings']
      saveJSON(LS.OVERRIDES, overrides)
      await saveContent(payload)
    }
    run().finally(() => window.location.reload())
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
    <CmsModal title="Gestión de Carrusel" onClose={onClose} actions={[]}>
      <div className="cms-carousel-manager">
        <p style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Configura la portada principal. Puedes reordenar o eliminar diapositivas.
        </p>
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
              <div style={{ width: 100, height: 60, borderRadius: 4, backgroundSize: 'cover', backgroundPosition: 'center', backgroundImage: `url("${slideSrc(vKey)}")` }}></div>
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
                  <button type="button" className="cms-btn" title="Eliminar" style={{ color: '#ef4444' }} onClick={() => setSlides((s) => s.filter((_, j) => j !== i))}>
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
              <button type="button" className="cms-btn cms-btn--primary" disabled={saving} onClick={onSaveGraph}>
                {saving ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Guardando...</> : 'Guardar Grafo'}
              </button>
            )}
          </div>
          <button
            type="button" className="cms-btn cms-btn--primary"
            disabled={saving || dirty}
            style={dirty ? { opacity: 0.5 } : undefined}
            title={dirty ? 'Debes guardar el grafo primero' : undefined}
            onClick={onSaveSettings}
          >
            {saving ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Guardando...</> : 'Guardar Configuración'}
          </button>
        </div>
      </div>
    </CmsModal>
  )
}

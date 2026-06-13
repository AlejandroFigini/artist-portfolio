'use client'

/* 3D Models — portada de models-3d.html + models-3d.page.js: orbit-drag
   del cubo del hero, toggle wire/clay/render por viewport, tilt 3D,
   stagger y lightbox de turntable (solo con video real). */

import { useEffect, useRef, useState } from 'react'
import GalleryToolbar, { type GalleryFilterDef } from './GalleryToolbar'
import { useReveal } from '@/hooks/useReveal'
import { useTilt } from '@/hooks/useTilt'
import { openVideoLightbox } from '@/components/ui/lightbox'
import { realMedia } from '@/lib/media'

const FILTERS: GalleryFilterDef[] = [
  { id: 'all', label: 'All', i18n: 'm3d_f_all' },
  { id: 'characters', label: 'Characters', i18n: 'm3d_f_characters' },
  { id: 'props', label: 'Props', i18n: 'm3d_f_props' },
  { id: 'environments', label: 'Environments', i18n: 'm3d_f_environments' },
]

const ASSETS = [
  {
    cat: 'characters', phIcon: 'fa-cube', name: 'Stylized character', type: 'Characters', typeI18n: 'm3d_f_characters',
    specs: [['Tris', '—'], ['Maps', 'PBR'], ['Rig', '—']], soft: ['Blender', 'ZBrush', 'Substance'], dataTitle: 'Asset #1',
  },
  {
    cat: 'props', phIcon: 'fa-cubes', name: 'Hard-surface prop', type: 'Props', typeI18n: 'm3d_f_props',
    specs: [['Tris', '—'], ['Maps', 'PBR'], ['LODs', '—']], soft: ['Blender', 'Substance'], dataTitle: 'Asset #2',
  },
  {
    cat: 'environments', phIcon: 'fa-mountain-sun', name: 'Environment set', type: 'Environments', typeI18n: 'm3d_f_environments',
    specs: [['Tris', '—'], ['Maps', 'PBR'], ['Tileset', '—']], soft: ['Blender', 'Unreal'], dataTitle: 'Asset #3',
  },
  {
    cat: 'props', phIcon: 'fa-gem', name: 'Stylized prop', type: 'Props', typeI18n: 'm3d_f_props',
    specs: [['Tris', '—'], ['Maps', 'Hand'], ['LODs', '—']], soft: ['Blender', '3D-Coat'], dataTitle: 'Asset #4',
  },
  {
    cat: 'characters', phIcon: 'fa-dragon', name: 'Creature', type: 'Characters', typeI18n: 'm3d_f_characters',
    specs: [['Tris', '—'], ['Maps', 'PBR'], ['Rig', '—']], soft: ['ZBrush', 'Maya'], dataTitle: 'Asset #5',
  },
  {
    cat: 'environments', phIcon: 'fa-tree', name: 'Foliage pack', type: 'Environments', typeI18n: 'm3d_f_environments',
    specs: [['Tris', '—'], ['Maps', 'Atlas'], ['Wind', '—']], soft: ['Blender', 'Unreal'], dataTitle: 'Asset #6',
  },
]

const MODES = ['wire', 'clay', 'render'] as const
type Mode = (typeof MODES)[number]

// Orbit-drag del cubo del hero (port de models-3d.page.js)
function HeroCube() {
  const stageRef = useRef<HTMLDivElement>(null)
  const cubeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stage = stageRef.current
    const cube = cubeRef.current
    if (!stage || !cube) return
    let down = false, sx = 0, sy = 0, rx = -24, ry = 0
    stage.style.cursor = 'grab'

    const onDown = (e: PointerEvent) => {
      down = true; sx = e.clientX; sy = e.clientY
      cube.classList.add('grabbed')
      stage.style.cursor = 'grabbing'
    }
    const onMove = (e: PointerEvent) => {
      if (!down) return
      cube.style.transform = `rotateX(${rx - (e.clientY - sy) * 0.5}deg) rotateY(${ry + (e.clientX - sx) * 0.5}deg)`
    }
    const onUp = (e: PointerEvent) => {
      if (!down) return
      down = false
      stage.style.cursor = 'grab'
      rx = rx - (e.clientY - sy) * 0.5
      ry = ry + (e.clientX - sx) * 0.5
    }
    stage.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      stage.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  return (
    <div className="m3d-cube-stage" aria-hidden="true" ref={stageRef}>
      <div className="m3d-cube" ref={cubeRef}>
        <span className="cube-face cf-front"></span>
        <span className="cube-face cf-back"></span>
        <span className="cube-face cf-right"></span>
        <span className="cube-face cf-left"></span>
        <span className="cube-face cf-top"></span>
        <span className="cube-face cf-bottom"></span>
      </div>
    </div>
  )
}

function AssetCard({ a, hidden }: { a: (typeof ASSETS)[number]; hidden: boolean }) {
  const [mode, setMode] = useState<Mode>('wire')
  const vidRef = useRef<HTMLVideoElement>(null)

  const openIfReal = () => {
    const v = vidRef.current
    if (!realMedia(v)) return
    openVideoLightbox(v!.currentSrc || v!.getAttribute('src') || '', a.dataTitle, '')
  }

  return (
    <article
      className={`m3d-card reveal${hidden ? ' is-hidden' : ''}`}
      data-cat={a.cat}
      data-title={a.dataTitle}
      data-desc=""
    >
      <div className={`m3d-viewport mode-${mode}`} onClick={openIfReal}>
        <video ref={vidRef} className="obs-video" muted loop playsInline preload="none"></video>
        <span className="m3d-ph"><i className={`fa-solid ${a.phIcon}`}></i></span>
        <span className="m3d-wire-grid"></span>
        <div className="m3d-modes">
          {MODES.map((m) => (
            <button
              key={m}
              data-mode={m}
              className={mode === m ? 'active' : undefined}
              onClick={(e) => { e.stopPropagation(); setMode(m) }}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
        <button className="m3d-spin" type="button" onClick={(e) => { e.stopPropagation(); openIfReal() }}>
          <i className="fa-solid fa-arrows-rotate"></i> 360°
        </button>
      </div>
      <div className="m3d-info">
        <h3 className="m3d-name">{a.name}</h3>
        <span className="m3d-type" data-i18n={a.typeI18n}>{a.type}</span>
        <ul className="m3d-specs">
          {a.specs.map(([k, v]) => <li key={k}><span>{k}</span><b>{v}</b></li>)}
        </ul>
        <div className="m3d-soft">{a.soft.map((s) => <span key={s}>{s}</span>)}</div>
      </div>
    </article>
  )
}

export default function Models3DGallery() {
  const [filter, setFilter] = useState('all')
  useReveal({ selector: '.m3d-grid .m3d-card', step: 50 })
  useTilt('.m3d-card', { max: 6 })

  const visible = ASSETS.filter((a) => filter === 'all' || a.cat === filter)

  return (
    <main className="m3d-page">
      <section className="m3d-hero">
        <div className="m3d-grid-floor" aria-hidden="true"></div>
        <div className="m3d-blobs" aria-hidden="true"><span className="m3d-blob b1"></span><span className="m3d-blob b2"></span></div>
        <div className="m3d-hero-inner">
          <div className="m3d-hero-text">
            <p className="m3d-eyebrow" data-i18n="m3d_eyebrow">Realtime · 3D Lab</p>
            <h1 className="m3d-hero-title" data-i18n="m3d_title">3D Models</h1>
            <p className="m3d-hero-sub" data-i18n="m3d_intro">Hard-surface, organic and stylized assets — turntables,
              wireframes and breakdowns. The dimensional side of the work, built for realtime and render.</p>
          </div>
          <HeroCube />
        </div>
      </section>

      <GalleryToolbar
        filters={FILTERS}
        active={filter}
        onChange={setFilter}
        count={visible.length}
        countId="m3d-count-n"
        countLabel="assets"
        countI18n="m3d_assets"
        ariaLabel="Filter models"
      />

      <section className="m3d-grid-wrap">
        <div className="m3d-grid" id="m3d-grid">
          {ASSETS.map((a, i) => (
            <AssetCard key={i} a={a} hidden={filter !== 'all' && a.cat !== filter} />
          ))}
        </div>
        <p className="gallery-empty-note" data-i18n="m3d_note">Empty viewports are placeholders — the superadmin uploads
          turntables and breakdowns through the editing system.</p>
      </section>
    </main>
  )
}

'use client'

/* Animations — portada de animations.html + animations.page.js:
   reel con drag-scroll + flechas, hover-play y lightbox de video
   (solo con media real). Cards = contenedores CMS (src vacío). */

import { useRef, useState } from 'react'
import GalleryToolbar, { type GalleryFilterDef } from './GalleryToolbar'
import { useReveal } from '@/hooks/useReveal'
import { useDragScroll } from '@/hooks/useDragScroll'
import { openVideoLightbox } from '@/components/ui/lightbox'
import { realMedia } from '@/lib/media'

const FILTERS: GalleryFilterDef[] = [
  { id: 'all', label: 'All', i18n: 'anim_f_all' },
  { id: 'cutscenes', label: 'Cutscenes', i18n: 'anim_f_cutscenes' },
  { id: 'loops', label: 'Loops & cycles', i18n: 'anim_f_loops' },
  { id: 'experiments', label: 'Experiments', i18n: 'anim_f_experiments' },
]

const CLIPS = [
  { cat: 'cutscenes', tag: 'Cutscenes', tagI18n: 'anim_f_cutscenes', title: 'Cutscene', date: '2024', project: 'Project', dataTitle: 'Untitled clip #1' },
  { cat: 'loops', tag: 'Loops', tagI18n: 'anim_f_loops', title: 'Walk cycle', date: '2024', project: 'Motion study', dataTitle: 'Untitled clip #2' },
  { cat: 'experiments', tag: 'Experiment', tagI18n: 'anim_f_experiments', title: 'Motion experiment', date: '2023', project: 'Personal', dataTitle: 'Untitled clip #3' },
  { cat: 'cutscenes', tag: 'Cutscenes', tagI18n: 'anim_f_cutscenes', title: 'Cutscene', date: '2023', project: 'Project', dataTitle: 'Untitled clip #4' },
  { cat: 'loops', tag: 'Loops', tagI18n: 'anim_f_loops', title: 'Run cycle', date: '2022', project: 'Motion study', dataTitle: 'Untitled clip #5' },
  { cat: 'experiments', tag: 'Experiment', tagI18n: 'anim_f_experiments', title: 'Effects test', date: '2022', project: 'Personal', dataTitle: 'Untitled clip #6' },
]

// Pantalla de video con hover-play + click → lightbox (si hay media real)
function AnimScreen({ title, desc, children }: { title: string; desc?: string; children?: React.ReactNode }) {
  const vidRef = useRef<HTMLVideoElement>(null)
  return (
    <div
      className="anim-screen"
      onMouseEnter={() => { const v = vidRef.current; if (realMedia(v)) v!.play().catch(() => {}) }}
      onMouseLeave={() => { const v = vidRef.current; if (realMedia(v)) v!.pause() }}
      onClick={() => {
        const v = vidRef.current
        if (!realMedia(v)) return
        openVideoLightbox(v!.currentSrc || v!.getAttribute('src') || '', title, desc || '')
      }}
    >
      <video ref={vidRef} className="anim-video" muted loop playsInline preload="none"></video>
      <span className="anim-ph"><i className="fa-solid fa-film"></i></span>
      <button className="anim-play" aria-label="Play"><i className="fa-solid fa-play"></i></button>
      {children}
    </div>
  )
}

export default function AnimationsGallery() {
  const [filter, setFilter] = useState('all')
  const gridRef = useRef<HTMLDivElement>(null)
  useReveal()
  useDragScroll(gridRef)

  const visible = CLIPS.filter((c) => filter === 'all' || c.cat === filter)

  const step = (dir: -1 | 1) => {
    const grid = gridRef.current
    if (!grid) return
    const card = grid.querySelector('.anim-card')
    const amt = card ? card.getBoundingClientRect().width + 20 : 320
    grid.scrollBy({ left: dir * amt, behavior: 'smooth' })
  }

  return (
    <main className="anim-page">
      <section className="anim-hero">
        <div className="film-strip top" aria-hidden="true"></div>
        <div className="anim-hero-inner">
          <div className="anim-hero-text">
            <p className="anim-eyebrow"><span className="rec-dot"></span> <span data-i18n="anim_eyebrow">Now playing · Motion reel</span></p>
            <h1 className="anim-hero-title" data-i18n="anim_title">Animations</h1>
            <p className="anim-hero-sub" data-i18n="anim_intro">Cutscenes, loops and motion experiments. Character
              acting, weight and timing — the moving side of the portfolio. Press play and let it run.</p>
          </div>
          <figure className="anim-showreel reveal" data-title="Showreel 2024" data-desc="Demo reel placeholder." data-category="reel">
            <AnimScreen title="Showreel 2024" desc="Demo reel placeholder.">
              <span className="anim-screen-label"><span data-i18n="anim_showreel">Showreel</span> · 2024</span>
            </AnimScreen>
          </figure>
        </div>
        <div className="film-strip bottom" aria-hidden="true"></div>
      </section>

      <GalleryToolbar
        filters={FILTERS}
        active={filter}
        onChange={setFilter}
        count={visible.length}
        countId="anim-count-n"
        countLabel="clips"
        countI18n="anim_clips"
        ariaLabel="Filter animations"
      />

      <section className="anim-grid-wrap">
        <div className="anim-reel">
          <button className="anim-arrow prev" aria-label="Anterior" onClick={() => step(-1)}>
            <i className="fa-solid fa-chevron-left"></i>
          </button>
          <div className="anim-grid" id="anim-grid" ref={gridRef}>
            {CLIPS.map((clip, i) => (
              <article
                key={i}
                className={`anim-card reveal${filter !== 'all' && clip.cat !== filter ? ' is-hidden' : ''}`}
                data-category={clip.cat}
                data-title={clip.dataTitle}
                data-desc=""
              >
                <AnimScreen title={clip.dataTitle}>
                  <span className="anim-cat-tag" data-i18n={clip.tagI18n}>{clip.tag}</span>
                </AnimScreen>
                <div className="anim-meta">
                  <h3 className="video-title">{clip.title}</h3>
                  <div className="video-meta">
                    <span className="video-date"><i className="fa-regular fa-calendar"></i> {clip.date}</span>
                    <span className="video-project"><i className="fa-solid fa-folder-open"></i> {clip.project}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <button className="anim-arrow next" aria-label="Siguiente" onClick={() => step(1)}>
            <i className="fa-solid fa-chevron-right"></i>
          </button>
        </div>
        <p className="gallery-empty-note" data-i18n="anim_note">Empty screens are placeholders — the superadmin uploads the
          real clips through the editing system.</p>
      </section>
    </main>
  )
}

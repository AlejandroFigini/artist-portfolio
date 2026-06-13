'use client'

/* Illustrations — portada de illustrations.html + illustrations.page.js:
   stagger en cascada, tilt 3D, spotlight con auto-rotación (5s, pausa
   en hover) y lightbox de imagen (solo media real). */

import { useEffect, useState } from 'react'
import GalleryToolbar, { type GalleryFilterDef } from './GalleryToolbar'
import { useReveal } from '@/hooks/useReveal'
import { useTilt } from '@/hooks/useTilt'
import { openLightbox } from '@/components/ui/lightbox'
import { realMedia } from '@/lib/media'

const BLANK_GIF = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='

const FILTERS: GalleryFilterDef[] = [
  { id: 'all', label: 'All', i18n: 'illu_f_all' },
  { id: 'characters', label: 'Characters', i18n: 'illu_f_characters' },
  { id: 'environments', label: 'Environments', i18n: 'illu_f_environments' },
  { id: 'concept', label: 'Concept art', i18n: 'illu_f_concept' },
  { id: 'posters', label: 'Posters', i18n: 'illu_f_posters' },
]

const SPOTLIGHT = [
  {
    dataTitle: 'Featured piece', frameColor: 'bg-color-4', phIcon: 'fa-image',
    badge: 'Featured', badgeI18n: 'illu_featured',
    title: 'The piece of the month', titleI18n: 'illu_spot_title',
    desc: 'Use this space to highlight a key illustration: the process behind it, the tools, and the idea that started it. The superadmin can replace the image and edit this text from the same editing system.',
    descI18n: 'illu_spot_desc',
    metaIcon: 'fa-solid fa-palette', metaLabel: 'Digital painting', metaI18n: 'illu_meta_medium', year: '2024',
  },
  {
    dataTitle: 'Process', frameColor: 'bg-color-6', phIcon: 'fa-pen-nib',
    badge: 'Process', badgeI18n: 'illu_spot_b2',
    title: 'From sketch to final', titleI18n: 'illu_spot_t2',
    desc: 'A general caption for each rotating piece: describe the concept, the palette and the story behind it. Editable from the same system.',
    descI18n: 'illu_spot_d2',
    metaIcon: 'fa-solid fa-layer-group', metaLabel: 'Concept & render', metaI18n: 'illu_spot_m2', year: '2024',
  },
  {
    dataTitle: 'Latest', frameColor: 'bg-color-3', phIcon: 'fa-star',
    badge: 'Latest', badgeI18n: 'illu_spot_b3',
    title: 'Latest additions', titleI18n: 'illu_spot_t3',
    desc: 'Rotate through the highlights — each frame keeps its own short text so the gallery always shows image and story together.',
    descI18n: 'illu_spot_d3',
    metaIcon: 'fa-solid fa-palette', metaLabel: 'Digital painting', metaI18n: 'illu_meta_medium', year: '2025',
  },
]

const PIECES = [
  { cat: 'characters', size: 'tall', frameColor: 'bg-color-1', cap: 'Character study', tag: 'Characters', tagI18n: 'illu_f_characters', dataTitle: 'Untitled #1' },
  { cat: 'environments', size: '', frameColor: 'bg-color-3', cap: 'Environment', tag: 'Environments', tagI18n: 'illu_f_environments', dataTitle: 'Untitled #2' },
  { cat: 'posters', size: 'wide', frameColor: 'bg-color-6', cap: 'Poster', tag: 'Posters', tagI18n: 'illu_f_posters', dataTitle: 'Untitled #3' },
  { cat: 'concept', size: '', frameColor: 'bg-color-4', cap: 'Concept art', tag: 'Concept art', tagI18n: 'illu_f_concept', dataTitle: 'Untitled #4' },
  { cat: 'characters', size: 'tall', frameColor: 'bg-color-5', cap: 'Character study', tag: 'Characters', tagI18n: 'illu_f_characters', dataTitle: 'Untitled #5' },
  { cat: 'environments', size: '', frameColor: 'bg-color-7', cap: 'Environment', tag: 'Environments', tagI18n: 'illu_f_environments', dataTitle: 'Untitled #6' },
  { cat: 'concept', size: '', frameColor: 'bg-color-2', cap: 'Concept art', tag: 'Concept art', tagI18n: 'illu_f_concept', dataTitle: 'Untitled #7' },
  { cat: 'posters', size: 'wide', frameColor: 'bg-color-8', cap: 'Poster', tag: 'Posters', tagI18n: 'illu_f_posters', dataTitle: 'Untitled #8' },
  { cat: 'characters', size: 'tall', frameColor: 'bg-color-1', cap: 'Character study', tag: 'Characters', tagI18n: 'illu_f_characters', dataTitle: 'Untitled #9' },
]

// Click → lightbox de imagen, solo si hay imagen real cargada
function openCard(card: HTMLElement) {
  const img = card.querySelector<HTMLImageElement>('img.illu-img')
  if (!realMedia(img)) return
  openLightbox(
    img!.currentSrc || img!.src,
    card.getAttribute('data-title') || '',
    card.getAttribute('data-desc') || '',
    card.getAttribute('data-link') || '',
  )
}

export default function IllustrationsGallery() {
  const [filter, setFilter] = useState('all')
  const [slide, setSlide] = useState(0)
  const [paused, setPaused] = useState(false)
  useReveal({ selector: '.illu-gallery .illu-card', step: 45 })
  useTilt('.illu-card, .illu-spot-card', { max: 7 })

  // Auto-rotación del spotlight cada 5s; pausa en hover, sin reduced-motion.
  // Depender de [slide] reinicia el timer también tras un click en un dot.
  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = setInterval(() => setSlide((s) => (s + 1) % SPOTLIGHT.length), 5000)
    return () => clearInterval(timer)
  }, [paused, slide])

  const visible = PIECES.filter((p) => filter === 'all' || p.cat === filter)

  return (
    <main className="illu-page">
      <section className="illu-hero">
        <div className="illu-hero-strokes" aria-hidden="true">
          <span className="stroke s1"></span><span className="stroke s2"></span><span className="stroke s3"></span>
        </div>
        <div className="illu-hero-inner">
          <p className="illu-eyebrow" data-i18n="illu_eyebrow">Selected works · 2D</p>
          <h1 className="illu-hero-title" data-i18n="illu_title">Illustrations</h1>
          <p className="illu-hero-sub" data-i18n="illu_intro">A curated gallery of illustrations, concept art and
            visual development — from character pieces to full environments. Each frame is a small story in
            color and light.</p>
        </div>
      </section>

      <GalleryToolbar
        className="illu-toolbar"
        filters={FILTERS}
        active={filter}
        onChange={setFilter}
        count={visible.length}
        countId="illu-count-n"
        countLabel="pieces"
        countI18n="illu_pieces"
        ariaLabel="Filter illustrations"
      />

      <section
        className="illu-spotlight reveal"
        aria-roledescription="carousel"
        aria-label="Featured illustrations"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="illu-spot-stage" id="illu-spot-stage">
          {SPOTLIGHT.map((s, i) => (
            <article key={s.badge} className={`illu-spot-slide${i === slide ? ' active' : ''}`}>
              <figure
                className="illu-spot-card gallery-item"
                data-title={s.dataTitle}
                data-desc=""
                data-link=""
                onClick={(e) => openCard(e.currentTarget)}
              >
                <div className={`illu-frame ratio-wide ${s.frameColor}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="illu-img" alt="" src={BLANK_GIF} />
                  <span className="illu-ph"><i className={`fa-solid ${s.phIcon}`}></i></span>
                  <span className="illu-badge" data-i18n={s.badgeI18n}>{s.badge}</span>
                </div>
              </figure>
              <div className="illu-spot-info">
                <h2 className="illu-spot-title" data-i18n={s.titleI18n}>{s.title}</h2>
                <p className="illu-spot-desc" data-i18n={s.descI18n}>{s.desc}</p>
                <ul className="illu-spot-meta">
                  <li><i className={s.metaIcon}></i> <span data-i18n={s.metaI18n}>{s.metaLabel}</span></li>
                  <li><i className="fa-regular fa-calendar"></i> <span>{s.year}</span></li>
                </ul>
              </div>
            </article>
          ))}
        </div>
        <div className="illu-spot-dots" id="illu-spot-dots" role="tablist" aria-label="Spotlight navigation">
          {SPOTLIGHT.map((s, i) => (
            <button
              key={s.badge}
              role="tab"
              aria-selected={i === slide}
              aria-label={`Slide ${i + 1}`}
              className={i === slide ? 'active' : undefined}
              onClick={() => setSlide(i)}
            ></button>
          ))}
        </div>
      </section>

      <section className="illu-gallery-wrap">
        <div className="illu-gallery" id="illu-fullgrid">
          {PIECES.map((p, i) => (
            <figure
              key={i}
              className={`illu-card gallery-item reveal${p.size ? ` ${p.size}` : ''}${filter !== 'all' && p.cat !== filter ? ' is-hidden' : ''}`}
              data-category={p.cat}
              data-title={p.dataTitle}
              data-desc=""
              data-link=""
              onClick={(e) => openCard(e.currentTarget)}
            >
              <div className={`illu-frame ${p.frameColor}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="illu-img" alt="" src={BLANK_GIF} />
                <span className="illu-ph"><i className="fa-solid fa-image"></i></span>
              </div>
              <figcaption className="illu-cap">
                <span className="illu-cap-title">{p.cap}</span>
                <span className="illu-cap-tag" data-i18n={p.tagI18n}>{p.tag}</span>
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="gallery-empty-note" data-i18n="illu_note">These are empty placeholders. The superadmin uploads the
          real illustrations through the editing system.</p>
      </section>
    </main>
  )
}

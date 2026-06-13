'use client'

/* Multimedia — portada de multimedia.html + multimedia.page.js:
   stagger, tilt 3D y lightbox por tipo de media (solo media real). */

import { useState } from 'react'
import GalleryToolbar, { type GalleryFilterDef } from './GalleryToolbar'
import { useReveal } from '@/hooks/useReveal'
import { useTilt } from '@/hooks/useTilt'
import { openLightbox, openVideoLightbox } from '@/components/ui/lightbox'
import { realMedia } from '@/lib/media'

const BLANK_GIF = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='

const FILTERS: GalleryFilterDef[] = [
  { id: 'all', label: 'All', i18n: 'mm_f_all' },
  { id: 'video', label: 'Video', i18n: 'mm_f_video' },
  { id: 'image', label: 'Image', i18n: 'mm_f_image' },
  { id: 'embed', label: 'Embeds', i18n: 'mm_f_embed' },
]

type Item = { type: 'image' | 'video' | 'embed'; size?: 'tall' | 'wide'; color?: string }

const ITEMS: Item[] = [
  { type: 'image', size: 'tall', color: 'bg-color-4' },
  { type: 'video' },
  { type: 'embed' },
  { type: 'image', size: 'wide', color: 'bg-color-6' },
  { type: 'video', size: 'tall' },
  { type: 'embed' },
  { type: 'image', color: 'bg-color-3' },
  { type: 'video', size: 'wide' },
  { type: 'image', color: 'bg-color-7' },
]

const TYPE_META = {
  image: { tag: 'Image', i18n: 'mm_f_image', title: 'Untitled image' },
  video: { tag: 'Video', i18n: 'mm_f_video', title: 'Untitled video' },
  embed: { tag: 'Embed', i18n: 'mm_f_embed', title: 'Embed' },
} as const

function ItemMedia({ item }: { item: Item }) {
  if (item.type === 'image') {
    return (
      <div className={`mm-media ${item.color}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="illu-img" alt="" src={BLANK_GIF} />
        <span className="mm-ph"><i className="fa-solid fa-image"></i></span>
      </div>
    )
  }
  if (item.type === 'video') {
    return (
      <div className="mm-media mm-screen">
        <video className="anim-video" muted loop playsInline preload="none"></video>
        <span className="mm-ph"><i className="fa-solid fa-film"></i></span>
        <button className="mm-play" aria-label="Play"><i className="fa-solid fa-play"></i></button>
      </div>
    )
  }
  return (
    <div className="mm-media mm-embed">
      <span className="mm-ph"><i className="fa-solid fa-code"></i></span>
      <span className="mm-embed-label">Sketchfab / YouTube / Spotify</span>
    </div>
  )
}

// Click → lightbox según el tipo de media (solo si hay media real)
function openCard(card: HTMLElement, type: Item['type']) {
  if (type === 'image') {
    const img = card.querySelector<HTMLImageElement>('img.illu-img')
    if (!realMedia(img)) return
    openLightbox(img!.currentSrc || img!.src, card.getAttribute('data-title') || '',
      card.getAttribute('data-desc') || '', card.getAttribute('data-link') || '')
  } else if (type === 'video') {
    const v = card.querySelector<HTMLVideoElement>('video.anim-video')
    if (!realMedia(v)) return
    openVideoLightbox(v!.currentSrc || v!.getAttribute('src') || '',
      card.getAttribute('data-title') || '', card.getAttribute('data-desc') || '')
  }
}

export default function MultimediaGallery() {
  const [filter, setFilter] = useState('all')
  useReveal({ selector: '.mm-wall .mm-card', step: 45 })
  useTilt('.mm-card', { max: 6 })

  const visible = ITEMS.filter((it) => filter === 'all' || it.type === filter)

  return (
    <main className="mm-page">
      <section className="mm-hero">
        <div className="mm-hero-mosaic" aria-hidden="true">
          <span></span><span></span><span></span><span></span><span></span><span></span>
        </div>
        <div className="mm-hero-inner">
          <p className="mm-eyebrow" data-i18n="mm_eyebrow">Mixed media · Wall</p>
          <h1 className="mm-hero-title" data-i18n="mm_title">Multimedia</h1>
          <p className="mm-hero-sub" data-i18n="mm_intro">Everything that doesn&apos;t fit a single box: videos, images and
            embeds living together on one wall. A mixed feed of formats and experiments.</p>
        </div>
      </section>

      <GalleryToolbar
        filters={FILTERS}
        active={filter}
        onChange={setFilter}
        count={visible.length}
        countId="mm-count-n"
        countLabel="items"
        countI18n="mm_items"
        ariaLabel="Filter media"
      />

      <section className="mm-wall-wrap">
        <div className="mm-wall" id="mm-wall">
          {ITEMS.map((item, i) => {
            const meta = TYPE_META[item.type]
            return (
              <article
                key={i}
                className={`mm-card${item.type === 'image' ? ' gallery-item' : ''} reveal${item.size ? ` ${item.size}` : ''}${filter !== 'all' && item.type !== filter ? ' is-hidden' : ''}`}
                data-type={item.type}
                data-title={meta.title}
                onClick={(e) => openCard(e.currentTarget, item.type)}
                {...(item.type !== 'embed' ? { 'data-desc': '' } : {})}
                {...(item.type === 'image' ? { 'data-link': '' } : {})}
              >
                <ItemMedia item={item} />
                <span className="mm-type-tag" data-i18n={meta.i18n}>{meta.tag}</span>
              </article>
            )
          })}
        </div>
        <p className="gallery-empty-note" data-i18n="mm_note">Empty cards are placeholders — the superadmin uploads images,
          videos and embeds through the editing system.</p>
      </section>
    </main>
  )
}

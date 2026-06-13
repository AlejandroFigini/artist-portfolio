'use client'

/* Character Design — portada de characters.html + characters.page.js:
   character-select con roster, miniaturas que cambian el retrato y
   sección expandible (Read more). Retratos = contenedores CMS. */

import { useState } from 'react'
import GalleryToolbar, { type GalleryFilterDef } from './GalleryToolbar'
import { useReveal } from '@/hooks/useReveal'

const BLANK_GIF = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='

const FILTERS: GalleryFilterDef[] = [
  { id: 'all', label: 'All', i18n: 'char_f_all' },
  { id: 'protagonists', label: 'Protagonists', i18n: 'char_f_protagonists' },
  { id: 'antagonists', label: 'Antagonists', i18n: 'char_f_antagonists' },
  { id: 'creatures', label: 'Creatures', i18n: 'char_f_creatures' },
]

type Thumb = { color: string; icon: string; label: string }

type Character = {
  name: string
  faction: 'protagonists' | 'antagonists' | 'creatures'
  portraitColor: string
  portraitIcon: string
  thumbs: Thumb[]
  role: string
  roleI18n: string
  type: string
  debut: string
  palette: string[]
  tags: string[]
}

const CHARACTERS: Character[] = [
  {
    name: 'Alessio', faction: 'protagonists', portraitColor: 'bg-color-4', portraitIcon: 'fa-user-astronaut',
    thumbs: [
      { color: 'bg-color-4', icon: 'fa-user-astronaut', label: 'Portrait' },
      { color: 'bg-color-7', icon: 'fa-person', label: 'Turnaround' },
      { color: 'bg-color-3', icon: 'fa-palette', label: 'Concept' },
    ],
    role: 'Main character', roleI18n: 'char_role_main', type: 'Protagonist', debut: '2021',
    palette: ['#a78bfa', '#f9a8d4', '#fcd34d', '#34d399'], tags: ['Hero', 'Brave', 'Lead'],
  },
  {
    name: 'Jaffare', faction: 'protagonists', portraitColor: 'bg-color-3', portraitIcon: 'fa-user-astronaut',
    thumbs: [
      { color: 'bg-color-3', icon: 'fa-user-astronaut', label: 'Portrait' },
      { color: 'bg-color-5', icon: 'fa-person', label: 'Turnaround' },
      { color: 'bg-color-8', icon: 'fa-palette', label: 'Concept' },
    ],
    role: 'Supporting', roleI18n: 'char_role_support', type: 'Supporting', debut: '2021',
    palette: ['#67e8f9', '#a78bfa', '#fda4af', '#fde68a'], tags: ['Ally', 'Stylized'],
  },
  {
    name: 'Villain', faction: 'antagonists', portraitColor: 'bg-color-6', portraitIcon: 'fa-user-astronaut',
    thumbs: [
      { color: 'bg-color-6', icon: 'fa-user-astronaut', label: 'Portrait' },
      { color: 'bg-color-1', icon: 'fa-person', label: 'Turnaround' },
      { color: 'bg-color-2', icon: 'fa-palette', label: 'Concept' },
    ],
    role: 'Antagonist', roleI18n: 'char_role_antagonist', type: 'Antagonist', debut: '2022',
    palette: ['#7c3aed', '#ef4444', '#1f2937', '#f59e0b'], tags: ['Antagonist', 'Dark'],
  },
  {
    name: 'Creature', faction: 'creatures', portraitColor: 'bg-color-5', portraitIcon: 'fa-dragon',
    thumbs: [
      { color: 'bg-color-5', icon: 'fa-dragon', label: 'Render' },
      { color: 'bg-color-3', icon: 'fa-paw', label: 'Turnaround' },
      { color: 'bg-color-7', icon: 'fa-palette', label: 'Concept' },
    ],
    role: 'Creature', roleI18n: 'char_role_creature', type: 'Creature', debut: '2022',
    palette: ['#34d399', '#10b981', '#065f46', '#fcd34d'], tags: ['Beast', 'Concept'],
  },
  {
    name: 'Companion', faction: 'creatures', portraitColor: 'bg-color-7', portraitIcon: 'fa-dragon',
    thumbs: [
      { color: 'bg-color-7', icon: 'fa-dragon', label: 'Render' },
      { color: 'bg-color-4', icon: 'fa-paw', label: 'Turnaround' },
      { color: 'bg-color-1', icon: 'fa-palette', label: 'Concept' },
    ],
    role: 'Creature', roleI18n: 'char_role_creature', type: 'Creature', debut: '2023',
    palette: ['#fda4af', '#fdba74', '#fcd34d', '#a7f3d0'], tags: ['Sidekick', 'Cute'],
  },
  {
    name: 'Hero', faction: 'protagonists', portraitColor: 'bg-color-1', portraitIcon: 'fa-user-astronaut',
    thumbs: [
      { color: 'bg-color-1', icon: 'fa-user-astronaut', label: 'Portrait' },
      { color: 'bg-color-6', icon: 'fa-person', label: 'Turnaround' },
      { color: 'bg-color-4', icon: 'fa-palette', label: 'Concept' },
    ],
    role: 'Main character', roleI18n: 'char_role_main', type: 'Protagonist', debut: '2020',
    palette: ['#60a5fa', '#a78bfa', '#f472b6', '#fcd34d'], tags: ['Hero', 'Lead'],
  },
]

const TOTAL = String(CHARACTERS.length).padStart(2, '0')

// Panel de personaje: miniaturas cambian el retrato; "Read more" expande
function CharPanel({ c, index, active }: { c: Character; index: number; active: boolean }) {
  const [thumb, setThumb] = useState(0)
  const [extraOpen, setExtraOpen] = useState(false)
  const current = c.thumbs[thumb]

  return (
    <article className={`cs-panel${active ? ' active' : ''}`} data-faction={c.faction}>
      <div className="cs-gallery">
        <div className={`cs-portrait ${current.color}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="char-img" alt="" src={BLANK_GIF} />
          <span className="cs-ph"><i className={`fa-solid ${current.icon}`}></i></span>
        </div>
        <div className="cs-thumbs">
          {c.thumbs.map((t, j) => (
            <button
              key={t.label}
              className={`cs-thumb ${t.color}${j === thumb ? ' active' : ''}`}
              data-color={t.color}
              data-icon={t.icon}
              aria-label={t.label}
              onClick={() => setThumb(j)}
            >
              <i className={`fa-solid ${t.icon}`}></i>
            </button>
          ))}
        </div>
      </div>
      <div className="cs-info">
        <span className="cs-id">#{String(index + 1).padStart(2, '0')} / {TOTAL}</span>
        <h2 className="cd-name">{c.name}</h2>
        <span className="cs-role" data-i18n={c.roleI18n}>{c.role}</span>
        <ul className="cs-stats">
          <li><span data-i18n="cs_type">Type</span><b>{c.type}</b></li>
          <li><span data-i18n="cs_debut">Debut</span><b>{c.debut}</b></li>
          <li><span data-i18n="cs_images">Images</span><b>{c.thumbs.length}</b></li>
        </ul>
        <div className="cs-palette" aria-hidden="true">
          {c.palette.map((color) => <span key={color} style={{ background: color }}></span>)}
        </div>
        <p className="cs-bio" data-i18n="char_bio_ph">Short bio placeholder. The superadmin can edit the name and description from the same editing system.</p>
        <div className={`cs-extra${extraOpen ? ' show' : ''}`}>
          <p data-i18n="char_extra_ph">References, palette notes and extra design details go here — fully editable from the same system.</p>
        </div>
        <button
          className={`cs-more${extraOpen ? ' open' : ''}`}
          type="button"
          onClick={() => setExtraOpen((o) => !o)}
        >
          <span data-i18n="cs_more">Read more</span> <i className="fa-solid fa-chevron-down"></i>
        </button>
        <ul className="cs-tags">{c.tags.map((t) => <li key={t}>{t}</li>)}</ul>
      </div>
    </article>
  )
}

export default function CharactersGallery() {
  const [filter, setFilter] = useState('all')
  const [active, setActive] = useState(0)
  useReveal()

  const matches = (c: Character) => filter === 'all' || c.faction === filter
  const visibleCount = CHARACTERS.filter(matches).length

  const changeFilter = (f: string) => {
    setFilter(f)
    // si el panel activo queda fuera del filtro, saltar al primero que matchee
    if (f !== 'all' && CHARACTERS[active].faction !== f) {
      const first = CHARACTERS.findIndex((c) => c.faction === f)
      if (first >= 0) setActive(first)
    }
  }

  return (
    <main className="char-page">
      <section className="char-hero">
        <div className="char-hero-grid-bg" aria-hidden="true"></div>
        <div className="char-hero-inner">
          <p className="char-eyebrow" data-i18n="char_eyebrow">Cast file · Character design</p>
          <h1 className="char-hero-title" data-i18n="char_title">Character Design</h1>
          <p className="char-hero-sub" data-i18n="char_intro">The full cast: protagonists, antagonists and the
            creatures in between. Pick anyone from the roster to open their file.</p>
        </div>
      </section>

      <GalleryToolbar
        filters={FILTERS}
        active={filter}
        onChange={changeFilter}
        count={visibleCount}
        countId="char-count-n"
        countLabel="entries"
        countI18n="char_entries"
        ariaLabel="Filter characters"
      />

      <section className="cs-wrap">
        <div className="cs-stage">
          {CHARACTERS.map((c, i) => (
            <CharPanel key={c.name} c={c} index={i} active={i === active} />
          ))}
        </div>

        <div className="cs-roster" id="cs-roster">
          {CHARACTERS.map((c, i) => (
            <button
              key={c.name}
              className={`cs-pick${i === active ? ' active' : ''}${matches(c) ? '' : ' is-hidden'}`}
              data-index={i}
              data-faction={c.faction}
              onClick={() => setActive(i)}
            >
              <span className={`cs-pick-portrait ${c.portraitColor}`}><i className={`fa-solid ${c.portraitIcon}`}></i></span>
              <span className="cs-pick-name">{c.name}</span>
            </button>
          ))}
        </div>
        <p className="gallery-empty-note" data-i18n="char_note">Placeholder dossiers — pick a character from the roster.
          The superadmin fills in portraits, names and bios through the editing system.</p>
      </section>
    </main>
  )
}

'use client'

/* Animations (home) — portado de index.html #animaciones + script.js:
   hover-play con controles, fullscreen → lightbox, doble-tap en táctil,
   viñetas decorativas con "teleportation" y canvas de blobs. */

import { useEffect, useRef, useState } from 'react'
import AnimBlobCanvas from './AnimBlobCanvas'
import { openVideoLightbox } from '@/components/ui/lightbox'
import { realMedia } from '@/lib/media'
import './animations-modern.css'

const SOFTWARE_STACK = [
  { href: 'https://www.adobe.com/products/illustrator.html', badge: 'ai', short: 'Ai', name: 'Adobe Illustrator' },
  { href: 'https://www.adobe.com/products/animate.html', badge: 'an', short: 'An', name: 'Adobe Animate' },
  { href: 'https://www.adobe.com/products/aftereffects.html', badge: 'ae', short: 'Ae', name: 'Adobe After Effects' },
  { href: 'https://www.adobe.com/products/photoshop.html', badge: 'ps', short: 'Ps', name: 'Adobe Photoshop' },
  { href: 'https://www.adobe.com/products/premiere.html', badge: 'pr', short: 'Pr', name: 'Adobe Premiere Pro' },
]

const DECOR_LABELS = ['Haai Thar', 'Galope']

const VIDEOS = [
  {
    title: 'Fox Animation', date: '2020', project: 'Concept Art',
    desc: 'A character animation study exploring fluid quadruped motion and expressive posing.',
    inspiration: 'Classic 2D animation and natural animal movement.',
  },
  {
    title: 'Dog Run Cycle', date: '2020', project: 'Motion Study',
    desc: 'A run-cycle study focused on weight, timing and looping mechanics.',
    inspiration: "Muybridge's locomotion studies.",
  },
  {
    title: 'Animated Short (Part 1)', date: '2021', project: 'Universidad ORT',
    desc: 'Exploring narrative pacing and character weight in a multi-stage animated sequence. Created as part of the diploma at ORT University.',
    inspiration: 'Narrative-driven student films.',
  },
  {
    title: 'LipSync Study', date: '2020', project: 'Dialogue Test',
    desc: 'Focusing on phonetic mouth movements and expressive character acting in sync with audio dialogue. Highlighting facial emotion fluidity.',
    inspiration: 'Expressive facial acting and phonetics.',
  },
  {
    title: 'Action Sequence', date: '2020', project: 'Mechanics',
    desc: 'A study in mechanical movement, anticipation, and follow-through. Analyzing the physics of body motion in a high-intensity character loop.',
    inspiration: 'Action animation and body mechanics.',
  },
  {
    title: 'Final Project Scene', date: '2021', project: 'Universidad ORT',
    desc: 'A cinematic composition from a final production phase. Integrating environment lighting, character rig complexity, and emotional storytelling.',
    inspiration: 'Cinematic storytelling and lighting.',
  },
]

// "Vista móvil" legacy: táctil o viewport angosto → doble-tap para fullscreen
const isMobileView = () =>
  window.matchMedia('(hover: none), (pointer: coarse)').matches || window.innerWidth <= 768

const clearTouchActive = (except?: Element | null) => {
  document.querySelectorAll('.touch-active').forEach((x) => { if (x !== except) x.classList.remove('touch-active') })
}

function VideoCard({ v }: { v: (typeof VIDEOS)[number] }) {
  const itemRef = useRef<HTMLDivElement>(null)
  const vidRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)

  const open = () => {
    const vid = vidRef.current
    if (!realMedia(vid)) return
    openVideoLightbox(vid!.currentSrc || vid!.getAttribute('src') || '', v.title, v.desc, {
      date: v.date, project: v.project, inspiration: v.inspiration,
    })
  }

  return (
    <div
      ref={itemRef}
      className="animation-item video-container"
      data-title={v.title}
      data-desc={v.desc}
      data-date={v.date}
      data-project={v.project}
      data-inspiration={v.inspiration}
      onMouseEnter={() => {
        if (itemRef.current?.closest('.section-inactive')) return
        vidRef.current?.play().then(() => setPlaying(true)).catch(() => {})
      }}
      onMouseLeave={() => {
        vidRef.current?.pause()
        setPlaying(false)
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('.play-pause-btn, .fullscreen-btn')) return
        const item = itemRef.current!
        if (isMobileView() && !item.classList.contains('touch-active')) {
          // Primer tap: revelar overlay y reproducir; el segundo abre fullscreen
          clearTouchActive(item)
          item.classList.add('touch-active')
          vidRef.current?.play().catch(() => {})
          return
        }
        open()
      }}
    >
      <video ref={vidRef} loop muted playsInline className="anim-video" preload="metadata"></video>
      <div className="video-overlay">
        <div className="video-info">
          <h3 className="video-title">{v.title}</h3>
          <div className="video-meta">
            <span className="video-date"><i className="fa-regular fa-calendar"></i> {v.date}</span>
            <span className="video-project"><i className="fa-solid fa-folder-open"></i> {v.project}</span>
          </div>
        </div>
        <div className="video-controls">
          <button
            className="control-btn play-pause-btn"
            aria-label="Pause/Play"
            onClick={(e) => {
              e.stopPropagation()
              const vid = vidRef.current
              if (!vid) return
              if (vid.paused) vid.play().then(() => setPlaying(true)).catch(() => {})
              else { vid.pause(); setPlaying(false) }
            }}
          >
            <i className={`fa-solid ${playing ? 'fa-pause' : 'fa-play'}`}></i>
          </button>
          <button className="control-btn fullscreen-btn" aria-label="Fullscreen" onClick={(e) => { e.stopPropagation(); open() }}>
            <i className="fa-solid fa-expand"></i>
          </button>
        </div>
      </div>
    </div>
  )
}

// Viñetas decorativas: aparecen 3s cada 10s en posiciones aleatorias,
// solo con la sección en viewport (port de initVignetteTeleportation)
function useVignetteTeleportation(sectionRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const section = sectionRef.current
    if (!section) return
    const vignettes = section.querySelectorAll<HTMLElement>('.decor-motion')
    if (!vignettes.length) return

    const SPOTS = [
      { top: '8%', left: '3%', right: 'auto', bottom: 'auto' },
      { top: '10%', right: '4%', left: 'auto', bottom: 'auto' },
      { top: '42%', left: '2%', right: 'auto', bottom: 'auto' },
      { top: '48%', right: '2%', left: 'auto', bottom: 'auto' },
      { bottom: '15%', left: '4%', right: 'auto', top: 'auto' },
      { bottom: '12%', right: '3%', left: 'auto', top: 'auto' },
    ]
    const PEEK_OPACITY = '0.18'
    const VISIBLE_MS = 3000
    const CYCLE_MS = 10000

    const applySpot = (el: HTMLElement, idx: number) => {
      const s = SPOTS[idx]
      if (!s) return
      el.style.top = s.top
      el.style.left = s.left
      el.style.right = s.right
      el.style.bottom = s.bottom
    }

    const timers: number[] = []
    function showCycle() {
      const nextL = [0, 2, 4][Math.floor(Math.random() * 3)]
      const nextR = [1, 3, 5][Math.floor(Math.random() * 3)]
      if (vignettes[0]) applySpot(vignettes[0], nextL)
      if (vignettes[1]) applySpot(vignettes[1], nextR)
      vignettes.forEach((v) => { v.style.opacity = PEEK_OPACITY })
      timers.push(window.setTimeout(() => vignettes.forEach((v) => { v.style.opacity = '0' }), VISIBLE_MS))
    }

    vignettes.forEach((v) => { v.style.opacity = '0' })

    let cycleTimer: number | null = null
    let firstShow: number | null = null
    const startCycle = () => {
      if (cycleTimer) return
      if (!firstShow) firstShow = window.setTimeout(showCycle, 2500)
      cycleTimer = window.setInterval(showCycle, CYCLE_MS)
    }
    const stopCycle = () => {
      if (cycleTimer) { clearInterval(cycleTimer); cycleTimer = null }
      vignettes.forEach((v) => { v.style.opacity = '0' })
    }

    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) startCycle()
      else stopCycle()
    }, { threshold: 0 })
    io.observe(section)

    return () => {
      io.disconnect()
      stopCycle()
      if (firstShow) clearTimeout(firstShow)
      timers.forEach(clearTimeout)
    }
  }, [sectionRef])
}

export default function AnimationsShowcase() {
  const [stackOpen, setStackOpen] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)
  useVignetteTeleportation(sectionRef)

  // Tap fuera de cualquier tarjeta → limpiar overlays táctiles (port L105)
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.animation-item, .gallery-item')) clearTouchActive(null)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  return (
    <section id="animaciones" className="animations-section anim-modern" ref={sectionRef}>
      {/* Fondo en movimiento moderno: malla de auroras a la deriva +
          barrido de luz, sobre lienzo oscuro. Capas GPU (transform/
          opacity), aria oculto. Ref.: secciones reel modernas con
          gradient mesh animado (Awwwards / Linear-style). */}
      <div className="am-bg" aria-hidden="true">
        <span className="am-aurora am-a1"></span>
        <span className="am-aurora am-a2"></span>
        <span className="am-aurora am-a3"></span>
        <span className="am-beam"></span>
      </div>

      <div
        className={`global-soft-reveal${stackOpen ? ' open' : ''}`}
        onClick={() => setStackOpen((o) => !o)}
      >
        <div className="global-soft-header">Production Stack <i className="fa-solid fa-layer-group"></i></div>
        <div className="global-soft-icons">
          {SOFTWARE_STACK.map((s) => (
            <a key={s.badge} href={s.href} target="_blank" rel="noopener noreferrer" className="soft-item">
              <span className={`soft-badge ${s.badge}`}>{s.short}</span><span className="soft-name">{s.name}</span>
            </a>
          ))}
        </div>
      </div>

      {DECOR_LABELS.map((label) => (
        <div className="decor-motion" key={label}>
          <video loop muted playsInline className="decor-video" preload="none"></video>
          <div className="decor-label">{label}</div>
        </div>
      ))}

      <div className="motion-grid"></div>
      <div className="anim-bg-animation">
        <AnimBlobCanvas />
      </div>
      <div className="section-title anim-title-container" data-scroll="reveal">
        <h2 className="section-typewriter" data-i18n="animations_title">Animations</h2>
        {/* regla-cota: se llena con el avance de la sección (HomeFx scrub) */}
        <span className="title-rule" aria-hidden="true"><span className="title-rule-fill"></span></span>
        <p className="anim-subtitle">A collection of movement and storytelling. From professional cutscenes to
          experimental character movements.</p>
        <a className="see-all-cta" href="/animations"><span>Explore all animations</span> <i className="fa-solid fa-arrow-right"></i></a>
      </div>
      <div className="animations-grid">
        {VIDEOS.map((v) => <VideoCard key={v.title} v={v} />)}
      </div>
    </section>
  )
}

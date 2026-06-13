'use client'

/* 3D Models (home) — portado de index.html #3dmodels + script.js:
   HUD con stats vivos (poly/fps/snap), generador de texto 3D random,
   redistribución móvil de videos (texto+2 / texto+2) y lightbox de
   los turntables. Cubos/cilindros decorativos animan por CSS. */

import { useEffect, useRef, useState } from 'react'
import { openVideoLightbox } from '@/components/ui/lightbox'
import { realMedia } from '@/lib/media'
import { perf } from '@/lib/perf'

const HUD_STATIC = [
  { cls: 'm1', id: 'hud-viewport', text: 'VIEWPORT: Perspective' },
  { cls: 'm3', id: 'hud-grid', text: 'GRID: 10.0 UNITS' },
  { cls: 'm5', id: 'hud-wire', text: 'WIREFRAME MODE' },
]

const CUBES: { cls: string; vertFaces: string[] }[] = [
  { cls: 'c1', vertFaces: ['front', 'back'] },
  { cls: 'c2', vertFaces: ['front'] },
  { cls: 'c3', vertFaces: ['right'] },
  { cls: 'c4', vertFaces: ['front', 'top'] },
]
const CUBE_FACES = ['front', 'back', 'right', 'left', 'top', 'bottom']
const CYLINDERS = ['cy1', 'cy2', 'cy3']
const CYL_PANELS = 12

const MODEL_VIDEOS = {
  environment: {
    title: 'Rest In Paws - Environment Assets',
    desc: 'Environment assets for the video game Rest In Paws, modeled in 3ds Max, textured in Adobe Substance and lit in Unreal Engine.',
    meta: { date: '2024', project: 'Rest In Paws', inspiration: 'Stylized game environments.' },
  },
  idle: {
    title: 'Translating Soul: 2D to 3D',
    desc: 'Idle animation for an elderly cat character, conveying slow and tired movement. Created in 3ds Max and exported to Unreal Engine.',
    meta: { date: '2024', project: 'Rest In Paws', inspiration: 'Character acting and subtle idle motion.' },
  },
  study1: {
    title: 'Rest In Paws - Animation Study',
    desc: 'Movement study for the Rest In Paws character, refining weight and timing.',
    meta: { date: '2024', project: 'Rest In Paws', inspiration: 'Weight and timing in 3D.' },
  },
  study2: {
    title: 'Rest In Paws - Animation Study',
    desc: 'Additional movement study for the Rest In Paws character.',
    meta: { date: '2024', project: 'Rest In Paws', inspiration: 'Subtle secondary motion.' },
  },
}

type ModelVideo = (typeof MODEL_VIDEOS)[keyof typeof MODEL_VIDEOS]

const RANDOM_TEXT_GENERATORS: (() => string)[] = [
  () => `POLY_COUNT: ${(Math.floor(Math.random() * 100000) + 10000).toLocaleString()}`,
  () => `VERTEX_WELD: ${(Math.random() * 0.05).toFixed(3)}`,
  () => `SKIN_MODIFIER: ${Math.floor(Math.random() * 128)} bones`,
  () => `BITMAP: ${[512, 1024, 2048, 4096][Math.floor(Math.random() * 4)]}x${[512, 1024, 2048, 4096][Math.floor(Math.random() * 4)]}`,
  () => `SUBDIVISION: level ${Math.floor(Math.random() * 5)}`,
  () => `CAM_FOV: ${Math.floor(Math.random() * (90 - 18) + 18)}mm`,
  () => `RENDER_TIME: 00:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,
  () => `RETOPOLOGY: ${(Math.floor(Math.random() * 20000) + 2000).toLocaleString()} tris`,
  () => `SPLINE: ${Math.floor(Math.random() * 64)} knots`,
  () => `KEYFRAME: f.${Math.floor(Math.random() * 600)}`,
  () => `CHAMFER: ${(Math.random() * 2.5).toFixed(1)} segs:${Math.floor(Math.random() * 5)}`,
  () => `EXTRUDE: ${(Math.random() * 45).toFixed(1)} units`,
  () => `INSET: ${(Math.random() * 8.5).toFixed(1)}`,
  () => `SCATTER: ${Math.floor(Math.random() * 5000)} objects`,
  () => `MESH_DENSITY: ${(Math.random() * 0.99).toFixed(2)}`,
  () => 'UV_UNWRAP: COMPLETE', () => 'NORMALS: RECALCULATED', () => 'TURBOSMOOTH: ON',
  () => 'RELAX: 0.5 iter:10', () => 'PHYSX: simulating', () => 'SYMMETRY: ON', () => 'PIVOT: centered',
]

function Verts() {
  return (
    <>
      <span className="v v1"></span><span className="v v2"></span>
      <span className="v v3"></span><span className="v v4"></span>
    </>
  )
}

function ModelVideoCard({ video, mini }: { video: ModelVideo; mini?: boolean }) {
  const vidRef = useRef<HTMLVideoElement>(null)
  const open = () => {
    const vid = vidRef.current
    if (!realMedia(vid)) return
    openVideoLightbox(vid!.currentSrc || vid!.getAttribute('src') || '', video.title, video.desc, video.meta)
  }
  return (
    <div className={`model-video-card${mini ? ' small-card' : ''}`}>
      <video ref={vidRef} loop muted playsInline className="obs-video" preload="none"></video>
      <button className={`expand-video-btn${mini ? ' mini' : ''}`} aria-label="Expand video" onClick={open}>
        <i className="fa-solid fa-expand"></i>
      </button>
    </div>
  )
}

// HUD vivo: poly/verts/fps/snap actualizan cada 250ms, solo en viewport
function ViewportHud() {
  const polyRef = useRef<HTMLDivElement>(null)
  const fpsRef = useRef<HTMLDivElement>(null)
  const snapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const elPoly = polyRef.current
    if (!elPoly) return
    const tick = () => {
      const poly = 42500 + Math.floor(Math.random() * 1200)
      elPoly.innerText = `POLY: ${poly.toLocaleString()} | VERTS: ${Math.floor(poly * 0.52).toLocaleString()}`
      const fpsBase = Math.random() > 0.9 ? 58 : 60
      if (fpsRef.current) fpsRef.current.innerText = `FPS: ${(fpsBase + Math.random() * 2.5).toFixed(1)} | RENDER: Scanline`
      if (Math.random() > 0.98 && snapRef.current) {
        snapRef.current.innerText = `SNAP: ON | ANGLE: ${(Math.random() * 90).toFixed(1)}°`
      }
    }
    let timer: number | null = null
    const start = () => { if (!timer) timer = window.setInterval(tick, 250) }
    const stop = () => { if (timer) { clearInterval(timer); timer = null } }
    const target = elPoly.closest('section') || elPoly.parentElement!
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) start()
      else stop()
    }, { threshold: 0 })
    io.observe(target)
    return () => { io.disconnect(); stop() }
  }, [])

  return (
    <>
      {HUD_STATIC.map((m) => (
        <div key={m.id} className={`coord-marker ${m.cls}`} id={m.id}>{m.text}</div>
      ))}
      <div ref={polyRef} className="coord-marker m2" id="hud-poly">POLY: 42,580 | VERTS: 21,340</div>
      <div ref={fpsRef} className="coord-marker m4" id="hud-fps">FPS: 60 | RENDER: Scanline</div>
      <div ref={snapRef} className="coord-marker m6" id="hud-snap">SNAP: ON | ANGLE: 5.0°</div>
    </>
  )
}

// Texto técnico random flotando en el viewport (port de init3DTextGenerator)
function RandomHudText() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const container = ref.current
    if (!container) return
    const lite = perf().lite
    const SPAWN_MS = lite ? 2000 : 800
    const SEED_COUNT = lite ? 6 : 20
    const timers = new Set<number>()

    function spawnText() {
      const gen = RANDOM_TEXT_GENERATORS[Math.floor(Math.random() * RANDOM_TEXT_GENERATORS.length)]
      const span = document.createElement('span')
      span.textContent = gen()
      span.style.left = (Math.random() * 85 + 5) + '%'
      span.style.top = (Math.random() * 80 + 10) + '%'
      span.style.animationDuration = (Math.random() * 6 + 6) + 's'
      span.style.animationDelay = (Math.random() * 4) + 's'
      container!.appendChild(span)

      let updateTimer: number | null = null
      if (!lite) {
        updateTimer = window.setInterval(() => {
          if (Math.random() > 0.6) span.textContent = gen()
        }, 1200)
        timers.add(updateTimer)
      }
      const removeTimer = window.setTimeout(() => {
        if (updateTimer) { clearInterval(updateTimer); timers.delete(updateTimer) }
        span.remove()
        timers.delete(removeTimer)
      }, 13000)
      timers.add(removeTimer)
    }

    let spawnTimer: number | null = null
    let seeded = false
    const start = () => { if (!spawnTimer) spawnTimer = window.setInterval(spawnText, SPAWN_MS) }
    const stop = () => { if (spawnTimer) { clearInterval(spawnTimer); spawnTimer = null } }

    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        if (!seeded) {
          seeded = true
          for (let i = 0; i < SEED_COUNT; i++) {
            const t = window.setTimeout(() => { spawnText(); timers.delete(t) }, i * 350)
            timers.add(t)
          }
        }
        start()
      } else {
        stop()
      }
    }, { threshold: 0 })
    io.observe(container)

    return () => {
      io.disconnect()
      stop()
      timers.forEach((t) => { clearTimeout(t); clearInterval(t) })
      container.innerHTML = ''
    }
  }, [])

  return <div className="random-text-area" id="random3dText" ref={ref}></div>
}

export default function Models3DSection() {
  // Distribución móvil: el 2º video chico pasa al bloque 1 (port de init3dMobileSplit)
  const [mobileSplit, setMobileSplit] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const apply = () => setMobileSplit(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  return (
    <section id="3dmodels" className="models-3d-section">
      <div className="models-3d-bg">
        <div className="viewport-grid"></div>
        <ViewportHud />
        <RandomHudText />

        {CUBES.map((cube) => (
          <div key={cube.cls} className={`cube-container ${cube.cls}`}>
            <div className="cube">
              {CUBE_FACES.map((face) => (
                <div key={face} className={`face ${face}`}>
                  {cube.vertFaces.includes(face) && <Verts />}
                </div>
              ))}
            </div>
          </div>
        ))}

        {CYLINDERS.map((cls) => (
          <div key={cls} className={`cyl-container ${cls}`}>
            <div className="cylinder">
              {Array.from({ length: CYL_PANELS }, (_, i) => <div key={i} className="panel"></div>)}
            </div>
          </div>
        ))}
      </div>

      <div className="section-title" data-scroll="reveal">
        <h2 className="section-typewriter" data-i18n="models_3d_title">3D Models</h2>
        {/* regla-cota: se llena con el avance de la sección (HomeFx scrub) */}
        <span className="title-rule" aria-hidden="true"><span className="title-rule-fill"></span></span>
        <p className="models-intro">Merging artistic vision with technical precision. Environment assets and
          high-poly models for animations and environments.</p>
        <a className="see-all-cta" href="/models-3d"><span>Explore all 3D models</span> <i className="fa-solid fa-arrow-right"></i></a>
      </div>

      <div className="models-container">
        <div className="model-row">
          <div className="model-text">
            <h3 className="typewriter-3d">Rest In Paws - Environment Assets</h3>
            <p>These models are assets for the video game Rest In Paws. They are some of the assets I
              created for this title. They were created with 3ds Max, painted with Adobe Substance, and
              lit using Unreal Engine.</p>
            <div className="software-icons-mini">
              {['3ds Max', 'Substance', 'Unreal'].map((name) => (
                <span key={name} className="soft-icon-wrap">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt={name} title={name} />
                </span>
              ))}
            </div>
          </div>
          <div className="model-visual-wrapper">
            <ModelVideoCard video={MODEL_VIDEOS.environment} />
            {mobileSplit && <ModelVideoCard video={MODEL_VIDEOS.study2} mini />}
          </div>
        </div>

        <div className="model-row reverse">
          <div className="model-visual-grid-wrapper">
            <ModelVideoCard video={MODEL_VIDEOS.idle} />
            <div className="video-sub-grid">
              <ModelVideoCard video={MODEL_VIDEOS.study1} mini />
              {!mobileSplit && <ModelVideoCard video={MODEL_VIDEOS.study2} mini />}
            </div>
          </div>
          <div className="model-text">
            <h3 className="typewriter-3d">Translating Soul: 2D to 3D</h3>
            <p>For the video game Rest In Paws (2024), I helped translate the character design from 2D to
              3D. Beyond design, the challenge was to bring the character to life through its movements.
            </p>
            <p>Our team understood the character as an elderly cat, so conveying its slow and tired
              movements was challenging—we aimed to avoid making the cat appear static. This animation
              depicts a pause from the idle state, triggered when the player doesn&apos;t interact with the
              game for a few seconds; the cat yawns, reflecting its fatigue.</p>
            <p>This animation was entirely created in 3ds Max and then exported to Unreal Engine.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

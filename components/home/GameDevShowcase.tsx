'use client'

/* GAME DEV SHOWCASE — muro de material de juegos en dos cintas.
   Ref. visual: bandas de material que se cruzan (Awwwards / estudios de juego).
   No es una lista de proyectos: son piezas sueltas —capturas, arte, UI,
   sprites, animaciones— mostradas todas juntas, más un proyecto destacado.

   Las cintas se mueven SOLAS y se pueden arrastrar con el mouse o el dedo; el
   auto-scroll se retoma al soltar. Es el mismo mecanismo que la cinta de la
   sección 3D (`GalleryStrip` en ModelsShowcase): dos copias idénticas de las
   celdas y un loop de rAF desplazando el track con `transform`, así el bucle
   es continuo y no hay salto al reciclar.

   Antes esto iba pineado y scrubbeado al scroll. Se sacó: clavar la sección
   corta el scroll de la página de golpe al entrar y al salir, y el largo del
   pin se sumaba a la altura del documento.

   CMS: cada celda es UN contenedor que acepta imagen o animación (REGISTRY
   `gamedev`, kind `media`). El motor no pinta su media —el elemento depende
   del valor— así que la resuelve React desde el store; un video se reproduce
   en loop y solo mientras está en cuadro. Las dos copias comparten
   `data-cms-key`: el motor las trata como un solo contenedor. */

import { useCallback, useEffect, useRef } from 'react'
import { useMotionReady, prefersReducedMotion, type LoopHandle } from '@/hooks/useGSAP'
import SoftwareDropdown from '@/components/home/SoftwareDropdown'
import { openLightbox } from '@/components/ui/lightbox'
import MediaCaption from '@/components/ui/MediaCaption'
import { useUiText } from '@/lib/cms/store'
import { useCmsItems, useCmsText } from '@/lib/cms/content-context'
import { isVideoSrc, mediaSrcSet, optimizedMediaSrc, videoPosterSrc } from '@/lib/utils'
import { sendGAEvent } from '@next/third-parties/google'

/* Composición de las dos cintas. Todas las celdas comparten ALTO: el ratio es
   lo que les da ancho distinto y evita que la banda se lea como una grilla. */
const ROW_A = ['16 / 9', '4 / 3', '1 / 1', '16 / 9', '4 / 3', '16 / 9', '1 / 1', '4 / 3']
const ROW_B = ['4 / 3', '16 / 9', '16 / 9', '1 / 1', '4 / 3', '16 / 9', '4 / 3', '1 / 1']
const ROWS = [ROW_A, ROW_B]

const AUTO_SPEED = 0.04   // px/ms (~40px/s) de desplazamiento automático
const DRAG_THRESHOLD = 5  // px antes de considerar arrastre (deja pasar los clicks)

const TILE_SIZES = '(max-width: 1023px) 60vw, 30vw'
const FEATURE_SIZES = '(max-width: 1023px) 90vw, 32vw'

/* Bloques de texto (3). Contenido por defecto, editable desde el CMS. */
const TEXT_BLOCKS: { title: string; body: string }[] = [
  {
    title: 'Pipeline',
    body: 'Mechanics blocking, level layout, asset integration and playtesting passes, until the core loop reads on its own.',
  },
  {
    title: 'Design',
    body: 'Systems built around a single verb. Readability first — the rule should be understood by playing it.',
  },
  {
    title: 'Production',
    body: 'Unity and Unreal for shipped work, Godot for jams. Builds profiled on the hardware they run on.',
  },
]

/* Enlace a la tienda. El valor lo escribe el admin desde el CMS, así que:
   - solo http(s) — un `javascript:` en un href se ejecuta al hacer click;
   - NUNCA se resuelve contra una base. Hacerlo convertía cualquier texto suelto
     en un enlace al propio sitio (`asdasd` → `http://localhost:3000/asdasd`) y,
     como el servidor no tiene `window.location`, el href salía distinto en
     cada lado: error de hidratación. Sin base el resultado es el mismo en los
     dos, y lo que no sea una URL no pinta botón.
   Se acepta el dominio sin esquema (lo natural de copiar y pegar) solo si
   tiene forma de host — al menos un punto. */
export function storeHref(value: string): string {
  /* Solo el primer token: una URL no puede llevar un espacio en crudo, y al
     pegar en el campo es fácil que entren dos (o la URL con una nota atrás).
     `new URL` no rechaza eso — codifica el espacio como %20 y devuelve un
     enlace que no lleva a ninguna parte. Visto en la base real: el campo tenía
     la misma URL dos veces separadas por un espacio. */
  const raw = (value || '').trim().split(/\s+/)[0] || ''
  if (!raw) return ''
  const candidate = /^https?:\/\//i.test(raw)
    ? raw
    : (/^[\w-]+(\.[\w-]+)+([/?#]|$)/.test(raw) ? `https://${raw}` : '')
  if (!candidate) return ''
  try {
    const u = new URL(candidate)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : ''
  } catch { return '' }
}

/* Media editable: un contenedor, dos tipos posibles. El envoltorio
   `.gd-tile__media` es lo que queda registrado en el motor (no cambia nunca);
   adentro se pinta <img> o <video> según lo que haya cargado el admin.
   `cmsKey` va explícito porque las celdas están duplicadas: sin él el motor
   las indexaría por posición y la copia recibiría claves fantasma. */
function CmsMedia({ cmsKey, sizes, onOpen }: { cmsKey: string; sizes: string; onOpen?: () => void }) {
  const raw = useCmsItems()[cmsKey] || ''
  const isClip = isVideoSrc(raw)
  const videoRef = useRef<HTMLVideoElement>(null)

  /* Loop en cuadro. La red universal de ViewportGate solo PAUSA —nunca
     arranca— así que el play lo decide cada sección. Las dos copias se gatean
     por separado: cada una corre solo mientras se la ve. */
  useEffect(() => {
    const v = videoRef.current
    if (!v || !isClip) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) void v.play().catch(() => {})
        else v.pause()
      },
      { threshold: 0.2 },
    )
    io.observe(v)
    return () => { io.disconnect(); v.pause() }
  }, [isClip])

  return (
    <div className="gd-tile__media" data-cms-key={cmsKey} data-full={raw} onClick={onOpen}>
      {isClip ? (
        <video
          ref={videoRef}
          className="gd-tile__video"
          muted
          loop
          playsInline
          preload="none"
          data-preload-defer=""
          src={optimizedMediaSrc(raw)}
          poster={videoPosterSrc(raw) || undefined}
        />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          className="gd-tile__img"
          src={raw ? optimizedMediaSrc(raw, 1200) : undefined}
          srcSet={raw ? mediaSrcSet(raw) : undefined}
          sizes={raw ? sizes : undefined}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      )}
      {raw && (
        <span className="gd-tile__hud" aria-hidden="true">
          <i className={`fa-solid ${isClip ? 'fa-play' : 'fa-up-right-and-down-left-from-center'}`} />
        </span>
      )}
    </div>
  )
}

function MaterialTile({ index, ratio, clone }: { index: number; ratio: string; clone: boolean }) {
  const items = useCmsItems()
  const text = useCmsText()
  const key = `gamedev#${index}`

  const raw = items[key] || ''
  const isClip = isVideoSrc(raw)
  const title = text(`${key}::title`)
  const project = text(`${key}::project`)
  const date = text(`${key}::date`)
  const desc = text(`${key}::desc`)
  const link = text(`${key}::link`)

  const openFull = useCallback(() => {
    if (!raw || isClip) return // el lightbox del sitio muestra imágenes
    openLightbox(optimizedMediaSrc(raw, 1600), title, desc, storeHref(link))
    sendGAEvent('event', 'fullscreen_open')
  }, [raw, isClip, title, desc, link])

  return (
    <figure
      className={`gd-tile${isClip ? ' gd-tile--clip' : ''}${clone ? ' gd-tile--clone' : ''}`}
      style={{ aspectRatio: ratio }}
      aria-hidden={clone || undefined}
      data-title={title}
      data-project={project}
      data-date={date}
      data-desc={desc}
      data-link={link}
    >
      <CmsMedia cmsKey={key} sizes={TILE_SIZES} onOpen={openFull} />
      {/* La ficha va FUERA de `.gd-tile__media`: ese nodo es el contenedor
          registrado en el motor, y con el contenedor vacío la regla global
          `.cms-empty-slot > *` esconde todo lo que no sea el marco punteado. */}
      <MediaCaption title={title} date={date} project={project} />
    </figure>
  )
}

/* Cinta: dos copias idénticas de las celdas y un loop de rAF que desplaza el
   track con `transform`. El punto de reciclado es el ancho de UNA copia, así
   que el bucle no tiene costura. Se arrastra con mouse o dedo y al soltar
   retoma el automático. */
function MarqueeRow({ ratios, baseIndex, dir }: { ratios: string[]; baseIndex: number; dir: 1 | -1 }) {
  const railRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const offsetRef = useRef(0)
  const halfRef = useRef(0)
  const pointerDownRef = useRef(false)
  const draggingRef = useRef(false)
  const justDraggedRef = useRef(false)
  const startXRef = useRef(0)
  const lastXRef = useRef(0)
  const inViewRef = useRef(false)
  /* El transform lo escribe SOLO el loop de rAF, así que agarrar la cinta
     tiene que garantizar que el loop esté vivo: si quedó aparcado (fuera de
     cuadro, o el navegador dejó de dar frames en una pestaña inactiva), el
     arrastre movería el offset sin que nada lo pinte. */
  const startLoopRef = useRef<() => void>(() => {})

  // Reposiciona el offset dentro de [-half, 0] → bucle infinito sin salto.
  const wrap = useCallback(() => {
    const half = halfRef.current
    if (half <= 0) return
    while (offsetRef.current <= -half) offsetRef.current += half
    while (offsetRef.current > 0) offsetRef.current -= half
  }, [])

  useEffect(() => {
    const track = trackRef.current
    const rail = railRef.current
    if (!track || !rail) return
    const measure = () => { halfRef.current = track.scrollWidth / 2; wrap() }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(track)

    const reduce = prefersReducedMotion()
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = now - last
      last = now
      // Auto salvo mientras se arrastra (al soltar vuelve a arrancar).
      if (!draggingRef.current && !reduce) {
        offsetRef.current -= AUTO_SPEED * dt * dir
        wrap()
      }
      track.style.transform = `translate3d(${offsetRef.current}px, 0, 0)`
      /* Fuera de viewport el loop SE APAGA, no hace early-return: un rAF vivo
         despierta el hilo principal en cada frame aunque no pinte nada. */
      if (!inViewRef.current && !draggingRef.current) { raf = 0; return }
      raf = requestAnimationFrame(tick)
    }
    const start = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick) } }
    startLoopRef.current = start
    const io = new IntersectionObserver(([e]) => {
      inViewRef.current = e.isIntersecting
      if (e.isIntersecting) start()
    })
    io.observe(rail)
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect() }
  }, [wrap, dir])

  const onPointerDown = (e: React.PointerEvent) => {
    pointerDownRef.current = true
    startXRef.current = e.clientX
    lastXRef.current = e.clientX
    startLoopRef.current()
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointerDownRef.current) return
    if (!draggingRef.current) {
      if (Math.abs(e.clientX - startXRef.current) < DRAG_THRESHOLD) return
      draggingRef.current = true
      lastXRef.current = e.clientX
      railRef.current?.classList.add('is-dragging')
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch {}
      return
    }
    const dx = e.clientX - lastXRef.current
    lastXRef.current = e.clientX
    offsetRef.current += dx
    wrap()
  }
  const endDrag = (e: React.PointerEvent) => {
    pointerDownRef.current = false
    if (!draggingRef.current) return
    draggingRef.current = false
    justDraggedRef.current = true   // suprime el click posterior al arrastre
    railRef.current?.classList.remove('is-dragging')
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch {}
  }
  /* Un arrastre no debe abrir el lightbox ni el picker de subida del CMS. */
  const onClickCapture = (e: React.MouseEvent) => {
    if (justDraggedRef.current) {
      e.stopPropagation()
      e.preventDefault()
      justDraggedRef.current = false
    }
  }

  return (
    <div
      className="gd-rail"
      ref={railRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClickCapture={onClickCapture}
    >
      <div className="gd-row" ref={trackRef}>
        {[0, 1].map((copy) =>
          ratios.map((ratio, i) => (
            <MaterialTile
              key={`${copy}-${i}`}
              index={baseIndex + i}
              ratio={ratio}
              clone={copy > 0}
            />
          )),
        )}
      </div>
    </div>
  )
}

/* Proyecto destacado. Mismo contenedor polimórfico que una celda —acepta
   captura o animación— pero acá la ficha SÍ se pinta: es el contenido de la
   tarjeta. */
function FeaturedGame() {
  const text = useCmsText()
  const ui = useUiText()
  const key = 'gamedev.hero#0'

  const title = text(`${key}::title`)
  const desc = text(`${key}::desc`)
  const release = text(`${key}::release`)
  const genre = text(`${key}::genre`)
  const language = text(`${key}::language`)
  const href = storeHref(text(`${key}::link`))

  /* Ficha de tienda, en el orden en que Steam la muestra: género, fecha de
     lanzamiento, idioma. Cada dato es opcional y solo ocupa lugar si está
     cargado: con los tres vacíos la tarjeta queda igual de compacta que antes.

     El género se parte por comas y se pinta como etiquetas sueltas, igual que
     Steam — el admin escribe "Adventure, Casual, Free to Play" de corrido. */
  const genres = genre.split(',').map((g) => g.trim()).filter(Boolean)
  const specs: { label: string; value: string }[] = [
    { label: ui('gd_release', 'Release date'), value: release },
    { label: ui('gd_language', 'Language'), value: language },
  ].filter((sp) => !!sp.value)

  return (
    <article
      className="gd-feature"
      data-title={title}
      data-desc={desc}
      data-release={release}
      data-genre={genre}
      data-language={language}
      data-link={text(`${key}::link`)}
    >
      {/* Cápsula arriba, ficha abajo: la distribución de la barra lateral de
          Steam. El ratio es el de su cápsula de cabecera (460x215), que es
          bastante más apaisada que un 16:9 y por eso no dispara el alto. */}
      <div className="gd-feature__media">
        <CmsMedia cmsKey={key} sizes={FEATURE_SIZES} />
      </div>

      <div className="gd-feature__body">
        <h3 className="gd-feature__title">{title}</h3>
        <p className="gd-feature__desc">{desc}</p>

        {(genres.length > 0 || specs.length > 0) && (
          <dl className="gd-feature__specs">
            {genres.length > 0 && (
              <div className="gd-feature__spec">
                <dt>{ui('gd_genre', 'Genre')}</dt>
                <dd>
                  <span className="gd-feature__genres">
                    {genres.map((g) => (
                      <span key={g} className="gd-feature__genre">{g}</span>
                    ))}
                  </span>
                </dd>
              </div>
            )}
            {specs.map((sp) => (
              <div key={sp.label} className="gd-feature__spec">
                <dt>{sp.label}</dt>
                <dd>{sp.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {href && (
          <a className="gd-feature__link" href={href} target="_blank" rel="noopener noreferrer">
            <i className="fa-brands fa-steam" aria-hidden="true" /> {ui('gd_store', 'Available on Steam')}
          </a>
        )}
      </div>
    </article>
  )
}

export default function GameDevShowcase() {
  const motion = useMotionReady() // GSAP llega en su propio chunk
  const ui = useUiText()
  const text = useCmsText()
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (prefersReducedMotion()) return
    if (!motion) return
    const { gsap, ScrollTrigger, typewriterRevealLoop, wordRevealLoop } = motion
    const sec = sectionRef.current
    if (!sec) return

    let titleTw: LoopHandle | null = null
    let descTw: LoopHandle | null = null

    const ctx = gsap.context(() => {
      gsap.set('.gd-showcase__fig', { autoAlpha: 0, y: 12 })
      gsap.set('.gd-showcase__title', { autoAlpha: 0 })
      gsap.set('.gd-showcase__desc', { autoAlpha: 0, y: 18 })
      gsap.set('.gd-text', { autoAlpha: 0, y: 24 })
      gsap.set('.gd-feature', { autoAlpha: 0, y: 26 })
      gsap.set('.gd-rail', { autoAlpha: 0, y: 30 })

      /* Entrada: mismo reveal que 3D / Illustrations (fig + desc + typewriter).
         Las celdas ya no se revelan de a una: la cinta se mueve sola, y
         escalonar 32 opacidades mientras arranca el rAF se veía sucio. Entra
         el riel entero. */
      const tl = gsap.timeline({ defaults: { ease: 'power4.out' }, paused: true })
      tl.to('.gd-showcase__fig', { autoAlpha: 1, y: 0, duration: 0.4 }, 0)
        .to('.gd-showcase__desc', { autoAlpha: 1, y: 0, duration: 0.7 }, 0.45)
        .to('.gd-feature', { autoAlpha: 1, y: 0, duration: 0.7 }, 0.6)
        .to('.gd-text', { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.12 }, '-=0.4')
        .to('.gd-rail', { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.14, ease: 'power3.out' }, '-=0.4')

      let played = false
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !played) {
            played = true
            tl.play()
            io.disconnect()
            const titleEl = sec.querySelector<HTMLElement>('.gd-showcase__title')
            const descEl = sec.querySelector<HTMLElement>('.gd-showcase__desc')
            if (titleEl) titleTw = typewriterRevealLoop(titleEl, 8)
            if (descEl) descTw = wordRevealLoop(descEl, 8)
          }
        }
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 })
      io.observe(sec)

      ScrollTrigger.refresh()
    }, sectionRef)

    return () => { titleTw?.kill(); descTw?.kill(); ctx.revert() }
  }, [motion])

  return (
    <section ref={sectionRef} className="gd-showcase" id="gamedev" aria-labelledby="gd-showcase-title">
      <div className="gd-showcase__frame">
        <div className="gd-top">
          <div className="gd-showcase__header">
            <span className="gd-showcase__fig">FIG. 05.5 — Play</span>
            <h2 id="gd-showcase-title" className="gd-showcase__title">Game Dev</h2>
            <p className="gd-showcase__desc">
              Material from playable work — screens, interface, sprites and gameplay
              captures, gathered as it comes out of production.
            </p>
            <SoftwareDropdown prefix="gamedev" count={4} />
          </div>

          <FeaturedGame />
        </div>

        <div className="gd-texts">
          {TEXT_BLOCKS.map((b, i) => (
            <article key={i} className="gd-text">
              <h3 className="gd-text__title">{text(`gamedev.title#${i}`, b.title)}</h3>
              <p className="gd-text__body">{text(`gamedev.desc#${i}`, b.body)}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="gd-rows" role="group" aria-label={ui('gd_track_label', 'Game material')}>
        {ROWS.map((ratios, r) => (
          <MarqueeRow key={r} ratios={ratios} baseIndex={r * ROW_A.length} dir={r === 0 ? 1 : -1} />
        ))}
      </div>
    </section>
  )
}

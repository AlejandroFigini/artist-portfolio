'use client'

/* Pantalla de carga del index — portada de script.js initPageLoader().
   Solo se muestra la primera vez en la sesión (sessionStorage), mínimo
   3s, failsafe 6s. El video de galope es un contenedor CMS (src vacío). */

import { useEffect, useRef, useState } from 'react'

const MIN_DISPLAY_MS = 3000
const FAILSAFE_MS = 6000
const FADE_MS = 800

export default function PageLoader() {
  const [gone, setGone] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const loader = ref.current
    if (!loader) return

    let skip = false
    try {
      skip = sessionStorage.getItem('cms_skip_loader') === '1' || sessionStorage.getItem('lm_seen_loader') === '1'
      sessionStorage.removeItem('cms_skip_loader')
      sessionStorage.setItem('lm_seen_loader', '1')
    } catch {}
    if (skip) {
      document.body.classList.remove('loading-active')
      setGone(true)
      return
    }

    // idempotente: cubre la navegación SPA a '/', donde el boot script no corre
    document.body.classList.add('loading-active')

    let hidden = false
    const start = Date.now()
    const timers: number[] = []
    const hide = () => {
      if (hidden) return
      hidden = true
      loader.classList.add('loader-hidden')
      document.body.classList.remove('loading-active')
      timers.push(window.setTimeout(() => setGone(true), FADE_MS))
    }
    const tryHide = () => {
      timers.push(window.setTimeout(hide, Math.max(0, MIN_DISPLAY_MS - (Date.now() - start))))
    }

    if (document.readyState === 'complete') tryHide()
    else window.addEventListener('load', tryHide)
    timers.push(window.setTimeout(hide, FAILSAFE_MS))

    return () => {
      window.removeEventListener('load', tryHide)
      timers.forEach(clearTimeout)
      document.body.classList.remove('loading-active')
    }
  }, [])

  if (gone) return null

  return (
    <>
      {/* body.loading-active lo agrega el boot script del layout (pre-paint) */}
      <div id="page-loader" className="page-loader" ref={ref}>
        <div className="loader-stage">
          <div className="loader-media">
            {/* contenedor CMS: el src lo inyecta el CMS (Sesión 3) */}
            <video className="loader-gallop" autoPlay loop muted playsInline preload="auto"></video>
            <div className="loader-media-glow"></div>
          </div>
          <div className="loader-info">
            <h1 className="loader-title">Lucia Montaña <span>| Portfolio</span></h1>
            <p className="loader-subtitle">Animation &middot; Illustration &middot; 3D Art</p>
            <div className="loader-status">
              <span className="loader-orbit" aria-hidden="true">
                <span className="orbit-ring"></span>
                <span className="orbit-dot"></span>
              </span>
              <span className="loader-text">Loading<span className="loader-dots"><i>.</i><i>.</i><i>.</i></span></span>
            </div>
            <div className="loader-bar"><span className="loader-bar-fill"></span></div>
          </div>
        </div>
      </div>
    </>
  )
}

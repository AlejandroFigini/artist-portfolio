'use client'

/* Canvas nebula/galaxia de la sección Illustrations — portado de
   script.js (initNebulaEngine): estrellas con quantum rebirth, núcleos
   de nebulosa, nubes de gas y meteoros. DPR capeado por tier, render
   solo en viewport, reacciona a perf:downgrade. */

import { useEffect, useRef } from 'react'
import { perf } from '@/lib/perf'

export default function NebulaCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    const section = canvas?.closest<HTMLElement>('.gallery-section')
    if (!canvas || !ctx || !section) return

    let width = 0, height = 0
    let shadowOn = perf().shadowBlur

    class Star {
      x = Math.random() * width
      y = Math.random() * height
      size = Math.random() * 1.8 + 0.5
      baseOpacity = Math.random() * 0.4 + 0.1
      opacity = this.baseOpacity
      twinkleSpeed = Math.random() * 0.008 + 0.003
      twinkleDir = 1
      color = Math.random() > 0.8 ? (Math.random() > 0.5 ? '#a78bfa' : '#bae6fd') : '#ffffff'
      halo = Math.random() > 0.92

      update() {
        this.opacity += this.twinkleSpeed * this.twinkleDir
        if (this.opacity > 1) {
          this.opacity = 1
          this.twinkleDir = -1
        } else if (this.opacity < 0.05) {
          this.opacity = 0.05
          this.twinkleDir = 1
          // Quantum rebirth: renace en otro lugar al apagarse
          this.x = Math.random() * width
          this.y = Math.random() * height
          this.size = Math.random() * 1.8 + 0.5
          this.halo = Math.random() > 0.92
        }
      }
      draw(c: CanvasRenderingContext2D) {
        c.save()
        c.globalAlpha = this.opacity
        c.fillStyle = this.color
        if (this.halo && shadowOn) {
          c.shadowBlur = 15
          c.shadowColor = this.color
        }
        c.beginPath()
        c.arc(this.x, this.y, this.size, 0, Math.PI * 2)
        c.fill()
        if (this.halo && this.opacity > 0.6) {
          c.strokeStyle = this.color
          c.globalAlpha = this.opacity * 0.4
          c.lineWidth = 0.5
          const flareSize = this.size * 4
          c.beginPath()
          c.moveTo(this.x - flareSize, this.y)
          c.lineTo(this.x + flareSize, this.y)
          c.moveTo(this.x, this.y - flareSize)
          c.lineTo(this.x, this.y + flareSize)
          c.stroke()
        }
        c.restore()
      }
    }

    class NebulaCore {
      x = Math.random() * width
      y = Math.random() * height
      size = Math.random() * 800 + 600
      hue = Math.random() * 360
      vx = (Math.random() - 0.5) * 0.15
      vy = (Math.random() - 0.5) * 0.15

      update() {
        this.hue = (this.hue + 0.05) % 360
        this.x += this.vx
        this.y += this.vy
        if (this.x < -this.size || this.x > width + this.size) this.vx *= -1
        if (this.y < -this.size || this.y > height + this.size) this.vy *= -1
      }
      draw(c: CanvasRenderingContext2D) {
        const grad = c.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size)
        grad.addColorStop(0, `hsla(${this.hue}, 80%, 50%, 0.1)`)
        grad.addColorStop(1, 'transparent')
        c.save()
        c.globalAlpha = 0.05
        c.fillStyle = grad
        c.beginPath()
        c.arc(this.x, this.y, this.size, 0, Math.PI * 2)
        c.fill()
        c.restore()
      }
    }

    class GasCloud {
      x = Math.random() * width
      y = Math.random() * height
      size = Math.random() * 350 + 250
      color: string
      opacity = Math.random() * 0.08 + 0.04
      pulse = Math.random() * 0.005
      pulseDir = 1
      vx = (Math.random() - 0.5) * 0.18
      vy = (Math.random() - 0.5) * 0.18

      constructor() {
        const colors = [
          'rgba(124, 58, 237, 0.2)',  // Violeta
          'rgba(34, 211, 238, 0.25)', // Cian
          'rgba(212, 175, 55, 0.15)', // Oro
          'rgba(244, 114, 182, 0.2)', // Magenta
          'rgba(59, 130, 246, 0.15)', // Azul
        ]
        this.color = colors[Math.floor(Math.random() * colors.length)]
      }
      update() {
        this.opacity += this.pulse * this.pulseDir
        if (this.opacity > 0.15 || this.opacity < 0.04) this.pulseDir *= -1
        this.x += this.vx
        this.y += this.vy
        if (this.x < -this.size || this.x > width + this.size) this.vx *= -1
        if (this.y < -this.size || this.y > height + this.size) this.vy *= -1
      }
      draw(c: CanvasRenderingContext2D) {
        const grad = c.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size)
        grad.addColorStop(0, this.color)
        grad.addColorStop(1, 'transparent')
        c.save()
        c.globalAlpha = this.opacity
        c.fillStyle = grad
        c.beginPath()
        c.arc(this.x, this.y, this.size, 0, Math.PI * 2)
        c.fill()
        c.restore()
      }
    }

    class Meteor {
      x = 0; y = 0; len = 0; speed = 0; opacity = 0; active = false; wait = 0
      constructor() { this.reset() }
      reset() {
        this.x = Math.random() * width
        this.y = Math.random() * (height * 0.85)
        this.len = Math.random() * 350 + 200
        this.speed = Math.random() * 5 + 3
        this.opacity = 0
        this.active = false
        this.wait = Math.random() * 900
      }
      update() {
        if (!this.active) {
          this.wait--
          if (this.wait <= 0) this.active = true
          return
        }
        this.x += this.speed
        this.y += this.speed * 0.48
        if (this.x > width + 400 || this.y > height + 400) this.reset()
      }
      draw(c: CanvasRenderingContext2D) {
        if (!this.active) return
        c.save()
        const grad = c.createLinearGradient(this.x, this.y, this.x - this.len, this.y - this.len * 0.48)
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.7)')
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)')
        c.strokeStyle = grad
        c.lineWidth = 1.2
        c.beginPath()
        c.moveTo(this.x, this.y)
        c.lineTo(this.x - this.len, this.y - this.len * 0.48)
        c.stroke()
        c.restore()
      }
    }

    let stars: Star[] = []
    let nebulaCores: NebulaCore[] = []
    let gasClouds: GasCloud[] = []
    let meteors: Meteor[] = []

    function initElements() {
      const scale = perf().particleScale
      const density = Math.floor((width * height) / 6500)
      stars = Array.from({ length: Math.round(Math.max(150, density) * scale) }, () => new Star())
      nebulaCores = Array.from({ length: Math.max(2, Math.round(4 * scale)) }, () => new NebulaCore())
      gasClouds = Array.from({ length: Math.max(3, Math.round(8 * scale)) }, () => new GasCloud())
      meteors = Array.from({ length: Math.max(2, Math.round(5 * scale)) }, () => new Meteor())
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, perf().dprCap)
      width = section!.offsetWidth
      height = section!.offsetHeight
      if (width === 0 || height === 0) return
      canvas!.width = width * dpr
      canvas!.height = height * dpr
      // setTransform resetea la matriz: el DPR no se acumula entre resizes
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      initElements()
    }

    let rafId: number | null = null
    let running = false
    function animate() {
      ctx!.clearRect(0, 0, width, height)
      nebulaCores.forEach((n) => { n.update(); n.draw(ctx!) })
      gasClouds.forEach((g) => { g.update(); g.draw(ctx!) })
      stars.forEach((s) => { s.update(); s.draw(ctx!) })
      meteors.forEach((m) => { m.update(); m.draw(ctx!) })
      rafId = requestAnimationFrame(animate)
    }
    function start() { if (!running) { running = true; animate() } }
    function stop() {
      running = false
      if (rafId) cancelAnimationFrame(rafId)
      rafId = null
    }

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        if (section!.offsetWidth !== width || section!.offsetHeight !== height) resize()
      })
    })
    resizeObserver.observe(section)

    const visObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) start()
      else stop()
    }, { threshold: 0 })
    visObserver.observe(section)

    const onDowngrade = () => { shadowOn = false; resize() }
    window.addEventListener('perf:downgrade', onDowngrade)

    resize()

    return () => {
      stop()
      resizeObserver.disconnect()
      visObserver.disconnect()
      window.removeEventListener('perf:downgrade', onDowngrade)
    }
  }, [])

  return <canvas id="nebula-canvas" ref={ref}></canvas>
}

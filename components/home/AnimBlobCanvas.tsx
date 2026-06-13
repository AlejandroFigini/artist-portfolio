'use client'

/* Canvas de blobs de la sección Animations — portado de script.js
   (initAnimationsBackground): paths morphing con partículas glint.
   Solo renderiza con la sección en viewport; arranque diferido 2.5s
   (staggered init legacy). Respeta prefers-reduced-motion. */

import { useEffect, useRef } from 'react'
import { perf } from '@/lib/perf'

const PATH_COUNT = 3
const COLORS = ['#8b5cf6', '#7c3aed', '#a78bfa', '#4c1d95', '#6d28d9']
const START_DELAY_MS = 2500

export default function AnimBlobCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    const container = canvas?.closest<HTMLElement>('.animations-section')
    if (!canvas || !ctx || !container) return

    let W = 0, H = 0, raf: number | null = null
    type Particle = { pos: number; speed: number; size: number; twinkle: number }
    type Point = { x: number; y: number; phase: number; amp: number }

    class MotionPath {
      points: Point[] = []
      numPoints = 8
      color = COLORS[Math.floor(Math.random() * COLORS.length)]
      offset = Math.random() * 2000
      baseY = Math.random() * H
      particles: Particle[] = Array.from({ length: 4 }, () => ({
        pos: Math.random(), speed: 0.00008 + Math.random() * 0.0002,
        size: 1.5 + Math.random() * 2.5, twinkle: Math.random() * Math.PI * 2,
      }))

      constructor() {
        for (let i = 0; i <= this.numPoints; i++) {
          this.points.push({
            x: -200 + (i / this.numPoints) * (W + 400), y: 0,
            phase: (i / this.numPoints) * Math.PI * 3 + Math.random(),
            amp: Math.random() * 80 + 40,
          })
        }
      }
      update() {
        this.offset += 0.1
        this.points.forEach((p) => { p.y = this.baseY + Math.sin(this.offset * 0.02 + p.phase) * p.amp })
        this.particles.forEach((p) => { p.pos += p.speed; if (p.pos > 1) p.pos = 0; p.twinkle += 0.04 })
      }
      draw(c: CanvasRenderingContext2D) {
        const shadowOn = perf().shadowBlur
        c.shadowBlur = shadowOn ? 12 : 0
        c.shadowColor = this.color
        c.beginPath()
        c.lineWidth = 1.8
        c.strokeStyle = this.color
        c.globalAlpha = 0.25
        c.moveTo(this.points[0].x, this.points[0].y)
        for (let i = 0; i < this.points.length - 1; i++) {
          const xc = (this.points[i].x + this.points[i + 1].x) / 2
          const yc = (this.points[i].y + this.points[i + 1].y) / 2
          c.quadraticCurveTo(this.points[i].x, this.points[i].y, xc, yc)
        }
        c.stroke()
        this.particles.forEach((part) => {
          const index = Math.floor(part.pos * this.numPoints)
          const p1 = this.points[index]
          const p2 = this.points[Math.min(index + 1, this.numPoints)]
          if (!p1 || !p2) return
          const t = (part.pos * this.numPoints) % 1
          const x = p1.x + (p2.x - p1.x) * t
          const y = p1.y + (p2.y - p1.y) * t
          const pulse = (Math.sin(part.twinkle) + 1.2) / 2
          c.save()
          c.translate(x, y)
          c.globalAlpha = 0.4 + pulse * 0.5
          c.fillStyle = c.strokeStyle = this.color
          c.shadowBlur = shadowOn ? 15 : 0
          c.beginPath()
          c.arc(0, 0, part.size * 0.4 * pulse, 0, Math.PI * 2)
          c.fill()
          c.beginPath()
          c.lineWidth = 0.8
          const s1 = part.size * 2.5 * pulse
          c.moveTo(-s1, 0); c.lineTo(s1, 0); c.moveTo(0, -s1); c.lineTo(0, s1)
          c.rotate(Math.PI / 4)
          const s2 = s1 * 0.5
          c.moveTo(-s2, 0); c.lineTo(s2, 0); c.moveTo(0, -s2); c.lineTo(0, s2)
          c.stroke()
          c.restore()
        })
      }
    }

    let paths: MotionPath[] = []
    function resize() {
      W = canvas!.width = container!.offsetWidth
      H = canvas!.height = container!.offsetHeight
      if (paths.length === 0) paths = Array.from({ length: PATH_COUNT }, () => new MotionPath())
    }
    function loop() {
      ctx!.clearRect(0, 0, W, H)
      paths.forEach((p) => { p.update(); p.draw(ctx!) })
      raf = requestAnimationFrame(loop)
    }

    let io: IntersectionObserver | null = null
    const startTimer = setTimeout(() => {
      io = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          if (!raf) loop()
        } else if (raf) {
          cancelAnimationFrame(raf)
          raf = null
        }
      }, { threshold: 0.1 })
      io.observe(container!)
      window.addEventListener('resize', resize)
      resize()
    }, START_DELAY_MS)

    return () => {
      clearTimeout(startTimer)
      io?.disconnect()
      window.removeEventListener('resize', resize)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return <canvas id="animBlobCanvas" className="anim-blob-canvas" ref={ref}></canvas>
}

'use client'

/* UsersChart — serie temporal de usuarios activos.

   El endpoint ya venía calculando `chartDays` (adaptando la granularidad a
   hora / día / mes según el rango elegido) pero nadie la dibujaba: los datos
   viajaban en cada respuesta y se descartaban en el cliente.

   SVG a mano en vez de una librería de charts: son ~40 puntos y una polilínea,
   no justifica sumar una dependencia ni su bundle. Referencia visual: área con
   degradado + retícula punteada, estilo blueprint del sitio (similar a los
   charts de Vercel Analytics). */

import { useEffect, useMemo, useState } from 'react'
import type { ChartDay } from '@/lib/analytics-types'

/* Sistema de coordenadas interno. El SVG escala por viewBox, así que estos
   valores son proporciones, no píxeles en pantalla. */
const W = 1000
const H = 260
const PAD = { top: 16, right: 16, bottom: 34, left: 44 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom

/** Escala "linda" para el eje Y: 1/2/5 × 10^n por encima del máximo real. */
function niceCeil(value: number): number {
  if (value <= 0) return 1
  const exp = Math.floor(Math.log10(value))
  const base = 10 ** exp
  const norm = value / base
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10
  return step * base
}

/** Muestra como máximo `max` etiquetas del eje X, siempre con la primera y la última. */
function pickLabelIndices(total: number, max = 8): Set<number> {
  const out = new Set<number>()
  if (total === 0) return out
  if (total <= max) {
    for (let i = 0; i < total; i++) out.add(i)
    return out
  }
  const stride = (total - 1) / (max - 1)
  for (let i = 0; i < max; i++) out.add(Math.round(i * stride))
  out.add(total - 1)
  return out
}

export default function UsersChart({ data, loading }: { data: ChartDay[]; loading?: boolean }) {
  const [hover, setHover] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  /* Callback ref y no useRef: mientras se cargan los datos el componente
     devuelve el estado vacío, así que en el primer render el <svg> todavía no
     existe. Un useEffect con deps [] observaría null y no volvería a correr
     nunca — el gráfico quedaba dibujado pero invisible. Así el observer se
     engancha en el momento exacto en que el nodo entra al DOM. */
  const [svgNode, setSvgNode] = useState<SVGSVGElement | null>(null)

  /* La entrada se dispara al entrar en viewport: el panel es largo y el
     gráfico suele nacer fuera de pantalla.

     `prefers-reduced-motion` no se consulta acá: lo resuelve el CSS anulando
     las animaciones, así que poner `is-in` es inocuo en ese caso. Consultarlo
     en JS además obligaba a un setState síncrono dentro del efecto. */
  useEffect(() => {
    if (!svgNode) return

    /* Red de seguridad: esto son datos, no decoración, y no pueden quedar
       ocultos si el observer nunca llega a disparar. */
    const failsafe = setTimeout(() => setRevealed(true), 2500)
    if (typeof IntersectionObserver === 'undefined') return () => clearTimeout(failsafe)

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setRevealed(true); observer.disconnect() } },
      { threshold: 0.15 },
    )
    observer.observe(svgNode)

    return () => { observer.disconnect(); clearTimeout(failsafe) }
  }, [svgNode])

  const geometry = useMemo(() => {
    if (!data.length) return null
    const maxVal = niceCeil(Math.max(...data.map((d) => d.val), 1))
    // Un solo punto no tiene ancho: se centra en el plot en vez de dividir por cero.
    const x = (i: number) => data.length === 1 ? PAD.left + PLOT_W / 2 : PAD.left + (i / (data.length - 1)) * PLOT_W
    const y = (v: number) => PAD.top + PLOT_H - (v / maxVal) * PLOT_H

    const points = data.map((d, i) => ({ ...d, cx: x(i), cy: y(d.val) }))
    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(' ')
    const area = `${line} L${points[points.length - 1].cx.toFixed(1)},${PAD.top + PLOT_H} L${points[0].cx.toFixed(1)},${PAD.top + PLOT_H} Z`
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ v: Math.round(maxVal * f), y: y(maxVal * f) }))

    return { points, line, area, ticks, maxVal, labelIdx: pickLabelIndices(data.length) }
  }, [data])

  const total = useMemo(() => data.reduce((s, d) => s + d.val, 0), [data])
  const peak = useMemo(() => data.reduce<ChartDay | null>((m, d) => (!m || d.val > m.val ? d : m), null), [data])

  if (loading && !data.length) {
    return <div className="ga-chart-empty">Cargando serie temporal…</div>
  }
  if (!geometry) {
    return <div className="ga-chart-empty">Sin datos de visitas para este rango.</div>
  }

  const active = hover !== null ? geometry.points[hover] : null

  return (
    <div className="ga-chart">
      <div className="ga-chart-summary">
        <span><strong>{total.toLocaleString('es')}</strong> usuarios en el rango</span>
        {peak && peak.val > 0 && (
          <span className="ga-chart-peak">Pico: <strong>{peak.val.toLocaleString('es')}</strong> en {peak.day}</span>
        )}
      </div>

      <svg
        ref={setSvgNode}
        viewBox={`0 0 ${W} ${H}`}
        /* Escalado uniforme: con preserveAspectRatio="none" los puntos se
           deformarían en elipses al estirarse el contenedor. */
        className="ga-chart-svg"
        role="img"
        aria-label={`Usuarios activos por periodo. Total ${total} usuarios${peak ? `, pico de ${peak.val} en ${peak.day}` : ''}.`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="gaChartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Retícula + eje Y */}
        {geometry.ticks.map((t) => (
          <g key={t.y}>
            <line
              x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y}
              stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" strokeDasharray="4 5"
            />
            <text x={PAD.left - 10} y={t.y + 4} textAnchor="end" className="ga-chart-axis">{t.v}</text>
          </g>
        ))}

        {/* Área + línea. El trazo se dibuja con dash-offset animado. */}
        <path d={geometry.area} fill="url(#gaChartFill)" className={revealed ? 'ga-chart-area is-in' : 'ga-chart-area'} />
        <path
          d={geometry.line}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={revealed ? 'ga-chart-line is-in' : 'ga-chart-line'}
          vectorEffect="non-scaling-stroke"
        />

        {/* Guía vertical del punto activo */}
        {active && (
          <line
            x1={active.cx} y1={PAD.top} x2={active.cx} y2={PAD.top + PLOT_H}
            stroke="var(--accent)" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="3 4"
          />
        )}

        {geometry.points.map((p, i) => (
          <circle
            key={i}
            cx={p.cx}
            cy={p.cy}
            r={hover === i ? 6 : 3.5}
            fill="var(--accent)"
            stroke="#fff"
            strokeWidth="2"
            className={revealed ? 'ga-chart-dot is-in' : 'ga-chart-dot'}
          />
        ))}

        {/* Zonas de hover: una banda por punto, para no depender de acertarle al círculo */}
        {geometry.points.map((p, i) => {
          const half = geometry.points.length === 1 ? PLOT_W / 2 : PLOT_W / (geometry.points.length - 1) / 2
          return (
            <rect
              key={`hit-${i}`}
              x={p.cx - half} y={PAD.top} width={half * 2} height={PLOT_H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          )
        })}

        {/* Eje X */}
        {geometry.points.map((p, i) =>
          geometry.labelIdx.has(i) ? (
            <text key={`lbl-${i}`} x={p.cx} y={H - 10} textAnchor="middle" className="ga-chart-axis">{p.day}</text>
          ) : null,
        )}
      </svg>

      {active && (
        <div className="ga-chart-tip" style={{ left: `${(active.cx / W) * 100}%` }}>
          <strong>{active.val.toLocaleString('es')}</strong> usuarios
          <span>{active.day}</span>
        </div>
      )}
    </div>
  )
}

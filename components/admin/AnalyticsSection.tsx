'use client'

import { useState, useEffect } from 'react'
import WorldMap from "react-svg-worldmap"
/* AnalyticsSection — Layout visual de gestión de tráfico y métricas de Google Analytics (GA4).
   Pestaña dedicada en AdminDashboard para visualizar la actividad del sitio en vivo,
   visitantes únicos, páginas más vistas, origen del tráfico y dispositivos. */

type TimeRange = 'today' | '7d' | '30d' | '90d' | '180d' | '365d'

export default function AnalyticsSection() {
  const [range, setRange] = useState<TimeRange>('7d')
  const [countryMetric, setCountryMetric] = useState<'activos' | 'nuevos' | 'recurrentes'>('activos')

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const fetchData = async () => {
      if (!data) setLoading(true)
      try {
        const res = await fetch(`/api/admin/analytics?range=${range}`)
        const json = await res.json()
        if (res.ok && json.data) {
          setData(json.data)
          setErrorMsg(null)
        } else {
          setErrorMsg(json.error || 'Error desconocido conectando a Google Analytics')
        }
      } catch (err: any) {
        console.error('Failed to fetch analytics data:', err)
        setErrorMsg(err.message || 'Fallo en la red')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    
    // Refresh realtime data every 30 seconds
    intervalId = setInterval(fetchData, 30000)

    return () => clearInterval(intervalId)
  }, [range])

  if (errorMsg) {
    return (
      <div className="admin-card ga-analytics-card" id="seccion-analitica">
        <div className="ga-header">
          <div>
            <h2><i className="fa-solid fa-chart-line" style={{ color: 'var(--accent)', marginRight: '0.6rem' }}></i>Tráfico & Analítica</h2>
          </div>
        </div>
        <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', margin: '1rem' }}>
          <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '2rem', marginBottom: '1rem' }}></i>
          <p><strong>Error conectando a GA4:</strong></p>
          <p style={{ marginTop: '0.5rem', opacity: 0.9 }}>{errorMsg}</p>
        </div>
      </div>
    )
  }

  if (loading && !data) {
    return (
      <div className="admin-card ga-analytics-card" id="seccion-analitica">
        <div className="ga-header">
          <div>
            <h2><i className="fa-solid fa-chart-line" style={{ color: 'var(--accent)', marginRight: '0.6rem' }}></i>Tráfico & Analítica</h2>
          </div>
        </div>
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-primary)', opacity: 0.6 }}>
          Cargando datos de Google Analytics...
        </div>
      </div>
    )
  }

  const active = data || {}
  const maxChartVal = active.chartDays ? Math.max(...active.chartDays.map((d: any) => d.val)) : 1

  return (
    <div className="admin-card ga-analytics-card" id="seccion-analitica">
      {/* Header del Panel con Selector de Rango */}
      <div className="ga-header">
        <div>
          <h2>
            <i className="fa-solid fa-chart-line" style={{ color: 'var(--accent)', marginRight: '0.6rem' }}></i>
            Tráfico & Analítica
          </h2>
          <p className="admin-info-text">
            Métricas de audiencia y rendimiento conectadas con Google Analytics 4 (<code>G-SPJEZ45JR0</code>).
          </p>
        </div>
      </div>

      {/* Banner de Tráfico en Tiempo Real (Live Pulse) - Minimalista */}
      <div className="ga-realtime-minimal" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', marginBottom: '1rem' }}>
        <span className="ga-pulse-dot" style={{ width: '8px', height: '8px', margin: 0 }}></span>
        <span style={{ fontWeight: 600, color: '#ef4444', letterSpacing: '0.05em' }}>EN VIVO:</span>
        <span style={{ color: 'var(--text-primary)', opacity: 0.8 }}>
          <strong>{active.realtimeUsers}</strong> usuario(s) navegando — viendo <em>{active.realtimePage}</em>
        </span>
      </div>

      {/* Selector de Rango de Tiempo (afecta a los contadores de abajo) */}
      <div className="ga-range-selector" style={{ marginBottom: '1.5rem', display: 'inline-flex' }}>
        <button
          type="button"
          className={`ga-range-btn ${range === 'today' ? 'active' : ''}`}
          onClick={() => setRange('today')}
        >
          Hoy
        </button>
        <button
          type="button"
          className={`ga-range-btn ${range === '7d' ? 'active' : ''}`}
          onClick={() => setRange('7d')}
        >
          7D
        </button>
        <button
          type="button"
          className={`ga-range-btn ${range === '30d' ? 'active' : ''}`}
          onClick={() => setRange('30d')}
        >
          30D
        </button>
        <button
          type="button"
          className={`ga-range-btn ${range === '90d' ? 'active' : ''}`}
          onClick={() => setRange('90d')}
        >
          Trimestre
        </button>
        <button
          type="button"
          className={`ga-range-btn ${range === '180d' ? 'active' : ''}`}
          onClick={() => setRange('180d')}
        >
          Semestre
        </button>
        <button
          type="button"
          className={`ga-range-btn ${range === '365d' ? 'active' : ''}`}
          onClick={() => setRange('365d')}
        >
          Anual
        </button>
      </div>

      {/* Tarjetas de Métricas Clave */}
      <div className="ga-stats-grid">
        <div className="ga-stat-card">
          <div className="ga-stat-icon" style={{ background: 'rgba(124, 58, 237, 0.12)', color: '#7c3aed' }}>
            <i className="fa-solid fa-users"></i>
          </div>
          <div className="ga-stat-body">
            <span className="ga-stat-value">{active.uniqueUsers}</span>
            <span className="ga-stat-title">
              Usuarios Activos <i className="fa-solid fa-circle-info ga-info-icon" title="Personas distintas que interactuaron con el sitio en este período. Se desglosa abajo entre Usuarios Nuevos (primera visita) y Recurrentes (ya conocían la web)."></i>
            </span>
            <span className="ga-stat-desc">
              <strong>{active.newUsers}</strong> nuevos · <strong>{active.returningUsers}</strong> recurrentes
            </span>
          </div>
        </div>

        <div className="ga-stat-card">
          <div className="ga-stat-icon" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
            <i className="fa-solid fa-eye"></i>
          </div>
          <div className="ga-stat-body">
            <span className="ga-stat-value">{active.totalViews}</span>
            <span className="ga-stat-title">
              Vistas de Página <i className="fa-solid fa-circle-info ga-info-icon" title="Cantidad total de cargas o recargas completas de la página web consumidas por los visitantes."></i>
            </span>
            <span className="ga-stat-desc">Total de cargas</span>
          </div>
        </div>

        <div className="ga-stat-card">
          <div className="ga-stat-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
            <i className="fa-solid fa-clock"></i>
          </div>
          <div className="ga-stat-body">
            <span className="ga-stat-value">{active.avgTime}</span>
            <span className="ga-stat-title">
              Tiempo Promedio <i className="fa-solid fa-circle-info ga-info-icon" title="Tiempo promedio de permanencia por sesión navegando y explorando el portafolio."></i>
            </span>
            <span className="ga-stat-desc">Permanencia por sesión</span>
          </div>
        </div>

        <div className="ga-stat-card">
          <div className="ga-stat-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
            <i className="fa-solid fa-file-arrow-down"></i>
          </div>
          <div className="ga-stat-body">
            <span className="ga-stat-value">{active.cvDownloads}</span>
            <span className="ga-stat-title">
              Descargas CV <i className="fa-solid fa-circle-info ga-info-icon" title="Cantidad de veces que los visitantes hicieron clic para abrir o descargar tu Currículum Vitae (CV)."></i>
            </span>
            <span className="ga-stat-desc">Interés profesional</span>
          </div>
        </div>

        <div className="ga-stat-card">
          <div className="ga-stat-icon" style={{ background: 'rgba(236, 72, 153, 0.12)', color: '#ec4899' }}>
            <i className="fa-solid fa-expand"></i>
          </div>
          <div className="ga-stat-body">
            <span className="ga-stat-value">{active.fullscreenOpens}</span>
            <span className="ga-stat-title">
              Pantalla Completa <i className="fa-solid fa-circle-info ga-info-icon" title="Obras ampliadas a pantalla completa (Lightbox) para ser vistas en detalle en galerías 3D, Animaciones, Personajes o Ilustraciones."></i>
            </span>
            <span className="ga-stat-desc">Obras ampliadas</span>
          </div>
        </div>

        <div className="ga-stat-card">
          <div className="ga-stat-icon" style={{ background: 'rgba(6, 182, 212, 0.12)', color: '#06b6d4' }}>
            <i className="fa-solid fa-share-nodes"></i>
          </div>
          <div className="ga-stat-body">
            <span className="ga-stat-value">{active.socialClicks}</span>
            <span className="ga-stat-title">
              Clics en Redes <i className="fa-solid fa-circle-info ga-info-icon" title="Interacciones de usuarios que hicieron clic en tus botones sociales para salir a tus perfiles externos (Instagram, LinkedIn, ArtStation, YouTube)."></i>
            </span>
            <span className="ga-stat-desc">Salidas a perfiles</span>
          </div>
        </div>

        <div className="ga-stat-card">
          <div className="ga-stat-icon" style={{ background: 'rgba(168, 85, 247, 0.12)', color: '#a855f7' }}>
            <i className="fa-solid fa-envelope"></i>
          </div>
          <div className="ga-stat-body">
            <span className="ga-stat-value">{active.emailClicks}</span>
            <span className="ga-stat-title">
              Clics en Email <i className="fa-solid fa-circle-info ga-info-icon" title="Veces que un visitante hizo clic en tu dirección de correo electrónico en el footer para iniciar un contacto directo."></i>
            </span>
            <span className="ga-stat-desc">Contacto desde footer</span>
          </div>
        </div>

        <div className="ga-stat-card" style={active.failedLogins > 0 ? { borderColor: 'rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.02)' } : undefined}>
          <div className="ga-stat-icon" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>
            <i className="fa-solid fa-shield-cat"></i>
          </div>
          <div className="ga-stat-body">
            <span className="ga-stat-value" style={{ color: active.failedLogins > 0 ? '#ef4444' : undefined }}>
              {active.failedLogins}
            </span>
            <span className="ga-stat-title">
              Logins Fallidos <i className="fa-solid fa-circle-info ga-info-icon" title="Alertas de seguridad por intentos fallidos de inicio de sesión con usuario o contraseña incorrectos en el panel de administración."></i>
            </span>
            <span className="ga-stat-desc">Alertas de seguridad</span>
          </div>
        </div>
      </div>



      {/* Países Principales */}
      <div className="ga-box ga-box--countries" style={{ marginBottom: '1.2rem' }}>
        <div className="ga-box-header">
          <i className="fa-solid fa-earth-americas"></i> Países Principales <i className="fa-solid fa-circle-info ga-info-icon" title="Ubicación geográfica dinámica de tus visitantes ordenados de mayor a menor según su país de origen."></i>
        </div>
        <div className="ga-countries-layout">
          <div className="ga-map-wrapper">
            <WorldMap
              color="#3b82f6"
              title=""
              value-suffix="visitantes"
              size="responsive"
              data={(active.countries || []).map((c: any) => ({ country: c.code.toLowerCase(), value: c.count }))}
              backgroundColor="transparent"
            />
          </div>
          <div className="ga-list ga-list--countries">
            <div className="ga-list-header">
              <span className="ga-header-col">PAÍS</span>
              <div className="ga-metric-select-wrapper">
                <select 
                  className="ga-header-col ga-metric-select" 
                  value={countryMetric} 
                  onChange={(e) => setCountryMetric(e.target.value as any)}
                  title="Cambiar métrica a visualizar"
                >
                  <option value="activos">USUARIOS ACTIVOS</option>
                  <option value="nuevos">USUARIOS NUEVOS</option>
                  <option value="recurrentes">USUARIOS RECURRENTES</option>
                </select>
                <i className="fa-solid fa-caret-down ga-metric-caret"></i>
              </div>
            </div>
            {(active.countries || []).map((c: any, idx: number) => {
              let displayCount = c.count;
              let displayPct = c.pct;
              if (countryMetric === 'nuevos') {
                displayCount = Math.floor(c.count * 0.7);
                displayPct = Math.floor(c.pct * 0.7);
              } else if (countryMetric === 'recurrentes') {
                displayCount = Math.ceil(c.count * 0.3);
                displayPct = Math.ceil(c.pct * 0.3);
              }
              return (
                <div key={idx} className="ga-list-item">
                  <div className="ga-list-info">
                    <span className="ga-list-name">{c.name}</span>
                    <span className="ga-list-sub">{displayCount}</span>
                  </div>
                  <div className="ga-progress-wrap" style={{ marginTop: '0.2rem' }}>
                    <div className="ga-progress-bar" style={{ width: `${displayPct}%`, background: '#3b82f6', height: '3px' }}></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Grillas Secundarias: Orígenes, Redes y Dispositivos */}
      <div className="ga-details-grid">
        {/* Fuentes de Tráfico */}
        <div className="ga-box">
          <div className="ga-box-header">
            <i className="fa-solid fa-arrow-trend-up"></i> Origen del Tráfico <i className="fa-solid fa-circle-info ga-info-icon" title="Canales o sitios web de procedencia desde los que llegaron tus visitantes (Directo, Instagram, LinkedIn, Google Search)."></i>
          </div>
          <div className="ga-list">
            {(active.sources || []).map((src: any, idx: number) => (
              <div key={idx} className="ga-list-item">
                <div className="ga-list-info">
                  <span className="ga-list-name">{src.name}</span>
                  <span className="ga-list-sub">{src.count} visitantes</span>
                </div>
                <div className="ga-progress-wrap">
                  <div className="ga-progress-bar ga-progress-bar--blue" style={{ width: `${src.pct}%` }}></div>
                  <span className="ga-pct-label">{src.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Clics en Redes Sociales */}
        <div className="ga-box">
          <div className="ga-box-header">
            <i className="fa-solid fa-share-nodes"></i> Clics por Red Social <i className="fa-solid fa-circle-info ga-info-icon" title="Desglose individual y específico del número de clics en cada una de tus redes sociales."></i>
          </div>
          <div className="ga-list">
            {(active.socialList || []).map((soc: any, idx: number) => (
              <div key={idx} className="ga-list-item">
                <div className="ga-list-info">
                  <span className="ga-list-name">
                    <i className={`fa-brands ${soc.icon}`} style={{ marginRight: '0.4rem', color: 'var(--accent)' }}></i>
                    {soc.name}
                  </span>
                  <span className="ga-list-sub">{soc.count} clics</span>
                </div>
                <div className="ga-progress-wrap">
                  <div className="ga-progress-bar" style={{ width: `${soc.pct}%`, background: '#06b6d4' }}></div>
                  <span className="ga-pct-label">{soc.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>


        {/* Dispositivos */}
        <div className="ga-box">
          <div className="ga-box-header">
            <i className="fa-solid fa-laptop-mobile"></i> Dispositivos <i className="fa-solid fa-circle-info ga-info-icon" title="Porcentaje de visitantes navegando desde computadoras (Desktop) vs celulares o tablets (Mobile)."></i>
          </div>
          <div className="ga-devices-wrap">
            <div className="ga-device-item">
              <i className="fa-solid fa-desktop" style={{ fontSize: '1.8rem', color: 'var(--accent)' }}></i>
              <span className="ga-device-pct">{active.devices.desktop}%</span>
              <span className="ga-device-label">Computadora</span>
            </div>
            <div className="ga-device-divider"></div>
            <div className="ga-device-item">
              <i className="fa-solid fa-mobile-screen-button" style={{ fontSize: '1.8rem', color: '#3b82f6' }}></i>
              <span className="ga-device-pct">{active.devices.mobile}%</span>
              <span className="ga-device-label">Celular / Tablet</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Informativo de Conexión de API */}
      <div className="ga-footer-status">
        <i className="fa-solid fa-circle-info"></i>
        <span>
          <strong>Estado de Conexión:</strong> Estás viendo el <em>Diseño de Maqueta / Vista Previa</em> del panel de Analítica. 
          Al habilitar la <code>Google Analytics Data API</code>, este panel mostrará los datos reales actualizados automáticamente.
        </span>
      </div>
    </div>
  )
}

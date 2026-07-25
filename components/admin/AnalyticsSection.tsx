'use client'

import { useState, useEffect } from 'react'
import RealtimeCard from './RealtimeCard'
import WorldMap from "react-svg-worldmap"
import { CmsModal } from '@/components/ui/Modal'
/* AnalyticsSection — Layout visual de gestión de tráfico y métricas de Google Analytics (GA4).
   Pestaña dedicada en AdminDashboard para visualizar la actividad del sitio en vivo,
   visitantes únicos, páginas más vistas, origen del tráfico y dispositivos. */
export default function AnalyticsSection() {
  const [range, setRange] = useState('thisWeek')
  const [pendingRange, setPendingRange] = useState('thisWeek')
  const [countryMetric, setCountryMetric] = useState<'activos' | 'nuevos' | 'recurrentes'>('activos')

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [showFailedLogins, setShowFailedLogins] = useState(false)
  const [failedLoginsList, setFailedLoginsList] = useState<any[]>([])
  const [loadingLogins, setLoadingLogins] = useState(false)

  const handleOpenFailedLogins = async () => {
    setShowFailedLogins(true)
    setLoadingLogins(true)
    try {
      const res = await fetch(`/api/admin/analytics/failed-logins?range=${range}`)
      const json = await res.json()
      if (res.ok && json.data) {
        setFailedLoginsList(json.data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingLogins(false)
    }
  }

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const fetchData = async (isBackgroundPulse = false) => {
      if (!data) setLoading(true)
      if (!isBackgroundPulse) setIsUpdating(true)
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
        setIsUpdating(false)
      }
    }

    fetchData(false)
    
    // Refresh realtime data every 30 seconds (background pulse)
    intervalId = setInterval(() => fetchData(true), 30000)

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

      <RealtimeCard />

      {/* Selector de Rango de Tiempo idéntico a GA4 */}
      <div className="ga-range-selector" style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.8rem', alignItems: 'center', background: 'var(--bg-secondary)', padding: '0.6rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <i className="fa-regular fa-calendar" style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', marginLeft: '0.5rem' }}></i>
        <select
          value={pendingRange}
          onChange={(e) => setPendingRange(e.target.value)}
          className="ga-custom-select"
          style={{ flexGrow: 1, maxWidth: '300px' }}
        >
          <option value="today">Hoy</option>
          <option value="yesterday">Ayer</option>
          <option value="thisWeek">Esta semana (De dom. a hoy)</option>
          <option value="7daysAgo">los últimos 7 días</option>
          <option value="lastWeek">La semana pasada (De dom. a sáb.)</option>
          <option value="28daysAgo">los últimos 28 días</option>
          <option value="30daysAgo">los últimos 30 días</option>
          <option value="thisMonth">Este mes</option>
          <option value="lastMonth">El mes pasado</option>
          <option value="90daysAgo">los últimos 90 días</option>
          <option value="thisQuarter">Trimestre hasta la fecha</option>
          <option value="thisYear">Este año (de enero a hoy)</option>
          <option value="lastYear">Último año natural</option>
        </select>
        <button
          type="button"
          className="ga-custom-btn"
          onClick={() => setRange(pendingRange)}
          disabled={isUpdating || pendingRange === range}
        >
          {isUpdating && pendingRange === range ? (
            <><i className="fa-solid fa-spinner fa-spin"></i> Cargando</>
          ) : (
            <><i className="fa-solid fa-check"></i> Aplicar</>
          )}
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
              Usuarios Activos <span className="cms-info-tip" tabIndex={0} aria-label="Personas distintas que interactuaron con el sitio en este período. Se desglosa abajo entre Usuarios Nuevos (primera visita) y Recurrentes (ya conocían la web)." style={{ marginLeft: '0.4rem' }}>
                <i className="fa-solid fa-circle-info"></i>
                <span className="cms-info-bubble" role="tooltip">Personas distintas que interactuaron con el sitio en este período. Se desglosa abajo entre Usuarios Nuevos (primera visita) y Recurrentes (ya conocían la web).</span>
              </span>
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
              Vistas de Página <span className="cms-info-tip" tabIndex={0} aria-label="Cantidad total de cargas o recargas completas de la página web consumidas por los visitantes." style={{ marginLeft: '0.4rem' }}>
                <i className="fa-solid fa-circle-info"></i>
                <span className="cms-info-bubble" role="tooltip">Cantidad total de cargas o recargas completas de la página web consumidas por los visitantes.</span>
              </span>
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
              Tiempo Promedio <span className="cms-info-tip" tabIndex={0} aria-label="Tiempo promedio de permanencia por sesión navegando y explorando el portafolio." style={{ marginLeft: '0.4rem' }}>
                <i className="fa-solid fa-circle-info"></i>
                <span className="cms-info-bubble" role="tooltip">Tiempo promedio de permanencia por sesión navegando y explorando el portafolio.</span>
              </span>
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
              Descargas CV <span className="cms-info-tip" tabIndex={0} aria-label="Cantidad de veces que los visitantes hicieron clic para abrir o descargar tu Currículum Vitae (CV)." style={{ marginLeft: '0.4rem' }}>
                <i className="fa-solid fa-circle-info"></i>
                <span className="cms-info-bubble" role="tooltip">Cantidad de veces que los visitantes hicieron clic para abrir o descargar tu Currículum Vitae (CV).</span>
              </span>
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
              Pantalla Completa <span className="cms-info-tip" tabIndex={0} aria-label="Obras ampliadas a pantalla completa (Lightbox) para ser vistas en detalle en galerías 3D, Animaciones, Personajes o Ilustraciones." style={{ marginLeft: '0.4rem' }}>
                <i className="fa-solid fa-circle-info"></i>
                <span className="cms-info-bubble" role="tooltip">Obras ampliadas a pantalla completa (Lightbox) para ser vistas en detalle en galerías 3D, Animaciones, Personajes o Ilustraciones.</span>
              </span>
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
              Clics en Redes <span className="cms-info-tip" tabIndex={0} aria-label="Interacciones de usuarios que hicieron clic en tus botones sociales para salir a tus perfiles externos (Instagram, LinkedIn, ArtStation, YouTube)." style={{ marginLeft: '0.4rem' }}>
                <i className="fa-solid fa-circle-info"></i>
                <span className="cms-info-bubble" role="tooltip">Interacciones de usuarios que hicieron clic en tus botones sociales para salir a tus perfiles externos (Instagram, LinkedIn, ArtStation, YouTube).</span>
              </span>
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
              Clics en Email <span className="cms-info-tip" tabIndex={0} aria-label="Veces que un visitante hizo clic en tu dirección de correo electrónico en el footer para iniciar un contacto directo." style={{ marginLeft: '0.4rem' }}>
                <i className="fa-solid fa-circle-info"></i>
                <span className="cms-info-bubble" role="tooltip">Veces que un visitante hizo clic en tu dirección de correo electrónico en el footer para iniciar un contacto directo.</span>
              </span>
            </span>
            <span className="ga-stat-desc">Contacto desde footer</span>
          </div>
        </div>

        <div 
          className="ga-stat-card" 
          style={{
            ...(active.failedLogins > 0 ? { borderColor: 'rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.02)' } : {}),
            cursor: active.failedLogins > 0 ? 'pointer' : 'default'
          }}
          onClick={() => active.failedLogins > 0 && handleOpenFailedLogins()}
        >
          <div className="ga-stat-icon" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>
            <i className="fa-solid fa-shield-cat"></i>
          </div>
          <div className="ga-stat-body">
            <span className="ga-stat-value" style={{ color: active.failedLogins > 0 ? '#ef4444' : undefined }}>
              {active.failedLogins}
            </span>
            <span className="ga-stat-title">
              Logins Fallidos <span className="cms-info-tip" tabIndex={0} aria-label="Alertas de seguridad por intentos fallidos de inicio de sesión con usuario o contraseña incorrectos en el panel de administración." style={{ marginLeft: '0.4rem' }}>
                <i className="fa-solid fa-circle-info"></i>
                <span className="cms-info-bubble" role="tooltip">Alertas de seguridad por intentos fallidos de inicio de sesión con usuario o contraseña incorrectos en el panel de administración.</span>
              </span>
            </span>
            <span className="ga-stat-desc">Alertas de seguridad</span>
          </div>
        </div>
      </div>



      {/* Países Principales */}
      <div className="ga-box ga-box--countries" style={{ marginBottom: '1.2rem' }}>
        <div className="ga-box-header">
          <i className="fa-solid fa-earth-americas"></i> Países Principales <span className="cms-info-tip" tabIndex={0} aria-label="Ubicación geográfica dinámica de tus visitantes ordenados de mayor a menor según su país de origen." style={{ marginLeft: '0.4rem' }}>
                <i className="fa-solid fa-circle-info"></i>
                <span className="cms-info-bubble" role="tooltip">Ubicación geográfica dinámica de tus visitantes ordenados de mayor a menor según su país de origen.</span>
              </span>
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
                displayCount = c.newUsers || 0;
                displayPct = Math.round((displayCount / Math.max(1, active.newUsers)) * 100);
              } else if (countryMetric === 'recurrentes') {
                displayCount = c.returningUsers || 0;
                displayPct = Math.round((displayCount / Math.max(1, active.returningUsers)) * 100);
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
            <i className="fa-solid fa-arrow-trend-up"></i> Origen del Tráfico <span className="cms-info-tip" tabIndex={0} aria-label="Canales o sitios web de procedencia desde los que llegaron tus visitantes (Directo, Instagram, LinkedIn, Google Search)." style={{ marginLeft: '0.4rem' }}>
                <i className="fa-solid fa-circle-info"></i>
                <span className="cms-info-bubble" role="tooltip">Canales o sitios web de procedencia desde los que llegaron tus visitantes (Directo, Instagram, LinkedIn, Google Search).</span>
              </span>
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
            <i className="fa-solid fa-share-nodes"></i> Clics por Red Social <span className="cms-info-tip" tabIndex={0} aria-label="Desglose individual y específico del número de clics en cada una de tus redes sociales." style={{ marginLeft: '0.4rem' }}>
                <i className="fa-solid fa-circle-info"></i>
                <span className="cms-info-bubble" role="tooltip">Desglose individual y específico del número de clics en cada una de tus redes sociales.</span>
              </span>
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
            {(!active.socialList || active.socialList.length === 0) && (
              <div style={{ padding: '1.5rem', textAlign: 'center', opacity: 0.6, fontSize: '0.85rem' }}>
                <i className="fa-solid fa-clock" style={{ fontSize: '1.2rem', marginBottom: '0.5rem', display: 'block' }}></i>
                Aún no hay clics en redes registrados en este período.
              </div>
            )}
          </div>
        </div>


        {/* Dispositivos */}
        <div className="ga-box">
          <div className="ga-box-header">
            <i className="fa-solid fa-laptop-mobile"></i> Dispositivos <span className="cms-info-tip" tabIndex={0} aria-label="Porcentaje de visitantes navegando desde computadoras (Desktop) vs celulares o tablets (Mobile)." style={{ marginLeft: '0.4rem' }}>
                <i className="fa-solid fa-circle-info"></i>
                <span className="cms-info-bubble" role="tooltip">Porcentaje de visitantes navegando desde computadoras (Desktop) vs celulares o tablets (Mobile).</span>
              </span>
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

      {/* Modal de Logins Fallidos */}
      {showFailedLogins && (
        <CmsModal
          title={
            <>
              <i className="fa-solid fa-shield-cat" style={{ color: '#ef4444', marginRight: '0.6rem' }}></i>
              Registro de Intrusiones
            </>
          }
          onClose={() => setShowFailedLogins(false)}
          wide
          actions={[{ label: 'Cerrar', primary: true, onClick: () => {} }]}
        >
          {loadingLogins ? (
            <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.6 }}>Cargando datos...</div>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: '60vh', overflowY: 'auto' }}>
              <table className="cms-table" style={{ minWidth: '600px', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '0.8rem' }}>Fecha</th>
                    <th style={{ textAlign: 'left', padding: '0.8rem' }}>IP</th>
                    <th style={{ textAlign: 'left', padding: '0.8rem' }}>Usuario Intentado</th>
                    <th style={{ textAlign: 'left', padding: '0.8rem' }}>Navegador/Sistema</th>
                  </tr>
                </thead>
                <tbody>
                  {failedLoginsList.map(l => (
                    <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.8rem', whiteSpace: 'nowrap' }}>{new Date(l.created_at).toLocaleString()}</td>
                      <td style={{ padding: '0.8rem', fontFamily: 'monospace' }}>{l.ip_address}</td>
                      <td style={{ padding: '0.8rem', fontWeight: 'bold' }}>{l.username}</td>
                      <td style={{ padding: '0.8rem', fontSize: '0.85rem', opacity: 0.8, maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={l.user_agent}>
                        {(() => {
                          const ua = (l.user_agent || '').toLowerCase();
                          if (ua.includes('edg/')) return 'Edge';
                          if (ua.includes('chrome/')) return 'Chrome';
                          if (ua.includes('safari/') && !ua.includes('chrome/')) return 'Safari';
                          if (ua.includes('firefox/')) return 'Firefox';
                          if (ua.includes('curl') || ua.includes('bot') || ua.includes('postman')) return 'Script / Bot';
                          return l.user_agent.split(' ')[0] || 'Desconocido';
                        })()}
                      </td>
                    </tr>
                  ))}
                  {failedLoginsList.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', opacity: 0.5, padding: '2rem' }}>No hay registros de intrusiones en este periodo.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CmsModal>
      )}
    </div>
  )
}

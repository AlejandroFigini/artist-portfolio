'use client'

import { useState, useEffect, useRef } from 'react'
import RealtimeCard from './RealtimeCard'
import WorldMap from "react-svg-worldmap"
/* El mapa tipa `country` como unión de códigos ISO literales. */
type CountryIsoCode = React.ComponentProps<typeof WorldMap>['data'][number]['country']
import { CmsModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import type { AnalyticsData, CountryMetric, FailedLogin } from '@/lib/analytics-types'
/* AnalyticsSection — Layout visual de gestión de tráfico y métricas de Google Analytics (GA4).
   Pestaña dedicada en AdminDashboard para visualizar la actividad del sitio en vivo,
   visitantes únicos, páginas más vistas, origen del tráfico y dispositivos. */
export default function AnalyticsSection() {
  const [range, setRange] = useState('thisWeek')
  const [pendingRange, setPendingRange] = useState('thisWeek')
  const [countryMetric, setCountryMetric] = useState<CountryMetric>('active')
  const toast = useToast()

  const [sendingReport, setSendingReport] = useState(false)

  const [data, setData] = useState<Partial<AnalyticsData> | null>(null)
  const [loading, setLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [showFailedLogins, setShowFailedLogins] = useState(false)
  const [failedLoginsList, setFailedLoginsList] = useState<FailedLogin[]>([])
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

  const handleSendReport = async () => {
    setSendingReport(true)
    try {
      const res = await fetch('/api/cron/report')
      const json = await res.json()
      if (res.ok) {
        toast('Report sent successfully by email', 'success')
      } else {
        toast(json.error || 'Failed to send the report', 'error')
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Network error while sending the report', 'error')
    } finally {
      setSendingReport(false)
    }
  }

  /* Marca si ya hubo una carga con datos. Antes esto se leía de `data`, que
     obligaba a listarlo como dependencia del efecto — y al depender de `data`
     el efecto se re-ejecutaba con cada respuesta, refetcheando en bucle. Con
     un ref el dato sobrevive entre renders sin disparar el efecto. */
  const hasDataRef = useRef(false)

  useEffect(() => {
    const fetchData = async (isBackgroundPulse = false) => {
      // Pantalla de carga completa solo la primera vez; después basta isUpdating.
      if (!hasDataRef.current) setLoading(true)
      if (!isBackgroundPulse) setIsUpdating(true)
      try {
        const res = await fetch(`/api/admin/analytics?range=${range}`)
        const json = await res.json()
        if (res.ok && json.data) {
          setData(json.data)
          hasDataRef.current = true
          setErrorMsg(null)
        } else {
          setErrorMsg(json.error || 'Unknown error connecting to Google Analytics')
        }
      } catch (err) {
        console.error('Failed to fetch analytics data:', err)
        setErrorMsg(err instanceof Error ? err.message : 'Network error')
      } finally {
        setLoading(false)
        setIsUpdating(false)
      }
    }

    fetchData(false)
    
    // Refresh realtime data every 30 seconds (background pulse)
    const intervalId = setInterval(() => fetchData(true), 30000)

    return () => clearInterval(intervalId)
  }, [range])

  if (errorMsg) {
    return (
      <div className="admin-card ga-analytics-card" id="seccion-analitica">
        <div className="ga-header">
          <div>
            <h2><i className="fa-solid fa-chart-line" style={{ color: 'var(--accent)', marginRight: '0.6rem' }}></i>Traffic &amp; Analytics</h2>
          </div>
        </div>
        <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', margin: '1rem' }}>
          <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '2rem', marginBottom: '1rem' }}></i>
          <p><strong>Error connecting to GA4:</strong></p>
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
            <h2><i className="fa-solid fa-chart-line" style={{ color: 'var(--accent)', marginRight: '0.6rem' }}></i>Traffic &amp; Analytics</h2>
          </div>
        </div>
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-primary)', opacity: 0.6 }}>
          Loading Google Analytics data...
        </div>
      </div>
    )
  }

  const active: Partial<AnalyticsData> = data || {}

  return (
    <div className="admin-card ga-analytics-card" id="seccion-analitica">
      {/* Header del Panel con Selector de Rango */}
      <div className="ga-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>
            <i className="fa-solid fa-chart-line" style={{ color: 'var(--accent)', marginRight: '0.6rem' }}></i>
            Traffic &amp; Analytics
          </h2>
          <p className="admin-info-text">
            Audience and performance metrics connected to Google Analytics 4 (<code>G-SPJEZ45JR0</code>).
          </p>
        </div>
        <button 
          type="button" 
          className="cms-btn cms-btn--primary" 
          onClick={handleSendReport}
          disabled={sendingReport}
        >
          {sendingReport ? (
            <><i className="fa-solid fa-spinner fa-spin"></i> Sending...</>
          ) : (
            <><i className="fa-solid fa-paper-plane"></i> Send Weekly Report</>
          )}
        </button>
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
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="thisWeek">This week (Sun to today)</option>
          <option value="7daysAgo">Last 7 days</option>
          <option value="lastWeek">Last week (Sun to Sat)</option>
          <option value="28daysAgo">Last 28 days</option>
          <option value="30daysAgo">Last 30 days</option>
          <option value="thisMonth">This month</option>
          <option value="lastMonth">Last month</option>
          <option value="90daysAgo">Last 90 days</option>
          <option value="thisQuarter">Quarter to date</option>
          <option value="thisYear">This year (Jan to today)</option>
          <option value="lastYear">Last calendar year</option>
        </select>
        <button
          type="button"
          className="ga-custom-btn"
          onClick={() => setRange(pendingRange)}
          disabled={isUpdating || pendingRange === range}
        >
          {isUpdating && pendingRange === range ? (
            <><i className="fa-solid fa-spinner fa-spin"></i> Loading</>
          ) : (
            <><i className="fa-solid fa-check"></i> Apply</>
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
              Active Users <span className="cms-info-tip" tabIndex={0} aria-label="Distinct people who interacted with the site in this period. Broken down below into New Users (first visit) and Returning (already knew the site)." style={{ marginLeft: '0.4rem' }}>
                <i className="fa-solid fa-circle-info"></i>
                <span className="cms-info-bubble" role="tooltip">Distinct people who interacted with the site in this period. Broken down below into New Users (first visit) and Returning (already knew the site).</span>
              </span>
            </span>
            <span className="ga-stat-desc">
              <strong>{active.newUsers}</strong> new · <strong>{active.returningUsers}</strong> returning
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
              Page Views <span className="cms-info-tip" tabIndex={0} aria-label="Total number of full page loads or reloads consumed by visitors." style={{ marginLeft: '0.4rem' }}>
                <i className="fa-solid fa-circle-info"></i>
                <span className="cms-info-bubble" role="tooltip">Total number of full page loads or reloads consumed by visitors.</span>
              </span>
            </span>
            <span className="ga-stat-desc">Total loads</span>
          </div>
        </div>

        <div className="ga-stat-card">
          <div className="ga-stat-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
            <i className="fa-solid fa-clock"></i>
          </div>
          <div className="ga-stat-body">
            <span className="ga-stat-value">{active.avgTime}</span>
            <span className="ga-stat-title">
              Average Time <span className="cms-info-tip" tabIndex={0} aria-label="Average time spent per session browsing and exploring the portfolio." style={{ marginLeft: '0.4rem' }}>
                <i className="fa-solid fa-circle-info"></i>
                <span className="cms-info-bubble" role="tooltip">Average time spent per session browsing and exploring the portfolio.</span>
              </span>
            </span>
            <span className="ga-stat-desc">Time on site per session</span>
          </div>
        </div>

        <div className="ga-stat-card">
          <div className="ga-stat-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
            <i className="fa-solid fa-file-arrow-down"></i>
          </div>
          <div className="ga-stat-body">
            <span className="ga-stat-value">{active.cvDownloads}</span>
            <span className="ga-stat-title">
              CV Downloads <span className="cms-info-tip" tabIndex={0} aria-label="Number of times visitors clicked to open or download your Curriculum Vitae (CV)." style={{ marginLeft: '0.4rem' }}>
                <i className="fa-solid fa-circle-info"></i>
                <span className="cms-info-bubble" role="tooltip">Number of times visitors clicked to open or download your Curriculum Vitae (CV).</span>
              </span>
            </span>
            <span className="ga-stat-desc">Professional interest</span>
          </div>
        </div>

        <div className="ga-stat-card">
          <div className="ga-stat-icon" style={{ background: 'rgba(236, 72, 153, 0.12)', color: '#ec4899' }}>
            <i className="fa-solid fa-expand"></i>
          </div>
          <div className="ga-stat-body">
            <span className="ga-stat-value">{active.fullscreenOpens}</span>
            <span className="ga-stat-title">
              Fullscreen Views <span className="cms-info-tip" tabIndex={0} aria-label="Works expanded to fullscreen (Lightbox) to be viewed in detail in the 3D, Animations, Characters or Illustrations galleries." style={{ marginLeft: '0.4rem' }}>
                <i className="fa-solid fa-circle-info"></i>
                <span className="cms-info-bubble" role="tooltip">Works expanded to fullscreen (Lightbox) to be viewed in detail in the 3D, Animations, Characters or Illustrations galleries.</span>
              </span>
            </span>
            <span className="ga-stat-desc">Expanded works</span>
          </div>
        </div>

        <div className="ga-stat-card">
          <div className="ga-stat-icon" style={{ background: 'rgba(6, 182, 212, 0.12)', color: '#06b6d4' }}>
            <i className="fa-solid fa-share-nodes"></i>
          </div>
          <div className="ga-stat-body">
            <span className="ga-stat-value">{active.socialClicks}</span>
            <span className="ga-stat-title">
              Social Clicks <span className="cms-info-tip" tabIndex={0} aria-label="Interactions from users who clicked your social buttons to reach your external profiles (Instagram, LinkedIn, ArtStation, YouTube)." style={{ marginLeft: '0.4rem' }}>
                <i className="fa-solid fa-circle-info"></i>
                <span className="cms-info-bubble" role="tooltip">Interactions from users who clicked your social buttons to reach your external profiles (Instagram, LinkedIn, ArtStation, YouTube).</span>
              </span>
            </span>
            <span className="ga-stat-desc">Exits to profiles</span>
          </div>
        </div>

        <div className="ga-stat-card">
          <div className="ga-stat-icon" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>
            <i className="fa-solid fa-envelope-open-text"></i>
          </div>
          <div className="ga-stat-body">
            <span className="ga-stat-value">{active.emailClicks}</span>
            <span className="ga-stat-title">
              Email Links Clicked <span className="cms-info-tip" tabIndex={0} aria-label="Times a visitor clicked an email link anywhere on the site." style={{ marginLeft: '0.4rem' }}>
                <i className="fa-solid fa-circle-info"></i>
                <span className="cms-info-bubble" role="tooltip">Times a visitor clicked an email link anywhere on the site.</span>
              </span>
            </span>
            <span className="ga-stat-desc">Clicks on email links</span>
          </div>
        </div>

        <div className="ga-stat-card">
          <div className="ga-stat-icon" style={{ background: 'rgba(168, 85, 247, 0.12)', color: '#a855f7' }}>
            <i className="fa-solid fa-envelope"></i>
          </div>
          <div className="ga-stat-body">
            <span className="ga-stat-value">{active.contactMessages}</span>
            <span className="ga-stat-title">
              Messages Received <span className="cms-info-tip" tabIndex={0} aria-label="Messages submitted through the contact form." style={{ marginLeft: '0.4rem' }}>
                <i className="fa-solid fa-circle-info"></i>
                <span className="cms-info-bubble" role="tooltip">Messages submitted through the contact form.</span>
              </span>
            </span>
            <span className="ga-stat-desc">From contact form</span>
          </div>
        </div>

        <div 
          className="ga-stat-card" 
          style={{
            ...((active.failedLogins ?? 0) > 0 ? { borderColor: 'rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.02)' } : {}),
            cursor: (active.failedLogins ?? 0) > 0 ? 'pointer' : 'default'
          }}
          onClick={() => (active.failedLogins ?? 0) > 0 && handleOpenFailedLogins()}
        >
          <div className="ga-stat-icon" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>
            <i className="fa-solid fa-shield-cat"></i>
          </div>
          <div className="ga-stat-body">
            <span className="ga-stat-value" style={{ color: (active.failedLogins ?? 0) > 0 ? '#ef4444' : undefined }}>
              {active.failedLogins}
            </span>
            <span className="ga-stat-title">
              Failed Logins <span className="cms-info-tip" tabIndex={0} aria-label="Security alerts for failed sign-in attempts with an incorrect username or password in the admin panel." style={{ marginLeft: '0.4rem' }}>
                <i className="fa-solid fa-circle-info"></i>
                <span className="cms-info-bubble" role="tooltip">Security alerts for failed sign-in attempts with an incorrect username or password in the admin panel.</span>
              </span>
            </span>
            <span className="ga-stat-desc">Security alerts</span>
          </div>
        </div>
      </div>

      {/* Países Principales */}
      <div className="ga-box ga-box--countries" style={{ marginBottom: '1.2rem' }}>
        <div className="ga-box-header">
          <i className="fa-solid fa-earth-americas"></i> Top Countries <span className="cms-info-tip" tabIndex={0} aria-label="Dynamic geographic location of your visitors, ordered from highest to lowest by country of origin." style={{ marginLeft: '0.4rem' }}>
                <i className="fa-solid fa-circle-info"></i>
                <span className="cms-info-bubble" role="tooltip">Dynamic geographic location of your visitors, ordered from highest to lowest by country of origin.</span>
              </span>
        </div>
        <div className="ga-countries-layout">
          <div className="ga-map-wrapper">
            <WorldMap
              color="#3b82f6"
              title=""
              value-suffix="visitors"
              size="responsive"
              /* GA manda 'XX' cuando no puede resolver el país: no es un ISO
                 válido, así que se descarta antes de llegar al mapa. */
              data={(active.countries || [])
                .filter((c) => /^[a-z]{2}$/i.test(c.code) && c.code.toUpperCase() !== 'XX')
                .map((c) => ({ country: c.code.toLowerCase() as CountryIsoCode, value: c.count }))}
              backgroundColor="transparent"
            />
          </div>
          <div className="ga-list ga-list--countries">
            <div className="ga-list-header">
              <span className="ga-header-col">COUNTRY</span>
              <div className="ga-metric-select-wrapper">
                <select 
                  className="ga-header-col ga-metric-select" 
                  value={countryMetric} 
                  onChange={(e) => setCountryMetric(e.target.value as CountryMetric)}
                  title="Change the metric to display"
                >
                  <option value="active">ACTIVE USERS</option>
                  <option value="new">NEW USERS</option>
                  <option value="returning">RETURNING USERS</option>
                </select>
                <i className="fa-solid fa-caret-down ga-metric-caret"></i>
              </div>
            </div>
            {(active.countries || []).map((c, idx) => {
              let displayCount = c.count;
              let displayPct = c.pct;
              if (countryMetric === 'new') {
                displayCount = c.newUsers || 0;
                displayPct = Math.round((displayCount / Math.max(1, active.newUsers ?? 0)) * 100);
              } else if (countryMetric === 'returning') {
                displayCount = c.returningUsers || 0;
                displayPct = Math.round((displayCount / Math.max(1, active.returningUsers ?? 0)) * 100);
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
            <i className="fa-solid fa-arrow-trend-up"></i> Traffic Sources <span className="cms-info-tip" tabIndex={0} aria-label="Channels or referring websites your visitors arrived from (Direct, Instagram, LinkedIn, Google Search)." style={{ marginLeft: '0.4rem' }}>
                <i className="fa-solid fa-circle-info"></i>
                <span className="cms-info-bubble" role="tooltip">Channels or referring websites your visitors arrived from (Direct, Instagram, LinkedIn, Google Search).</span>
              </span>
          </div>
          <div className="ga-list">
            {(active.sources || []).map((src, idx) => (
              <div key={idx} className="ga-list-item">
                <div className="ga-list-info">
                  <span className="ga-list-name">{src.name}</span>
                  <span className="ga-list-sub">{src.count} visitors</span>
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
            <i className="fa-solid fa-share-nodes"></i> Clicks per Social Network <span className="cms-info-tip" tabIndex={0} aria-label="Individual, per-network breakdown of the number of clicks on each of your social links." style={{ marginLeft: '0.4rem' }}>
                <i className="fa-solid fa-circle-info"></i>
                <span className="cms-info-bubble" role="tooltip">Individual, per-network breakdown of the number of clicks on each of your social links.</span>
              </span>
          </div>
          <div className="ga-list">
            {(active.socialList || []).map((soc, idx) => (
              <div key={idx} className="ga-list-item">
                <div className="ga-list-info">
                  <span className="ga-list-name">
                    <i className={`fa-brands ${soc.icon}`} style={{ marginRight: '0.4rem', color: 'var(--accent)' }}></i>
                    {soc.name}
                  </span>
                  <span className="ga-list-sub">{soc.count} clicks</span>
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
                No social clicks recorded in this period yet.
              </div>
            )}
          </div>
        </div>


        {/* Dispositivos */}
        <div className="ga-box">
          <div className="ga-box-header">
            <i className="fa-solid fa-laptop-mobile"></i> Devices <span className="cms-info-tip" tabIndex={0} aria-label="Percentage of visitors browsing from computers (Desktop) vs phones or tablets (Mobile)." style={{ marginLeft: '0.4rem' }}>
                <i className="fa-solid fa-circle-info"></i>
                <span className="cms-info-bubble" role="tooltip">Percentage of visitors browsing from computers (Desktop) vs phones or tablets (Mobile).</span>
              </span>
          </div>
          <div className="ga-devices-wrap">
            <div className="ga-device-item">
              <i className="fa-solid fa-desktop" style={{ fontSize: '1.8rem', color: 'var(--accent)' }}></i>
              <span className="ga-device-pct">{active.devices?.desktop ?? 0}%</span>
              <span className="ga-device-label">Desktop</span>
            </div>
            <div className="ga-device-divider"></div>
            <div className="ga-device-item">
              <i className="fa-solid fa-mobile-screen-button" style={{ fontSize: '1.8rem', color: '#3b82f6' }}></i>
              <span className="ga-device-pct">{active.devices?.mobile ?? 0}%</span>
              <span className="ga-device-label">Phone / Tablet</span>
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
              Intrusion Log
            </>
          }
          onClose={() => setShowFailedLogins(false)}
          wide
          actions={[{ label: 'Close', primary: true, onClick: () => {} }]}
        >
          {loadingLogins ? (
            <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.6 }}>Loading data...</div>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: '60vh', overflowY: 'auto' }} data-lenis-prevent>
              <table className="cms-table" style={{ minWidth: '600px', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '0.8rem' }}>Date</th>
                    <th style={{ textAlign: 'left', padding: '0.8rem' }}>IP</th>
                    <th style={{ textAlign: 'left', padding: '0.8rem' }}>Attempted User</th>
                    <th style={{ textAlign: 'left', padding: '0.8rem' }}>Browser/System</th>
                  </tr>
                </thead>
                <tbody>
                  {failedLoginsList.map(l => (
                    <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.8rem', whiteSpace: 'nowrap' }}>{new Date(l.created_at).toLocaleString()}</td>
                      <td style={{ padding: '0.8rem', fontFamily: 'monospace' }}>{l.ip_address}</td>
                      <td style={{ padding: '0.8rem', fontWeight: 'bold' }}>{l.username}</td>
                      <td style={{ padding: '0.8rem', fontSize: '0.85rem', opacity: 0.8, maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={l.user_agent ?? undefined}>
                        {(() => {
                          const ua = (l.user_agent || '').toLowerCase();
                          if (ua.includes('edg/')) return 'Edge';
                          if (ua.includes('chrome/')) return 'Chrome';
                          if (ua.includes('safari/') && !ua.includes('chrome/')) return 'Safari';
                          if (ua.includes('firefox/')) return 'Firefox';
                          if (ua.includes('curl') || ua.includes('bot') || ua.includes('postman')) return 'Script / Bot';
                          return l.user_agent?.split(' ')[0] || 'Unknown';
                        })()}
                      </td>
                    </tr>
                  ))}
                  {failedLoginsList.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', opacity: 0.5, padding: '2rem' }}>No intrusion records in this period.</td>
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

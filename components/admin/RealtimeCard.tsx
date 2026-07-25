'use client'
import React, { useEffect, useState } from 'react'

export default function RealtimeCard() {
  const [active, setActive] = useState<any>({
    realtimeUsers: 0,
    realtimePages: [],
    realtimeCountries: []
  })

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const fetchRealtime = async () => {
      try {
        const res = await fetch('/api/admin/analytics?realtimeOnly=true')
        const json = await res.json()
        if (res.ok && json.data) {
          setActive({
            realtimeUsers: json.data.realtimeUsers,
            realtimePages: json.data.realtimePages || [],
            realtimeCountries: json.data.realtimeCountries || []
          })
        }
      } catch (err) {
        console.error('Failed to fetch realtime data', err)
      }
    }

    fetchRealtime()
    
    intervalId = setInterval(fetchRealtime, 30000)

    return () => clearInterval(intervalId)
  }, [])

  return (
    <div className="admin-card ga-analytics-card" style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' }}>
      <div className="ga-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.4rem', marginBottom: '0.2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <div className="ga-pulse-wrapper">
            <div className="ga-pulse" style={{ background: 'var(--text-secondary)', boxShadow: '0 0 10px var(--text-secondary)' }}></div>
            <span className="ga-pulse-dot" style={{ background: 'var(--text-primary)' }}></span>
          </div>
          <h2 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center' }}>
            Tráfico en Vivo
            <span className="cms-info-tip" tabIndex={0} aria-label="Se actualiza al instante, pero cada usuario 'vive y muere' en este contador durante una ventana móvil de 30 minutos desde su última acción." style={{ marginLeft: '0.6rem' }}>
              <i className="fa-solid fa-circle-info" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}></i>
              <span className="cms-info-bubble" role="tooltip">Se actualiza al instante, pero cada usuario 'vive y muere' en este contador durante una ventana móvil de 30 minutos desde su última acción.</span>
            </span>
          </h2>
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', alignItems: 'stretch' }}>
        {/* Total */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-primary)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--border-color)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '3.5rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{active.realtimeUsers}</div>
          <div style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.75rem', marginTop: '0.8rem', letterSpacing: '0.05em', fontWeight: 600 }}>Usuarios Activos</div>
        </div>
        
        {/* Por Página */}
        <div style={{ background: 'var(--bg-primary)', borderRadius: '12px', padding: '1.2rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <i className="fa-solid fa-file-lines" style={{ color: 'var(--text-secondary)' }}></i> Por Página
          </h4>
          <div style={{ flexGrow: 1 }}>
            {active.realtimePages?.length > 0 ? active.realtimePages.map((p: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', fontSize: '0.9rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '0.5rem 0.8rem', borderRadius: '6px' }}>
                <span style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.count}</span>
              </div>
            )) : <div style={{ opacity: 0.5, fontSize: '0.85rem', textAlign: 'center', marginTop: '1rem', color: 'var(--text-secondary)' }}>Sin datos de página</div>}
          </div>
        </div>

        {/* Por País */}
        <div style={{ background: 'var(--bg-primary)', borderRadius: '12px', padding: '1.2rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <i className="fa-solid fa-earth-americas" style={{ color: 'var(--text-secondary)' }}></i> Por País
          </h4>
          <div style={{ flexGrow: 1 }}>
            {active.realtimeCountries?.length > 0 ? active.realtimeCountries.map((c: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', fontSize: '0.9rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '0.5rem 0.8rem', borderRadius: '6px' }}>
                <span style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.count}</span>
              </div>
            )) : <div style={{ opacity: 0.5, fontSize: '0.85rem', textAlign: 'center', marginTop: '1rem', color: 'var(--text-secondary)' }}>Sin datos de país</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

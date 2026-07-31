'use client'

/* MessagesSection — bandeja de entrada de mensajes de contacto en el
   panel de administración. Lista mensajes, permite marcar como leído/
   no leído, ver detalle y eliminar. */

import { useCallback, useEffect, useState } from 'react'
import { useModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { fmtDate } from '@/lib/utils'

type Message = {
  id: number
  sender_name: string
  sender_email: string
  country?: string
  subject: string
  message: string
  ip_address: string
  is_read: boolean
  is_starred: boolean
  is_trashed: boolean
  created_at: string
}

type MessagesData = {
  messages: Message[]
  total: number
  unread: number
  counts: {
    inbox: number
    starred: number
    trash: number
  }
  page: number
  limit: number
}

export default function MessagesSection({ onUnreadChange }: { onUnreadChange?: (count: number) => void }) {
  const [data, setData] = useState<MessagesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [activeTab, setActiveTab] = useState<'inbox' | 'starred' | 'trash'>('inbox')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [menuOpen, setMenuOpen] = useState<number | null>(null)
  const [autoDeleteDays, setAutoDeleteDays] = useState('0')
  const { confirm } = useModal()
  const toast = useToast()

  const load = useCallback(async (p = page, tab = activeTab) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' })
      if (tab === 'starred') params.set('starred', 'true')
      if (tab === 'trash') params.set('trashed', 'true')
      const r = await fetch(`/api/messages?${params}`)
      if (r.ok) {
        const d = await r.json()
        setData(d)
        if (onUnreadChange && tab !== 'trash') onUnreadChange(d.unread)
      }
      
      // Load auto-delete setting
      const c = await fetch('/api/content')
      if (c.ok) {
        const cData = await c.json()
        if (cData['messages.trashAutoDeleteDays']) {
          setAutoDeleteDays(cData['messages.trashAutoDeleteDays'])
        }
      }
    } catch {
      toast('Failed to load messages', 'error')
    } finally {
      setLoading(false)
    }
  }, [page, activeTab, onUnreadChange, toast])

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleRead = async (msg: Message) => {
    try {
      const r = await fetch('/api/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: msg.id, is_read: !msg.is_read }),
      })
      if (r.ok) load()
    } catch {
      toast('Failed to update message', 'error')
    }
  }

  const toggleStar = async (msg: Message) => {
    try {
      const r = await fetch('/api/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: msg.id, is_starred: !msg.is_starred }),
      })
      if (r.ok) load()
    } catch {
      toast('Failed to update message', 'error')
    }
  }

  const toggleTrash = async (msg: Message, trash: boolean) => {
    try {
      const r = await fetch('/api/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: msg.id, is_trashed: trash }),
      })
      if (r.ok) load()
    } catch {
      toast('Failed to move message to trash', 'error')
    }
  }

  const deleteMessage = async (msg: Message) => {
    if (activeTab !== 'trash') {
      toggleTrash(msg, true)
      return
    }
    
    confirm(
      'Eliminar mensaje',
      <>¿Eliminar permanentemente el mensaje de <strong>{msg.sender_name}</strong>? Esta acción no se puede deshacer.</>,
      async () => {
        try {
          const r = await fetch('/api/messages', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: msg.id }),
          })
          if (r.ok) {
            toast('Message deleted')
            load()
          }
        } catch {
          toast('Failed to delete message', 'error')
        }
      }
    )
  }

  const markAllRead = async () => {
    if (!data?.messages.length) return
    const unreadIds = data.messages.filter((m) => !m.is_read).map((m) => m.id)
    if (unreadIds.length === 0) return
    try {
      const r = await fetch('/api/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: unreadIds, is_read: true }),
      })
      if (r.ok) {
        toast(`Marked ${unreadIds.length} message(s) as read`)
        load()
      }
    } catch {
      toast('Failed to update messages', 'error')
    }
  }


  const emptyTrash = () => {
    confirm(
      'Vaciar papelera',
      '¿Estás seguro de que quieres eliminar permanentemente todos los mensajes de la papelera? Esta acción no se puede deshacer.',
      async () => {
        try {
          const r = await fetch('/api/messages?empty_trash=true', { method: 'DELETE' })
          if (r.ok) {
            toast('Papelera vaciada')
            load()
          }
        } catch {
          toast('Error al vaciar papelera', 'error')
        }
      }
    )
  }

  const saveAutoDeleteDays = async (days: string) => {
    setAutoDeleteDays(days)
    try {
      await fetch('/api/content/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 'messages.trashAutoDeleteDays': days }),
      })
      toast('Configuración guardada')
    } catch {
      toast('Error al guardar configuración', 'error')
    }
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    load(newPage, activeTab)
  }

  const handleFilterChange = (tab: 'inbox' | 'starred' | 'trash') => {
    setActiveTab(tab)
    setPage(1)
    load(1, tab)
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1

  return (
    <div className="admin-card">
      <style>{`
        .msg-dropdown-btn {
          width: 100%;
          text-align: left;
          padding: 0.8rem 1rem;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 0.85rem;
          color: var(--text-primary);
          display: flex;
          gap: 0.5rem;
          align-items: center;
          transition: background-color 0.2s ease;
        }
        .msg-dropdown-btn:hover {
          background-color: var(--bg-secondary);
        }
        .msg-dropdown-btn.danger {
          color: #ef4444;
          border-top: 1px solid var(--border);
        }
        .trash-select {
          appearance: none;
          background-color: var(--bg-primary);
          color: var(--text-primary);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 0.5rem 2.2rem 0.5rem 1rem;
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          outline: none;
          transition: all 0.2s ease;
          background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23999999%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E");
          background-repeat: no-repeat;
          background-position: right 0.8rem top 50%;
          background-size: 0.65rem auto;
        }
        .trash-select:hover {
          border-color: #888;
        }
        .trash-select:focus {
          border-color: #aaa;
          box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.1);
        }
      `}</style>
      <div className="admin-card-head">
        <h2>
          <i className="fa-solid fa-envelope"></i> Messages
          {data && data.unread > 0 && (
            <span
              style={{
                marginLeft: '0.5rem',
                background: 'var(--accent)',
                color: 'white',
                fontSize: '0.7em',
                padding: '2px 8px',
                borderRadius: 10,
                fontWeight: 700,
                verticalAlign: 'middle',
              }}
            >
              {data.unread} new
            </span>
          )}
        </h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {data && data.unread > 0 && activeTab === 'inbox' && (
            <button type="button" className="cms-btn cms-btn--sm" onClick={markAllRead}>
              <i className="fa-solid fa-check-double"></i> Mark all read
            </button>
          )}
        </div>
      </div>
      <p className="cms-admin-sub">
        {data ? `${data.total} message(s) total ${activeTab === 'inbox' ? `· ${data.unread} unread` : ''}` : 'Loading...'}
      </p>

      {/* Tabs */}
      <div style={{ 
        display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '1rem', marginTop: '1rem' 
      }}>
        <button
          type="button"
          onClick={() => handleFilterChange('inbox')}
          style={{
            background: 'none', border: 'none', padding: '0.8rem 1.5rem', cursor: 'pointer',
            fontSize: '0.95rem', fontWeight: 600, color: activeTab === 'inbox' ? 'var(--accent)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'inbox' ? '3px solid var(--accent)' : '3px solid transparent',
            display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s ease',
          }}
        >
          <i className="fa-solid fa-inbox"></i> Inbox 
          {data && <span style={{ opacity: 0.7, fontSize: '0.9em' }}>({data.counts.inbox})</span>}
        </button>
        <button
          type="button"
          onClick={() => handleFilterChange('starred')}
          style={{
            background: 'none', border: 'none', padding: '0.8rem 1.5rem', cursor: 'pointer',
            fontSize: '0.95rem', fontWeight: 600, color: activeTab === 'starred' ? 'var(--accent)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'starred' ? '3px solid var(--accent)' : '3px solid transparent',
            display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s ease',
          }}
        >
          <i className="fa-solid fa-star"></i> Favoritos
          {data && <span style={{ opacity: 0.7, fontSize: '0.9em' }}>({data.counts.starred})</span>}
        </button>
        <button
          type="button"
          onClick={() => handleFilterChange('trash')}
          style={{
            background: 'none', border: 'none', padding: '0.8rem 1.5rem', cursor: 'pointer',
            fontSize: '0.95rem', fontWeight: 600, color: activeTab === 'trash' ? 'var(--accent)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'trash' ? '3px solid var(--accent)' : '3px solid transparent',
            display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s ease',
          }}
        >
          <i className="fa-solid fa-trash"></i> Basurero
          {data && <span style={{ opacity: 0.7, fontSize: '0.9em' }}>({data.counts.trash})</span>}
        </button>
      </div>

      {activeTab === 'trash' && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Borrado automático:
            </label>
            <select
              value={autoDeleteDays}
              onChange={(e) => saveAutoDeleteDays(e.target.value)}
              className="trash-select"
            >
              <option value="0">Nunca</option>
              <option value="7">Tras 7 días</option>
              <option value="15">Tras 15 días</option>
              <option value="30">Tras 30 días</option>
              <option value="90">Tras 90 días</option>
            </select>
          </div>
          {data && data.counts.trash > 0 && (
            <button type="button" className="cms-btn cms-btn--sm" onClick={emptyTrash} style={{ background: '#ef4444', color: 'white', border: 'none' }}>
              <i className="fa-solid fa-eraser"></i> Vaciar basurero
            </button>
          )}
        </div>
      )}

      {loading && !data && (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-secondary)' }}>
          <i className="fa-solid fa-spinner fa-spin fa-2x"></i>
        </div>
      )}

      {data && data.messages.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-secondary)' }}>
          <i className={`fa-solid ${activeTab === 'trash' ? 'fa-trash' : 'fa-inbox'} fa-2x`} style={{ opacity: 0.4, marginBottom: '0.8rem', display: 'block' }}></i>
          <p>{activeTab === 'starred' ? 'No hay mensajes favoritos.' : activeTab === 'trash' ? 'La papelera está vacía.' : 'No messages yet.'}</p>
        </div>
      )}

      {data && data.messages.length > 0 && (
        <div className="msg-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
          {data.messages.map((msg) => (
            <div
              key={msg.id}
              className="msg-item"
              style={{
                background: msg.is_read ? 'var(--bg-secondary)' : 'rgba(139, 92, 246, 0.06)',
                border: `1px solid ${msg.is_read ? 'var(--border)' : 'rgba(139, 92, 246, 0.2)'}`,
                borderRadius: 10,
                padding: '0.9rem 1rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                position: 'relative',
              }}
              onClick={() => {
                setExpanded(expanded === msg.id ? null : msg.id)
                if (!msg.is_read) toggleRead(msg)
              }}
            >
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                {msg.is_starred && (
                  <i className="fa-solid fa-star" style={{ color: '#fbbf24', fontSize: '0.9rem' }} title="Favorito"></i>
                )}
                {!msg.is_read && (
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: 'var(--accent)', flexShrink: 0,
                  }}></span>
                )}
                <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                  {msg.sender_name}
                </strong>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  &lt;{msg.sender_email}&gt;
                </span>
                {msg.country && (
                  <span style={{ 
                    fontSize: '0.75rem', 
                    background: 'var(--bg-secondary)', 
                    border: '1px solid var(--border)', 
                    padding: '2px 8px', 
                    borderRadius: '12px',
                    color: 'var(--text-secondary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <i className="fa-solid fa-earth-americas"></i> {msg.country}
                  </span>
                )}
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                  {fmtDate(new Date(msg.created_at).getTime())}
                </span>
                
                {/* 3-dots Menu Button */}
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuOpen(menuOpen === msg.id ? null : msg.id)
                    }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem 0.5rem',
                      color: 'var(--text-secondary)', fontSize: '1.1rem',
                    }}
                  >
                    <i className="fa-solid fa-ellipsis-vertical"></i>
                  </button>

                  {/* Dropdown Menu */}
                  {menuOpen === msg.id && (
                    <div
                      style={{
                        position: 'absolute', right: 0, top: '100%', marginTop: '0.5rem',
                        background: 'var(--bg-primary)', border: '1px solid var(--border)',
                        borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        zIndex: 10, minWidth: 180, overflow: 'hidden'
                      }}
                      onMouseLeave={() => setMenuOpen(null)}
                    >
                      {activeTab !== 'trash' ? (
                        <>
                          <button
                            type="button"
                            className="msg-dropdown-btn"
                            onClick={(e) => { e.stopPropagation(); toggleStar(msg); setMenuOpen(null) }}
                          >
                            <i className={`fa-${msg.is_starred ? 'solid' : 'regular'} fa-star`} style={{ color: msg.is_starred ? '#fbbf24' : 'var(--text-secondary)', width: 16 }}></i>
                            {msg.is_starred ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                          </button>
                          <button
                            type="button"
                            className="msg-dropdown-btn danger"
                            onClick={(e) => { e.stopPropagation(); deleteMessage(msg); setMenuOpen(null) }}
                          >
                            <i className="fa-solid fa-trash" style={{ width: 16 }}></i> Eliminar
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="msg-dropdown-btn"
                            onClick={(e) => { e.stopPropagation(); toggleTrash(msg, false); setMenuOpen(null) }}
                          >
                            <i className="fa-solid fa-trash-arrow-up" style={{ width: 16 }}></i> Restaurar
                          </button>
                          <button
                            type="button"
                            className="msg-dropdown-btn danger"
                            onClick={(e) => { e.stopPropagation(); deleteMessage(msg); setMenuOpen(null) }}
                          >
                            <i className="fa-solid fa-eraser" style={{ width: 16 }}></i> Eliminar definitivamente
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Subject */}
              {msg.subject && (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500, marginTop: '0.3rem' }}>
                  {msg.subject}
                </div>
              )}

              {/* Preview or full message */}
              {expanded === msg.id ? (
                <div style={{ marginTop: '0.7rem' }}>
                  <div style={{
                    whiteSpace: 'pre-wrap',
                    fontSize: '0.88rem',
                    lineHeight: 1.6,
                    color: 'var(--text-primary)',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '0.8rem 1rem',
                  }}>
                    {msg.message}
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.7rem', flexWrap: 'wrap' }}>
                    <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-secondary)', alignSelf: 'center' }}>
                      IP: {msg.ip_address}
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                  marginTop: '0.25rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                }}>
                  {msg.message.slice(0, 120)}{msg.message.length > 120 ? '...' : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.2rem', alignItems: 'center' }}>
          <button
            type="button"
            className="cms-btn cms-btn--sm"
            disabled={page <= 1}
            onClick={() => handlePageChange(page - 1)}
          >
            <i className="fa-solid fa-chevron-left"></i>
          </button>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className="cms-btn cms-btn--sm"
            disabled={page >= totalPages}
            onClick={() => handlePageChange(page + 1)}
          >
            <i className="fa-solid fa-chevron-right"></i>
          </button>
        </div>
      )}
    </div>
  )
}

/* Hook para obtener el conteo de mensajes no leídos (para el badge del sidebar). */
export function useUnreadCount(): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    fetch('/api/messages?limit=1')
      .then((r) => r.json())
      .then((d) => setCount(d.unread || 0))
      .catch(() => {})
  }, [])
  return count
}

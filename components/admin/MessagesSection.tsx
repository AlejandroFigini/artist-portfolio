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
  subject: string
  message: string
  ip_address: string
  is_read: boolean
  created_at: string
}

type MessagesData = {
  messages: Message[]
  total: number
  unread: number
  page: number
  limit: number
}

export default function MessagesSection() {
  const [data, setData] = useState<MessagesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [showUnread, setShowUnread] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)
  const { confirm } = useModal()
  const toast = useToast()

  const load = useCallback(async (p = page, unread = showUnread) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' })
      if (unread) params.set('unread', 'true')
      const r = await fetch(`/api/messages?${params}`)
      if (r.ok) setData(await r.json())
    } catch {
      toast('Failed to load messages', 'error')
    } finally {
      setLoading(false)
    }
  }, [page, showUnread, toast])

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleRead = async (msg: Message) => {
    try {
      const r = await fetch('/api/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: msg.id, is_read: !msg.is_read }),
      })
      if (r.ok) {
        toast(msg.is_read ? 'Marked as unread' : 'Marked as read')
        load()
      }
    } catch {
      toast('Failed to update message', 'error')
    }
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

  const deleteMessage = (msg: Message) => {
    confirm(
      'Delete message',
      <>Delete the message from <strong>{msg.sender_name}</strong>? This cannot be undone.</>,
      async () => {
        try {
          const r = await fetch('/api/messages', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: msg.id }),
          })
          if (r.ok) {
            toast('Message deleted')
            if (expanded === msg.id) setExpanded(null)
            load()
          }
        } catch {
          toast('Failed to delete message', 'error')
        }
      },
    )
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    load(newPage, showUnread)
  }

  const handleFilterChange = (unread: boolean) => {
    setShowUnread(unread)
    setPage(1)
    load(1, unread)
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1

  return (
    <div className="admin-card">
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
          <button
            type="button"
            className={`cms-btn cms-btn--sm${showUnread ? ' cms-btn--primary' : ''}`}
            onClick={() => handleFilterChange(!showUnread)}
          >
            {showUnread ? 'Show all' : 'Unread only'}
          </button>
          {data && data.unread > 0 && (
            <button type="button" className="cms-btn cms-btn--sm" onClick={markAllRead}>
              <i className="fa-solid fa-check-double"></i> Mark all read
            </button>
          )}
        </div>
      </div>
      <p className="cms-admin-sub">
        {data ? `${data.total} message(s) total · ${data.unread} unread` : 'Loading...'}
      </p>

      {loading && !data && (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-secondary)' }}>
          <i className="fa-solid fa-spinner fa-spin fa-2x"></i>
        </div>
      )}

      {data && data.messages.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-secondary)' }}>
          <i className="fa-solid fa-inbox fa-2x" style={{ opacity: 0.4, marginBottom: '0.8rem', display: 'block' }}></i>
          <p>{showUnread ? 'No unread messages.' : 'No messages yet.'}</p>
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
              }}
              onClick={() => {
                setExpanded(expanded === msg.id ? null : msg.id)
                if (!msg.is_read) toggleRead(msg)
              }}
            >
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
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
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                  {fmtDate(new Date(msg.created_at).getTime())}
                </span>
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
                    <a
                      href={`mailto:${msg.sender_email}?subject=Re: ${encodeURIComponent(msg.subject || 'Your message')}`}
                      className="cms-btn cms-btn--sm cms-btn--primary"
                      style={{ textDecoration: 'none', fontSize: '0.78rem' }}
                    >
                      <i className="fa-solid fa-reply"></i> Reply
                    </a>
                    <button
                      type="button"
                      className="cms-btn cms-btn--sm"
                      style={{ fontSize: '0.78rem' }}
                      onClick={(e) => { e.stopPropagation(); toggleRead(msg) }}
                    >
                      <i className={`fa-solid ${msg.is_read ? 'fa-envelope' : 'fa-envelope-open'}`}></i>
                      {msg.is_read ? ' Mark unread' : ' Mark read'}
                    </button>
                    <button
                      type="button"
                      className="cms-btn cms-btn--sm"
                      style={{ fontSize: '0.78rem', color: '#ef4444' }}
                      onClick={(e) => { e.stopPropagation(); deleteMessage(msg) }}
                    >
                      <i className="fa-solid fa-trash"></i> Delete
                    </button>
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

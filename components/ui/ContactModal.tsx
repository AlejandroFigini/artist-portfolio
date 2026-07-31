'use client'

/* ContactModal — formulario de contacto público que se abre al hacer clic
   en "Email" del dropdown Portfolio en el Nav. Usa <CmsModal> como base
   visual para mantener consistencia. Envía via POST /api/contact. */

import { useCallback, useEffect, useRef, useState } from 'react'
import { CmsModal } from '@/components/ui/Modal'
import '@/styles/contact-modal.css'

type Status = 'idle' | 'sending' | 'success' | 'error'

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''

export default function ContactModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const turnstileRef = useRef<HTMLDivElement>(null)
  const turnstileWidgetId = useRef<string | null>(null)
  const [charCount, setCharCount] = useState(0)

  // Load Turnstile script + render widget
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return

    const renderWidget = () => {
      if (turnstileRef.current && (window as any).turnstile && !turnstileWidgetId.current) {
        turnstileWidgetId.current = (window as any).turnstile.render(turnstileRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token: string) => setTurnstileToken(token),
          'expired-callback': () => setTurnstileToken(''),
          theme: 'auto',
          size: 'flexible',
        })
      }
    }

    if ((window as any).turnstile) {
      renderWidget()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.onload = renderWidget
    document.head.appendChild(script)

    return () => {
      if (turnstileWidgetId.current && (window as any).turnstile) {
        try { (window as any).turnstile.remove(turnstileWidgetId.current) } catch {}
        turnstileWidgetId.current = null
      }
    }
  }, [])

  const canSend = name.trim() && email.trim() && message.trim() && status !== 'sending'

  const handleSubmit = useCallback(async () => {
    if (!canSend) return

    setStatus('sending')
    setErrorMsg('')

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject: subject.trim(),
          message: message.trim(),
          turnstileToken,
        }),
      })
      const data = await res.json()

      if (res.ok && data.success) {
        setStatus('success')
      } else {
        setStatus('error')
        setErrorMsg(data.error || 'Something went wrong. Please try again.')
      }
    } catch {
      setStatus('error')
      setErrorMsg('Network error. Please check your connection.')
    }
  }, [canSend, name, email, subject, message, turnstileToken])

  const handleMessageChange = (val: string) => {
    if (val.length <= 5000) {
      setMessage(val)
      setCharCount(val.length)
    }
  }

  // Success state
  if (status === 'success') {
    return (
      <CmsModal
        title={<><i className="fa-solid fa-envelope-circle-check" style={{ color: '#10b981', marginRight: 8 }}></i> Message sent</>}
        onClose={onClose}
        className="contact-modal"
      >
        <div className="contact-success">
          <div className="contact-success-icon">
            <i className="fa-solid fa-check"></i>
          </div>
          <p className="contact-success-text">
            Thank you, <strong>{name}</strong>! Your message has been sent successfully.
          </p>
          <p className="contact-success-sub">
            I&apos;ll get back to you as soon as possible.
          </p>
          <button
            type="button"
            className="cms-btn cms-btn--primary contact-close-btn"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </CmsModal>
    )
  }

  return (
    <CmsModal
      title={<><i className="fa-solid fa-paper-plane" style={{ color: 'var(--accent)', marginRight: 8 }}></i> Contact me</>}
      onClose={onClose}
      className="contact-modal"
    >
      <form
        className="contact-form"
        onSubmit={(e) => { e.preventDefault(); handleSubmit() }}
        noValidate
      >
        <p className="contact-form-intro">
          Have a question or want to work together? Fill out the form below and I&apos;ll get back to you.
        </p>

        {/* Name */}
        <div className="contact-field">
          <label htmlFor="contact-name" className="contact-label">
            <i className="fa-solid fa-user"></i> Name <span className="contact-required">*</span>
          </label>
          <input
            id="contact-name"
            type="text"
            className="contact-input"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            autoFocus
            required
          />
        </div>

        {/* Email */}
        <div className="contact-field">
          <label htmlFor="contact-email" className="contact-label">
            <i className="fa-solid fa-envelope"></i> Email <span className="contact-required">*</span>
          </label>
          <input
            id="contact-email"
            type="email"
            className="contact-input"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={255}
            required
          />
        </div>

        {/* Subject */}
        <div className="contact-field">
          <label htmlFor="contact-subject" className="contact-label">
            <i className="fa-solid fa-tag"></i> Subject <span className="contact-optional">(optional)</span>
          </label>
          <input
            id="contact-subject"
            type="text"
            className="contact-input"
            placeholder="What is this about?"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={255}
          />
        </div>

        {/* Message */}
        <div className="contact-field">
          <label htmlFor="contact-message" className="contact-label">
            <i className="fa-solid fa-message"></i> Message <span className="contact-required">*</span>
          </label>
          <textarea
            id="contact-message"
            className="contact-input contact-textarea"
            placeholder="Write your message here..."
            value={message}
            onChange={(e) => handleMessageChange(e.target.value)}
            rows={5}
            required
          />
          <span className="contact-charcount">{charCount}/5000</span>
        </div>

        {/* Turnstile */}
        {TURNSTILE_SITE_KEY && (
          <div className="contact-turnstile" ref={turnstileRef}></div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="contact-error">
            <i className="fa-solid fa-circle-exclamation"></i> {errorMsg}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          className="cms-btn cms-btn--primary contact-submit"
          disabled={!canSend}
        >
          {status === 'sending' ? (
            <><i className="fa-solid fa-spinner fa-spin"></i> Sending...</>
          ) : (
            <><i className="fa-solid fa-paper-plane"></i> Send message</>
          )}
        </button>
      </form>
    </CmsModal>
  )
}

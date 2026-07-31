'use client'

/* ContactModal — formulario de contacto público que se abre al hacer clic
   en "Email" del dropdown Portfolio en el Nav. Usa <CmsModal> como base
   visual para mantener consistencia. Envía via POST /api/contact. */

import { useCallback, useEffect, useRef, useState } from 'react'
import { CmsModal } from '@/components/ui/Modal'
import { gsap } from '@/hooks/useGSAP'
import '@/styles/contact-modal.css'

type Status = 'idle' | 'sending' | 'success' | 'error'

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'

export default function ContactModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileStatus, setTurnstileStatus] = useState<'loading' | 'success'>('loading')
  const turnstileRef = useRef<HTMLDivElement>(null)
  const turnstileWidgetId = useRef<string | null>(null)
  const [charCount, setCharCount] = useState(0)

  // Pause background animations, GSAP timelines, and videos when contact modal is open
  useEffect(() => {
    document.body.classList.add('contact-modal-open')
    const pausedVideos: HTMLVideoElement[] = []
    document.querySelectorAll<HTMLVideoElement>('video').forEach((v) => {
      if (!v.paused) {
        v.pause()
        pausedVideos.push(v)
      }
    })

    try { gsap.globalTimeline.pause() } catch {}
    window.dispatchEvent(new CustomEvent('modal:open'))

    return () => {
      document.body.classList.remove('contact-modal-open')
      pausedVideos.forEach((v) => {
        try { v.play() } catch {}
      })
      try { gsap.globalTimeline.play() } catch {}
      window.dispatchEvent(new CustomEvent('modal:close'))
    }
  }, [])

  // Load Turnstile script + render widget
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return

    const renderWidget = () => {
      if (turnstileRef.current && (window as any).turnstile && !turnstileWidgetId.current) {
        turnstileWidgetId.current = (window as any).turnstile.render(turnstileRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token: string) => {
            setTurnstileToken(token)
            setTurnstileStatus('success')
          },
          'expired-callback': () => {
            setTurnstileToken('')
            setTurnstileStatus('loading')
            if (turnstileWidgetId.current) {
              (window as any).turnstile.reset(turnstileWidgetId.current)
            }
          },
          theme: 'auto',
          size: 'invisible',
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

  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; subject?: string; message?: string }>({})

  const validateField = useCallback((field: 'name' | 'email' | 'subject' | 'message', val: string) => {
    let err: string | undefined = undefined
    const trimmed = val.trim()
    if (field === 'name') {
      if (!trimmed) err = 'Name is required'
      else if (trimmed.length > 100) err = 'Max 100 characters'
    } else if (field === 'email') {
      if (!trimmed) err = 'Email is required'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) err = 'Invalid email address'
      else if (trimmed.length > 255) err = 'Max 255 characters'
    } else if (field === 'subject') {
      if (trimmed.length > 255) err = 'Max 255 characters'
    } else if (field === 'message') {
      if (!trimmed) err = 'Message is required'
      else if (trimmed.length > 5000) err = 'Max 5000 characters'
    }
    setFieldErrors((prev) => ({ ...prev, [field]: err }))
    return !err
  }, [])

  const validateAll = useCallback(() => {
    const nOk = validateField('name', name)
    const eOk = validateField('email', email)
    const sOk = validateField('subject', subject)
    const mOk = validateField('message', message)
    return nOk && eOk && sOk && mOk
  }, [name, email, subject, message, validateField])

  const canSend = status !== 'sending'

  const handleSubmit = useCallback(async () => {
    if (!validateAll()) return

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
        if (data.field && ['name', 'email', 'subject', 'message'].includes(data.field)) {
          setFieldErrors((prev) => ({ ...prev, [data.field]: data.error }))
        } else {
          setErrorMsg(data.error || 'Something went wrong. Please try again.')
        }
      }
    } catch {
      setStatus('error')
      setErrorMsg('Network error. Please check your connection.')
    }
  }, [name, email, subject, message, turnstileToken, validateAll])

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
        title={<></>} // Oculto vía CSS para estado success
        onClose={onClose}
        className="contact-modal contact-modal--success"
        overlayClassName="contact-modal-overlay-custom"
      >
        <div className="contact-success-minimal">
          <div className="contact-success-icon-minimal">
            <i className="fa-regular fa-paper-plane"></i>
          </div>
          <p className="contact-success-title">Message sent</p>
          <p className="contact-success-subtitle">
            Thank you{name ? `, ${name}` : ''}. I'll get back to you shortly.
          </p>
          <button
            type="button"
            className="contact-success-btn-minimal"
            onClick={onClose}
          >
            Okay
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
      overlayClassName="contact-modal-overlay-custom"
    >
      <form
        className="contact-form"
        onSubmit={(e) => { e.preventDefault(); handleSubmit() }}
        noValidate
      >
        <p className="contact-form-intro">
          For professional inquiries or collaborations, please leave a message below.
        </p>

        {/* Name */}
        <div className="contact-field">
          <div className="contact-label-row">
            <label htmlFor="contact-name" className="contact-label">
              <i className="fa-solid fa-user"></i> Name <span className="contact-required">*</span>
            </label>
            {fieldErrors.name && (
              <span className="contact-field-error" role="alert">
                <i className="fa-solid fa-circle-exclamation"></i> {fieldErrors.name}
              </span>
            )}
          </div>
          <input
            id="contact-name"
            type="text"
            className="contact-input"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }))
            }}
            onBlur={() => validateField('name', name)}
            maxLength={100}
            autoFocus
            required
          />
        </div>

        {/* Email */}
        <div className="contact-field">
          <div className="contact-label-row">
            <label htmlFor="contact-email" className="contact-label">
              <i className="fa-solid fa-envelope"></i> Email <span className="contact-required">*</span>
            </label>
            {fieldErrors.email && (
              <span className="contact-field-error" role="alert">
                <i className="fa-solid fa-circle-exclamation"></i> {fieldErrors.email}
              </span>
            )}
          </div>
          <input
            id="contact-email"
            type="email"
            className="contact-input"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }))
            }}
            onBlur={() => validateField('email', email)}
            maxLength={255}
            required
          />
        </div>

        {/* Subject */}
        <div className="contact-field">
          <div className="contact-label-row">
            <label htmlFor="contact-subject" className="contact-label">
              <i className="fa-solid fa-tag"></i> Subject <span className="contact-optional">(optional)</span>
            </label>
            {fieldErrors.subject && (
              <span className="contact-field-error" role="alert">
                <i className="fa-solid fa-circle-exclamation"></i> {fieldErrors.subject}
              </span>
            )}
          </div>
          <input
            id="contact-subject"
            type="text"
            className="contact-input"
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value)
              if (fieldErrors.subject) setFieldErrors((prev) => ({ ...prev, subject: undefined }))
            }}
            onBlur={() => validateField('subject', subject)}
            maxLength={255}
          />
        </div>

        {/* Message */}
        <div className="contact-field">
          <div className="contact-label-row">
            <label htmlFor="contact-message" className="contact-label">
              <i className="fa-solid fa-message"></i> Message <span className="contact-required">*</span>
            </label>
            {fieldErrors.message && (
              <span className="contact-field-error" role="alert">
                <i className="fa-solid fa-circle-exclamation"></i> {fieldErrors.message}
              </span>
            )}
          </div>
          <textarea
            id="contact-message"
            className="contact-input contact-textarea"
            value={message}
            onChange={(e) => {
              handleMessageChange(e.target.value)
              if (fieldErrors.message) setFieldErrors((prev) => ({ ...prev, message: undefined }))
            }}
            onBlur={() => validateField('message', message)}
            rows={5}
            required
          />
          <span className="contact-charcount">{charCount}/5000</span>
        </div>

        {/* Turnstile (Invisible) */}
        {TURNSTILE_SITE_KEY && (
          <div className={`contact-turnstile-disclaimer ${turnstileStatus}`}>
            <div ref={turnstileRef}></div>
            {turnstileStatus === 'loading' ? (
              <>
                <span style={{ width: '18px', display: 'inline-flex', justifyContent: 'center' }}>
                  <i className="fa-solid fa-circle-notch fa-spin"></i> 
                </span>
                Securing with 
                <span style={{ width: '22px', display: 'inline-flex', justifyContent: 'center', margin: '0 2px' }}>
                  <i className="fa-brands fa-cloudflare" style={{ color: '#f38020', fontSize: '1.1rem' }}></i>
                </span>
                Cloudflare Turnstile...
              </>
            ) : (
              <>
                <span style={{ width: '18px', display: 'inline-flex', justifyContent: 'center' }}>
                  <i className="fa-solid fa-lock" style={{ color: '#10b981' }}></i> 
                </span>
                Protected by 
                <span style={{ width: '22px', display: 'inline-flex', justifyContent: 'center', margin: '0 2px' }}>
                  <i className="fa-brands fa-cloudflare" style={{ color: '#f38020', fontSize: '1.1rem' }}></i>
                </span>
                Cloudflare Turnstile
              </>
            )}
          </div>
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

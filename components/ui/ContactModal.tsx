'use client'

/* ContactModal — formulario de contacto público que se abre al hacer clic
   en "Email" del dropdown Portfolio en el Nav. Usa <CmsModal> como base
   visual para mantener consistencia. Envía via POST /api/contact. */

import { useCallback, useEffect, useRef, useState } from 'react'
import { CmsModal } from '@/components/ui/Modal'
import { gsap } from '@/hooks/useGSAP'
import '@/styles/contact-modal.css'

const COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan",
  "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi",
  "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo (Congo-Brazzaville)", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia (Czech Republic)",
  "Democratic Republic of the Congo", "Denmark", "Djibouti", "Dominica", "Dominican Republic",
  "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini (fmr. Swaziland)", "Ethiopia",
  "Fiji", "Finland", "France",
  "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana",
  "Haiti", "Honduras", "Hungary",
  "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy",
  "Jamaica", "Japan", "Jordan",
  "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan",
  "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg",
  "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar (formerly Burma)",
  "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway",
  "Oman",
  "Pakistan", "Palau", "Palestine State", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal",
  "Qatar",
  "Romania", "Russia", "Rwanda",
  "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria",
  "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu",
  "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan",
  "Vanuatu", "Venezuela", "Vietnam",
  "Yemen",
  "Zambia", "Zimbabwe"
]

type Status = 'idle' | 'sending' | 'success' | 'error'

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'

export default function ContactModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [country, setCountry] = useState('')
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

  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; country?: string; subject?: string; message?: string }>({})

  const validateField = useCallback((field: 'name' | 'email' | 'country' | 'subject' | 'message', val: string) => {
    let err: string | undefined = undefined
    const trimmed = val.trim()
    if (field === 'name') {
      if (!trimmed) err = 'Name is required'
      else if (trimmed.length > 100) err = 'Max 100 characters'
    } else if (field === 'email') {
      if (!trimmed) err = 'Email is required'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) err = 'Invalid email address'
      else if (trimmed.length > 255) err = 'Max 255 characters'
    } else if (field === 'country') {
      if (!trimmed) err = 'Country is required'
      else if (trimmed.length > 100) err = 'Max 100 characters'
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
    const cOk = validateField('country', country)
    const sOk = validateField('subject', subject)
    const mOk = validateField('message', message)
    return nOk && eOk && cOk && sOk && mOk
  }, [name, email, country, subject, message, validateField])

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
          country: country.trim(),
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
        if (data.field && ['name', 'email', 'country', 'subject', 'message'].includes(data.field)) {
          setFieldErrors((prev) => ({ ...prev, [data.field]: data.error }))
        } else {
          setErrorMsg(data.error || 'Something went wrong. Please try again.')
        }
      }
    } catch {
      setStatus('error')
      setErrorMsg('Network error. Please check your connection.')
    }
  }, [name, email, country, subject, message, turnstileToken, validateAll])

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
            maxLength={100}
            autoFocus
            required
          />
        </div>

        {/* Country */}
        <div className="contact-field">
          <div className="contact-label-row">
            <label htmlFor="contact-country" className="contact-label">
              <i className="fa-solid fa-globe"></i> Country <span className="contact-required">*</span>
            </label>
            {fieldErrors.country && (
              <span className="contact-field-error" role="alert">
                <i className="fa-solid fa-circle-exclamation"></i> {fieldErrors.country}
              </span>
            )}
          </div>
          <select
            id="contact-country"
            className="contact-input"
            value={country}
            onChange={(e) => {
              setCountry(e.target.value)
              if (fieldErrors.country) setFieldErrors((prev) => ({ ...prev, country: undefined }))
            }}
            required
            style={{ 
              appearance: 'none', 
              backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23999999%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 1rem top 50%',
              backgroundSize: '0.65rem auto',
              paddingRight: '2.5rem',
              cursor: 'pointer'
            }}
          >
            <option value="" disabled></option>
            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
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

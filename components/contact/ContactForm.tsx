'use client'

/* ContactForm — formulario de contacto reutilizable.
   Misma lógica que ContactModal (validación, envío a /api/contact, Turnstile)
   pero como componente inline (sin wrapper modal). Se usa en la página /contact. */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useUiText } from '@/lib/cms/store'

type ContactField = 'name' | 'email' | 'country' | 'subject' | 'message'
const REQUIRED_FIELDS: ContactField[] = ['name', 'email', 'country', 'message']
const FIELD_MAX: Record<ContactField, number> = {
  name: 100, email: 255, country: 100, subject: 255, message: 5000,
}

type TurnstileApi = {
  render: (
    container: HTMLElement,
    opts: {
      sitekey: string
      callback: (token: string) => void
      'expired-callback': () => void
      theme?: 'auto' | 'light' | 'dark'
    },
  ) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

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

export default function ContactForm() {
  const ui = useUiText()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [country, setCountry] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileStatus, setTurnstileStatus] = useState<'loading' | 'success'>('loading')
  const [turnstileStalled, setTurnstileStalled] = useState(false)
  const turnstileRef = useRef<HTMLDivElement>(null)
  const turnstileWidgetId = useRef<string | null>(null)
  const [charCount, setCharCount] = useState(0)

  const resetTurnstile = useCallback(() => {
    setTurnstileToken('')
    setTurnstileStatus('loading')
    setTurnstileStalled(false)
    if (turnstileWidgetId.current) {
      try { window.turnstile?.reset(turnstileWidgetId.current) } catch {}
    }
  }, [])

  useEffect(() => {
    if (turnstileStatus === 'success') return
    const t = setTimeout(() => setTurnstileStalled(true), 8000)
    return () => clearTimeout(t)
  }, [turnstileStatus])

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return

    const renderWidget = () => {
      if (turnstileRef.current && window.turnstile && !turnstileWidgetId.current) {
        turnstileWidgetId.current = window.turnstile.render(turnstileRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token: string) => {
            setTurnstileToken(token)
            setTurnstileStatus('success')
          },
          'expired-callback': () => resetTurnstile(),
          theme: 'auto',
        })
      }
    }

    if (window.turnstile) {
      renderWidget()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.onload = renderWidget
    document.head.appendChild(script)

    return () => {
      if (turnstileWidgetId.current && window.turnstile) {
        try { window.turnstile.remove(turnstileWidgetId.current) } catch {}
        turnstileWidgetId.current = null
      }
    }
  }, [resetTurnstile])

  type FieldError = { key?: string; vars?: Record<string, number>; text?: string }
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ContactField, FieldError>>>({})

  const validateField = useCallback((field: ContactField, val: string) => {
    const trimmed = val.trim()
    const max = FIELD_MAX[field]
    let err: FieldError | undefined
    if (!trimmed) {
      if (REQUIRED_FIELDS.includes(field)) err = { key: `err_${field}_required` }
    } else if (trimmed.length > max) {
      err = { key: 'err_max_chars', vars: { n: max } }
    } else if (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      err = { key: 'err_email_invalid' }
    }
    setFieldErrors((prev) => ({ ...prev, [field]: err }))
    return !err
  }, [])

  const errorText = (e?: FieldError) =>
    !e ? '' : e.key ? ui(e.key, e.text || '', e.vars) : (e.text || '')

  const validateAll = useCallback(() => {
    const nOk = validateField('name', name)
    const eOk = validateField('email', email)
    const cOk = validateField('country', country)
    const sOk = validateField('subject', subject)
    const mOk = validateField('message', message)
    return nOk && eOk && cOk && sOk && mOk
  }, [name, email, country, subject, message, validateField])

  const canSend = status !== 'sending' && (!TURNSTILE_SITE_KEY || turnstileStatus === 'success')

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
        return
      }

      setStatus('error')
      resetTurnstile()
      if (data.field && (REQUIRED_FIELDS as string[]).concat('subject').includes(data.field)) {
        setFieldErrors((prev) => ({ ...prev, [data.field]: { text: data.error } }))
      } else {
        setErrorMsg(data.error || ui('err_generic'))
      }
    } catch {
      setStatus('error')
      setErrorMsg(ui('err_network'))
      resetTurnstile()
    }
  }, [name, email, country, subject, message, turnstileToken, validateAll, ui, resetTurnstile])

  const handleMessageChange = (val: string) => {
    if (val.length <= 5000) {
      setMessage(val)
      setCharCount(val.length)
    }
  }

  // Success state
  if (status === 'success') {
    return (
      <div className="ct-form-success">
        <div className="ct-form-success__icon">
          <i className="fa-regular fa-paper-plane" />
        </div>
        <p className="ct-form-success__title">{ui('message_sent')}</p>
        <p className="ct-form-success__subtitle">
          {ui('thank_you')}{name ? `, ${name}` : ''}. {ui('message_sent_sub')}
        </p>
        <button
          type="button"
          className="ct-form-success__btn"
          onClick={() => {
            setStatus('idle')
            setName(''); setEmail(''); setCountry('')
            setSubject(''); setMessage(''); setCharCount(0)
            resetTurnstile()
          }}
        >
          <i className="fa-solid fa-paper-plane" /> {ui('send_message')}
        </button>
      </div>
    )
  }

  return (
    <form
      className="ct-form"
      onSubmit={(e) => { e.preventDefault(); handleSubmit() }}
      noValidate
    >
      <p className="ct-form__intro">
        {ui('contact_intro')}
      </p>

      {/* Name */}
      <div className="contact-field">
        <div className="contact-label-row">
          <label htmlFor="ct-name" className="contact-label">
            <i className="fa-solid fa-user" /> {ui('field_name')} <span className="contact-required">*</span>
          </label>
          {fieldErrors.name && (
            <span className="contact-field-error" role="alert">
              <i className="fa-solid fa-circle-exclamation" /> {errorText(fieldErrors.name)}
            </span>
          )}
        </div>
        <input
          id="ct-name"
          type="text"
          className="contact-input"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }))
          }}
          maxLength={100}
          required
        />
      </div>

      {/* Country */}
      <div className="contact-field">
        <div className="contact-label-row">
          <label htmlFor="ct-country" className="contact-label">
            <i className="fa-solid fa-globe" /> {ui('field_country')} <span className="contact-required">*</span>
          </label>
          {fieldErrors.country && (
            <span className="contact-field-error" role="alert">
              <i className="fa-solid fa-circle-exclamation" /> {errorText(fieldErrors.country)}
            </span>
          )}
        </div>
        <select
          id="ct-country"
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
          <label htmlFor="ct-email" className="contact-label">
            <i className="fa-solid fa-envelope" /> {ui('field_email')} <span className="contact-required">*</span>
          </label>
          {fieldErrors.email && (
            <span className="contact-field-error" role="alert">
              <i className="fa-solid fa-circle-exclamation" /> {errorText(fieldErrors.email)}
            </span>
          )}
        </div>
        <input
          id="ct-email"
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
          <label htmlFor="ct-subject" className="contact-label">
            <i className="fa-solid fa-tag" /> {ui('field_subject')} <span className="contact-optional">{ui('field_optional')}</span>
          </label>
          {fieldErrors.subject && (
            <span className="contact-field-error" role="alert">
              <i className="fa-solid fa-circle-exclamation" /> {errorText(fieldErrors.subject)}
            </span>
          )}
        </div>
        <input
          id="ct-subject"
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
          <label htmlFor="ct-message" className="contact-label">
            <i className="fa-solid fa-message" /> {ui('field_message')} <span className="contact-required">*</span>
          </label>
          {fieldErrors.message && (
            <span className="contact-field-error" role="alert">
              <i className="fa-solid fa-circle-exclamation" /> {errorText(fieldErrors.message)}
            </span>
          )}
        </div>
        <textarea
          id="ct-message"
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

      {/* Turnstile */}
      {TURNSTILE_SITE_KEY && (
        <div className={`contact-turnstile-disclaimer ${turnstileStatus}`}>
          <div ref={turnstileRef} style={{ position: 'absolute', top: '-9999px', opacity: 0, pointerEvents: 'none' }} />
          {turnstileStatus === 'loading' ? (
            <>
              <span style={{ width: '18px', display: 'inline-flex', justifyContent: 'center' }}>
                <i className="fa-solid fa-circle-notch fa-spin" />
              </span>
              {ui('securing_with')}&nbsp;
              <span style={{ width: '22px', display: 'inline-flex', justifyContent: 'center', margin: '0 2px' }}>
                <i className="fa-brands fa-cloudflare" style={{ color: '#f38020', fontSize: '1.1rem' }} />
              </span>
              Cloudflare Turnstile
            </>
          ) : (
            <>
              <span style={{ width: '18px', display: 'inline-flex', justifyContent: 'center' }}>
                <i className="fa-solid fa-lock" style={{ color: '#10b981' }} />
              </span>
              {ui('protected_by')}&nbsp;
              <span style={{ width: '22px', display: 'inline-flex', justifyContent: 'center', margin: '0 2px' }}>
                <i className="fa-brands fa-cloudflare" style={{ color: '#f38020', fontSize: '1.1rem' }} />
              </span>
              Cloudflare Turnstile
            </>
          )}
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="contact-error">
          <i className="fa-solid fa-circle-exclamation" /> {errorMsg}
        </div>
      )}

      {TURNSTILE_SITE_KEY && turnstileStalled && turnstileStatus !== 'success' && (
        <div className="contact-error">
          <i className="fa-solid fa-circle-exclamation" /> {ui('err_captcha_load')}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        className="cms-btn cms-btn--primary contact-submit"
        disabled={!canSend}
      >
        {status === 'sending' ? (
          <><i className="fa-solid fa-spinner fa-spin" /> {ui('sending')}</>
        ) : (
          <><i className="fa-solid fa-paper-plane" /> {ui('send_message')}</>
        )}
      </button>
    </form>
  )
}

'use client'

/* useContactForm — estado, validación, Turnstile y envío del formulario de
   contacto. Única implementación: la usan ContactModal (nav) y ContactForm
   (/contact). Cada uno pone su chrome (modal vs inline) y su pantalla de
   éxito; la lógica no se duplica. */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useUiText } from '@/lib/cms/store'
import {
  COUNTRIES, FIELD_MAX, REQUIRED_FIELDS, TURNSTILE_SITE_KEY,
  type ContactField, type ContactStatus,
} from '@/lib/contact-form'

/* El widget de Turnstile se inyecta por script, así que no hay tipos: se
   declara acá la parte de la API que usamos, en vez de castear window a `any`
   en cada llamada. */
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

export type FieldError = { key?: string; vars?: Record<string, number>; text?: string }

export type ContactFormApi = ReturnType<typeof useContactForm>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function useContactForm() {
  const ui = useUiText()
  const [values, setValues] = useState<Record<ContactField, string>>({
    name: '', email: '', country: '', subject: '', message: '',
  })
  const [status, setStatus] = useState<ContactStatus>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ContactField, FieldError>>>({})
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileStatus, setTurnstileStatus] = useState<'loading' | 'success'>('loading')
  const [turnstileStalled, setTurnstileStalled] = useState(false)
  const turnstileRef = useRef<HTMLDivElement>(null)
  const turnstileWidgetId = useRef<string | null>(null)

  /* El token de Turnstile es de un solo uso: siteverify lo consume. Después de
     CUALQUIER respuesta del servidor (429, error de validación, fallo de red)
     el token que quedó en el state ya está quemado, así que reintentar con él
     devolvía siempre "Captcha verification failed". Pedir uno nuevo. */
  const resetTurnstile = useCallback(() => {
    setTurnstileToken('')
    setTurnstileStatus('loading')
    setTurnstileStalled(false)
    if (turnstileWidgetId.current) {
      try { window.turnstile?.reset(turnstileWidgetId.current) } catch {}
    }
  }, [])

  /* Sin token no se puede enviar (el servidor lo exige), así que un widget que
     nunca resuelve —adblock, red que filtra Cloudflare— dejaría un spinner
     eterno sin explicación. Pasado el margen se dice qué hacer. */
  useEffect(() => {
    if (turnstileStatus === 'success') return
    const t = setTimeout(() => setTurnstileStalled(true), 8000)
    return () => clearTimeout(t)
  }, [turnstileStatus])

  // Carga del script de Turnstile + render del widget
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

  const validateField = useCallback((field: ContactField, val: string) => {
    const trimmed = val.trim()
    const max = FIELD_MAX[field]
    let err: FieldError | undefined
    if (!trimmed) {
      if (REQUIRED_FIELDS.includes(field)) err = { key: `err_${field}_required` }
    } else if (trimmed.length > max) {
      err = { key: 'err_max_chars', vars: { n: max } }
    } else if (field === 'email' && !EMAIL_RE.test(trimmed)) {
      err = { key: 'err_email_invalid' }
    }
    setFieldErrors((prev) => ({ ...prev, [field]: err }))
    return !err
  }, [])

  /* Escribir un campo limpia su error: el mensaje de "requerido" no puede
     quedar colgado mientras el usuario ya está escribiendo. `message` además
     corta en el máximo, que es el único campo con contador visible. */
  const setField = useCallback((field: ContactField, val: string) => {
    const next = field === 'message' ? val.slice(0, FIELD_MAX.message) : val
    setValues((prev) => ({ ...prev, [field]: next }))
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev))
  }, [])

  const errorText = useCallback(
    (e?: FieldError) => (!e ? '' : e.key ? ui(e.key, e.text || '', e.vars) : (e.text || '')),
    [ui],
  )

  const reset = useCallback(() => {
    setValues({ name: '', email: '', country: '', subject: '', message: '' })
    setFieldErrors({})
    setErrorMsg('')
    setStatus('idle')
    resetTurnstile()
  }, [resetTurnstile])

  const canSend = status !== 'sending' && (!TURNSTILE_SITE_KEY || turnstileStatus === 'success')

  const submit = useCallback(async () => {
    const fields: ContactField[] = ['name', 'email', 'country', 'subject', 'message']
    // `every` cortocircuita: hay que validar TODOS para pintar todos los errores.
    const allValid = fields.map((f) => validateField(f, values[f])).every(Boolean)
    if (!allValid) return

    setStatus('sending')
    setErrorMsg('')

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name.trim(),
          email: values.email.trim(),
          country: values.country.trim(),
          subject: values.subject.trim(),
          message: values.message.trim(),
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
  }, [values, turnstileToken, validateField, ui, resetTurnstile])

  return {
    ui, values, setField, status, errorMsg, fieldErrors, errorText,
    turnstileRef, turnstileStatus, turnstileStalled,
    canSend, submit, reset, countries: COUNTRIES,
  }
}

'use client'

/* Campos del formulario de contacto — markup único para el modal del nav y la
   página /contact. Lo variable va por props: prefijo de ids (dos formularios
   pueden coexistir en el DOM), clases del <form>/intro y el autofocus (solo el
   modal, que abre con foco propio). La lógica vive en useContactForm(). */

import type { ContactFormApi } from '@/hooks/useContactForm'
import { FIELD_MAX, TURNSTILE_SITE_KEY, type ContactField } from '@/lib/contact-form'

/* Flecha del <select>: nativa no se puede estilar, así que va como
   background-image y se apaga la apariencia del sistema. */
const SELECT_ARROW: React.CSSProperties = {
  appearance: 'none',
  backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23999999%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 1rem top 50%',
  backgroundSize: '0.65rem auto',
  paddingRight: '2.5rem',
  cursor: 'pointer',
}

const ICON_SLOT: React.CSSProperties = { width: '18px', display: 'inline-flex', justifyContent: 'center' }
const CF_SLOT: React.CSSProperties = { width: '22px', display: 'inline-flex', justifyContent: 'center', margin: '0 2px' }

type FieldRowProps = {
  form: ContactFormApi
  idPrefix: string
  field: ContactField
  icon: string
  labelKey: string
  optional?: boolean
  children: (id: string) => React.ReactNode
}

function FieldRow({ form, idPrefix, field, icon, labelKey, optional, children }: FieldRowProps) {
  const { ui, fieldErrors, errorText } = form
  const id = `${idPrefix}-${field}`
  return (
    <div className="contact-field">
      <div className="contact-label-row">
        <label htmlFor={id} className="contact-label">
          <i className={`fa-solid ${icon}`}></i> {ui(labelKey)}{' '}
          {optional
            ? <span className="contact-optional">{ui('field_optional')}</span>
            : <span className="contact-required">*</span>}
        </label>
        {fieldErrors[field] && (
          <span className="contact-field-error" role="alert">
            <i className="fa-solid fa-circle-exclamation"></i> {errorText(fieldErrors[field])}
          </span>
        )}
      </div>
      {children(id)}
    </div>
  )
}

type Props = {
  form: ContactFormApi
  idPrefix: string
  formClassName: string
  introClassName: string
  autoFocus?: boolean
}

export default function ContactFormFields({ form, idPrefix, formClassName, introClassName, autoFocus }: Props) {
  const {
    ui, values, setField, status, errorMsg,
    turnstileRef, turnstileStatus, turnstileStalled, canSend, submit, countries,
  } = form

  const row = (field: ContactField, icon: string, labelKey: string, optional?: boolean) =>
    ({ form, idPrefix, field, icon, labelKey, optional })

  return (
    <form className={formClassName} onSubmit={(e) => { e.preventDefault(); submit() }} noValidate>
      <p className={introClassName}>{ui('contact_intro')}</p>

      <FieldRow {...row('name', 'fa-user', 'field_name')}>
        {(id) => (
          <input
            id={id} type="text" className="contact-input" value={values.name}
            onChange={(e) => setField('name', e.target.value)}
            maxLength={FIELD_MAX.name} autoFocus={autoFocus} required
          />
        )}
      </FieldRow>

      <FieldRow {...row('country', 'fa-globe', 'field_country')}>
        {(id) => (
          <select
            id={id} className="contact-input" value={values.country}
            onChange={(e) => setField('country', e.target.value)}
            required style={SELECT_ARROW}
          >
            <option value="" disabled></option>
            {countries.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </FieldRow>

      <FieldRow {...row('email', 'fa-envelope', 'field_email')}>
        {(id) => (
          <input
            id={id} type="email" className="contact-input" value={values.email}
            onChange={(e) => setField('email', e.target.value)}
            maxLength={FIELD_MAX.email} required
          />
        )}
      </FieldRow>

      <FieldRow {...row('subject', 'fa-tag', 'field_subject', true)}>
        {(id) => (
          <input
            id={id} type="text" className="contact-input" value={values.subject}
            onChange={(e) => setField('subject', e.target.value)}
            maxLength={FIELD_MAX.subject}
          />
        )}
      </FieldRow>

      <FieldRow {...row('message', 'fa-message', 'field_message')}>
        {(id) => (
          <>
            <textarea
              id={id} className="contact-input contact-textarea" value={values.message}
              onChange={(e) => setField('message', e.target.value)}
              rows={5} required
            />
            <span className="contact-charcount">{values.message.length}/{FIELD_MAX.message}</span>
          </>
        )}
      </FieldRow>

      {/* Turnstile (invisible): el widget se renderiza fuera de pantalla y acá
          solo se informa el estado de la verificación. */}
      {TURNSTILE_SITE_KEY && (
        <div className={`contact-turnstile-disclaimer ${turnstileStatus}`}>
          <div ref={turnstileRef} style={{ position: 'absolute', top: '-9999px', opacity: 0, pointerEvents: 'none' }}></div>
          <span style={ICON_SLOT}>
            {turnstileStatus === 'loading'
              ? <i className="fa-solid fa-circle-notch fa-spin"></i>
              : <i className="fa-solid fa-lock" style={{ color: '#10b981' }}></i>}
          </span>
          {ui(turnstileStatus === 'loading' ? 'securing_with' : 'protected_by')}&nbsp;
          <span style={CF_SLOT}>
            <i className="fa-brands fa-cloudflare" style={{ color: '#f38020', fontSize: '1.1rem' }}></i>
          </span>
          Cloudflare Turnstile
        </div>
      )}

      {status === 'error' && (
        <div className="contact-error">
          <i className="fa-solid fa-circle-exclamation"></i> {errorMsg}
        </div>
      )}

      {TURNSTILE_SITE_KEY && turnstileStalled && turnstileStatus !== 'success' && (
        <div className="contact-error">
          <i className="fa-solid fa-circle-exclamation"></i> {ui('err_captcha_load')}
        </div>
      )}

      <button type="submit" className="cms-btn cms-btn--primary contact-submit" disabled={!canSend}>
        {status === 'sending'
          ? <><i className="fa-solid fa-spinner fa-spin"></i> {ui('sending')}</>
          : <><i className="fa-solid fa-paper-plane"></i> {ui('send_message')}</>}
      </button>
    </form>
  )
}

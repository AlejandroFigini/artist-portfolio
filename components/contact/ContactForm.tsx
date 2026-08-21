'use client'

/* ContactForm — formulario de contacto inline de la página /contact.
   Lógica compartida con el modal del nav (useContactForm + ContactFormFields);
   acá solo vive el chrome propio: la pantalla de éxito de la página. */

import { useContactForm } from '@/hooks/useContactForm'
import ContactFormFields from './ContactFormFields'

export default function ContactForm() {
  const form = useContactForm()
  const { ui, values, status, reset } = form

  if (status === 'success') {
    return (
      <div className="ct-form-success">
        <div className="ct-form-success__icon">
          <i className="fa-regular fa-paper-plane" />
        </div>
        <p className="ct-form-success__title">{ui('message_sent')}</p>
        <p className="ct-form-success__subtitle">
          {ui('thank_you')}{values.name ? `, ${values.name}` : ''}. {ui('message_sent_sub')}
        </p>
        <button type="button" className="ct-form-success__btn" onClick={reset}>
          <i className="fa-solid fa-paper-plane" /> {ui('send_message')}
        </button>
      </div>
    )
  }

  return (
    <ContactFormFields
      form={form}
      idPrefix="ct"
      formClassName="ct-form"
      introClassName="ct-form__intro"
    />
  )
}

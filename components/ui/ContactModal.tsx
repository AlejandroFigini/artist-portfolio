'use client'

/* ContactModal — formulario de contacto público que se abre al hacer clic
   en "Email" del dropdown Portfolio en el Nav. Usa <CmsModal> como base
   visual para mantener consistencia. La lógica y los campos son los mismos
   que los de la página /contact (useContactForm + ContactFormFields); acá
   solo vive el chrome del modal: pausa de animaciones y vista de éxito. */

import { useEffect } from 'react'
import { CmsModal } from '@/components/ui/Modal'
import ContactFormFields from '@/components/contact/ContactFormFields'
import { useContactForm } from '@/hooks/useContactForm'
import { pauseGlobalMotion, playGlobalMotion } from '@/hooks/useGSAP'
import '@/styles/contact-modal.css'

export default function ContactModal({ onClose }: { onClose: () => void }) {
  const form = useContactForm()
  const { ui, values, status } = form

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

    pauseGlobalMotion()
    window.dispatchEvent(new CustomEvent('modal:open'))

    return () => {
      document.body.classList.remove('contact-modal-open')
      /* Reanudar SOLO lo que sigue en cuadro: el modal se abre desde el nav a
         cualquier altura de scroll, así que un video pausado al abrirlo puede
         estar fuera de pantalla al cerrarlo. */
      pausedVideos.forEach((v) => {
        const r = v.getBoundingClientRect()
        if (r.bottom > 0 && r.top < (window.innerHeight || 0)) {
          try { v.play() } catch {}
        }
      })
      playGlobalMotion()
      window.dispatchEvent(new CustomEvent('modal:close'))
    }
  }, [])

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
          <p className="contact-success-title">{ui('message_sent')}</p>
          <p className="contact-success-subtitle">
            {ui('thank_you')}{values.name ? `, ${values.name}` : ''}. {ui('message_sent_sub')}
          </p>
          <button type="button" className="contact-success-btn-minimal" onClick={onClose}>
            {ui('okay')}
          </button>
        </div>
      </CmsModal>
    )
  }

  return (
    <CmsModal
      title={<><i className="fa-solid fa-paper-plane" style={{ color: 'var(--accent)', marginRight: 8 }}></i> {ui('contact_me')}</>}
      onClose={onClose}
      className="contact-modal"
      overlayClassName="contact-modal-overlay-custom"
    >
      <ContactFormFields
        form={form}
        idPrefix="contact"
        formClassName="contact-form"
        introClassName="contact-form-intro"
        autoFocus
      />
    </CmsModal>
  )
}

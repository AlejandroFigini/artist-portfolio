'use client'

/* Burbujas sociales del footer. Lee los enlaces del SocialProvider (site-wide)
   y renderiza solo las redes con URL configurada en Gestión. */

import { SOCIAL_NETWORKS, socialHref } from '@/lib/social'
import { useSocial } from './SocialProvider'
import { sendGAEvent } from '@next/third-parties/google'

export default function FooterSocial() {
  const { links } = useSocial()
  const nets = SOCIAL_NETWORKS.filter((n) => socialHref(n, links[n.id]))
  if (nets.length === 0) return null
  return (
    <div className="footer-social-bubbles">
      {nets.map((n) => (
        <a
          key={n.id}
          href={n.type === 'email' ? '#' : socialHref(n, links[n.id])}
          target={n.type === 'email' ? undefined : '_blank'}
          rel="noopener noreferrer"
          className="social-bubble"
          title={n.label}
          onClick={(e) => {
            if (n.type === 'email') {
              e.preventDefault();
              window.dispatchEvent(new CustomEvent('open-contact'));
              sendGAEvent('event', 'email_click');
            } else {
              sendGAEvent('event', `social_click_${n.id}`);
            }
          }}
        >
          <i className={`${n.brand ? 'fa-brands' : 'fa-solid'} ${n.icon}`}></i>
        </a>
      ))}
    </div>
  )
}

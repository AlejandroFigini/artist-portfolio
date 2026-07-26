'use client'

/* Footer — portado de shared-ui.js (FOOTER). Server component estático. */

import Link from 'next/link'
import FooterSocial from './FooterSocial'
import { useSiteSettings } from '@/components/ui/SiteSettingsProvider'
import { sendGAEvent } from '@next/third-parties/google'

const EXPLORE_LINKS = [
  { href: '/#presentacion', label: 'About me', i18n: 'nav_about' },
  { href: '/illustrations', label: 'Illustrations', i18n: 'nav_illustrations' },
  { href: '/animations', label: 'Animations', i18n: 'nav_animations' },
  { href: '/characters', label: 'Characters', i18n: 'nav_characters' },
  { href: '/models-3d', label: '3D Models', i18n: 'nav_3d' },
  { href: '/multimedia', label: 'Multimedia', i18n: 'nav_multimedia' },
]

export default function Footer() {
  const { settings } = useSiteSettings()
  return (
    <footer className="main-footer" id="contacto">
      <div className="footer-grid">
        <div className="footer-col branding-col">
          <h2 className="footer-name">Lucia <span>Montaña</span></h2>
          <p className="footer-role" data-i18n="footer_role">Bachelor&apos;s Degree in Animation &amp; Video Games</p>
          <FooterSocial />
        </div>
        <div className="footer-col links-col">
          <h3 className="footer-label" data-i18n="footer_exploration">Exploration</h3>
          <ul className="footer-links-list">
            {EXPLORE_LINKS.map((l) => (
              <li key={l.href}>
                {l.href.startsWith('/#')
                  ? <a href={l.href} data-i18n={l.i18n}>{l.label}</a>
                  : <Link href={l.href} data-i18n={l.i18n}>{l.label}</Link>}
              </li>
            ))}
          </ul>
        </div>
        <div className="footer-col contact-col">
          <h3 className="footer-label" data-i18n="footer_connect">Connect</h3>
          <p className="contact-item"><i className="fa-solid fa-location-dot"></i> Montevideo, Uruguay</p>
          <a href="mailto:lumontana23@gmail.com" className="contact-email">
            <i className="fa-solid fa-envelope"></i> lumontana23@gmail.com
          </a>
          <a
            className={`cv-btn cv-btn-footer${settings.cvUrl ? '' : ' is-disabled'}`}
            id="cv-download-footer"
            href={settings.cvUrl || undefined}
            download={settings.cvUrl ? settings.cvName || 'CV.pdf' : undefined}
            target={settings.cvUrl ? '_blank' : undefined} rel="noopener noreferrer"
            title={settings.cvUrl ? 'Download CV' : 'CV not available yet'}
            aria-label="Download CV" aria-disabled={!settings.cvUrl || undefined}
            data-i18n-title="download_cv" data-i18n-aria="download_cv"
            onClick={() => sendGAEvent('event', 'cv_download')}
          >
            <i className="fa-solid fa-file-arrow-down"></i><span data-i18n="cv">CV</span>
          </a>
        </div>
      </div>
      <div className="footer-bottom-bar">
        <p className="footer-copyright">&copy; <span id="year">{new Date().getFullYear()}</span> Lucia Montaña | <span data-i18n="footer_rights">All rights reserved</span></p>
        <div className="legal-dots" data-i18n="footer_no_repost">Please do not repost my work without authorization</div>
      </div>
    </footer>
  )
}

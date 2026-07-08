/* Footer — portado de shared-ui.js (FOOTER). Server component estático. */

import Link from 'next/link'
import FooterSocial from './FooterSocial'

const EXPLORE_LINKS = [
  { href: '/#presentacion', label: 'About me', i18n: 'nav_about' },
  { href: '/illustrations', label: 'Illustrations', i18n: 'nav_illustrations' },
  { href: '/animations', label: 'Animations', i18n: 'nav_animations' },
  { href: '/characters', label: 'Characters', i18n: 'nav_characters' },
  { href: '/models-3d', label: '3D Models', i18n: 'nav_3d' },
  { href: '/multimedia', label: 'Multimedia', i18n: 'nav_multimedia' },
]

export default function Footer() {
  return (
    <footer className="main-footer" id="contacto">
      <div className="footer-grid">
        <div className="footer-col branding-col">
          <h2 className="footer-name">Lucia <span>Montaña</span></h2>
          <p className="footer-role">Bachelor&apos;s Degree in Animation &amp; Video Games</p>
          <FooterSocial />
        </div>
        <div className="footer-col links-col">
          <h3 className="footer-label">Exploration</h3>
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
          <h3 className="footer-label">Connect</h3>
          <p className="contact-item"><i className="fa-solid fa-location-dot"></i> Montevideo, Uruguay</p>
          <a href="mailto:lumontana23@gmail.com" className="contact-email">
            <i className="fa-solid fa-envelope"></i> lumontana23@gmail.com
          </a>
          <button type="button" className="cv-btn cv-btn-footer" id="cv-download-footer" title="Download CV" aria-label="Download CV">
            <i className="fa-solid fa-file-arrow-down"></i><span>CV</span>
          </button>
        </div>
      </div>
      <div className="footer-bottom-bar">
        <p className="footer-copyright">&copy; <span id="year">{new Date().getFullYear()}</span> Lucia Montaña | All rights reserved</p>
        <div className="legal-dots">Please do not repost my work without authorization</div>
      </div>
    </footer>
  )
}

'use client'

/* Footer — portado de shared-ui.js (FOOTER). Server component estático. */

import Link from 'next/link'
import FooterSocial from './FooterSocial'
import { useSiteSettings } from '@/components/ui/SiteSettingsProvider'
import { useUiText } from '@/lib/cms/store'
import { sendGAEvent } from '@next/third-parties/google'
import { useDownloadCv } from '@/hooks/useDownloadCv'
import DecorAnim from '@/components/ui/DecorAnim'
import { animSources, animIntervalMs } from '@/lib/settings'
import { SITE_SECTIONS } from '@/lib/site-sections'

/* Mismo destino que el menú: las galerías son secciones del feed, no rutas. */
const EXPLORE_LINKS = [
  { href: '/#about', label: 'About me', i18n: 'nav_about' },
  ...SITE_SECTIONS.map((s) => ({ href: `/#${s.id}`, label: s.label, i18n: s.i18n })),
  { href: '/contact', label: 'Contact', i18n: 'nav_contact' },
]

export default function Footer() {
  const { settings } = useSiteSettings()
  const { downloadCv, isDownloading } = useDownloadCv(settings.cvUrl, settings.cvName || 'CV.pdf')
  const ui = useUiText()
  return (
    <footer className="main-footer" id="contacto">
      <div className="footer-grid">
        <div className="footer-col branding-col">
          <h2 className="footer-name">Lucia <span>Montaña</span></h2>
          <p className="footer-role">{ui('footer_role')}</p>
          <FooterSocial />
          {/* Hueco libre bajo la marca: acá el contenedor SÍ va en el flujo —
              la columna es la que tiene aire de sobra y nada que desplazar.
              Solo se anima con el footer en pantalla. */}
          <DecorAnim
            sources={animSources(settings, 'footerAnimUrl')}
            className="footer-anim"
            rotateOn="interval"
            slot="footer"
            intervalMs={animIntervalMs(settings.footerAnimEvery)}
          />
        </div>
        <div className="footer-col links-col">
          <h3 className="footer-label">{ui('footer_exploration')}</h3>
          <ul className="footer-links-list">
            {EXPLORE_LINKS.map((l) => (
              <li key={l.href}>
                {l.href.startsWith('/#')
                  ? <a href={l.href}>{ui(l.i18n, l.label)}</a>
                  : <Link href={l.href}>{ui(l.i18n, l.label)}</Link>}
              </li>
            ))}
          </ul>
        </div>
        <div className="footer-col contact-col">
          <h3 className="footer-label">{ui('footer_connect')}</h3>
          <p className="contact-item"><i className="fa-solid fa-location-dot"></i> Montevideo, Uruguay</p>
          <a 
            href="mailto:lumontana23@gmail.com" 
            className="contact-email"
            onClick={(e) => {
              e.preventDefault()
              sendGAEvent('event', 'email_click')
              window.dispatchEvent(new Event('open-contact'))
            }}
          >
            <i className="fa-solid fa-envelope"></i> lumontana23@gmail.com
          </a>
          <a
            className={`cv-btn cv-btn-footer${!settings.cvUrl || isDownloading ? ' is-disabled' : ''}`}
            id="cv-download-footer"
            href={settings.cvUrl ? '/api/cv' : undefined}
            onClick={settings.cvUrl ? downloadCv : undefined}
            title={settings.cvUrl ? ui('download_cv') : ui('cv_unavailable')}
            aria-label={ui('download_cv')} aria-disabled={!settings.cvUrl || undefined}
          >
            <i className={`fa-solid ${isDownloading ? 'fa-spinner fa-spin' : 'fa-file-arrow-down'}`}></i><span>{ui('cv')}</span>
          </a>
        </div>
      </div>
      <div className="footer-bottom-bar">
        <p className="footer-copyright">&copy; <span id="year">{new Date().getFullYear()}</span> Lucia Montaña | <span>{ui('footer_rights')}</span></p>
        <div className="legal-dots">{ui('footer_no_repost')}</div>
      </div>
    </footer>
  )
}

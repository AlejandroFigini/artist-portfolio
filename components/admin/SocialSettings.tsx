'use client'

/* Gestión → Redes sociales. Form para definir las URLs de cada red. Guarda en
   cms_data (claves social.*) vía POST /api/content, refleja en el store local y
   actualiza el SocialProvider para aplicar los enlaces en vivo en Nav y Footer. */

import { useEffect, useState } from 'react'
import { SOCIAL_NETWORKS, socialKey } from '@/lib/social'
import { useSocial } from '@/components/ui/SocialProvider'
import { useToast } from '@/components/ui/Toast'
import { saveContent } from '@/lib/api'
import { state, persistOverridesLocal, recordAudit } from '@/lib/cms/store'

/* Destino de las notificaciones internas (mensajes del formulario, reporte
   semanal). Separado del email PÚBLICO que se muestra en el sitio. Bajo
   `settings.*`, así que isTranslatableEntry() lo deja fuera del export de
   traducciones. Vacío → lib/mail cae a social.email. */
const NOTIFY_EMAIL_KEY = 'settings.notifyEmail'

export default function SocialSettings() {
  const { links, setLinks } = useSocial()
  const toast = useToast()
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    SOCIAL_NETWORKS.forEach((n) => { init[n.id] = links[n.id] || state.items[socialKey(n.id)] || '' })
    return init
  })
  const [saving, setSaving] = useState(false)
  const [notifyEmail, setNotifyEmail] = useState('')

  /* El valor vive en cms_data pero no lo trae el SocialProvider (que solo lee
     social.*), y state.items puede no estar hidratado todavía: sin este fetch
     el input arrancaría vacío y guardar borraría el valor configurado. */
  useEffect(() => {
    fetch('/api/content')
      .then((r) => r.json())
      .then((d) => setNotifyEmail(d.items?.[NOTIFY_EMAIL_KEY] || ''))
      .catch(() => {})
  }, [])

  const save = async () => {
    setSaving(true)
    const items: Record<string, string> = { [NOTIFY_EMAIL_KEY]: notifyEmail.trim() }
    SOCIAL_NETWORKS.forEach((n) => { items[socialKey(n.id)] = (vals[n.id] || '').trim() })
    try {
      await saveContent(items)
      Object.assign(state.items, items)
      persistOverridesLocal()
      const map: Record<string, string> = {}
      SOCIAL_NETWORKS.forEach((n) => { map[n.id] = items[socialKey(n.id)] })
      setLinks(map)
      recordAudit({ section: 'Social networks', label: 'Links', summary: 'Social links and notification email updated' })
      toast('Links saved')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error saving', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-card" id="ajustes-social">
      <div className="admin-card-head">
        <h2><i className="fa-solid fa-share-nodes"></i> Social Networks
          <span className="cms-info-tip" tabIndex={0} aria-label="Define links to your social networks. They apply to menu icons, footer, and any section linking to your socials. Leave a field empty to hide that network.">
            <i className="fa-solid fa-circle-info"></i>
            <span className="cms-info-bubble" role="tooltip" style={{ width: 280 }}>Define links to your social networks. They apply to menu icons, footer, and any section linking to your socials. Leave a field empty to hide that network.</span>
          </span>
        </h2>
      </div>
      <p className="cms-admin-sub">Public social links</p>
      <div className="social-settings">
        {SOCIAL_NETWORKS.map((n) => (
          <div key={n.id} className="setting-item">
            <span><i className={`${n.brand ? 'fa-brands' : 'fa-solid'} ${n.icon}`} style={{ width: '1.2em' }}></i> {n.label}</span>
            <input
              type={n.type === 'email' ? 'text' : 'url'}
              className="social-input"
              placeholder={n.placeholder}
              value={vals[n.id]}
              onChange={(e) => setVals((v) => ({ ...v, [n.id]: e.target.value }))}
            />
          </div>
        ))}
      </div>

      <p className="cms-admin-sub" style={{ marginTop: '1.5rem' }}>
        Notification email
        <span className="cms-info-tip" tabIndex={0} aria-label="Where contact form messages and the weekly traffic report are delivered. This address is never shown on the site. Leave it empty to use the public Email address above. Separate several addresses with commas.">
          <i className="fa-solid fa-circle-info"></i>
          <span className="cms-info-bubble" role="tooltip" style={{ width: 280 }}>Where contact form messages and the weekly traffic report are delivered. This address is never shown on the site. Leave it empty to use the public Email address above. Separate several addresses with commas.</span>
        </span>
      </p>
      <div className="social-settings">
        <div className="setting-item">
          <span><i className="fa-solid fa-bell" style={{ width: '1.2em' }}></i> Notifications</span>
          <input
            type="text"
            className="social-input"
            placeholder="inbox@example.com"
            value={notifyEmail}
            onChange={(e) => setNotifyEmail(e.target.value)}
          />
        </div>
      </div>

      <div className="admin-quick" style={{ marginTop: '1.5rem' }}>
        <button type="button" className="cms-btn cms-btn--primary" onClick={save} disabled={saving}>
          <i className="fa-solid fa-floppy-disk"></i> {saving ? 'Saving…' : 'Save links'}
        </button>
      </div>
    </div>
  )
}

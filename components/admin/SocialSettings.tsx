'use client'

/* Gestión → Redes sociales. Form para definir las URLs de cada red. Guarda en
   cms_data (claves social.*) vía POST /api/content, refleja en el store local y
   actualiza el SocialProvider para aplicar los enlaces en vivo en Nav y Footer. */

import { useState } from 'react'
import { SOCIAL_NETWORKS, socialKey } from '@/lib/social'
import { useSocial } from '@/components/ui/SocialProvider'
import { useToast } from '@/components/ui/Toast'
import { saveContent } from '@/lib/api'
import { state, persistOverridesLocal, recordAudit } from '@/lib/cms/store'

export default function SocialSettings() {
  const { links, setLinks } = useSocial()
  const toast = useToast()
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    SOCIAL_NETWORKS.forEach((n) => { init[n.id] = links[n.id] || state.items[socialKey(n.id)] || '' })
    return init
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    const items: Record<string, string> = {}
    SOCIAL_NETWORKS.forEach((n) => { items[socialKey(n.id)] = (vals[n.id] || '').trim() })
    try {
      await saveContent(items)
      Object.assign(state.items, items)
      persistOverridesLocal()
      const map: Record<string, string> = {}
      SOCIAL_NETWORKS.forEach((n) => { map[n.id] = items[socialKey(n.id)] })
      setLinks(map)
      recordAudit({ section: 'Social networks', label: 'Links', summary: 'Social links updated' })
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
              type={n.type === 'email' ? 'email' : 'url'}
              className="social-input"
              placeholder={n.placeholder}
              value={vals[n.id]}
              onChange={(e) => setVals((v) => ({ ...v, [n.id]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <div className="admin-quick" style={{ marginTop: '1.5rem' }}>
        <button type="button" className="cms-btn cms-btn--primary" onClick={save} disabled={saving}>
          <i className="fa-solid fa-floppy-disk"></i> {saving ? 'Saving…' : 'Save links'}
        </button>
      </div>
    </div>
  )
}

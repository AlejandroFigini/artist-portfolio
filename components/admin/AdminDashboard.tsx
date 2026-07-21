'use client'

/* Panel de gestión — port de admin.html + admin.js: topbar, sidebar con
   sub-menú de Contenidos (badges con conteo/tamaño), y las secciones
   Resumen / Contenidos / Subir / Usuarios / Auditoría / Ajustes. */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { fmtBytes, fmtDate } from '@/lib/utils'
import {
  state, useCmsStore, loadState, sumSizes, deduplicateMedia, loadJSON, saveJSON, emit, LS, setAdminFlag, loadServerState, cleanOrphanOverrides, syncCloudinaryFolders, validateCloudinaryContent,
} from '@/lib/cms/store'
import { getAccount, scaffoldCloudinaryFolders, logout } from '@/lib/api'
import { autoCleanTrash, resolveSizes, clearAudit } from './actions'
import { SectionUsado, SectionNoUsado, SectionBasurero, SectionRepo, type AdminModal } from './ContentSections'
import { ViewMediaModal, RenameContainerModal, AssociateContainerModal, AdminEditInfoModal, AdminUploadModal, SelectContainerActionModal } from './modals'
import { seedUsedContent } from '../cms/engine'
import SiteSettings, { LoaderSettings, FaviconSettings, CvSettings, TranslationSettings } from './SiteSettings'
import SocialSettings from './SocialSettings'
import UsersSection from './UsersSection'
import { MediaCard, type AnyEntry } from './cards'

const NAV_BOTTOM = [
  { id: 'auditoria', icon: 'fa-clipboard-list', label: 'Audit' },
]

const markSkipLoader = () => { try { sessionStorage.setItem('cms_skip_loader', '1') } catch {} }

const RESUMEN_INFO = 'Each card shows content count and total size: in use (active on site), unused (retired), trash (marked for deletion) and repository (all content combined).'

function Stat({ label, count, size, warn, repeatedCount }: { label: string; count: number; size: string; warn?: boolean; repeatedCount?: number }) {
  return (
    <div className={`admin-stat${warn ? ' admin-stat--warn' : ''}`}>
      <span className="admin-stat-num">
        {count}
        {repeatedCount !== undefined && repeatedCount > 0 && (
          <span style={{ fontSize: '0.55em', opacity: 0.7, marginLeft: '0.4rem', fontWeight: 600, verticalAlign: 'middle' }}>
            (+{repeatedCount} rep)
          </span>
        )}
      </span>
      <span>{label}</span>
      <span className="admin-stat-size">{size}</span>
    </div>
  )
}

export default function AdminDashboard() {
  useCmsStore()
  const { confirm } = useModal()
  const toast = useToast()
  const [section, setSection] = useState('resumen')
  const [subOpen, setSubOpen] = useState(false)
  const [ajustesOpen, setAjustesOpen] = useState(false)
  const [modal, setModal] = useState<AdminModal | null>(null)
  const [uploadFiles, setUploadFiles] = useState<File[]>([])

  // loadState emite → useCmsStore re-renderiza; el render deriva de state.loaded
  useEffect(() => {
    if (!state.loaded) loadState()
    // verificación real contra la sesión server (cookie httpOnly) — el flag
    // de localStorage es solo un hint de pintado.
    getAccount().then((account) => setAdminFlag(!!account, account?.username))
    // Sincronizar estado compartido desde el server (usedContent, unused,
    // retired, etc.) para reflejar cambios de otros dispositivos/usuarios.
    loadServerState().then(() => {
      cleanOrphanOverrides()
      if (state.isAdmin) {
        autoCleanTrash()
        seedUsedContent()
        resolveSizes([...Object.values(state.usedContent), ...state.unused])
        // Crear estructura de carpetas vacías en Cloudinary (idempotente)
        scaffoldCloudinaryFolders()
        // Sincronizar carpetas de Cloudinary (mover archivos a sus carpetas correctas)
        syncCloudinaryFolders()
        // Validar que los contenidos sigan existiendo en Cloudinary (async, background)
        validateCloudinaryContent().then((purged) => {
          if (purged > 0) {
            toast(`Removed ${purged} item(s) that no longer exist in Cloudinary`, 'error')
          }
        })
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const goto = (s: string) => {
    setSection(s)
    if (s.startsWith('contenidos-') || s === 'subircontenido') {
      setSubOpen(true)
      setAjustesOpen(false)
    } else if (s === 'ajustes' || s.startsWith('ajustes-')) {
      setAjustesOpen(true)
      setSubOpen(false)
      if (s.startsWith('ajustes-')) {
        setTimeout(() => {
          const el = document.getElementById(s)
          if (el) {
            const y = el.getBoundingClientRect().top + window.scrollY - 90
            window.scrollTo({ top: y, behavior: 'smooth' })
          }
        }, 50)
      } else if (s === 'ajustes') {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    } else {
      setSubOpen(false)
      setAjustesOpen(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const isContenidos = section.startsWith('contenidos-') || section === 'subircontenido'
  const isAjustes = section === 'ajustes' || section.startsWith('ajustes-')

  useEffect(() => {
    if (!isAjustes) return
    const ids = ['ajustes-loader', 'ajustes-favicon', 'ajustes-social', 'ajustes-cv', 'ajustes-traducciones']
    
    const handleMouseOver = (e: MouseEvent) => {
      let el = e.target as HTMLElement | null
      while (el && el !== document.body) {
        if (el.id && ids.includes(el.id)) {
          if (el.id !== section) setSection(el.id)
          break
        }
        el = el.parentElement
      }
    }

    document.addEventListener('mouseover', handleMouseOver)
    return () => document.removeEventListener('mouseover', handleMouseOver)
  }, [isAjustes, section])

  const usedArr: AnyEntry[] = Object.values(state.usedContent)
  const uniqueUsedArr = deduplicateMedia(usedArr)
  const repeatedUsedCount = usedArr.length - uniqueUsedArr.length
  const unusedArr: AnyEntry[] = state.unused.map((e, i) => ({ ...e, _idx: i }))
  const trashArr: AnyEntry[] = state.trash.map((e, i) => ({ ...e, _idx: i }))
  const repoArr = deduplicateMedia([...usedArr, ...unusedArr, ...trashArr])

  if (!state.loaded) return null
  if (!state.isAdmin) {
    return (
      <div className="admin-shell" style={{ display: 'block' }}>
        <main className="admin-root">
          <div className="admin-card admin-denied">
            <h2><i className="fa-solid fa-lock"></i> Access restricted</h2>
            <p>This page is only for the superadmin. Log in from the site.</p>
            <Link className="cms-btn cms-btn--primary" href="/">Go to site</Link>
          </div>
        </main>
      </div>
    )
  }



  const navBadge = (label: string, count: number, size: number) => (
    <span className="admin-nav-badge-label">
      {label} {count > 0 && (
        <span className="admin-nav-badge-stats">
          [ <span className="badge-count">{count}</span> / <span className="badge-size">{fmtBytes(size)}</span> ]
        </span>
      )}
    </span>
  )

  const uploadHist = loadJSON<{ secure_url: string; origType?: string; originalName?: string; ts: number; origSize?: number; final_bytes: number; final_format: string }[]>(LS.UPLOAD_TEST, [])

  return (
    <>
      <header className="admin-topbar">
        <Link href="/" className="logo" onClick={markSkipLoader}>Lucia Montaña <span className="highlight">| Management</span></Link>
        <div className="admin-topbar-right">
          <div className="admin-dropdown-wrapper">
            <span className="cms-user-chip" title={`Sesión iniciada como ${state.username || 'Administrador'}`}>
              <i className="fa-solid fa-user-shield"></i> {state.username || 'Administrador'} <i className="fa-solid fa-chevron-down" style={{ fontSize: '0.7em', marginLeft: '0.3rem' }}></i>
            </span>
            <div className="admin-dropdown-menu">
              <div className="admin-menu-header">Sesión actual: {state.username || 'Administrador'}</div>
              <Link 
                href="/" 
                className="cms-navauth-btn" 
                style={{ textDecoration: 'none', display: 'inline-block' }}
                onClick={markSkipLoader}
              >
                <i className="fa-solid fa-arrow-left"></i> Back to site
              </Link>
              <button type="button" className="cms-navauth-btn" title="Log out"
                onClick={() => { logout().finally(() => { setAdminFlag(false); toast('Logged out'); window.location.href = '/' }) }}>
                <i className="fa-solid fa-right-from-bracket"></i> Log out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="admin-shell">
        <aside className="admin-sidebar">
          <nav className="admin-nav">
            <button type="button" className={`admin-nav-item${section === 'resumen' ? ' active' : ''}`} onClick={() => goto('resumen')}>
              <i className="fa-solid fa-gauge-high"></i><span>Summary</span>
            </button>
            <button type="button" className={`admin-nav-item${section === 'usuarios' ? ' active' : ''}`} onClick={() => goto('usuarios')}>
              <i className="fa-solid fa-users-gear"></i><span>Manage users</span>
            </button>
            <div className="admin-nav-group">
              <button type="button" className={`admin-nav-item${isAjustes ? ' active' : ''}`} onClick={() => setAjustesOpen(!ajustesOpen)}>
                <i className="fa-solid fa-sliders"></i>
                <span>Site settings <i className="fa-solid fa-chevron-down" style={{ fontSize: '0.7em', marginLeft: 'auto', width: 'auto', transform: ajustesOpen ? 'rotate(180deg)' : undefined }}></i></span>
              </button>
              <div className={`admin-nav-sub${ajustesOpen ? ' open' : ''}`}>
                <button type="button" className={`admin-nav-item${section === 'ajustes-loader' ? ' active' : ''}`} onClick={() => goto('ajustes-loader')}>
                  <i className="fa-solid fa-spinner"></i><span>Loading screen</span>
                </button>
                <button type="button" className={`admin-nav-item${section === 'ajustes-favicon' ? ' active' : ''}`} onClick={() => goto('ajustes-favicon')}>
                  <i className="fa-solid fa-compass"></i><span>Tab icon</span>
                </button>
                <button type="button" className={`admin-nav-item${section === 'ajustes-social' ? ' active' : ''}`} onClick={() => goto('ajustes-social')}>
                  <i className="fa-solid fa-share-nodes"></i><span>Social media</span>
                </button>
                <button type="button" className={`admin-nav-item${section === 'ajustes-cv' ? ' active' : ''}`} onClick={() => goto('ajustes-cv')}>
                  <i className="fa-solid fa-file-pdf"></i><span>Curriculum Vitae (CV)</span>
                </button>
                <button type="button" className={`admin-nav-item${section === 'ajustes-traducciones' ? ' active' : ''}`} onClick={() => goto('ajustes-traducciones')}>
                  <i className="fa-solid fa-language"></i><span>Translations</span>
                </button>
              </div>
            </div>
            <div className="admin-nav-group">
              <button type="button" className={`admin-nav-item${isContenidos ? ' active' : ''}`} onClick={() => setSubOpen(!subOpen)}>
                <i className="fa-solid fa-photo-film"></i>
                <span>Content <i className="fa-solid fa-chevron-down" style={{ fontSize: '0.7em', marginLeft: 'auto', width: 'auto', transform: subOpen ? 'rotate(180deg)' : undefined }}></i></span>
              </button>
              <div className={`admin-nav-sub${subOpen ? ' open' : ''}`}>
                <button type="button" className={`admin-nav-item${section === 'contenidos-usado' ? ' active' : ''}`} onClick={() => goto('contenidos-usado')}>
                  <i className="fa-solid fa-check c-uso"></i>{navBadge('In use', uniqueUsedArr.length, sumSizes(uniqueUsedArr))}
                </button>
                <button type="button" className={`admin-nav-item${section === 'contenidos-nousado' ? ' active' : ''}`} onClick={() => goto('contenidos-nousado')}>
                  <i className="fa-solid fa-folder-closed c-nouso"></i>{navBadge('Unused', unusedArr.length, sumSizes(unusedArr))}
                </button>
                <button type="button" className={`admin-nav-item${section === 'contenidos-basurero' ? ' active' : ''}`} onClick={() => goto('contenidos-basurero')}>
                  <i className="fa-solid fa-trash-can c-basurero"></i>{navBadge('Trash', trashArr.length, sumSizes(trashArr))}
                </button>
                <button type="button" className={`admin-nav-item${section === 'contenidos-repo' ? ' active' : ''}`} onClick={() => goto('contenidos-repo')}>
                  <i className="fa-solid fa-cloud c-repo"></i>{navBadge('Repository', repoArr.length, sumSizes(repoArr))}
                </button>
                <button type="button" className={`admin-nav-item${section === 'subircontenido' ? ' active' : ''}`} onClick={() => goto('subircontenido')}>
                  <i className="fa-solid fa-cloud-arrow-up c-subir"></i><span>Upload content</span>
                </button>
              </div>
            </div>
            {NAV_BOTTOM.map((n) => (
              <button key={n.id} type="button" className={`admin-nav-item${section === n.id ? ' active' : ''}`} onClick={() => goto(n.id)}>
                <i className={`fa-solid ${n.icon}`}></i><span>{n.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="admin-root">
          {section === 'resumen' && (
            <div className="admin-card">
              <h2><i className="fa-solid fa-gauge-high"></i> Summary
                <span className="cms-info-tip" tabIndex={0} aria-label={RESUMEN_INFO}>
                  <i className="fa-solid fa-circle-info"></i>
                  <span className="cms-info-bubble" role="tooltip">{RESUMEN_INFO}</span>
                </span>
              </h2>
              <p className="cms-admin-sub">Site content management dashboard.</p>
              <div className="admin-stats">
                <Stat label="used items" count={uniqueUsedArr.length} size={fmtBytes(sumSizes(uniqueUsedArr))} repeatedCount={repeatedUsedCount} />
                <Stat label="unused items" count={unusedArr.length} size={fmtBytes(sumSizes(unusedArr))} />
                <Stat label="in trash" count={trashArr.length} size={fmtBytes(sumSizes(trashArr))} warn />
                <Stat label="total repository" count={repoArr.length} size={fmtBytes(sumSizes(repoArr))} />
              </div>
              <div className="admin-quick">
                <button type="button" className="cms-btn" onClick={() => goto('ajustes')}><i className="fa-solid fa-sliders"></i> Site settings</button>
                <button type="button" className="cms-btn" onClick={() => goto('contenidos-usado')}><i className="fa-solid fa-photo-film"></i> Manage content</button>
                <button type="button" className="cms-btn" onClick={() => goto('auditoria')}><i className="fa-solid fa-clipboard-list"></i> View audit</button>
              </div>
            </div>
          )}

          {section === 'contenidos-usado' && <SectionUsado usedArr={usedArr} unusedArr={unusedArr} trashArr={trashArr} openModal={setModal} />}
          {section === 'contenidos-nousado' && <SectionNoUsado usedArr={usedArr} unusedArr={unusedArr} trashArr={trashArr} openModal={setModal} />}
          {section === 'contenidos-basurero' && <SectionBasurero usedArr={usedArr} unusedArr={unusedArr} trashArr={trashArr} openModal={setModal} />}
          {section === 'contenidos-repo' && <SectionRepo usedArr={usedArr} unusedArr={unusedArr} trashArr={trashArr} openModal={setModal} />}

          {section === 'subircontenido' && (
            <div className="admin-card">
              <h2><i className="fa-solid fa-cloud-arrow-up"></i> Upload content</h2>
              <p className="cms-admin-sub">Upload an image or video directly to Cloudinary and get automatic AI optimization.</p>
              <div className="cms-upload" style={{ maxWidth: 800, margin: '2rem auto', border: '2px dashed var(--border)', padding: '3rem 1.5rem', borderRadius: 16, textAlign: 'center', background: 'var(--bg-secondary)' }}>
                <label className="cms-btn cms-btn--primary" style={{ display: 'inline-block', cursor: 'pointer', padding: '1rem 2rem', fontSize: '1.1rem', borderRadius: 12 }}>
                  <i className="fa-solid fa-file-arrow-up fa-xl" style={{ marginRight: '0.5rem' }}></i> Select file(s) from your PC
                  <input
                    type="file" multiple accept="image/*,video/*" style={{ display: 'none' }}
                    onChange={(e) => { const f = Array.from(e.target.files || []); e.target.value = ''; if (f.length > 0) setUploadFiles(f) }}
                  />
                </label>
              </div>
              {uploadHist.length > 0 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2rem' }}>
                    <h3 style={{ margin: 0 }}>Last 3 uploads</h3>
                    <button type="button" className="cms-btn cms-btn--sm" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => { saveJSON(LS.UPLOAD_TEST, []); emit(); }}>
                      Clear history
                    </button>
                  </div>
                  <div className="cms-mlib-grid" style={{ marginTop: '1rem' }}>
                    {uploadHist.slice(0, 3).map((h, i) => {
                      const entry = {
                        src: h.secure_url, dataUrl: h.secure_url, name: h.originalName || 'file',
                        size: h.final_bytes, type: h.origType || `image/${h.final_format}`,
                        ts: h.ts, label: h.originalName || '', section: '', reason: 'upload' as const,
                      } as AnyEntry
                      return (
                        <MediaCard
                          key={i} e={entry} cardType="repo" actions={[]}
                          tags={<span className="cms-tag cms-tag--subido">uploaded</span>}
                          onView={() => setModal({ kind: 'view', e: entry, cardType: 'repo', menu: [] })}
                        />
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {section === 'auditoria' && (
            <div className="admin-card">
              <div className="admin-card-head">
                <h2><i className="fa-solid fa-clipboard-list"></i> Change audit</h2>
                {state.audit.length > 0 && (
                  <button type="button" className="cms-btn cms-btn--sm"
                    onClick={() => confirm('Clear audit', 'Clear the audit log?', clearAudit)}>
                    Clear log
                  </button>
                )}
              </div>
              <p className="cms-admin-sub">{state.audit.length} change(s) logged. In production this will come from the DB via backend.</p>
              <div className="cms-audit-table-wrap">
                <table className="cms-audit-table">
                  <thead><tr><th>Date</th><th>User</th><th>Section</th><th>Container</th><th>Action</th><th>File</th></tr></thead>
                  <tbody>
                    {state.audit.length === 0 && <tr><td colSpan={6} className="cms-audit-empty">No changes logged.</td></tr>}
                    {state.audit.slice().reverse().map((a, i) => (
                      <tr key={i}>
                        <td>{fmtDate(a.ts)}</td><td>{a.user}</td><td>{a.section}</td><td>{a.label}</td><td>{a.summary}</td>
                        <td>{a.file ? `${a.file.name} (${fmtBytes(a.file.size)})` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {section === 'usuarios' && <UsersSection />}

          {isAjustes && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <SiteSettings />
            </div>
          )}
        </main>
      </div>

      {modal?.kind === 'view' && <ViewMediaModal e={modal.e} cardType={modal.cardType} menu={modal.menu} onClose={() => setModal(null)} />}
      {modal?.kind === 'rename' && <RenameContainerModal cmsKey={modal.key} onClose={() => setModal(null)} />}
      {modal?.kind === 'associate' && <AssociateContainerModal item={modal.item} isUnused={modal.isUnused} unusedIdx={modal.idx} onClose={() => setModal(null)} />}
      {modal?.kind === 'editInfo' && <AdminEditInfoModal cmsKey={modal.key} onClose={() => setModal(null)} />}
      {modal?.kind === 'selectContainerAction' && (
        <SelectContainerActionModal
          action={modal.action}
          occs={modal.occs}
          onSelect={(k) => {
            setModal(
              modal.action === 'editInfo'
                ? { kind: 'editInfo', key: k }
                : modal.action === 'rename'
                ? { kind: 'rename', key: k }
                : null
            )
          }}
          onClose={() => setModal(null)}
        />
      )}
      {uploadFiles.length > 0 && <AdminUploadModal files={uploadFiles} onClose={() => setUploadFiles([])} />}
    </>
  )
}

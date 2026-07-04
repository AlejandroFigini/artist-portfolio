'use client'

/* Panel de gestión — port de admin.html + admin.js: topbar, sidebar con
   sub-menú de Contenidos (badges con conteo/tamaño), y las secciones
   Resumen / Contenidos / Subir / Usuarios / Auditoría / Ajustes. */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useModal } from '@/components/ui/Modal'
import { fmtBytes, fmtDate } from '@/lib/utils'
import {
  state, useCmsStore, loadState, sumSizes, loadJSON, LS, setAdminFlag, loadServerState,
} from '@/lib/cms/store'
import { getAccount } from '@/lib/api'
import { autoCleanTrash, resolveSizes, clearAudit } from './actions'
import { SectionUsado, SectionNoUsado, SectionBasurero, SectionRepo, type AdminModal } from './ContentSections'
import { ViewMediaModal, RenameContainerModal, AssociateContainerModal, AdminEditInfoModal, AdminUploadModal } from './modals'
import SiteSettings, { LoaderSettings, FaviconSettings, CvSettings, TranslationSettings } from './SiteSettings'
import SocialSettings from './SocialSettings'
import UsersSection from './UsersSection'
import { MediaCard, type AnyEntry } from './cards'

const NAV_BOTTOM = [
  { id: 'auditoria', icon: 'fa-clipboard-list', label: 'Auditoría' },
]

const markSkipLoader = () => { try { sessionStorage.setItem('cms_skip_loader', '1') } catch {} }

const RESUMEN_INFO = 'Cada tarjeta muestra la cantidad de contenidos y su peso total: en uso (activos en el sitio), sin usar (retirados), basurero (marcados para eliminar) y el repositorio (todo el contenido sumado).'

function Stat({ label, count, size, warn }: { label: string; count: number; size: string; warn?: boolean }) {
  return (
    <div className={`admin-stat${warn ? ' admin-stat--warn' : ''}`}>
      <span className="admin-stat-num">{count}</span>
      <span>{label}</span>
      <span className="admin-stat-size">{size}</span>
    </div>
  )
}

export default function AdminDashboard() {
  useCmsStore()
  const { confirm } = useModal()
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
      if (state.isAdmin) {
        autoCleanTrash()
        resolveSizes([...Object.values(state.usedContent), ...state.unused])
      }
    })
  }, [])

  const usedArr: AnyEntry[] = Object.values(state.usedContent)
  const unusedArr: AnyEntry[] = state.unused.map((e, i) => ({ ...e, _idx: i }))
  const trashArr: AnyEntry[] = state.trash.map((e, i) => ({ ...e, _idx: i }))

  if (!state.loaded) return null
  if (!state.isAdmin) {
    return (
      <div className="admin-shell" style={{ display: 'block' }}>
        <main className="admin-root">
          <div className="admin-card admin-denied">
            <h2><i className="fa-solid fa-lock"></i> Acceso restringido</h2>
            <p>Esta página es solo para el superadmin. Iniciá sesión desde el sitio.</p>
            <Link className="cms-btn cms-btn--primary" href="/">Ir al sitio</Link>
          </div>
        </main>
      </div>
    )
  }

  const goto = (s: string) => {
    setSection(s)
    if (s.startsWith('contenidos-') || s === 'subircontenido') {
      setSubOpen(true)
      setAjustesOpen(false)
    } else if (s === 'ajustes' || s.startsWith('ajustes-')) {
      setAjustesOpen(true)
      setSubOpen(false)
    } else {
      setSubOpen(false)
      setAjustesOpen(false)
    }
  }
  const isContenidos = section.startsWith('contenidos-') || section === 'subircontenido'
  const isAjustes = section === 'ajustes' || section.startsWith('ajustes-')

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
        <Link href="/" className="logo" onClick={markSkipLoader}>Lucia Montaña <span className="highlight">| Gestión</span></Link>
        <div className="admin-topbar-right">
          <span className="cms-user-chip"><i className="fa-solid fa-user-shield"></i> {state.username || '…'}</span>
          <Link href="/" className="cms-btn cms-btn--sm" onClick={markSkipLoader}><i className="fa-solid fa-arrow-left"></i> Volver al sitio</Link>
        </div>
      </header>

      <div className="admin-shell">
        <aside className="admin-sidebar">
          <nav className="admin-nav">
            <button type="button" className={`admin-nav-item${section === 'resumen' ? ' active' : ''}`} onClick={() => goto('resumen')}>
              <i className="fa-solid fa-gauge-high"></i><span>Resumen</span>
            </button>
            <button type="button" className={`admin-nav-item${section === 'usuarios' ? ' active' : ''}`} onClick={() => goto('usuarios')}>
              <i className="fa-solid fa-users-gear"></i><span>Administrar usuarios</span>
            </button>
            <div className="admin-nav-group">
              <button type="button" className={`admin-nav-item${isAjustes ? ' active' : ''}`} onClick={() => { const next = !ajustesOpen; if (next) setSubOpen(false); if (next && !isAjustes) goto('ajustes-loader'); setAjustesOpen(next); }}>
                <i className="fa-solid fa-sliders"></i>
                <span>Ajustes del sitio <i className="fa-solid fa-chevron-down" style={{ fontSize: '0.7em', marginLeft: 'auto', width: 'auto', transform: ajustesOpen ? 'rotate(180deg)' : undefined }}></i></span>
              </button>
              <div className={`admin-nav-sub${ajustesOpen ? ' open' : ''}`}>
                <button type="button" className={`admin-nav-item${section === 'ajustes-loader' ? ' active' : ''}`} onClick={() => goto('ajustes-loader')}>
                  <i className="fa-solid fa-spinner"></i><span>Pantalla de carga</span>
                </button>
                <button type="button" className={`admin-nav-item${section === 'ajustes-favicon' ? ' active' : ''}`} onClick={() => goto('ajustes-favicon')}>
                  <i className="fa-solid fa-compass"></i><span>Icono de pestaña</span>
                </button>
                <button type="button" className={`admin-nav-item${section === 'ajustes-social' ? ' active' : ''}`} onClick={() => goto('ajustes-social')}>
                  <i className="fa-solid fa-share-nodes"></i><span>Redes sociales</span>
                </button>
                <button type="button" className={`admin-nav-item${section === 'ajustes-cv' ? ' active' : ''}`} onClick={() => goto('ajustes-cv')}>
                  <i className="fa-solid fa-file-pdf"></i><span>Curriculum (CV)</span>
                </button>
                <button type="button" className={`admin-nav-item${section === 'ajustes-traducciones' ? ' active' : ''}`} onClick={() => goto('ajustes-traducciones')}>
                  <i className="fa-solid fa-language"></i><span>Traducciones</span>
                </button>
              </div>
            </div>
            <div className="admin-nav-group">
              <button type="button" className={`admin-nav-item${isContenidos ? ' active' : ''}`} onClick={() => { const next = !subOpen; if (next) setAjustesOpen(false); setSubOpen(next); }}>
                <i className="fa-solid fa-photo-film"></i>
                <span>Contenidos <i className="fa-solid fa-chevron-down" style={{ fontSize: '0.7em', marginLeft: 'auto', width: 'auto', transform: subOpen ? 'rotate(180deg)' : undefined }}></i></span>
              </button>
              <div className={`admin-nav-sub${subOpen ? ' open' : ''}`}>
                <button type="button" className={`admin-nav-item${section === 'contenidos-usado' ? ' active' : ''}`} onClick={() => goto('contenidos-usado')}>
                  <i className="fa-solid fa-check c-uso"></i>{navBadge('En uso', usedArr.length, sumSizes(usedArr))}
                </button>
                <button type="button" className={`admin-nav-item${section === 'contenidos-nousado' ? ' active' : ''}`} onClick={() => goto('contenidos-nousado')}>
                  <i className="fa-solid fa-folder-closed c-nouso"></i>{navBadge('Sin usar', unusedArr.length, sumSizes(unusedArr))}
                </button>
                <button type="button" className={`admin-nav-item${section === 'contenidos-basurero' ? ' active' : ''}`} onClick={() => goto('contenidos-basurero')}>
                  <i className="fa-solid fa-trash-can c-basurero"></i>{navBadge('Basurero', trashArr.length, sumSizes(trashArr))}
                </button>
                <button type="button" className={`admin-nav-item${section === 'contenidos-repo' ? ' active' : ''}`} onClick={() => goto('contenidos-repo')}>
                  <i className="fa-solid fa-cloud c-repo"></i>{navBadge('Repositorio', usedArr.length + unusedArr.length + trashArr.length, sumSizes(usedArr) + sumSizes(unusedArr) + sumSizes(trashArr))}
                </button>
                <button type="button" className={`admin-nav-item${section === 'subircontenido' ? ' active' : ''}`} onClick={() => goto('subircontenido')}>
                  <i className="fa-solid fa-vial c-subir"></i><span>Subir contenido</span>
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
              <h2><i className="fa-solid fa-gauge-high"></i> Resumen
                <span className="cms-info-tip" tabIndex={0} aria-label={RESUMEN_INFO}>
                  <i className="fa-solid fa-circle-info"></i>
                  <span className="cms-info-bubble" role="tooltip">{RESUMEN_INFO}</span>
                </span>
              </h2>
              <p className="cms-admin-sub">Panel de gestión del contenido del sitio.</p>
              <div className="admin-stats">
                <Stat label="contenidos usados" count={usedArr.length} size={fmtBytes(sumSizes(usedArr))} />
                <Stat label="contenidos no usados" count={unusedArr.length} size={fmtBytes(sumSizes(unusedArr))} />
                <Stat label="en el basurero" count={trashArr.length} size={fmtBytes(sumSizes(trashArr))} warn />
                <Stat label="repositorio total" count={usedArr.length + unusedArr.length + trashArr.length} size={fmtBytes(sumSizes(usedArr) + sumSizes(unusedArr) + sumSizes(trashArr))} />
              </div>
              <div className="admin-quick">
                <button type="button" className="cms-btn" onClick={() => goto('ajustes')}><i className="fa-solid fa-sliders"></i> Ajustes del sitio</button>
                <button type="button" className="cms-btn" onClick={() => goto('contenidos-usado')}><i className="fa-solid fa-photo-film"></i> Gestionar contenidos</button>
                <button type="button" className="cms-btn" onClick={() => goto('auditoria')}><i className="fa-solid fa-clipboard-list"></i> Ver auditoría</button>
              </div>
            </div>
          )}

          {section === 'contenidos-usado' && <SectionUsado usedArr={usedArr} unusedArr={unusedArr} trashArr={trashArr} openModal={setModal} />}
          {section === 'contenidos-nousado' && <SectionNoUsado usedArr={usedArr} unusedArr={unusedArr} trashArr={trashArr} openModal={setModal} />}
          {section === 'contenidos-basurero' && <SectionBasurero usedArr={usedArr} unusedArr={unusedArr} trashArr={trashArr} openModal={setModal} />}
          {section === 'contenidos-repo' && <SectionRepo usedArr={usedArr} unusedArr={unusedArr} trashArr={trashArr} openModal={setModal} />}

          {section === 'subircontenido' && (
            <div className="admin-card">
              <h2><i className="fa-solid fa-vial"></i> Subir contenido</h2>
              <p className="cms-admin-sub">Sube una imagen o video a Cloudinary de manera directa y obtén su optimización automática con IA.</p>
              <div className="cms-upload" style={{ maxWidth: 800, margin: '2rem auto', border: '2px dashed var(--border)', padding: '3rem 1.5rem', borderRadius: 16, textAlign: 'center', background: 'var(--bg-secondary)' }}>
                <label className="cms-btn cms-btn--primary" style={{ display: 'inline-block', cursor: 'pointer', padding: '1rem 2rem', fontSize: '1.1rem', borderRadius: 12 }}>
                  <i className="fa-solid fa-file-arrow-up fa-xl" style={{ marginRight: '0.5rem' }}></i> Seleccionar archivo(s) de tu PC
                  <input
                    type="file" multiple accept="image/*,video/*" style={{ display: 'none' }}
                    onChange={(e) => { const f = Array.from(e.target.files || []); e.target.value = ''; if (f.length > 0) setUploadFiles(f) }}
                  />
                </label>
              </div>
              {uploadHist.length > 0 && (
                <>
                  <h3 style={{ marginTop: '2rem' }}>Últimas 3 subidas</h3>
                  <div className="cms-mlib-grid" style={{ marginTop: '1rem' }}>
                    {uploadHist.slice(0, 3).map((h, i) => {
                      const entry = {
                        src: h.secure_url, dataUrl: h.secure_url, name: h.originalName || 'archivo',
                        size: h.final_bytes, type: h.origType || `image/${h.final_format}`,
                        ts: h.ts, label: h.originalName || '', section: '', reason: 'upload' as const,
                      } as AnyEntry
                      return (
                        <MediaCard
                          key={i} e={entry} cardType="repo" actions={[]}
                          tags={<span className="cms-tag cms-tag--subido">subido</span>}
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
                <h2><i className="fa-solid fa-clipboard-list"></i> Auditoría de cambios</h2>
                {state.audit.length > 0 && (
                  <button type="button" className="cms-btn cms-btn--sm"
                    onClick={() => confirm('Vaciar auditoría', '¿Vaciar el registro de auditoría?', clearAudit)}>
                    Vaciar registro
                  </button>
                )}
              </div>
              <p className="cms-admin-sub">{state.audit.length} cambio(s) registrado(s). En producción vendrá de la BD vía el backend.</p>
              <div className="cms-audit-table-wrap">
                <table className="cms-audit-table">
                  <thead><tr><th>Fecha</th><th>Usuario</th><th>Sección</th><th>Contenedor</th><th>Acción</th><th>Archivo</th></tr></thead>
                  <tbody>
                    {state.audit.length === 0 && <tr><td colSpan={6} className="cms-audit-empty">Sin cambios registrados.</td></tr>}
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

          {section === 'ajustes' && <SiteSettings />}
          {section === 'ajustes-loader' && <LoaderSettings />}
          {section === 'ajustes-favicon' && <FaviconSettings />}
          {section === 'ajustes-social' && <SocialSettings />}
          {section === 'ajustes-cv' && <CvSettings />}
          {section === 'ajustes-traducciones' && <TranslationSettings />}
        </main>
      </div>

      {modal?.kind === 'view' && <ViewMediaModal e={modal.e} cardType={modal.cardType} menu={modal.menu} onClose={() => setModal(null)} />}
      {modal?.kind === 'rename' && <RenameContainerModal cmsKey={modal.key} onClose={() => setModal(null)} />}
      {modal?.kind === 'associate' && <AssociateContainerModal item={modal.item} isUnused={modal.isUnused} unusedIdx={modal.idx} onClose={() => setModal(null)} />}
      {modal?.kind === 'editInfo' && <AdminEditInfoModal cmsKey={modal.key} onClose={() => setModal(null)} />}
      {uploadFiles.length > 0 && <AdminUploadModal files={uploadFiles} onClose={() => setUploadFiles([])} />}
    </>
  )
}

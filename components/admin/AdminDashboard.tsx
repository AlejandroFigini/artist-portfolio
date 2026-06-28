'use client'

/* Panel de gestión — port de admin.html + admin.js: topbar, sidebar con
   sub-menú de Contenidos (badges con conteo/tamaño), y las secciones
   Resumen / Contenidos / Subir / Usuarios / Auditoría / Ajustes. */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useModal } from '@/components/ui/Modal'
import { fmtBytes, fmtDate } from '@/lib/utils'
import {
  state, useCmsStore, loadState, sumSizes, loadJSON, LS,
} from '@/lib/cms/store'
import { autoCleanTrash, resolveSizes, clearAudit } from './actions'
import { SectionUsado, SectionNoUsado, SectionBasurero, SectionRepo, type AdminModal } from './ContentSections'
import { ViewMediaModal, RenameContainerModal, AssociateContainerModal, AdminEditInfoModal, AdminUploadModal } from './modals'
import SocialSettings from './SocialSettings'
import type { AnyEntry } from './cards'

const NAV_MAIN = [
  { id: 'resumen', icon: 'fa-gauge-high', label: 'Resumen' },
  { id: 'redes', icon: 'fa-share-nodes', label: 'Redes sociales' },
  { id: 'usuarios', icon: 'fa-users-gear', label: 'Usuarios' },
  { id: 'auditoria', icon: 'fa-clipboard-list', label: 'Auditoría' },
  { id: 'ajustes', icon: 'fa-sliders', label: 'Ajustes del sitio' },
]

const markSkipLoader = () => { try { sessionStorage.setItem('cms_skip_loader', '1') } catch {} }

function Stat({ num, label, warn }: { num: React.ReactNode; label: string; warn?: boolean }) {
  return (
    <div className={`admin-stat${warn ? ' admin-stat--warn' : ''}`}>
      <span className="admin-stat-num">{num}</span><span>{label}</span>
    </div>
  )
}

function MockToggle({ label, on }: { label: string; on?: boolean }) {
  return (
    <div className="setting-item admin-mock-setting">
      <span>{label}</span>
      <label className="switch"><input type="checkbox" disabled defaultChecked={on} /><span className="slider round"></span></label>
    </div>
  )
}

export default function AdminDashboard() {
  useCmsStore()
  const { confirm } = useModal()
  const [section, setSection] = useState('resumen')
  const [subOpen, setSubOpen] = useState(false)
  const [modal, setModal] = useState<AdminModal | null>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)

  // loadState emite → useCmsStore re-renderiza; el render deriva de state.loaded
  useEffect(() => {
    if (!state.loaded) loadState()
    if (state.isAdmin) {
      autoCleanTrash()
      resolveSizes([...Object.values(state.usedContent), ...state.unused])
    }
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

  const goto = (s: string) => { setSection(s); if (!s.startsWith('contenidos-') && s !== 'subircontenido') setSubOpen(false) }
  const isContenidos = section.startsWith('contenidos-') || section === 'subircontenido'

  const navBadge = (label: string, size: number) => (
    <span className="admin-nav-badge-label">
      {label} <span className="admin-nav-badge-stats">[ <span className="badge-size">{fmtBytes(size)}</span> ]</span>
    </span>
  )

  const uploadHist = loadJSON<{ secure_url: string; origType?: string; originalName?: string; ts: number; origSize?: number; final_bytes: number; final_format: string }[]>(LS.UPLOAD_TEST, [])

  return (
    <>
      <header className="admin-topbar">
        <Link href="/" className="logo" onClick={markSkipLoader}>Lucia Montaña <span className="highlight">| Gestión</span></Link>
        <div className="admin-topbar-right">
          <span className="cms-user-chip"><i className="fa-solid fa-user-shield"></i> superadmin</span>
          <Link href="/" className="cms-btn cms-btn--sm" onClick={markSkipLoader}><i className="fa-solid fa-arrow-left"></i> Volver al sitio</Link>
        </div>
      </header>

      <div className="admin-shell">
        <aside className="admin-sidebar">
          <nav className="admin-nav">
            <button type="button" className={`admin-nav-item${section === 'resumen' ? ' active' : ''}`} onClick={() => goto('resumen')}>
              <i className="fa-solid fa-gauge-high"></i><span>Resumen</span>
            </button>
            <div className="admin-nav-group">
              <button type="button" className={`admin-nav-item${isContenidos ? ' active' : ''}`} onClick={() => setSubOpen((o) => !o)}>
                <i className="fa-solid fa-photo-film"></i>
                <span>Contenidos <i className="fa-solid fa-chevron-down" style={{ fontSize: '0.7em', marginLeft: 'auto', width: 'auto', transform: subOpen || isContenidos ? 'rotate(180deg)' : undefined }}></i></span>
              </button>
              <div className={`admin-nav-sub${subOpen || isContenidos ? ' open' : ''}`}>
                <button type="button" className={`admin-nav-item${section === 'contenidos-usado' ? ' active' : ''}`} onClick={() => goto('contenidos-usado')}>
                  <i className="fa-solid fa-check c-uso"></i>{navBadge('En uso', sumSizes(usedArr))}
                </button>
                <button type="button" className={`admin-nav-item${section === 'contenidos-nousado' ? ' active' : ''}`} onClick={() => goto('contenidos-nousado')}>
                  <i className="fa-solid fa-folder-closed c-nouso"></i>{navBadge('Sin usar', sumSizes(unusedArr))}
                </button>
                <button type="button" className={`admin-nav-item${section === 'contenidos-basurero' ? ' active' : ''}`} onClick={() => goto('contenidos-basurero')}>
                  <i className="fa-solid fa-trash-can c-basurero"></i>{navBadge('Basurero', sumSizes(trashArr))}
                </button>
                <button type="button" className={`admin-nav-item${section === 'contenidos-repo' ? ' active' : ''}`} onClick={() => goto('contenidos-repo')}>
                  <i className="fa-solid fa-cloud c-repo"></i>{navBadge('Repositorio', sumSizes(usedArr) + sumSizes(unusedArr) + sumSizes(trashArr))}
                </button>
                <button type="button" className={`admin-nav-item${section === 'subircontenido' ? ' active' : ''}`} onClick={() => goto('subircontenido')}>
                  <i className="fa-solid fa-vial c-subir"></i><span>Subir contenido</span>
                </button>
              </div>
            </div>
            {NAV_MAIN.slice(1).map((n) => (
              <button key={n.id} type="button" className={`admin-nav-item${section === n.id ? ' active' : ''}`} onClick={() => goto(n.id)}>
                <i className={`fa-solid ${n.icon}`}></i><span>{n.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="admin-root">
          {section === 'resumen' && (
            <div className="admin-card">
              <h2><i className="fa-solid fa-gauge-high"></i> Resumen</h2>
              <p className="cms-admin-sub">Panel de gestión del contenido del sitio.</p>
              <div className="admin-stats">
                <Stat num={usedArr.length} label="contenidos usados" />
                <Stat num={fmtBytes(sumSizes(usedArr))} label="espacio usado" />
                <Stat num={unusedArr.length} label="contenidos no usados" />
                <Stat num={fmtBytes(sumSizes(unusedArr))} label="espacio liberable" warn />
              </div>
              <div className="admin-quick">
                <button type="button" className="cms-btn" onClick={() => goto('contenidos-usado')}><i className="fa-solid fa-photo-film"></i> Gestionar contenidos</button>
                <button type="button" className="cms-btn" onClick={() => goto('auditoria')}><i className="fa-solid fa-clipboard-list"></i> Ver auditoría</button>
              </div>
            </div>
          )}

          {section === 'redes' && <SocialSettings />}

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
                  <i className="fa-solid fa-file-arrow-up fa-xl" style={{ marginRight: '0.5rem' }}></i> Seleccionar archivo de tu PC
                  <input
                    type="file" accept="image/*,video/*" style={{ display: 'none' }}
                    onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setUploadFile(f) }}
                  />
                </label>
              </div>
              {uploadHist.length > 0 && (
                <>
                  <h3 style={{ marginTop: '2rem' }}>Últimas 3 subidas</h3>
                  <div className="cms-mlib-grid" style={{ marginTop: '1rem' }}>
                    {uploadHist.map((h, i) => (
                      <div className="cms-mlib-item" key={i}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={h.secure_url} alt="" loading="lazy" style={{ objectFit: 'cover' }} />
                        <div className="cms-mlib-info">
                          <div className="cms-mlib-label">Subida {fmtDate(h.ts)}</div>
                          <div className="cms-mlib-meta" style={{ fontSize: '0.75rem' }}>
                            Original: {fmtBytes(h.origSize)}<br />
                            Final: <strong style={{ color: 'var(--c-uso)' }}>{fmtBytes(h.final_bytes)}</strong> ({h.final_format})
                          </div>
                        </div>
                      </div>
                    ))}
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

          {section === 'usuarios' && (
            <div className="admin-card">
              <div className="admin-card-head">
                <h2><i className="fa-solid fa-users-gear"></i> Gestión de usuarios</h2>
                <div className="admin-card-head-actions">
                  <button type="button" className="cms-btn cms-btn--sm cms-btn--primary" disabled title="Próximamente"><i className="fa-solid fa-plus"></i> Alta</button>
                  <button type="button" className="cms-btn cms-btn--sm" disabled title="Próximamente"><i className="fa-solid fa-pen"></i> Modificar</button>
                  <button type="button" className="cms-btn cms-btn--sm" disabled title="Próximamente"><i className="fa-solid fa-user-minus"></i> Baja</button>
                </div>
              </div>
              <p className="cms-admin-sub"><i className="fa-solid fa-circle-info"></i> Distribución preparada. Alta / baja / modificación de usuarios y roles se implementarán con el backend.</p>
              <div className="cms-audit-table-wrap">
                <table className="cms-audit-table">
                  <thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead>
                  <tbody>
                    {[
                      { u: 'superadmin', rol: 'Administrador', estado: 'Activo' },
                      { u: 'editor', rol: 'Editor de contenido', estado: 'Invitado' },
                    ].map((r) => (
                      <tr key={r.u}>
                        <td>{r.u}</td><td>{r.rol}</td>
                        <td><span className="cms-tag">{r.estado}</span></td>
                        <td className="admin-row-actions">
                          <button type="button" className="icon-btn" disabled title="Próximamente"><i className="fa-solid fa-pen"></i></button>
                          <button type="button" className="icon-btn" disabled title="Próximamente"><i className="fa-solid fa-trash"></i></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <span className="admin-soon">Próximamente</span>
            </div>
          )}

          {section === 'ajustes' && (
            <>
              <div className="admin-card">
                <div className="admin-card-head">
                  <h2><i className="fa-solid fa-sliders"></i> Ajustes del sitio</h2>
                  <span className="admin-soon">Próximamente</span>
                </div>
                <p className="cms-admin-sub"><i className="fa-solid fa-circle-info"></i> Distribución preparada para futuras opciones globales del sitio.</p>
                <MockToggle label="Idioma por defecto: Español" on />
                <MockToggle label="Modo mantenimiento" />
                <MockToggle label="Mostrar enlaces a redes en el pie" on />
                <MockToggle label="Permitir descargas del CV" on />
              </div>
              <div className="admin-card">
                <div className="admin-card-head">
                  <h2><i className="fa-solid fa-shield-halved"></i> Seguridad y backend</h2>
                  <span className="admin-soon">Próximamente</span>
                </div>
                <p className="cms-admin-sub">Conexión con la API, hash de contraseñas, control de sesiones y respaldos.</p>
              </div>
            </>
          )}
        </main>
      </div>

      {modal?.kind === 'view' && <ViewMediaModal e={modal.e} cardType={modal.cardType} menu={modal.menu} onClose={() => setModal(null)} />}
      {modal?.kind === 'rename' && <RenameContainerModal cmsKey={modal.key} onClose={() => setModal(null)} />}
      {modal?.kind === 'associate' && <AssociateContainerModal item={modal.item} isUnused={modal.isUnused} unusedIdx={modal.idx} onClose={() => setModal(null)} />}
      {modal?.kind === 'editInfo' && <AdminEditInfoModal cmsKey={modal.key} onClose={() => setModal(null)} />}
      {uploadFile && <AdminUploadModal file={uploadFile} onClose={() => setUploadFile(null)} />}
    </>
  )
}

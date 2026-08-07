'use client'

/* Orquestador del CMS en el sitio — port del init() + setAdmin() +
   renderAuth() de cms.js. Inicializa el motor DOM, trae el contenido
   del Express (fuente de verdad) y despacha los modales React vía
   CommandContext. Montar solo en el index (igual que cms.js legacy). */

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { CommandContext, type Command } from '@/lib/commands'
import { useToast } from '@/components/ui/Toast'
import { getContent, getTranslations, getAccount, logout } from '@/lib/api'
import { validateFile } from '@/lib/media'
import { state, loadState, useCmsStore, setAdminFlag, emit, loadLang, loadServerState, cleanOrphanOverrides } from '@/lib/cms/store'
import { COLLECTIONS } from '@/lib/cms/collections'
import { markLoaderGate } from '@/lib/loader-ready'
import * as engine from './engine'
import dynamic from 'next/dynamic'

/* Modales y gestores: code-split (next/dynamic) — solo se descargan al
   abrirse (cmd), no viajan en el bundle inicial del home del visitante. */
const LoginModal = dynamic(() => import('./LoginModal'), { ssr: false })
const UploadModal = dynamic(() => import('./UploadModal'), { ssr: false })
const CollectionManager = dynamic(() => import('./CollectionManager'), { ssr: false })
const AuditOverlay = dynamic(() => import('./AuditOverlay'), { ssr: false })
const ContentPickerModal = dynamic(() => import('./PickerModals').then((m) => m.ContentPickerModal), { ssr: false })
const RepoPickerModal = dynamic(() => import('./PickerModals').then((m) => m.RepoPickerModal), { ssr: false })
const EditTextModal = dynamic(() => import('./TextModals').then((m) => m.EditTextModal), { ssr: false })
const EditInfoModal = dynamic(() => import('./TextModals').then((m) => m.EditInfoModal), { ssr: false })
const ConfirmMoveModal = dynamic(() => import('./TextModals').then((m) => m.ConfirmMoveModal), { ssr: false })
const ExportModal = dynamic(() => import('./TextModals').then((m) => m.ExportModal), { ssr: false })
const ForceSetupView = dynamic(() => import('../admin/ForceSetupView'), { ssr: false })

export default function CmsRoot() {
  const toast = useToast()
  useCmsStore()
  const pathname = usePathname()
  const [cmd, setCmd] = useState<Command | null>(null)
  const [managerCmd, setManagerCmd] = useState<Command | null>(null)
  const [uploadFile, setUploadFile] = useState<{ key: string; file: File } | null>(null)
  // host del portal del botón de sesión: se resuelve post-mount para apuntar
  // al nodo definitivo del DOM (patrón estándar de portales)
  const [authHost, setAuthHost] = useState<HTMLElement | null>(null)
  // En táctil no hay :hover: el menú de sesión se abre por tap sobre el chip.
  const [authMenuOpen, setAuthMenuOpen] = useState(false)
  const serverReady = state.serverReady
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingKeyRef = useRef<string>('')

  const dispatch = useCallback((c: Command) => {
    if (c.type === 'editMedia') {
      // input nativo: requiere gesto de usuario sincrónico (port editMedia)
      const meta = engine.metaByKey[c.key]
      if (!meta || !fileInputRef.current) return
      pendingKeyRef.current = c.key
      fileInputRef.current.accept = meta.kind === 'video' ? 'video/*' : 'image/*'
      fileInputRef.current.click()
      return
    }
    if (c.type === 'collectionManager') {
      setManagerCmd(c)
    } else {
      setCmd(c)
    }
  }, [])

  // Modo admin: overlay de edición + slots (port setAdmin)
  const setAdmin = useCallback((on: boolean, username?: string, role?: string, needsSetup?: boolean) => {
    setAdminFlag(on, username, role, needsSetup)
    document.body.classList.toggle('is-admin', on)
    if (on && !needsSetup) {
      engine.indexEditables()
      engine.seedUsedContent()
      engine.attachEditControls()
    } else {
      engine.removeEditControls()
    }
    engine.refreshRetired()
  }, [])

  // Re-index and hydrate when path changes (essential for multi-page support in Next.js client-side navigation)
  useEffect(() => {
    if (!state.loaded) return

    // Clear element cache for elements that are no longer in the document
    Object.keys(engine.elementsByKey).forEach((k) => {
      const el = engine.elementsByKey[k]
      if (el && !document.contains(el)) {
        delete engine.elementsByKey[k]
      }
    })

    engine.indexEditables()
    engine.hydrate()
    engine.refreshRetired()

    if (state.isAdmin && !state.needsSetup) {
      engine.attachEditControls()
    }

    // La ruta nueva trae contenedores que el idioma activo todavía no tocó:
    // memorizar su texto base y reaplicar el idioma sobre el DOM recién montado.
    engine.captureTextDefaults()
    engine.setLanguage(state.lang)
  }, [pathname])

  // ----- Init (port de cms.js init()) ----------------------------------------
  useEffect(() => {
    engine.setDispatch(dispatch)
    loadState()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza con el DOM real (portal host), no estado derivable
    setAuthHost(document.getElementById('cms-auth-nav'))
    engine.indexEditables()
    engine.refreshRetired()

    // First fetch overrides (content) – this may be stale, se valida al mergear el server state
    getContent()
      .catch(() => ({}))
      .then((serverItems) => {
        state.items = serverItems
        engine.hydrate()
        engine.refreshRetired()
        emit()

        // Load full server state (usedContent, etc.)
        loadServerState().then(() => {
          cleanOrphanOverrides()
          engine.refreshRetired()
          engine.seedUsedContent()
          state.serverReady = true
          emit()
        })

        // Session & i18n handling (unchanged)
        getAccount().then((account) => setAdmin(!!account, account?.username, account?.role, account?.needsSetup))
        getTranslations()
          .then((tr) => {
            state.translations = tr
            const lang = loadLang()
            engine.setLanguage(lang)
          })
          .catch(() => {})
          // Gate del loader: sin esto el sitio aparece en inglés y salta al
          // idioma guardado un instante después.
          .finally(() => markLoaderGate('i18n'))
      })

    const t = setTimeout(() => engine.rescan(), 300)

    const onCarouselCmd = (e: Event) => {
      const prefix = (e as CustomEvent).detail?.prefix || 'hero'
      dispatch({ type: 'collectionManager', key: prefix })
    }
    const onProjectsCmd = () => { dispatch({ type: 'collectionManager', key: 'proj' }) }
    const onCharactersCmd = () => { dispatch({ type: 'collectionManager', key: 'char' }) }
    window.addEventListener('cms:carouselManager', onCarouselCmd)
    window.addEventListener('cms:projectsManager', onProjectsCmd)
    window.addEventListener('cms:charactersManager', onCharactersCmd)

    return () => {
      clearTimeout(t)
      window.removeEventListener('cms:carouselManager', onCarouselCmd)
      window.removeEventListener('cms:projectsManager', onProjectsCmd)
      window.removeEventListener('cms:charactersManager', onCharactersCmd)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // El menú de sesión abierto por tap se cierra igual que los del nav.
  useEffect(() => {
    if (!authMenuOpen) return
    const onClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.admin-dropdown-wrapper')) setAuthMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAuthMenuOpen(false) }
    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [authMenuOpen])

  const close = useCallback(() => {
    setCmd((prev) => (prev !== null ? null : prev))
  }, [])

  return (
    <CommandContext.Provider value={dispatch}>
      {/* Sólo renderizamos el UI principal de admin una vez que el estado del servidor está listo */}
      {serverReady && (
        <>
          {/* botón de sesión en la navbar (port renderAuth) */}
          {authHost && createPortal(
            state.isAdmin ? (
              <div className={`admin-dropdown-wrapper${authMenuOpen ? ' is-open' : ''}`}>
                <button
                  type="button"
                  className="cms-user-chip"
                  title={`Signed in as ${state.username || 'Administrator'}`}
                  aria-expanded={authMenuOpen}
                  onClick={(e) => { e.stopPropagation(); setAuthMenuOpen((o) => !o) }}
                >
                  <i className="fa-solid fa-user-shield"></i>
                  <span className="cms-user-name">{state.username || 'Administrator'}</span>
                  <i className="fa-solid fa-chevron-down" style={{ fontSize: '0.7em', marginLeft: '0.3rem' }}></i>
                </button>
                <div className="admin-dropdown-menu">
                  <div className="admin-menu-header">Current session: {state.username || 'Administrator'}</div>
                  <a
                    href="/admin"
                    className="cms-navauth-btn"
                    style={{ textDecoration: 'none', display: 'inline-block' }}
                    onClick={() => { try { sessionStorage.setItem('cms_skip_loader', '1') } catch {} }}
                  >
                    <i className="fa-solid fa-sliders"></i> Management
                  </a>
                  <button type="button" className="cms-navauth-btn" title="Log out" data-cms-auth="logout"
                    onClick={() => { setAuthMenuOpen(false); logout().finally(() => { setAdmin(false); toast('Logged out') }) }}>
                    <i className="fa-solid fa-right-from-bracket"></i> Log out
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="login-min-btn" data-cms-auth="login" onClick={() => setCmd({ type: 'login' })}>
                <i className="fa-solid fa-right-to-bracket"></i>
                <span>Log in</span>
              </button>
            ),
            authHost,
          )}

          {state.needsSetup && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 9999999, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '100%', maxWidth: 500, margin: '1rem' }}>
                <ForceSetupView />
              </div>
            </div>
          )}

          {/* input de archivo para "Subir desde tu PC" (gesto sincrónico) */}
          <input
            ref={fileInputRef} type="file" style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              const key = pendingKeyRef.current
              const meta = engine.metaByKey[key]
              const err = validateFile(f, meta?.accept)
              if (err) { toast(err, 'error'); return }
              close()
              setUploadFile({ key, file: f })
            }}
          />

          {managerCmd?.type === 'collectionManager' && COLLECTIONS[managerCmd.key || 'hero'] && (
            <CollectionManager
              show={true}
              spec={COLLECTIONS[managerCmd.key || 'hero']}
              onClose={() => { setManagerCmd(null); close(); }}
              onPickImage={(key) => { engine.ensureCollectionMeta(key); dispatch({ type: 'contentPicker', key }) }}
              onEditInfo={(key) => { engine.ensureCollectionMeta(key); dispatch({ type: 'editInfo', key }) }}
            />
          )}

          {cmd?.type === 'login' && (
            <LoginModal onClose={close} onSuccess={(username, role, needsSetup) => setAdmin(true, username, role, needsSetup)} />
          )}
          {cmd?.type === 'editText' && <EditTextModal cmsKey={cmd.key} onClose={close} />}
          {cmd?.type === 'editInfo' && <EditInfoModal cmsKey={cmd.key} onClose={close} />}
          {cmd?.type === 'confirmMove' && <ConfirmMoveModal cmsKey={cmd.key} onClose={close} />}
          {cmd?.type === 'export' && <ExportModal onClose={close} />}
          {cmd?.type === 'contentPicker' && (
            <ContentPickerModal
              cmsKey={cmd.key}
              onClose={close}
              onLocal={() => dispatch({ type: 'editMedia', key: cmd.key })}
              onRepo={() => dispatch({ type: 'repoPicker', key: cmd.key })}
            />
          )}
          {cmd?.type === 'repoPicker' && (
            <RepoPickerModal
              cmsKey={cmd.key}
              onClose={close}
              onSuccess={() => {
                const k = cmd.key
                setCmd(null)
                const meta = engine.metaByKey[k]
                if (k.startsWith('hero.marquee#') || (meta && meta.fields && meta.fields.length > 0)) {
                  setTimeout(() => dispatch({ type: 'editInfo', key: k }), 50)
                }
              }}
            />
          )}
          {cmd?.type === 'auditPage' && <AuditOverlay onClose={close} />}

          {uploadFile && (
            <UploadModal
              cmsKey={uploadFile.key}
              file={uploadFile.file}
              onClose={() => setUploadFile(null)}
            />
          )}
        </>
      )}
    </CommandContext.Provider>
  )
}

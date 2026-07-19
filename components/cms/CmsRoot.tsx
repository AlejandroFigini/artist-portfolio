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
import { state, loadState, useCmsStore, setAdminFlag, emit, loadJSON, saveJSON, loadLang, loadServerState, cleanOrphanOverrides, LS } from '@/lib/cms/store'
import * as engine from './engine'
import dynamic from 'next/dynamic'

/* Modales y gestores: code-split (next/dynamic) — solo se descargan al
   abrirse (cmd), no viajan en el bundle inicial del home del visitante. */
const LoginModal = dynamic(() => import('./LoginModal'), { ssr: false })
const UploadModal = dynamic(() => import('./UploadModal'), { ssr: false })
const CarouselManager = dynamic(() => import('./CarouselManager'), { ssr: false })
const ProjectsManager = dynamic(() => import('./ProjectsManager'), { ssr: false })
const CharactersManager = dynamic(() => import('./CharactersManager'), { ssr: false })
const AuditOverlay = dynamic(() => import('./AuditOverlay'), { ssr: false })
const ContentPickerModal = dynamic(() => import('./PickerModals').then((m) => m.ContentPickerModal), { ssr: false })
const RepoPickerModal = dynamic(() => import('./PickerModals').then((m) => m.RepoPickerModal), { ssr: false })
const EditTextModal = dynamic(() => import('./TextModals').then((m) => m.EditTextModal), { ssr: false })
const EditInfoModal = dynamic(() => import('./TextModals').then((m) => m.EditInfoModal), { ssr: false })
const ConfirmMoveModal = dynamic(() => import('./TextModals').then((m) => m.ConfirmMoveModal), { ssr: false })
const ExportModal = dynamic(() => import('./TextModals').then((m) => m.ExportModal), { ssr: false })

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
    if (c.type === 'projectsManager' || c.type === 'charactersManager' || c.type === 'carouselManager') {
      setManagerCmd(c)
    } else {
      setCmd(c)
    }
  }, [])

  // Modo admin: overlay de edición + slots (port setAdmin)
  const setAdmin = useCallback((on: boolean, username?: string) => {
    setAdminFlag(on, username)
    document.body.classList.toggle('is-admin', on)
    if (on) {
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

    if (state.isAdmin) {
      engine.attachEditControls()
    }
  }, [pathname])

  // ----- Init (port de cms.js init()) ----------------------------------------
  useEffect(() => {
    engine.setDispatch(dispatch)
    loadState()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza con el DOM real (portal host), no estado derivable
    setAuthHost(document.getElementById('cms-auth-nav'))
    engine.indexEditables()
    engine.refreshRetired()

    // First fetch overrides (content) – this may be stale, we will re‑broadcast only after server merge
    getContent()
      .catch(() => loadJSON(LS.OVERRIDES, {}) as Record<string, string>)
      .then((serverItems) => {
        state.items = serverItems
        saveJSON(LS.OVERRIDES, state.items)
        // Do NOT broadcast carousel yet; wait for server state validation
        engine.hydrate()
        engine.refreshRetired()
        emit()

        // Load full server state (usedContent, etc.)
        loadServerState().then(() => {
          // After merge, broadcast carousels based on the now‑validated overrides
          const broadcastCarousel = (prefix: string) => {
            let settings = { count: 3, duration: 7000 }
            try { settings = Object.assign(settings, JSON.parse(state.items[`${prefix}.settings`] || '')) } catch {}
            const count = Number.isFinite(settings.count) ? Math.max(0, settings.count) : 3
            const slides: string[] = []
            for (let i = 0; i < count; i++) {
              slides.push(state.items[`${prefix}.slide#${i}`] || '')
            }
            window.dispatchEvent(new CustomEvent(`cms:${prefix}`, { detail: { slides, duration: settings.duration || 7000 } }))
          }
          broadcastCarousel('hero')
          broadcastCarousel('hero-main')
          broadcastCarousel('hero-sub')
          broadcastCarousel('about-carousel')

          cleanOrphanOverrides()
          engine.refreshRetired()
          engine.seedUsedContent()
          state.serverReady = true
          emit()
        })

        // Session & i18n handling (unchanged)
        getAccount().then((account) => setAdmin(!!account, account?.username))
        getTranslations()
          .then((tr) => {
            state.translations = tr
            const lang = loadLang()
            engine.setLanguage(lang)
          })
          .catch(() => {})
      })

    const t = setTimeout(() => engine.rescan(), 300)

    const onCarouselCmd = (e: Event) => {
      const prefix = (e as CustomEvent).detail?.prefix || 'hero'
      dispatch({ type: 'carouselManager', key: prefix })
    }
    const onProjectsCmd = () => { dispatch({ type: 'projectsManager' }) }
    const onCharactersCmd = () => { dispatch({ type: 'charactersManager' }) }
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
              <div className="admin-dropdown-wrapper">
                <span className="cms-user-chip" title={`Sesión iniciada como ${state.username || 'Administrador'}`}>
                  <i className="fa-solid fa-user-shield"></i> {state.username || 'Administrador'} <i className="fa-solid fa-chevron-down" style={{ fontSize: '0.7em', marginLeft: '0.3rem' }}></i>
                </span>
                <div className="admin-dropdown-menu">
                  <div className="admin-menu-header">Sesión actual: {state.username || 'Administrador'}</div>
                  <a 
                    href="/admin" 
                    className="cms-navauth-btn" 
                    style={{ textDecoration: 'none', display: 'inline-block' }}
                    onClick={() => { try { sessionStorage.setItem('cms_skip_loader', '1') } catch {} }}
                  >
                    <i className="fa-solid fa-sliders"></i> Management
                  </a>
                  <button type="button" className="cms-navauth-btn" title="Log out"
                    onClick={() => { logout().finally(() => { setAdmin(false); toast('Logged out') }) }}>
                    <i className="fa-solid fa-right-from-bracket"></i> Log out
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="login-min-btn" onClick={() => setCmd({ type: 'login' })}>
                <i className="fa-solid fa-right-to-bracket"></i>
                <span>Log in</span>
              </button>
            ),
            authHost,
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

          {managerCmd?.type === 'carouselManager' && (
            <CarouselManager
              show={true}
              prefix={managerCmd.key || 'hero'}
              onClose={() => { setManagerCmd(null); close(); }}
              onPickImage={(key) => { engine.ensureSlideMeta(key); dispatch({ type: 'contentPicker', key }) }}
            />
          )}
          {managerCmd?.type === 'projectsManager' && (
            <ProjectsManager
              show={true}
              onClose={() => { setManagerCmd(null); close(); }}
              onPickImage={(key) => { engine.ensureProjectMeta(key); dispatch({ type: 'contentPicker', key }) }}
              onEditInfo={(key) => { engine.ensureProjectMeta(key); dispatch({ type: 'editInfo', key }) }}
            />
          )}
          {managerCmd?.type === 'charactersManager' && (
            <CharactersManager
              show={true}
              onClose={() => { setManagerCmd(null); close(); }}
              onPickImage={(key) => { engine.ensureCharacterMeta(key); dispatch({ type: 'contentPicker', key }) }}
              onEditInfo={(key) => { engine.ensureCharacterMeta(key); dispatch({ type: 'editInfo', key }) }}
            />
          )}

          {cmd?.type === 'login' && (
            <LoginModal onClose={close} onSuccess={(username) => setAdmin(true, username)} />
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

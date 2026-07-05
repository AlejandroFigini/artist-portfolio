'use client'

/* Orquestador del CMS en el sitio — port del init() + setAdmin() +
   renderAuth() de cms.js. Inicializa el motor DOM, trae el contenido
   del Express (fuente de verdad) y despacha los modales React vía
   CommandContext. Montar solo en el index (igual que cms.js legacy). */

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CommandContext, type Command } from '@/lib/commands'
import { useToast } from '@/components/ui/Toast'
import { getContent, getTranslations, getAccount, logout } from '@/lib/api'
import { validateFile } from '@/lib/media'
import { state, loadState, useCmsStore, setAdminFlag, emit, loadJSON, saveJSON, loadLang, loadServerState, cleanOrphanOverrides, LS } from '@/lib/cms/store'
import { BASE_LANG } from '@/lib/i18n'
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
  const [cmd, setCmd] = useState<Command | null>(null)
  const [cmdStack, setCmdStack] = useState<Command[]>([])
  const [uploadFile, setUploadFile] = useState<{ key: string; file: File } | null>(null)
  // host del portal del botón de sesión: se resuelve post-mount para apuntar
  // al nodo definitivo del DOM (patrón estándar de portales)
  const [authHost, setAuthHost] = useState<HTMLElement | null>(null)
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
    setCmd((prev) => {
      if (prev && c.type !== prev.type) {
        setCmdStack((stack) => [...stack, prev])
      } else if (!prev) {
        setCmdStack([])
      }
      return c
    })
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
  }, [dispatch])

  // ----- Init (port de cms.js init()) ----------------------------------------
  useEffect(() => {
    engine.setDispatch(dispatch)
    loadState()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza con el DOM real (portal host), no estado derivable
    setAuthHost(document.getElementById('cms-auth-nav'))
    engine.indexEditables()
    engine.refreshRetired()

    getContent()
      .catch(() => loadJSON(LS.OVERRIDES, {}) as Record<string, string>)
      .then((serverItems) => {
        // La DB es la fuente de verdad; localStorage solo como fallback si
        // getContent() falló (backend caído / sin DB).
        state.items = serverItems
        saveJSON(LS.OVERRIDES, state.items)

        const broadcastCarousel = (prefix: string) => {
          let settings = { count: 3, duration: 7000 }
          try { settings = Object.assign(settings, JSON.parse(state.items[`${prefix}.settings`] || '')) } catch {}
          // count puede ser 0 (carrusel limpiado): respetarlo, no caer a 3.
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

        engine.hydrate()
        engine.refreshRetired()
        emit()

        // Sincronizar estado compartido (usedContent, retired, etc.) desde el
        // server — resuelve el bug de "cambios no visibles en otro dispositivo".
        loadServerState().then(() => {
          cleanOrphanOverrides()
          engine.refreshRetired()
          engine.seedUsedContent()
          emit()
        })

        // la sesión server (cookie httpOnly) es la fuente de verdad — un flag
        // falso en localStorage NO habilita admin.
        getAccount().then((account) => setAdmin(!!account, account?.username))

        // i18n: traer traducciones y aplicar el idioma guardado (si no es base).
        getTranslations().then((tr) => {
          state.translations = tr
          const lang = loadLang()
          if (lang !== BASE_LANG) engine.setLanguage(lang)
          else { state.lang = BASE_LANG; emit() }
        }).catch(() => {})
      })

    const t = setTimeout(() => engine.rescan(), 300)

    // skip loader logic moved to the inline onClick handler for the Gestión link

    const onCarouselCmd = (e: Event) => {
      const prefix = (e as CustomEvent).detail?.prefix || 'hero'
      dispatch({ type: 'carouselManager', key: prefix })
    }
    const onProjectsCmd = () => {
      dispatch({ type: 'projectsManager' })
    }
    const onCharactersCmd = () => {
      dispatch({ type: 'charactersManager' })
    }
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
    setCmdStack((stack) => {
      if (stack.length > 0) {
        const nextStack = [...stack]
        const lastCmd = nextStack.pop()!
        setCmd(lastCmd)
        return nextStack
      }
      setCmd(null)
      return []
    })
  }, [])

  return (
    <CommandContext.Provider value={dispatch}>
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
                <i className="fa-solid fa-sliders"></i> Gestión
              </a>
              <button type="button" className="cms-navauth-btn" title="Cerrar sesión"
                onClick={() => { logout().finally(() => { setAdmin(false); toast('Sesión cerrada') }) }}>
                <i className="fa-solid fa-right-from-bracket"></i> Salir
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="login-min-btn" onClick={() => setCmd({ type: 'login' })}>
            <i className="fa-solid fa-right-to-bracket"></i>
            <span>Iniciar sesión</span>
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
          setUploadFile({ key, file: f })
        }}
      />

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
            setCmdStack((stack) => {
              const next = [...stack]
              while (next.length > 0 && (next[next.length - 1].type === 'contentPicker' || next[next.length - 1].type === 'repoPicker')) {
                next.pop()
              }
              if (next.length > 0) {
                setCmd(next.pop()!)
                return next
              }
              setCmd(null)
              return []
            })
            if (k.startsWith('hero.marquee#')) {
              setTimeout(() => dispatch({ type: 'editInfo', key: k }), 50)
            }
          }}
        />
      )}
      {cmd?.type === 'carouselManager' && (
        <CarouselManager
          prefix={cmd.key || 'hero'}
          onClose={close}
          onPickImage={(key) => { engine.ensureSlideMeta(key); dispatch({ type: 'contentPicker', key }) }}
        />
      )}
      {cmd?.type === 'projectsManager' && (
        <ProjectsManager
          onClose={close}
          onPickImage={(key) => { engine.ensureProjectMeta(key); dispatch({ type: 'contentPicker', key }) }}
        />
      )}
      {cmd?.type === 'charactersManager' && (
        <CharactersManager
          onClose={close}
          onPickImage={(key) => { engine.ensureCharacterMeta(key); dispatch({ type: 'contentPicker', key }) }}
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
    </CommandContext.Provider>
  )
}

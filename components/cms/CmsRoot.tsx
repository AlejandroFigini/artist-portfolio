'use client'

/* Orquestador del CMS en el sitio — port del init() + setAdmin() +
   renderAuth() de cms.js. Inicializa el motor DOM, trae el contenido
   del Express (fuente de verdad) y despacha los modales React vía
   CommandContext. Montar solo en el index (igual que cms.js legacy). */

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CommandContext, type Command } from '@/lib/commands'
import { useToast } from '@/components/ui/Toast'
import { getContent } from '@/lib/api'
import { validateFile } from '@/lib/media'
import { state, loadState, useCmsStore, setAdminFlag, emit, loadJSON, LS } from '@/lib/cms/store'
import * as engine from './engine'
import { renderAddedIllu, addGallerySlots, removeGallerySlots } from './gallery'
import LoginModal from './LoginModal'
import UploadModal from './UploadModal'
import CarouselManager from './CarouselManager'
import AuditOverlay from './AuditOverlay'
import AddIllustrationModal from './AddIllustrationModal'
import { ContentPickerModal, RepoPickerModal } from './PickerModals'
import { EditTextModal, EditInfoModal, ConfirmMoveModal, ExportModal } from './TextModals'

export default function CmsRoot() {
  const toast = useToast()
  useCmsStore()
  const [cmd, setCmd] = useState<Command | null>(null)
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
      fileInputRef.current.accept = meta.accept === 'webp' ? 'image/*' : 'video/*'
      fileInputRef.current.click()
      return
    }
    setCmd(c)
  }, [])

  // Tuerca global del carrusel en modo admin (port indexEditables L414)
  const attachCarouselGear = useCallback(() => {
    const heroContainer = document.querySelector('.hero-bg-carousel')
    if (!heroContainer || heroContainer.querySelector('.cms-hero-gear')) return
    const btn = document.createElement('button')
    btn.className = 'cms-hero-gear'
    btn.innerHTML = '<i class="fa-solid fa-layer-group"></i>'
    btn.title = 'Configurar Carrusel'
    btn.onclick = (e) => { e.preventDefault(); dispatch({ type: 'carouselManager' }) }
    heroContainer.appendChild(btn)
  }, [dispatch])

  // Modo admin: overlay de edición + slots (port setAdmin)
  const setAdmin = useCallback((on: boolean) => {
    setAdminFlag(on)
    document.body.classList.toggle('is-admin', on)
    if (on) {
      engine.indexEditables()
      engine.seedUsedContent()
      engine.attachEditControls()
      addGallerySlots(dispatch)
      attachCarouselGear()
    } else {
      engine.removeEditControls()
      removeGallerySlots()
      document.querySelector('.cms-hero-gear')?.remove()
    }
    engine.refreshRetired()
  }, [dispatch, attachCarouselGear])

  // ----- Init (port de cms.js init()) ----------------------------------------
  useEffect(() => {
    engine.setDispatch(dispatch)
    loadState()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza con el DOM real (portal host), no estado derivable
    setAuthHost(document.getElementById('cms-auth-nav'))
    renderAddedIllu()
    engine.indexEditables()
    engine.refreshRetired()

    getContent()
      .catch(() => ({}))
      .then((serverItems) => {
        // el backend es la fuente de verdad; overrides locales como base
        state.items = Object.assign({}, loadJSON(LS.OVERRIDES, {}), serverItems)

        // settings del hero → evento para el slideshow React
        let settings = { count: 3, duration: 7000 }
        try { settings = Object.assign(settings, JSON.parse(state.items['hero.settings'] || '')) } catch {}
        const slides: string[] = []
        for (let i = 0; i < (settings.count || 3); i++) {
          slides.push(state.items[`hero.slide#${i}`] || '')
        }
        window.dispatchEvent(new CustomEvent('cms:hero', { detail: { slides, duration: settings.duration || 7000 } }))

        engine.hydrate()
        engine.syncWaveGroups()
        engine.refreshRetired()
        emit()
        let wasAdmin = false
        try { wasAdmin = localStorage.getItem(LS.ADMIN) === '1' } catch {}
        setAdmin(wasAdmin)
      })

    // re-escaneo para contenido generado dinámicamente (port L1801)
    const t = setTimeout(() => engine.rescan(), 300)

    // skip loader al navegar a Gestión (port nav-admin-link)
    const adminLink = document.getElementById('nav-admin-link')
    const markSkip = () => { try { sessionStorage.setItem('cms_skip_loader', '1') } catch {} }
    adminLink?.addEventListener('click', markSkip)

    return () => {
      clearTimeout(t)
      adminLink?.removeEventListener('click', markSkip)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const close = () => setCmd(null)

  return (
    <CommandContext.Provider value={dispatch}>
      {/* botón de sesión en la navbar (port renderAuth) */}
      {authHost && createPortal(
        state.isAdmin ? (
          <>
            <span className="cms-user-chip" title="Sesión iniciada como Administrador">
              <i className="fa-solid fa-user-shield"></i> Administrador
            </span>
            <button type="button" className="cms-navauth-btn" title="Cerrar sesión"
              onClick={() => { setAdmin(false); toast('Sesión cerrada') }}>
              <i className="fa-solid fa-right-from-bracket"></i> Salir
            </button>
          </>
        ) : (
          <button type="button" className="cms-navauth-btn" onClick={() => setCmd({ type: 'login' })}>
            <i className="fa-solid fa-right-to-bracket"></i> Iniciar sesión
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
        <LoginModal onClose={close} onSuccess={() => setAdmin(true)} />
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
      {cmd?.type === 'repoPicker' && <RepoPickerModal cmsKey={cmd.key} onClose={close} />}
      {cmd?.type === 'carouselManager' && (
        <CarouselManager
          onClose={close}
          onPickImage={(key) => dispatch({ type: 'contentPicker', key })}
        />
      )}
      {cmd?.type === 'auditPage' && <AuditOverlay onClose={close} />}
      {cmd?.type === 'addIllustration' && <AddIllustrationModal onClose={close} />}

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

'use client'

/* Modal unificado — reemplaza los dos sistemas paralelos del legacy:
   modal()/closeModal() (cms.js) y buildModal()/closeOv()/confirmModal()
   (admin.js). Reusa las clases .cms-modal* de style.css.

   Dos formas de uso sobre la MISMA base visual (<CmsModal>):
   - useModal().open/confirm — imperativo, para modales simples
   - <CmsModal> declarativo — para modales con estado propio (upload, pickers) */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useKeyHandler } from '@/hooks/useKeyHandler'

export type ModalAction = {
  label: React.ReactNode
  primary?: boolean
  danger?: boolean
  disabled?: boolean
  title?: string
  // return false para mantener el modal abierto (validación)
  onClick: () => void | false
}

type CmsModalProps = {
  title: string
  children: React.ReactNode
  actions?: ModalAction[]
  wide?: boolean
  // acciones en un único renglón (sin wrap), botones compactos
  compactActions?: boolean
  // sin X / Escape / click-afuera (p.ej. durante una subida)
  locked?: boolean
  show?: boolean
  onClose: () => void
}

export function CmsModal({ title, children, actions, wide, compactActions, locked, show = true, onClose }: CmsModalProps) {
  const [visible, setVisible] = useState(false)
  // Solo cierra si el gesto EMPEZÓ y TERMINÓ sobre el overlay. Evita que
  // arrastrar una selección de texto desde dentro y soltar afuera cierre el modal.
  const downOnOverlay = useRef(false)
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  useEffect(() => {
    document.body.classList.add('cms-modal-open')
    return () => {
      if (!document.querySelector('.cms-modal-overlay')) document.body.classList.remove('cms-modal-open')
    }
  }, [])

  useKeyHandler('Escape', onClose, !locked)

  return (
    <div
      className={`cms-modal-overlay${visible && show ? ' show' : ''}`}
      onMouseDown={(e) => { downOnOverlay.current = e.target === e.currentTarget }}
      onMouseUp={(e) => {
        if (e.target === e.currentTarget && downOnOverlay.current && !locked) onClose()
        downOnOverlay.current = false
      }}
    >
      <div className={`cms-modal${wide ? ' cms-modal--wide' : ''}${compactActions ? ' cms-modal--actions-row' : ''}`}>
        {/* el scroll vive en este wrapper interno (no en .cms-modal) para que la
            barra nunca quede pegada a las esquinas redondeadas del contenedor */}
        <div className="cms-modal-inner">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
            <h3 className="cms-modal-title" style={{ margin: 0 }}>{title}</h3>
            {!locked && (
              <button
                type="button"
                title="Cerrar"
                onClick={onClose}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '1.4rem', cursor: 'pointer' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </div>
          {children}
          {actions && actions.length > 0 && (() => {
            const renderBtn = (a: ModalAction, i: number) => (
              <button
                key={i}
                type="button"
                className={`cms-btn${a.primary ? ' cms-btn--primary' : ''}`}
                disabled={a.disabled}
                title={a.title}
                style={a.danger ? { background: '#ef4444', borderColor: '#ef4444' } : undefined}
                onClick={() => { if (a.disabled) return; if (a.onClick() !== false) onClose() }}
              >
                {a.label}
              </button>
            )
            // compactActions (vista previa): todos los botones en un único
            // renglón (sin wrap, scroll horizontal si no entran); el primario
            // (Cerrar) queda al final, empujado al extremo derecho
            if (compactActions) {
              return <div className="cms-modal-actions cms-modal-actions--row">{actions.map(renderBtn)}</div>
            }
            return <div className="cms-modal-actions">{actions.map(renderBtn)}</div>
          })()}
        </div>
      </div>
    </div>
  )
}

// ----- API imperativa (open / close / confirm) --------------------------------

export type ModalSpec = {
  title: string
  body: React.ReactNode
  actions?: ModalAction[]
  wide?: boolean
}

type ModalApi = {
  open: (spec: ModalSpec) => void
  close: () => void
  confirm: (title: string, body: React.ReactNode, onConfirm: () => void) => void
}

const ModalContext = createContext<ModalApi>({ open: () => {}, close: () => {}, confirm: () => {} })

export const useModal = () => useContext(ModalContext)

export function ModalProvider({ children }: { children: React.ReactNode }) {
  // pila: un modal puede abrir otro encima
  const [stack, setStack] = useState<ModalSpec[]>([])

  const open = useCallback((spec: ModalSpec) => setStack((s) => [...s, spec]), [])
  const close = useCallback(() => setStack((s) => s.slice(0, -1)), [])

  const confirm = useCallback((title: string, body: React.ReactNode, onConfirm: () => void) => {
    open({
      title,
      body: <div className="cms-confirm-body">{body}</div>,
      actions: [
        { label: 'Cancelar', onClick: () => {} },
        { label: 'Confirmar', primary: true, onClick: onConfirm },
      ],
    })
  }, [open])

  const top = stack[stack.length - 1]

  return (
    <ModalContext.Provider value={{ open, close, confirm }}>
      {children}
      {top && (
        <CmsModal title={top.title} actions={top.actions} wide={top.wide} onClose={close}>
          {top.body}
        </CmsModal>
      )}
    </ModalContext.Provider>
  )
}

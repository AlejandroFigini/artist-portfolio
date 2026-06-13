'use client'

/* Modal unificado — reemplaza los dos sistemas paralelos del legacy:
   modal()/closeModal() (cms.js) y buildModal()/closeOv()/confirmModal()
   (admin.js). Reusa las clases .cms-modal* de style.css.

   Dos formas de uso sobre la MISMA base visual (<CmsModal>):
   - useModal().open/confirm — imperativo, para modales simples
   - <CmsModal> declarativo — para modales con estado propio (upload, pickers) */

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useKeyHandler } from '@/hooks/useKeyHandler'

export type ModalAction = {
  label: React.ReactNode
  primary?: boolean
  danger?: boolean
  // return false para mantener el modal abierto (validación)
  onClick: () => void | false
}

type CmsModalProps = {
  title: string
  children: React.ReactNode
  actions?: ModalAction[]
  wide?: boolean
  // sin X / Escape / click-afuera (p.ej. durante una subida)
  locked?: boolean
  show?: boolean
  onClose: () => void
}

export function CmsModal({ title, children, actions, wide, locked, show = true, onClose }: CmsModalProps) {
  const [visible, setVisible] = useState(false)
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
      onClick={(e) => { if (e.target === e.currentTarget && !locked) onClose() }}
    >
      <div className={`cms-modal${wide ? ' cms-modal--wide' : ''}`}>
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
        {actions && actions.length > 0 && (
          <div className="cms-modal-actions">
            {actions.map((a, i) => (
              <button
                key={i}
                type="button"
                className={`cms-btn${a.primary ? ' cms-btn--primary' : ''}`}
                style={a.danger ? { background: '#ef4444', borderColor: '#ef4444' } : undefined}
                onClick={() => { if (a.onClick() !== false) onClose() }}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
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

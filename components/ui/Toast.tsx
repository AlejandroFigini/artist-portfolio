'use client'

/* Toasts de notificación — la parte "notificación" del toast() de cms.js
   (la parte command-bus vive en lib/commands.tsx). Reusa .cms-toast. */

import { createContext, useCallback, useContext, useRef, useState } from 'react'

type ToastKind = 'success' | 'error' | 'info'
type ToastItem = { id: number; msg: string; kind: ToastKind; show: boolean }

const ToastContext = createContext<(msg: string, kind?: ToastKind) => void>(() => {})

export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const toast = useCallback((msg: string, kind: ToastKind = 'success') => {
    const id = nextId.current++
    setToasts((t) => [...t, { id, msg, kind, show: false }])
    // mismo timing que el legacy: fade-in por rAF, visible 3.4s, fade-out 300ms
    requestAnimationFrame(() => {
      setToasts((t) => t.map((x) => (x.id === id ? { ...x, show: true } : x)))
    })
    setTimeout(() => {
      setToasts((t) => t.map((x) => (x.id === id ? { ...x, show: false } : x)))
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 300)
    }, 3400)
  }, [])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`cms-toast${t.kind === 'error' ? ' cms-toast--error' : ''}${t.show ? ' show' : ''}`}
        >
          {t.msg}
        </div>
      ))}
    </ToastContext.Provider>
  )
}

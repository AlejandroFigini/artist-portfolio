'use client'

/* Login de administrador — port de cms.js openLogin()/doLogin():
   credenciales contra /api/login; si el backend pide 2FA, segunda
   fase con el código TOTP (Google Authenticator). */

import { useRef, useState } from 'react'
import { CmsModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { login } from '@/lib/api'

type Props = { onSuccess: (username?: string) => void; onClose: () => void }

export default function LoginModal({ onSuccess, onClose }: Props) {
  const toast = useToast()
  const [phase, setPhase] = useState<'creds' | '2fa'>('creds')
  const [busy, setBusy] = useState(false)
  const creds = useRef({ user: '', pass: '' })
  const userRef = useRef<HTMLInputElement>(null)
  const passRef = useRef<HTMLInputElement>(null)
  const codeRef = useRef<HTMLInputElement>(null)

  const submit = (): false => {
    if (busy) return false
    const user = phase === 'creds' ? (userRef.current?.value || '').trim() : creds.current.user
    const pass = phase === 'creds' ? passRef.current?.value || '' : creds.current.pass
    const code = phase === '2fa' ? (codeRef.current?.value || '').trim() : null
    setBusy(true)
    login(user, pass, code)
      .then((data) => {
        if (data.require2FA) {
          creds.current = { user, pass }
          setPhase('2fa')
        } else if (data.success) {
          onSuccess(data.user?.username)
          onClose()
          toast('Sesión iniciada correctamente')
        } else {
          toast(data.error || 'Usuario o contraseña incorrectos', 'error')
        }
      })
      .catch(() => toast('Error de conexión con el servidor', 'error'))
      .finally(() => setBusy(false))
    return false // el modal se cierra solo en éxito
  }

  const onEnter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') submit() }

  return (
    <CmsModal
      title="Acceso de administrador"
      onClose={onClose}
      actions={[
        { label: 'Cancelar', onClick: () => { onClose(); return false } },
        { label: busy ? 'Verificando…' : phase === '2fa' ? 'Verificar' : 'Entrar', primary: true, onClick: submit },
      ]}
    >
      <div className="cms-login-form">
        {phase === 'creds' ? (
          <>
            <label className="cms-field"><span>Usuario</span>
              <input ref={userRef} type="text" autoComplete="off" />
            </label>
            <label className="cms-field"><span>Contraseña</span>
              <input ref={passRef} type="password" onKeyDown={onEnter} />
            </label>
            <p className="cms-hint" style={{ marginTop: 15 }}>
              <i className="fa-solid fa-lock"></i> Asegurado con Google Authenticator 2FA.
            </p>
          </>
        ) : (
          <>
            <label className="cms-field"><span>Código 2FA (Google Authenticator)</span>
              <input ref={codeRef} type="text" autoComplete="off" maxLength={6} autoFocus onKeyDown={onEnter} />
            </label>
            <p className="cms-hint" style={{ color: 'var(--color-primary)' }}>
              <i className="fa-solid fa-shield-halved"></i> Ingresa el código dinámico de tu app.
            </p>
          </>
        )}
      </div>
    </CmsModal>
  )
}

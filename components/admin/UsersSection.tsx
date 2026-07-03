'use client'

/* "Administrar usuarios" (Gestión) — reemplaza al viejo mock de "Gestión de
   usuarios" y al "Mi cuenta" de la tuerca admin:
   - Lista completa de usuarios con último inicio de sesión (GET /api/users).
   - El usuario logeado edita SUS credenciales (username + contraseña).
   - Activación de 2FA con guía paso a paso (app autenticadora + QR). */

import { useCallback, useEffect, useState } from 'react'
import { toDataURL } from 'qrcode'
import { state, useCmsStore, setAdminFlag } from '@/lib/cms/store'
import { updateAccount, twoFa, getUsers, type UserRow } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { fmtDate } from '@/lib/utils'

type View = 'menu' | 'username' | 'password' | '2fa-setup' | '2fa-disable'

const GUIDE_STEPS = [
  { icon: 'fa-mobile-screen-button', text: 'Instalá una app autenticadora en tu teléfono: Google Authenticator, Microsoft Authenticator o Authy (gratis en App Store / Play Store).' },
  { icon: 'fa-qrcode', text: 'En la app tocá "+" (agregar cuenta) → "Escanear código QR" y apuntá la cámara al QR de abajo. Si no podés escanear, elegí "Ingresar clave manualmente" y copiá la clave.' },
  { icon: 'fa-clock-rotate-left', text: 'La app va a mostrar un código de 6 dígitos que cambia cada 30 segundos. Ese código es tu segundo factor.' },
  { icon: 'fa-circle-check', text: 'Escribí el código actual en el campo de abajo y confirmá. A partir de ahí, cada inicio de sesión pedirá usuario + contraseña + código de la app.' },
]

export default function UsersSection() {
  useCmsStore()
  const toast = useToast()
  const [users, setUsers] = useState<UserRow[]>([])
  const [view, setView] = useState<View>('menu')
  const [busy, setBusy] = useState(false)
  const [qr, setQr] = useState<{ img: string; secret: string } | null>(null)
  const [form, setForm] = useState({ username: '', current: '', next: '', repeat: '', code: '', password: '' })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const refresh = useCallback(() => { getUsers().then(setUsers) }, [])
  useEffect(() => { refresh() }, [refresh])

  const me = users.find((u) => u.username === state.username)

  const run = (fn: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    fn().catch((e: Error) => toast(e.message || 'Error', 'error')).finally(() => setBusy(false))
  }

  const back = () => { setQr(null); setView('menu') }

  const saveUsername = () => run(async () => {
    const user = await updateAccount({ username: form.username })
    setAdminFlag(true, user.username)
    setForm((f) => ({ ...f, username: '' }))
    toast('Nombre de usuario actualizado')
    refresh()
    setView('menu')
  })

  const savePassword = () => run(async () => {
    if (form.next !== form.repeat) throw new Error('Las contraseñas no coinciden')
    await updateAccount({ currentPassword: form.current, newPassword: form.next })
    setForm((f) => ({ ...f, current: '', next: '', repeat: '' }))
    toast('Contraseña actualizada')
    setView('menu')
  })

  const start2fa = () => run(async () => {
    const { secret, uri } = await twoFa({ action: 'setup' })
    const img = await toDataURL(uri!, { margin: 1, width: 200 })
    setQr({ img, secret: secret! })
    setView('2fa-setup')
  })

  const enable2fa = () => run(async () => {
    await twoFa({ action: 'enable', code: form.code })
    setQr(null)
    setForm((f) => ({ ...f, code: '' }))
    toast('2FA activado')
    refresh()
    setView('menu')
  })

  const disable2fa = () => run(async () => {
    await twoFa({ action: 'disable', password: form.password })
    setForm((f) => ({ ...f, password: '' }))
    toast('2FA desactivado')
    refresh()
    setView('menu')
  })

  return (
    <div className="admin-card">
      <h2><i className="fa-solid fa-users-gear"></i> Administrar usuarios</h2>
      <p className="cms-admin-sub">Usuarios del sitio y credenciales de tu cuenta.</p>

      {/* ----- Lista de usuarios ----- */}
      <div className="cms-audit-table-wrap">
        <table className="cms-audit-table">
          <thead><tr><th>Usuario</th><th>2FA</th><th>Último inicio de sesión</th><th>Creado</th></tr></thead>
          <tbody>
            {users.length === 0 && <tr><td colSpan={4} className="cms-audit-empty">Cargando usuarios…</td></tr>}
            {users.map((u) => (
              <tr key={u.username}>
                <td>
                  {u.username}
                  {u.username === state.username && <span className="cms-tag" style={{ marginLeft: 8 }}>tu sesión</span>}
                </td>
                <td>
                  <span className="cms-tag" style={{ color: u.totpEnabled ? 'var(--color-primary)' : undefined }}>
                    <i className={`fa-solid ${u.totpEnabled ? 'fa-shield-halved' : 'fa-shield'}`}></i> {u.totpEnabled ? 'Activado' : 'Desactivado'}
                  </span>
                </td>
                <td>{u.lastLoginAt ? fmtDate(new Date(u.lastLoginAt).getTime()) : 'Nunca'}</td>
                <td>{fmtDate(new Date(u.createdAt).getTime())}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ----- Mi cuenta ----- */}
      <h3 style={{ marginTop: '2rem' }}><i className="fa-solid fa-id-card"></i> Mi cuenta — {state.username}</h3>

      {view === 'menu' && (
        <div className="admin-quick" style={{ marginTop: '1rem' }}>
          <button type="button" className="cms-btn" onClick={() => setView('username')}>
            <i className="fa-solid fa-user-pen"></i> Cambiar usuario
          </button>
          <button type="button" className="cms-btn" onClick={() => setView('password')}>
            <i className="fa-solid fa-key"></i> Cambiar contraseña
          </button>
          {me?.totpEnabled ? (
            <button type="button" className="cms-btn" onClick={() => setView('2fa-disable')}>
              <i className="fa-solid fa-shield-halved"></i> Desactivar 2FA
            </button>
          ) : (
            <button type="button" className="cms-btn cms-btn--primary" disabled={busy} onClick={start2fa}>
              <i className="fa-solid fa-shield-halved"></i> Activar 2FA
            </button>
          )}
        </div>
      )}

      {view === 'username' && (
        <div className="cms-login-form" style={{ maxWidth: 420, marginTop: '1rem' }}>
          <label className="cms-field"><span>Nuevo nombre de usuario</span>
            <input type="text" value={form.username} onChange={set('username')} autoComplete="off" />
          </label>
          <div className="cms-confirm-actions">
            <button type="button" className="cms-btn cms-btn-cancel" onClick={back}>Cancelar</button>
            <button type="button" className="cms-btn cms-btn--primary" disabled={busy || form.username.trim().length < 3} onClick={saveUsername}>
              {busy ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {view === 'password' && (
        <div className="cms-login-form" style={{ maxWidth: 420, marginTop: '1rem' }}>
          <label className="cms-field"><span>Contraseña actual</span>
            <input type="password" value={form.current} onChange={set('current')} />
          </label>
          <label className="cms-field"><span>Nueva contraseña (mínimo 8 caracteres)</span>
            <input type="password" value={form.next} onChange={set('next')} />
          </label>
          <label className="cms-field"><span>Repetir nueva contraseña</span>
            <input type="password" value={form.repeat} onChange={set('repeat')} />
          </label>
          <div className="cms-confirm-actions">
            <button type="button" className="cms-btn cms-btn-cancel" onClick={back}>Cancelar</button>
            <button
              type="button" className="cms-btn cms-btn--primary"
              disabled={busy || !form.current || form.next.length < 8 || !form.repeat}
              onClick={savePassword}
            >
              {busy ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {view === '2fa-setup' && qr && (
        <div style={{ marginTop: '1rem' }}>
          <h4><i className="fa-solid fa-list-check"></i> Guía de activación</h4>
          <ol className="cms-2fa-guide" style={{ margin: '0.8rem 0 1.2rem', paddingLeft: '1.2rem', display: 'grid', gap: '0.6rem' }}>
            {GUIDE_STEPS.map((s, i) => (
              <li key={i}><i className={`fa-solid ${s.icon}`} style={{ width: 20, marginRight: 6 }}></i>{s.text}</li>
            ))}
          </ol>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ textAlign: 'center' }}>
              {/* dataURL generado en el cliente desde el otpauth URI, no es media del CMS */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr.img} alt="Código QR para configurar 2FA en tu app autenticadora" width={200} height={200} style={{ borderRadius: 10, display: 'block' }} />
              <p className="cms-hint" style={{ wordBreak: 'break-all', maxWidth: 220 }}>Clave manual: <code>{qr.secret}</code></p>
            </div>
            <div className="cms-login-form" style={{ maxWidth: 320, flex: 1 }}>
              <label className="cms-field"><span>Código de 6 dígitos de la app</span>
                <input type="text" maxLength={6} inputMode="numeric" value={form.code} onChange={set('code')} autoComplete="off" />
              </label>
              <div className="cms-confirm-actions">
                <button type="button" className="cms-btn cms-btn-cancel" onClick={back}>Cancelar</button>
                <button type="button" className="cms-btn cms-btn--primary" disabled={busy || form.code.length !== 6} onClick={enable2fa}>
                  {busy ? 'Verificando…' : 'Confirmar y activar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {view === '2fa-disable' && (
        <div className="cms-login-form" style={{ maxWidth: 420, marginTop: '1rem' }}>
          <p className="cms-hint">Ingresá tu contraseña para desactivar el 2FA. Tu cuenta quedará protegida solo por usuario y contraseña.</p>
          <label className="cms-field"><span>Contraseña</span>
            <input type="password" value={form.password} onChange={set('password')} />
          </label>
          <div className="cms-confirm-actions">
            <button type="button" className="cms-btn cms-btn-cancel" onClick={back}>Cancelar</button>
            <button type="button" className="cms-btn cms-btn-danger" disabled={busy || !form.password} onClick={disable2fa}>
              {busy ? 'Verificando…' : 'Desactivar 2FA'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

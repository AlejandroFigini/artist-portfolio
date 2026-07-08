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
  { icon: 'fa-mobile-screen-button', text: 'Install an authenticator app on your phone: Google Authenticator, Microsoft Authenticator, or Authy (free on App Store / Play Store).' },
  { icon: 'fa-qrcode', text: 'In the app tap "+" (add account) → "Scan QR code" and point your camera at the QR code below. If you cannot scan, choose "Enter key manually" and copy the key.' },
  { icon: 'fa-clock-rotate-left', text: 'The app will show a 6-digit code that changes every 30 seconds. That code is your second factor.' },
  { icon: 'fa-circle-check', text: 'Enter the current code in the field below and confirm. From then on, each login will require your username + password + app code.' },
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
    toast('Username updated')
    refresh()
    setView('menu')
  })

  const savePassword = () => run(async () => {
    if (form.next !== form.repeat) throw new Error('Passwords do not match')
    await updateAccount({ currentPassword: form.current, newPassword: form.next })
    setForm((f) => ({ ...f, current: '', next: '', repeat: '' }))
    toast('Password updated')
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
    toast('2FA enabled')
    refresh()
    setView('menu')
  })

  const disable2fa = () => run(async () => {
    await twoFa({ action: 'disable', password: form.password })
    setForm((f) => ({ ...f, password: '' }))
    toast('2FA disabled')
    refresh()
    setView('menu')
  })

  return (
    <div className="admin-card">
      <h2><i className="fa-solid fa-users-gear"></i> Manage Users</h2>
      <p className="cms-admin-sub">Site users and your account credentials.</p>

      {/* ----- Lista de usuarios ----- */}
      <div className="cms-audit-table-wrap">
        <table className="cms-audit-table">
          <thead><tr><th>User</th><th>2FA</th><th>Last login</th><th>Created</th></tr></thead>
          <tbody>
            {users.length === 0 && <tr><td colSpan={4} className="cms-audit-empty">Loading users…</td></tr>}
            {users.map((u) => (
              <tr key={u.username}>
                <td>
                  {u.username}
                  {u.username === state.username && <span className="cms-tag" style={{ marginLeft: 8 }}>your session</span>}
                </td>
                <td>
                  <span className="cms-tag" style={{ color: u.totpEnabled ? 'var(--color-primary)' : undefined }}>
                    <i className={`fa-solid ${u.totpEnabled ? 'fa-shield-halved' : 'fa-shield'}`}></i> {u.totpEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </td>
                <td>{u.lastLoginAt ? fmtDate(new Date(u.lastLoginAt).getTime()) : 'Never'}</td>
                <td>{fmtDate(new Date(u.createdAt).getTime())}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ----- Mi cuenta ----- */}
      <h3 style={{ marginTop: '2rem' }}><i className="fa-solid fa-id-card"></i> My account — {state.username}</h3>

      {view === 'menu' && (
        <div className="admin-quick" style={{ marginTop: '1rem' }}>
          <button type="button" className="cms-btn" onClick={() => setView('username')}>
            <i className="fa-solid fa-user-pen"></i> Change username
          </button>
          <button type="button" className="cms-btn" onClick={() => setView('password')}>
            <i className="fa-solid fa-key"></i> Change password
          </button>
          {me?.totpEnabled ? (
            <button type="button" className="cms-btn" onClick={() => setView('2fa-disable')}>
              <i className="fa-solid fa-shield-halved"></i> Disable 2FA
            </button>
          ) : (
            <button type="button" className="cms-btn cms-btn--primary" disabled={busy} onClick={start2fa}>
              <i className="fa-solid fa-shield-halved"></i> Enable 2FA
            </button>
          )}
        </div>
      )}

      {view === 'username' && (
        <div className="cms-login-form" style={{ maxWidth: 420, marginTop: '1rem' }}>
          <label className="cms-field"><span>New username</span>
            <input type="text" value={form.username} onChange={set('username')} autoComplete="off" />
          </label>
          <div className="cms-confirm-actions">
            <button type="button" className="cms-btn cms-btn-cancel" onClick={back}>Cancel</button>
            <button type="button" className="cms-btn cms-btn--primary" disabled={busy || form.username.trim().length < 3} onClick={saveUsername}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {view === 'password' && (
        <div className="cms-login-form" style={{ maxWidth: 420, marginTop: '1rem' }}>
          <label className="cms-field"><span>Current password</span>
            <input type="password" value={form.current} onChange={set('current')} />
          </label>
          <label className="cms-field"><span>New password (min 8 characters)</span>
            <input type="password" value={form.next} onChange={set('next')} />
          </label>
          <label className="cms-field"><span>Repeat new password</span>
            <input type="password" value={form.repeat} onChange={set('repeat')} />
          </label>
          <div className="cms-confirm-actions">
            <button type="button" className="cms-btn cms-btn-cancel" onClick={back}>Cancel</button>
            <button
              type="button" className="cms-btn cms-btn--primary"
              disabled={busy || !form.current || form.next.length < 8 || !form.repeat}
              onClick={savePassword}
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {view === '2fa-setup' && qr && (
        <div style={{ marginTop: '1rem' }}>
          <h4><i className="fa-solid fa-list-check"></i> Setup Guide</h4>
          <ol className="cms-2fa-guide" style={{ margin: '0.8rem 0 1.2rem', paddingLeft: '1.2rem', display: 'grid', gap: '0.6rem' }}>
            {GUIDE_STEPS.map((s, i) => (
              <li key={i}><i className={`fa-solid ${s.icon}`} style={{ width: 20, marginRight: 6 }}></i>{s.text}</li>
            ))}
          </ol>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ textAlign: 'center' }}>
              {/* dataURL generado en el cliente desde el otpauth URI, no es media del CMS */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr.img} alt="QR code to set up 2FA in your authenticator app" width={200} height={200} style={{ borderRadius: 10, display: 'block' }} />
              <p className="cms-hint" style={{ wordBreak: 'break-all', maxWidth: 220 }}>Manual key: <code>{qr.secret}</code></p>
            </div>
            <div className="cms-login-form" style={{ maxWidth: 320, flex: 1 }}>
              <label className="cms-field"><span>6-digit code from app</span>
                <input type="text" maxLength={6} inputMode="numeric" value={form.code} onChange={set('code')} autoComplete="off" />
              </label>
              <div className="cms-confirm-actions">
                <button type="button" className="cms-btn cms-btn-cancel" onClick={back}>Cancel</button>
                <button type="button" className="cms-btn cms-btn--primary" disabled={busy || form.code.length !== 6} onClick={enable2fa}>
                  {busy ? 'Verifying…' : 'Confirm and enable'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {view === '2fa-disable' && (
        <div className="cms-login-form" style={{ maxWidth: 420, marginTop: '1rem' }}>
          <p className="cms-hint">Enter your password to disable 2FA. Your account will be protected only by username and password.</p>
          <label className="cms-field"><span>Password</span>
            <input type="password" value={form.password} onChange={set('password')} />
          </label>
          <div className="cms-confirm-actions">
            <button type="button" className="cms-btn cms-btn-cancel" onClick={back}>Cancel</button>
            <button type="button" className="cms-btn cms-btn-danger" disabled={busy || !form.password} onClick={disable2fa}>
              {busy ? 'Verifying…' : 'Disable 2FA'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

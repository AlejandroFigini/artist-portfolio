'use client'

/* "Administrar usuarios" (Gestión) — reemplaza al viejo mock de "Gestión de
   usuarios" y al "Mi cuenta" de la tuerca admin:
   - Lista completa de usuarios con último inicio de sesión (GET /api/users).
   - El usuario logeado edita SUS credenciales (username + contraseña).
   - Activación de 2FA con guía paso a paso (app autenticadora + QR). */

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { toDataURL } from 'qrcode'
import { state, useCmsStore, setAdminFlag, recordAudit } from '@/lib/cms/store'
import { updateAccount, twoFa, getUsers, createUser, updateUserAdmin, deleteUserAdmin, getSessionPolicy, setSessionPolicy, resetAllSessions, type UserRow } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import PasswordInput from '@/components/ui/PasswordInput'
import { fmtDate } from '@/lib/utils'

type View = 'menu' | 'username' | 'password' | '2fa-setup' | '2fa-disable' | 'create-user' | 'manage-user'

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
  const [openMenuUser, setOpenMenuUser] = useState<string | null>(null)
  // Rect del botón engranaje al abrir → el menú se posiciona fixed sobre él
  // (portal a body). Antes era absolute dentro del <td> y la tabla lo clippeaba.
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null)
  const [busy, setBusy] = useState(false)
  const [activeUser, setActiveUser] = useState<UserRow | null>(null)
  const [qr, setQr] = useState<{ img: string; secret: string } | null>(null)
  const [form, setForm] = useState({ username: '', current: '', next: '', repeat: '', code: '', password: '', newRole: 'demo', sessionTtl: '60', demoLock: '0' })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const [sessionMax, setSessionMax] = useState('0') // minutos; '0' = sin tope
  const [savedSessionMax, setSavedSessionMax] = useState('0') // último valor guardado (para el dirty del Save)
  const refresh = useCallback(() => { getUsers().then(setUsers) }, [])
  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    if (state.role !== 'owner' && state.role !== 'demo') return
    getSessionPolicy().then((p) => { const v = String(p.maxMinutes ?? 0); setSessionMax(v); setSavedSessionMax(v) }).catch(() => {})
  }, [])

  const me = users.find((u) => u.username === state.username)

  const run = (fn: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    fn().catch((e: Error) => toast(e.message || 'Error', 'error')).finally(() => setBusy(false))
  }

  const saveUsername = () => run(async () => {
    const user = await updateAccount({ username: form.username })
    setAdminFlag(true, user.username)
    setForm((f) => ({ ...f, username: '' }))
    recordAudit({ user: state.username, section: 'Users', label: 'My Account', summary: 'Changed username' })
    toast('Username updated')
    refresh()
    setView('menu')
  })

  const savePassword = () => run(async () => {
    if (form.next !== form.repeat) throw new Error('Passwords do not match')
    await updateAccount({ currentPassword: form.current, newPassword: form.next })
    setForm((f) => ({ ...f, current: '', next: '', repeat: '' }))
    recordAudit({ user: state.username, section: 'Users', label: 'My Account', summary: 'Changed password' })
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
    recordAudit({ user: state.username, section: 'Users', label: 'My Account', summary: 'Enabled 2FA' })
    toast('2FA enabled')
    refresh()
    setView('menu')
  })

  const disable2fa = () => run(async () => {
    await twoFa({ action: 'disable', password: form.password })
    setForm((f) => ({ ...f, password: '' }))
    recordAudit({ user: state.username, section: 'Users', label: 'My Account', summary: 'Disabled 2FA' })
    toast('2FA disabled')
    refresh()
    setView('menu')
  })

  const handleCreateUser = () => run(async () => {
    if (form.next !== form.repeat) throw new Error('Passwords do not match')
    await createUser({ username: form.username, password: form.next, role: form.newRole })
    setForm((f) => ({ ...f, username: '', next: '', repeat: '', newRole: 'demo' }))
    recordAudit({ user: state.username, section: 'Users', label: 'Management', summary: `Created user ${form.username} (${form.newRole})` })
    toast('User created successfully')
    refresh()
    setView('menu')
  })

  const handleBlockUser = (u: UserRow, blocked: boolean) => run(async () => {
    await updateUserAdmin(u.username, { action: 'block', is_blocked: blocked })
    recordAudit({ user: state.username, section: 'Users', label: 'Management', summary: `${blocked ? 'Blocked' : 'Unblocked'} user ${u.username}` })
    toast(`User ${u.username} ${blocked ? 'blocked' : 'unblocked'}`)
    refresh()
    if (activeUser?.username === u.username) setActiveUser({ ...u, isBlocked: blocked })
  })

  const handleRoleChange = (u: UserRow, newRole: string) => run(async () => {
    await updateUserAdmin(u.username, { action: 'role', role: newRole })
    recordAudit({ user: state.username, section: 'Users', label: 'Management', summary: `Changed role of ${u.username} to ${newRole}` })
    toast(`Role changed to ${newRole}`)
    refresh()
    if (activeUser?.username === u.username) setActiveUser({ ...u, role: newRole })
  })

  const handleForceReset = (u: UserRow) => run(async () => {
    await updateUserAdmin(u.username, { action: 'reset' })
    recordAudit({ user: state.username, section: 'Users', label: 'Management', summary: `Forced reset for ${u.username}` })
    toast(`Force reset applied to ${u.username}`)
  })

  const handleSetTtl = (u: UserRow) => run(async () => {
    const minutes = parseInt(form.sessionTtl, 10)
    await updateUserAdmin(u.username, { action: 'ttl', session_ttl_minutes: minutes })
    recordAudit({ user: state.username, section: 'Users', label: 'Management', summary: `Set session TTL for ${u.username} to ${minutes}m` })
    toast(`Session TTL updated for ${u.username}`)
    refresh()
    if (activeUser?.username === u.username) setActiveUser({ ...u, sessionTtlMinutes: minutes })
  })

  const handleDemoLock = (u: UserRow) => run(async () => {
    const minutes = parseInt(form.demoLock, 10) || 0
    await updateUserAdmin(u.username, { action: 'demo_lock', demo_lock_interval_minutes: minutes > 0 ? minutes : null })
    recordAudit({ user: state.username, section: 'Users', label: 'Management', summary: minutes > 0 ? `Set demo auto-lock for ${u.username} to ${minutes}m` : `Disabled demo auto-lock for ${u.username}` })
    toast(minutes > 0 ? 'Demo auto-lock updated' : 'Demo auto-lock disabled')
    refresh()
    if (activeUser?.username === u.username) setActiveUser({ ...u, demoLockIntervalMinutes: minutes > 0 ? minutes : null })
  })

  const handleKillSessions = (u: UserRow) => run(async () => {
    await updateUserAdmin(u.username, { action: 'kill_sessions' })
    recordAudit({ user: state.username, section: 'Users', label: 'Management', summary: `Killed active sessions for ${u.username}` })
    toast(`All sessions for ${u.username} destroyed`)
  })

  const handleUpdateCreds = (u: UserRow) => run(async () => {
    if (form.next && form.next !== form.repeat) throw new Error('Passwords do not match')
    await updateUserAdmin(u.username, { action: 'credentials', newUsername: form.username, newPassword: form.next })
    recordAudit({ user: state.username, section: 'Users', label: 'Management', summary: `Updated credentials for ${u.username}` })
    toast(`Credentials updated successfully`)
    setForm(f => ({ ...f, next: '', repeat: '' }))
    if (form.username && form.username !== u.username) {
      setView('menu')
    }
    refresh()
  })

  const saveSessionPolicy = () => run(async () => {
    const m = parseInt(sessionMax, 10) || 0
    await setSessionPolicy(m > 0 ? m : null)
    setSavedSessionMax(sessionMax)
    recordAudit({ user: state.username, section: 'Users', label: 'Management', summary: `Set global session max to ${m > 0 ? m + 'm' : 'off'}` })
    toast('Session policy saved')
  })

  const handleResetAll = () => run(async () => {
    if (!confirm('Reset ALL sessions now? Everyone will be logged out (except your current session).')) return
    const n = await resetAllSessions()
    recordAudit({ user: state.username, section: 'Users', label: 'Management', summary: `Reset all sessions (${n} killed)` })
    toast(`${n} session(s) reset`)
  })

  const handleDeleteUser = (u: UserRow) => run(async () => {
    if (!confirm(`Are you sure you want to completely delete ${u.username}?`)) return
    await deleteUserAdmin(u.username)
    recordAudit({ user: state.username, section: 'Users', label: 'Management', summary: `Deleted user ${u.username}` })
    toast(`User ${u.username} deleted`)
    refresh()
    setView('menu')
  })

  return (
    <div className="admin-card">
      <h2><i className="fa-solid fa-users-gear"></i> Manage Users</h2>
      <p className="cms-admin-sub">Site users and your account credentials.</p>

      {/* ----- Lista de usuarios ----- */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        {state.role === 'owner' && view !== 'create-user' && (
          <button type="button" className="cms-btn cms-btn--primary" onClick={() => {
            setForm(f => ({ ...f, username: '', next: '', repeat: '', newRole: 'demo' }))
            setView('create-user')
          }}>
            <i className="fa-solid fa-user-plus"></i> Create User
          </button>
        )}
      </div>

      {view === 'create-user' && (
        <div style={{ background: 'color-mix(in srgb, var(--bg-primary) 96%, var(--text-primary))', borderRadius: '10px', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Create New User</div>
            <button type="button" className="cms-btn" onClick={() => setView('menu')}>
              <i className="fa-solid fa-xmark"></i> Cancel
            </button>
          </div>
          <div className="cms-login-form" style={{ padding: '1.5rem', borderTop: '1px solid var(--border)', background: 'color-mix(in srgb, var(--bg-primary) 94%, var(--text-primary))' }}>
            <label className="cms-field"><span>Username (min 3 chars)</span>
              <input type="text" value={form.username} onChange={set('username')} autoComplete="off" name="cms-new-user" />
            </label>
            {/* autoComplete="new-password" evita que el gestor del navegador
                autocomplete las credenciales del owner en el alta. */}
            <label className="cms-field"><span>Temporary password{form.newRole === 'demo' ? '' : ' (the user resets it on first login)'}</span>
              <PasswordInput value={form.next} onChange={set('next')} autoComplete="new-password" />
            </label>
            <label className="cms-field"><span>Repeat password</span>
              <PasswordInput value={form.repeat} onChange={set('repeat')} autoComplete="new-password" />
            </label>
            <label className="cms-field"><span>Role</span>
              <select value={form.newRole} onChange={e => setForm(f => ({ ...f, newRole: e.target.value }))} style={{ padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                <option value="demo">Demo (Read-only sandbox)</option>
                <option value="admin">Admin (Full access, no user management)</option>
              </select>
            </label>
            <div className="cms-confirm-actions">
              <button
                type="button" className="cms-btn cms-btn--primary"
                disabled={busy || form.username.length < 3 || form.next.length < 1 || !form.repeat}
                onClick={handleCreateUser}
              >
                {busy ? 'Creating…' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="cms-audit-table-wrap" style={{ display: view === 'create-user' ? 'none' : 'block' }}>
        <table className="cms-audit-table">
          <thead><tr><th>User</th><th>Role</th><th>2FA</th><th>Last login</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            {users.length === 0 && <tr><td colSpan={6} className="cms-audit-empty">Loading users…</td></tr>}
            {users.map((u) => (
              <tr key={u.username}>
                <td>
                  {u.username}
                  {u.isBlocked && (
                    <i className="fa-solid fa-lock" title="Blocked" style={{ color: '#d32f2f', marginLeft: 8 }}></i>
                  )}
                  {u.username === state.username && <span className="cms-tag" style={{ marginLeft: 8 }}>your session</span>}
                </td>
                <td>
                  {/* El rol es una propiedad estable del usuario: el bloqueo NO lo
                      pisa (eso vive junto al nombre como candado). Colores de fondo
                      explícitos + texto blanco → contraste garantizado (var(--color-primary)
                      era casi blanco y dejaba el tag admin ilegible). */}
                  <span className="cms-tag" style={{ background: u.role === 'demo' ? '#ea8a00' : u.role === 'owner' ? 'var(--accent)' : '#2563eb', color: '#fff' }}>
                    {u.role ? u.role.toUpperCase() : 'UNKNOWN'}
                  </span>
                </td>
                <td>
                  <span className="cms-tag" style={{ color: u.totpEnabled ? 'var(--color-primary)' : undefined }}>
                    <i className={`fa-solid ${u.totpEnabled ? 'fa-shield-halved' : 'fa-shield'}`}></i> {u.totpEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </td>
                <td>{u.lastLoginAt ? fmtDate(new Date(u.lastLoginAt).getTime()) : 'Never'}</td>
                <td>{fmtDate(new Date(u.createdAt).getTime())}</td>
                <td>
                  {state.role === 'owner' && u.username !== state.username && u.role !== 'owner' && (
                    <>
                      <button type="button" className="cms-btn" style={{ padding: '0.4rem 0.6rem' }} onClick={(e) => {
                        if (openMenuUser === u.username) { setOpenMenuUser(null); return }
                        setMenuRect(e.currentTarget.getBoundingClientRect())
                        setOpenMenuUser(u.username)
                      }}>
                        <i className="fa-solid fa-gear"></i>
                      </button>

                      {openMenuUser === u.username && menuRect && createPortal(
                        <>
                          {/* backdrop transparente: cierra al click afuera */}
                          <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setOpenMenuUser(null)} />
                          <div style={{ position: 'fixed', top: menuRect.bottom + 4, right: Math.max(8, window.innerWidth - menuRect.right), zIndex: 9999, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', minWidth: '200px', padding: '0.5rem', overflow: 'hidden' }}>
                            <button type="button" style={{ textAlign: 'left', padding: '0.6rem', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)' }} onClick={() => { handleBlockUser(u, !u.isBlocked); setOpenMenuUser(null) }}>
                              <i className={`fa-solid ${u.isBlocked ? 'fa-unlock' : 'fa-lock'}`} style={{ width: 20 }}></i> {u.isBlocked ? 'Unblock' : 'Block'}
                            </button>

                            <button type="button" style={{ textAlign: 'left', padding: '0.6rem', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)' }} onClick={() => { handleRoleChange(u, u.role === 'demo' ? 'admin' : 'demo'); setOpenMenuUser(null) }}>
                              <i className="fa-solid fa-user-shield" style={{ width: 20 }}></i> Make {u.role === 'demo' ? 'Admin' : 'Demo'}
                            </button>

                            <button type="button" style={{ textAlign: 'left', padding: '0.6rem', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)' }} onClick={() => { handleForceReset(u); setOpenMenuUser(null) }}>
                              <i className="fa-solid fa-rotate-left" style={{ width: 20 }}></i> Force Reset
                            </button>

                            <button type="button" style={{ textAlign: 'left', padding: '0.6rem', border: 'none', background: 'transparent', cursor: 'pointer', color: '#ff9800', borderBottom: '1px solid var(--border)' }} onClick={() => { handleKillSessions(u); setOpenMenuUser(null) }}>
                              <i className="fa-solid fa-skull" style={{ width: 20 }}></i> Kill Sessions
                            </button>

                            <button type="button" style={{ textAlign: 'left', padding: '0.6rem', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)' }} onClick={() => {
                              setActiveUser(u)
                              // New Username arranca VACÍO (no se prellena con el actual): se
                              // deja en blanco para no reenviar el mismo nombre sin querer.
                              setForm(f => ({ ...f, username: '', next: '', repeat: '', newRole: u.role, sessionTtl: String(u.sessionTtlMinutes || 60), demoLock: String(u.demoLockIntervalMinutes || 0) }))
                              setView('manage-user')
                              setOpenMenuUser(null)
                            }}>
                              <i className="fa-solid fa-key" style={{ width: 20 }}></i> Credentials & TTL
                            </button>

                            <button type="button" style={{ textAlign: 'left', padding: '0.6rem', border: 'none', background: 'transparent', cursor: 'pointer', color: '#d32f2f' }} onClick={() => { handleDeleteUser(u); setOpenMenuUser(null) }}>
                              <i className="fa-solid fa-trash" style={{ width: 20 }}></i> Delete User
                            </button>
                          </div>
                        </>,
                        document.body
                      )}
                    </>
                  )}
                  {/* El admin no ve el engranaje sobre otros usuarios, pero sí sobre el
                      demo: bloquear/desbloquear, matar sesiones y editar credenciales
                      (sin las políticas automáticas de expiración/auto-lock, solo owner). */}
                  {state.role === 'admin' && u.role === 'demo' && (
                    <button type="button" className="cms-btn" style={{ padding: '0.4rem 0.6rem' }} title="Manage demo user" onClick={() => {
                      setActiveUser(u)
                      setForm(f => ({ ...f, username: '', next: '', repeat: '', demoLock: String(u.demoLockIntervalMinutes || 0), sessionTtl: String(u.sessionTtlMinutes || 60) }))
                      setView('manage-user')
                    }}>
                      <i className="fa-solid fa-gear"></i>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ----- Política de sesiones (owner; demo la ve en modo mock/no-op) ----- */}
      {(state.role === 'owner' || state.role === 'demo') && view !== 'create-user' && (
        <div style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '1rem', marginTop: '1.5rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', background: 'color-mix(in srgb, var(--bg-primary) 97%, var(--text-primary))' }}>
          <div style={{ minWidth: 0, flex: '1 1 240px' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}><i className="fa-solid fa-clock-rotate-left" style={{ marginRight: 6 }}></i> Session policy</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>Max session lifetime, counted from each login — every user re-logs in when theirs expires. Applies to all roles.</div>
          </div>
          <select value={sessionMax} onChange={(e) => setSessionMax(e.target.value)} style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
            <option value="0">No limit</option>
            <option value="60">1 hour</option>
            <option value="480">8 hours</option>
            <option value="1440">24 hours</option>
            <option value="4320">3 days</option>
            <option value="10080">7 days</option>
          </select>
          <button type="button" className="cms-btn cms-btn--primary cms-btn--sm" disabled={busy || sessionMax === savedSessionMax} onClick={saveSessionPolicy}>Save</button>
          <button type="button" className="cms-btn cms-btn--sm cms-btn--danger-ghost" disabled={busy} onClick={handleResetAll}>
            <i className="fa-solid fa-skull"></i> Reset all sessions now
          </button>
        </div>
      )}

      {view === 'manage-user' && activeUser && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden', width: '100%', maxWidth: 500, boxShadow: '0 20px 40px rgba(0,0,0,0.3)', margin: '1rem', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Manage: {activeUser.username}</div>
              <button type="button" className="cms-btn" onClick={() => setView('menu')}>
                <i className="fa-solid fa-xmark"></i> Close
              </button>
            </div>
            <div className="cms-login-form" style={{ padding: '1.5rem', overflowY: 'auto' }} data-lenis-prevent>

              {activeUser.role === 'demo' && (
                <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '1rem', border: '1px solid var(--border)' }}>
                  <h4 style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}><i className="fa-solid fa-stopwatch"></i> Demo Controls</h4>

                  {/* Estado de bloqueo — informativo, visible para owner y admin. */}
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>
                    {activeUser.isBlocked
                      ? 'Currently BLOCKED. Unblock to restart the timer.'
                      : activeUser.demoLockAt
                        ? `Next auto-lock: ${fmtDate(new Date(activeUser.demoLockAt).getTime())}`
                        : 'Auto-lock is off.'}
                  </div>

                  {/* Bloquear/desbloquear manual — owner + admin */}
                  <button
                    type="button"
                    className={activeUser.isBlocked ? 'cms-btn cms-btn--primary' : 'cms-btn cms-btn-danger'}
                    style={{ width: '100%', justifyContent: 'center', marginBottom: '0.75rem' }}
                    disabled={busy}
                    onClick={() => handleBlockUser(activeUser, !activeUser.isBlocked)}
                  >
                    <i className={`fa-solid ${activeUser.isBlocked ? 'fa-unlock' : 'fa-lock'}`}></i> {activeUser.isBlocked ? 'Unblock now' : 'Block now'}
                  </button>

                  {/* Matar sesiones activas — owner + admin */}
                  <button type="button" className="cms-btn cms-btn-danger" style={{ width: '100%', justifyContent: 'center' }} disabled={busy} onClick={() => handleKillSessions(activeUser)}>
                    <i className="fa-solid fa-skull"></i> Kill Active Sessions
                  </button>

                  {/* Políticas AUTOMÁTICAS (expiración de sesión + auto-bloqueo recurrente)
                      — SOLO owner. El admin gestiona manualmente, sin configurar políticas. */}
                  {state.role === 'owner' && (
                    <>
                      <h4 style={{ margin: '1rem 0 0.4rem', fontSize: '0.9rem' }}><i className="fa-solid fa-hourglass-half"></i> Session expiry (auto)</h4>
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                        <select value={form.sessionTtl} onChange={e => setForm(f => ({ ...f, sessionTtl: e.target.value }))} style={{ flex: 1, padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                          <option value="10">10 Minutes</option>
                          <option value="15">15 Minutes</option>
                          <option value="30">30 Minutes</option>
                          <option value="60">1 Hour</option>
                          <option value="1440">24 Hours</option>
                        </select>
                        <button type="button" className="cms-btn cms-btn--primary" disabled={busy || form.sessionTtl === String(activeUser.sessionTtlMinutes || 60)} onClick={() => handleSetTtl(activeUser)}>
                          Set Expiry
                        </button>
                      </div>
                      <h4 style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}><i className="fa-solid fa-user-lock"></i> Auto-lock</h4>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <select value={form.demoLock} onChange={e => setForm(f => ({ ...f, demoLock: e.target.value }))} style={{ flex: 1, padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                          <option value="0">Off (never auto-lock)</option>
                          <option value="60">Every 1 hour</option>
                          <option value="1440">Every 24 hours</option>
                          <option value="4320">Every 3 days</option>
                          <option value="10080">Every 7 days</option>
                        </select>
                        <button type="button" className="cms-btn cms-btn--primary" disabled={busy || form.demoLock === String(activeUser.demoLockIntervalMinutes || 0)} onClick={() => handleDemoLock(activeUser)}>
                          Save
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Credenciales: owner (cualquier usuario) o admin (solo el demo). */}
              {(state.role === 'owner' || (state.role === 'admin' && activeUser.role === 'demo')) && (<>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>Directly Change Credentials</h4>
              <label className="cms-field"><span>New Username</span>
                <input type="text" value={form.username} onChange={set('username')} autoComplete="off" name="cms-edit-user" placeholder={`Leave blank to keep "${activeUser.username}"`} />
              </label>
              <label className="cms-field"><span>New Password</span>
                <PasswordInput value={form.next} onChange={set('next')} autoComplete="new-password" />
              </label>
              <label className="cms-field"><span>Repeat New Password</span>
                <PasswordInput value={form.repeat} onChange={set('repeat')} autoComplete="new-password" />
              </label>
              <div className="cms-confirm-actions">
                <button
                  type="button" className="cms-btn cms-btn--primary"
                  disabled={busy || (!form.username && !form.next)}
                  onClick={() => handleUpdateCreds(activeUser)}
                >
                  {busy ? 'Saving…' : 'Update Credentials'}
                </button>
              </div>
              </>)}
            </div>
          </div>
        </div>
      )}

      {/* ----- Mi cuenta ----- */}
      <h2 style={{ marginTop: '2.5rem', marginBottom: '1rem', display: view === 'create-user' ? 'none' : 'block' }}>
        <i className="fa-solid fa-user-pen"></i> Edit Account
      </h2>

      <div style={{ display: view === 'create-user' ? 'none' : 'block', maxWidth: 600, border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', background: 'color-mix(in srgb, var(--bg-primary) 97%, var(--text-primary))' }}>

        {/* Username row */}
        <div style={{ borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', padding: '0.85rem 1rem' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Username</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{state.username}</div>
            </div>
            {/* Cualquier rol edita su propio username; el servidor rechaza el
                duplicado. Cambiar el de OTRO usuario sigue siendo del owner. */}
            <button type="button" className="cms-btn cms-btn--sm" onClick={() => setView(view === 'username' ? 'menu' : 'username')}>
              {view === 'username' ? <><i className="fa-solid fa-xmark"></i> Cancel</> : <><i className="fa-solid fa-pen"></i> Edit</>}
            </button>
          </div>
          {view === 'username' && (
            <div className="cms-login-form" style={{ padding: '0 1rem 1rem' }}>
              <label className="cms-field"><span>New username</span>
                <input type="text" value={form.username} onChange={set('username')} autoComplete="off" />
              </label>
              <div className="cms-confirm-actions">
                <button type="button" className="cms-btn cms-btn--primary" disabled={busy || form.username.trim().length < 3} onClick={saveUsername}>
                  {busy ? 'Saving…' : 'Save username'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Password row */}
        <div style={{ borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', padding: '0.85rem 1rem' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Password</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '3px', marginTop: '0.1rem' }}>••••••••</div>
            </div>
            <button type="button" className="cms-btn cms-btn--sm" onClick={() => setView(view === 'password' ? 'menu' : 'password')}>
              {view === 'password' ? <><i className="fa-solid fa-xmark"></i> Cancel</> : <><i className="fa-solid fa-key"></i> Update</>}
            </button>
          </div>
          {view === 'password' && (
            <div className="cms-login-form" style={{ padding: '0 1rem 1rem' }}>
              <label className="cms-field"><span>Current password</span>
                <PasswordInput value={form.current} onChange={set('current')} autoComplete="current-password" />
              </label>
              <label className="cms-field"><span>New password (min 8 characters)</span>
                <PasswordInput value={form.next} onChange={set('next')} autoComplete="new-password" />
              </label>
              <label className="cms-field"><span>Repeat new password</span>
                <PasswordInput value={form.repeat} onChange={set('repeat')} autoComplete="new-password" />
              </label>
              <div className="cms-confirm-actions">
                <button
                  type="button" className="cms-btn cms-btn--primary"
                  disabled={busy || !form.current || form.next.length < 8 || !form.repeat}
                  onClick={savePassword}
                >
                  {busy ? 'Saving…' : 'Update password'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 2FA row */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', padding: '0.85rem 1rem' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>2FA Security</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: me?.totpEnabled ? 'var(--accent)' : 'var(--text-secondary)', marginTop: '0.1rem' }}>
                {me?.totpEnabled ? <><i className="fa-solid fa-shield-halved"></i> Enabled</> : 'Disabled'}
              </div>
            </div>
            {/* Demo efímero: no puede activar 2FA (su sesión no persiste ni tiene
                sentido un segundo factor). Se muestra deshabilitado, sin QR ni guía. */}
            {state.role === 'demo' ? (
              <span className="cms-tag" title="2FA is not available for the demo user" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <i className="fa-solid fa-lock"></i> Not available
              </span>
            ) : me?.totpEnabled ? (
              <button type="button" className="cms-btn cms-btn--sm" onClick={() => setView(view === '2fa-disable' ? 'menu' : '2fa-disable')}>
                {view === '2fa-disable' ? <><i className="fa-solid fa-xmark"></i> Cancel</> : 'Disable 2FA'}
              </button>
            ) : (
              <button type="button" className="cms-btn cms-btn--primary cms-btn--sm" onClick={() => view === '2fa-setup' ? setView('menu') : start2fa()}>
                {view === '2fa-setup' ? <><i className="fa-solid fa-xmark"></i> Cancel</> : <><i className="fa-solid fa-shield-halved"></i> Enable 2FA</>}
              </button>
            )}
          </div>

          {view === '2fa-setup' && qr && state.role !== 'demo' && (
            <div style={{ padding: '0 1rem 1rem' }}>
              <h4><i className="fa-solid fa-list-check"></i> Setup Guide</h4>
              <ol className="cms-2fa-guide" style={{ margin: '0.8rem 0 1.2rem', paddingLeft: '1.2rem', display: 'grid', gap: '0.6rem' }}>
                {GUIDE_STEPS.map((s, i) => (
                  <li key={i}><i className={`fa-solid ${s.icon}`} style={{ width: 20, marginRight: 6 }}></i>{s.text}</li>
                ))}
              </ol>
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div style={{ textAlign: 'center', background: 'white', padding: '0.5rem', borderRadius: '10px' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr.img} alt="QR code" width={200} height={200} style={{ display: 'block' }} />
                </div>
                <div className="cms-login-form" style={{ maxWidth: 320, flex: 1 }}>
                  <label className="cms-field"><span>6-digit code from app</span>
                    <input type="text" maxLength={6} inputMode="numeric" value={form.code} onChange={set('code')} autoComplete="off" style={{ letterSpacing: '0.3em', fontSize: '1.2rem', fontFamily: 'monospace' }} />
                  </label>
                  <div className="cms-confirm-actions">
                    <button type="button" className="cms-btn cms-btn--primary" disabled={busy || form.code.length !== 6} onClick={enable2fa}>
                      {busy ? 'Verifying…' : 'Confirm & Enable'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {view === '2fa-disable' && (
            <div className="cms-login-form" style={{ padding: '0 1rem 1rem' }}>
              <p className="cms-hint">Enter your password to disable 2FA. Your account will be protected only by username and password.</p>
              <label className="cms-field"><span>Password</span>
                <PasswordInput value={form.password} onChange={set('password')} />
              </label>
              <div className="cms-confirm-actions">
                <button type="button" className="cms-btn cms-btn-danger" disabled={busy || !form.password} onClick={disable2fa}>
                  {busy ? 'Verifying…' : 'Disable 2FA'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

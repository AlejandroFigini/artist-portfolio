'use client'

import { useState } from 'react'
import { updateAccount, logout } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { setAdminFlag } from '@/lib/cms/store'

export default function ForceSetupView() {
  const toast = useToast()
  const [form, setForm] = useState({ username: '', newPassword: '', repeatPassword: '' })
  const [busy, setBusy] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = () => {
    if (form.newPassword !== form.repeatPassword) {
      toast('Passwords do not match', 'error')
      return
    }
    if (form.username.length < 3) {
      toast('Username must be at least 3 characters', 'error')
      return
    }
    if (form.newPassword.length < 8) {
      toast('Password must be at least 8 characters', 'error')
      return
    }

    setBusy(true)
    // NOTE: /api/account PATCH will enforce that both are changed because needsSetup is true
    updateAccount({ username: form.username, newPassword: form.newPassword })
      .then((account) => {
        toast('Setup completed successfully!')
        // Actualizar el estado global con los nuevos datos y el flag apagado
        setAdminFlag(true, account.username, account.role, false)
      })
      .catch((e: Error) => toast(e.message || 'Error updating account', 'error'))
      .finally(() => setBusy(false))
  }

  return (
    <div className="admin-card" style={{ maxWidth: 500, margin: '4rem auto' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
        <i className="fa-solid fa-lock" style={{ color: 'var(--color-primary)' }}></i> Welcome
      </h2>
      <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        For security reasons, you must change your username and password before accessing the dashboard.
      </p>

      <div className="cms-login-form">
        <label className="cms-field">
          <span>New Username (min 3 chars)</span>
          <input type="text" value={form.username} onChange={set('username')} autoComplete="off" />
        </label>
        
        <label className="cms-field">
          <span>New Password (min 8 chars)</span>
          <input type="password" value={form.newPassword} onChange={set('newPassword')} />
        </label>

        <label className="cms-field">
          <span>Repeat New Password</span>
          <input type="password" value={form.repeatPassword} onChange={set('repeatPassword')} />
        </label>

        <div className="cms-confirm-actions" style={{ marginTop: '2rem' }}>
          <button
            type="button"
            className="cms-btn cms-btn--secondary"
            disabled={busy}
            onClick={() => {
              logout().finally(() => {
                setAdminFlag(false)
                toast('Logged out')
                window.location.href = '/'
              })
            }}
            style={{ width: '100%', justifyContent: 'center', marginBottom: '1rem' }}
          >
            Cancel and Log out
          </button>
          <button
            type="button"
            className="cms-btn cms-btn--primary"
            disabled={busy || !form.username || !form.newPassword || !form.repeatPassword}
            onClick={submit}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {busy ? 'Saving...' : 'Complete Setup'}
          </button>
        </div>
      </div>
    </div>
  )
}

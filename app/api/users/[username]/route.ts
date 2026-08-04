import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { requireRole, hashPassword, destroyOtherSessions } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* PATCH /api/users/[username] → Múltiples acciones sobre un usuario. */
export async function PATCH(req: Request, { params }: { params: Promise<{ username: string }> }) {
  const auth = await requireRole(req, ['owner'])
  if ('deny' in auth) return auth.deny

  const { username: targetUsername } = await params
  if (!targetUsername) return NextResponse.json({ success: false, error: 'Username required' }, { status: 400 })

  const pool = getPool()!
  const targetUserRes = await pool.query('SELECT id, role, is_blocked FROM users WHERE username = $1', [targetUsername])
  if (targetUserRes.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
  }
  const targetUser = targetUserRes.rows[0]

  /* El body llega de la red: se tipa como parcial y cada rama valida lo suyo.
     No se asume la unión de AdminUserUpdate — eso describe lo que manda
     nuestro cliente, no lo que puede llegar realmente al endpoint. */
  let body: Partial<{
    action: string
    is_blocked: boolean
    role: string
    session_ttl_minutes: number | null
    newUsername: string
    newPassword: string
  }>
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }

  const action = body.action

  try {
    if (action === 'block') {
      if (targetUser.role === 'owner' && auth.user.username === targetUsername) {
        return NextResponse.json({ success: false, error: 'Cannot block yourself' }, { status: 400 })
      }
      const newBlockedStatus = !!body.is_blocked
      await pool.query('UPDATE users SET is_blocked = $1 WHERE id = $2', [newBlockedStatus, targetUser.id])
      if (newBlockedStatus) {
        await pool.query('DELETE FROM sessions WHERE user_id = $1', [targetUser.id]) // Kill sessions if blocked
      }
      return NextResponse.json({ success: true })
    }

    if (action === 'role') {
      if (targetUser.role === 'owner') {
        return NextResponse.json({ success: false, error: 'Cannot change role of an owner' }, { status: 400 })
      }
      const newRole = body.role
      if (!newRole || !['admin', 'demo'].includes(newRole)) {
        return NextResponse.json({ success: false, error: 'Invalid role' }, { status: 400 })
      }
      await pool.query('UPDATE users SET role = $1 WHERE id = $2', [newRole, targetUser.id])
      return NextResponse.json({ success: true })
    }

    if (action === 'reset') {
      await pool.query('UPDATE users SET needs_setup = true WHERE id = $1', [targetUser.id])
      await pool.query('DELETE FROM sessions WHERE user_id = $1', [targetUser.id])
      return NextResponse.json({ success: true })
    }

    if (action === 'ttl') {
      if (targetUser.role !== 'demo') {
        return NextResponse.json({ success: false, error: 'Session TTL can only be set for demo users' }, { status: 400 })
      }
      const ttl = body.session_ttl_minutes
      await pool.query('UPDATE users SET session_ttl_minutes = $1 WHERE id = $2', [ttl || null, targetUser.id])
      return NextResponse.json({ success: true })
    }

    if (action === 'kill_sessions') {
      if (targetUser.role === 'owner' && auth.user.username === targetUsername) {
        return NextResponse.json({ success: false, error: 'Cannot kill your own sessions from here' }, { status: 400 })
      }
      await pool.query('DELETE FROM sessions WHERE user_id = $1', [targetUser.id])
      return NextResponse.json({ success: true })
    }

    if (action === 'credentials') {
      if (targetUser.role === 'owner' && auth.user.username !== targetUsername) {
        return NextResponse.json({ success: false, error: 'Cannot change credentials of another owner' }, { status: 403 })
      }
      
      const newUsername = (body.newUsername || '').trim()
      const newPassword = body.newPassword || ''
      
      if (!newUsername && !newPassword) {
        return NextResponse.json({ success: false, error: 'No changes provided' }, { status: 400 })
      }

      const updates: string[] = []
      const values: (string | number | boolean | null)[] = []
      let idx = 1

      if (newUsername) {
        if (newUsername.length < 3 || newUsername.length > 64) {
          return NextResponse.json({ success: false, error: 'Username must be between 3 and 64 characters' }, { status: 400 })
        }
        if (newUsername !== targetUsername) {
          const dup = await pool.query('SELECT 1 FROM users WHERE username = $1', [newUsername])
          if (dup.rows.length) {
            return NextResponse.json({ success: false, error: 'Username is already in use' }, { status: 409 })
          }
        }
        updates.push(`username = $${idx++}`)
        values.push(newUsername)
      }

      if (newPassword) {
        if (newPassword.length < 8) {
          return NextResponse.json({ success: false, error: 'Password must be at least 8 characters long' }, { status: 400 })
        }
        const hashed = await hashPassword(newPassword)
        updates.push(`password_hash = $${idx++}`)
        values.push(hashed)
      }

      if (updates.length > 0) {
        values.push(targetUser.id)
        await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`, values)
        // Kill other sessions so they must log in with new creds (if changing own password, keep current session)
        if (auth.user.username === targetUsername) {
          await destroyOtherSessions(targetUser.id, auth.user.sid)
        } else {
          await pool.query('DELETE FROM sessions WHERE user_id = $1', [targetUser.id])
        }
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('[users PATCH] error:', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/* DELETE /api/users/[username] → Eliminar un usuario. */
export async function DELETE(req: Request, { params }: { params: Promise<{ username: string }> }) {
  const auth = await requireRole(req, ['owner'])
  if ('deny' in auth) return auth.deny

  const { username: targetUsername } = await params
  if (!targetUsername) return NextResponse.json({ success: false, error: 'Username required' }, { status: 400 })

  if (targetUsername === auth.user.username) {
    return NextResponse.json({ success: false, error: 'Cannot delete yourself' }, { status: 400 })
  }

  const pool = getPool()!
  const targetUserRes = await pool.query('SELECT id, role FROM users WHERE username = $1', [targetUsername])
  if (targetUserRes.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
  }
  const targetUser = targetUserRes.rows[0]

  if (targetUser.role === 'owner') {
    return NextResponse.json({ success: false, error: 'Cannot delete an owner account' }, { status: 403 })
  }

  try {
    await pool.query('DELETE FROM users WHERE id = $1', [targetUser.id])
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[users DELETE] error:', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

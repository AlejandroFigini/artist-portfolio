import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { requireRole, hashPassword, destroyOtherSessions } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* PATCH /api/users/[username] → Múltiples acciones sobre un usuario. */
export async function PATCH(req: Request, { params }: { params: Promise<{ username: string }> }) {
  // El admin entra para poder gestionar SOLO el bloqueo del demo (block + demo_lock);
  // todo lo demás (rol, credenciales, ttl, reset, kill) sigue siendo del owner.
  const auth = await requireRole(req, ['owner', 'admin'])
  if ('deny' in auth) return auth.deny

  const { username: targetUsername } = await params
  if (!targetUsername) return NextResponse.json({ success: false, error: 'Username required' }, { status: 400 })

  const pool = getPool()!
  const targetUserRes = await pool.query('SELECT id, role, is_blocked, demo_lock_interval_minutes FROM users WHERE username = $1', [targetUsername])
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
    demo_lock_interval_minutes: number | null
    newUsername: string
    newPassword: string
  }>
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }

  const action = body.action

  // Puerta de permisos del admin: solo bloquear/desbloquear y configurar el
  // auto-bloqueo del usuario demo. Cualquier otra acción es exclusiva del owner.
  if (auth.user.role === 'admin') {
    const adminAllowed = (action === 'block' || action === 'demo_lock') && targetUser.role === 'demo'
    if (!adminAllowed) {
      return NextResponse.json({ success: false, error: 'Admins can only manage the demo user lock' }, { status: 403 })
    }
  }

  try {
    if (action === 'block') {
      // Ningún owner es bloqueable: con 2+ owners, bloquearse mutuamente dejaba
      // a la cuenta sin nadie que la reactive. Coherente con role/creds/delete.
      if (targetUser.role === 'owner') {
        return NextResponse.json({ success: false, error: 'Cannot block an owner account' }, { status: 400 })
      }
      const newBlockedStatus = !!body.is_blocked
      if (newBlockedStatus) {
        await pool.query('UPDATE users SET is_blocked = TRUE WHERE id = $1', [targetUser.id])
        await pool.query('DELETE FROM sessions WHERE user_id = $1', [targetUser.id]) // Kill sessions if blocked
      } else {
        // Al DESBLOQUEAR un demo con auto-bloqueo activo, se reinicia el anclaje:
        // vuelve a contar el intervalo completo desde ahora.
        await pool.query(
          `UPDATE users SET is_blocked = FALSE,
             demo_lock_at = CASE
               WHEN role = 'demo' AND demo_lock_interval_minutes IS NOT NULL AND demo_lock_interval_minutes > 0
               THEN NOW() + make_interval(mins => demo_lock_interval_minutes)
               ELSE demo_lock_at END
           WHERE id = $1`,
          [targetUser.id],
        )
      }
      return NextResponse.json({ success: true })
    }

    if (action === 'demo_lock') {
      if (targetUser.role !== 'demo') {
        return NextResponse.json({ success: false, error: 'Auto-lock can only be set for demo users' }, { status: 400 })
      }
      const mins = body.demo_lock_interval_minutes
      // Tope 30 días. null/0 desactiva el auto-bloqueo (limpia intervalo y fecha).
      if (mins != null && (!Number.isInteger(mins) || mins < 1 || mins > 43200)) {
        return NextResponse.json({ success: false, error: 'Interval must be between 1 and 43200 minutes' }, { status: 400 })
      }
      if (mins && mins > 0) {
        // Setear/editar el intervalo REINICIA el anclaje: cuenta desde ahora.
        await pool.query(
          'UPDATE users SET demo_lock_interval_minutes = $1, demo_lock_at = NOW() + make_interval(mins => $1) WHERE id = $2',
          [mins, targetUser.id],
        )
      } else {
        await pool.query('UPDATE users SET demo_lock_interval_minutes = NULL, demo_lock_at = NULL WHERE id = $1', [targetUser.id])
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
      // Matar sus sesiones: el rol se resuelve al crear la sesión, así que sin
      // esto seguiría con los permisos viejos hasta re-loguear.
      await pool.query('DELETE FROM sessions WHERE user_id = $1', [targetUser.id])
      return NextResponse.json({ success: true })
    }

    if (action === 'reset') {
      // Al demo NO se le fuerza cambio de contraseña (es efímero): solo se le
      // matan las sesiones. Al resto se le marca needs_setup.
      if (targetUser.role !== 'demo') {
        await pool.query('UPDATE users SET needs_setup = true WHERE id = $1', [targetUser.id])
      }
      await pool.query('DELETE FROM sessions WHERE user_id = $1', [targetUser.id])
      return NextResponse.json({ success: true })
    }

    if (action === 'ttl') {
      if (targetUser.role !== 'demo') {
        return NextResponse.json({ success: false, error: 'Session TTL can only be set for demo users' }, { status: 400 })
      }
      const ttl = body.session_ttl_minutes
      // null limpia (vuelve al default de 1h). Si viene valor, acotarlo: un
      // negativo/0 hacía que createSession calcule un expiry en el pasado y la
      // sesión demo muriera al instante. Tope 1 semana.
      if (ttl != null && (!Number.isInteger(ttl) || ttl < 1 || ttl > 10080)) {
        return NextResponse.json({ success: false, error: 'Session TTL must be between 1 and 10080 minutes' }, { status: 400 })
      }
      await pool.query('UPDATE users SET session_ttl_minutes = $1 WHERE id = $2', [ttl || null, targetUser.id])
      return NextResponse.json({ success: true })
    }

    if (action === 'kill_sessions') {
      if (targetUser.role === 'owner') {
        return NextResponse.json({ success: false, error: 'Cannot kill sessions of an owner account' }, { status: 400 })
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
        const dup = await pool.query('SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) AND id <> $2', [newUsername, targetUser.id])
        if (dup.rows.length) {
          return NextResponse.json({ success: false, error: 'Username is already in use' }, { status: 409 })
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

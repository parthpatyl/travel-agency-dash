import { useState, useEffect, useCallback } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const VALID_ROLES = ['admin', 'operations', 'sales', 'owner']

const ROLE_COLORS = {
  admin: 'bg-purple-50 text-purple-700 border-purple-200',
  operations: 'bg-blue-50 text-blue-700 border-blue-200',
  sales: 'bg-green-50 text-green-700 border-green-200',
  owner: 'bg-amber-50 text-amber-700 border-amber-200',
}

const ROLE_BG = {
  admin: 'from-purple-500 to-purple-600',
  operations: 'from-blue-500 to-blue-600',
  sales: 'from-emerald-500 to-emerald-600',
  owner: 'from-amber-500 to-orange-500',
}

const ONLINE_MS = 5 * 60_000
const AWAY_MS = 30 * 60_000

function ms(s) {
  if (s == null) return null
  const t = typeof s === 'number' ? s : new Date(s).getTime()
  return Number.isFinite(t) ? t : null
}

function getStatus(lastActiveAt, now) {
  const t = ms(lastActiveAt)
  if (t == null) return { label: 'Offline', dot: 'bg-stone-400' }
  const diff = Math.max(0, now - t)
  if (diff < ONLINE_MS) return { label: 'Online', dot: 'bg-emerald-500', color: 'bg-emerald-100 text-emerald-700' }
  if (diff < AWAY_MS) return { label: 'Away', dot: 'bg-amber-400', color: 'bg-amber-100 text-amber-700' }
  return { label: 'Offline', dot: 'bg-stone-400', color: 'bg-stone-100 text-stone-500' }
}

function formatLastActive(s, now) {
  const t = ms(s)
  if (t == null) return ''
  const diff = Math.max(0, now - t)
  if (diff < 60_000) return 'Just now'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
  return new Date(t).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

export default function TeamPage({ addNotification, token, user: currentUser }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState(null)
  const [resetting, setResetting] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'operations', avatar_url: '' })
  const [newPassword, setNewPassword] = useState('')
  const [resetModal, setResetModal] = useState(null)
  const [resetForm, setResetForm] = useState({ password: '', confirmPassword: '' })
  const [resetError, setResetError] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  }

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/users`, { headers })
      if (res.ok) {
        setUsers(await res.json())
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => { fetchUsers() }, [fetchUsers]) // eslint-disable-line react-hooks/set-state-in-effect

  // Live ticker — re-renders every 30s so status labels re-evaluate against now()
  // eslint-disable-next-line react-hooks/purity
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(i)
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (form.password.length < 8) {
      addNotification?.('Password must be at least 8 characters', 'error')
      return
    }
    if (!/[a-zA-Z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      addNotification?.('Password must contain both letters and numbers (alphanumeric)', 'error')
      return
    }
    try {
      const res = await fetch(`${API_URL}/api/users`, {
        method: 'POST',
        headers,
        body: JSON.stringify(form)
      })
      if (res.ok) {
        const user = await res.json()
        setUsers(prev => [user, ...prev])
        setShowCreate(false)
        setForm({ name: '', email: '', password: '', role: 'operations', avatar_url: '' })
        addNotification?.('User created successfully', 'success')
      } else {
        const err = await res.json()
        addNotification?.(err.error || 'Failed to create user', 'error')
      }
    } catch {
      addNotification?.('Failed to create user', 'error')
    }
  }

  const handleUpdate = async (id) => {
    try {
      const body = { role: editing.role }
      if (editing.name?.trim()) body.name = editing.name
      if (editing.avatar_url !== undefined) body.avatar_url = editing.avatar_url
      const res = await fetch(`${API_URL}/api/users/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body)
      })
      if (res.ok) {
        const updated = await res.json()
        setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updated } : u))
        setEditing(null)
        addNotification?.('User updated', 'success')
      } else {
        const err = await res.json()
        addNotification?.(err.error || 'Failed to update', 'error')
      }
    } catch {
      addNotification?.('Failed to update user', 'error')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this user?')) return
    try {
      const res = await fetch(`${API_URL}/api/users/${id}`, {
        method: 'DELETE',
        headers
      })
      if (res.ok) {
        setUsers(prev => prev.filter(u => u.id !== id))
        addNotification?.('User deleted', 'info')
      } else {
        const err = await res.json()
        addNotification?.(err.error || 'Failed to delete', 'error')
      }
    } catch {
      addNotification?.('Failed to delete user', 'error')
    }
  }

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault()
    setResetError('')

    const { password, confirmPassword } = resetForm

    if (!password) {
      setResetError('Password is required')
      return
    }
    if (password.length < 8) {
      setResetError('Password must be at least 8 characters')
      return
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setResetError('Password must contain both letters and numbers (alphanumeric)')
      return
    }
    if (password !== confirmPassword) {
      setResetError('Passwords do not match')
      return
    }

    try {
      const res = await fetch(`${API_URL}/api/users/${resetModal.id}/reset-password`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ password })
      })
      if (res.ok) {
        addNotification?.(`Password reset successfully for ${resetModal.name}`, 'success')
        setResetModal(null)
        setResetForm({ password: '', confirmPassword: '' })
      } else {
        const err = await res.json()
        setResetError(err.error || 'Failed to reset password')
      }
    } catch {
      setResetError('Failed to reset password')
    }
  }

  if (loading) return <div className="text-stone-400 text-sm p-8">Loading team...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">Team Management</h2>
          <p className="text-xs text-stone-400">Manage users, assign roles, and monitor activity.</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-colors"
        >
          {showCreate ? 'Cancel' : '+ Add User'}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
          <h3 className="font-bold text-sm text-stone-800">Create New User</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Name</label>
              <input
                required
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-300 focus:border-amber-400 outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Email</label>
              <input
                required
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-300 focus:border-amber-400 outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Password</label>
              <input
                required
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-300 focus:border-amber-400 outline-none"
                placeholder="Min 8 characters, alphanumeric"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Role</label>
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-300 focus:border-amber-400 outline-none"
              >
                {VALID_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl transition-colors">
            Create User
          </button>
        </form>
      )}

      {newPassword && resetting && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
          <p className="text-xs font-bold text-amber-800">Password Reset</p>
          <p className="text-xs text-amber-700">New password for this user:</p>
          <div className="flex items-center gap-2">
            <code className="bg-white px-3 py-1.5 rounded-lg border border-amber-200 text-sm font-mono">{newPassword}</code>
            <button
              onClick={() => { navigator.clipboard?.writeText(newPassword); addNotification?.('Copied!', 'success') }}
              className="text-[10px] font-bold text-amber-700 underline"
            >
              Copy
            </button>
          </div>
          <p className="text-[10px] text-amber-600">Share this password securely with the user. They can change it after login.</p>
          <button onClick={() => { setNewPassword(''); setResetting(null) }} className="text-[10px] font-bold text-stone-500 underline">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map(user => {
          const status = getStatus(user.last_active_at, now)
          const isSelf = currentUser?.id === user.id
          return (
            <div
              key={user.id}
              className="bg-white border border-stone-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Card top — gradient header with avatar */}
              <div className={`bg-gradient-to-r ${ROLE_BG[user.role] || 'from-stone-500 to-stone-600'} p-5 flex items-center gap-4`}>
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-white font-bold text-lg overflow-hidden shrink-0 ring-2 ring-white/30">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    user.name?.charAt(0) || '?'
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-white font-bold text-sm truncate">{user.name}{isSelf && <span className="text-white/60 text-[10px] ml-1">(you)</span>}</h3>
                  <p className="text-white/70 text-[10px] truncate">{user.email}</p>
                </div>
              </div>

              {/* Card body */}
              <div className="p-4 space-y-3">
                {/* Role + Status row */}
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1.5 text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${ROLE_COLORS[user.role] || 'bg-stone-100 text-stone-600'}`}>
                    {user.role}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full ${status.color || 'bg-stone-100 text-stone-500'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                    {status.label}
                  </span>
                </div>

                {/* Last active */}
                <div className="text-[10px] text-stone-400">
                  {user.last_active_at ? (
                    <>Last active <span className="font-medium text-stone-500">{formatLastActive(user.last_active_at, now)}</span></>
                  ) : (
                    'No activity yet'
                  )}
                </div>

                {/* Created date */}
                <div className="text-[10px] text-stone-300">
                  Joined {user.created_at ? new Date(user.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                </div>

                {/* Actions */}
                <div className="pt-2 border-t border-stone-100 flex items-center gap-2">
                  {editing?.id === user.id ? (
                    <div className="flex items-center gap-2 w-full">
                      <select
                        value={editing.role}
                        onChange={e => setEditing({ ...editing, role: e.target.value })}
                        className="flex-1 px-2 py-1.5 border border-stone-200 rounded-lg text-[10px]"
                      >
                        {VALID_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <button onClick={() => handleUpdate(user.id)} className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700">Save</button>
                      <button onClick={() => setEditing(null)} className="text-[10px] text-stone-400">Cancel</button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setEditing({ id: user.id, name: user.name, role: user.role, avatar_url: user.avatar_url })}
                        className="px-3 py-1.5 text-[10px] font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setResetModal({ id: user.id, name: user.name })
                          setResetForm({ password: '', confirmPassword: '' })
                          setResetError('')
                        }}
                        className="px-3 py-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                      >
                        Reset PW
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="px-3 py-1.5 text-[10px] font-bold text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors ml-auto"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {users.length === 0 && (
        <div className="text-center py-12 text-stone-400 text-xs">No users found. Create one to get started.</div>
      )}

      {resetModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-sm bg-white border border-stone-200 rounded-2xl shadow-2xl p-5 space-y-4">
            <div>
              <h3 className="font-bold text-sm text-stone-900">Reset Password</h3>
              <p className="text-[11px] text-stone-400">Set a new secure password for <span className="font-semibold text-stone-700">{resetModal.name}</span>.</p>
            </div>

            {resetError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-[11px] rounded-xl font-medium">
                {resetError}
              </div>
            )}

            <form onSubmit={handleResetPasswordSubmit} className="space-y-3.5">
              <div>
                <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wide">New Password</label>
                <input
                  required
                  type={showPasswords ? 'text' : 'password'}
                  value={resetForm.password}
                  onChange={e => setResetForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full mt-1 px-3 py-1.5 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-300 focus:border-amber-400 outline-none"
                  placeholder="Min 8 characters, alphanumeric"
                />
              </div>

              <div>
                <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wide">Confirm Password</label>
                <input
                  required
                  type={showPasswords ? 'text' : 'password'}
                  value={resetForm.confirmPassword}
                  onChange={e => setResetForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  className="w-full mt-1 px-3 py-1.5 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-300 focus:border-amber-400 outline-none"
                  placeholder="Re-enter password"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  id="show-passwords"
                  checked={showPasswords}
                  onChange={e => setShowPasswords(e.target.checked)}
                  className="rounded border-stone-300 text-amber-500 focus:ring-amber-500 w-3.5 h-3.5"
                />
                <label htmlFor="show-passwords" className="text-[10px] text-stone-400 select-none">
                  Show passwords
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetModal(null)}
                  className="px-3.5 py-1.5 border border-stone-200 text-stone-400 hover:bg-stone-50 text-[11px] font-bold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold rounded-xl transition-colors shadow-sm"
                >
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

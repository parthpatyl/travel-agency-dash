import { useState } from 'react'
import logo from '../assets/logo.png'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Login failed')
      }

      const data = await res.json()
      onLogin(data.user, data.token)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FDFCF7] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white border border-stone-200 rounded-3xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl overflow-hidden mx-auto mb-4 shadow-sm border border-stone-200 bg-white flex items-center justify-center">
              <img src={logo} alt="KRAFT YOUR TRIP" className="w-full h-full object-contain p-1" />
            </div>
            <h1 className="text-lg font-black tracking-tight text-stone-900 uppercase">
              KRAFT YOUR TRIP
            </h1>
            <p className="text-[11px] text-stone-500 font-semibold mt-1">
              Agency Portal — Sign In
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@kraftyourtrip.com"
                className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-xl py-2.5 px-3.5 text-xs text-stone-800 placeholder-stone-400 outline-none focus:ring-1 focus:ring-amber-500 transition-all duration-300"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-xl py-2.5 px-3.5 text-xs text-stone-800 placeholder-stone-400 outline-none focus:ring-1 focus:ring-amber-500 transition-all duration-300"
                required
              />
            </div>

            {error && (
              <p className="text-[11px] text-rose-600 font-semibold text-center bg-rose-50/50 py-2 px-3 rounded-lg">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all duration-300 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] text-stone-400 font-medium mt-6">
          KRAFT YOUR TRIP Admin Panel v1.4
        </p>
      </div>
    </div>
  )
}

import { useState } from 'react'
import logo from '../assets/logo.png'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Invalid email or password. Please check your credentials and try again.')
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
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (error) setError('')
                }}
                placeholder="admin@kraftyourtrip.com"
                className={`w-full bg-stone-50 border ${
                  error ? 'border-rose-400 focus:border-rose-500 ring-1 ring-rose-200 bg-rose-50/20' : 'border-stone-200 focus:border-amber-500'
                } rounded-xl py-2.5 px-3.5 text-xs text-stone-800 placeholder-stone-400 outline-none focus:ring-1 focus:ring-amber-500 transition-all duration-300`}
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[10px] text-stone-400 hover:text-stone-700 font-semibold"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (error) setError('')
                }}
                placeholder="Enter your password"
                className={`w-full bg-stone-50 border ${
                  error ? 'border-rose-400 focus:border-rose-500 ring-1 ring-rose-200 bg-rose-50/20' : 'border-stone-200 focus:border-amber-500'
                } rounded-xl py-2.5 px-3.5 text-xs text-stone-800 placeholder-stone-400 outline-none focus:ring-1 focus:ring-amber-500 transition-all duration-300`}
                required
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2 animate-fade-in">
                <svg className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1 text-[11px] leading-relaxed">
                  <span className="font-bold block text-rose-800">Authentication Failed</span>
                  {error}
                </div>
              </div>
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

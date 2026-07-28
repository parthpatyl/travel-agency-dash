import { useState, useRef, useEffect } from 'react'
import { roleHas } from '../utils/permissions'
import ReadOnlyBanner from './ReadOnlyBanner'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const DEFAULT_AVATAR = `${API_URL}/assets/default-avatar.png`

const imgUrl = (url) => {
  if (!url) return DEFAULT_AVATAR
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `${API_URL}${url}`
}

const MAX_TEXT_LENGTH = 500
const defaultForm = { name: '', location: '', avatar: '', rating: 5, text: '', package: '', images: [] }

export default function TestimonialsPage({ testimonials, setTestimonials, addNotification, packages, user }) {
  const standardPackages = (packages || []).filter(p => !p.isBespoke)
  const bespokePackages = (packages || []).filter(p => p.isBespoke)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(defaultForm)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const canWriteTestimonial = roleHas(user?.role, 'write:testimonials')
  const [previewSlides, setPreviewSlides] = useState(null)
  const [previewIndex, setPreviewIndex] = useState(0)
  const fileInputRef = useRef(null)
  const imageInputRef = useRef(null)

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showForm) {
          setShowForm(false)
          setEditing(null)
        } else if (previewSlides) {
          setPreviewSlides(null)
        } else if (deleteTarget) {
          setDeleteTarget(null)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showForm, previewSlides, deleteTarget])

  // Stats management state
  const [stats, setStats] = useState({ tripsCrafted: '500+', satisfaction: '98%', destinations: '50+' })
  const [statsForm, setStatsForm] = useState({ tripsCrafted: '', satisfaction: '', destinations: '' })
  const [editingStats, setEditingStats] = useState(false)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`${API_URL}/api/stats`)
        if (res.ok) {
          const data = await res.json()
          setStats(data)
          setStatsForm(data)
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err)
      }
    }
    fetchStats()
  }, [])

  const handleSaveStats = async (e) => {
    e.preventDefault();
    const trips = String(statsForm.tripsCrafted || '').trim();
    const sat = String(statsForm.satisfaction || '').trim();
    const dest = String(statsForm.destinations || '').trim();

    if (!trips || !sat || !dest) {
      if (addNotification) addNotification('Please fill in all stat fields', 'warning');
      return;
    }

    try {
      const token = localStorage.getItem('kraft_token');
      const response = await fetch(`${API_URL}/api/stats`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(statsForm)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to update stats');
      }

      const updated = await response.json();
      setStats(updated);
      setEditingStats(false);
      if (addNotification) addNotification('Hero statistics updated successfully!', 'success');
    } catch (err) {
      console.error(err);
      if (addNotification) addNotification(err.message || 'Failed to save stats', 'error');
    }
  }

  const openAdd = () => {
    if (!canWriteTestimonial) {
      if (addNotification) addNotification('You do not have permission to add testimonials', 'error')
      return
    }
    setForm(defaultForm)
    setEditing(null)
    setShowForm(true)
  }

  const openEdit = (t) => {
    if (!canWriteTestimonial) {
      if (addNotification) addNotification('You do not have permission to edit testimonials', 'error')
      return
    }
    setForm({
      name: t.name || '',
      location: t.location || '',
      avatar: t.avatar || '',
      rating: t.rating || 5,
      text: t.text || '',
      package: t.package || '',
      images: t.images || []
    })
    setEditing(t)
    setShowForm(true)
  }

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('image', file)

    try {
      if (addNotification) addNotification('Uploading avatar...', 'info')
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
      const token = localStorage.getItem('kraft_token')
      const response = await fetch(`${API_URL}/api/upload`, { headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.error || 'Failed to upload image')
      }

      const data = await response.json()
      setForm({ ...form, avatar: data.imageUrl })
      if (addNotification) addNotification('Avatar uploaded successfully!', 'success')
    } catch (err) {
      console.error(err)
      if (addNotification) addNotification(err.message || 'Avatar upload failed', 'error')
    }
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('image', file)

    try {
      if (addNotification) addNotification('Uploading image...', 'info')
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
      const token = localStorage.getItem('kraft_token')
      const response = await fetch(`${API_URL}/api/upload`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.error || 'Failed to upload image')
      }

      const data = await response.json()
      setForm(prev => ({ ...prev, images: [...prev.images, data.imageUrl] }))
      if (addNotification) addNotification('Image uploaded successfully!', 'success')
    } catch (err) {
      console.error(err)
      if (addNotification) addNotification(err.message || 'Image upload failed', 'error')
    }
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  const removeImage = (index) => {
    setForm({ ...form, images: form.images.filter((_, i) => i !== index) })
  }

  const removeAvatar = () => {
    setForm({ ...form, avatar: '' })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSave = (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.text.trim()) {
      if (addNotification) {
        const missing = []
        if (!form.name.trim()) missing.push('Reviewer Name')
        if (!form.text.trim()) missing.push('Testimonial Text')
        addNotification(`Please fill in required fields: ${missing.join(', ')}`, 'warning')
      }
      return
    }

    if (editing) {
      setTestimonials(testimonials.map(t => t.id === editing.id ? { ...t, ...form } : t))
      if (addNotification) addNotification(`Testimonial from ${form.name} updated`, 'success')
    } else {
      const newT = { id: crypto.randomUUID(), ...form }
      setTestimonials([newT, ...testimonials])
      if (addNotification) addNotification(`Testimonial from ${form.name} created`, 'success')
    }
    setShowForm(false)
    setForm(defaultForm)
    setEditing(null)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    setTestimonials(testimonials.filter(t => t.id !== deleteTarget.id))
    if (addNotification) addNotification(`Testimonial from ${deleteTarget.name} deleted`, 'info')
    setDeleteTarget(null)
  }

  const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">Customer Testimonials</h2>
          <p className="text-xs text-stone-400">Manage traveler reviews shown on the customer site.</p>
        </div>
        {canWriteTestimonial && (
          <button onClick={openAdd} className="py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-sm active:scale-[0.98] transition-all duration-300 flex items-center gap-2 cursor-pointer">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Testimonial
          </button>
        )}
      </div>

      {/* Dynamic Stats Management Panel */}
      <div className="bg-white border border-stone-200/80 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="text-sm font-bold tracking-tight text-stone-900 flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Hero Section Statistics
            </h3>
            <p className="text-[11px] text-stone-400">Configure the key stats displayed in the hero banner of the customer site.</p>
          </div>
          {canWriteTestimonial && !editingStats && (
            <button
              onClick={() => { setStatsForm(stats); setEditingStats(true); }}
              className="py-1.5 px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold border border-stone-200 transition-all cursor-pointer"
            >
              Edit Stats
            </button>
          )}
        </div>

        {editingStats ? (
          <form onSubmit={handleSaveStats} className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-stone-50 p-4 rounded-xl border border-stone-200">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider">Trips Crafted</label>
              <input
                type="number"
                required
                value={statsForm.tripsCrafted}
                onChange={(e) => setStatsForm({ ...statsForm, tripsCrafted: e.target.value })}
                placeholder="e.g. 500"
                className="w-full bg-white border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-850 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider">Satisfaction Rate</label>
              <input
                type="number"
                required
                value={statsForm.satisfaction}
                onChange={(e) => setStatsForm({ ...statsForm, satisfaction: e.target.value })}
                placeholder="e.g. 98"
                className="w-full bg-white border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-850 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider">Destinations</label>
              <input
                type="number"
                required
                value={statsForm.destinations}
                onChange={(e) => setStatsForm({ ...statsForm, destinations: e.target.value })}
                placeholder="e.g. 50"
                className="w-full bg-white border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-850 outline-none"
              />
            </div>
            <div className="sm:col-span-3 flex justify-end gap-2 pt-2 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setEditingStats(false)}
                className="px-3 py-1.5 border border-stone-200 rounded-lg text-xs font-semibold text-stone-600 hover:bg-stone-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold shadow transition-all cursor-pointer"
              >
                Save Stats
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-3 gap-2 text-center bg-stone-50/50 p-4 rounded-xl border border-stone-200 divide-x divide-stone-200">
            <div className="space-y-0.5">
              <span className="text-lg sm:text-xl font-bold font-mono text-stone-900">{stats.tripsCrafted || '—'}</span>
              <p className="text-[10px] text-stone-500 font-medium uppercase tracking-wider">Trips Crafted</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-lg sm:text-xl font-bold font-mono text-stone-900">{stats.satisfaction || '—'}</span>
              <p className="text-[10px] text-stone-500 font-medium uppercase tracking-wider">Satisfaction</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-lg sm:text-xl font-bold font-mono text-stone-900">{stats.destinations || '—'}</span>
              <p className="text-[10px] text-stone-500 font-medium uppercase tracking-wider">Destinations</p>
            </div>
          </div>
        )}
      </div>

      {/* Testimonials Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {testimonials.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3 py-16 text-center text-stone-400 text-sm">
            No testimonials yet. Add your first customer review.
          </div>
        )}
        {testimonials.map(t => (
          <div key={t.id} className="bg-white border border-stone-200/80 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-stone-100 shrink-0 border border-stone-200">
                <img
                  src={imgUrl(t.avatar)}
                  alt={t.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-stone-900 truncate">{t.name}</h4>
                {t.location && <span className="text-[10px] text-stone-400">{t.location}</span>}
              </div>
            </div>
            <div className="text-amber-500 text-xs tracking-wider">{stars(Math.min(Math.max(t.rating || 5, 1), 5))}</div>
            {t.text && <p className="text-xs text-stone-600 leading-relaxed line-clamp-3">{t.text}</p>}
            {t.images && t.images.length > 0 && (
              <div className="flex gap-1">
                {t.images.slice(0, 3).map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => { setPreviewSlides(t.images); setPreviewIndex(idx) }}
                    className="w-12 h-12 rounded-lg overflow-hidden bg-stone-100 border border-stone-200 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
                {t.images.length > 3 && (
                  <button
                    type="button"
                    onClick={() => { setPreviewSlides(t.images); setPreviewIndex(0) }}
                    className="w-12 h-12 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center text-[10px] font-bold text-stone-500 cursor-pointer hover:bg-stone-200 transition-colors shrink-0"
                  >
                    +{t.images.length - 3}
                  </button>
                )}
              </div>
            )}
            {t.package && <span className="inline-block px-2 py-0.5 bg-stone-100 rounded text-[9px] text-stone-500 font-semibold">{t.package}</span>}
            <div className="flex gap-2 pt-2 border-t border-stone-100">
              {canWriteTestimonial && (
                <button onClick={() => openEdit(t)} className="flex-1 py-1.5 bg-stone-100 hover:bg-stone-200 rounded-lg text-[10px] font-bold text-stone-700 cursor-pointer transition-all">Edit</button>
              )}
              {canWriteTestimonial && (
                <button onClick={() => setDeleteTarget(t)} className="flex-1 py-1.5 bg-rose-50 hover:bg-rose-100 rounded-lg text-[10px] font-bold text-rose-600 cursor-pointer transition-all">Delete</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-3 sm:p-6 pt-20 sm:pt-24 pb-8 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="testimonial-modal-title">
          <div className="bg-white border border-stone-200/90 rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col my-auto overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header (Sticky / Fixed) */}
            <div className="px-6 py-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/50 shrink-0">
              <div>
                <h3 id="testimonial-modal-title" className="text-base sm:text-lg font-bold text-stone-900">{editing ? 'Edit Testimonial' : 'Add Testimonial'}</h3>
                <p className="text-xs text-stone-500 font-light mt-0.5">Manage customer reviews and traveler stories</p>
              </div>
              <button 
                type="button" 
                onClick={() => { setShowForm(false); setEditing(null) }} 
                className="p-1.5 rounded-lg hover:bg-stone-200/70 text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
                title="Close (Esc)"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col min-h-0 flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
                {!canWriteTestimonial && <ReadOnlyBanner message="View-only mode — you can view but not edit testimonials" />}
                <fieldset disabled={!canWriteTestimonial} className="space-y-5">
                  
                  {/* Avatar Upload */}
                  <div className="flex items-center gap-4 p-4 bg-stone-50/70 border border-stone-200 rounded-xl">
                    <div className="w-14 h-14 rounded-xl bg-stone-100 p-0.5 shadow-inner shrink-0 relative group overflow-hidden border border-stone-200">
                      <img
                        src={imgUrl(form.avatar)}
                        alt="Avatar Preview"
                        className="w-full h-full object-cover rounded-lg"
                      />
                      {form.avatar && (
                        <button
                          type="button"
                          onClick={removeAvatar}
                          className="absolute top-1 right-1 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-xs"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <div className="flex-grow">
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">Avatar Photo</label>
                      <div className="relative flex items-center gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <button
                          type="button"
                          className="px-3.5 py-2 bg-white border border-stone-300 hover:bg-stone-50 rounded-lg text-xs font-semibold text-stone-700 shadow-xs transition-all cursor-pointer"
                        >
                          Choose Image
                        </button>
                        <span className="text-xs text-stone-400">Max 5MB</span>
                      </div>
                    </div>
                  </div>

                  {/* Slideshow Images */}
                  <div className="p-4 bg-stone-50/70 border border-stone-200 rounded-xl space-y-3">
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">Slideshow Images</label>
                    {form.images.length > 0 ? (
                      <div className="flex flex-wrap gap-2.5">
                        {form.images.map((url, idx) => (
                          <div key={idx} className="relative group w-16 h-16 rounded-lg overflow-hidden bg-stone-100 border border-stone-200 shrink-0">
                            <img src={url} alt={`Slide ${idx + 1}`} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => removeImage(idx)}
                              className="absolute top-1 right-1 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-xs"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-stone-400 italic">No images added yet.</p>
                    )}
                    <div className="relative flex items-center gap-2">
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <button
                        type="button"
                        className="px-3.5 py-2 bg-white border border-stone-300 hover:bg-stone-50 rounded-lg text-xs font-semibold text-stone-700 shadow-xs transition-all cursor-pointer"
                      >
                        Add Image
                      </button>
                      <span className="text-xs text-stone-400">Max 5MB each</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">Name <span className="text-rose-500">*</span></label>
                      <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Sarah Johnson" className="w-full bg-stone-50 border border-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-lg p-3 text-sm text-stone-850 outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">Location</label>
                      <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. New York, USA" className="w-full bg-stone-50 border border-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-lg p-3 text-sm text-stone-850 outline-none transition-all" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">Rating</label>
                      <div className="flex gap-1 mt-1">
                        {[1, 2, 3, 4, 5].map(n => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setForm({ ...form, rating: n })}
                            className={`text-xl transition-all cursor-pointer ${n <= form.rating ? 'text-amber-500' : 'text-stone-300 hover:text-amber-400'}`}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">Package</label>
                      <select
                        value={form.package}
                        onChange={(e) => setForm({ ...form, package: e.target.value })}
                        className="w-full bg-stone-50 border border-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-lg p-3 text-sm text-stone-850 outline-none transition-all"
                      >
                        <option value="">— Select Package —</option>
                        {standardPackages.length > 0 && (
                          <optgroup label="Standard Packages">
                            {standardPackages.map(p => (
                              <option key={p.id} value={p.name}>{p.name}</option>
                            ))}
                          </optgroup>
                        )}
                        {bespokePackages.length > 0 && (
                          <optgroup label="Bespoke Packages">
                            {bespokePackages.map(p => (
                              <option key={p.id} value={p.name}>{p.name} (Bespoke)</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                      Review Text
                      <span className="font-normal text-stone-400 ml-1">({form.text.length}/{MAX_TEXT_LENGTH})</span>
                    </label>
                    <textarea
                      rows="3"
                      maxLength={MAX_TEXT_LENGTH}
                      value={form.text}
                      onChange={(e) => setForm({ ...form, text: e.target.value })}
                      placeholder="Share the traveler's experience..."
                      className="w-full bg-stone-50 border border-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-lg p-3 text-sm text-stone-850 outline-none resize-none transition-all"
                    />
                  </div>

                </fieldset>
              </div>

              {/* Sticky Action Footer */}
              <div className="px-6 py-4 border-t border-stone-100 flex justify-end gap-3 shrink-0 bg-stone-50/60 rounded-b-2xl">
                <button 
                  type="button" 
                  onClick={() => { setShowForm(false); setEditing(null) }} 
                  className="px-5 py-2.5 border border-stone-200 rounded-xl text-xs sm:text-sm font-semibold text-stone-600 hover:bg-stone-100 active:scale-95 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow active:scale-95 transition-all cursor-pointer"
                >
                  {editing ? 'Save Changes' : 'Add Testimonial'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Slideshow Preview Modal */}
      {previewSlides && (
        <div className="fixed inset-0 bg-stone-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setPreviewSlides(null)}>
          <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreviewSlides(null)}
              className="absolute -top-10 right-0 text-white/70 hover:text-white text-xs font-semibold cursor-pointer z-10"
            >
              Close
            </button>
            <div className="relative aspect-video bg-stone-800 rounded-2xl overflow-hidden">
              <img
                src={previewSlides[previewIndex]}
                alt={`Slide ${previewIndex + 1}`}
                className="w-full h-full object-contain"
              />
              {previewSlides.length > 1 && (
                <>
                  <button
                    onClick={() => setPreviewIndex((prev) => (prev - 1 + previewSlides.length) % previewSlides.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm cursor-pointer transition-all border border-white/15"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <button
                    onClick={() => setPreviewIndex((prev) => (prev + 1) % previewSlides.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm cursor-pointer transition-all border border-white/15"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {previewSlides.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setPreviewIndex(idx)}
                        className={`h-1.5 rounded-full transition-all cursor-pointer ${idx === previewIndex ? 'bg-amber-300 w-5' : 'bg-white/40 hover:bg-white/70 w-1.5'}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
            <p className="text-center text-white/60 text-xs mt-2">{previewIndex + 1} / {previewSlides.length}</p>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-stone-200 rounded-2xl shadow-xl w-full max-w-sm p-6 animate-in zoom-in duration-200 space-y-4">
            <h3 className="text-base font-bold text-stone-900">Delete Testimonial?</h3>
            <p className="text-xs text-stone-500 leading-relaxed">Are you sure you want to delete the testimonial from <strong className="text-stone-800">{deleteTarget.name}</strong>? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 border border-stone-200 rounded-lg text-xs font-semibold text-stone-600 hover:bg-stone-50 active:scale-95 transition-all cursor-pointer">Cancel</button>
              <button onClick={confirmDelete} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold shadow active:scale-95 transition-all cursor-pointer">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

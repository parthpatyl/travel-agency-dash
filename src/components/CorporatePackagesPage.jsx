import { useState, useRef, useEffect } from 'react'
import { roleHas } from '../utils/permissions'
import ReadOnlyBanner from './ReadOnlyBanner'
import PackageBrochureModal from './PackageBrochureModal'

const PrinterIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
  </svg>
)

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const DEFAULT_IMAGE = `${API_URL}/assets/unsplash-pkg-card.jpg`

const imgUrl = (url) => {
  if (!url) return DEFAULT_IMAGE
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `${API_URL}${url}`
}

const defaultForm = {
  destination: '',
  nights: '',
  startingPrice: '',
  category: 'india',
  imageUrl: '',
  description: '',
  highlights: []
}

export default function CorporatePackagesPage({ corporatePackages, setCorporatePackages, addNotification, user }) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(defaultForm)
  const [highlightInput, setHighlightInput] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [filterCategory, setFilterCategory] = useState('All')
  const [brochurePkg, setBrochurePkg] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showForm) {
          setShowForm(false)
          setEditing(null)
        } else if (deleteTarget) {
          setDeleteTarget(null)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showForm, deleteTarget])

  const canWrite = roleHas(user?.role, 'write:packages') || roleHas(user?.role, 'create:packages')

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('image', file)

    try {
      if (addNotification) addNotification('Uploading cover image...', 'info')
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
      setForm(prev => ({ ...prev, imageUrl: data.imageUrl }))
      if (addNotification) addNotification('Cover image uploaded successfully!', 'success')
    } catch (err) {
      console.error(err)
      if (addNotification) addNotification(err.message || 'Image upload failed', 'error')
    }
  }

  const openAdd = () => {
    if (!canWrite) {
      if (addNotification) addNotification('You do not have permission to create corporate packages', 'error')
      return
    }
    setForm(defaultForm)
    setHighlightInput('')
    setEditing(null)
    setShowForm(true)
  }

  const openEdit = (pkg) => {
    if (!canWrite) {
      if (addNotification) addNotification('You do not have permission to edit corporate packages', 'error')
      return
    }
    setForm({
      destination: pkg.destination || '',
      nights: pkg.nights || '',
      startingPrice: pkg.startingPrice != null ? pkg.startingPrice : (pkg.starting_price != null ? pkg.starting_price : ''),
      category: pkg.category || 'india',
      imageUrl: pkg.imageUrl || pkg.image_url || '',
      description: pkg.description || '',
      highlights: pkg.highlights || [],
      isActive: pkg.isActive !== undefined ? pkg.isActive : (pkg.is_active !== undefined ? pkg.is_active : true),
      displayOrder: pkg.displayOrder !== undefined ? pkg.displayOrder : (pkg.display_order !== undefined ? pkg.display_order : 0)
    })
    setHighlightInput('')
    setEditing(pkg)
    setShowForm(true)
  }

  const handleSave = (e) => {
    e.preventDefault()
    if (!form.destination.trim()) {
      if (addNotification) addNotification('Destination is required', 'warning')
      return
    }

    const payload = {
      ...form,
      startingPrice: form.startingPrice ? parseFloat(form.startingPrice) : null,
      displayOrder: form.displayOrder ? parseInt(form.displayOrder) : 0
    }

    if (editing) {
      setCorporatePackages(corporatePackages.map(c => c.id === editing.id ? { ...c, ...payload } : c))
      if (addNotification) addNotification(`Corporate package for ${form.destination} updated`, 'success')
    } else {
      const newPkg = {
        id: `temp-${Date.now()}`,
        ...payload,
        isActive: true
      }
      setCorporatePackages([...corporatePackages, newPkg])
      if (addNotification) addNotification(`Corporate package for ${form.destination} created`, 'success')
    }
    setShowForm(false)
    setForm(defaultForm)
    setEditing(null)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    setCorporatePackages(corporatePackages.filter(c => c.id !== deleteTarget.id))
    if (addNotification) addNotification(`Corporate package for ${deleteTarget.destination} deleted`, 'info')
    setDeleteTarget(null)
  }

  const addHighlight = () => {
    if (!highlightInput.trim()) return
    if (form.highlights.includes(highlightInput.trim())) return
    setForm(prev => ({
      ...prev,
      highlights: [...prev.highlights, highlightInput.trim()]
    }))
    setHighlightInput('')
  }

  const removeHighlight = (idxToRemove) => {
    setForm(prev => ({
      ...prev,
      highlights: prev.highlights.filter((_, idx) => idx !== idxToRemove)
    }))
  }

  const filtered = corporatePackages.filter(pkg => {
    if (filterCategory === 'All') return true
    return pkg.category === filterCategory
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">Corporate & MICE Tours</h2>
          <p className="text-xs text-stone-400">Manage business retreats, team getaways, and corporate travel offerings.</p>
        </div>
        {canWrite && (
          <button onClick={openAdd} className="py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-sm active:scale-[0.98] transition-all duration-300 flex items-center gap-2 cursor-pointer">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Corporate Package
          </button>
        )}
      </div>

      {/* Category filter tabs */}
      <div className="flex gap-1.5 border-b border-stone-200 pb-3">
        {['All', 'india', 'international'].map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterCategory === cat
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {cat === 'All' ? 'All Corporate' : cat === 'india' ? 'India Trips' : 'International Trips'}
          </button>
        ))}
      </div>

      {/* Packages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3 py-16 text-center text-stone-400 text-sm">
            No corporate packages found. Create one to get started.
          </div>
        )}
        {filtered.map(pkg => {
          const price = pkg.startingPrice != null ? pkg.startingPrice : (pkg.starting_price != null ? pkg.starting_price : null)
          const activeVal = pkg.isActive !== undefined ? pkg.isActive : (pkg.is_active !== undefined ? pkg.is_active : true)
          return (
            <div key={pkg.id} className={`bg-white border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between ${
              !activeVal ? 'opacity-65 border-dashed border-stone-300 bg-stone-50/50' : 'border-stone-200/80'
            }`}>
              <div>
                <div className="h-44 relative bg-stone-100 overflow-hidden">
                  <img
                    src={imgUrl(pkg.imageUrl || pkg.image_url)}
                    alt={pkg.destination}
                    className="w-full h-full object-cover"
                  />
                  <span className={`absolute top-3 right-3 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full text-white shadow-sm ${
                    pkg.category === 'india' ? 'bg-emerald-600' : 'bg-blue-600'
                  }`}>
                    {pkg.category === 'india' ? 'India' : 'International'}
                  </span>
                  {!activeVal && (
                    <span className="absolute top-3 left-3 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full text-white bg-stone-500 shadow-sm border border-stone-400">
                      Inactive
                    </span>
                  )}
                  {pkg.nights && (
                    <span className="absolute bottom-3 left-3 text-[10px] font-bold px-2 py-0.5 bg-stone-900/60 text-white rounded backdrop-blur-xs">
                      {pkg.nights}
                    </span>
                  )}
                </div>
                <div className="p-5 space-y-3">
                  <div>
                    <h3 className="font-bold text-stone-900 text-sm">{pkg.destination}</h3>
                    {price != null && (
                      <p className="text-xs text-amber-700 font-bold mt-1">Starting from ₹{price.toLocaleString()}</p>
                    )}
                  </div>
                  {pkg.description && (
                    <p className="text-xs text-stone-500 leading-relaxed line-clamp-3">{pkg.description}</p>
                  )}
                  {pkg.highlights && pkg.highlights.length > 0 && (
                    <div className="space-y-1 pt-2">
                      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Highlights</span>
                      <ul className="space-y-1">
                        {pkg.highlights.slice(0, 3).map((hl, i) => (
                          <li key={i} className="text-[11px] text-stone-600 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full shrink-0"></span>
                            <span className="truncate">{hl}</span>
                          </li>
                        ))}
                        {pkg.highlights.length > 3 && (
                          <li className="text-[10px] text-stone-400 italic font-medium pl-3">
                            +{pkg.highlights.length - 3} more highlights
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
              <div className="px-5 pb-5 pt-3 border-t border-stone-100 flex gap-2">
                <button
                  onClick={() => setBrochurePkg(pkg)}
                  className="flex-grow py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5"
                  title="Print / Save PDF Brochure"
                >
                  <PrinterIcon className="w-3.5 h-3.5 text-amber-700" />
                  <span>PDF Brochure</span>
                </button>
                {canWrite && (
                  <button onClick={() => openEdit(pkg)} className="py-2 px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold cursor-pointer transition-all">Edit</button>
                )}
                {canWrite && (
                  <button onClick={() => setDeleteTarget(pkg)} className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold cursor-pointer transition-all">Delete</button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-3 sm:p-6 pt-20 sm:pt-24 pb-8 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="corp-pkg-modal-title">
          <div className="bg-white border border-stone-200/90 rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col my-auto overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header (Sticky / Fixed) */}
            <div className="px-6 py-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/50 shrink-0">
              <div>
                <h3 id="corp-pkg-modal-title" className="text-base sm:text-lg font-bold text-stone-900">{editing ? 'Edit Corporate Package' : 'Add Corporate Package'}</h3>
                <p className="text-xs text-stone-500 font-light mt-0.5">Configure corporate travel retreat details and pricing</p>
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
                {!canWrite && <ReadOnlyBanner message="View-only mode — you do not have permission to manage corporate packages" />}
                <fieldset disabled={!canWrite} className="space-y-5">
                  
                  {/* Image Upload Banner */}
                  <div className="flex items-center gap-4 p-4 bg-stone-50/70 border border-stone-200 rounded-xl">
                    <div className="w-20 h-14 rounded-lg bg-stone-100 shadow-inner shrink-0 relative group overflow-hidden border border-stone-200">
                      <img
                        src={imgUrl(form.imageUrl)}
                        alt="Cover Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-grow">
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">Cover Photo</label>
                      <div className="relative flex items-center gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <button
                          type="button"
                          className="px-3.5 py-2 bg-white border border-stone-300 hover:bg-stone-50 rounded-lg text-xs font-semibold text-stone-700 shadow-xs transition-all cursor-pointer"
                        >
                          Upload Image
                        </button>
                        <span className="text-xs text-stone-400">Max 5MB</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">Destination Name <span className="text-rose-500">*</span></label>
                      <input
                        type="text"
                        required
                        value={form.destination}
                        onChange={(e) => setForm({ ...form, destination: e.target.value })}
                        placeholder="e.g. Goa Corporate Retreat"
                        className="w-full bg-stone-50 border border-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-lg p-3 text-sm text-stone-850 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">Nights / Duration</label>
                      <input
                        type="text"
                        value={form.nights}
                        onChange={(e) => setForm({ ...form, nights: e.target.value })}
                        placeholder="e.g. 3 Nights / 4 Days"
                        className="w-full bg-stone-50 border border-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-lg p-3 text-sm text-stone-850 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">Starting Price (₹)</label>
                      <input
                        type="number"
                        value={form.startingPrice}
                        onChange={(e) => setForm({ ...form, startingPrice: e.target.value })}
                        placeholder="e.g. 18500"
                        className="w-full bg-stone-50 border border-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-lg p-3 text-sm text-stone-850 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">Category</label>
                      <select
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                        className="w-full bg-stone-50 border border-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-lg p-3 text-sm text-stone-850 outline-none transition-all"
                      >
                        <option value="india">India Tours</option>
                        <option value="international">International Tours</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">Description</label>
                    <textarea
                      rows="3"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Short description or pitch for corporate clients..."
                      className="w-full bg-stone-50 border border-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-lg p-3 text-sm text-stone-850 outline-none resize-none transition-all"
                    />
                  </div>

                  {/* Highlights Tags */}
                  <div className="space-y-2.5">
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">Highlights</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={highlightInput}
                        onChange={(e) => setHighlightInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addHighlight(); } }}
                        placeholder="Add retreat highlight (e.g. Team Bonding Games)"
                        className="flex-1 bg-stone-50 border border-stone-300 focus:border-amber-500 rounded-lg p-2.5 text-xs sm:text-sm text-stone-800 outline-none"
                      />
                      <button
                        type="button"
                        onClick={addHighlight}
                        className="px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 rounded-lg text-xs font-bold cursor-pointer transition-all active:scale-95"
                      >
                        Add
                      </button>
                    </div>
                    {form.highlights.length > 0 && (
                      <div className="flex flex-wrap gap-2 p-3 bg-stone-50 border border-stone-200 rounded-xl">
                        {form.highlights.map((hl, idx) => (
                          <span key={idx} className="bg-amber-100 text-amber-900 border border-amber-200 text-xs font-semibold py-1 px-3 rounded-lg flex items-center gap-2">
                            {hl}
                            <button
                              type="button"
                              onClick={() => removeHighlight(idx)}
                              className="text-amber-600 hover:text-amber-900 font-bold"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {editing && (
                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-stone-200">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="isActive"
                          checked={form.isActive}
                          onChange={(e) => setForm(prev => ({ ...prev, isActive: e.target.checked }))}
                          className="rounded border-stone-300 text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                        />
                        <label htmlFor="isActive" className="text-xs font-bold text-stone-700 cursor-pointer">Active / Visible</label>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">Display Order</label>
                        <input
                          type="number"
                          value={form.displayOrder}
                          onChange={(e) => setForm({ ...form, displayOrder: e.target.value })}
                          className="w-full bg-stone-50 border border-stone-300 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none"
                        />
                      </div>
                    </div>
                  )}

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
                  {editing ? 'Save Changes' : 'Create Package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-stone-200 rounded-2xl shadow-xl w-full max-w-sm p-6 animate-in zoom-in duration-200 space-y-4">
            <h3 className="text-base font-bold text-stone-900">Delete Corporate Package?</h3>
            <p className="text-xs text-stone-500 leading-relaxed">Are you sure you want to delete <strong className="text-stone-800">{deleteTarget.destination}</strong>? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 border border-stone-200 rounded-lg text-xs font-semibold text-stone-600 hover:bg-stone-50 active:scale-95 transition-all cursor-pointer">Cancel</button>
              <button onClick={confirmDelete} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold shadow active:scale-95 transition-all cursor-pointer">Delete</button>
            </div>
          </div>
        </div>
      )}
      {/* Brochure Modal for Printing / Download */}
      <PackageBrochureModal
        pkg={brochurePkg}
        isOpen={!!brochurePkg}
        onClose={() => setBrochurePkg(null)}
      />
    </div>
  )
}

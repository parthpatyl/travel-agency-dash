import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Markdown from 'react-markdown'
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
  highlights: [],
  itinerary: [],
  termsAndConditions: ''
}

export default function CorporatePackagesPage({ corporatePackages, setCorporatePackages, addNotification, user }) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(defaultForm)
  const [formTab, setFormTab] = useState('basic')
  const [highlightInput, setHighlightInput] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [brochurePkg, setBrochurePkg] = useState(null)

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
    if (showForm || deleteTarget) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [showForm, deleteTarget])

  const [filterCategory, setFilterCategory] = useState('All')
  const [termsTab, setTermsTab] = useState('write')
  const fileInputRef = useRef(null)

  // Itinerary builder state
  const [itineraryDayNum, setItineraryDayNum] = useState('1')
  const [itineraryDayTitle, setItineraryDayTitle] = useState('')
  const [itineraryDayDesc, setItineraryDayDesc] = useState('')
  const [editingItineraryDayIdx, setEditingItineraryDayIdx] = useState(null)

  const canWrite = roleHas(user?.role, 'write:packages') || roleHas(user?.role, 'create:packages')

  const handleAddItineraryDay = (e) => {
    if (e) e.preventDefault()
    if (!itineraryDayNum || !itineraryDayTitle.trim() || !itineraryDayDesc.trim()) return
    const dayNum = parseInt(itineraryDayNum) || 1
    let updated = [...(form.itinerary || [])]
    if (editingItineraryDayIdx !== null && editingItineraryDayIdx < updated.length) {
      updated[editingItineraryDayIdx] = { day: dayNum, title: itineraryDayTitle.trim(), desc: itineraryDayDesc.trim() }
      setEditingItineraryDayIdx(null)
    } else {
      const existingIdx = updated.findIndex(item => item.day === dayNum)
      if (existingIdx >= 0) {
        updated[existingIdx] = { day: dayNum, title: itineraryDayTitle.trim(), desc: itineraryDayDesc.trim() }
      } else {
        updated.push({ day: dayNum, title: itineraryDayTitle.trim(), desc: itineraryDayDesc.trim() })
      }
    }
    updated.sort((a, b) => a.day - b.day)
    setForm(prev => ({ ...prev, itinerary: updated }))
    setItineraryDayNum((updated.length + 1).toString())
    setItineraryDayTitle('')
    setItineraryDayDesc('')
  }

  const handleStartEditItineraryDay = (idx) => {
    const dayItem = form.itinerary[idx]
    if (!dayItem) return
    setEditingItineraryDayIdx(idx)
    setItineraryDayNum(dayItem.day.toString())
    setItineraryDayTitle(dayItem.title)
    setItineraryDayDesc(dayItem.desc)
  }

  const handleRemoveItineraryDay = (dayNum) => {
    setForm(prev => ({
      ...prev,
      itinerary: (prev.itinerary || []).filter(item => item.day !== dayNum)
    }))
    if (editingItineraryDayIdx !== null) {
      setEditingItineraryDayIdx(null)
      setItineraryDayTitle('')
      setItineraryDayDesc('')
    }
  }

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
    setFormTab('basic')
    setHighlightInput('')
    setEditing(null)
    setEditingItineraryDayIdx(null)
    setItineraryDayNum('1')
    setItineraryDayTitle('')
    setItineraryDayDesc('')
    setShowForm(true)
  }

  const openEdit = (pkg) => {
    if (!canWrite) {
      if (addNotification) addNotification('You do not have permission to edit corporate packages', 'error')
      return
    }
    const currentItinerary = Array.isArray(pkg.itinerary) ? pkg.itinerary : []
    setForm({
      destination: pkg.destination || '',
      nights: pkg.nights || '',
      startingPrice: pkg.startingPrice != null ? pkg.startingPrice : (pkg.starting_price != null ? pkg.starting_price : ''),
      category: pkg.category || 'india',
      imageUrl: pkg.imageUrl || pkg.image_url || '',
      description: pkg.description || '',
      highlights: pkg.highlights || [],
      itinerary: currentItinerary,
      isActive: pkg.isActive !== undefined ? pkg.isActive : (pkg.is_active !== undefined ? pkg.is_active : true),
      displayOrder: pkg.displayOrder !== undefined ? pkg.displayOrder : (pkg.display_order !== undefined ? pkg.display_order : 0),
      termsAndConditions: pkg.termsAndConditions || pkg.terms_and_conditions || ''
    })
    setFormTab('basic')
    setHighlightInput('')
    setEditing(pkg)
    setEditingItineraryDayIdx(null)
    setItineraryDayNum(((currentItinerary.length || 0) + 1).toString())
    setItineraryDayTitle('')
    setItineraryDayDesc('')
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
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="font-bold text-stone-900 text-sm truncate">{pkg.destination}</h3>
                      {pkg.itinerary && pkg.itinerary.length > 0 && (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-800 text-[10px] font-bold rounded-full border border-amber-200 shrink-0">
                          {pkg.itinerary.length} Days
                        </span>
                      )}
                    </div>
                    {price != null && (
                      <p className="text-xs text-amber-700 font-bold">Starting from ₹{price.toLocaleString()}</p>
                    )}
                  </div>
                  {pkg.description && (
                    <p className="text-xs text-stone-500 leading-relaxed line-clamp-2">{pkg.description}</p>
                  )}
                  {pkg.highlights && pkg.highlights.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Highlights</span>
                      <ul className="space-y-1">
                        {pkg.highlights.slice(0, 2).map((hl, i) => (
                          <li key={i} className="text-[11px] text-stone-600 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full shrink-0"></span>
                            <span className="truncate">{hl}</span>
                          </li>
                        ))}
                        {pkg.highlights.length > 2 && (
                          <li className="text-[10px] text-stone-400 italic font-medium pl-3">
                            +{pkg.highlights.length - 2} more highlights
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
      {showForm && createPortal(
        <div className="fixed inset-0 z-[100] bg-stone-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 md:p-8 min-h-screen overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="corp-pkg-modal-title">
          <div className="bg-white border border-stone-200/90 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] sm:max-h-[88vh] flex flex-col my-auto overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header (Sticky / Fixed) */}
            <div className="px-5 py-4 sm:px-6 sm:py-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/70 shrink-0">
              <div className="min-w-0 pr-2">
                <h3 id="corp-pkg-modal-title" className="text-base sm:text-lg font-bold text-stone-900 truncate">{editing ? 'Edit Corporate Package' : 'Add Corporate Package'}</h3>
                <p className="text-[11px] sm:text-xs text-stone-500 font-light mt-0.5 truncate">Configure corporate travel retreat details, day-by-day itinerary schedule, and pricing</p>
              </div>
              <button 
                type="button" 
                onClick={() => { setShowForm(false); setEditing(null) }} 
                className="p-1.5 rounded-lg hover:bg-stone-200/70 text-stone-400 hover:text-stone-600 transition-colors cursor-pointer shrink-0"
                title="Close (Esc)"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Tabs Bar */}
            <div className="flex border-b border-stone-200 bg-stone-50/80 px-6 pt-2 gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setFormTab('basic')}
                className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                  formTab === 'basic'
                    ? 'border-amber-600 text-amber-700'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                1. Basic Info
              </button>
              <button
                type="button"
                onClick={() => setFormTab('itinerary')}
                className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                  formTab === 'itinerary'
                    ? 'border-amber-600 text-amber-700'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                <span>2. Itinerary Schedule</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  form.itinerary?.length > 0 ? 'bg-amber-100 text-amber-800' : 'bg-stone-200 text-stone-600'
                }`}>
                  {form.itinerary?.length || 0}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setFormTab('terms')}
                className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                  formTab === 'terms'
                    ? 'border-amber-600 text-amber-700'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                3. Terms & Conditions
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col min-h-0 flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
                {!canWrite && <ReadOnlyBanner message="View-only mode — you do not have permission to manage corporate packages" />}
                <fieldset disabled={!canWrite} className="space-y-5">
                  
                  {/* TAB 1: BASIC INFO */}
                  {formTab === 'basic' && (
                    <div className="space-y-5">
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
                                  className="text-amber-600 hover:text-amber-900 font-bold cursor-pointer"
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
                    </div>
                  )}

                  {/* TAB 2: ITINERARY SCHEDULE */}
                  {formTab === 'itinerary' && (
                    <div className="space-y-6">
                      <div className="bg-[#FAF9F5] border border-amber-200/70 rounded-xl p-4.5 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                            {editingItineraryDayIdx !== null ? `Edit Day ${itineraryDayNum}` : 'Add New Itinerary Day'}
                          </h4>
                          {editingItineraryDayIdx !== null && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingItineraryDayIdx(null)
                                setItineraryDayNum(((form.itinerary?.length || 0) + 1).toString())
                                setItineraryDayTitle('')
                                setItineraryDayDesc('')
                              }}
                              className="text-[11px] text-stone-500 hover:text-stone-800 font-semibold cursor-pointer"
                            >
                              Cancel Editing
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                          <div className="sm:col-span-1">
                            <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Day #</label>
                            <input
                              type="number"
                              min="1"
                              value={itineraryDayNum}
                              onChange={(e) => setItineraryDayNum(e.target.value)}
                              className="w-full bg-white border border-stone-300 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none font-bold"
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Day Title / Theme</label>
                            <input
                              type="text"
                              value={itineraryDayTitle}
                              onChange={(e) => setItineraryDayTitle(e.target.value)}
                              placeholder="e.g. Arrival in Goa, Welcome Dinner & Team Briefing"
                              className="w-full bg-white border border-stone-300 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Activities / Highlights (Markdown Supported)</label>
                          <textarea
                            rows="3"
                            value={itineraryDayDesc}
                            onChange={(e) => setItineraryDayDesc(e.target.value)}
                            placeholder="Describe day schedule, team workshops, excursions, gala dinners, transfers..."
                            className="w-full bg-white border border-stone-300 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none resize-y"
                          />
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={handleAddItineraryDay}
                            disabled={!itineraryDayTitle.trim() || !itineraryDayDesc.trim()}
                            className="py-2 px-4 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer transition-all active:scale-95 flex items-center gap-1.5"
                          >
                            <span>{editingItineraryDayIdx !== null ? 'Save Day Changes' : '+ Add Day to Itinerary'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Scheduled Days List */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-stone-600 uppercase tracking-wider">
                            Scheduled Days ({form.itinerary?.length || 0})
                          </span>
                          <span className="text-[11px] text-stone-400">Click edit to modify any day</span>
                        </div>

                        {(!form.itinerary || form.itinerary.length === 0) ? (
                          <div className="text-center py-10 bg-stone-50 border border-dashed border-stone-200 rounded-xl">
                            <p className="text-xs text-stone-400 font-medium">No days added to this corporate itinerary yet.</p>
                            <p className="text-[11px] text-stone-400 mt-1">Use the form above to add Day 1, Day 2, etc.</p>
                          </div>
                        ) : (
                          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                            {form.itinerary.map((dayItem, idx) => (
                              <div
                                key={dayItem.day}
                                className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 transition-all ${
                                  editingItineraryDayIdx === idx
                                    ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-400'
                                    : 'bg-white border-stone-200 hover:border-stone-300'
                                }`}
                              >
                                <div className="flex items-start gap-3 min-w-0">
                                  <span className="w-7 h-7 rounded-full bg-amber-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                                    D{dayItem.day}
                                  </span>
                                  <div className="min-w-0 space-y-1">
                                    <h5 className="font-bold text-xs text-stone-900 truncate">{dayItem.title}</h5>
                                    <p className="text-[11px] text-stone-600 leading-relaxed line-clamp-2">{dayItem.desc}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0 pt-0.5">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditItineraryDay(idx)}
                                    className="p-1.5 rounded-lg hover:bg-amber-50 text-stone-400 hover:text-amber-700 transition-colors cursor-pointer"
                                    title="Edit Day"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItineraryDay(dayItem.day)}
                                    className="p-1.5 rounded-lg hover:bg-rose-50 text-stone-400 hover:text-rose-600 transition-colors cursor-pointer"
                                    title="Delete Day"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: TERMS & CONDITIONS */}
                  {formTab === 'terms' && (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                            Terms & Conditions (Markdown Supported)
                          </label>
                          <div className="flex gap-1 text-[10px] font-bold">
                            <button
                              type="button"
                              onClick={() => setTermsTab('write')}
                              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${termsTab === 'write' ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                            >
                              Write
                            </button>
                            <button
                              type="button"
                              onClick={() => setTermsTab('preview')}
                              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${termsTab === 'preview' ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                            >
                              Preview
                            </button>
                          </div>
                        </div>
                        {termsTab === 'write' ? (
                          <textarea
                            rows="6"
                            value={form.termsAndConditions}
                            onChange={(e) => setForm({ ...form, termsAndConditions: e.target.value })}
                            placeholder="Enter terms & conditions in markdown format..."
                            className="w-full bg-stone-50 border border-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-lg p-3 text-sm text-stone-850 outline-none font-mono resize-y transition-all"
                          />
                        ) : (
                          <div className="p-3 bg-amber-50/50 border border-amber-200/60 rounded-lg text-xs text-stone-700 leading-relaxed min-h-[120px]">
                            {form.termsAndConditions?.trim() ? (
                              <Markdown>{form.termsAndConditions}</Markdown>
                            ) : (
                              <span className="text-stone-400 italic">No terms entered yet.</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                </fieldset>
              </div>

              {/* Sticky Action Footer */}
              <div className="px-6 py-4 border-t border-stone-100 flex justify-between items-center shrink-0 bg-stone-50/60 rounded-b-2xl">
                <div className="text-xs text-stone-500">
                  {form.itinerary?.length || 0} itinerary day(s) configured
                </div>
                <div className="flex gap-3">
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
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation */}
      {deleteTarget && createPortal(
        <div className="fixed inset-0 z-[100] bg-stone-950/80 backdrop-blur-md flex items-center justify-center p-4 min-h-screen animate-in fade-in duration-200">
          <div className="bg-white border border-stone-200 rounded-2xl shadow-xl w-full max-w-sm p-6 animate-in zoom-in duration-200 space-y-4">
            <h3 className="text-base font-bold text-stone-900">Delete Corporate Package?</h3>
            <p className="text-xs text-stone-500 leading-relaxed">Are you sure you want to delete <strong className="text-stone-800">{deleteTarget.destination}</strong>? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 border border-stone-200 rounded-lg text-xs font-semibold text-stone-600 hover:bg-stone-50 active:scale-95 transition-all cursor-pointer">Cancel</button>
              <button onClick={confirmDelete} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold shadow active:scale-95 transition-all cursor-pointer">Delete</button>
            </div>
          </div>
        </div>,
        document.body
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

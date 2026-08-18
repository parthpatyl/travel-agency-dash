import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Markdown from 'react-markdown'
import { roleHas } from '../utils/permissions'
import ReadOnlyBanner from './ReadOnlyBanner'

const API_URL_DEFAULT = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export default function GroupDeparturesPage({ groupDepartures, setGroupDepartures, packages = [], setPackages, addNotification, user, token }) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [formTab, setFormTab] = useState('details')
  const [filterStatus, setFilterStatus] = useState('scheduled')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [termsTab, setTermsTab] = useState('write')

  // Itinerary builder state
  const [itineraryDayNum, setItineraryDayNum] = useState('1')
  const [itineraryDayTitle, setItineraryDayTitle] = useState('')
  const [itineraryDayDesc, setItineraryDayDesc] = useState('')
  const [editingItineraryDayIdx, setEditingItineraryDayIdx] = useState(null)

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

  // Package Mode: 'existing' vs 'new'
  const [pkgMode, setPkgMode] = useState('existing')
  const [newPkgName, setNewPkgName] = useState('')
  const [newPkgDuration, setNewPkgDuration] = useState('5')
  const [newPkgPrice, setNewPkgPrice] = useState('3000')
  const [newPkgRegion, setNewPkgRegion] = useState('Asia')
  const [newPkgCategory, setNewPkgCategory] = useState('standard')
  const [newPkgDescription, setNewPkgDescription] = useState('')

  const activePackages = (packages || []).filter(p => !p.isBespoke)

  const [form, setForm] = useState({
    packageId: '',
    title: '',
    departureDate: '',
    returnDate: '',
    slotsTotal: 20,
    slotsBooked: 0,
    priceModifier: 0,
    costPrice: 0,
    ctaBadge: 'Guaranteed Departure',
    inclusions: '',
    exclusions: '',
    itinerary: [],
    status: 'scheduled',
    notes: '',
    termsAndConditions: ''
  })

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

  // Auto-populate departure details when base package is selected
  const handleSelectBasePackage = (pkgId) => {
    const selectedPkg = packages.find(p => p.id === pkgId)
    if (selectedPkg) {
      setForm(prev => ({
        ...prev,
        packageId: pkgId,
        title: prev.title || selectedPkg.name || '',
        costPrice: selectedPkg.costPrice != null ? selectedPkg.costPrice : (selectedPkg.basePrice || prev.costPrice),
        inclusions: Array.isArray(selectedPkg.inclusions) ? selectedPkg.inclusions.join(', ') : (selectedPkg.inclusions || ''),
        exclusions: Array.isArray(selectedPkg.exclusions) ? selectedPkg.exclusions.join(', ') : (selectedPkg.exclusions || ''),
        itinerary: (!prev.itinerary || prev.itinerary.length === 0) && selectedPkg.itinerary ? [...selectedPkg.itinerary] : prev.itinerary,
        notes: selectedPkg.description || prev.notes,
        termsAndConditions: prev.termsAndConditions || selectedPkg.termsAndConditions || ''
      }))
    } else {
      setForm(prev => ({ ...prev, packageId: pkgId }))
    }
  }

  const canWrite = roleHas(user?.role, 'write:packages') || roleHas(user?.role, 'create:packages')

  const openAdd = () => {
    if (!canWrite) {
      if (addNotification) addNotification('You do not have permission to manage group departures', 'error')
      return
    }
    const initialPkg = activePackages[0]
    const initialItinerary = initialPkg?.itinerary ? [...initialPkg.itinerary] : []
    setForm({
      packageId: initialPkg?.id || '',
      title: '',
      departureDate: '',
      returnDate: '',
      slotsTotal: 20,
      slotsBooked: 0,
      priceModifier: 0,
      costPrice: 0,
      ctaBadge: 'Guaranteed Departure',
      inclusions: '',
      exclusions: '',
      itinerary: initialItinerary,
      status: 'scheduled',
      notes: '',
      termsAndConditions: initialPkg?.termsAndConditions || ''
    })
    setFormTab('details')
    setEditing(null)
    setEditingItineraryDayIdx(null)
    setItineraryDayNum(((initialItinerary.length || 0) + 1).toString())
    setItineraryDayTitle('')
    setItineraryDayDesc('')
    setPkgMode('existing')
    setShowForm(true)
  }

  const openEdit = (dep) => {
    if (!canWrite) {
      if (addNotification) addNotification('You do not have permission to edit group departures', 'error')
      return
    }
    
    // Format dates to YYYY-MM-DD for date inputs
    const formatDateInput = (dateStr) => {
      if (!dateStr) return ''
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return ''
      return d.toISOString().split('T')[0]
    }

    const currentItinerary = Array.isArray(dep.itinerary) ? dep.itinerary : []

    setForm({
      packageId: dep.packageId || '',
      title: dep.title || '',
      departureDate: formatDateInput(dep.departureDate),
      returnDate: formatDateInput(dep.returnDate),
      slotsTotal: dep.slots?.total ?? dep.slotsTotal ?? 20,
      slotsBooked: dep.slots?.booked ?? dep.slotsBooked ?? 0,
      priceModifier: dep.priceModifier ?? 0,
      costPrice: dep.costPrice ?? 0,
      ctaBadge: dep.ctaBadge || 'Guaranteed Departure',
      inclusions: Array.isArray(dep.inclusions) ? dep.inclusions.join(', ') : (dep.inclusions || ''),
      exclusions: Array.isArray(dep.exclusions) ? dep.exclusions.join(', ') : (dep.exclusions || ''),
      itinerary: currentItinerary,
      status: dep.status || 'scheduled',
      notes: dep.notes || '',
      termsAndConditions: dep.termsAndConditions || ''
    })
    setFormTab('details')
    setEditing(dep)
    setPkgMode('existing')
    setEditingItineraryDayIdx(null)
    setItineraryDayNum(((currentItinerary.length || 0) + 1).toString())
    setItineraryDayTitle('')
    setItineraryDayDesc('')
    setShowForm(true)
  }

  const handleSave = (e) => {
    e.preventDefault()

    let activePackageId = form.packageId
    let createdPkgObj = null

    if (pkgMode === 'new' && !editing) {
      if (!newPkgName.trim()) {
        if (addNotification) addNotification('Please enter Package Name', 'warning')
        return
      }
      activePackageId = `PKG-${crypto.randomUUID()}`
      createdPkgObj = {
        id: activePackageId,
        name: newPkgName.trim(),
        duration: `${newPkgDuration} Days`,
        basePrice: parseFloat(newPkgPrice) || 0,
        region: newPkgRegion,
        category: newPkgCategory,
        slots: { booked: 0, total: parseInt(form.slotsTotal) || 20 },
        trend: 'New',
        description: newPkgDescription.trim() || `${newPkgName} scheduled tour package.`,
        cardImage: `${API_URL_DEFAULT}/assets/unsplash-pkg-card.jpg`,
        heroImage: `${API_URL_DEFAULT}/assets/unsplash-pkg-hero.jpg`,
        itinerary: form.itinerary || [],
        isBespoke: false,
        termsAndConditions: form.termsAndConditions
      }

      if (setPackages) setPackages([createdPkgObj, ...packages])
    }

    if (!activePackageId) {
      if (addNotification) addNotification('Please select a base package', 'warning')
      return
    }
    if (!form.title.trim()) {
      if (addNotification) addNotification('Departure title is required', 'warning')
      return
    }
    if (!form.departureDate || !form.returnDate) {
      if (addNotification) addNotification('Departure and return dates are required', 'warning')
      return
    }

    const parseList = (str) => typeof str === 'string' ? str.split(',').map(s => s.trim()).filter(Boolean) : (str || [])

    const payload = {
      packageId: activePackageId,
      title: form.title.trim(),
      departureDate: form.departureDate,
      returnDate: form.returnDate,
      slots: {
        booked: parseInt(form.slotsBooked) || 0,
        total: parseInt(form.slotsTotal) || 20
      },
      slotsTotal: parseInt(form.slotsTotal) || 20,
      slotsBooked: parseInt(form.slotsBooked) || 0,
      priceModifier: parseFloat(form.priceModifier) || 0,
      costPrice: parseFloat(form.costPrice) || 0,
      ctaBadge: form.ctaBadge || 'Guaranteed Departure',
      inclusions: parseList(form.inclusions),
      exclusions: parseList(form.exclusions),
      itinerary: form.itinerary || [],
      status: form.status || 'scheduled',
      notes: form.notes,
      termsAndConditions: form.termsAndConditions
    }

    const pkg = createdPkgObj || packages.find(p => p.id === activePackageId)
    if (pkg) {
      payload.packageName = pkg.name
      payload.packageRegion = pkg.region
      payload.packageDuration = pkg.duration
      payload.packageCardImage = pkg.cardImage
      payload.packageBasePrice = pkg.basePrice
    } else if (editing) {
      payload.packageName = editing.packageName
      payload.packageRegion = editing.packageRegion
      payload.packageDuration = editing.packageDuration
      payload.packageCardImage = editing.packageCardImage
      payload.packageBasePrice = editing.packageBasePrice
    }

    if (editing) {
      setGroupDepartures(groupDepartures.map(g => String(g.id) === String(editing.id) ? { ...g, ...payload, id: editing.id } : g))
      if (addNotification) addNotification(`Group departure "${form.title}" updated`, 'success')
    } else {
      const newDep = {
        id: `temp-group-${Date.now()}`,
        ...payload
      }
      setGroupDepartures([...groupDepartures, newDep])
      if (addNotification) addNotification(`Group departure "${form.title}" created`, 'success')
    }
    setShowForm(false)
    setEditing(null)
    setPkgMode('existing')
    setNewPkgName('')
    setNewPkgDescription('')
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    setGroupDepartures(groupDepartures.filter(g => String(g.id) !== String(deleteTarget.id)))
    if (addNotification) addNotification(`Group departure "${deleteTarget.title}" deleted`, 'info')
    setDeleteTarget(null)
  }

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'scheduled': return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
      case 'confirmed': return 'bg-sky-500/10 text-sky-700 border-sky-500/20'
      case 'departed': return 'bg-blue-500/10 text-blue-700 border-blue-500/20'
      case 'cancelled': return 'bg-rose-500/10 text-rose-700 border-rose-500/20'
      default: return 'bg-stone-100 text-stone-700 border-stone-200'
    }
  }

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const filtered = groupDepartures.filter(dep => {
    if (filterStatus === 'All' || filterStatus === 'all') return true
    return dep.status === filterStatus
  })

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h2 className="text-2xl font-bold text-stone-900 tracking-tight">Group Departures</h2>
          <p className="text-sm text-stone-400 mt-1">Manage fixed-date departures, track seat availability, and coordinate group travel slots.</p>
        </div>
        {canWrite && (
          <button onClick={openAdd} className="py-3 px-6 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-bold shadow-sm active:scale-[0.98] transition-all duration-300 flex items-center gap-2 cursor-pointer">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Group Departure
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 border-b border-stone-200 pb-4">
        {[
          { key: 'All', label: 'All Departures' },
          { key: 'scheduled', label: 'Scheduled' },
          { key: 'confirmed', label: 'Confirmed' },
          { key: 'departed', label: 'Departed' },
          { key: 'cancelled', label: 'Cancelled' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilterStatus(tab.key)}
            className={`px-4.5 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${
              filterStatus === tab.key
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Departures Grid / Table */}
      <div className="bg-white border border-stone-200/80 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-250/60 text-xs font-bold text-stone-400 uppercase tracking-wider">
                <th className="py-5 px-6">Departure Title</th>
                <th className="py-5 px-6">Base Package</th>
                <th className="py-5 px-6">Date Range</th>
                <th className="py-5 px-6">Slots Available</th>
                <th className="py-5 px-6">Price Modifier</th>
                <th className="py-5 px-6">Status</th>
                <th className="py-5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-20 text-center text-stone-400 text-sm italic">
                    No group departures matching criteria.
                  </td>
                </tr>
              ) : (
                filtered.map(dep => {
                  const slots = dep.slots || { booked: 0, total: 20 }
                  const pct = Math.min(100, Math.round((slots.booked / slots.total) * 100)) || 0
                  
                  return (
                    <tr key={dep.id} className="hover:bg-stone-50/50 transition-colors">
                      <td className="py-5 px-6">
                        <span className="font-bold text-stone-900 text-sm block">{dep.title}</span>
                        {dep.notes && <span className="text-xs text-stone-400 mt-1 block truncate max-w-md">{dep.notes}</span>}
                        {dep.itinerary && dep.itinerary.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60 mt-1">
                            📅 {dep.itinerary.length} Days Itinerary
                          </span>
                        )}
                      </td>
                      <td className="py-5 px-6">
                        <span className="text-sm text-stone-600 font-semibold">{dep.packageName || 'Base Package'}</span>
                        <span className="text-xs text-stone-400 block mt-1">{dep.packageRegion || 'Region'}</span>
                      </td>
                      <td className="py-5 px-6">
                        <span className="text-sm text-stone-750 font-medium block">{formatDateDisplay(dep.departureDate)}</span>
                        <span className="text-xs text-stone-400 font-medium block mt-1">to {formatDateDisplay(dep.returnDate)}</span>
                      </td>
                      <td className="py-5 px-6">
                        <div className="flex items-center gap-3 max-w-[180px]">
                          <div className="flex-1 bg-stone-100 rounded-full h-2 overflow-hidden">
                            <div className="bg-amber-600 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                          </div>
                          <span className="text-xs font-bold text-stone-600 shrink-0">
                            {slots.booked}/{slots.total}
                          </span>
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <span className={`text-sm font-semibold ${dep.priceModifier > 0 ? 'text-amber-700' : dep.priceModifier < 0 ? 'text-emerald-700' : 'text-stone-500'}`}>
                          {dep.priceModifier > 0 ? `+₹${dep.priceModifier.toLocaleString()}` : dep.priceModifier < 0 ? `-₹${Math.abs(dep.priceModifier).toLocaleString()}` : '₹0'}
                        </span>
                      </td>
                      <td className="py-5 px-6">
                        <span className={`inline-block px-3 py-1 text-[11px] font-extrabold uppercase rounded-full border ${getStatusBadgeClass(dep.status)}`}>
                          {dep.status}
                        </span>
                      </td>
                      <td className="py-5 px-6 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          {canWrite && (
                            <button onClick={() => openEdit(dep)} className="py-1.5 px-3.5 border border-stone-200 hover:bg-stone-100 text-stone-600 rounded-lg text-xs font-bold transition-all cursor-pointer">Edit</button>
                          )}
                          {canWrite && (
                            <button onClick={() => setDeleteTarget(dep)} className="py-1.5 px-3.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-bold transition-all cursor-pointer">Delete</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showForm && createPortal(
        <div className="fixed inset-0 z-[100] bg-stone-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 md:p-8 min-h-screen overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="group-dep-modal-title">
          <div className="bg-white border border-stone-200/90 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] sm:max-h-[88vh] flex flex-col my-auto overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header (Fixed / Sticky) */}
            <div className="px-5 py-4 sm:px-6 sm:py-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/70 shrink-0">
              <div className="min-w-0 pr-2">
                <h3 id="group-dep-modal-title" className="text-base sm:text-lg font-bold text-stone-900 truncate">{editing ? 'Edit Group Departure' : 'Add Group Departure'}</h3>
                <p className="text-[11px] sm:text-xs text-stone-500 font-light mt-0.5 truncate">Configure departure batch details, day-by-day itinerary schedule, slots, pricing, and inclusions</p>
              </div>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditing(null) }}
                className="p-1.5 rounded-lg hover:bg-stone-200/70 text-stone-400 hover:text-stone-600 transition-colors cursor-pointer shrink-0"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex border-b border-stone-200 bg-stone-50/80 px-6 pt-2 gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setFormTab('details')}
                className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                  formTab === 'details'
                    ? 'border-amber-600 text-amber-700'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                1. Departure Details
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
                <span>2. Inclusions & Itinerary</span>
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

            {/* Modal Scrollable Content */}
            <form onSubmit={handleSave} className="flex flex-col min-h-0 flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
                {!canWrite && <ReadOnlyBanner message="View-only mode — you do not have permission to manage group departures" />}
                <fieldset disabled={!canWrite} className="space-y-5">
                
                {/* TAB 1: DEPARTURE DETAILS */}
                {formTab === 'details' && (
                  <div className="space-y-5">
                    {/* Base Package Selector */}
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label htmlFor="form-package-id" className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                          Base Package <span className="text-rose-500" aria-hidden="true">*</span>
                        </label>
                        {!editing && (
                          <div className="flex gap-1 text-[10px]">
                            <button
                              type="button"
                              onClick={() => setPkgMode('existing')}
                              className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${pkgMode === 'existing' ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                            >
                              Existing
                            </button>
                            <button
                              type="button"
                              onClick={() => setPkgMode('new')}
                              className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${pkgMode === 'new' ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                            >
                              + Create New Package
                            </button>
                          </div>
                        )}
                      </div>

                      {pkgMode === 'existing' || editing ? (
                        <select
                          id="form-package-id"
                          value={form.packageId}
                          onChange={(e) => handleSelectBasePackage(e.target.value)}
                          className="w-full bg-stone-50 border border-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-lg p-3 text-sm text-stone-850 outline-none transition-all"
                          required={pkgMode === 'existing'}
                        >
                          <option value="">— Select Base Package —</option>
                          {activePackages.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.duration})</option>
                          ))}
                        </select>
                      ) : (
                        <div className="space-y-3.5 bg-amber-50/40 p-4 rounded-xl border border-amber-200/60">
                          <div>
                            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">Package Name *</label>
                            <input
                              type="text"
                              required={pkgMode === 'new'}
                              placeholder="e.g. Greece & Turkey Wonders Odyssey"
                              value={newPkgName}
                              onChange={(e) => setNewPkgName(e.target.value)}
                              className="w-full bg-white border border-stone-300 focus:border-amber-500 rounded-lg p-3 text-sm text-stone-800 outline-none"
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">Duration (Days)</label>
                              <input
                                type="number"
                                min="1"
                                required={pkgMode === 'new'}
                                value={newPkgDuration}
                                onChange={(e) => setNewPkgDuration(e.target.value)}
                                className="w-full bg-white border border-stone-300 focus:border-amber-500 rounded-lg p-3 text-sm text-stone-800 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">Price (₹)</label>
                              <input
                                type="number"
                                required={pkgMode === 'new'}
                                value={newPkgPrice}
                                onChange={(e) => setNewPkgPrice(e.target.value)}
                                className="w-full bg-white border border-stone-300 focus:border-amber-500 rounded-lg p-3 text-sm text-stone-800 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">Region</label>
                              <select
                                value={newPkgRegion}
                                onChange={(e) => setNewPkgRegion(e.target.value)}
                                className="w-full bg-white border border-stone-300 focus:border-amber-500 rounded-lg p-3 text-sm text-stone-800 outline-none"
                              >
                                <option value="Asia">Asia</option>
                                <option value="Europe">Europe</option>
                                <option value="Africa">Africa</option>
                                <option value="Middle East">Middle East</option>
                                <option value="North America">North America</option>
                                <option value="South America">South America</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label htmlFor="form-title" className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                        Departure Title <span className="text-rose-500" aria-hidden="true">*</span>
                      </label>
                      <input
                        id="form-title"
                        type="text"
                        required
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        placeholder="e.g. Dubai Shopping Festival — Dec 2026 Batch"
                        className="w-full bg-stone-50 border border-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-lg p-3 text-sm text-stone-855 outline-none transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="form-departure-date" className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                          Departure Date <span className="text-rose-500" aria-hidden="true">*</span>
                        </label>
                        <input
                          id="form-departure-date"
                          type="date"
                          required
                          value={form.departureDate}
                          onChange={(e) => setForm({ ...form, departureDate: e.target.value })}
                          className="w-full bg-stone-50 border border-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-lg p-3 text-sm text-stone-855 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label htmlFor="form-return-date" className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                          Return Date <span className="text-rose-500" aria-hidden="true">*</span>
                        </label>
                        <input
                          id="form-return-date"
                          type="date"
                          required
                          value={form.returnDate}
                          onChange={(e) => setForm({ ...form, returnDate: e.target.value })}
                          className="w-full bg-stone-50 border border-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-lg p-3 text-sm text-stone-855 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="form-slots-total" className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                          Total Allotment Slots <span className="text-rose-500" aria-hidden="true">*</span>
                        </label>
                        <input
                          id="form-slots-total"
                          type="number"
                          required
                          min="1"
                          value={form.slotsTotal}
                          onChange={(e) => setForm({ ...form, slotsTotal: e.target.value })}
                          className="w-full bg-stone-50 border border-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-lg p-3 text-sm text-stone-855 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label htmlFor="form-slots-booked" className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                          Booked Slots <span className="text-rose-500" aria-hidden="true">*</span>
                        </label>
                        <input
                          id="form-slots-booked"
                          type="number"
                          required
                          min="0"
                          value={form.slotsBooked}
                          onChange={(e) => setForm({ ...form, slotsBooked: e.target.value })}
                          className="w-full bg-stone-50 border border-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-lg p-3 text-sm text-stone-855 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label htmlFor="form-price-modifier" className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                          Price Modifier (₹)
                        </label>
                        <input
                          id="form-price-modifier"
                          type="number"
                          value={form.priceModifier}
                          onChange={(e) => setForm({ ...form, priceModifier: e.target.value })}
                          placeholder="e.g. 0"
                          className="w-full bg-stone-50 border border-stone-300 focus:border-amber-500 rounded-lg p-3 text-sm text-stone-855 outline-none"
                        />
                      </div>
                      <div>
                        <label htmlFor="form-cost-price" className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                          Supplier Cost (₹)
                        </label>
                        <input
                          id="form-cost-price"
                          type="number"
                          value={form.costPrice}
                          onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                          placeholder="e.g. 150000"
                          className="w-full bg-stone-50 border border-stone-300 focus:border-amber-500 rounded-lg p-3 text-sm text-stone-855 outline-none"
                        />
                      </div>
                      <div>
                        <label htmlFor="form-cta-badge" className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                          CTA / Urgency Badge
                        </label>
                        <select
                          id="form-cta-badge"
                          value={form.ctaBadge}
                          onChange={(e) => setForm({ ...form, ctaBadge: e.target.value })}
                          className="w-full bg-stone-50 border border-stone-300 focus:border-amber-500 rounded-lg p-3 text-sm text-stone-855 outline-none"
                        >
                          <option value="Guaranteed Departure">Guaranteed Departure</option>
                          <option value="Filling Fast">Filling Fast</option>
                          <option value="Limited Seats">Limited Seats</option>
                          <option value="Early Bird Special">Early Bird Special</option>
                          <option value="Seasonal Special">Seasonal Special</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="form-status" className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                          Departure Status
                        </label>
                        <select
                          id="form-status"
                          value={form.status}
                          onChange={(e) => setForm({ ...form, status: e.target.value })}
                          className="w-full bg-stone-50 border border-stone-300 focus:border-amber-500 rounded-lg p-3 text-sm text-stone-855 outline-none"
                        >
                          <option value="scheduled">Scheduled</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="departed">Departed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                    </div>

                    {/* Live Margin Calculation Preview */}
                    {(() => {
                      const cost = parseFloat(form.costPrice) || 0
                      const modifier = parseFloat(form.priceModifier) || 0
                      const basePkg = packages.find(p => p.id === form.packageId)
                      const basePrice = basePkg?.basePrice || 0
                      const finalPrice = basePrice + modifier
                      const marginINR = finalPrice - cost
                      return (
                        <div className="flex items-center justify-between p-3 bg-[#FAF9F5] border border-stone-200/80 rounded-xl">
                          <span className="text-xs text-stone-600 font-semibold">
                            Retail Price: <strong className="text-stone-900 font-bold mr-3">₹{finalPrice.toLocaleString('en-IN')}</strong>
                            Margin: <span className="text-amber-700 font-bold">₹{marginINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          </span>
                          <span className="text-xs text-stone-400 font-medium">Batch Departure Allotment</span>
                        </div>
                      )
                    })()}

                    <div>
                      <label htmlFor="form-notes" className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                        Notes / Flight Instructions
                      </label>
                      <textarea
                        id="form-notes"
                        rows="3"
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        placeholder="e.g. Flight tickets included, local transfers covered, sightseeing details..."
                        className="w-full bg-stone-50 border border-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-lg p-3 text-sm text-stone-855 outline-none resize-y transition-all"
                      />
                    </div>
                  </div>
                )}

                {/* TAB 2: INCLUSIONS & ITINERARY */}
                {formTab === 'itinerary' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="form-inclusions" className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                          Batch Inclusions (comma-separated)
                        </label>
                        <input
                          id="form-inclusions"
                          type="text"
                          value={form.inclusions}
                          onChange={(e) => setForm({ ...form, inclusions: e.target.value })}
                          placeholder="e.g. Flight tickets, Hotel stay, Tour Manager"
                          className="w-full bg-stone-50 border border-stone-300 focus:border-amber-500 rounded-lg p-3 text-sm text-stone-855 outline-none"
                        />
                      </div>
                      <div>
                        <label htmlFor="form-exclusions" className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                          Batch Exclusions (comma-separated)
                        </label>
                        <input
                          id="form-exclusions"
                          type="text"
                          value={form.exclusions}
                          onChange={(e) => setForm({ ...form, exclusions: e.target.value })}
                          placeholder="e.g. Personal expenses, Visa fees, Travel Insurance"
                          className="w-full bg-stone-50 border border-stone-300 focus:border-amber-500 rounded-lg p-3 text-sm text-stone-855 outline-none"
                        />
                      </div>
                    </div>

                    {/* Day Builder Card */}
                    <div className="bg-[#FAF9F5] border border-amber-200/70 rounded-xl p-4.5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                          {editingItineraryDayIdx !== null ? `Edit Day ${itineraryDayNum}` : 'Add New Departure Day'}
                        </h4>
                        <div className="flex items-center gap-2">
                          {(() => {
                            const basePkg = packages.find(p => p.id === form.packageId)
                            if (basePkg?.itinerary && basePkg.itinerary.length > 0) {
                              return (
                                <button
                                  type="button"
                                  onClick={() => setForm(prev => ({ ...prev, itinerary: [...basePkg.itinerary] }))}
                                  className="text-[11px] text-amber-700 hover:text-amber-800 font-bold underline cursor-pointer"
                                  title="Copy all days from the selected base package"
                                >
                                  Reset to Base Package Itinerary
                                </button>
                              )
                            }
                            return null
                          })()}
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
                            placeholder="e.g. Arrival & Evening Dhow Cruise Dinner"
                            className="w-full bg-white border border-stone-300 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Activities & Sightseeing (Markdown Supported)</label>
                        <textarea
                          rows="3"
                          value={itineraryDayDesc}
                          onChange={(e) => setItineraryDayDesc(e.target.value)}
                          placeholder="Describe daily activities, flight timings, bus transfers, guided tours..."
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
                        <span className="text-[11px] text-stone-400">Click edit to customize specific departure dates</span>
                      </div>

                      {(!form.itinerary || form.itinerary.length === 0) ? (
                        <div className="text-center py-10 bg-stone-50 border border-dashed border-stone-200 rounded-xl">
                          <p className="text-xs text-stone-400 font-medium">No days scheduled for this group departure yet.</p>
                          <p className="text-[11px] text-stone-400 mt-1">Select a base package to import days, or use the builder above.</p>
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
                        <label htmlFor="form-terms" className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
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
                          id="form-terms"
                          rows="6"
                          value={form.termsAndConditions}
                          onChange={(e) => setForm({ ...form, termsAndConditions: e.target.value })}
                          placeholder="Enter batch terms & conditions in markdown format..."
                          className="w-full bg-stone-50 border border-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-lg p-3 text-sm text-stone-855 outline-none font-mono resize-y transition-all"
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
                    {editing ? 'Save Changes' : 'Create Departure'}
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
          <div className="bg-white border border-stone-200 rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in duration-200 space-y-4">
            <h3 className="text-lg font-bold text-stone-900">Delete Group Departure?</h3>
            <p className="text-sm text-stone-500 leading-relaxed">Are you sure you want to delete group departure <strong className="text-stone-800">{deleteTarget.title}</strong>? This cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="px-5 py-2.5 border border-stone-200 rounded-lg text-sm font-semibold text-stone-600 hover:bg-stone-50 active:scale-95 transition-all cursor-pointer">Cancel</button>
              <button onClick={confirmDelete} className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-bold shadow active:scale-95 transition-all cursor-pointer">Delete</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

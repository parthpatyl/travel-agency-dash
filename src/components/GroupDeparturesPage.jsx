import { useState } from 'react'
import { roleHas } from '../utils/permissions'
import ReadOnlyBanner from './ReadOnlyBanner'

export default function GroupDeparturesPage({ groupDepartures, setGroupDepartures, packages, addNotification, user }) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [filterStatus, setFilterStatus] = useState('All')
  const [deleteTarget, setDeleteTarget] = useState(null)

  const activePackages = (packages || []).filter(p => !p.isBespoke)

  const [form, setForm] = useState({
    packageId: '',
    title: '',
    departureDate: '',
    returnDate: '',
    slotsTotal: 20,
    slotsBooked: 0,
    priceModifier: 0,
    status: 'scheduled',
    notes: ''
  })

  const canWrite = roleHas(user?.role, 'write:packages') || roleHas(user?.role, 'create:packages')

  const openAdd = () => {
    if (!canWrite) {
      if (addNotification) addNotification('You do not have permission to manage group departures', 'error')
      return
    }
    setForm({
      packageId: activePackages[0]?.id || '',
      title: '',
      departureDate: '',
      returnDate: '',
      slotsTotal: 20,
      slotsBooked: 0,
      priceModifier: 0,
      status: 'scheduled',
      notes: ''
    })
    setEditing(null)
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

    setForm({
      packageId: dep.packageId || '',
      title: dep.title || '',
      departureDate: formatDateInput(dep.departureDate),
      returnDate: formatDateInput(dep.returnDate),
      slotsTotal: dep.slots?.total ?? dep.slotsTotal ?? 20,
      slotsBooked: dep.slots?.booked ?? dep.slotsBooked ?? 0,
      priceModifier: dep.priceModifier ?? 0,
      status: dep.status || 'scheduled',
      notes: dep.notes || ''
    })
    setEditing(dep)
    setShowForm(true)
  }

  const handleSave = (e) => {
    e.preventDefault()
    if (!form.packageId) {
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

    const payload = {
      packageId: form.packageId,
      title: form.title.trim(),
      departureDate: form.departureDate,
      returnDate: form.returnDate,
      slots: {
        booked: parseInt(form.slotsBooked) || 0,
        total: parseInt(form.slotsTotal) || 20
      },
      priceModifier: parseFloat(form.priceModifier) || 0,
      status: form.status,
      notes: form.notes
    }

    const pkg = activePackages.find(p => p.id === form.packageId)
    if (pkg) {
      payload.packageName = pkg.name
      payload.packageRegion = pkg.region
      payload.packageDuration = pkg.duration
      payload.packageCardImage = pkg.cardImage
      payload.packageBasePrice = pkg.basePrice
    }

    if (editing) {
      setGroupDepartures(groupDepartures.map(g => g.id === editing.id ? { ...g, ...payload } : g))
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
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    setGroupDepartures(groupDepartures.filter(g => g.id !== deleteTarget.id))
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
    if (filterStatus === 'All') return true
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
      <div className="flex gap-2 border-b border-stone-200 pb-4">
        {['All', 'scheduled', 'confirmed', 'departed', 'cancelled'].map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4.5 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${
              filterStatus === status
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {status === 'All' ? 'All Departures' : status.charAt(0).toUpperCase() + status.slice(1)}
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
      {showForm && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-stone-200 rounded-2xl shadow-xl w-full max-w-2xl p-8 animate-in zoom-in duration-200">
            <div className="flex justify-between items-center pb-5 border-b border-stone-100">
              <h3 className="text-lg font-bold text-stone-900">{editing ? 'Edit Group Departure' : 'Add Group Departure'}</h3>
              <button onClick={() => { setShowForm(false); setEditing(null) }} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 cursor-pointer">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-5 pt-5">
              {!canWrite && <ReadOnlyBanner message="View-only mode — you do not have permission to manage group departures" />}
              <fieldset disabled={!canWrite} className="space-y-5">
                
                <div>
                  <label htmlFor="form-package-id" className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Base Package <span className="text-rose-500" aria-hidden="true">*</span>
                  </label>
                  <select
                    id="form-package-id"
                    value={form.packageId}
                    onChange={(e) => setForm({ ...form, packageId: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-lg p-3 text-sm text-stone-850 outline-none transition-all"
                    required
                  >
                    <option value="">— Select Base Package —</option>
                    {activePackages.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.duration})</option>
                    ))}
                  </select>
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

                <div className="grid grid-cols-2 gap-5">
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

                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="form-slots-total" className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                      Total Slots <span className="text-rose-500" aria-hidden="true">*</span>
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

                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="form-price-modifier" className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                      Price Modifier (₹)
                    </label>
                    <input
                      id="form-price-modifier"
                      type="number"
                      value={form.priceModifier}
                      onChange={(e) => setForm({ ...form, priceModifier: e.target.value })}
                      placeholder="e.g. +5000 or -2000"
                      className="w-full bg-stone-50 border border-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-lg p-3 text-sm text-stone-855 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label htmlFor="form-status" className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                      Status
                    </label>
                    <select
                      id="form-status"
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                      className="w-full bg-stone-50 border border-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-lg p-3 text-sm text-stone-855 outline-none cursor-pointer transition-all"
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="departed">Departed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="form-notes" className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Notes / Instructions
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

              </fieldset>
              <div className="pt-5 border-t border-stone-100 flex justify-end gap-3">
                <button type="button" onClick={() => { setShowForm(false); setEditing(null) }} className="px-5 py-2.5 border border-stone-200 rounded-lg text-sm font-semibold text-stone-600 hover:bg-stone-50 active:scale-95 transition-all cursor-pointer">Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-bold shadow active:scale-95 transition-all cursor-pointer">{editing ? 'Save Changes' : 'Create Departure'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-stone-200 rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in duration-200 space-y-4">
            <h3 className="text-lg font-bold text-stone-900">Delete Group Departure?</h3>
            <p className="text-sm text-stone-500 leading-relaxed">Are you sure you want to delete group departure <strong className="text-stone-800">{deleteTarget.title}</strong>? This cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="px-5 py-2.5 border border-stone-200 rounded-lg text-sm font-semibold text-stone-600 hover:bg-stone-50 active:scale-95 transition-all cursor-pointer">Cancel</button>
              <button onClick={confirmDelete} className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-bold shadow active:scale-95 transition-all cursor-pointer">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

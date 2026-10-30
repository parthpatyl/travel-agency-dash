import { useState, useEffect, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'
import { validateEmail, validatePhone, validateName } from '../utils/validation'

const STATUS_ORDER = ['logged', 'reviewing', 'proposing', 'finalized', 'converted']

const STATUS_OPTIONS = ['logged', 'reviewing', 'proposing', 'finalized', 'converted']

const STATUS_LABELS = {
  logged: 'Logged',
  reviewing: 'Reviewing',
  proposing: 'Proposing',
  finalized: 'Finalized',
  converted: 'Converted to Booking',
}

const STATUS_COLORS = {
  logged: 'bg-blue-50 text-blue-700 border-blue-200',
  reviewing: 'bg-amber-50 text-amber-700 border-amber-200',
  proposing: 'bg-purple-50 text-purple-700 border-purple-200',
  finalized: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  converted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

export default function EnquiriesPage({ API_URL, authHeaders, addNotification, onSelectEnquiry, clients = [], setClients }) {
  const [enquiries, setEnquiries] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'active' | 'converted'
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  // Modal states for Create Enquiry
  const [showAddForm, setShowAddForm] = useState(false)
  const [clientMode, setClientMode] = useState('existing') // 'existing' | 'new'
  const [selectedClient, setSelectedClient] = useState('')
  const [newClientName, setNewClientName] = useState('')
  const [newClientEmail, setNewClientEmail] = useState('')
  const [newClientPhone, setNewClientPhone] = useState('')
  const [newClientLocation, setNewClientLocation] = useState('')

  const [destination, setDestination] = useState('')
  const [travelDate, setTravelDate] = useState('')
  const [guests, setGuests] = useState('2')
  const [accommodations, setAccommodations] = useState('5-Star Luxury')
  const [notes, setNotes] = useState('')
  const [leadSource, setLeadSource] = useState('Instagram')
  const [referralName, setReferralName] = useState('')

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showAddForm) {
        setShowAddForm(false)
        setLeadSource('Instagram')
        setReferralName('')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showAddForm])

  const authHeadersRef = useRef(authHeaders)
  const addNotificationRef = useRef(addNotification)
  useEffect(() => {
    authHeadersRef.current = authHeaders
    addNotificationRef.current = addNotification
  }, [authHeaders, addNotification])

  const fetchEnquiries = useCallback(async (isSilent = false) => {
    if (!isSilent) {
      setLoading(true)
    }
    try {
      const headers = authHeadersRef.current ? authHeadersRef.current() : {}
      const res = await fetch(`${API_URL}/api/enquiries`, { headers })
      const json = await res.json()
      if (res.ok) {
        setEnquiries(json.data || [])
      } else {
        if (!isSilent && addNotificationRef.current) addNotificationRef.current(json.message || 'Failed to load enquiries', 'error')
      }
    } catch (fetchErr) {
      console.error('Error loading enquiries:', fetchErr)
      if (!isSilent && addNotificationRef.current) addNotificationRef.current('Network error loading enquiries', 'error')
    } finally {
      if (!isSilent) {
        setLoading(false)
      }
    }
  }, [API_URL])

  useEffect(() => {
    fetchEnquiries(false)
  }, [fetchEnquiries])

  const updateStatus = async (id, newStatus) => {
    setUpdatingId(id)
    try {
      const res = await fetch(`${API_URL}/api/enquiries/${id}/status`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ status: newStatus }),
      })
      const json = await res.json()
      if (res.ok) {
        setEnquiries((prev) =>
          prev.map((e) => (e.id === id ? { ...e, status: newStatus } : e))
        )
        if (addNotification) addNotification(`Enquiry ${id} → ${STATUS_LABELS[newStatus]}`, 'success')
      } else {
        if (addNotification) addNotification(json.message || 'Failed to update status', 'error')
      }
    } catch { /* swallow — notification already shown if addNotification exists */
      if (addNotification) addNotification('Network error updating status', 'error')
    } finally {
      setUpdatingId(null)
    }
  }

  const convertToBooking = async (id) => {
    setUpdatingId(id)
    try {
      const res = await fetch(`${API_URL}/api/enquiries/${id}/convert-to-booking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
      })
      const json = await res.json()
      if (res.ok) {
        setEnquiries((prev) =>
          prev.map((e) => (e.id === id ? { ...e, status: 'converted' } : e))
        )
        if (addNotification) addNotification(`Enquiry ${id} pushed to Bookings as Booking #${json.booking?.id || ''}!`, 'success')
      } else {
        if (addNotification) addNotification(json.message || 'Failed to convert enquiry to booking', 'error')
      }
    } catch {
      if (addNotification) addNotification('Network error converting enquiry to booking', 'error')
    } finally {
      setUpdatingId(null)
    }
  }

  const nextStatus = (current) => {
    const idx = STATUS_ORDER.indexOf(current)
    if (idx < STATUS_ORDER.length - 1) return STATUS_ORDER[idx + 1]
    return null
  }

  const prevStatus = (current) => {
    const idx = STATUS_ORDER.indexOf(current)
    if (idx > 0) return STATUS_ORDER[idx - 1]
    return null
  }

  const handleCreateEnquiry = async (e) => {
    e.preventDefault()
    let clientName
    let clientEmail
    let clientPhone

    if (clientMode === 'existing') {
      const c = clients.find(cl => cl.name === selectedClient)
      if (!c) {
        if (addNotification) addNotification('Please select a client', 'warning')
        return
      }
      clientName = c.name
      clientEmail = c.email
      clientPhone = c.phone || '+1 555-0100'
    } else {
      const nameCheck = validateName(newClientName)
      if (!nameCheck.isValid) {
        if (addNotification) addNotification(nameCheck.error, 'warning')
        return
      }
      const emailCheck = validateEmail(newClientEmail)
      if (!emailCheck.isValid) {
        if (addNotification) addNotification(emailCheck.error, 'warning')
        return
      }
      if (newClientPhone.trim()) {
        const phoneCheck = validatePhone(newClientPhone)
        if (!phoneCheck.isValid) {
          if (addNotification) addNotification(phoneCheck.error, 'warning')
          return
        }
      }
      clientName = nameCheck.normalized
      clientEmail = emailCheck.normalized
      clientPhone = newClientPhone.trim() || '+91 9876543210'

      // Create new client profile
      const newClientId = `CLI-${crypto.randomUUID()}`
      const newClientObj = {
        id: newClientId,
        name: clientName,
        email: clientEmail,
        phone: clientPhone,
        country: newClientLocation.trim() || 'United States',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
        tier: 'Silver',
        status: 'Inquiry',
        totalSpent: 0,
        tripsCount: 0,
        nextTrip: travelDate || 'Pending',
        lastContact: new Date().toISOString().split('T')[0],
        preferences: { accommodations, dietary: 'None' },
        logs: [
          {
            time: new Date().toISOString().replace('T', ' ').substring(0, 16),
            text: `Logged new Enquiry for ${destination}`
          }
        ]
      }

      if (setClients) setClients([newClientObj, ...clients])
    }

    if (!destination || !travelDate) {
      if (addNotification) addNotification('Please enter Destination and Travel Date', 'warning')
      return
    }

    const payload = {
      name: clientName,
      email: clientEmail,
      phone: clientPhone,
      destination,
      travelDate,
      guests: parseInt(guests) || 1,
      notes,
      preferences: { accommodations },
      leadSource: leadSource || 'Instagram',
      referralName: leadSource === 'Referral' ? referralName.trim() : null
    }

    try {
      const res = await fetch(`${API_URL}/api/enquiries/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const json = await res.json()
      if (res.ok) {
        setEnquiries([json.data, ...enquiries])
        if (addNotification) addNotification(`Created Enquiry #${json.data.id} for ${clientName}`, 'success')
        setShowAddForm(false)
        setSelectedClient('')
        setNewClientName('')
        setNewClientEmail('')
        setNewClientPhone('')
        setNewClientLocation('')
        setDestination('')
        setTravelDate('')
        setGuests('2')
        setAccommodations('5-Star Luxury')
        setNotes('')
        setLeadSource('Instagram')
        setReferralName('')
      } else {
        if (addNotification) addNotification(json.message || 'Failed to create enquiry', 'error')
      }
    } catch (createErr) {
      console.error('Error creating enquiry:', createErr)
      if (addNotification) addNotification('Network error creating enquiry', 'error')
    }
  }

  const filtered = enquiries.filter((e) => {
    if (statusFilter === 'active' && e.status === 'converted') return false
    if (statusFilter === 'converted' && e.status !== 'converted') return false
    if (fromDate) {
      const itemDate = (e.submittedAt || e.travelDate || '').substring(0, 10)
      if (itemDate && itemDate < fromDate) return false
    }
    if (toDate) {
      const itemDate = (e.submittedAt || e.travelDate || '').substring(0, 10)
      if (itemDate && itemDate > toDate) return false
    }
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (e.id || '').toLowerCase().includes(q) ||
      (e.name || '').toLowerCase().includes(q) ||
      (e.destination || '').toLowerCase().includes(q) ||
      (e.email || '').toLowerCase().includes(q) ||
      (e.leadSource || '').toLowerCase().includes(q) ||
      (e.referralName || '').toLowerCase().includes(q)
    )
  })

  const handleExportExcel = () => {
    const exportData = filtered.map(e => ({
      'Enquiry ID': e.id,
      'Customer Name': e.name,
      'Email': e.email,
      'Phone': e.phone || '—',
      'Destination': e.destination,
      'Travel Date': e.travelDate,
      'Guests': e.guests,
      'Status': STATUS_LABELS[e.status] || e.status,
      'Lead Source': e.leadSource || (e.isItineraryDownload ? 'Itinerary Download' : 'Direct/Other'),
      'Referral Name': e.referralName || '—',
      'Notes': e.notes || '',
      'Submitted At': e.submittedAt || ''
    }))
    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Enquiries')
    XLSX.writeFile(workbook, 'kraft_enquiries_report.xlsx')
    if (addNotification) {
      addNotification(`Exported ${exportData.length} enquiries to Excel`, 'success')
    }
  }

  const formatDate = (d) => {
    if (!d) return '—'
    try {
      return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    } catch {
      return d
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
        <span className="ml-3 text-sm text-stone-500 font-light">Loading enquiries...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Create Enquiry Overlay Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-3 sm:p-6 pt-20 sm:pt-24 pb-8 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="enquiry-modal-title">
          <div className="bg-white border border-stone-200/90 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col my-auto overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header (Fixed / Sticky) */}
            <div className="px-6 py-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/50 shrink-0">
              <div>
                <h3 id="enquiry-modal-title" className="text-base sm:text-lg font-bold text-stone-900">Log New Custom Enquiry</h3>
                <p className="text-xs text-stone-500 font-light mt-0.5">Capture incoming travel leads and preferences</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false)
                  setLeadSource('Instagram')
                  setReferralName('')
                }}
                className="p-1.5 rounded-lg hover:bg-stone-200/70 text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
                title="Close (Esc)"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateEnquiry} className="flex flex-col min-h-0 flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">Client Profile</label>
                    <div className="flex gap-1 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setClientMode('existing')}
                        className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${clientMode === 'existing' ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                      >
                        Existing
                      </button>
                      <button
                        type="button"
                        onClick={() => setClientMode('new')}
                        className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${clientMode === 'new' ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                      >
                        + New Client
                      </button>
                    </div>
                  </div>

                  {clientMode === 'existing' ? (
                    <select
                      required={clientMode === 'existing'}
                      value={selectedClient}
                      onChange={(e) => setSelectedClient(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-lg p-3 text-sm text-stone-855 outline-none transition-all"
                    >
                      <option value="">Select a client...</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.name}>{c.name} ({c.email})</option>
                      ))}
                    </select>
                  ) : (
                    <div className="space-y-3 bg-amber-50/40 p-3.5 rounded-xl border border-amber-200/60">
                      <input
                        type="text"
                        required={clientMode === 'new'}
                        placeholder="Client Full Name *"
                        value={newClientName}
                        onChange={(e) => setNewClientName(e.target.value)}
                        className="w-full bg-white border border-stone-300 focus:border-amber-500 rounded-lg p-2.5 text-xs sm:text-sm text-stone-800 outline-none"
                      />
                      <input
                        type="email"
                        required={clientMode === 'new'}
                        placeholder="Email Address *"
                        value={newClientEmail}
                        onChange={(e) => setNewClientEmail(e.target.value)}
                        className="w-full bg-white border border-stone-300 focus:border-amber-500 rounded-lg p-2.5 text-xs sm:text-sm text-stone-800 outline-none"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <input
                          type="text"
                          placeholder="Phone (e.g. +1 555-0199)"
                          value={newClientPhone}
                          onChange={(e) => setNewClientPhone(e.target.value)}
                          className="w-full bg-white border border-stone-300 focus:border-amber-500 rounded-lg p-2.5 text-xs sm:text-sm text-stone-800 outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Country / Location"
                          value={newClientLocation}
                          onChange={(e) => setNewClientLocation(e.target.value)}
                          className="w-full bg-white border border-stone-300 focus:border-amber-500 rounded-lg p-2.5 text-xs sm:text-sm text-stone-800 outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">Destination / Package</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bali, Indonesia or Package Name"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-lg p-3 text-sm text-stone-855 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">Travel Date</label>
                    <input
                      type="date"
                      required
                      value={travelDate}
                      onChange={(e) => setTravelDate(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-lg p-3 text-sm text-stone-855 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">Guests</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={guests}
                      onChange={(e) => setGuests(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-lg p-3 text-sm text-stone-855 outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">Accommodation Class</label>
                  <select
                    value={accommodations}
                    onChange={(e) => setAccommodations(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-lg p-3 text-sm text-stone-855 outline-none transition-all"
                  >
                    <option value="5-Star Luxury">5-Star Luxury Resort</option>
                    <option value="4-Star Boutique">4-Star Boutique Hotel</option>
                    <option value="Private Villa">Private Villa / Estate</option>
                    <option value="Standard">Standard Comfort</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="lead-source-select" className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">Lead Acquisition Source *</label>
                  <select
                    id="lead-source-select"
                    value={leadSource}
                    onChange={(e) => setLeadSource(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-lg p-3 text-sm text-stone-855 outline-none transition-all"
                  >
                    {['Instagram', 'Facebook', 'LinkedIn', 'Google/Search', 'Referral', 'Walk-in', 'Direct/Other'].map(src => (
                      <option key={src} value={src}>{src}</option>
                    ))}
                  </select>
                </div>

                {leadSource === 'Referral' && (
                  <div className="animate-in fade-in duration-150">
                    <label className="block text-xs font-bold text-amber-800 uppercase tracking-wider mb-1.5">Referral Name *</label>
                    <input
                      type="text"
                      required={leadSource === 'Referral'}
                      placeholder="Name of referrer (client, partner, or agent)"
                      value={referralName}
                      onChange={(e) => setReferralName(e.target.value)}
                      className="w-full bg-amber-50/50 border border-amber-300 focus:border-amber-500 rounded-lg p-3 text-sm text-stone-855 outline-none transition-all"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">Special Directives / Notes</label>
                  <textarea
                    rows="3"
                    placeholder="Specific preferences, dietary needs, honeymoon request..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-lg p-3 text-sm text-stone-855 outline-none resize-none transition-all"
                  ></textarea>
                </div>
              </div>

              {/* Fixed / Sticky Action Footer */}
              <div className="px-6 py-4 border-t border-stone-100 flex justify-end gap-3 shrink-0 bg-stone-50/60 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false)
                    setLeadSource('Instagram')
                    setReferralName('')
                  }}
                  className="px-5 py-2.5 border border-stone-200 rounded-xl text-xs sm:text-sm font-semibold text-stone-600 hover:bg-stone-100 active:scale-95 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow active:scale-95 transition-all cursor-pointer"
                >
                  Submit Enquiry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-stone-900 tracking-tight">Enquiries</h2>
          <p className="text-xs text-stone-500 font-light mt-0.5">
            {filtered.length} {filtered.length === 1 ? 'enquiry' : 'enquiries'}
            {search ? ' matched' : ' total'}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          {/* Status Filter Tabs */}
          <div className="inline-flex rounded-xl bg-stone-100 p-1 border border-stone-200 text-xs font-semibold">
            {[
              { id: 'all', label: `All (${enquiries.length})` },
              { id: 'active', label: `Active (${enquiries.filter(e => e.status !== 'converted').length})` },
              { id: 'converted', label: `Converted (${enquiries.filter(e => e.status === 'converted').length})` }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Search enquiries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48 pl-9 pr-3 py-2 border border-stone-200 rounded-xl text-xs font-medium placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 bg-white"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Customizable Date Range Filtering */}
          <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1 text-xs">
            <span className="text-[10px] font-bold text-stone-400 uppercase">From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-transparent text-stone-700 outline-none text-xs cursor-pointer"
              title="Filter from date"
              aria-label="Filter from date"
            />
            <span className="text-[10px] font-bold text-stone-400 uppercase ml-1">To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-transparent text-stone-700 outline-none text-xs cursor-pointer"
              title="Filter to date"
              aria-label="Filter to date"
            />
            {(fromDate || toDate) && (
              <button
                type="button"
                onClick={() => { setFromDate(''); setToDate(''); }}
                className="text-stone-400 hover:text-stone-600 text-xs px-1 cursor-pointer font-bold"
                title="Clear date range"
              >
                ✕
              </button>
            )}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchEnquiries(false)}
            disabled={loading}
            className="p-2 border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 rounded-xl text-xs font-semibold shadow-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Refresh enquiries"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-600' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          {/* Export to Excel Button */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="py-2 px-3 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            title="Export filtered enquiries to Excel (.xlsx)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export to Excel
          </button>

          <button
            onClick={() => setShowAddForm(true)}
            className="py-2 px-3.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-sm active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create Enquiry
          </button>
          <button
            onClick={fetchEnquiries}
            className="p-2 border border-stone-200 rounded-xl hover:bg-stone-50 text-stone-500 transition-colors"
            title="Refresh"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 0021.21 7.89M21 3v5h-5.182" />
            </svg>
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center">
          <p className="text-sm text-stone-500 font-light">
            {search ? 'No enquiries match your search.' : 'No enquiries yet.'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200">
                  <th className="text-left px-4 py-3 font-bold text-stone-500 uppercase tracking-wider">ID</th>
                  <th className="text-left px-4 py-3 font-bold text-stone-500 uppercase tracking-wider">Customer</th>
                  <th className="text-left px-4 py-3 font-bold text-stone-500 uppercase tracking-wider">Lead Source</th>
                  <th className="text-left px-4 py-3 font-bold text-stone-500 uppercase tracking-wider">Destination</th>
                  <th className="text-left px-4 py-3 font-bold text-stone-500 uppercase tracking-wider">Travel Date</th>
                  <th className="text-center px-4 py-3 font-bold text-stone-500 uppercase tracking-wider">Guests</th>
                  <th className="text-center px-4 py-3 font-bold text-stone-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-4 py-3 font-bold text-stone-500 uppercase tracking-wider">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.map((enq) => {
                  const isUpdating = updatingId === enq.id

                  return (
                    <tr
                      key={enq.id}
                      className="hover:bg-stone-50/80 transition-colors cursor-pointer"
                      onClick={() => onSelectEnquiry && onSelectEnquiry(enq.id)}
                    >
                      <td className="px-4 py-3 font-mono text-[11px] text-stone-500 font-semibold">
                        {enq.id}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-stone-800">{enq.name}</span>
                            {(enq.leadSource === 'Itinerary Download' || enq.isItineraryDownload || enq.source === 'itinerary_download') && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700 border border-purple-200">
                                Itinerary Download
                              </span>
                            )}
                          </div>
                          <span className="block text-[10px] text-stone-400 mt-0.5">{enq.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-stone-700">
                        <div className="flex flex-col">
                          <span className="font-semibold text-xs text-stone-800">
                            {enq.leadSource || (enq.isItineraryDownload ? 'Itinerary Download' : 'Direct/Other')}
                          </span>
                          {enq.leadSource === 'Referral' && enq.referralName && (
                            <span className="text-[10px] text-amber-700 font-medium">
                              via {enq.referralName}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-stone-700 font-medium">{enq.destination}</td>
                      <td className="px-4 py-3 text-stone-600">{formatDate(enq.travelDate)}</td>
                      <td className="px-4 py-3 text-center text-stone-600">{enq.guests}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={enq.status || 'logged'}
                            disabled={isUpdating}
                            onChange={(e) => updateStatus(enq.id, e.target.value)}
                            className={`text-[11px] font-bold px-2 py-1 rounded-lg border cursor-pointer outline-none transition-all ${STATUS_COLORS[enq.status] || STATUS_COLORS.logged}`}
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>
                            ))}
                          </select>

                          {enq.status !== 'converted' ? (
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => convertToBooking(enq.id)}
                              title="Push to Booking section"
                              className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[10px] font-bold shadow-xs active:scale-95 transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap"
                            >
                              {isUpdating ? (
                                <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <>
                                  <span>Push to Booking</span>
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                  </svg>
                                </>
                              )}
                            </button>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/90 border border-emerald-200 px-2 py-0.5 rounded-md whitespace-nowrap">
                              ✓ In Bookings
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-stone-400 text-[11px]">
                        {formatDate(enq.submittedAt)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

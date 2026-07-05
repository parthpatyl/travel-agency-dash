import { useState, useEffect } from 'react'

const STATUS_ORDER = ['logged', 'reviewing', 'proposing', 'finalized']

const STATUS_LABELS = {
  logged: 'Logged',
  reviewing: 'Reviewing',
  proposing: 'Proposing',
  finalized: 'Finalized',
}

const STATUS_COLORS = {
  logged: 'bg-blue-100 text-blue-700 border-blue-200',
  reviewing: 'bg-amber-100 text-amber-700 border-amber-200',
  proposing: 'bg-purple-100 text-purple-700 border-purple-200',
  finalized: 'bg-emerald-100 text-emerald-700 border-emerald-200',
}

export default function EnquiriesPage({ token, API_URL, authHeaders, addNotification, onSelectEnquiry }) {
  const [enquiries, setEnquiries] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [updatingId, setUpdatingId] = useState(null)

  useEffect(() => {
    fetchEnquiries()
  }, [])

  const fetchEnquiries = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/enquiries`, { headers: authHeaders() })
      const json = await res.json()
      if (res.ok) {
        setEnquiries(json.data || [])
      } else {
        if (addNotification) addNotification(json.message || 'Failed to load enquiries', 'error')
      }
    } catch (err) {
      console.error('Error loading enquiries:', err)
      if (addNotification) addNotification('Network error loading enquiries', 'error')
    } finally {
      setLoading(false)
    }
  }

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
    } catch (err) {
      if (addNotification) addNotification('Network error updating status', 'error')
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

  const filtered = enquiries.filter((e) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      e.id.toLowerCase().includes(q) ||
      e.name.toLowerCase().includes(q) ||
      e.destination.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q)
    )
  })

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-stone-900 tracking-tight">Enquiries</h2>
          <p className="text-xs text-stone-500 font-light mt-0.5">
            {filtered.length} {filtered.length === 1 ? 'enquiry' : 'enquiries'}
            {search ? ' matched' : ' total'}
          </p>
        </div>
        <div className="flex gap-3 items-center">
          <div className="relative">
            <input
              type="text"
              placeholder="Search enquiries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56 pl-9 pr-3 py-2 border border-stone-200 rounded-xl text-xs font-medium placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 bg-white"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
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
                  <th className="text-left px-4 py-3 font-bold text-stone-500 uppercase tracking-wider">Destination</th>
                  <th className="text-left px-4 py-3 font-bold text-stone-500 uppercase tracking-wider">Travel Date</th>
                  <th className="text-center px-4 py-3 font-bold text-stone-500 uppercase tracking-wider">Guests</th>
                  <th className="text-center px-4 py-3 font-bold text-stone-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-4 py-3 font-bold text-stone-500 uppercase tracking-wider">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.map((enq) => {
                  const next = nextStatus(enq.status)
                  const prev = prevStatus(enq.status)
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
                          <span className="font-semibold text-stone-800">{enq.name}</span>
                          <span className="block text-[10px] text-stone-400 mt-0.5">{enq.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-stone-700 font-medium">{enq.destination}</td>
                      <td className="px-4 py-3 text-stone-600">{formatDate(enq.travelDate)}</td>
                      <td className="px-4 py-3 text-center text-stone-600">{enq.guests}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {prev && (
                            <button
                              disabled={isUpdating}
                              onClick={() => updateStatus(enq.id, prev)}
                              className="p-1 rounded hover:bg-stone-100 text-stone-400 disabled:opacity-30 transition-colors"
                              title={`Move to ${STATUS_LABELS[prev]}`}
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                              </svg>
                            </button>
                          )}
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${STATUS_COLORS[enq.status] || 'bg-stone-100 text-stone-600 border-stone-200'} min-w-[72px] justify-center`}>
                            {isUpdating ? (
                              <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                              STATUS_LABELS[enq.status] || enq.status
                            )}
                          </span>
                          {next && (
                            <button
                              disabled={isUpdating}
                              onClick={() => updateStatus(enq.id, next)}
                              className="p-1 rounded hover:bg-stone-100 text-stone-400 disabled:opacity-30 transition-colors"
                              title={`Move to ${STATUS_LABELS[next]}`}
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
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

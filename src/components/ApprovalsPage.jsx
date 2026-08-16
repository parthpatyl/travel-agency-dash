import { useState, useEffect, useCallback } from 'react'
import { roleHas } from '../utils/permissions'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  approved: 'bg-blue-100 text-blue-700 border-blue-200',
  executed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-100 text-rose-700 border-rose-200',
  cancelled: 'bg-stone-100 text-stone-500 border-stone-200',
  expired: 'bg-gray-100 text-gray-500 border-gray-200'
}

export default function ApprovalsPage({ user, addNotification, token, initialApprovalId, initialFilter = 'pending' }) {
  const [approvals, setApprovals] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState(initialFilter)
  const [reviewNote, setReviewNote] = useState('')
  const [expiryDays, setExpiryDays] = useState('')
  const [actionLoading, setActionLoading] = useState(null)
  const isAdmin = roleHas(user?.role, 'review:approvals')

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  }

  const fetchApprovals = useCallback(async () => {
    try {
      const status = isAdmin ? filter : 'mine'
      const res = await fetch(`${API_URL}/api/approvals?status=${status}`, { headers })
      if (res.ok) {
        setApprovals(await res.json())
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filter, isAdmin])

  useEffect(() => { fetchApprovals() }, [fetchApprovals])

  useEffect(() => {
    if (!initialApprovalId || approvals.length === 0) return
    const el = document.querySelector(`[data-approval-id="${initialApprovalId}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('ring-2', 'ring-amber-400', 'bg-amber-50')
      setTimeout(() => el.classList.remove('ring-2', 'ring-amber-400', 'bg-amber-50'), 3000)
    }
  }, [approvals, initialApprovalId])

  const handleApprove = async (id) => {
    setActionLoading(id)
    try {
      const body = {}
      if (reviewNote.trim()) body.note = reviewNote.trim()
      if (expiryDays) body.expires_in_days = parseInt(expiryDays)
      const res = await fetch(`${API_URL}/api/approvals/${id}/approve`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      })
      if (res.ok) {
        addNotification?.('Approval approved and executed', 'success')
        setReviewNote('')
        setExpiryDays('')
        fetchApprovals()
      } else {
        const err = await res.json()
        addNotification?.(err.error || 'Failed to approve', 'error')
        fetchApprovals()
      }
    } catch {
      addNotification?.('Failed to approve', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (id) => {
    setActionLoading(id)
    try {
      const res = await fetch(`${API_URL}/api/approvals/${id}/reject`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ note: reviewNote.trim() || undefined })
      })
      if (res.ok) {
        addNotification?.('Approval rejected', 'info')
        setReviewNote('')
        fetchApprovals()
      } else {
        const err = await res.json()
        addNotification?.(err.error || 'Failed to reject', 'error')
      }
    } catch {
      addNotification?.('Failed to reject', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancel = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/approvals/${id}/cancel`, {
        method: 'POST',
        headers
      })
      if (res.ok) {
        addNotification?.('Request cancelled', 'info')
        fetchApprovals()
      }
    } catch {
      addNotification?.('Failed to cancel', 'error')
    }
  }

  if (loading) return <div className="text-stone-400 text-sm p-8">Loading approvals...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">
            {isAdmin ? 'Approvals Inbox' : 'My Approval Requests'}
          </h2>
          <p className="text-xs text-stone-400">
            {isAdmin
              ? 'Review and approve/reject pending requests from operations.'
              : 'Track your pending and historical approval requests.'}
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-1.5">
            {['pending', 'approved', 'rejected', 'executed', 'cancelled', 'expired'].map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-colors capitalize ${filter === s
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'
                  }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {approvals.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center">
          <p className="text-stone-400 text-xs">No {isAdmin ? filter : ''} approval requests.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {approvals.map(approval => (
            <div key={approval.id} data-approval-id={approval.id} className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3 transition-all duration-300">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${STATUS_COLORS[approval.status] || 'bg-stone-100 text-stone-600'}`}>
                      {approval.status}
                    </span>
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">{approval.action}</span>
                    <span className="text-[10px] text-stone-400">#{approval.entity_id}</span>
                    <span className="text-[10px] text-stone-400">
                      {new Date(approval.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-stone-600">
                    <span className="font-semibold">{approval.requester_name || `User #${approval.requested_by}`}</span>
                    {approval.reason && <span className="text-stone-400"> — {approval.reason}</span>}
                  </p>

                  {approval.action === 'delete:booking' && approval.payload?.snapshot && (
                    <div className="mt-2 bg-stone-50 rounded-xl p-3 text-[11px] text-stone-600 space-y-1">
                      <p><span className="font-semibold text-stone-700">Booking:</span> {approval.payload.snapshot.package_name || approval.payload.snapshot.id}</p>
                      <p><span className="font-semibold text-stone-700">Client:</span> {approval.payload.snapshot.client_name || approval.payload.snapshot.client_id}</p>
                      <p><span className="font-semibold text-stone-700">Guests:</span> {approval.payload.snapshot.guests || 'N/A'}</p>
                    </div>
                  )}

                  {approval.action === 'change:booking.pricing' && approval.payload?.before && approval.payload?.after && (
                    <div className="mt-2 bg-stone-50 rounded-xl p-3 text-[11px] text-stone-600">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="font-semibold text-stone-400">Field</div>
                        <div className="font-semibold text-stone-400">Current</div>
                        <div className="font-semibold text-stone-400">Proposed</div>
                        <div className="text-left">Amount</div>
                        <div>₹{approval.payload.before.amount || 0}</div>
                        <div className="font-bold text-amber-700">₹{approval.payload.after.amount || 0}</div>
                        <div className="text-left">Discount</div>
                        <div>{approval.payload.before.discountValue || 0}</div>
                        <div className="font-bold text-amber-700">{approval.payload.after.discountValue || 0}</div>
                        <div className="text-left">Discount Type</div>
                        <div>{approval.payload.before.discountType || '-'}</div>
                        <div className="font-bold text-amber-700">{approval.payload.after.discountType || '-'}</div>
                      </div>
                    </div>
                  )}

                  {approval.action === 'change:package.pricing' && approval.payload?.after && (
                    <div className="mt-2 bg-stone-50 rounded-xl p-3 text-[11px] text-stone-600">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="font-semibold text-stone-400">Field</div>
                        <div className="font-semibold text-stone-400">Current</div>
                        <div className="font-semibold text-stone-400">Proposed</div>
                        {Object.entries({
                          basePrice: { label: 'Base Price', fmt: v => `₹${v}` },
                          costPrice: { label: 'Cost Price', fmt: v => v != null ? `₹${v}` : '-' },
                          taxRate: { label: 'Tax Rate', fmt: v => v != null ? `${v}%` : '-' }
                        }).filter(([key]) => approval.payload.after[key] !== undefined).flatMap(([key, { label, fmt }]) => [
                          <div key={`${key}-l`} className="text-left">{label}</div>,
                          <div key={`${key}-c`}>{approval.payload.before?.[key] != null ? fmt(approval.payload.before[key]) : '-'}</div>,
                          <div key={`${key}-p`} className="font-bold text-amber-700">{fmt(approval.payload.after[key])}</div>
                        ])}
                      </div>
                    </div>
                  )}

                  {approval.expires_at && (
                    <p className="text-[10px] text-stone-400">
                      Expires: {new Date(approval.expires_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {new Date(approval.expires_at) < new Date() && <span className="text-rose-500 ml-1">(expired)</span>}
                    </p>
                  )}
                </div>

                {/* Action buttons for admin on pending */}
                {isAdmin && approval.status === 'pending' && (
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <textarea
                      placeholder="Review note..."
                      value={reviewNote}
                      onChange={e => setReviewNote(e.target.value)}
                      rows={2}
                      className="w-48 px-2.5 py-1.5 border border-stone-200 rounded-xl text-[10px] resize-none focus:ring-2 focus:ring-amber-300 outline-none"
                    />
                    <div className="flex items-center gap-1.5">
                      <select
                        value={expiryDays}
                        onChange={e => setExpiryDays(e.target.value)}
                        className="px-2 py-1 border border-stone-200 rounded-lg text-[10px]"
                      >
                        <option value="">No expiry</option>
                        <option value="1">1 day</option>
                        <option value="7">7 days</option>
                        <option value="30">30 days</option>
                      </select>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleApprove(approval.id)}
                        disabled={actionLoading === approval.id}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-[10px] font-bold rounded-lg transition-colors"
                      >
                        {actionLoading === approval.id ? '...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleReject(approval.id)}
                        disabled={actionLoading === approval.id}
                        className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white text-[10px] font-bold rounded-lg transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Cancel button for ops on their own pending */}
              {!isAdmin && approval.status === 'pending' && (
                <div className="flex justify-end">
                  <button
                    onClick={() => handleCancel(approval.id)}
                    className="text-[10px] font-bold text-rose-500 hover:text-rose-600 underline"
                  >
                    Cancel Request
                  </button>
                </div>
              )}

              {approval.reviewer_note && (
                <div className="text-[10px] text-stone-400 italic bg-stone-50 rounded-lg px-3 py-1.5">
                  Reviewer note: {approval.reviewer_note}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

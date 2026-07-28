import { useState, useEffect, useMemo, useRef } from 'react'
import { roleHas } from '../utils/permissions'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const STATUS_OPTIONS = ['new', 'contacted', 'qualified', 'converted', 'closed']

const STATUS_COLORS = {
  new: 'bg-blue-50 text-blue-700 border-blue-200',
  contacted: 'bg-amber-50 text-amber-700 border-amber-200',
  qualified: 'bg-purple-50 text-purple-700 border-purple-200',
  converted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  closed: 'bg-stone-100 text-stone-500 border-stone-200',
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function parseMessage(msg) {
  if (!msg) return { packageName: null, groupSize: null, startDate: null, endDate: null }
  const pkg = msg.match(/Selected Destination\/Package:\s*(.+)/)?.[1]?.trim() || null
  const size = msg.match(/Estimated Group Size:\s*(\d+)/)?.[1] || null
  const dates = msg.match(/Preferred Dates:\s*(.+?)(?:\n|$)/)?.[1]?.trim() || null
  let start = null, end = null
  if (dates) {
    const parts = dates.split(/\s+to\s+/)
    if (parts[0]) start = parts[0].trim()
    if (parts[1]) end = parts[1].trim()
  }
  return { packageName: pkg, groupSize: size ? parseInt(size) : null, startDate: start, endDate: end }
}

function computeFin(lead) {
  const rate = parseFloat(lead.per_person_rate) || 0
  const pax = parseInt(lead.group_size) || 0
  const subtotal = rate * pax
  const dType = lead.discount_type
  const dVal = parseFloat(lead.discount_value) || 0
  const discountAmt = dType === 'percentage' ? subtotal * dVal / 100 : dVal
  const taxable = Math.max(0, subtotal - discountAmt)
  const tRate = parseFloat(lead.tax_rate) ?? 5
  const taxInc = lead.tax_inclusive !== false
  const gst = taxInc ? 0 : Math.round(taxable * tRate / 100)
  const net = Math.round(taxable + gst)
  return { rate, pax, subtotal, discountAmt, taxable, tRate, taxInc, gst, net }
}

function getDisplayFin(lead, corpPkgs) {
  const parsed = parseMessage(lead.message)
  const groupSize = lead.group_size ?? parsed.groupSize ?? 0
  let perPersonRate = lead.per_person_rate
  if (perPersonRate == null && parsed.packageName) {
    const matched = corpPkgs.find(p =>
      parsed.packageName === p.destination ||
      parsed.packageName.includes(p.destination) ||
      p.destination.includes(parsed.packageName)
    )
    perPersonRate = matched ? matched.starting_price : 0
  }
  return computeFin({ ...lead, group_size: groupSize, per_person_rate: perPersonRate })
}

function fmt(n) {
  if (n == null || isNaN(n)) return '—'
  return '₹' + Math.round(n).toLocaleString('en-IN')
}

export default function CorporateLeadsPage({ addNotification, token, user, onConvertToBooking, setActiveTab }) {
  const [leads, setLeads] = useState([])
  const [corpPkgs, setCorpPkgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [selectedLead, setSelectedLead] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [editDraft, setEditDraft] = useState(null)
  const [messageOpen, setMessageOpen] = useState(false)

  const deleteRef = useRef(null)

  const canWrite = roleHas(user?.role, 'write:bookings')

  const fetchLeads = async () => {
    try {
      const res = await fetch(`${API_URL}/api/corporate-leads`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      })
      if (res.ok) {
        setLeads(await res.json())
      }
    } catch (err) {
      console.error('Failed to fetch corporate leads:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchCorpPkgs = async () => {
    try {
      const res = await fetch(`${API_URL}/api/corporate-packages`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      })
      if (res.ok) setCorpPkgs(await res.json())
    } catch (_) { console.error('Failed to fetch corporate packages', _) }
  }

  useEffect(() => { fetchLeads(); fetchCorpPkgs() }, [])

  const updateStatus = async (id, status) => {
    try {
      const res = await fetch(`${API_URL}/api/corporate-leads/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
        if (selectedLead?.id === id) setSelectedLead(prev => ({ ...prev, status }))
        if (addNotification) addNotification(`Lead status updated to "${status}"`, 'success')
      } else {
        const err = await res.json()
        if (addNotification) addNotification(err.error || 'Failed to update status', 'error')
      }
    } catch {
      if (addNotification) addNotification('Failed to update status', 'error')
    }
  }

  const deleteLead = async () => {
    const target = deleteRef.current
    if (!target) return
    try {
      const res = await fetch(`${API_URL}/api/corporate-leads/${target.id}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      })
      if (res.ok) {
        setLeads(prev => prev.filter(l => l.id !== target.id))
        if (selectedLead?.id === target.id) setSelectedLead(null)
        if (addNotification) addNotification('Lead deleted', 'success')
      } else {
        const err = await res.json()
        if (addNotification) addNotification(err.error || 'Failed to delete lead', 'error')
      }
    } catch {
      if (addNotification) addNotification('Failed to delete lead', 'error')
    } finally {
      setDeleteTarget(null)
      deleteRef.current = null
    }
  }

  const confirmDelete = (lead) => {
    deleteRef.current = lead
    setDeleteTarget(lead)
  }

  const startEdit = (lead) => {
    const parsed = parseMessage(lead.message)
    const pkgName = parsed.packageName
    const matchedPkg = pkgName ? corpPkgs.find(p => p.destination === pkgName || pkgName.includes(p.destination)) : null
    setEditDraft({
      name: lead.name,
      work_email: lead.work_email,
      mobile: lead.mobile,
      company_name: lead.company_name,
      message: lead.message || '',
      per_person_rate: lead.per_person_rate ?? (matchedPkg ? matchedPkg.starting_price : ''),
      group_size: lead.group_size ?? (parsed.groupSize || ''),
      discount_type: lead.discount_type || '',
      discount_value: lead.discount_value ?? '',
      tax_rate: lead.tax_rate ?? 5,
      tax_inclusive: lead.tax_inclusive !== false,
    })
  }

  const cancelEdit = () => {
    setEditDraft(null)
  }

  const saveEdit = async () => {
    if (!editDraft || !selectedLead) return
    try {
      const res = await fetch(`${API_URL}/api/corporate-leads/${selectedLead.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: editDraft.name,
          mobile: editDraft.mobile,
          workEmail: editDraft.work_email,
          companyName: editDraft.company_name,
          message: editDraft.message,
          perPersonRate: editDraft.per_person_rate === '' ? null : parseFloat(editDraft.per_person_rate),
          groupSize: editDraft.group_size === '' ? null : parseInt(editDraft.group_size),
          discountType: editDraft.discount_type || null,
          discountValue: editDraft.discount_value === '' ? null : parseFloat(editDraft.discount_value),
          taxRate: parseFloat(editDraft.tax_rate) || 5,
          taxInclusive: editDraft.tax_inclusive,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setLeads(prev => prev.map(l => l.id === updated.id ? updated : l))
        setSelectedLead(updated)
        setEditDraft(null)
        if (addNotification) addNotification('Lead updated', 'success')
      } else {
        const err = await res.json()
        if (addNotification) addNotification(err.error || 'Failed to update lead', 'error')
      }
    } catch {
      if (addNotification) addNotification('Failed to update lead', 'error')
    }
  }

  const handleConvert = (lead) => {
    const parsed = parseMessage(lead.message)
    if (onConvertToBooking) {
      onConvertToBooking({
        name: lead.name,
        companyName: lead.company_name,
        workEmail: lead.work_email,
        mobile: lead.mobile,
        packageName: parsed.packageName,
        groupSize: parsed.groupSize,
        message: lead.message,
      })
    }
    if (setActiveTab) setActiveTab('bookings')
  }

  const filtered = filter === 'all' ? leads : leads.filter(l => l.status === filter)

  const pipelineTotal = useMemo(() => {
    return leads.reduce((acc, l) => acc + getDisplayFin(l, corpPkgs).net, 0)
  }, [leads, corpPkgs])

  const activeCounts = useMemo(() => {
    const counts = { new: 0, contacted: 0, qualified: 0, converted: 0, closed: 0 }
    leads.forEach(l => { if (counts[l.status] !== undefined) counts[l.status]++ })
    return counts
  }, [leads])

  const isEditing = editDraft !== null

  const fin = useMemo(() => selectedLead ? computeFin(isEditing ? {
    per_person_rate: editDraft.per_person_rate || 0,
    group_size: editDraft.group_size || 0,
    discount_type: editDraft.discount_type,
    discount_value: editDraft.discount_value,
    tax_rate: editDraft.tax_rate,
    tax_inclusive: editDraft.tax_inclusive,
  } : selectedLead) : null, [selectedLead, editDraft, isEditing])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">Corporate Bookings</h2>
          <p className="text-xs text-stone-400">MICE retreat inquiries and corporate travel leads.</p>
        </div>
      </div>

      {/* Pipeline summary bar */}
      <div className="flex gap-3 overflow-x-auto pb-1 flex-nowrap">
        <div className="bg-white border border-stone-200 rounded-xl px-3 py-2.5 shrink-0">
          <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wide leading-tight">Total</div>
          <div className="text-base font-bold text-stone-900">{leads.length}</div>
        </div>
        {STATUS_OPTIONS.map(s => (
          <div key={s} className="bg-white border border-stone-200 rounded-xl px-3 py-2.5 shrink-0">
            <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wide leading-tight">{s}</div>
            <div className="text-base font-bold text-stone-900">{activeCounts[s]}</div>
          </div>
        ))}
        <div className="bg-white border border-amber-200 rounded-xl px-3 py-2.5 shrink-0">
          <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wide leading-tight">Pipeline</div>
          <div className="text-base font-bold text-amber-700">{fmt(pipelineTotal)}</div>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1.5 border-b border-stone-200 pb-3 overflow-x-auto">
        {['all', ...STATUS_OPTIONS].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filter === s
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            <span className="ml-1.5 opacity-60">{s === 'all' ? leads.length : activeCounts[s]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-stone-400">Loading leads...</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-stone-400">No corporate leads found.</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          {/* Table panel */}
          <div className="xl:col-span-2 overflow-x-auto bg-white border border-stone-200/80 rounded-2xl shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.15em] border-b border-stone-200">
                  <th className="pb-3 pt-3 px-4">Contact</th>
                  <th className="pb-3 pt-3 pr-4">Company</th>
                  <th className="pb-3 pt-3 pr-4">Mobile</th>
                  <th className="pb-3 pt-3 pr-4">Status</th>
                  <th className="pb-3 pt-3 pr-4">Net Amount</th>
                  <th className="pb-3 pt-3 pr-4">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(lead => {
                  const rowFin = getDisplayFin(lead, corpPkgs)
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => { setSelectedLead(lead); setMessageOpen(false); setEditDraft(null) }}
                      className={`border-b border-stone-100 text-sm text-stone-700 transition-colors cursor-pointer ${
                        selectedLead?.id === lead.id ? 'bg-amber-50/50' : 'hover:bg-stone-50/50'
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-stone-900">{lead.name}</div>
                        <a
                          href={`mailto:${lead.work_email}`}
                          onClick={e => e.stopPropagation()}
                          className="text-xs text-amber-600 hover:text-amber-500 hover:underline"
                        >
                          {lead.work_email}
                        </a>
                      </td>
                      <td className="py-3.5 pr-4">
                        <span className="font-medium">{lead.company_name}</span>
                      </td>
                      <td className="py-3.5 pr-4">
                        <a
                          href={`tel:${lead.mobile}`}
                          onClick={e => e.stopPropagation()}
                          className="text-xs text-amber-600 hover:text-amber-500 hover:underline"
                        >
                          {lead.mobile}
                        </a>
                      </td>
                      <td className="py-3.5 pr-4">
                        {canWrite ? (
                          <select
                            value={lead.status || 'new'}
                            onChange={(e) => { e.stopPropagation(); updateStatus(lead.id, e.target.value) }}
                            onClick={e => e.stopPropagation()}
                            className={`text-[11px] font-bold px-2 py-1 rounded-lg border cursor-pointer outline-none transition-all ${STATUS_COLORS[lead.status] || STATUS_COLORS.new}`}
                          >
                            {STATUS_OPTIONS.map(s => (
                              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`text-[11px] font-bold px-2 py-1 rounded-lg border ${STATUS_COLORS[lead.status] || STATUS_COLORS.new}`}>
                            {lead.status ? lead.status.charAt(0).toUpperCase() + lead.status.slice(1) : 'New'}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 pr-4 text-xs font-semibold text-stone-700">{fmt(rowFin.net)}</td>
                      <td className="py-3.5 pr-4 text-xs text-stone-400 whitespace-nowrap">{formatDate(lead.submitted_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Detail side panel */}
          {selectedLead && fin && (
            <div className="xl:sticky xl:top-4 bg-white border border-stone-200/80 rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
                <h3 className="text-sm font-bold text-stone-900">Lead Details</h3>
                <button
                  onClick={() => { setSelectedLead(null); setEditDraft(null); setMessageOpen(false) }}
                  className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="px-4 py-3 space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto">
                {/* Contact & Company */}
                <div>
                  <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wide mb-1.5">Contact</div>
                  {isEditing ? (
                    <div className="space-y-1.5">
                      <input value={editDraft.name} onChange={e => setEditDraft(p => ({ ...p, name: e.target.value }))}
                        className="w-full text-xs bg-stone-50 border border-stone-200 rounded-lg px-2 py-1.5 outline-none focus:border-amber-400" />
                      <input value={editDraft.work_email} onChange={e => setEditDraft(p => ({ ...p, work_email: e.target.value }))}
                        className="w-full text-xs bg-stone-50 border border-stone-200 rounded-lg px-2 py-1.5 outline-none focus:border-amber-400" />
                      <input value={editDraft.mobile} onChange={e => setEditDraft(p => ({ ...p, mobile: e.target.value }))}
                        className="w-full text-xs bg-stone-50 border border-stone-200 rounded-lg px-2 py-1.5 outline-none focus:border-amber-400" />
                    </div>
                  ) : (
                    <>
                      <div className="text-sm font-semibold text-stone-900">{selectedLead.name}</div>
                      <a href={`mailto:${selectedLead.work_email}`} className="text-xs text-amber-600 hover:text-amber-500 hover:underline block mt-0.5">{selectedLead.work_email}</a>
                      <a href={`tel:${selectedLead.mobile}`} className="text-xs text-amber-600 hover:text-amber-500 hover:underline block">{selectedLead.mobile}</a>
                    </>
                  )}
                </div>

                <div>
                  <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wide mb-1.5">Company</div>
                  {isEditing ? (
                    <input value={editDraft.company_name} onChange={e => setEditDraft(p => ({ ...p, company_name: e.target.value }))}
                      className="w-full text-xs bg-stone-50 border border-stone-200 rounded-lg px-2 py-1.5 outline-none focus:border-amber-400" />
                  ) : (
                    <div className="text-sm font-medium text-stone-800">{selectedLead.company_name}</div>
                  )}
                </div>

                {/* Financial breakdown */}
                <div>
                  <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wide mb-1.5">Estimation</div>
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 space-y-2 text-xs">
                    {/* Per-person rate + group size */}
                    <div className="flex items-center gap-2">
                      <span className="text-stone-500 w-20 shrink-0">Per person</span>
                      <span className="text-stone-500">₹</span>
                      {isEditing ? (
                        <input type="number" min="0" step="100" value={editDraft.per_person_rate} onChange={e => setEditDraft(p => ({ ...p, per_person_rate: e.target.value }))}
                          className="w-24 text-xs font-medium bg-white border border-stone-200 rounded-lg px-2 py-1 outline-none focus:border-amber-400" />
                      ) : (
                        <span className="font-semibold text-stone-800">{selectedLead.per_person_rate ? Math.round(selectedLead.per_person_rate).toLocaleString('en-IN') : '—'}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-stone-500 w-20 shrink-0">Group size</span>
                      {isEditing ? (
                        <input type="number" min="1" value={editDraft.group_size} onChange={e => setEditDraft(p => ({ ...p, group_size: e.target.value }))}
                          className="w-24 text-xs font-medium bg-white border border-stone-200 rounded-lg px-2 py-1 outline-none focus:border-amber-400" />
                      ) : (
                        <span className="font-semibold text-stone-800">{selectedLead.group_size || '—'}</span>
                      )}
                      <span className="text-stone-400">pax</span>
                    </div>

                    <div className="border-t border-stone-200 pt-2 flex items-center justify-between">
                      <span className="text-stone-500">Subtotal</span>
                      <span className="font-semibold text-stone-800">{fmt(fin.subtotal)}</span>
                    </div>

                    {/* Discount */}
                    <div className="flex items-center gap-2">
                      <span className="text-stone-500 w-20 shrink-0">Discount</span>
                      {isEditing ? (
                        <>
                          <select value={editDraft.discount_type} onChange={e => setEditDraft(p => ({ ...p, discount_type: e.target.value }))}
                            className="text-xs bg-white border border-stone-200 rounded-lg px-1.5 py-1 outline-none focus:border-amber-400">
                            <option value="">None</option>
                            <option value="percentage">%</option>
                            <option value="fixed">₹</option>
                          </select>
                          {editDraft.discount_type && (
                            <input type="number" min="0" value={editDraft.discount_value} onChange={e => setEditDraft(p => ({ ...p, discount_value: e.target.value }))}
                              className="w-20 text-xs font-medium bg-white border border-stone-200 rounded-lg px-2 py-1 outline-none focus:border-amber-400" />
                          )}
                        </>
                      ) : (
                        <span className="font-semibold text-stone-800">
                          {fin.discountAmt > 0 ? `− ${fmt(fin.discountAmt)}` : '—'}
                        </span>
                      )}
                    </div>

                    {/* Tax */}
                    <div className="flex items-center gap-2">
                      <span className="text-stone-500 w-20 shrink-0">Tax</span>
                      {isEditing ? (
                        <>
                          <span className="text-stone-500">@</span>
                          <input type="number" min="0" max="100" step="0.5" value={editDraft.tax_rate} onChange={e => setEditDraft(p => ({ ...p, tax_rate: e.target.value }))}
                            className="w-16 text-xs font-medium bg-white border border-stone-200 rounded-lg px-2 py-1 outline-none focus:border-amber-400" />
                          <span className="text-stone-400">%</span>
                          <label className="flex items-center gap-1.5 text-stone-500 ml-auto">
                            <input type="checkbox" checked={editDraft.tax_inclusive} onChange={e => setEditDraft(p => ({ ...p, tax_inclusive: e.target.checked }))}
                              className="rounded border-stone-300 text-amber-600 focus:ring-amber-400/30" />
                            <span className="text-[10px]">Incl.</span>
                          </label>
                        </>
                      ) : (
                        <span className="font-semibold text-stone-800">
                          {fin.taxInc ? 'Inclusive' : fmt(fin.gst)}
                        </span>
                      )}
                    </div>

                    {/* Net amount */}
                    <div className="border-t border-amber-200 pt-2 flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-700">Net Amount</span>
                      <span className="text-sm font-extrabold text-amber-700">{fmt(fin.net)}</span>
                    </div>
                  </div>
                </div>

                {/* Parsed inquiry data */}
                {(() => {
                  const parsed = parseMessage(isEditing ? editDraft.message : selectedLead.message)
                  if (!parsed.packageName && !parsed.startDate) return null
                  return (
                    <div>
                      <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wide mb-1.5">Inquiry</div>
                      <div className="space-y-1 text-xs text-stone-600">
                        {parsed.packageName && <div><span className="font-medium text-stone-700">Package:</span> {parsed.packageName}</div>}
                        {parsed.startDate && <div><span className="font-medium text-stone-700">Dates:</span> {parsed.startDate}{parsed.endDate ? ` → ${parsed.endDate}` : ''}</div>}
                        {parsed.groupSize && !selectedLead.group_size && <div className="text-amber-600">Group size: {parsed.groupSize} (from message)</div>}
                      </div>
                    </div>
                  )
                })()}

                {/* Message (collapsible) */}
                <div>
                  <button
                    onClick={() => setMessageOpen(!messageOpen)}
                    className="flex items-center gap-1.5 text-[10px] font-bold text-stone-400 uppercase tracking-wide mb-1.5 hover:text-stone-600 transition-colors cursor-pointer"
                  >
                    <svg className={`w-3 h-3 transition-transform ${messageOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    Message
                  </button>
                  {messageOpen && (
                    isEditing ? (
                      <textarea value={editDraft.message} onChange={e => setEditDraft(p => ({ ...p, message: e.target.value }))}
                        className="w-full text-xs bg-stone-50 border border-stone-200 rounded-lg px-2 py-1.5 outline-none focus:border-amber-400 min-h-[80px] resize-y" />
                    ) : (
                      <p className="text-xs text-stone-600 leading-relaxed whitespace-pre-wrap">{selectedLead.message || '—'}</p>
                    )
                  )}
                </div>

                {/* Status & Submitted */}
                <div className="flex gap-4">
                  <div className="flex-1">
                    <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wide mb-1">Status</div>
                    {canWrite ? (
                      <select
                        value={selectedLead.status || 'new'}
                        onChange={(e) => updateStatus(selectedLead.id, e.target.value)}
                        className={`text-[11px] font-bold px-2 py-1 rounded-lg border cursor-pointer outline-none transition-all ${STATUS_COLORS[selectedLead.status] || STATUS_COLORS.new}`}
                      >
                        {STATUS_OPTIONS.map(s => (
                          <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-lg border ${STATUS_COLORS[selectedLead.status] || STATUS_COLORS.new}`}>
                        {selectedLead.status ? selectedLead.status.charAt(0).toUpperCase() + selectedLead.status.slice(1) : 'New'}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wide mb-1">Submitted</div>
                    <div className="text-xs text-stone-600 whitespace-nowrap">{formatDate(selectedLead.submitted_at)}</div>
                  </div>
                </div>

                {/* Actions */}
                {canWrite && (
                  <div className="flex gap-2 pt-2 border-t border-stone-100">
                    {isEditing ? (
                      <>
                        <button onClick={cancelEdit} className="flex-1 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-all cursor-pointer">Cancel</button>
                        <button onClick={saveEdit} className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-sm active:scale-[0.98] transition-all cursor-pointer">Save</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(selectedLead)} className="flex-1 py-2 bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 rounded-xl text-xs font-bold transition-all cursor-pointer">Edit</button>
                        {(selectedLead.status === 'converted' || selectedLead.status === 'qualified') && (
                          <button onClick={() => handleConvert(selectedLead)} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm active:scale-[0.98] transition-all cursor-pointer">Create Booking</button>
                        )}
                        <button onClick={() => confirmDelete(selectedLead)} className="px-4 py-2 bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 rounded-xl text-xs font-bold transition-all cursor-pointer">Delete</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md">
          <div className="bg-white border border-stone-200 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-sm font-bold text-stone-900 mb-2">Delete Lead</h3>
            <p className="text-xs text-stone-500 mb-6">
              Are you sure you want to delete <span className="font-semibold text-stone-700">{deleteTarget.name}</span>'s lead? This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setDeleteTarget(null); deleteRef.current = null }}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={deleteLead}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-sm active:scale-[0.98] transition-all cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

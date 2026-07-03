import { useState, useEffect } from 'react'
import { roleHas } from '../utils/permissions'
import ReadOnlyBanner from './ReadOnlyBanner'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const formatUSD = (price) => price != null ? `$${Number(price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''

const defaultProgress = {
  quoteSent: true,
  depositPaid: false,
  flightsConfirmed: false,
  finalPayment: false
};

const timelineSteps = [
  { key: 'quoteSent', step: 'Quote Sent', defaultDate: 'Date of inquiry' },
  { key: 'depositPaid', step: 'Deposit Paid', getSubtitle: (progress) => progress.depositPaid ? 'Confirmed' : 'Awaiting' },
  { key: 'flightsConfirmed', step: 'Flights Confirmed', getSubtitle: (progress) => progress.flightsConfirmed ? 'PNR Assigned' : 'Awaiting payment' },
  { key: 'finalPayment', step: 'Final Payment', getSubtitle: (progress) => progress.finalPayment ? 'Completed' : 'Awaiting' }
];

export default function BookingsPage({ 
  bookings, 
  setBookings, 
  clients, 
  setClients, 
  packages, 
  setPackages, 
  settings, 
  addNotification,
  bookingDraft,
  setBookingDraft,
  initialSelectedBookingId,
  onSelectBooking,
  user,
  token
}) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  
  // Edit & Delete States
  const [editBookingObj, setEditBookingObj] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [bookingToDelete, setBookingToDelete] = useState(null)
  const [pendingApprovalBookings, setPendingApprovalBookings] = useState(new Set())

  const canWriteBooking = roleHas(user?.role, 'write:bookings')

  const [editClient, setEditClient] = useState('')
  const [editPackage, setEditPackage] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editDiscount, setEditDiscount] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editGuests, setEditGuests] = useState('1')
  const [editStatus, setEditStatus] = useState('Pending')
  const [editDirectives, setEditDirectives] = useState('')

  // Form States
  const [newClient, setNewClient] = useState('')
  const [newPackage, setNewPackage] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newDiscount, setNewDiscount] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newGuests, setNewGuests] = useState('1')
  const [newStatus, setNewStatus] = useState('Pending')
  const [newDirectives, setNewDirectives] = useState('')

  // Sidebar Inline Tag Editor State
  const [newTagInput, setNewTagInput] = useState('')
  const [isAddingTag, setIsAddingTag] = useState(false)

  // Consume incoming bookingDraft from cross-tab quick actions
  useEffect(() => {
    if (!bookingDraft) return
    if (bookingDraft.client) setNewClient(bookingDraft.client)
    if (bookingDraft.package) {
      setNewPackage(bookingDraft.package)
      const matchedPkg = packages.find(p => p.name === bookingDraft.package)
      if (matchedPkg) {
        const guests = parseInt(newGuests) || 1
        setNewAmount((matchedPkg.basePrice * guests).toString())
      }
    }
    setShowAddForm(true)
    if (setBookingDraft) setBookingDraft(null)
  }, [bookingDraft]) // eslint-disable-line react-hooks/exhaustive-deps

  // Deep-link: auto-select a booking when navigated from dashboard
  useEffect(() => {
    if (!initialSelectedBookingId) return
    const match = bookings.find(b => b.id === initialSelectedBookingId)
    if (match) {
      setSelectedBooking(match)
    }
    if (onSelectBooking) onSelectBooking(null)
  }, [initialSelectedBookingId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Utility Date Formatters
  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    if (isNaN(Date.parse(dateStr))) return dateStr
    const dateObj = new Date(dateStr)
    return dateObj.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC'
    })
  }

  const parseDateToInputFormat = (dateStr) => {
    if (!dateStr) return ''
    const parsed = Date.parse(dateStr)
    if (isNaN(parsed)) {
      const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' }
      const parts = dateStr.split(/\s+/)
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0')
        const month = months[parts[1].toLowerCase()]
        const year = parts[2]
        if (month && day && year) {
          return `${year}-${month}-${day}`
        }
      }
      return ''
    }
    const dateObj = new Date(parsed)
    return dateObj.toISOString().split('T')[0]
  }

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return ''
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      const [y, m, d] = dateStr.substring(0, 10).split('-')
      return `${d}/${m}/${y}${dateStr.substring(10)}`
    }
    return dateStr
  }

  const parseDateDisplay = (str) => {
    if (!str) return ''
    const parts = str.split('/')
    if (parts.length === 3) {
      const [d, m, y] = parts
      if (d.length >= 1 && d.length <= 2 && m.length >= 1 && m.length <= 2 && y.length === 4) {
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
      }
    }
    return str
  }

  // Fetch pending approval booking IDs for operations users
  useEffect(() => {
    if (!user || !roleHas(user.role, 'submit:approvals') || !token) return
    const fetchPending = async () => {
      try {
        const res = await fetch(`${API_URL}/api/approvals?status=mine`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          const pendingIds = data
            .filter(a => a.status === 'pending')
            .map(a => a.entity_id)
          setPendingApprovalBookings(new Set(pendingIds))
        }
      } catch {}
    }
    fetchPending()
    const interval = setInterval(fetchPending, 30000)
    return () => clearInterval(interval)
  }, [user, token])

  const handleSaveEditBooking = async (e) => {
    e.preventDefault()
    if (!editBookingObj || !editClient || !editPackage || !editAmount || !editDate) return

    // Slot validation guard (read-only check; backend is the source of truth)
    const newGuestCount = parseInt(editGuests) || 1
    if (editBookingObj.package !== editPackage || newGuestCount !== (editBookingObj.guests || 1)) {
      const targetPkg = packages.find(p => p.name === editPackage)
      if (targetPkg) {
        const slotsLeft = targetPkg.slots.total - targetPkg.slots.booked
        if (editBookingObj.package !== editPackage) {
          // Full re-check for new package
          if (slotsLeft < newGuestCount) {
            if (addNotification) {
              addNotification(`Error: Not enough slots for ${newGuestCount} guests in ${editPackage}. Only ${slotsLeft} left.`, 'warning')
            }
            return
          }
        } else {
          // Same package, guests changed — check delta
          const oldGuests = editBookingObj.guests || 1
          const delta = newGuestCount - oldGuests
          if (delta > 0 && slotsLeft < delta) {
            if (addNotification) {
              addNotification(`Error: Cannot add ${delta} more guests. Only ${slotsLeft} slots left.`, 'warning')
            }
            return
          }
        }
      }
    }

    const formattedDate = formatDate(editDate)

    const parsedDirectives = editDirectives
      ? editDirectives.split(',').map(s => s.trim()).filter(Boolean)
      : []

    // For operations: detect pricing changes — if amount or discount changed, route through approval
    const isOperations = user && roleHas(user.role, 'write:bookings') && !roleHas(user.role, 'write:bookings.pricing')
    if (isOperations) {
      const amountChanged = parseFloat(editAmount) !== editBookingObj.amount
      const discountChanged = (editDiscount ? parseFloat(editDiscount) : 0) !== (editBookingObj.discountValue || 0)

      if (amountChanged || discountChanged) {
        // Don't update local state — create approval request via API
        try {
          const res = await fetch(`${API_URL}/api/bookings/${editBookingObj.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              client: editClient,
              package: editPackage,
              amount: parseFloat(editAmount) || 0,
              discountType: editDiscount ? 'fixed' : null,
              discountValue: editDiscount ? parseFloat(editDiscount) : 0,
              date: formattedDate,
              status: editStatus,
              guests: parseInt(editGuests) || 1,
              notes: 'Pricing change — requires admin approval',
              specialDirectives: parsedDirectives
            })
          })

          if (res.status === 202) {
            await res.json()
            if (addNotification) addNotification('Pricing change requires admin approval. Request submitted.', 'info')
            setShowEditModal(false)
            return
          } else if (res.ok) {
            // 200 — fall through to normal update (unlikely for ops but handle gracefully)
          } else if (res.status === 403) {
            const err = await res.json()
            if (addNotification) addNotification(err.error || 'Insufficient permissions', 'error')
            return
          } else {
            const err = await res.json()
            if (addNotification) addNotification(err.error || 'Failed to submit approval request', 'error')
            return
          }
        } catch {
          if (addNotification) addNotification('Network error submitting approval request', 'error')
          return
        }
      }
    }

    const currentProgress = editBookingObj.progress || defaultProgress
    const updatedProgress = editStatus === 'Paid'
      ? { ...currentProgress, depositPaid: true, finalPayment: true }
      : { ...currentProgress, finalPayment: false }

    const updatedBooking = {
      ...editBookingObj,
      client: editClient,
      package: editPackage,
      amount: parseFloat(editAmount) || 0,
      discountValue: editDiscount ? parseFloat(editDiscount) : 0,
      date: formattedDate,
      status: editStatus,
      guests: parseInt(editGuests) || 1,
      specialDirectives: parsedDirectives,
      progress: updatedProgress
    }

    setBookings(bookings.map(b => b.id === editBookingObj.id ? updatedBooking : b))
    setSelectedBooking(updatedBooking)
    setShowEditModal(false)

    setClients(clients.map(c => {
      if (c.name === editClient) {
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16)
        return {
          ...c,
          lastContact: timestamp.split(' ')[0],
          logs: [
            {
              time: timestamp,
              text: `System: Updated booking details for ${editBookingObj.id} (Package: ${editPackage}, Departure: ${formattedDate}, Status: ${editStatus})`
            },
            ...c.logs
          ]
        }
      }
      return c
    }))

    if (addNotification) {
      addNotification(`Booking ${editBookingObj.id} successfully updated`, 'success')
    }
  }

  const confirmDeleteBooking = async () => {
    if (!bookingToDelete) return

    // Operations users route through approval
    const isOperations = user && roleHas(user.role, 'write:bookings') && !roleHas(user.role, 'delete:bookings')
    if (isOperations) {
      try {
        const res = await fetch(`${API_URL}/api/bookings/${bookingToDelete.id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        })
        if (res.status === 202) {
          const data = await res.json()
          setPendingApprovalBookings(prev => new Set([...prev, bookingToDelete.id]))
          setBookingToDelete(null)
          if (addNotification) addNotification(data.message || 'Deletion request submitted for admin approval.', 'info')
          return
        } else if (res.ok) {
          // 200 — fall through to normal delete (admin context or similar)
        } else if (res.status === 403) {
          const err = await res.json()
          if (addNotification) addNotification(err.error || 'Insufficient permissions', 'error')
          setBookingToDelete(null)
          return
        } else {
          const err = await res.json()
          if (addNotification) addNotification(err.error || 'Failed to submit deletion request', 'error')
          setBookingToDelete(null)
          return
        }
      } catch {
        if (addNotification) addNotification('Network error submitting deletion request', 'error')
        setBookingToDelete(null)
        return
      }
    }

    // Admin flow: direct delete via sync
    setBookings(bookings.filter(b => b.id !== bookingToDelete.id))
    setSelectedBooking(null)
    setBookingToDelete(null)

    setClients(clients.map(c => {
      if (c.name === bookingToDelete.client) {
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16)
        return {
          ...c,
          lastContact: timestamp.split(' ')[0],
          logs: [
            {
              time: timestamp,
              text: `System: Deleted booking ${bookingToDelete.id} for package "${bookingToDelete.package}"`
            },
            ...c.logs
          ]
        }
      }
      return c
    }))

    if (addNotification) {
      addNotification(`Successfully deleted booking ${bookingToDelete.id}`, 'info')
    }
  }

  const handleAddBooking = (e) => {
    e.preventDefault()
    if (!newClient || !newPackage || !newAmount || !newDate) return
    
    // Check package availability (per-guest slot consumption)
    const targetPkg = packages.find(p => p.name === newPackage)
    if (targetPkg) {
      const guestCount = parseInt(newGuests) || 1
      const slotsLeft = targetPkg.slots.total - targetPkg.slots.booked
      if (slotsLeft < guestCount) {
        if (addNotification) {
          addNotification(`Error: Not enough slots for ${guestCount} guests in ${newPackage}. Only ${slotsLeft} left.`, 'warning')
        } else {
          alert(`Error: Not enough slots for ${guestCount} guests in ${newPackage}. Only ${slotsLeft} left.`)
        }
        return
      }
    }
    
    const newId = `BK-${crypto.randomUUID()}`
    const guestCount = parseInt(newGuests) || 1

    const parsedDirectives = newDirectives
      ? newDirectives.split(',').map(s => s.trim()).filter(Boolean)
      : []

    const initialProgress = newStatus === 'Paid'
      ? { quoteSent: true, depositPaid: true, flightsConfirmed: true, finalPayment: true }
      : { quoteSent: true, depositPaid: false, flightsConfirmed: false, finalPayment: false }

    const newBookingObj = {
      id: newId,
      client: newClient,
      package: newPackage,
      amount: parseFloat(newAmount) || 0,
      discountValue: newDiscount ? parseFloat(newDiscount) : 0,
      date: formatDate(newDate),
      status: newStatus,
      guests: guestCount,
      specialDirectives: parsedDirectives,
      progress: initialProgress
    }

    setBookings([newBookingObj, ...bookings])

    // Log to client profile logs
    setClients(clients.map(c => {
      if (c.name === newClient) {
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16)
        const datePart = timestamp.split(' ')[0]
        return {
          ...c,
          lastContact: datePart,
          logs: [
            {
              time: timestamp,
              text: `System: Created new booking ${newId} for package "${newPackage}" (Departure: ${newDate}, Status: ${newStatus})`
            },
            ...c.logs
          ]
        }
      }
      return c
    }))
    
    if (addNotification) {
      addNotification(`Successfully created booking ${newId} for ${newClient}`, 'success')
    }
    
    // Reset Form
    setNewClient('')
    setNewPackage('')
    setNewAmount('')
    setNewDiscount('')
    setNewDate('')
    setNewGuests('1')
    setNewStatus('Pending')
    setNewDirectives('')
    setShowAddForm(false)
  }

  const filtered = bookings.filter(b => {
    const matchesSearch = b.client.toLowerCase().includes(search.toLowerCase()) || 
                          b.package.toLowerCase().includes(search.toLowerCase()) ||
                          b.id.toLowerCase().includes(search.toLowerCase())
    
    const matchesStatus = statusFilter === 'All' || b.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const handleAddDirective = (tag) => {
    if (!tag || !tag.trim() || !selectedBooking) return;
    if (!canWriteBooking) {
      if (addNotification) addNotification('You do not have permission to edit bookings', 'error');
      return;
    }
    const currentTags = selectedBooking.specialDirectives || [];
    if (currentTags.includes(tag.trim())) {
      if (addNotification) addNotification('Directive already exists', 'warning');
      return;
    }
    const updatedTags = [...currentTags, tag.trim()];
    const updatedBooking = {
      ...selectedBooking,
      specialDirectives: updatedTags
    };
    setBookings(bookings.map(b => b.id === selectedBooking.id ? updatedBooking : b));
    setSelectedBooking(updatedBooking);
    if (addNotification) addNotification('Directive added successfully', 'success');
  };

  const handleRemoveDirective = (tagToRemove) => {
    if (!selectedBooking) return;
    if (!canWriteBooking) {
      if (addNotification) addNotification('You do not have permission to edit bookings', 'error');
      return;
    }
    const currentTags = selectedBooking.specialDirectives || [];
    const updatedTags = currentTags.filter(t => t !== tagToRemove);
    const updatedBooking = {
      ...selectedBooking,
      specialDirectives: updatedTags
    };
    setBookings(bookings.map(b => b.id === selectedBooking.id ? updatedBooking : b));
    setSelectedBooking(updatedBooking);
    if (addNotification) addNotification('Directive removed successfully', 'success');
  };

  const handleToggleProgressStep = (stepKey, value) => {
    if (!canWriteBooking) {
      if (addNotification) addNotification('You do not have permission to edit bookings', 'error');
      return;
    }
    const currentProgress = selectedBooking.progress || defaultProgress;
    const updatedProgress = {
      ...currentProgress,
      [stepKey]: value
    };

    // Logical dependencies between depositPaid and finalPayment
    if (stepKey === 'finalPayment' && value) {
      updatedProgress.depositPaid = true;
    } else if (stepKey === 'depositPaid' && !value) {
      updatedProgress.finalPayment = false;
    }

    // Status is 'Paid' only when finalPayment is true
    const newStatus = updatedProgress.finalPayment ? 'Paid' : 'Pending';

    const updatedBooking = {
      ...selectedBooking,
      progress: updatedProgress,
      status: newStatus
    };

    setBookings(bookings.map(b => b.id === selectedBooking.id ? updatedBooking : b));
    setSelectedBooking(updatedBooking);

    // Update client logs
    setClients(clients.map(c => {
      if (c.name === selectedBooking.client) {
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
        return {
          ...c,
          lastContact: timestamp.split(' ')[0],
          logs: [
            {
              time: timestamp,
              text: `System: Updated progress step "${stepKey}" to ${value ? 'completed' : 'pending'} for booking ${selectedBooking.id}`
            },
            ...c.logs
          ]
        };
      }
      return c;
    }));

    if (addNotification) {
      addNotification(`Booking progress updated successfully.`, 'success');
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Top action row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">Reservations Portal</h2>
          <p className="text-xs text-stone-400">Manage, review, and create agency bookings.</p>
        </div>
        {canWriteBooking && (
          <button
            onClick={() => setShowAddForm(true)}
            className="py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-sm active:scale-[0.98] transition-all duration-300 flex items-center gap-2 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create Booking
          </button>
        )}
      </div>

      {/* Filter and Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Bookings List Panel (2/3 width) */}
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-white border border-stone-200/80 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Search */}
            <div className="relative w-full md:w-72">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search Client or PNR..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg py-2 pl-9 pr-3 text-xs text-stone-800 placeholder-stone-400 outline-none focus:ring-1 focus:ring-amber-500 transition-all"
              />
            </div>
            
            {/* Status tabs */}
            <div className="flex bg-stone-100 p-1 rounded-lg self-stretch md:self-auto">
              {['All', 'Paid', 'Pending'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    statusFilter === status
                      ? 'bg-white text-stone-800 shadow-sm'
                      : 'text-stone-400 hover:text-stone-700'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white border border-stone-200/80 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50/50 border-b border-stone-200/50 text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                    <th className="py-3 px-6">ID</th>
                    <th className="py-3 px-6">Client</th>
                    <th className="py-3 px-6">Package</th>
                    <th className="py-3 px-6">Amount</th>
                    <th className="py-3 px-6">Departure</th>
                    <th className="py-3 px-6">Status</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filtered.length > 0 ? (
                    filtered.map((b) => (
                      <tr 
                        key={b.id} 
                        onClick={() => setSelectedBooking(b)}
                        className={`hover:bg-stone-50/50 transition-colors duration-200 text-xs cursor-pointer ${
                          selectedBooking?.id === b.id ? 'bg-amber-500/5 hover:bg-amber-500/5' : ''
                        }`}
                      >
                        <td className="py-3.5 px-6 font-mono text-[11px] text-stone-500">
                          {b.id}
                          {b.guests > 1 && <span className="ml-1.5 text-[9px] text-stone-400">· {b.guests} guests</span>}
                        </td>
                        <td className="py-3.5 px-6 font-semibold text-stone-900">{b.client}</td>
                        <td className="py-3.5 px-6 text-stone-600">{b.package}</td>
                        <td className="py-3.5 px-6 font-bold text-stone-800">
                          ₹{Number(b.amount).toLocaleString('en-IN')}
                          {b.usdAmount != null && <span className="ml-1 text-[9px] text-stone-500 font-medium">{formatUSD(b.usdAmount)}</span>}
                        </td>
                        <td className="py-3.5 px-6 text-stone-500">{b.date}</td>
                        <td className="py-3.5 px-6">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            b.status === 'Paid'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200/40'
                              : 'bg-amber-50 text-amber-700 border-amber-200/40'
                          }`}>
                            {b.status}
                          </span>
                          {pendingApprovalBookings.has(b.id) && (
                            <span className="ml-1.5 inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-600 border border-blue-200/40">
                              Pending Approval
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-6 text-right">
                          <button 
                            className="text-amber-700 hover:text-amber-600 font-bold transition-all"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedBooking(b)
                            }}
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-stone-400 text-xs">
                        No bookings match the search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Selected Booking Drawer / Details Panel (1/3 width) */}
        <div className="xl:col-span-1">
          {selectedBooking ? (
            <div className="bg-white border border-stone-200/80 rounded-2xl p-5 shadow-sm space-y-6 animate-in fade-in duration-200 sticky top-24">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-mono text-stone-400">{selectedBooking.id}</span>
                  <h3 className="text-base font-bold text-stone-900 tracking-tight">{selectedBooking.client}</h3>
                  <p className="text-xs text-stone-500">{selectedBooking.package}</p>
                </div>
                <button 
                  onClick={() => setSelectedBooking(null)}
                  className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600"
                >
                  <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Status workflow */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider">Flight & Booking Lifecycle</h4>
                  <span className="text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full font-mono font-semibold">
                    {Object.values(selectedBooking.progress || defaultProgress).filter(Boolean).length} / {timelineSteps.length} Done
                  </span>
                </div>
                <div className="relative space-y-2 py-1">
                  {timelineSteps.map((step, idx) => {
                    const progressVal = selectedBooking.progress || defaultProgress;
                    const isCompleted = progressVal[step.key] ?? false;
                    const subtitle = step.getSubtitle ? step.getSubtitle(progressVal) : step.defaultDate;

                    return (
                      <div 
                        key={idx} 
                        className={`relative flex items-center justify-between p-3 rounded-xl border transition-all duration-300 ${
                          isCompleted 
                            ? 'bg-emerald-50/40 border-emerald-100 shadow-[0_2px_8px_-3px_rgba(16,185,129,0.08)]' 
                            : 'bg-white hover:bg-stone-50/50 border-stone-100 hover:border-stone-200/80'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          {/* Timeline dot custom checkbox */}
                          <label className="relative flex items-center justify-center cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={isCompleted}
                              disabled={!canWriteBooking}
                              onChange={(e) => handleToggleProgressStep(step.key, e.target.checked)}
                              className="sr-only"
                            />
                            {/* Outer Ring */}
                            <span className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all duration-300 ${
                              isCompleted 
                                ? 'bg-gradient-to-br from-emerald-400 to-teal-500 border-transparent shadow-sm shadow-emerald-400/25 scale-100' 
                                : 'bg-stone-50 border-stone-200 group-hover:border-stone-350 group-hover:scale-105 group-hover:rotate-6'
                            } group-focus-within:ring-2 group-focus-within:ring-amber-500/40`}>
                              {isCompleted ? (
                                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <span className="text-[11px] font-bold text-stone-400 group-hover:text-stone-600 transition-colors">
                                  {idx + 1}
                                </span>
                              )}
                            </span>
                          </label>
                          
                          <div>
                            <p className={`text-xs font-bold transition-colors ${
                              isCompleted ? 'text-emerald-950' : 'text-stone-700'
                            }`}>
                              {step.step}
                            </p>
                            <p className="text-[10px] text-stone-400 font-medium">{subtitle}</p>
                          </div>
                        </div>

                        {/* Status indicators */}
                        <div>
                          {isCompleted ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-stone-100 text-stone-400">
                              Pending
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Special Info */}
              <div className="border-t border-stone-100 pt-4 space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider">Staff Special Directives</h4>
                  {canWriteBooking && !isAddingTag && (
                    <button
                      onClick={() => setIsAddingTag(true)}
                      className="text-[10px] text-amber-600 hover:text-amber-500 font-bold transition-colors cursor-pointer"
                    >
                      + Add tag
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {(selectedBooking.specialDirectives || []).map((tag, idx) => {
                    const colors = [
                      { bg: 'bg-rose-50/85', text: 'text-rose-700', border: 'border-rose-100/50' },
                      { bg: 'bg-amber-50/85', text: 'text-amber-700', border: 'border-amber-100/50' },
                      { bg: 'bg-emerald-50/85', text: 'text-emerald-700', border: 'border-emerald-100/50' },
                      { bg: 'bg-blue-50/85', text: 'text-blue-700', border: 'border-blue-100/50' },
                      { bg: 'bg-stone-50/85', text: 'text-stone-700', border: 'border-stone-200/50' },
                    ];
                    const c = colors[tag.length % colors.length];
                    return (
                      <span
                        key={idx}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 ${c.bg} ${c.text} border ${c.border} rounded-lg text-[10px] font-semibold transition-all duration-300 hover:scale-[1.02]`}
                      >
                        {tag}
                        {canWriteBooking && (
                          <button
                            onClick={() => handleRemoveDirective(tag)}
                            className="hover:bg-black/5 rounded-full p-0.5 transition-colors cursor-pointer ml-0.5 text-[11px] leading-none text-stone-400 hover:text-stone-700"
                            title="Remove directive"
                          >
                            &times;
                          </button>
                        )}
                      </span>
                    );
                  })}
                  {isAddingTag && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (newTagInput.trim()) {
                          handleAddDirective(newTagInput);
                          setNewTagInput('');
                        }
                        setIsAddingTag(false);
                      }}
                      className="inline-flex items-center"
                    >
                      <input
                        type="text"
                        autoFocus
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        onBlur={() => {
                          setTimeout(() => {
                            if (newTagInput.trim()) {
                              handleAddDirective(newTagInput);
                              setNewTagInput('');
                            }
                            setIsAddingTag(false);
                          }, 150);
                        }}
                        placeholder="Type tag..."
                        className="px-2 py-0.5 text-[10px] bg-white border border-stone-300 focus:border-amber-500 rounded-lg outline-none max-w-[120px] transition-all"
                      />
                    </form>
                  )}
                  {(!selectedBooking.specialDirectives || selectedBooking.specialDirectives.length === 0) && !isAddingTag && (
                    <span className="text-[10px] text-stone-400 italic">No directives recorded for this booking.</span>
                  )}
                </div>
              </div>

              {/* Dynamic Invoicing Breakdown — Client View */}
              {(() => {
                const bookingPkg = packages.find(p => p.name === selectedBooking.package)
                const perGuestPrice = bookingPkg?.basePrice || Number(selectedBooking.amount) || 0
                const costPerGuest = bookingPkg?.costPrice || 0
                const guestCount = selectedBooking.guests || 1
                const grossSubtotal = perGuestPrice * guestCount
                const totalCost = costPerGuest * guestCount
                const discountAmount = Number(selectedBooking.discountValue) || 0
                const taxRate = bookingPkg?.taxRate ?? 0
                const taxableAmount = grossSubtotal - discountAmount
                const gstAmount = taxableAmount * (taxRate / 100)
                const netTotal = taxableAmount + gstAmount
                const depositPct = parseFloat(settings.depositPercent ?? 20)
                const progressVal = selectedBooking.progress || defaultProgress
                const hasFinalPayment = progressVal.finalPayment ?? false
                const hasDepositPaid = progressVal.depositPaid ?? false

                let depositCollected = 0
                if (hasFinalPayment) {
                  depositCollected = netTotal
                } else if (hasDepositPaid) {
                  depositCollected = Math.round(netTotal * (depositPct / 100))
                }

                const outstandingBalance = Math.round(netTotal) - Math.round(depositCollected)
                const grossMargin = grossSubtotal - totalCost
                const markupPct = parseFloat(settings.rules?.markup ?? settings.defaultMarkup ?? '15')
                const splitPct = parseFloat(settings.rules?.agentSplit ?? settings.defaultAgentSplit ?? '40')
                const agentCommissionSplit = grossMargin * (splitPct / 100)
                const agencyNetMargin = grossMargin - agentCommissionSplit
                const inrToUsdRate = parseFloat(settings.inrToUsdRate ?? 0)
                const toUSD = (inr) => inrToUsdRate > 0 ? inr / inrToUsdRate : null
                const usd = (inr) => inrToUsdRate > 0 && inr != null ? `${Number(inr / inrToUsdRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''

                return (
                  <div className="border-t border-stone-100 pt-4 space-y-2">
                    <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider">Invoice Breakdown</h4>
                    <div className="flex justify-between text-xs">
                      <span className="text-stone-500 font-medium">Gross Subtotal <span className="text-[9px] text-stone-400">({guestCount} × ₹{perGuestPrice.toLocaleString('en-IN')})</span></span>
                      <span className="font-semibold text-stone-800">₹{Math.round(grossSubtotal).toLocaleString('en-IN')}{usd(grossSubtotal) && <span className="ml-1 text-[9px] text-stone-400">{usd(grossSubtotal)}</span>}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-emerald-600 font-medium">Applied Discount</span>
                        <span className="font-semibold text-emerald-700">−₹{Math.round(discountAmount).toLocaleString('en-IN')}{usd(discountAmount) && <span className="ml-1 text-[9px] text-emerald-400">{usd(discountAmount)}</span>}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs">
                      <span className="text-stone-500 font-medium">GST / Taxes <span className="text-[9px] text-stone-400">({taxRate}%)</span></span>
                      <span className="font-semibold text-stone-800">₹{Math.round(gstAmount).toLocaleString('en-IN')}{usd(gstAmount) && <span className="ml-1 text-[9px] text-stone-400">{usd(gstAmount)}</span>}</span>
                    </div>
                    <div className="flex justify-between text-xs border-t border-stone-200/50 pt-2">
                      <span className="text-stone-800 font-bold">Net Total</span>
                      <span className="font-extrabold text-stone-900">₹{Math.round(netTotal).toLocaleString('en-IN')}{usd(netTotal) && <span className="ml-1 text-[9px] text-stone-500">{usd(netTotal)}</span>}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-stone-500 font-medium">
                        {hasFinalPayment ? 'Total Paid' : 'Deposit Collected'}{' '}
                        <span className="text-[9px] text-stone-400 font-normal">
                          ({hasFinalPayment ? '100%' : hasDepositPaid ? `${depositPct}% advance` : `0% of ${depositPct}% advance`})
                        </span>
                      </span>
                      <span className="font-semibold text-stone-800">₹{Math.round(depositCollected).toLocaleString('en-IN')}{usd(depositCollected) && <span className="ml-1 text-[9px] text-stone-400">{usd(depositCollected)}</span>}</span>
                    </div>
                    <div className="flex justify-between text-xs border-t border-stone-100 pb-2">
                      <span className="text-stone-800 font-bold">Outstanding Balance</span>
                      <span className={`font-bold ${outstandingBalance <= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {outstandingBalance <= 0 ? '₹0' : `₹${outstandingBalance.toLocaleString('en-IN')}`}{usd(outstandingBalance) && outstandingBalance > 0 && <span className="ml-1 text-[9px] text-stone-400">{usd(outstandingBalance)}</span>}
                      </span>
                    </div>

                    {/* Margin & Commission — Internal View */}
                    {costPerGuest > 0 && (
                      <>
                        <div className="border-t border-dashed border-stone-200/60 pt-2 space-y-1.5">
                          <h4 className="text-[10px] font-bold text-stone-700 uppercase tracking-wider">Margin &amp; Commission</h4>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-stone-500">Supplier Cost <span className="text-[8px] text-stone-400">({guestCount} × ₹{Math.round(costPerGuest).toLocaleString('en-IN')})</span></span>
                            <span className="font-semibold text-stone-600">₹{Math.round(totalCost).toLocaleString('en-IN')}{usd(totalCost) && <span className="ml-1 text-[8px] text-stone-400">{usd(totalCost)}</span>}</span>
                          </div>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-stone-500">Gross Margin</span>
                            <span className="font-semibold text-emerald-600">₹{Math.round(grossMargin).toLocaleString('en-IN')}{usd(grossMargin) && <span className="ml-1 text-[8px] text-emerald-400">{usd(grossMargin)}</span>}</span>
                          </div>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-stone-500">Agent Commission <span className="text-[8px] text-stone-400">({splitPct}% of margin)</span></span>
                            <span className="font-semibold text-stone-600">₹{Math.round(agentCommissionSplit).toLocaleString('en-IN')}{usd(agentCommissionSplit) && <span className="ml-1 text-[8px] text-stone-400">{usd(agentCommissionSplit)}</span>}</span>
                          </div>
                          <div className="flex justify-between text-[10px] font-bold border-t border-stone-200/60 pt-1">
                            <span className="text-amber-700">Agency Net Margin</span>
                            <span className="text-amber-800">₹{Math.round(agencyNetMargin).toLocaleString('en-IN')}{usd(agencyNetMargin) && <span className="ml-1 text-[8px] text-stone-500">{usd(agencyNetMargin)}</span>}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )
              })()}
              {/* Group Members */}
              {selectedBooking.groupMembers?.length > 1 && (
                <div className="border-t border-stone-100 pt-4 space-y-2.5">
                  <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                    Group Members ({selectedBooking.guests} travellers)
                  </h4>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {selectedBooking.groupMembers.map((m, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs bg-stone-50 rounded-lg px-3 py-2">
                        <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-[9px] font-bold shrink-0">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="font-semibold text-stone-800 block truncate">{m.name || `Guest ${i + 1}`}</span>
                          <span className="text-[10px] text-stone-400">
                            {m.dietary !== 'None' && <span className="mr-2">Diet: {m.dietary}</span>}
                            {m.seat && <span>Seat: {m.seat}</span>}
                            {m.passport && <span className="ml-2">Passport: {m.passport}</span>}
                            {!m.dietary && !m.seat && !m.passport && 'No details'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button 
                  onClick={() => {
                    const newStatus = selectedBooking.status === 'Paid' ? 'Pending' : 'Paid'
                    const currentProgress = selectedBooking.progress || defaultProgress
                    const updatedProgress = newStatus === 'Paid'
                      ? { ...currentProgress, depositPaid: true, finalPayment: true }
                      : { ...currentProgress, finalPayment: false }

                    const updatedBooking = {
                      ...selectedBooking,
                      status: newStatus,
                      progress: updatedProgress
                    }

                    setBookings(bookings.map(b => b.id === selectedBooking.id ? updatedBooking : b))
                    setSelectedBooking(updatedBooking)

                    // Log status change to client logs
                    setClients(clients.map(c => {
                      if (c.name === selectedBooking.client) {
                        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16)
                        return {
                          ...c,
                          lastContact: timestamp.split(' ')[0],
                          logs: [
                            {
                              time: timestamp,
                              text: `System: Booking ${selectedBooking.id} status changed to ${newStatus}`
                            },
                            ...c.logs
                          ]
                        }
                      }
                      return c
                    }))

                    if (addNotification) {
                      addNotification(`Booking ${selectedBooking.id} marked as ${newStatus}`, 'success')
                    }
                  }}
                  className="py-2 bg-stone-100 hover:bg-stone-200 border border-stone-300/40 text-stone-700 font-bold text-[10px] rounded-lg active:scale-95 transition-all text-center cursor-pointer"
                >
                  {selectedBooking.status === 'Paid' ? 'Set Pending' : 'Mark As Paid'}
                </button>
                <button className="py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-[10px] rounded-lg active:scale-95 transition-all text-center cursor-pointer">
                  Email Invoice
                </button>
              </div>

              {/* CRUD Actions: Edit / Delete */}
              <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-stone-100">
                <button 
                  onClick={() => {
                    if (!canWriteBooking) {
                      if (addNotification) addNotification('You do not have permission to edit bookings', 'error')
                      return
                    }
                    setEditBookingObj(selectedBooking)
                    setEditClient(selectedBooking.client)
                    setEditPackage(selectedBooking.package)
                    setEditAmount(String(selectedBooking.amount))
                    setEditDiscount(String(selectedBooking.discountValue ?? ''))
                    setEditDate(parseDateToInputFormat(selectedBooking.date))
                    setEditGuests(String(selectedBooking.guests || 1))
                    setEditStatus(selectedBooking.status)
                    setEditDirectives((selectedBooking.specialDirectives || []).join(', '))
                    setShowEditModal(true)
                  }}
                  className="py-2 bg-stone-100 hover:bg-stone-200 border border-stone-300/40 text-stone-700 font-bold text-[10px] rounded-lg active:scale-95 transition-all text-center cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Booking
                </button>
                <button 
                  onClick={() => {
                    setBookingToDelete(selectedBooking)
                  }}
                  className={`py-2 border font-bold text-[10px] rounded-lg active:scale-95 transition-all text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                    user && roleHas(user.role, 'write:bookings') && !roleHas(user.role, 'delete:bookings')
                      ? 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700'
                      : 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-600'
                  }`}
                  style={
                    user && !roleHas(user.role, 'write:bookings') && !roleHas(user.role, 'submit:approvals')
                      ? { display: 'none' } : {}
                  }
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {user && roleHas(user.role, 'write:bookings') && !roleHas(user.role, 'delete:bookings') ? 'Request Deletion' : 'Delete Booking'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-stone-50 border border-dashed border-stone-300/60 rounded-2xl p-12 text-center text-stone-400 text-xs">
              <svg className="w-10 h-10 mx-auto text-stone-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
              </svg>
              Select a booking profile to view details, timelines, and payment options.
            </div>
          )}
        </div>
      </div>

      {/* Create Booking Overlay Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-stone-200 rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in duration-200">
            <div className="flex justify-between items-center pb-4 border-b border-stone-100">
              <h3 className="text-base font-bold text-stone-900">Create New Client Reservation</h3>
              <button 
                onClick={() => setShowAddForm(false)}
                className="p-1 rounded-lg hover:bg-stone-100 text-stone-400"
              >
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleAddBooking} className="space-y-4 pt-4">
              {!canWriteBooking && <ReadOnlyBanner message="View-only mode — you can view but not edit bookings" />}
              <fieldset disabled={!canWriteBooking}>
              <div>
                <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">Client Full Name</label>
                <select
                  required
                  value={newClient}
                  onChange={(e) => setNewClient(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none transition-all"
                >
                  <option value="">Select a client...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.name}>{c.name} ({c.id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">Travel Package</label>
                <select
                  required
                  value={newPackage}
                  onChange={(e) => {
                    const pkgName = e.target.value
                    setNewPackage(pkgName)
                    const selectedPkg = packages.find(p => p.name === pkgName)
                    if (selectedPkg) {
                      const guests = parseInt(newGuests) || 1
                      setNewAmount((selectedPkg.basePrice * guests).toString())
                    }
                  }}
                  className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none transition-all"
                >
                  <option value="">Select a package...</option>
                  {packages.map(p => (
                    <option key={p.id} value={p.name}>{p.name} ({p.duration} - ₹{p.basePrice})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">Amount (INR)</label>
                  <input
                    type="number"
                    required
                    placeholder="4500"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">Discount (INR)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={newDiscount}
                    onChange={(e) => setNewDiscount(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">Guests</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newGuests}
                    onChange={(e) => {
                      setNewGuests(e.target.value)
                      const selectedPkg = packages.find(p => p.name === newPackage)
                      if (selectedPkg) {
                        const guests = parseInt(e.target.value) || 1
                        setNewAmount((selectedPkg.basePrice * guests).toString())
                      }
                    }}
                    className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">Departure Date</label>
                  <input
                    type="text"
                    placeholder="DD/MM/YYYY"
                    required
                    value={formatDateDisplay(newDate)}
                    onChange={(e) => setNewDate(parseDateDisplay(e.target.value))}
                    className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">Initial Status</label>
                <div className="flex gap-4">
                  {['Pending', 'Paid'].map(status => (
                    <label key={status} className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        checked={newStatus === status}
                        onChange={() => setNewStatus(status)}
                        className="text-amber-600 focus:ring-amber-500"
                      />
                      {status}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">Special Directives (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. VIP Priority Lounge, Gluten-Free"
                  value={newDirectives}
                  onChange={(e) => setNewDirectives(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none transition-all"
                />
              </div>

              <div className="pt-4 border-t border-stone-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-stone-200 rounded-lg text-xs font-semibold text-stone-600 hover:bg-stone-50 active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold shadow active:scale-95 transition-all"
                >
                  Confirm & Create
                </button>
              </div>
              </fieldset>
            </form>
          </div>
        </div>
      )}

      {/* Edit Booking Overlay Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-stone-200 rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in duration-200">
            <div className="flex justify-between items-center pb-4 border-b border-stone-100">
              <h3 className="text-base font-bold text-stone-900">Edit Client Reservation</h3>
              <button 
                onClick={() => setShowEditModal(false)}
                className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 cursor-pointer"
              >
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleSaveEditBooking} className="space-y-4 pt-4">
              {!canWriteBooking && <ReadOnlyBanner message="View-only mode — you can view but not edit bookings" />}
              <fieldset disabled={!canWriteBooking}>
              <div>
                <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">Client Full Name</label>
                <select
                  required
                  value={editClient}
                  onChange={(e) => setEditClient(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none transition-all"
                >
                  <option value="">Select a client...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.name}>{c.name} ({c.id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">Travel Package</label>
                <select
                  required
                  value={editPackage}
                  onChange={(e) => {
                    const pkgName = e.target.value
                    setEditPackage(pkgName)
                    const selectedPkg = packages.find(p => p.name === pkgName)
                    if (selectedPkg) {
                      const guests = parseInt(editGuests) || 1
                      setEditAmount((selectedPkg.basePrice * guests).toString())
                    }
                  }}
                  className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none transition-all"
                >
                  <option value="">Select a package...</option>
                  {packages.map(p => (
                    <option key={p.id} value={p.name}>{p.name} ({p.duration} - ₹{p.basePrice})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">Amount (INR)</label>
                  <input
                    type="number"
                    required
                    placeholder="4500"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">Discount (INR)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={editDiscount}
                    onChange={(e) => setEditDiscount(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">Guests</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editGuests}
                    onChange={(e) => {
                      setEditGuests(e.target.value)
                      const selectedPkg = packages.find(p => p.name === editPackage)
                      if (selectedPkg) {
                        const guests = parseInt(e.target.value) || 1
                        setEditAmount((selectedPkg.basePrice * guests).toString())
                      }
                    }}
                    className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">Departure Date</label>
                  <input
                    type="text"
                    placeholder="DD/MM/YYYY"
                    required
                    value={formatDateDisplay(editDate)}
                    onChange={(e) => setEditDate(parseDateDisplay(e.target.value))}
                    className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">Status</label>
                <div className="flex gap-4">
                  {['Pending', 'Paid'].map(status => (
                    <label key={status} className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="radio"
                        name="editStatus"
                        checked={editStatus === status}
                        onChange={() => setEditStatus(status)}
                        className="text-amber-600 focus:ring-amber-500"
                      />
                      {status}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">Special Directives (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. VIP Priority Lounge, Gluten-Free"
                  value={editDirectives}
                  onChange={(e) => setEditDirectives(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none transition-all"
                />
              </div>

              <div className="pt-4 border-t border-stone-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-stone-200 rounded-lg text-xs font-semibold text-stone-600 hover:bg-stone-50 active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold shadow active:scale-95 transition-all"
                >
                  Save Changes
                </button>
              </div>
              </fieldset>
            </form>
          </div>
        </div>
      )}

      {/* Delete Reservation Confirmation Modal */}
      {bookingToDelete && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-stone-200 rounded-2xl shadow-xl w-full max-w-sm p-6 animate-in zoom-in duration-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center border border-rose-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-stone-900">
                {user && roleHas(user.role, 'write:bookings') && !roleHas(user.role, 'delete:bookings') ? 'Request Deletion' : 'Delete Reservation'}
              </h3>
            </div>
            
            <p className="text-xs text-stone-500 leading-normal">
              {user && roleHas(user.role, 'write:bookings') && !roleHas(user.role, 'delete:bookings') ? (
                <>Submit a request to delete booking <strong className="text-stone-800 font-bold">{bookingToDelete.id}</strong> for <strong className="text-stone-800 font-bold">{bookingToDelete.client}</strong>? An admin must approve this before it takes effect.</>
              ) : (
                <>Are you sure you want to permanently delete booking <strong className="text-stone-800 font-bold">{bookingToDelete.id}</strong> for <strong className="text-stone-800 font-bold">{bookingToDelete.client}</strong>? This will release the package slot and cannot be undone.</>
              )}
            </p>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBookingToDelete(null)}
                className="px-4 py-2 border border-stone-200 rounded-lg text-xs font-semibold text-stone-600 hover:bg-stone-50 active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteBooking}
                className={`px-4 py-2 text-white rounded-lg text-xs font-bold shadow active:scale-95 transition-all ${
                  user && roleHas(user.role, 'write:bookings') && !roleHas(user.role, 'delete:bookings')
                    ? 'bg-amber-600 hover:bg-amber-500'
                    : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {user && roleHas(user.role, 'write:bookings') && !roleHas(user.role, 'delete:bookings') ? 'Request Approval' : 'Delete Booking'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

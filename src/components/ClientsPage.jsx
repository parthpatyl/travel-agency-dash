import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const DEFAULT_AVATAR = `${API_URL}/assets/default-avatar.png`

const imgUrl = (url) => {
  if (!url) return DEFAULT_AVATAR
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `${API_URL}${url}`
}

const calculatePassportStatus = (expiresStr) => {
  if (!expiresStr || expiresStr === 'Pending' || expiresStr === 'Not Listed') return 'Pending'
  const expDate = new Date(expiresStr)
  if (isNaN(expDate.getTime())) return 'Pending'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  expDate.setHours(0, 0, 0, 0)
  if (expDate < today) return 'Expired'
  const sixMonthsLater = new Date(today)
  sixMonthsLater.setMonth(today.getMonth() + 6)
  if (expDate <= sixMonthsLater) return 'Expiring Soon'
  return 'Valid'
}

export default function ClientsPage({ clients, setClients, bookings, addNotification, initialSelectedClientId, onSelectClient, onBookForClient }) {
  const [search, setSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState(() => {
    if (initialSelectedClientId) {
      return clients.find(c => c.id === initialSelectedClientId) || null
    }
    return null
  })

  useEffect(() => {
    if (initialSelectedClientId) {
      const found = clients.find(c => c.id === initialSelectedClientId)
      if (found && (!selectedClient || selectedClient.id !== initialSelectedClientId)) {
        setSelectedClient(found)
      }
    }
  }, [initialSelectedClientId, clients])

  useEffect(() => {
    if (onSelectClient) {
      onSelectClient(selectedClient ? selectedClient.id : null)
    }
  }, [selectedClient, onSelectClient])
  const [showAddForm, setShowAddForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [logClient, setLogClient] = useState(null)
  const [logText, setLogText] = useState('')

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return dateStr
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

  const getClientStats = (clientName) => {
    const clientBookings = bookings.filter(b => b.client.toLowerCase() === clientName.toLowerCase())
    const currentCount = clientBookings.length
    const currentVolume = clientBookings.reduce((sum, b) => sum + (Number(b.amount) || 0), 0)
    
    let nextTrip = 'None scheduled'
    const futureBookings = [...clientBookings].sort((a, b) => new Date(a.date) - new Date(b.date))
    if (futureBookings.length > 0) {
      nextTrip = `${futureBookings[0].package} (${futureBookings[0].date})`
    }
    
    return {
      count: currentCount,
      volume: currentVolume,
      nextTrip
    }
  }

  const clientsWithStats = clients.map(client => {
    const stats = getClientStats(client.name)
    const totalCount = (client.historicalBookingsCount ?? 0) + stats.count
    const totalLtv = (client.historicalLtv ?? 0) + stats.volume
    const currentPassport = client.passport ?? { number: 'Pending', expires: 'Pending', status: 'Valid' }
    const dynamicPassportStatus = calculatePassportStatus(currentPassport.expires)
    return {
      ...client,
      bookingsCount: totalCount,
      ltv: `₹${totalLtv.toLocaleString('en-IN')}`,
      nextTrip: stats.nextTrip,
      passport: {
        ...currentPassport,
        status: dynamicPassportStatus !== 'Pending' ? dynamicPassportStatus : (currentPassport.status ?? 'Valid')
      }
    }
  })


  // New Client Creation Form States
  const [newName, setNewName] = useState('')
  const [newAvatar, setNewAvatar] = useState(DEFAULT_AVATAR)
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [prefAirline, setPrefAirline] = useState('')
  const [prefSeat, setPrefSeat] = useState('Window')
  const [prefRoom, setPrefRoom] = useState('')
  const [prefDietary, setPrefDietary] = useState('None')
  const [passNo, setPassNo] = useState('')
  const [passExp, setPassExp] = useState('')
  const [visaCountry, setVisaCountry] = useState('')
  const [visaExp, setVisaExp] = useState('')
  const [visaClass, setVisaClass] = useState('')
  const [emergName, setEmergName] = useState('')
  const [emergPhone, setEmergPhone] = useState('')
  const [emergRelation, setEmergRelation] = useState('')
  const [walletAmt, setWalletAmt] = useState('0')
  const [agentNotes, setAgentNotes] = useState('')

  // Edit Client Form States
  const [editName, setEditName] = useState('')
  const [editAvatar, setEditAvatar] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editPrefAirline, setEditPrefAirline] = useState('')
  const [editPrefSeat, setEditPrefSeat] = useState('Window')
  const [editPrefRoom, setEditPrefRoom] = useState('')
  const [editPrefDietary, setEditPrefDietary] = useState('None')
  const [editPassNo, setEditPassNo] = useState('')
  const [editPassExp, setEditPassExp] = useState('')
  const [editVisaCountry, setEditVisaCountry] = useState('')
  const [editVisaExp, setEditVisaExp] = useState('')
  const [editVisaClass, setEditVisaClass] = useState('')
  const [editEmergName, setEditEmergName] = useState('')
  const [editEmergPhone, setEditEmergPhone] = useState('')
  const [editEmergRelation, setEditEmergRelation] = useState('')
  const [editWalletAmt, setEditWalletAmt] = useState('0')
  const [editAgentNotes, setEditAgentNotes] = useState('')

  const handleAvatarUpload = async (e, isEdit = false) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      if (addNotification) addNotification('File size exceeds the 5MB limit!', 'warning')
      return
    }

    const formData = new FormData()
    formData.append('image', file)

    try {
      if (addNotification) addNotification('Uploading avatar...', 'info')
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
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
      if (isEdit) {
        setEditAvatar(data.imageUrl)
      } else {
        setNewAvatar(data.imageUrl)
      }
      if (addNotification) addNotification('Avatar uploaded successfully!', 'success')
    } catch (err) {
      console.error(err)
      if (addNotification) addNotification(err.message || 'Avatar upload failed', 'error')
    }
  }

  const handleAddClient = (e) => {
    e.preventDefault()
    if (!newName.trim()) {
      if (addNotification) addNotification('Please enter the client\'s name.', 'warning')
      return
    }
    if (!newEmail.trim()) {
      if (addNotification) addNotification('Please enter the client\'s email address.', 'warning')
      return
    }
    if (!/\S+@\S+\.\S+/.test(newEmail)) {
      if (addNotification) addNotification('Please enter a valid email address.', 'warning')
      return
    }
    if (!newPhone.trim()) {
      if (addNotification) addNotification('Please enter the client\'s phone number.', 'warning')
      return
    }
    if (!/^[+0-9\s-()]{7,20}$/.test(newPhone.trim())) {
      if (addNotification) addNotification('Please enter a valid phone number (at least 7 digits).', 'warning')
      return
    }
    const parsedWallet = parseFloat(walletAmt ?? '0')
    if (isNaN(parsedWallet) || parsedWallet < 0) {
      if (addNotification) addNotification('Initial travel credit must be a non-negative number.', 'warning')
      return
    }
    if (passNo.trim() && !passExp) {
      if (addNotification) addNotification('Please provide the passport expiry date.', 'warning')
      return
    }
    if (passExp && !passNo.trim()) {
      if (addNotification) addNotification('Please provide the passport number.', 'warning')
      return
    }
    if (visaCountry.trim() && !visaExp) {
      if (addNotification) addNotification('Please provide the visa expiry date.', 'warning')
      return
    }
    if (visaExp && !visaCountry.trim()) {
      if (addNotification) addNotification('Please provide the visa target country.', 'warning')
      return
    }
    if (emergPhone.trim() && !/^[+0-9\s-()]{7,20}$/.test(emergPhone.trim())) {
      if (addNotification) addNotification('Please enter a valid emergency contact phone number.', 'warning')
      return
    }

    const calculatedStatus = calculatePassportStatus(passExp)

    const newClientObj = {
      id: `C-${crypto.randomUUID()}`,
      name: newName,
      email: newEmail,
      phone: newPhone,
      status: 'Active',
      tier: 'Silver',
      ltv: '₹0',
      bookingsCount: 0,
      avatar: newAvatar,
      preferences: {
        airline: prefAirline || 'Standard Carrier',
        seat: prefSeat,
        room: prefRoom || 'Standard King',
        dietary: prefDietary
      },
      passport: {
        number: passNo || 'Pending',
        expires: passExp || 'Pending',
        status: calculatedStatus
      },
      visa: {
        country: visaCountry || 'Pending',
        expires: visaExp || 'Pending',
        class: visaClass || 'Tourist'
      },
      emergencyContact: {
        name: emergName || 'Not Listed',
        phone: emergPhone || 'Not Listed',
        relation: emergRelation || 'Not Listed'
      },
      walletBalance: parseFloat(walletAmt) || 0,
      notes: agentNotes || 'No notes added yet.',
      lastContact: new Date().toISOString().split('T')[0],
      nextTrip: 'None scheduled',
      logs: [
        { time: new Date().toISOString().replace('T', ' ').substring(0, 16), text: 'System: Client profile initialized' }
      ]
    }

    setClients([newClientObj, ...clients])
    setSelectedClient(newClientObj)
    setShowAddForm(false)
    if (addNotification) {
      addNotification(`Client ${newClientObj.name} initialized successfully`, 'success')
    }

    // Reset creation fields
    setNewName('')
    setNewAvatar(DEFAULT_AVATAR)
    setNewEmail('')
    setNewPhone('')
    setPrefAirline('')
    setPrefSeat('Window')
    setPrefRoom('')
    setPrefDietary('None')
    setPassNo('')
    setPassExp('')
    setVisaCountry('')
    setVisaExp('')
    setVisaClass('')
    setEmergName('')
    setEmergPhone('')
    setEmergRelation('')
    setWalletAmt('0')
    setAgentNotes('')
  }

  const handleOpenEdit = (client) => {
    setEditName(client.name)
    setEditAvatar(client.avatar || '')
    setEditEmail(client.email)
    setEditPhone(client.phone)
    setEditPrefAirline(client.preferences?.airline || '')
    setEditPrefSeat(client.preferences?.seat || 'Window')
    setEditPrefRoom(client.preferences?.room || '')
    setEditPrefDietary(client.preferences?.dietary || 'None')
    setEditPassNo(client.passport?.number || '')
    setEditPassExp(client.passport?.expires || '')
    setEditVisaCountry(client.visa?.country || '')
    setEditVisaExp(client.visa?.expires || '')
    setEditVisaClass(client.visa?.class || '')
    setEditEmergName(client.emergencyContact?.name || '')
    setEditEmergPhone(client.emergencyContact?.phone || '')
    setEditEmergRelation(client.emergencyContact?.relation || '')
    setEditWalletAmt(String(client.walletBalance || 0))
    setEditAgentNotes(client.notes || '')
    setShowEditForm(true)
  }

  const handleSaveEdit = (e) => {
    e.preventDefault()
    if (!editName.trim()) {
      if (addNotification) addNotification('Please enter the client\'s name.', 'warning')
      return
    }
    if (!editEmail.trim()) {
      if (addNotification) addNotification('Please enter the client\'s email address.', 'warning')
      return
    }
    if (!/\S+@\S+\.\S+/.test(editEmail)) {
      if (addNotification) addNotification('Please enter a valid email address.', 'warning')
      return
    }
    if (!editPhone.trim()) {
      if (addNotification) addNotification('Please enter the client\'s phone number.', 'warning')
      return
    }
    if (!/^[+0-9\s-()]{7,20}$/.test(editPhone.trim())) {
      if (addNotification) addNotification('Please enter a valid phone number (at least 7 digits).', 'warning')
      return
    }
    const parsedWallet = parseFloat(editWalletAmt ?? '0')
    if (isNaN(parsedWallet) || parsedWallet < 0) {
      if (addNotification) addNotification('Travel wallet credit must be a non-negative number.', 'warning')
      return
    }
    if (editPassNo.trim() && !editPassExp) {
      if (addNotification) addNotification('Please provide the passport expiry date.', 'warning')
      return
    }
    if (editPassExp && !editPassNo.trim()) {
      if (addNotification) addNotification('Please provide the passport number.', 'warning')
      return
    }
    if (editVisaCountry.trim() && !editVisaExp) {
      if (addNotification) addNotification('Please provide the visa expiry date.', 'warning')
      return
    }
    if (editVisaExp && !editVisaCountry.trim()) {
      if (addNotification) addNotification('Please provide the visa target country.', 'warning')
      return
    }
    if (editEmergPhone.trim() && !/^[+0-9\s-()]{7,20}$/.test(editEmergPhone.trim())) {
      if (addNotification) addNotification('Please enter a valid emergency contact phone number.', 'warning')
      return
    }

    const calculatedStatus = calculatePassportStatus(editPassExp)

    const updated = {
      ...selectedClient,
      name: editName,
      email: editEmail,
      phone: editPhone,
      avatar: editAvatar,
      preferences: {
        airline: editPrefAirline || 'Standard Carrier',
        seat: editPrefSeat,
        room: editPrefRoom || 'Standard King',
        dietary: editPrefDietary
      },
      passport: {
        number: editPassNo || 'Pending',
        expires: editPassExp || 'Pending',
        status: calculatedStatus
      },
      visa: {
        country: editVisaCountry || 'Pending',
        expires: editVisaExp || 'Pending',
        class: editVisaClass || 'Tourist'
      },
      emergencyContact: {
        name: editEmergName || 'Not Listed',
        phone: editEmergPhone || 'Not Listed',
        relation: editEmergRelation || 'Not Listed'
      },
      walletBalance: parseFloat(editWalletAmt) || 0,
      notes: editAgentNotes,
      logs: [
        { time: new Date().toISOString().replace('T', ' ').substring(0, 16), text: 'System: Client profile details updated by agent' },
        ...selectedClient.logs
      ]
    }

    setClients(clients.map(c => c.id === selectedClient.id ? updated : c))
    setSelectedClient(updated)
    setShowEditForm(false)
    if (addNotification) {
      addNotification(`Client ${updated.name} updated successfully`, 'success')
    }
  }

  const [clientToDelete, setClientToDelete] = useState(null)

  const handleDeleteClient = (clientId) => {
    setClientToDelete(clientId)
  }

  const confirmDeleteClient = () => {
    if (!clientToDelete) return
    const deletedClient = clients.find(c => c.id === clientToDelete)
    setClients(clients.filter(c => c.id !== clientToDelete))
    setSelectedClient(null)
    setClientToDelete(null)
    if (addNotification && deletedClient) {
      addNotification(`Client ${deletedClient.name} deleted successfully`, 'info')
    }
  }


  const filtered = clientsWithStats.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.id.toLowerCase().includes(search.toLowerCase())
  )

  const getTierColor = (tier) => {
    switch (tier) {
      case 'Platinum':
        return 'bg-purple-50 text-purple-755 border-purple-200/50'
      case 'Gold':
        return 'bg-amber-50 text-amber-700 border-amber-200/50'
      case 'Corporate':
        return 'bg-blue-50 text-blue-700 border-blue-200/50'
      default:
        return 'bg-stone-100 text-stone-700 border-stone-200/50'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">Customer Accounts & CRM</h2>
          <p className="text-xs text-stone-400">Access profiles, travel preferences, and compliance documentation.</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-sm active:scale-[0.98] transition-all duration-300 flex items-center gap-2 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          Add Client Profile
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Profiles Grid (2/3 width) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search bar */}
          <div className="bg-white border border-stone-200/80 rounded-2xl p-4 shadow-sm relative">
            <span className="absolute inset-y-0 left-4 pl-3.5 flex items-center pointer-events-none">
              <svg className="h-4.5 w-4.5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search clients by name, ID, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-xl py-2.5 pl-12 pr-4 text-xs text-stone-800 outline-none transition-all duration-300"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(client => (
              <div
                key={client.id}
                onClick={() => setSelectedClient(client)}
                className={`bg-white border border-stone-200 rounded-2xl p-5 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden ${
                  selectedClient?.id === client.id ? 'ring-1 ring-amber-500 border-amber-300' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-stone-100 p-0.5 shadow-inner">
                    <img src={imgUrl(client.avatar)} alt={client.name} className="w-full h-full object-cover rounded-[10px]" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-stone-900 leading-tight group-hover:text-amber-700 transition-colors">
                      {client.name}
                    </h3>
                    <p className="text-[10px] text-stone-400 font-semibold">{client.id}</p>
                    <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${getTierColor(client.tier)}`}>
                      {client.tier}
                    </span>
                  </div>
                </div>

                {/* Last Contact and Next Trip block */}
                <div className="mt-3.5 space-y-1.5 text-[11px] text-stone-600 border-t border-stone-100/60 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-stone-400 font-semibold">Last Contact:</span>
                    <span className="font-semibold text-stone-800">{formatDateDisplay(client.lastContact)}</span>
                  </div>
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-stone-400 font-semibold shrink-0">Next Trip:</span>
                    <span className="font-medium text-stone-800 truncate max-w-[150px]" title={client.nextTrip}>
                      {client.nextTrip || 'None scheduled'}
                    </span>
                  </div>
                </div>

                {/* Bottom summaries with LTV */}
                <div className="grid grid-cols-3 gap-2 border-t border-stone-100 mt-3 pt-3 text-center">
                  <div>
                    <span className="text-[9px] font-bold text-stone-400 block uppercase">Bookings</span>
                    <span className="text-xs font-extrabold text-stone-800">{client.bookingsCount}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-stone-400 block uppercase">LTV</span>
                    <span className="text-xs font-extrabold text-amber-700">{client.ltv}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-stone-400 block uppercase">Status</span>
                    <span className="text-xs font-extrabold text-emerald-600">{client.status}</span>
                  </div>
                </div>

                {/* Quick Actions Hover Overlay */}
                <div className="absolute inset-0 bg-[#FAF9F5]/90 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-2.5 backdrop-blur-[2px]">
                  <a
                    href={`tel:${client.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="w-9 h-9 rounded-xl bg-white border border-stone-200 text-stone-600 hover:text-amber-700 hover:border-amber-300 shadow flex items-center justify-center transition-all hover:scale-105"
                    title="Call Client"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </a>
                  <a
                    href={`mailto:${client.email}`}
                    onClick={(e) => e.stopPropagation()}
                    className="w-9 h-9 rounded-xl bg-white border border-stone-200 text-stone-600 hover:text-amber-700 hover:border-amber-300 shadow flex items-center justify-center transition-all hover:scale-105"
                    title="Email Client"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </a>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setLogClient(client)
                      setLogText('')
                    }}
                    className="w-9 h-9 rounded-xl bg-white border border-stone-200 text-stone-600 hover:text-amber-700 hover:border-amber-300 shadow flex items-center justify-center transition-all hover:scale-105 cursor-pointer"
                    title="Add Note Log"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Client CRM Panel (1/3 width) */}
        <div className="lg:col-span-1">
          {selectedClient ? (
            <div className="bg-white border border-stone-200/80 rounded-2xl p-5 shadow-sm space-y-6 animate-in fade-in duration-200 sticky top-24">
              {/* Header profile info */}
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl p-0.5 bg-stone-100 shadow-sm">
                    <img src={imgUrl(selectedClient.avatar)} className="w-full h-full object-cover rounded-[8px]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900 leading-tight">{selectedClient.name}</h3>
                    <p className="text-[10px] text-stone-400 font-semibold">{selectedClient.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(selectedClient)}
                    className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500 hover:text-amber-700 transition-colors cursor-pointer"
                    title="Edit Profile"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button 
                    onClick={() => setSelectedClient(null)}
                    className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors"
                  >
                    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Prominent Contact Info Block */}
              <div className="bg-stone-50 border border-stone-200/70 p-4 rounded-xl space-y-2.5">
                <span className="text-[9px] text-stone-400 font-bold uppercase block -mb-1">Contact Channels</span>
                <div className="flex items-center gap-2.5 text-xs text-stone-800">
                  <svg className="w-4 h-4 text-stone-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <a href={`mailto:${selectedClient.email}`} className="text-amber-700 hover:underline font-semibold">{selectedClient.email}</a>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-stone-800">
                  <svg className="w-4 h-4 text-stone-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <a href={`tel:${selectedClient.phone}`} className="font-semibold hover:underline">{selectedClient.phone}</a>
                </div>
              </div>

              {/* Financial Metrics / Wallets */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#FAF9F5] border border-stone-200/50 p-3 rounded-xl text-center">
                  <span className="text-[9px] text-stone-400 font-bold uppercase block mb-1">Lifetime Value (LTV)</span>
                  <span className="text-sm font-extrabold text-stone-900">{selectedClient.ltv}</span>
                </div>
                <div className="bg-[#FAF9F5] border border-stone-200/50 p-3 rounded-xl text-center">
                  <span className="text-[9px] text-stone-400 font-bold uppercase block mb-1">Travel Wallet</span>
                  <span className="text-sm font-extrabold text-amber-700">₹{Number(selectedClient.walletBalance || 0).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
              </div>

              {/* Preferences Grid */}
              <div className="border-t border-stone-100 pt-4 space-y-3">
                <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider">Client Preferences Matrix</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#FAF9F5]/40 border border-stone-200/40 p-2.5 rounded-xl">
                    <span className="text-[9px] text-stone-400 font-bold uppercase block mb-0.5">Pref Airline</span>
                    <span className="text-xs font-semibold text-stone-800">{selectedClient.preferences.airline}</span>
                  </div>
                  <div className="bg-[#FAF9F5]/40 border border-stone-200/40 p-2.5 rounded-xl">
                    <span className="text-[9px] text-stone-400 font-bold uppercase block mb-0.5">Seat Class</span>
                    <span className="text-xs font-semibold text-stone-800">{selectedClient.preferences.seat}</span>
                  </div>
                  <div className="bg-[#FAF9F5]/40 border border-stone-200/40 p-2.5 rounded-xl">
                    <span className="text-[9px] text-stone-400 font-bold uppercase block mb-0.5">Room Pref</span>
                    <span className="text-xs font-semibold text-stone-800">{selectedClient.preferences.room}</span>
                  </div>
                  <div className="bg-[#FAF9F5]/40 border border-stone-200/40 p-2.5 rounded-xl">
                    <span className="text-[9px] text-stone-400 font-bold uppercase block mb-0.5">Dietary Details</span>
                    <span className={`text-xs font-semibold ${selectedClient.preferences.dietary !== 'None' ? 'text-amber-700' : 'text-stone-800'}`}>
                      {selectedClient.preferences.dietary}
                    </span>
                  </div>
                </div>
              </div>

              {/* Compliance Documents Vault (Passports & Visas) */}
              <div className="border-t border-stone-100 pt-4 space-y-3">
                <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider">Compliance Documents Vault</h4>
                <div className="grid grid-cols-1 gap-2.5">
                  <div className="p-3 rounded-xl border border-stone-200 bg-stone-50/20 flex justify-between items-center">
                    <div>
                      <span className="text-[9px] text-stone-400 font-bold uppercase block">Passport Scans</span>
                      <span className="text-xs font-semibold text-stone-800">No: {selectedClient.passport.number}</span>
                      <span className="text-[10px] text-stone-500 block">Expires: {formatDateDisplay(selectedClient.passport.expires)}</span>
                    </div>
                    <span className={`px-2 py-0.5 text-[9px] font-bold rounded-lg border ${
                      selectedClient.passport.status === 'Expiring Soon'
                        ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {selectedClient.passport.status}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl border border-stone-200 bg-stone-50/20 flex justify-between items-center">
                    <div>
                      <span className="text-[9px] text-stone-400 font-bold uppercase block">Visa Clearances</span>
                      <span className="text-xs font-semibold text-stone-800">Class: {selectedClient.visa?.class || 'Tourist'}</span>
                      <span className="text-[10px] text-stone-500 block">Country: {selectedClient.visa?.country || 'Pending'}</span>
                      <span className="text-[10px] text-stone-500 block">Expires: {formatDateDisplay(selectedClient.visa?.expires) || 'Pending'}</span>
                    </div>
                    <span className="px-2 py-0.5 text-[9px] font-bold rounded-lg border bg-stone-100 text-stone-700 border-stone-200">
                      Standard
                    </span>
                  </div>
                </div>
              </div>

              {/* Emergency Compliance */}
              <div className="border-t border-stone-100 pt-4 space-y-2">
                <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider">Emergency Contact</h4>
                <div className="p-3 rounded-xl border border-stone-200/80 bg-stone-50/10 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-stone-400">Full Name:</span>
                    <span className="font-bold text-stone-800">{selectedClient.emergencyContact?.name || 'Not Listed'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Phone No:</span>
                    <a href={`tel:${selectedClient.emergencyContact?.phone}`} className="font-semibold text-amber-700 hover:underline">
                      {selectedClient.emergencyContact?.phone || 'Not Listed'}
                    </a>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Relationship:</span>
                    <span className="font-medium text-stone-600">{selectedClient.emergencyContact?.relation || 'Not Listed'}</span>
                  </div>
                </div>
              </div>

              {/* Notes Context Panel */}
              <div className="border-t border-stone-100 pt-4 space-y-2">
                <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider">Agent Directives & Notes</h4>
                <div className="p-3 bg-amber-50/10 border border-amber-500/10 rounded-xl text-xs text-stone-600 leading-relaxed italic whitespace-pre-wrap">
                  {selectedClient.notes || 'No operational notes entered.'}
                </div>
              </div>

              {/* Book Trip Quick Action */}
              {onBookForClient && (
                <div className="border-t border-stone-100 pt-4">
                  <button
                    onClick={() => onBookForClient(selectedClient.name)}
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-sm active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Book Trip for {selectedClient.name}
                  </button>
                </div>
              )}

              {/* Activity Timeline */}
              <div className="border-t border-stone-100 pt-4 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider">Activity Notes Log</h4>
                  <button
                    onClick={() => {
                      setLogClient(selectedClient)
                      setLogText('')
                    }}
                    className="text-[10px] font-bold text-amber-700 hover:text-amber-600 flex items-center gap-1 cursor-pointer transition-all hover:scale-105"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Add Note
                  </button>
                </div>
                
                <div className="max-h-72 overflow-y-auto pr-1 space-y-1">
                  {selectedClient.logs.map((log, index) => {
                    const isSystem = log.text.includes('System:') || log.text.includes('initialized')
                    const isBooking = log.text.includes('Booking') || log.text.includes('BK-')
                    const isUpdate = log.text.includes('updated') || log.text.includes('details') || log.text.includes('details updated')
                    
                    let iconBg = 'bg-stone-100 text-stone-600 border-stone-200'
                    let iconSvg = (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    )

                    if (isSystem) {
                      iconBg = 'bg-blue-50 text-blue-600 border-blue-200/60'
                      iconSvg = (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )
                    } else if (isBooking) {
                      iconBg = 'bg-emerald-50 text-emerald-600 border-emerald-200/60'
                      iconSvg = (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      )
                    } else if (isUpdate) {
                      iconBg = 'bg-amber-50 text-amber-600 border-amber-200/60'
                      iconSvg = (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      )
                    }

                    return (
                      <div key={index} className="relative pl-7 pb-4 last:pb-1">
                        {/* Timeline Connector Line */}
                        {index < selectedClient.logs.length - 1 && (
                          <span className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-stone-200/50"></span>
                        )}
                        {/* Timeline Icon */}
                        <span className={`absolute left-0 top-1 w-6 h-6 rounded-full border flex items-center justify-center shadow-sm ${iconBg}`}>
                          {iconSvg}
                        </span>
                        
                        <div className="bg-[#FAF9F5]/45 border border-stone-200/40 rounded-xl p-2.5 ml-1 space-y-1 hover:bg-[#FAF9F5]/80 transition-all">
                          <div className="flex justify-between items-center">
                            <span className="text-[9px] text-stone-400 font-bold">{formatDateDisplay(log.time)}</span>
                            <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                              isSystem ? 'bg-blue-50/50 text-blue-600 border-blue-100' :
                              isBooking ? 'bg-emerald-50/50 text-emerald-600 border-emerald-100' :
                              isUpdate ? 'bg-amber-50/50 text-amber-600 border-amber-100' :
                              'bg-stone-50 text-stone-550 border-stone-100'
                            }`}>
                              {isSystem ? 'System' : isBooking ? 'Booking' : isUpdate ? 'Update' : 'Note'}
                            </span>
                          </div>
                          <p className="text-stone-700 text-[11px] leading-relaxed font-semibold">{log.text}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Delete Client Button */}
              <div className="border-t border-stone-100 pt-4">
                <button
                  onClick={() => handleDeleteClient(selectedClient.id)}
                  className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 hover:border-rose-350 rounded-xl text-xs font-bold shadow-sm active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Client Profile
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-stone-50 border border-dashed border-stone-300/60 rounded-2xl p-12 text-center text-stone-400 text-xs">
              <svg className="w-10 h-10 mx-auto text-stone-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              Select a customer from the grid to access detailed traveler preferences and activity history logs.
            </div>
          )}
        </div>
      </div>

      {/* Add Client Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-stone-200 rounded-2xl shadow-xl w-full max-w-lg p-6 animate-in zoom-in duration-200">
            <div className="flex justify-between items-center pb-4 border-b border-stone-100">
              <h3 className="text-base font-bold text-stone-900">Add New CRM Profile</h3>
              <button 
                onClick={() => setShowAddForm(false)}
                className="p-1 rounded-lg hover:bg-stone-100 text-stone-400"
              >
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleAddClient} className="space-y-4 pt-4 max-h-[70vh] overflow-y-auto pr-1">
              {/* Avatar Upload */}
              <div className="flex items-center gap-4 p-3 bg-stone-50/50 border border-stone-200 rounded-xl">
                <div className="w-12 h-12 rounded-xl bg-stone-100 p-0.5 shadow-inner shrink-0 relative group overflow-hidden">
                  <img src={newAvatar} alt="Avatar Preview" className="w-full h-full object-cover rounded-[10px]" />
                </div>
                <div className="flex-grow">
                  <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Client Photo / Avatar</label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleAvatarUpload(e, false)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <button
                      type="button"
                      className="px-3 py-1.5 bg-white border border-stone-200 hover:bg-stone-50 rounded-lg text-xs font-semibold text-stone-600 transition-all cursor-pointer"
                    >
                      Choose Image
                    </button>
                    <span className="text-[9px] text-stone-400 ml-2">Max 5MB</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Full Name <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Email Address <span className="text-rose-500">*</span></label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. john@doe.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Contact Phone <span className="text-rose-500">*</span></label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +1 (555) 012-3456"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Initial Travel Credit (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 450"
                    value={walletAmt}
                    onChange={(e) => setWalletAmt(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none"
                  />
                </div>
              </div>

              {/* Preferences Section */}
              <div className="border-t border-stone-100 pt-3">
                <h4 className="text-xs font-bold text-stone-900 mb-2">Traveler Preferences Matrix</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Preferred Airline</label>
                    <input
                      type="text"
                      placeholder="e.g. Emirates"
                      value={prefAirline}
                      onChange={(e) => setPrefAirline(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Seat Option</label>
                    <select
                      value={prefSeat}
                      onChange={(e) => setPrefSeat(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none"
                    >
                      <option value="Window">Window</option>
                      <option value="Aisle">Aisle</option>
                      <option value="Middle">Middle (No preference)</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Lodging Preference</label>
                    <input
                      type="text"
                      placeholder="e.g. Suite / High Floor"
                      value={prefRoom}
                      onChange={(e) => setPrefRoom(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Dietary Restriction</label>
                    <select
                      value={prefDietary}
                      onChange={(e) => setPrefDietary(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none"
                    >
                      <option value="None">None</option>
                      <option value="Gluten-Free">Gluten-Free</option>
                      <option value="Vegetarian">Vegetarian</option>
                      <option value="Vegan">Vegan</option>
                      <option value="Nut Allergy">Nut Allergy</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Compliance Passport Section */}
              <div className="border-t border-stone-100 pt-3">
                <h4 className="text-xs font-bold text-stone-900 mb-2">Compliance Passport Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Passport Number</label>
                    <input
                      type="text"
                      placeholder="e.g. US4829103"
                      value={passNo}
                      onChange={(e) => setPassNo(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Passport Expiry Date</label>
                    <input
                      type="text"
                      placeholder="DD/MM/YYYY"
                      value={formatDateDisplay(passExp)}
                      onChange={(e) => setPassExp(parseDateDisplay(e.target.value))}
                      className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Visa Clearances Section */}
              <div className="border-t border-stone-100 pt-3">
                <h4 className="text-xs font-bold text-stone-900 mb-2">Active Visa Clearance</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Target Country</label>
                    <input
                      type="text"
                      placeholder="e.g. Japan"
                      value={visaCountry}
                      onChange={(e) => setVisaCountry(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Visa Expiry</label>
                    <input
                      type="text"
                      placeholder="DD/MM/YYYY"
                      value={formatDateDisplay(visaExp)}
                      onChange={(e) => setVisaExp(parseDateDisplay(e.target.value))}
                      className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Visa Class</label>
                    <input
                      type="text"
                      placeholder="e.g. B1/B2"
                      value={visaClass}
                      onChange={(e) => setVisaClass(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Emergency Contact Section */}
              <div className="border-t border-stone-100 pt-3">
                <h4 className="text-xs font-bold text-stone-900 mb-2">Emergency Contact Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Sarah Evans"
                      value={emergName}
                      onChange={(e) => setEmergName(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Phone Number</label>
                    <input
                      type="tel"
                      placeholder="e.g. +44 7946 000"
                      value={emergPhone}
                      onChange={(e) => setEmergPhone(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Relationship</label>
                    <input
                      type="text"
                      placeholder="e.g. Spouse"
                      value={emergRelation}
                      onChange={(e) => setEmergRelation(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Agent context Notes textfield */}
              <div className="border-t border-stone-100 pt-3">
                <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Agent Notes & Directives</label>
                <textarea
                  rows="3"
                  placeholder="Insert any relevant context here (e.g. preferred departure hours, room upgrades requests, allergy alerts...)"
                  value={agentNotes}
                  onChange={(e) => setAgentNotes(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none resize-none"
                ></textarea>
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
                  Create Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {showEditForm && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-stone-200 rounded-2xl shadow-xl w-full max-w-lg p-6 animate-in zoom-in duration-200">
            <div className="flex justify-between items-center pb-4 border-b border-stone-100">
              <h3 className="text-base font-bold text-stone-900">Edit Client CRM Profile</h3>
              <button 
                onClick={() => setShowEditForm(false)}
                className="p-1 rounded-lg hover:bg-stone-100 text-stone-400"
              >
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleSaveEdit} className="space-y-4 pt-4 max-h-[70vh] overflow-y-auto pr-1">
              {/* Avatar Upload */}
              <div className="flex items-center gap-4 p-3 bg-stone-50/50 border border-stone-200 rounded-xl">
                <div className="w-12 h-12 rounded-xl bg-stone-100 p-0.5 shadow-inner shrink-0 relative group overflow-hidden">
                  <img src={imgUrl(editAvatar)} alt="Avatar Preview" className="w-full h-full object-cover rounded-[10px]" />
                </div>
                <div className="flex-grow">
                  <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Client Photo / Avatar</label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleAvatarUpload(e, true)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <button
                      type="button"
                      className="px-3 py-1.5 bg-white border border-stone-200 hover:bg-stone-50 rounded-lg text-xs font-semibold text-stone-600 transition-all cursor-pointer"
                    >
                      Choose Image
                    </button>
                    <span className="text-[9px] text-stone-400 ml-2">Max 5MB</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Full Name <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Email Address <span className="text-rose-500">*</span></label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. john@doe.com"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Contact Phone <span className="text-rose-500">*</span></label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +1 (555) 012-3456"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Travel Wallet Credit (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 450"
                    value={editWalletAmt}
                    onChange={(e) => setEditWalletAmt(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none"
                  />
                </div>
              </div>

              {/* Preferences Section */}
              <div className="border-t border-stone-100 pt-3">
                <h4 className="text-xs font-bold text-stone-900 mb-2">Traveler Preferences Matrix</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Preferred Airline</label>
                    <input
                      type="text"
                      placeholder="e.g. Emirates"
                      value={editPrefAirline}
                      onChange={(e) => setEditPrefAirline(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Seat Option</label>
                    <select
                      value={editPrefSeat}
                      onChange={(e) => setEditPrefSeat(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none"
                    >
                      <option value="Window">Window</option>
                      <option value="Aisle">Aisle</option>
                      <option value="Middle">Middle (No preference)</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Lodging Preference</label>
                    <input
                      type="text"
                      placeholder="e.g. Suite / High Floor"
                      value={editPrefRoom}
                      onChange={(e) => setEditPrefRoom(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Dietary Restriction</label>
                    <select
                      value={editPrefDietary}
                      onChange={(e) => setEditPrefDietary(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none"
                    >
                      <option value="None">None</option>
                      <option value="Gluten-Free">Gluten-Free</option>
                      <option value="Vegetarian">Vegetarian</option>
                      <option value="Vegan">Vegan</option>
                      <option value="Nut Allergy">Nut Allergy</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Compliance Passport Section */}
              <div className="border-t border-stone-100 pt-3">
                <h4 className="text-xs font-bold text-stone-900 mb-2">Compliance Passport Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Passport Number</label>
                    <input
                      type="text"
                      placeholder="e.g. US4829103"
                      value={editPassNo}
                      onChange={(e) => setEditPassNo(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Passport Expiry Date</label>
                    <input
                      type="text"
                      placeholder="DD/MM/YYYY"
                      value={formatDateDisplay(editPassExp)}
                      onChange={(e) => setEditPassExp(parseDateDisplay(e.target.value))}
                      className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Visa Clearances Section */}
              <div className="border-t border-stone-100 pt-3">
                <h4 className="text-xs font-bold text-stone-900 mb-2">Active Visa Clearance</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Target Country</label>
                    <input
                      type="text"
                      placeholder="e.g. Japan"
                      value={editVisaCountry}
                      onChange={(e) => setEditVisaCountry(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Visa Expiry</label>
                    <input
                      type="text"
                      placeholder="DD/MM/YYYY"
                      value={formatDateDisplay(editVisaExp)}
                      onChange={(e) => setEditVisaExp(parseDateDisplay(e.target.value))}
                      className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Visa Class</label>
                    <input
                      type="text"
                      placeholder="e.g. B1/B2"
                      value={editVisaClass}
                      onChange={(e) => setEditVisaClass(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Emergency Contact Section */}
              <div className="border-t border-stone-100 pt-3">
                <h4 className="text-xs font-bold text-stone-900 mb-2">Emergency Contact Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Sarah Evans"
                      value={editEmergName}
                      onChange={(e) => setEditEmergName(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Phone Number</label>
                    <input
                      type="tel"
                      placeholder="e.g. +44 7946 000"
                      value={editEmergPhone}
                      onChange={(e) => setEditEmergPhone(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Relationship</label>
                    <input
                      type="text"
                      placeholder="e.g. Spouse"
                      value={editEmergRelation}
                      onChange={(e) => setEditEmergRelation(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Agent context Notes textfield */}
              <div className="border-t border-stone-100 pt-3">
                <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Agent Notes & Directives</label>
                <textarea
                  rows="3"
                  placeholder="Insert any relevant context here (e.g. preferred departure hours, room upgrades requests, allergy alerts...)"
                  value={editAgentNotes}
                  onChange={(e) => setEditAgentNotes(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none resize-none"
                ></textarea>
              </div>

              <div className="pt-4 border-t border-stone-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditForm(false)}
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
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {clientToDelete && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-stone-200 rounded-2xl shadow-xl w-full max-w-sm p-6 animate-in zoom-in duration-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center border border-rose-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-stone-900">Delete Client Profile</h3>
            </div>
            
            <p className="text-xs text-stone-500 leading-normal">
              Are you sure you want to permanently delete this client profile? All details, documents, and logs will be lost. This action cannot be undone.
            </p>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setClientToDelete(null)}
                className="px-4 py-2 border border-stone-200 rounded-lg text-xs font-semibold text-stone-600 hover:bg-stone-50 active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteClient}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold shadow active:scale-95 transition-all"
              >
                Delete Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Note Log Modal */}
      {logClient && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-stone-200 rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in duration-200">
            <div className="flex justify-between items-center pb-4 border-b border-stone-100">
              <h3 className="text-sm font-bold text-stone-900">Add Log Entry for {logClient.name}</h3>
              <button 
                onClick={() => setLogClient(null)}
                className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 cursor-pointer"
              >
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4 pt-4">
              <div>
                <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">Activity Notes</label>
                <textarea
                  rows="4"
                  required
                  placeholder="Enter customer call notes, booking updates, visa status checks..."
                  value={logText}
                  onChange={(e) => setLogText(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-800 outline-none resize-none transition-all"
                ></textarea>
              </div>
              
              <div className="pt-4 border-t border-stone-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setLogClient(null)}
                  className="px-4 py-2 border border-stone-200 rounded-lg text-xs font-semibold text-stone-600 hover:bg-stone-50 active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!logText.trim()) return
                    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16)
                    const updatedLogs = [{ time: timestamp, text: logText }, ...logClient.logs]
                    setClients(clients.map(c => c.id === logClient.id ? { ...c, logs: updatedLogs, lastContact: timestamp.split(' ')[0] } : c))
                    if (selectedClient?.id === logClient.id) {
                      setSelectedClient({ ...selectedClient, logs: updatedLogs, lastContact: timestamp.split(' ')[0] })
                    }
                    if (addNotification) {
                      addNotification(`Added activity log for ${logClient.name}`, 'success')
                    }
                    setLogClient(null)
                    setLogText('')
                  }}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold shadow active:scale-95 transition-all"
                >
                  Save Entry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

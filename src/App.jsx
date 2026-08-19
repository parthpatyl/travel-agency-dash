import { useState, useEffect, useRef } from 'react'
import BookingsPage from './components/BookingsPage'
import ClientsPage from './components/ClientsPage'
import PackagesPage from './components/PackagesPage'
import ReportsPage from './components/ReportsPage'
import SettingsPage from './components/SettingsPage'
import TestimonialsPage from './components/TestimonialsPage'
import TeamPage from './components/TeamPage'
import ApprovalsPage from './components/ApprovalsPage'
import LoginPage from './components/LoginPage'
import CorporatePackagesPage from './components/CorporatePackagesPage'
import CorporateLeadsPage from './components/CorporateLeadsPage'
import GroupDeparturesPage from './components/GroupDeparturesPage'
import EnquiriesPage from './components/EnquiriesPage'
import EnquiryDetailModal from './components/EnquiryDetailModal'
import logo from './assets/logo.png'
import { roleHas } from './utils/permissions'
import { 
  getQueue, 
  enqueueRequest, 
  clearQueue, 
  processSyncQueue, 
  checkServerHealth 
} from './utils/syncManager'

if (typeof globalThis.localStorage === 'undefined' || !globalThis.localStorage?.clear) {
  const store = new Map()
  const mockStorage = {
    getItem: (key) => store.get(key) || null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    get length() { return store.size },
    key: (i) => Array.from(store.keys())[i] || null,
  }
  globalThis.localStorage = mockStorage
  if (typeof window !== 'undefined') {
    window.localStorage = mockStorage
  }
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API_BASE_URL = `${API_URL}/api`;

const initialClients = []

const initialPackages = []

const initialSettings = {
  defaultMarkup: 15,
  defaultAgentSplit: 40,
  agencyName: '',
  agencyAddress: '',
  agencyPhone: '',
  agencyEmail: '',
  permissions: null,
  apis: null
}

const initialBookings = []

const initialTestimonials = []

const VALID_TABS = ['dashboard', 'enquiries', 'bookings', 'corporateLeads', 'clients', 'packages', 'reports', 'testimonials', 'settings', 'team', 'approvals', 'corporatePackages', 'groupDepartures']

function getTabFromHash() {
  const hash = window.location.hash.replace('#', '')
  return VALID_TABS.includes(hash) ? hash : 'dashboard'
}

function App() {
  const [activeTab, setActiveTabRaw] = useState(getTabFromHash)
  const [searchQuery, setSearchQuery] = useState('')
  const globalSearchInputRef = useRef(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedEnquiryIdForModal, setSelectedEnquiryIdForModal] = useState(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/enquiries\/([\w-]+)$/);
    return match ? match[1] : null;
  })
  const isPopstateRef = useRef(false)

  // Global Keyboard Shortcuts (⌘K / Ctrl+K for search, Esc to clear search / close dropdowns)
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        globalSearchInputRef.current?.focus()
      } else if (e.key === 'Escape') {
        if (searchQuery) setSearchQuery('')
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [searchQuery])

  // Wrap setActiveTab to push browser history entries and ping activity
  const setActiveTab = (tab) => {
    if (!VALID_TABS.includes(tab)) return
    setActiveTabRaw(tab)
    // Fire-and-forget ping to update last_active_at
    if (token) {
      fetch(`${API_URL}/api/auth/heartbeat`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } }).catch(() => {})
    }
    if (!isPopstateRef.current) {
      window.history.pushState({ tab }, '', `#${tab}`)
    }
    isPopstateRef.current = false
  }

  // Listen for browser back/forward
  useEffect(() => {
    // Set initial history entry
    const path = window.location.pathname;
    const match = path.match(/^\/enquiries\/([\w-]+)$/);
    if (match) {
      window.history.replaceState({ tab: 'dashboard', enquiryId: match[1] }, '', `/enquiries/${match[1]}`)
    } else {
      window.history.replaceState({ tab: getTabFromHash() }, '', `#${getTabFromHash()}`)
    }

    const handlePopState = (e) => {
      const tab = e.state?.tab || getTabFromHash()
      if (VALID_TABS.includes(tab)) {
        isPopstateRef.current = true
        setActiveTab(tab)
      }
      if (e.state?.enquiryId) {
        setSelectedEnquiryIdForModal(e.state.enquiryId)
      } else {
        setSelectedEnquiryIdForModal(null)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  
  // Auth State
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  
  const authHeaders = () => ({
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  })

  // Interactive Feature States
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [notificationsList, setNotificationsList] = useState([])
  const [toasts, setToasts] = useState([])
  const [selectedClientIdForCRM, setSelectedClientIdForCRM] = useState(null)
  const [bookingDraft, setBookingDraft] = useState(null)
  const [initialSelectedBookingId, setInitialSelectedBookingId] = useState(null)
  const [initialSelectedPackageId, setInitialSelectedPackageId] = useState(null)
  const [initialApprovalId, setInitialApprovalId] = useState(null)
  const [initialApprovalFilter, setInitialApprovalFilter] = useState('pending')

  // Server Status & Offline Sync States
  const [serverStatus, setServerStatus] = useState({ online: null, latency: null, lastChecked: '' })
  const [queueItems, setQueueItems] = useState([])
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0)

  // Lifted and Persisted States (Local state updated dynamically, synced with Database)
  const [clients, rawSetClients] = useState(initialClients)
  const [packages, rawSetPackages] = useState(initialPackages)
  const [settings, rawSetSettings] = useState(initialSettings)
  const [bookings, rawSetBookings] = useState(initialBookings)
  const [testimonials, rawSetTestimonials] = useState(initialTestimonials)
  const [corporatePackages, rawSetCorporatePackages] = useState([])
  const [groupDepartures, rawSetGroupDepartures] = useState([])

  // Refs for outside-click detection on dropdowns
  const notifRef = useRef(null)
  const profileRef = useRef(null)
  const statusRef = useRef(null)

  // Use refs to avoid closure staleness during async API updates
  const clientsRef = useRef(clients)
  const packagesRef = useRef(packages)
  const bookingsRef = useRef(bookings)
  const settingsRef = useRef(settings)
  const testimonialsRef = useRef(testimonials)
  const corporatePackagesRef = useRef(corporatePackages)
  const groupDeparturesRef = useRef(groupDepartures)

  // Holds the in-flight PUT controller so a fresh settings change cancels the prior one
  const settingsAbortRef = useRef(null)
  // Pending settings payload + timer id for debounced PUT
  const settingsDebounceRef = useRef({ timeoutId: null, pending: null })

  useEffect(() => { clientsRef.current = clients }, [clients])
  useEffect(() => { packagesRef.current = packages }, [packages])
  useEffect(() => { bookingsRef.current = bookings }, [bookings])
  useEffect(() => { settingsRef.current = settings }, [settings])
  useEffect(() => { testimonialsRef.current = testimonials }, [testimonials])
  useEffect(() => { corporatePackagesRef.current = corporatePackages }, [corporatePackages])
  useEffect(() => { groupDeparturesRef.current = groupDepartures }, [groupDepartures])

  // Setup functions for Health Check and Sync
  const performHealthAndSync = async (showNotificationOnSuccess = false) => {
    const status = await checkServerHealth(API_URL)
    const timeStr = new Date().toLocaleTimeString()
    setServerStatus({
      online: status.online,
      latency: status.latency,
      lastChecked: timeStr
    })

    if (status.online) {
      const currentQueue = getQueue()
      setQueueItems(currentQueue)
      if (currentQueue.length > 0) {
        setIsSyncing(true)
        await processSyncQueue(addNotification)
        setIsSyncing(false)
        const remainingQueue = getQueue()
        setQueueItems(remainingQueue)
        if (remainingQueue.length === 0) {
          await fetchFreshData()
        }
      } else if (showNotificationOnSuccess) {
        addNotification("Connection healthy: backend is online.", "success")
      }
    } else if (showNotificationOnSuccess) {
      addNotification("Connection check failed: backend is offline.", "warning")
    }
  }

  const fetchFreshData = async () => {
    const opts = { headers: authHeaders() }
    try {
      const clientsRes = await fetch(`${API_BASE_URL}/clients`, opts)
      if (clientsRes.ok) {
        const data = await clientsRes.json()
        rawSetClients(data)
        localStorage.setItem('kraft_cached_clients', JSON.stringify(data))
      }

      const packagesRes = await fetch(`${API_BASE_URL}/packages`, opts)
      if (packagesRes.ok) {
        const data = await packagesRes.json()
        rawSetPackages(data)
        localStorage.setItem('kraft_cached_packages', JSON.stringify(data))
      }

      const bookingsRes = await fetch(`${API_BASE_URL}/bookings`, opts)
      if (bookingsRes.ok) {
        const data = await bookingsRes.json()
        rawSetBookings(data)
        localStorage.setItem('kraft_cached_bookings', JSON.stringify(data))
      }

      const settingsRes = await fetch(`${API_BASE_URL}/settings`, opts)
      if (settingsRes.ok) {
        const data = await settingsRes.json()
        rawSetSettings(data)
        localStorage.setItem('kraft_cached_settings', JSON.stringify(data))
      }

      const testimonialsRes = await fetch(`${API_BASE_URL}/testimonials`, opts)
      if (testimonialsRes.ok) {
        const data = await testimonialsRes.json()
        rawSetTestimonials(data)
        localStorage.setItem('kraft_cached_testimonials', JSON.stringify(data))
      }

      const corporateRes = await fetch(`${API_BASE_URL}/corporate-packages`, opts)
      if (corporateRes.ok) {
        const data = await corporateRes.json()
        rawSetCorporatePackages(data)
        localStorage.setItem('kraft_cached_corporate_packages', JSON.stringify(data))
      }

      const departuresRes = await fetch(`${API_BASE_URL}/group-departures`, opts)
      if (departuresRes.ok) {
        const data = await departuresRes.json()
        rawSetGroupDepartures(data)
        localStorage.setItem('kraft_cached_group_departures', JSON.stringify(data))
      }
    } catch (err) {
      console.warn("Failed to fetch fresh data:", err)
    }
  }

  // Session restore on mount
  useEffect(() => {
    (async () => {
      const savedToken = localStorage.getItem('kraft_token')
      if (!savedToken) {
        setAuthLoading(false)
        return
      }
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${savedToken}` },
        })
        if (res.ok) {
          const data = await res.json()
          setToken(savedToken)
          setUser(data.user)
        } else {
          localStorage.removeItem('kraft_token')
          localStorage.removeItem('kraft_user')
        }
      } catch {
        // Not authenticated — stay logged out
      } finally {
        setAuthLoading(false)
      }
    })()
  }, [])

  const tokenRef = useRef(token)
  useEffect(() => { tokenRef.current = token }, [token])

  // Fetch fresh data + notifications once user is restored
  useEffect(() => {
    if (!user) return
    const t = tokenRef.current
    const headers = { 'Content-Type': 'application/json', ...(t ? { 'Authorization': `Bearer ${t}` } : {}) }
    fetchFreshData()
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/notifications`, { headers })
        if (res.ok) {
          const data = await res.json()
          const mapped = data.map((n) => ({
            id: `srv_${n.id}`,
            text: n.message,
            time: new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }),
            unread: !n.read,
            type: n.type,
            link_url: n.link_url || null,
            link_type: n.link_type || null
          }))
          setNotificationsList(prev => {
            const existingIds = new Set(prev.map(n => n.id))
            const newOnes = mapped.filter(n => !existingIds.has(n.id))
            return [...newOnes, ...prev]
          })
        }
      } catch {
        // offline — keep local
      }
    }
    load()
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false)
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfile(false)
      }
      if (statusRef.current && !statusRef.current.contains(e.target)) {
        setShowStatusDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogin = (userData, token) => {
    setUser(userData)
    setToken(token)
    localStorage.setItem('kraft_token', token)
    localStorage.setItem('kraft_user', JSON.stringify(userData))
  }

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: authHeaders(),
      })
    } catch {
      // ignore network errors on logout
    }
    setUser(null)
    setToken(null)
    setNotificationsList([])
    localStorage.removeItem('kraft_token')
    localStorage.removeItem('kraft_user')
    clearQueue()
    setQueueItems([])
  }

  // Load from cache instantly, then check health and sync
  useEffect(() => {
    // 1. Initial Cache Fallback Loading — intentional synchronous setState for instant hydration
    /* eslint-disable react-hooks/set-state-in-effect */
    const cachedClients = localStorage.getItem('kraft_cached_clients')
    if (cachedClients) rawSetClients(JSON.parse(cachedClients))
    
    const cachedPackages = localStorage.getItem('kraft_cached_packages')
    if (cachedPackages) rawSetPackages(JSON.parse(cachedPackages))
    
    const cachedBookings = localStorage.getItem('kraft_cached_bookings')
    if (cachedBookings) rawSetBookings(JSON.parse(cachedBookings))
    
    const cachedSettings = localStorage.getItem('kraft_cached_settings')
    if (cachedSettings) rawSetSettings(JSON.parse(cachedSettings))

    const cachedTestimonials = localStorage.getItem('kraft_cached_testimonials')
    if (cachedTestimonials) rawSetTestimonials(JSON.parse(cachedTestimonials))

    const cachedCorporate = localStorage.getItem('kraft_cached_corporate_packages')
    if (cachedCorporate) rawSetCorporatePackages(JSON.parse(cachedCorporate))

    const cachedDepartures = localStorage.getItem('kraft_cached_group_departures')
    if (cachedDepartures) rawSetGroupDepartures(JSON.parse(cachedDepartures))
    /* eslint-enable react-hooks/set-state-in-effect */

    // 2. Perform initial health check and sync queue
    performHealthAndSync()
    
    // 3. Setup polling interval every 15 seconds
    const intervalId = setInterval(() => {
      performHealthAndSync()
    }, 15000)

    return () => clearInterval(intervalId)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  
  // Poll pending approvals count for admin
  useEffect(() => {
    if (!user || !roleHas(user.role, 'review:approvals')) return
    const poll = async () => {
      try {
        const res = await fetch(`${API_URL}/api/approvals?status=pending`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          setPendingApprovalsCount(data.length)
        }
      } catch { /* swallow poll errors silently */ }
    }
    poll()
    const interval = setInterval(poll, 30000)
    return () => clearInterval(interval)
  }, [user, token])

  // Sync request helper: performs fetch and queues on failure
  const syncRequest = async (url, method, bodyObj, description) => {
    const bodyStr = bodyObj ? JSON.stringify(bodyObj) : null
    
    try {
      const startTime = Date.now()
      console.log(`[DEBUG] syncRequest: ${method} ${url}`)
      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: bodyStr,
      })
      console.log(`[DEBUG] syncRequest response: ${res.status} ${res.statusText} for ${method} ${url}`)
      
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          const errData = await res.json().catch(() => ({}))
          addNotification(errData.error || `Permission denied: ${description}`, 'error')
          return null
        }
        throw new Error(`Server returned ${res.status}`)
      }
      
      const latency = Date.now() - startTime
      setServerStatus({ online: true, latency, lastChecked: new Date().toLocaleTimeString() })
      return method !== 'DELETE' ? await res.json() : null
    } catch (err) {
      console.warn(`Request failed for "${description}", queueing offline:`, err)
      setServerStatus(prev => ({ ...prev, online: false, latency: null }))
      
      const updatedQueue = enqueueRequest({
        url,
        method,
        headers: authHeaders(),
        body: bodyStr,
        description
      })
      setQueueItems(updatedQueue)
      
      addNotification(`Saved locally: "${description}" will sync when online.`, 'info')
      return null
    }
  }

  // Sync wrappers to perform API operations in background
  const setClients = async (newVal) => {
    const current = clientsRef.current
    const resolved = typeof newVal === 'function' ? newVal(current) : newVal
    rawSetClients(resolved)
    localStorage.setItem('kraft_cached_clients', JSON.stringify(resolved))

    try {
      if (resolved.length > current.length) {
        const added = resolved.find(item => !current.some(c => c.id === item.id))
        if (added) {
          await syncRequest(`${API_BASE_URL}/clients`, 'POST', added, `Created client "${added.name}"`)
        }
      } else if (resolved.length < current.length) {
        const deleted = current.find(item => !resolved.some(r => r.id === item.id))
        if (deleted) {
          await syncRequest(`${API_BASE_URL}/clients/${deleted.id}`, 'DELETE', null, `Deleted client "${deleted.name}"`)
        }
      } else {
        for (const item of resolved) {
          const original = current.find(c => c.id === item.id)
          if (original && JSON.stringify(original) !== JSON.stringify(item)) {
            await syncRequest(`${API_BASE_URL}/clients/${item.id}`, 'PUT', item, `Updated client "${item.name}"`)
          }
        }
      }
    } catch (err) {
      console.error('Failed to sync clients to backend:', err)
    }
  }

  const setPackages = async (newVal) => {
    const current = packagesRef.current
    const resolved = typeof newVal === 'function' ? newVal(current) : newVal
    rawSetPackages(resolved)
    localStorage.setItem('kraft_cached_packages', JSON.stringify(resolved))

    try {
      if (resolved.length > current.length) {
        const added = resolved.find(item => !current.some(p => p.id === item.id))
        if (added) {
          await syncRequest(`${API_BASE_URL}/packages`, 'POST', added, `Created package "${added.name}"`)
        }
      } else if (resolved.length < current.length) {
        const deleted = current.find(item => !resolved.some(r => r.id === item.id))
        if (deleted) {
          await syncRequest(`${API_BASE_URL}/packages/${deleted.id}`, 'DELETE', null, `Deleted package "${deleted.name}"`)
        }
      } else {
        for (const item of resolved) {
          const original = current.find(p => p.id === item.id)
          const changed = original && JSON.stringify(original) !== JSON.stringify(item)
          console.log(`[DEBUG] setPackages edit: id=${item.id}, found=${!!original}, changed=${changed}`)
          if (changed) {
            console.log(`[DEBUG] Sending PUT to ${API_BASE_URL}/packages/${item.id}`, { original, updated: item })
            const result = await syncRequest(`${API_BASE_URL}/packages/${item.id}`, 'PUT', item, `Updated package "${item.name}"`)
            console.log(`[DEBUG] PUT result:`, result)
          }
        }
      }
    } catch (err) {
      console.error('Failed to sync packages to backend:', err)
    }
  }

  const setBookings = async (newVal) => {
    const current = bookingsRef.current
    const resolved = typeof newVal === 'function' ? newVal(current) : newVal
    rawSetBookings(resolved)
    localStorage.setItem('kraft_cached_bookings', JSON.stringify(resolved))

    try {
      if (resolved.length > current.length) {
        const added = resolved.find(item => !current.some(b => b.id === item.id))
        if (added) {
          await syncRequest(`${API_BASE_URL}/bookings`, 'POST', added, `Created booking "${added.id}"`)
        }
      } else if (resolved.length < current.length) {
        const deleted = current.find(item => !resolved.some(r => r.id === item.id))
        if (deleted) {
          await syncRequest(`${API_BASE_URL}/bookings/${deleted.id}`, 'DELETE', null, `Deleted booking "${deleted.id}"`)
        }
      } else {
        for (const item of resolved) {
          const original = current.find(b => b.id === item.id)
          if (original && JSON.stringify(original) !== JSON.stringify(item)) {
            await syncRequest(`${API_BASE_URL}/bookings/${item.id}`, 'PUT', item, `Updated booking "${item.id}"`)
          }
        }
      }
    } catch (err) {
      console.error('Failed to sync bookings to backend:', err)
    }
  }

  const setSettings = async (newVal) => {
    const current = settingsRef.current
    const resolved = typeof newVal === 'function' ? newVal(current) : newVal
    rawSetSettings(resolved)
    localStorage.setItem('kraft_cached_settings', JSON.stringify(resolved))

    // Debounce: hold the latest payload, cancel any in-flight + scheduled PUT
    settingsDebounceRef.current.pending = resolved
    if (settingsDebounceRef.current.timeoutId) {
      clearTimeout(settingsDebounceRef.current.timeoutId)
    }
    if (settingsAbortRef.current) {
      settingsAbortRef.current.abort()
    }
    settingsDebounceRef.current.timeoutId = setTimeout(async () => {
      const payload = settingsDebounceRef.current.pending
      settingsDebounceRef.current.pending = null
      settingsDebounceRef.current.timeoutId = null
      
      await syncRequest(`${API_BASE_URL}/settings`, 'PUT', payload, `Updated agency settings`)
    }, 250)
  }

  const setTestimonials = async (newVal) => {
    const current = testimonialsRef.current
    const resolved = typeof newVal === 'function' ? newVal(current) : newVal
    rawSetTestimonials(resolved)
    localStorage.setItem('kraft_cached_testimonials', JSON.stringify(resolved))

    try {
      let working = resolved
      if (resolved.length > current.length) {
        const added = resolved.filter(item => !current.some(t => t.id === item.id))
        for (const item of added) {
          const serverItem = await syncRequest(`${API_BASE_URL}/testimonials`, 'POST', item, `Created testimonial from "${item.name}"`)
          if (serverItem && serverItem.id !== item.id) {
            working = working.map(t => t.id === item.id ? { ...t, id: serverItem.id } : t)
            rawSetTestimonials(working)
            localStorage.setItem('kraft_cached_testimonials', JSON.stringify(working))
          }
        }
      } else if (resolved.length < current.length) {
        const deleted = current.filter(item => !resolved.some(r => r.id === item.id))
        for (const item of deleted) {
          await syncRequest(`${API_BASE_URL}/testimonials/${item.id}`, 'DELETE', null, `Deleted testimonial from "${item.name}"`)
        }
      } else {
        for (const item of resolved) {
          const original = current.find(t => t.id === item.id)
          if (original && JSON.stringify(original) !== JSON.stringify(item)) {
            const serverItem = await syncRequest(`${API_BASE_URL}/testimonials/${item.id}`, 'PUT', item, `Updated testimonial from "${item.name}"`)
            if (serverItem && serverItem.id !== item.id) {
              working = working.map(t => t.id === item.id ? { ...t, id: serverItem.id } : t)
              rawSetTestimonials(working)
              localStorage.setItem('kraft_cached_testimonials', JSON.stringify(working))
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to sync testimonials to backend:', err)
    }
  }

  const setCorporatePackages = async (newVal) => {
    const current = corporatePackagesRef.current
    const resolved = typeof newVal === 'function' ? newVal(current) : newVal
    rawSetCorporatePackages(resolved)
    localStorage.setItem('kraft_cached_corporate_packages', JSON.stringify(resolved))

    try {
      let working = resolved
      if (resolved.length > current.length) {
        const added = resolved.filter(item => !current.some(c => c.id === item.id))
        for (const item of added) {
          const payload = {
            destination: item.destination,
            nights: item.nights,
            startingPrice: item.startingPrice || item.starting_price,
            category: item.category,
            imageUrl: item.imageUrl || item.image_url,
            description: item.description,
            highlights: item.highlights
          }
          const serverItem = await syncRequest(`${API_BASE_URL}/corporate-packages`, 'POST', payload, `Created corporate package for "${item.destination}"`)
          if (serverItem && serverItem.id !== item.id) {
            working = working.map(c => c.id === item.id ? { ...c, id: serverItem.id } : c)
            rawSetCorporatePackages(working)
            localStorage.setItem('kraft_cached_corporate_packages', JSON.stringify(working))
          }
        }
      } else if (resolved.length < current.length) {
        const deleted = current.filter(item => !resolved.some(r => r.id === item.id))
        for (const item of deleted) {
          await syncRequest(`${API_BASE_URL}/corporate-packages/${item.id}`, 'DELETE', null, `Deleted corporate package for "${item.destination}"`)
        }
      } else {
        for (const item of resolved) {
          const original = current.find(c => c.id === item.id)
          if (original && JSON.stringify(original) !== JSON.stringify(item)) {
            const payload = {
              destination: item.destination,
              nights: item.nights,
              startingPrice: item.startingPrice !== undefined ? item.startingPrice : (item.starting_price !== undefined ? item.starting_price : null),
              category: item.category,
              imageUrl: item.imageUrl !== undefined ? item.imageUrl : (item.image_url !== undefined ? item.image_url : ''),
              description: item.description,
              highlights: item.highlights,
              isActive: item.isActive !== undefined ? item.isActive : (item.is_active !== undefined ? item.is_active : true),
              displayOrder: item.displayOrder !== undefined ? item.displayOrder : (item.display_order !== undefined ? item.display_order : 0)
            }
            const serverItem = await syncRequest(`${API_BASE_URL}/corporate-packages/${item.id}`, 'PUT', payload, `Updated corporate package for "${item.destination}"`)
            if (serverItem && serverItem.id !== item.id) {
              working = working.map(c => c.id === item.id ? { ...c, id: serverItem.id } : c)
              rawSetCorporatePackages(working)
              localStorage.setItem('kraft_cached_corporate_packages', JSON.stringify(working))
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to sync corporate packages to backend:', err)
    }
  }

  const setGroupDepartures = async (newVal) => {
    const current = groupDeparturesRef.current
    const resolved = typeof newVal === 'function' ? newVal(current) : newVal
    rawSetGroupDepartures(resolved)
    localStorage.setItem('kraft_cached_group_departures', JSON.stringify(resolved))

    try {
      let working = resolved
      if (resolved.length > current.length) {
        const added = resolved.filter(item => !current.some(g => String(g.id) === String(item.id)))
        for (const item of added) {
          const payload = {
            packageId: item.packageId,
            title: item.title,
            departureDate: item.departureDate,
            returnDate: item.returnDate,
            slotsTotal: item.slotsTotal !== undefined ? item.slotsTotal : item.slots?.total,
            slotsBooked: item.slotsBooked !== undefined ? item.slotsBooked : item.slots?.booked,
            priceModifier: item.priceModifier ?? 0,
            costPrice: item.costPrice ?? 0,
            ctaBadge: item.ctaBadge || null,
            inclusions: item.inclusions || [],
            exclusions: item.exclusions || [],
            highlights: item.highlights || [],
            itinerary: item.itinerary || [],
            status: item.status || 'scheduled',
            notes: item.notes || '',
            termsAndConditions: item.termsAndConditions || ''
          }
          const serverItem = await syncRequest(`${API_BASE_URL}/group-departures`, 'POST', payload, `Created group departure for "${item.title}"`)
          if (serverItem) {
            working = working.map(g => String(g.id) === String(item.id) ? { ...g, ...serverItem } : g)
            rawSetGroupDepartures(working)
            localStorage.setItem('kraft_cached_group_departures', JSON.stringify(working))
          }
        }
      } else if (resolved.length < current.length) {
        const deleted = current.filter(item => !resolved.some(r => String(r.id) === String(item.id)))
        const itemsToDelete = deleted.filter(item => !String(item.id).startsWith('temp-'))
        for (const item of itemsToDelete) {
          await syncRequest(`${API_BASE_URL}/group-departures/${item.id}`, 'DELETE', null, `Deleted group departure "${item.title}"`)
        }
      } else {
        const EDITABLE_DEP_FIELDS = ['departureDate', 'returnDate', 'slots', 'priceModifier', 'costPrice', 'ctaBadge', 'inclusions', 'exclusions', 'highlights', 'itinerary', 'status', 'notes', 'termsAndConditions', 'title'];
        const hasDepChanges = (orig, curr) => EDITABLE_DEP_FIELDS.some(field => {
          const a = typeof orig[field] === 'object' ? JSON.stringify(orig[field]) : orig[field];
          const b = typeof curr[field] === 'object' ? JSON.stringify(curr[field]) : curr[field];
          return a !== b;
        });
        for (const item of resolved) {
          const original = current.find(g => String(g.id) === String(item.id))
          if (original && hasDepChanges(original, item)) {
            const payload = {
              packageId: item.packageId,
              title: item.title,
              departureDate: item.departureDate,
              returnDate: item.returnDate,
              slotsTotal: item.slotsTotal !== undefined ? item.slotsTotal : item.slots?.total,
              slotsBooked: item.slotsBooked !== undefined ? item.slotsBooked : item.slots?.booked,
              priceModifier: item.priceModifier ?? 0,
              costPrice: item.costPrice ?? 0,
              ctaBadge: item.ctaBadge || null,
              inclusions: item.inclusions || [],
              exclusions: item.exclusions || [],
              highlights: item.highlights || [],
              itinerary: item.itinerary || [],
              status: item.status || 'scheduled',
              notes: item.notes || '',
              termsAndConditions: item.termsAndConditions || ''
            }
            const serverItem = await syncRequest(`${API_BASE_URL}/group-departures/${item.id}`, 'PUT', payload, `Updated group departure "${item.title}"`)
            if (serverItem) {
              working = working.map(g => String(g.id) === String(item.id) ? { ...g, ...serverItem } : g)
              rawSetGroupDepartures(working)
              localStorage.setItem('kraft_cached_group_departures', JSON.stringify(working))
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to sync group departures to backend:', err)
    }
  }

  function addNotification(text, type = 'system', link) {
    if (type === 'error' || type === 'warning') {
      const id = `t-${Date.now()}-${Math.random()}`
      setToasts(prev => [...prev, { id, text, type }])
      const lifetime = type === 'error' ? 7000 : 5000
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, lifetime)
      return
    }

    const newNotif = {
      id: Date.now(),
      text,
      time: 'Just now',
      unread: true,
      type,
      link_url: link || null,
      link_type: link ? link.split(':')[0] : null
    }
    setNotificationsList(prev => [newNotif, ...prev])

    fetch(`${API_BASE_URL}/notifications`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ message: text, type, link }),
    }).catch(() => {})
  }

  // Dynamic Dashboard Stats Calculations — Indian Tier-2 travel agency
  const parseAmt = (b) => Number(b.amount) || 0
  const parseDate = (b) => {
    if (!b) return null
    const rawDate = b.date || b.startDate || b.travelDate
    if (!rawDate) return null
    if (rawDate instanceof Date) {
      return isNaN(rawDate.getTime()) ? null : rawDate
    }
    if (typeof rawDate !== 'string') return null
    const trimmed = rawDate.trim()
    if (!trimmed) return null

    // 1. Check DD/MM/YYYY or DD-MM-YYYY (e.g. 25/06/2026, 25-06-2026, 5/6/2026)
    const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10)
      const month = parseInt(dmyMatch[2], 10) - 1
      const year = parseInt(dmyMatch[3], 10)
      const d = new Date(year, month, day)
      if (!isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
        return d
      }
    }

    // 2. Try standard Date.parse (e.g. "2026-06-25", ISO strings)
    const parsed = Date.parse(trimmed)
    if (!isNaN(parsed)) return new Date(parsed)

    // 3. Fallback for "25 Jun 2026" / "25 June 2026" / "Jun 25, 2026"
    const months = {
      jan:0, janary:0, january:0,
      feb:1, february:1,
      mar:2, march:2,
      apr:3, april:3,
      may:4,
      jun:5, june:5,
      jul:6, july:6,
      aug:7, august:7,
      sep:8, sept:8, september:8,
      oct:9, october:9,
      nov:10, november:10,
      dec:11, december:11
    }
    const parts = trimmed.split(/[\s,-]+/).filter(Boolean)
    if (parts.length === 3) {
      // Day Month Year (e.g. 25 Jun 2026)
      const m1 = months[parts[1].toLowerCase()]
      if (m1 !== undefined) {
        const day = parseInt(parts[0], 10)
        const year = parseInt(parts[2], 10)
        if (!isNaN(day) && !isNaN(year)) {
          return new Date(Date.UTC(year, m1, day))
        }
      }
      // Month Day Year (e.g. Jun 25 2026)
      const m0 = months[parts[0].toLowerCase()]
      if (m0 !== undefined) {
        const day = parseInt(parts[1], 10)
        const year = parseInt(parts[2], 10)
        if (!isNaN(day) && !isNaN(year)) {
          return new Date(Date.UTC(year, m0, day))
        }
      }
    }
    return null
  }

  const now = new Date()
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const fourteenDaysOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const thisMonthBookings = bookings.filter(b => {
    const d = parseDate(b)
    return d && d >= startOfThisMonth
  })
  const lastMonthBookings = bookings.filter(b => {
    const d = parseDate(b)
    return d && d >= startOfLastMonth && d < startOfThisMonth
  })

  const thisMonthRevenue = thisMonthBookings.reduce((s, b) => s + parseAmt(b), 0)
  const lastMonthRevenue = lastMonthBookings.reduce((s, b) => s + parseAmt(b), 0)
  const monthOverMonth = lastMonthRevenue > 0
    ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
    : null

  const outstandingRevenue = bookings
    .filter(b => (b.status || 'Pending') !== 'Paid')
    .reduce((s, b) => s + parseAmt(b), 0)

  const upcomingGroupDepartures = groupDepartures
    .filter(g => {
      if (!g.departureDate) return false
      const d = new Date(g.departureDate)
      return !isNaN(d.getTime()) && (g.status === 'scheduled' || g.status === 'confirmed')
    })
    .sort((a, b) => new Date(a.departureDate) - new Date(b.departureDate))

  const upcomingGroupDepartures14d = upcomingGroupDepartures.filter(g => {
    const d = new Date(g.departureDate)
    return d >= now && d <= fourteenDaysOut
  })

  const upcomingDepartures = bookings
    .filter(b => {
      const d = parseDate(b)
      return d && d >= now && d <= fourteenDaysOut
    })
    .sort((a, b) => parseDate(a) - parseDate(b))

  const totalDepartures14dCount = upcomingDepartures.length + upcomingGroupDepartures14d.length

  const avgBookingValue = bookings.length > 0
    ? bookings.reduce((s, b) => s + parseAmt(b), 0) / bookings.length
    : 0

  const inrToUsdRate = parseFloat(settings?.inrToUsdRate ?? 0)
  const toUSDdashboard = (inr) => inrToUsdRate > 0 ? inr / inrToUsdRate : null
  const formatUSDdash = (price) => price != null ? `$${Number(price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''

  const newClientsThisMonth = clients.filter(c => {
    if (!c.lastContact) return false
    const d = new Date(c.lastContact)
    return !isNaN(d) && d >= startOfThisMonth
  }).length

  const pendingFollowUps = clients.filter(c => {
    if (!c.lastContact) return true
    const d = new Date(c.lastContact)
    return !isNaN(d) && d < sevenDaysAgo
  })

  const formatINRCompact = (n) => {
    if (!n || n <= 0) return '₹0'
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`
    if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`
    if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`
    return `₹${n.toLocaleString('en-IN')}`
  }

  // Rolling 6-month revenue chart (replaces hardcoded Jan-Jun)
  const chartData = (() => {
    const result = []
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const monthBookings = bookings.filter(b => {
        const d = parseDate(b)
        return d && d >= start && d < end
      })
      const sum = monthBookings.reduce((s, b) => s + parseAmt(b), 0)
      result.push({
        month: start.toLocaleDateString('en-GB', { month: 'short' }),
        revenue: sum / 1000,
        label: formatINRCompact(sum)
      })
    }
    return result
  })()
  const maxRevenueVal = Math.max(10, ...chartData.map(d => d.revenue))

  // Top destinations THIS MONTH (not all-time)
  const activeDestinations = (() => {
    const counts = new Map()
    thisMonthBookings.forEach(b => {
      if (!b.package) return
      counts.set(b.package, (counts.get(b.package) || 0) + 1)
    })
    const colors = [
      'bg-amber-100 text-amber-800',
      'bg-orange-100 text-orange-700 border-orange-200/40',
      'bg-yellow-100 text-yellow-800',
      'bg-emerald-100 text-emerald-800',
      'bg-rose-100 text-rose-800'
    ]
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count], idx) => ({
        name,
        count,
        trend: 'This Month',
        color: colors[idx % colors.length]
      }))
  })()

  const unreadCount = notificationsList.filter((n) => n.unread).length

  const markAllRead = () => {
    setNotificationsList(notificationsList.map((n) => ({ ...n, unread: false })))
    fetch(`${API_BASE_URL}/notifications/read-all`, {
      method: 'PATCH',
      headers: authHeaders(),
    }).catch(() => {})
  }

  const toggleRead = (id) => {
    setNotificationsList(
      notificationsList.map((n) => (n.id === id ? { ...n, unread: !n.unread } : n))
    )
    const serverId = id.toString().startsWith('srv_') ? id.slice(4) : null
    if (serverId) {
      fetch(`${API_BASE_URL}/notifications/${serverId}/read`, {
        method: 'PATCH',
        headers: authHeaders(),
      }).catch(() => {})
    }
  }

  const deleteNotification = (id) => {
    setNotificationsList(notificationsList.filter((n) => n.id !== id))
    const serverId = id.toString().startsWith('srv_') ? id.slice(4) : null
    if (serverId) {
      fetch(`${API_BASE_URL}/notifications/${serverId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      }).catch(() => {})
    }
  }

  const handleNotificationClick = (link) => {
    if (!link) return
    setShowNotifications(false)
    const [path, ...queryParts] = link.split('?')
    const params = new URLSearchParams(queryParts.join('?'))
    const [kind, id] = path.split(':')

    if (kind === 'tab') {
      setActiveTab(id)
      const status = params.get('status')
      if (status) setInitialApprovalFilter(status)
      const approvalId = params.get('id')
      if (approvalId) setInitialApprovalId(approvalId)
    } else if (kind === 'booking') {
      setInitialSelectedBookingId(id)
      setActiveTab('bookings')
    } else if (kind === 'client') {
      setSelectedClientIdForCRM(id)
      setActiveTab('clients')
    } else if (kind === 'package') {
      setInitialSelectedPackageId(id)
      setActiveTab('packages')
    } else if (kind === 'approval') {
      setInitialApprovalId(id)
      setActiveTab('approvals')
    } else if (kind === 'enquiry') {
      setSelectedEnquiryIdForModal(id)
      window.history.pushState({ tab: activeTab, enquiryId: id }, '', `/enquiries/${id}`)
    }
  }

  const clearAllNotifications = () => {
    setNotificationsList([])
    fetch(`${API_BASE_URL}/notifications/clear-all`, {
      method: 'DELETE',
      headers: authHeaders(),
    }).catch(() => {})
  }

  const filteredBookings = bookings.filter(
    (b) =>
      (b.client || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.package || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.id || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FDFCF7] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <div className="min-h-screen bg-[#FDFCF7] text-stone-800 font-sans flex antialiased">
      {/* Mobile sidebar backdrop */}
      <div
        className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''} lg:hidden`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`sidebar-mobile ${sidebarOpen ? 'open' : ''} w-64 bg-[#FAF9F5] border-r border-stone-200/60 flex flex-col justify-between shrink-0 lg:relative lg:translate-x-0`}>
        <div>
          {/* Logo */}
          <div className="p-6 flex items-center gap-3 border-b border-stone-200/50">
            <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center shadow-sm border border-stone-200 bg-white">
              <img src={logo} alt="KRAFT YOUR TRIP Logo" className="w-full h-full object-contain p-0.5" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight text-stone-900 uppercase">
                KRAFT YOUR TRIP
              </h1>
              <span className="text-[10px] text-amber-700 font-semibold uppercase tracking-wider">
                Agency Portal
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z' },
              { id: 'enquiries', label: 'Enquiries', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', visible: roleHas(user?.role, 'read:bookings') },
              { id: 'bookings', label: 'Bookings', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', visible: roleHas(user?.role, 'read:bookings') },
              { id: 'corporateLeads', label: 'Corporate Bookings', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', visible: roleHas(user?.role, 'read:bookings') },
              { id: 'clients', label: 'Clients', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', visible: roleHas(user?.role, 'read:clients') },
              { id: 'packages', label: 'Packages', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10', visible: roleHas(user?.role, 'read:packages') },
              { id: 'corporatePackages', label: 'Corporate Tours', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', visible: roleHas(user?.role, 'read:packages') },
              { id: 'groupDepartures', label: 'Group Departures', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', visible: roleHas(user?.role, 'read:packages') },
              { id: 'reports', label: 'Reports', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', visible: roleHas(user?.role, 'read:reports') },
              { id: 'testimonials', label: 'Testimonials', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', visible: roleHas(user?.role, 'read:testimonials') },
              { id: 'settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', visible: roleHas(user?.role, 'read:settings') },
              ...(roleHas(user?.role, 'manage:users') ? [{ id: 'team', label: 'Team', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' }] : []),
              ...(roleHas(user?.role, 'review:approvals') || roleHas(user?.role, 'submit:approvals') ? [{ id: 'approvals', label: 'Approvals', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' }] : []),
            ].filter(t => t.visible !== false).map((link) => (
              <button
                key={link.id}
                onClick={() => { setActiveTab(link.id); setSidebarOpen(false); setShowNotifications(false); setShowProfile(false); setShowStatusDropdown(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 group text-left ${
                  activeTab === link.id
                    ? 'bg-amber-500/10 text-amber-700 font-semibold'
                    : 'text-stone-500 hover:bg-stone-200/30 hover:text-stone-800'
                }`}
              >
                <svg
                  className={`w-4.5 h-4.5 transition-transform duration-300 group-hover:scale-105 ${
                    activeTab === link.id ? 'text-amber-600' : 'text-stone-400 group-hover:text-stone-600'
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={link.icon} />
                </svg>
                <span className="text-sm">{link.label}</span>
                {link.id === 'approvals' && pendingApprovalsCount > 0 && (
                  <span className="ml-auto bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {pendingApprovalsCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Footer Brand Info */}
        <div className="p-5 border-t border-stone-200/50 text-center">
          <p className="text-[10px] text-stone-400 font-medium">KRAFT YOUR TRIP Admin v1.4</p>
          <p className="text-[9px] text-stone-400/80 mt-0.5">© 2026 KRAFT YOUR TRIP Inc.</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header */}
        <header className="h-16 sm:h-20 border-b border-stone-200/50 px-4 sm:px-6 lg:px-8 flex items-center justify-between shrink-0 bg-[#FDFCF7]/80 backdrop-blur-md sticky top-0 z-20 gap-3">
          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 -ml-1 rounded-xl text-stone-500 hover:bg-stone-100 hover:text-stone-800 transition-all shrink-0"
            aria-label="Toggle sidebar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {sidebarOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          {/* Search bar */}
          <div className="relative flex-1 max-w-96">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <svg className="h-4.5 w-4.5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              ref={globalSearchInputRef}
              type="text"
              placeholder="Search bookings, clients, packages... (⌘K)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-stone-200 focus:border-amber-500 rounded-xl py-2.5 pl-11 pr-4 text-xs text-stone-800 placeholder-stone-400 outline-none focus:ring-2 focus:ring-amber-500/20 transition-all duration-300"
            />
          </div>

          {/* Interactive User & Notification Controls */}
          <div className="flex items-center gap-5 relative">
            {/* Server Status Badge & Dropdown */}
            <div className="relative" ref={statusRef}>
              <button
                onClick={() => {
                  setShowStatusDropdown(!showStatusDropdown)
                  setShowNotifications(false)
                  setShowProfile(false)
                }}
                className={`flex items-center gap-2 py-1.5 px-3 bg-white border rounded-xl transition-all duration-300 shadow-sm ${
                  showStatusDropdown 
                    ? 'border-amber-300 bg-amber-50/50' 
                    : 'border-stone-200 hover:bg-stone-50'
                }`}
                title="Server Connection Status"
              >
                {/* Status Dot with pulse ring */}
                <span className="relative flex h-2.5 w-2.5">
                  {serverStatus.online && !isSyncing && (
                    <>
                      <span className="animate-status-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </>
                  )}
                  {serverStatus.online === false && (
                    <>
                      <span className="animate-status-pulse absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                    </>
                  )}
                  {(serverStatus.online === null || isSyncing) && (
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-spin absolute inline-flex h-full w-full rounded-full border-2 border-amber-500 border-t-transparent"></span>
                    </span>
                  )}
                </span>
                
                <span className="text-[10px] font-bold text-stone-700 hidden sm:inline">
                  {isSyncing ? 'Syncing...' : serverStatus.online ? 'Online' : serverStatus.online === false ? 'Offline' : 'Connecting...'}
                </span>
                
                {queueItems.length > 0 && (
                  <span className="ml-1 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                    {queueItems.length}
                  </span>
                )}
              </button>

              {/* Status Dropdown Card */}
              {showStatusDropdown && (
                <div className="absolute right-0 mt-3.5 w-80 bg-white border border-stone-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-4 border-b border-stone-100 flex items-center justify-between">
                    <h5 className="font-bold text-stone-900 text-xs">Backend Connection</h5>
                    <button
                      onClick={() => performHealthAndSync(true)}
                      disabled={isSyncing}
                      className="text-[10px] text-amber-700 hover:text-amber-600 font-bold flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                    >
                      <svg className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89" />
                      </svg>
                      Check Now
                    </button>
                  </div>
                  
                  <div className="p-4 space-y-3.5 text-xs">
                    {/* Status Info Row */}
                    <div className="grid grid-cols-2 gap-3 bg-stone-50/50 p-3 rounded-xl border border-stone-200/30">
                      <div>
                        <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block">Status</span>
                        <span className={`font-bold ${serverStatus.online ? 'text-emerald-600' : serverStatus.online === false ? 'text-rose-600' : 'text-stone-500'}`}>
                          {isSyncing ? 'Syncing Queue' : serverStatus.online ? 'Connected' : serverStatus.online === false ? 'Offline Mode' : 'Checking...'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block">Latency</span>
                        <span className="font-semibold text-stone-800">
                          {serverStatus.latency !== null ? `${serverStatus.latency}ms` : '—'}
                        </span>
                      </div>
                      <div className="col-span-2 pt-1 border-t border-stone-100 text-[9px] text-stone-400">
                        Last checked: {serverStatus.lastChecked || 'Never'}
                      </div>
                    </div>

                    {/* Sync Queue Section */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Offline Sync Queue</span>
                        {queueItems.length > 0 && (
                          <button
                            onClick={() => {
                              clearQueue()
                              setQueueItems([])
                              addNotification("Offline sync queue cleared.", "info")
                            }}
                            className="text-[9px] text-rose-600 hover:text-rose-500 font-bold"
                          >
                            Clear Queue
                          </button>
                        )}
                      </div>

                      {queueItems.length > 0 ? (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {queueItems.map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-2 bg-[#FAF9F5]/60 border border-stone-200/40 rounded-lg text-[10px]">
                              <div className="min-w-0 flex-1 mr-2">
                                <span className="font-semibold text-stone-800 truncate block">{item.description}</span>
                                <span className="text-[8px] text-stone-400 block font-mono uppercase">{item.method} • {new Date(item.timestamp).toLocaleTimeString()}</span>
                              </div>
                              <span className="shrink-0 bg-amber-500/10 text-amber-700 text-[8px] font-bold px-1.5 py-0.5 rounded border border-amber-300/30">
                                Pending
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-4 text-center text-stone-400 italic text-[11px]">
                          No pending offline changes.
                        </div>
                      )}
                    </div>

                    {/* Sync action button */}
                    {queueItems.length > 0 && (
                      <button
                        onClick={() => performHealthAndSync(true)}
                        disabled={!serverStatus.online || isSyncing}
                        className="w-full py-2 bg-[#3D7BFF] hover:bg-[#1D63FF] text-white rounded-lg font-bold text-xs shadow-sm disabled:bg-stone-100 disabled:text-stone-400 disabled:shadow-none active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        {isSyncing ? (
                          <>
                            <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Syncing...
                          </>
                        ) : !serverStatus.online ? (
                          'Server Offline (Cannot Sync)'
                        ) : (
                          'Sync Changes Now'
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Notifications Button */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications)
                  setShowProfile(false)
                  setShowStatusDropdown(false)
                }}
                className={`relative p-2 bg-white border border-stone-200 rounded-xl transition-all duration-300 shadow-sm ${
                  showNotifications ? 'text-amber-700 bg-amber-50 border-amber-300' : 'text-stone-500 hover:text-stone-800 hover:bg-stone-50'
                }`}
                title="Notifications"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-amber-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown Card */}
              {showNotifications && (
                <div className="absolute right-0 mt-3.5 w-80 bg-white border border-stone-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-4 border-b border-stone-100 flex items-center justify-between">
                    <h5 className="font-bold text-stone-900 text-xs">Recent Updates</h5>
                    <div className="flex items-center gap-3">
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllRead}
                          className="text-[10px] text-amber-700 hover:text-amber-600 font-bold cursor-pointer"
                        >
                          Mark all as read
                        </button>
                      )}
                      {notificationsList.length > 0 && (
                        <button
                          onClick={clearAllNotifications}
                          className="text-[10px] text-rose-600 hover:text-rose-500 font-bold cursor-pointer"
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="divide-y divide-stone-50 max-h-64 overflow-y-auto">
                    {notificationsList.length > 0 ? (
                      notificationsList.map((notif) => (
                        <div
                          key={notif.id}
                          onClick={notif.link_url ? () => handleNotificationClick(notif.link_url) : undefined}
                          className={`p-4 flex gap-3 transition-colors duration-200 ${
                            notif.unread ? 'bg-amber-50/20' : 'hover:bg-stone-50/50'
                          } ${notif.link_url ? 'cursor-pointer hover:bg-amber-50/40' : ''}`}
                        >
                            <div className="flex-1 space-y-1">
                               <div className="flex items-start justify-between gap-2">
                                <p className={`text-[11px] leading-relaxed ${notif.unread ? 'font-semibold text-stone-900' : 'text-stone-600'}`}>
                                  {notif.text}
                                </p>
                                {notif.unread && (
                                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full shrink-0 mt-1"></span>
                                )}
                              </div>
                              <div className="flex items-center justify-between pt-1 text-[9px] text-stone-400">
                                <span>{notif.time}</span>
                                <div className="flex items-center gap-2">
                                  {notif.link_url && <span className="text-amber-700 font-bold">Open →</span>}
                                  {!notif.link_url && <span>•</span>}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); toggleRead(notif.id) }}
                                    className="text-stone-500 hover:text-stone-800"
                                  >
                                    {notif.unread ? 'Mark read' : 'Mark unread'}
                                  </button>
                                  <span>•</span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); deleteNotification(notif.id) }}
                                    className="text-stone-400 hover:text-red-600 font-medium"
                                  >
                                  Clear
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-stone-400 text-xs">
                        No notifications to display.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown Toggle */}
            <div className="flex items-center gap-3 border-l border-stone-200 pl-5 relative" ref={profileRef}>
              <button
                onClick={() => {
                  setShowProfile(!showProfile)
                  setShowNotifications(false)
                  setShowStatusDropdown(false)
                }}
                className="flex items-center gap-2.5 text-left group focus:outline-none"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-100 p-[1.5px] shadow-sm relative">
                  {user?.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt="User Avatar"
                      className="w-full h-full object-cover rounded-[10px]"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-amber-700 font-bold text-sm rounded-[10px] bg-amber-50">
                      {user?.name?.charAt(0) || 'A'}
                    </div>
                  )}
                </div>
                <div className="hidden md:block">
                  <h4 className="text-xs font-semibold text-stone-900 leading-tight group-hover:text-amber-700 transition-colors duration-200">
                    {user?.name || 'Admin'}
                  </h4>
                  <span className="text-[10px] text-stone-400 font-medium capitalize">{user?.role || 'admin'}</span>
                </div>
                <svg className="w-3.5 h-3.5 text-stone-400 group-hover:text-stone-600 transition-colors duration-200 hidden md:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Profile Dropdown Card */}
              {showProfile && (
                <div className="absolute right-0 top-full mt-3.5 w-72 bg-white border border-stone-200 rounded-2xl shadow-xl z-50 p-5 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* Expanded Profile Info */}
                  <div className="flex items-center gap-3 pb-4 border-b border-stone-100">
                    <div className="w-12 h-12 rounded-xl bg-amber-100 p-[2px] shadow-sm relative">
                      {user?.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt="User Avatar"
                          className="w-full h-full object-cover rounded-[10px]"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-amber-700 font-bold text-lg rounded-[10px] bg-amber-50">
                          {user?.name?.charAt(0) || 'A'}
                        </div>
                      )}
                    </div>
                    <div>
                      <h5 className="font-bold text-stone-900 text-sm leading-tight">{user?.name || 'Admin'}</h5>
                      <p className="text-[10px] text-stone-400 font-semibold mb-0.5">{user?.email || ''}</p>
                      <span className="bg-amber-500/10 text-amber-700 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border border-amber-500/10">
                        {user?.role || 'admin'}
                      </span>
                    </div>
                  </div>

                  {/* Actions Links */}
                  <div className="pt-3 space-y-1">
                    {[
                      { label: 'Account Settings', icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4' },
                      { label: 'Commission Wallet', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
                      { label: 'Sign Out', icon: 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1', textClass: 'text-rose-600 hover:bg-rose-50', action: 'logout' },
                    ].map((act, idx) => (
                      <button
                        key={idx}
                        onClick={act.action === 'logout' ? handleLogout : undefined}
                        className={`w-full py-2 px-3 rounded-lg text-[11px] font-semibold text-left transition-colors duration-200 flex items-center gap-2.5 ${
                          act.textClass ? act.textClass : 'text-stone-600 hover:bg-stone-100/50'
                        }`}
                      >
                        <svg className="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d={act.icon} />
                        </svg>
                        {act.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Render Block based on activeTab */}
        <div className={`p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 flex-1 w-full mx-auto animate-in fade-in duration-300 ${activeTab === 'groupDepartures' ? 'max-w-none px-6 sm:px-10 lg:px-16' : 'max-w-7xl'}`}>
          {activeTab === 'dashboard' && (
            <>
              {/* Quick Statistics Grid */}
              <section className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 sm:gap-5">
                {[
                  {
                    label: 'This Month Revenue',
                    value: formatINRCompact(thisMonthRevenue),
                    sub: monthOverMonth === null
                      ? 'No data last month'
                      : `${monthOverMonth >= 0 ? '+' : ''}${monthOverMonth.toFixed(1)}% vs last month`,
                    subTone: monthOverMonth === null ? 'neutral' : monthOverMonth >= 0 ? 'good' : 'bad',
                    icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
                    bg: 'bg-amber-100', iconColor: 'text-amber-700',
                    usdValue: formatUSDdash(toUSDdashboard(thisMonthRevenue)),
                    tab: 'reports'
                  },
                  {
                    label: 'Active Bookings',
                    value: bookings.filter(b => (b.status || 'Pending') !== 'Cancelled').length.toString(),
                    sub: `${bookings.filter(b => b.status === 'Pending').length} pending`,
                    subTone: 'neutral',
                    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
                    bg: 'bg-orange-100', iconColor: 'text-orange-700',
                    tab: 'bookings'
                  },
                  {
                    label: 'Outstanding Payments',
                    value: formatINRCompact(outstandingRevenue),
                    sub: 'Awaiting collection',
                    subTone: 'bad',
                    icon: 'M12 2a10 10 0 100 20 10 10 0 000-20zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z',
                    bg: 'bg-rose-100', iconColor: 'text-rose-700',
                    usdValue: formatUSDdash(toUSDdashboard(outstandingRevenue)),
                    tab: 'bookings'
                  },
                  {
                    label: 'Departures (14d)',
                    value: (totalDepartures14dCount > 0 ? totalDepartures14dCount : upcomingGroupDepartures.length).toString(),
                    sub: totalDepartures14dCount > 0 
                      ? `${totalDepartures14dCount} trips this window` 
                      : (upcomingGroupDepartures.length > 0 ? `${upcomingGroupDepartures.length} upcoming group tours` : 'No upcoming trips'),
                    subTone: (totalDepartures14dCount > 0 || upcomingGroupDepartures.length > 0) ? 'good' : 'neutral',
                    icon: 'M12 19V5m0 0l-7 7m7-7l7 7',
                    bg: 'bg-emerald-100', iconColor: 'text-emerald-700',
                    tab: 'groupDepartures'
                  },
                  {
                    label: 'Avg Booking Value',
                    value: formatINRCompact(avgBookingValue),
                    sub: `${bookings.length} total bookings`,
                    subTone: 'neutral',
                    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
                    bg: 'bg-blue-100', iconColor: 'text-blue-700',
                    usdValue: formatUSDdash(toUSDdashboard(avgBookingValue)),
                    tab: 'reports'
                  },
                  {
                    label: 'New Clients (Month)',
                    value: newClientsThisMonth.toString(),
                    sub: `${clients.length} total profiles`,
                    subTone: 'neutral',
                    icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0M3 20a6 6 0 0112 0v1H3v-1z',
                    bg: 'bg-stone-100', iconColor: 'text-stone-700',
                    tab: 'clients'
                  }
                ].map((stat, i) => (
                  <div
                    key={i}
                    onClick={() => { if (stat.tab) setActiveTab(stat.tab) }}
                    className="bg-white border border-stone-200/60 rounded-xl p-4 sm:p-5 hover:border-amber-200/50 hover:shadow-md transition-all duration-300 shadow-sm group cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <span className="text-[11px] font-semibold text-stone-500 group-hover:text-stone-700 transition-colors leading-tight">
                        {stat.label}
                      </span>
                      <div className={`w-8 h-8 rounded-lg ${stat.bg} ${stat.iconColor} flex items-center justify-center shrink-0`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d={stat.icon} />
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-xl font-bold text-stone-900 mb-1.5 tracking-tight">
                      {stat.value}
                    </h3>
                    {inrToUsdRate > 0 && stat.usdValue && (
                      <p className="text-[10px] font-medium text-stone-400 -mt-1 mb-1.5">{stat.usdValue}</p>
                    )}
                    <div className="flex items-center gap-1.5">
                      {stat.subTone === 'good' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />}
                      {stat.subTone === 'bad' && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />}
                      <p className={`text-[11px] font-medium ${
                        stat.subTone === 'good' ? 'text-emerald-600' :
                        stat.subTone === 'bad'  ? 'text-rose-600' :
                                                 'text-stone-400'
                      }`}>
                        {stat.sub}
                      </p>
                    </div>
                  </div>
                ))}
              </section>

              {/* Bookings & Analytics Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                {/* Left: Bookings Table & Analytics (2 cols) */}
                <div className="lg:col-span-2 space-y-8">
                  {/* Bookings List */}
                  <section className="bg-white border border-stone-200/80 rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-stone-200/50 flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-stone-900 tracking-tight">
                          Recent Bookings
                        </h3>
                        <p className="text-xs text-stone-400">
                          Live status of client package bookings and invoices.
                        </p>
                      </div>
                      <button 
                        onClick={() => setActiveTab('bookings')}
                        className="text-xs text-amber-700 hover:text-amber-600 font-bold cursor-pointer"
                      >
                        View All
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-stone-50/50 border-b border-stone-200/50 text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                            <th className="py-3 px-6">ID</th>
                            <th className="py-3 px-6">Client</th>
                            <th className="py-3 px-6">Package</th>
                            <th className="py-3 px-6">Amount</th>
                            <th className="py-3 px-6">Departure</th>
                            <th className="py-3 px-6 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {filteredBookings.length > 0 ? (
                            filteredBookings.slice(0, 5).map((b) => (
                              <tr
                                key={b.id}
                                onClick={() => {
                                  setInitialSelectedBookingId(b.id)
                                  setActiveTab('bookings')
                                }}
                                className="hover:bg-amber-50/30 transition-colors duration-200 text-xs cursor-pointer"
                              >
                                <td className="py-3.5 px-6 font-mono text-[11px] text-stone-500">{b.id}</td>
                                <td className="py-3.5 px-6 font-semibold text-stone-900">{b.client}</td>
                                <td className="py-3.5 px-6 text-stone-600">{b.package}</td>
                                <td className="py-3.5 px-6 font-bold text-stone-800">₹{Number(b.amount).toLocaleString('en-IN')}</td>
                                <td className="py-3.5 px-6 text-stone-500">{b.date}</td>
                                <td className="py-3.5 px-6 text-right">
                                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                                    b.status === 'Paid'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200/40'
                                      : 'bg-amber-50 text-amber-700 border-amber-200/40'
                                  }`}>
                                    {b.status}
                                  </span>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="6" className="py-8 text-center text-stone-400">
                                No bookings match the search criteria.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  {/* Upcoming Scheduled Departures */}
                  <section className="bg-white border border-stone-200/80 rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-stone-200/50 flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-stone-900 tracking-tight">
                          Upcoming Scheduled Departures
                        </h3>
                        <p className="text-xs text-stone-400">
                          Fixed-date group departures, seat capacity, and itinerary schedule.
                        </p>
                      </div>
                      <button 
                        onClick={() => setActiveTab('groupDepartures')}
                        className="text-xs text-amber-700 hover:text-amber-600 font-bold cursor-pointer"
                      >
                        View All ({groupDepartures.length})
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-stone-50/50 border-b border-stone-200/50 text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                            <th className="py-3 px-6">Departure & Package</th>
                            <th className="py-3 px-6">Date Range</th>
                            <th className="py-3 px-6">Slots Booked</th>
                            <th className="py-3 px-6">Price</th>
                            <th className="py-3 px-6 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {groupDepartures.length > 0 ? (
                            groupDepartures.slice(0, 5).map((dep) => {
                              const slots = dep.slots || { booked: dep.slotsBooked || 0, total: dep.slotsTotal || 20 }
                              const pct = Math.min(100, Math.round(((slots.booked || 0) / (slots.total || 1)) * 100)) || 0
                              const depDate = dep.departureDate ? new Date(dep.departureDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : '—'
                              const retDate = dep.returnDate ? new Date(dep.returnDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
                              const basePrice = dep.packageBasePrice || 0
                              const finalPrice = basePrice + (dep.priceModifier || 0)

                              return (
                                <tr
                                  key={dep.id}
                                  onClick={() => setActiveTab('groupDepartures')}
                                  className="hover:bg-amber-50/30 transition-colors duration-200 text-xs cursor-pointer"
                                >
                                  <td className="py-3.5 px-6">
                                    <span className="font-semibold text-stone-900 block">{dep.title}</span>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-[11px] text-stone-500">{dep.packageName || 'Group Tour'}</span>
                                      {dep.itinerary && dep.itinerary.length > 0 && (
                                        <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200/50">
                                          {dep.itinerary.length}D
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-6 font-medium text-stone-600">
                                    {depDate} — {retDate}
                                  </td>
                                  <td className="py-3.5 px-6">
                                    <div className="flex items-center gap-2 max-w-[120px]">
                                      <div className="flex-1 bg-stone-100 rounded-full h-1.5 overflow-hidden">
                                        <div className="bg-amber-600 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                                      </div>
                                      <span className="text-[11px] font-semibold text-stone-600 shrink-0">
                                        {slots.booked}/{slots.total}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-6 font-bold text-stone-800">
                                    {finalPrice > 0 ? `₹${finalPrice.toLocaleString('en-IN')}` : '—'}
                                  </td>
                                  <td className="py-3.5 px-6 text-right">
                                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                                      dep.status === 'scheduled' || dep.status === 'confirmed'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200/40'
                                        : 'bg-stone-100 text-stone-600 border-stone-200/40'
                                    }`}>
                                      {dep.status || 'scheduled'}
                                    </span>
                                  </td>
                                </tr>
                              )
                            })
                          ) : (
                            <tr>
                              <td colSpan="5" className="py-8 text-center text-stone-400">
                                No scheduled group departures found.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  {/* Monthly Revenue Chart */}
                  <section className="bg-white border border-stone-200/80 rounded-2xl p-6 shadow-sm space-y-6">
                    <div>
                      <h3 className="text-base font-bold text-stone-900 tracking-tight">
                        Monthly Revenue Distribution
                      </h3>
                      <p className="text-xs text-stone-400">
                        Gross monthly bookings (INR) — rolling 6-month view.
                      </p>
                    </div>

                    {/* Minimal CSS Bar Chart */}
                    <div className="flex items-end justify-between h-36 sm:h-48 pt-4 px-1 sm:px-2 border-b border-stone-100">
                      {chartData.map((data, idx) => (
                        <div key={idx} className="flex flex-col items-center justify-end flex-1 group h-full">
                           {/* Hover Tooltip */}
                          <span className="opacity-0 group-hover:opacity-100 bg-stone-900 text-white text-[9px] font-bold px-2 py-0.5 rounded mb-2 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0 shadow">
                            {data.label}
                          </span>
                          {/* Bar */}
                          <div
                            style={{ height: `${Math.min(100, (data.revenue / maxRevenueVal) * 100)}%` }}
                            className="w-6 sm:w-10 bg-amber-500/20 group-hover:bg-amber-500 rounded-t-md transition-all duration-500 ease-out shadow-sm border border-transparent group-hover:border-amber-600/10"
                          ></div>
                          {/* Month Label */}
                          <span className="text-[10px] text-stone-400 group-hover:text-stone-700 font-medium mt-3 transition-colors duration-300">
                            {data.month}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                {/* Right Column: Destination Hub & Actions (1 col) */}
                <div className="space-y-8">
                  {/* Destination Hotspots */}
                  <section className="bg-white border border-stone-200/80 rounded-2xl p-6 shadow-sm space-y-5">
                    <div>
                      <h3 className="text-base font-bold text-stone-900 tracking-tight">
                        Destination Activity
                      </h3>
                      <p className="text-xs text-stone-400">
                        Count of active travelers currently in transit.
                      </p>
                    </div>

                    <div className="space-y-3">
                      {activeDestinations.map((dest, i) => (
                        <div
                          key={i}
                          onClick={() => setActiveTab('packages')}
                          className="flex items-center justify-between p-3.5 bg-[#FAF9F5]/40 rounded-xl border border-stone-200/30 cursor-pointer hover:border-amber-200/50 hover:shadow-sm transition-all duration-300 group"
                        >
                          <div>
                            <h4 className="text-xs font-bold text-stone-900 group-hover:text-amber-700 transition-colors">{dest.name}</h4>
                            <span className="text-[10px] text-stone-400">{dest.trend}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold px-3 py-1 rounded-lg ${dest.color} border border-stone-200/10 shadow-inner`}>
                              {dest.count} Travelers
                            </span>
                            <svg className="w-3.5 h-3.5 text-stone-300 group-hover:text-amber-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Pending Follow-ups Panel */}
                  <section className="bg-white border border-stone-200/80 rounded-2xl p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-stone-900 tracking-tight">
                          Pending Follow-ups
                        </h3>
                        <p className="text-xs text-stone-400">
                          Clients not contacted in the last 7 days.
                        </p>
                      </div>
                      <span className="text-xs font-bold px-2 py-1 bg-amber-50 text-amber-700 rounded-lg border border-amber-200/20">
                        {pendingFollowUps.length}
                      </span>
                    </div>

                    <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                      {pendingFollowUps.length === 0 ? (
                        <p className="text-xs text-stone-400 italic text-center py-6">
                          All clients are up to date!
                        </p>
                      ) : (
                        pendingFollowUps.map((client, i) => {
                          const days = client.lastContact 
                            ? Math.floor((now.getTime() - new Date(client.lastContact).getTime()) / (1000 * 60 * 60 * 24))
                            : null;
                          const contactText = days === null 
                            ? 'Never contacted' 
                            : `${days} days ago`;
                          return (
                            <div key={i} className="flex items-center justify-between p-3.5 bg-[#FAF9F5]/40 rounded-xl border border-stone-200/30">
                              <div className="min-w-0 flex-1 mr-2">
                                <h4 className="text-xs font-bold text-stone-900 truncate">{client.name}</h4>
                                <span className="text-[10px] text-stone-400">
                                  {contactText}
                                </span>
                              </div>
                              <button
                                onClick={() => {
                                  setSelectedClientIdForCRM(client.id)
                                  setActiveTab('clients')
                                }}
                                className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-[10px] font-bold transition-all shrink-0 cursor-pointer"
                              >
                                Follow Up
                              </button>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </section>

                  {/* Quick Actions Panel */}
                  <section className="bg-white border border-stone-200/80 rounded-2xl p-6 shadow-sm space-y-4">
                    <div>
                      <h3 className="text-base font-bold text-stone-900 tracking-tight">
                        Agency Actions
                      </h3>
                      <p className="text-xs text-stone-400">
                        Quick operations for managing listings.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <button 
                        onClick={() => setActiveTab('bookings')}
                        className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-sm active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        New Client Booking
                      </button>
                      <button 
                        onClick={() => setActiveTab('groupDepartures')}
                        className="w-full py-2.5 px-4 bg-white hover:bg-stone-50 border border-stone-200/70 text-stone-700 rounded-xl text-xs font-bold shadow-sm active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <svg className="w-4.5 h-4.5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        New Group Departure
                      </button>
                      <button 
                        onClick={() => setActiveTab('reports')}
                        className="w-full py-2.5 px-4 bg-white hover:bg-stone-50 border border-stone-200/70 text-stone-700 rounded-xl text-xs font-bold shadow-sm active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <svg className="w-4.5 h-4.5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Export Revenue Report
                      </button>
                    </div>
                  </section>
                </div>
              </div>
            </>
          )}

          {activeTab === 'bookings' && (
            <BookingsPage 
              bookings={bookings} 
              setBookings={setBookings} 
              clients={clients}
              setClients={setClients}
              packages={packages}
              setPackages={setPackages}
              settings={settings}
              addNotification={addNotification}
              bookingDraft={bookingDraft}
              setBookingDraft={setBookingDraft}
              initialSelectedBookingId={initialSelectedBookingId}
              onSelectBooking={setInitialSelectedBookingId}
              user={user}
              token={token}
            />
          )}

          {activeTab === 'corporateLeads' && (
            <CorporateLeadsPage
              addNotification={addNotification}
              token={token}
              user={user}
              setActiveTab={setActiveTab}
              onConvertToBooking={(lead) => {
                const parsedPkg = lead.packageName || null
                const guests = lead.groupSize || 1
                setBookingDraft({
                  client: lead.name,
                  package: parsedPkg,
                  guests,
                })
              }}
            />
          )}

          {activeTab === 'clients' && (
            <ClientsPage 
              clients={clients}
              setClients={setClients}
              bookings={bookings}
              addNotification={addNotification}
              user={user}
              initialSelectedClientId={selectedClientIdForCRM}
              onSelectClient={setSelectedClientIdForCRM}
              onBookForClient={(clientName) => {
                setBookingDraft({ client: clientName, package: '' })
                setActiveTab('bookings')
              }}
            />
          )}

          {activeTab === 'packages' && (
            <PackagesPage 
              packages={packages}
              setPackages={setPackages}
              groupDepartures={groupDepartures}
              setGroupDepartures={setGroupDepartures}
              clients={clients}
              bookings={bookings}
              setBookings={setBookings}
              settings={settings}
              addNotification={addNotification}
              onBookForPackage={(packageName) => {
                setBookingDraft({ client: '', package: packageName })
                setActiveTab('bookings')
              }}
              user={user}
              token={token}
              initialSelectedPackageId={initialSelectedPackageId}
              onSelectPackage={setInitialSelectedPackageId}
            />
          )}

          {activeTab === 'corporatePackages' && (
            <CorporatePackagesPage
              corporatePackages={corporatePackages}
              setCorporatePackages={setCorporatePackages}
              addNotification={addNotification}
              user={user}
            />
          )}

          {activeTab === 'groupDepartures' && (
            <GroupDeparturesPage
              groupDepartures={groupDepartures}
              setGroupDepartures={setGroupDepartures}
              packages={packages}
              setPackages={setPackages}
              addNotification={addNotification}
              user={user}
            />
          )}

          {activeTab === 'enquiries' && (
            <EnquiriesPage
              token={token}
              API_URL={API_URL}
              authHeaders={authHeaders}
              addNotification={addNotification}
              clients={clients}
              setClients={setClients}
              packages={packages}
              onSelectEnquiry={(id) => {
                setSelectedEnquiryIdForModal(id)
                window.history.pushState({ tab: 'enquiries', enquiryId: id }, '', `/enquiries/${id}`)
              }}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsPage 
              bookings={bookings}
              packages={packages}
              clients={clients}
              settings={settings}
              user={user}
            />
          )}

          {activeTab === 'testimonials' && (
            <TestimonialsPage 
              testimonials={testimonials}
              setTestimonials={setTestimonials}
              addNotification={addNotification}
              packages={packages}
              user={user}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsPage 
              settings={settings}
              setSettings={setSettings}
              addNotification={addNotification}
              packages={packages}
              user={user}
            />
          )}

          {activeTab === 'team' && (
            <TeamPage
              addNotification={addNotification}
              token={token}
              user={user}
            />
          )}

          {activeTab === 'approvals' && (
            <ApprovalsPage
              user={user}
              addNotification={addNotification}
              token={token}
              initialApprovalId={initialApprovalId}
              initialFilter={initialApprovalFilter}
            />
          )}
        </div>
      </main>

      {/* Toast notifications — bottom-right, fixed */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-3 rounded-xl shadow-xl border text-xs font-medium animate-in slide-in-from-right-full fade-in duration-300 ${
              t.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
            role="alert"
          >
            <div className="flex items-start gap-2">
              <span className="font-bold uppercase tracking-wider text-[9px] shrink-0">
                {t.type === 'error' ? 'Error' : 'Warning'}
              </span>
              <span className="flex-1">{t.text}</span>
              <button
                onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                className="text-stone-400 hover:text-stone-700 ml-2 shrink-0"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      <EnquiryDetailModal
        enquiryId={selectedEnquiryIdForModal}
        isOpen={!!selectedEnquiryIdForModal}
        onClose={() => {
          setSelectedEnquiryIdForModal(null)
          window.history.pushState({ tab: activeTab }, '', `#${activeTab}`)
        }}
        token={token}
        addNotification={addNotification}
        setBookingDraft={setBookingDraft}
        setActiveTab={setActiveTab}
      />
    </div>
  )
}

export default App

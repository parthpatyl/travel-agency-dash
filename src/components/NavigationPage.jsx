import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cropAndCompressImage, formatFileSize } from '../utils/imageCompressor'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const DEFAULT_CAROUSEL_ITEMS = [
  { id: 'switzerland', name: 'Switzerland', region: 'Europe', search: 'Switzerland', image: '/assets/unsplash-swiss-alps.jpg', tourCount: '2 tours', isActive: true },
  { id: 'japan', name: 'Japan', region: 'Asia', search: 'Japan', image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=400&q=80', tourCount: '3 tours', isActive: true },
  { id: 'dubai', name: 'Dubai & UAE', region: 'Middle East', search: 'Dubai', image: '/assets/unsplash-dubai.jpg', tourCount: 'Coming soon', isActive: true },
  { id: 'bali', name: 'Bali & Indo', region: 'Asia', search: 'Bali', image: '/assets/unsplash-bali.jpg', tourCount: '3 tours', isActive: true },
  { id: 'greece', name: 'Greece', region: 'Europe', search: 'Greece', image: '/assets/unsplash-greece.jpg', tourCount: '2 tours', isActive: true },
  { id: 'italy', name: 'Italy & Amalfi', region: 'Europe', search: 'Italy', image: '/assets/unsplash-amalfi.jpg', tourCount: '2 tours', isActive: true },
  { id: 'iceland', name: 'Iceland', region: 'Europe', search: 'Iceland', image: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=400&q=80', tourCount: '2 tours', isActive: true },
  { id: 'kashmir', name: 'Kashmir, India', region: 'India', search: 'Kashmir', image: '/assets/unsplash-kashmir.png', tourCount: '1 tour', isActive: true },
  { id: 'africa', name: 'Serengeti Safari', region: 'Africa', search: 'Safari', image: '/assets/unsplash-african-safari.jpg', tourCount: '1 tour', isActive: true },
  { id: 'vietnam', name: 'Vietnam', region: 'Asia', search: 'Vietnam', image: '/assets/unsplash-pkg-card.jpg', tourCount: '3 tours', isActive: true }
]

export default function NavigationPage({ token, addNotification, user }) {
  const [menu, setMenu] = useState([])
  const [baselineMenu, setBaselineMenu] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewSubTab, setPreviewSubTab] = useState('nav') // 'nav' | 'highlights' | 'carousel'

  // Selection states for hierarchical drill-down
  const [selectedTopItemId, setSelectedTopItemId] = useState(null)
  const [selectedRegionId, setSelectedRegionId] = useState(null)

  // Modals for adding items
  const [addTopModalOpen, setAddTopModalOpen] = useState(false)
  const [newTopItem, setNewTopItem] = useState({ label: '', type: 'megamenu', page: 'destinations', isSplit: true })

  const [addRegionModalOpen, setAddRegionModalOpen] = useState(false)
  const [newRegion, setNewRegion] = useState({ name: '', id: '', search: '' })

  const [addColumnModalOpen, setAddColumnModalOpen] = useState(false)
  const [newColumnName, setNewColumnName] = useState('')

  const [addCityModalOpen, setAddCityModalOpen] = useState(false)
  const [activeCountryIndex, setActiveCountryIndex] = useState(null)
  const [newCity, setNewCity] = useState({ label: '', search: '' })

  // Tour Highlights Management states
  const [highlightModalOpen, setHighlightModalOpen] = useState(false)
  const [editingHighlight, setEditingHighlight] = useState(null)
  const [highlightForm, setHighlightForm] = useState({ title: '', region: 'Europe', destination: '', active: true })

  // Explore Destinations Carousel states
  const [carouselItems, setCarouselItems] = useState(DEFAULT_CAROUSEL_ITEMS)
  const [baselineCarousel, setBaselineCarousel] = useState(null)
  const [carouselModalOpen, setCarouselModalOpen] = useState(false)
  const [editingCarouselItem, setEditingCarouselItem] = useState(null)
  const [carouselForm, setCarouselForm] = useState({ name: '', region: 'Europe', search: '', tourCount: '', image: '', isActive: true })
  const [carouselUploading, setCarouselUploading] = useState(false)
  const [carouselCompressionInfo, setCarouselCompressionInfo] = useState(null)
  const carouselFileInputRef = useRef(null)

  // Fetch navigation & destination carousel data
  const fetchNavigation = async () => {
    setLoading(true)
    try {
      const [res, carRes] = await Promise.all([
        fetch(`${API_URL}/api/navigation`),
        fetch(`${API_URL}/api/navigation/carousel`).catch(() => null)
      ])

      if (!res.ok) throw new Error('Failed to load navigation menu')
      const data = await res.json()
      const menuArray = Array.isArray(data) ? data : (Array.isArray(data?.menu) ? data.menu : [])
      setMenu(menuArray)
      setBaselineMenu(JSON.parse(JSON.stringify(menuArray)))
      if (menuArray.length > 0) {
        setSelectedTopItemId(menuArray[0].id)
        if (menuArray[0].continents && menuArray[0].continents.length > 0) {
          setSelectedRegionId(menuArray[0].continents[0].id)
        }
      }

      if (carRes && carRes.ok) {
        const carData = await carRes.json()
        if (Array.isArray(carData) && carData.length > 0) {
          setCarouselItems(carData)
          setBaselineCarousel(JSON.parse(JSON.stringify(carData)))
        } else {
          setBaselineCarousel(JSON.parse(JSON.stringify(DEFAULT_CAROUSEL_ITEMS)))
        }
      } else {
        setBaselineCarousel(JSON.parse(JSON.stringify(DEFAULT_CAROUSEL_ITEMS)))
      }
    } catch (err) {
      addNotification?.({ type: 'error', message: 'Error loading navigation menu: ' + err.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNavigation()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle ESC key and body scroll locking when any modal is open
  const isAnyModalOpen = showPreview || showResetConfirm || addTopModalOpen || addRegionModalOpen || addColumnModalOpen || addCityModalOpen || highlightModalOpen || carouselModalOpen

  useEffect(() => {
    if (!isAnyModalOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowPreview(false)
        setShowResetConfirm(false)
        setAddTopModalOpen(false)
        setAddRegionModalOpen(false)
        setAddColumnModalOpen(false)
        setAddCityModalOpen(false)
        setHighlightModalOpen(false)
        setCarouselModalOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    const origOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = origOverflow
    }
  }, [isAnyModalOpen])

  // Dirty state tracking across menu & carousel
  const isDirty = useMemo(() => {
    const menuChanged = baselineMenu && JSON.stringify(menu) !== JSON.stringify(baselineMenu)
    const carouselChanged = baselineCarousel && JSON.stringify(carouselItems) !== JSON.stringify(baselineCarousel)
    return Boolean(menuChanged || carouselChanged)
  }, [menu, baselineMenu, carouselItems, baselineCarousel])

  // Save changes to backend
  const handleSave = async () => {
    setSaving(true)
    try {
      const [res, carRes] = await Promise.all([
        fetch(`${API_URL}/api/navigation`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify(menu)
        }),
        fetch(`${API_URL}/api/navigation/carousel`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify(carouselItems)
        })
      ])

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to save navigation')
      }

      const updated = await res.json()
      setMenu(updated)
      setBaselineMenu(JSON.parse(JSON.stringify(updated)))

      if (carRes && carRes.ok) {
        const carUpdated = await carRes.json()
        setCarouselItems(carUpdated)
        setBaselineCarousel(JSON.parse(JSON.stringify(carUpdated)))
      }

      addNotification?.({ type: 'success', message: 'Navigation menu & destination carousel successfully published live!' })
    } catch (err) {
      addNotification?.({ type: 'error', message: err.message })
    } finally {
      setSaving(false)
    }
  }

  // Reset to original defaults
  const handleReset = async () => {
    setResetting(true)
    try {
      const res = await fetch(`${API_URL}/api/navigation/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to reset navigation')
      }

      const defaults = await res.json()
      setMenu(defaults)
      setBaselineMenu(JSON.parse(JSON.stringify(defaults)))

      setCarouselItems(DEFAULT_CAROUSEL_ITEMS)
      setBaselineCarousel(JSON.parse(JSON.stringify(DEFAULT_CAROUSEL_ITEMS)))

      if (defaults.length > 0) {
        setSelectedTopItemId(defaults[0].id)
        if (defaults[0].continents && defaults[0].continents.length > 0) {
          setSelectedRegionId(defaults[0].continents[0].id)
        }
      }
      addNotification?.({ type: 'info', message: 'Navigation & carousel reset to original defaults' })
    } catch (err) {
      addNotification?.({ type: 'error', message: err.message })
    } finally {
      setResetting(false)
      setShowResetConfirm(false)
    }
  }

  // Destination Carousel management handlers
  const handleOpenAddCarousel = () => {
    setEditingCarouselItem(null)
    setCarouselForm({
      name: '',
      region: 'Europe',
      search: '',
      tourCount: '',
      image: '',
      isActive: true
    })
    setCarouselCompressionInfo(null)
    setCarouselModalOpen(true)
  }

  const handleOpenEditCarousel = (item) => {
    setEditingCarouselItem(item)
    setCarouselForm({
      name: item.name || '',
      region: item.region || 'Europe',
      search: item.search || item.name || '',
      tourCount: item.tourCount || '',
      image: item.image || '',
      isActive: item.isActive !== false
    })
    setCarouselCompressionInfo(null)
    setCarouselModalOpen(true)
  }

  const handleSaveCarouselItem = (e) => {
    e.preventDefault()
    if (!carouselForm.name.trim()) return

    const newItem = {
      id: editingCarouselItem?.id || carouselForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: carouselForm.name.trim(),
      region: carouselForm.region.trim() || 'Europe',
      search: carouselForm.search.trim() || carouselForm.name.trim(),
      tourCount: carouselForm.tourCount.trim(),
      image: carouselForm.image.trim(),
      isActive: carouselForm.isActive !== false
    }

    if (editingCarouselItem) {
      setCarouselItems(prev => prev.map(item => item.id === editingCarouselItem.id ? newItem : item))
      addNotification?.({ type: 'success', message: `Updated "${newItem.name}" carousel item` })
    } else {
      setCarouselItems(prev => [...prev, newItem])
      addNotification?.({ type: 'success', message: `Added "${newItem.name}" to destination carousel` })
    }
    setCarouselModalOpen(false)
  }

  const handleDeleteCarouselItem = (id) => {
    if (!window.confirm('Are you sure you want to delete this destination from the carousel?')) return
    setCarouselItems(prev => prev.filter(item => item.id !== id))
    addNotification?.({ type: 'info', message: 'Removed destination from carousel' })
  }

  const handleToggleCarouselActive = (id) => {
    setCarouselItems(prev => prev.map(item => item.id === id ? { ...item, isActive: !item.isActive } : item))
  }

  const handleMoveCarouselItem = (index, dir) => {
    const target = index + dir
    if (target < 0 || target >= carouselItems.length) return
    const updated = [...carouselItems]
    const temp = updated[index]
    updated[index] = updated[target]
    updated[target] = temp
    setCarouselItems(updated)
  }

  const handleCarouselImageSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setCarouselUploading(true)
      const originalSize = file.size

      // 1:1 circular bubble center crop & WebP compression (400x400 max, <80KB)
      const compressedFile = await cropAndCompressImage(file, {
        aspectRatio: 1,
        maxWidth: 400,
        maxHeight: 400,
        quality: 0.82,
        format: 'image/webp'
      })

      const compressedSize = compressedFile.size
      setCarouselCompressionInfo({
        original: formatFileSize(originalSize),
        compressed: formatFileSize(compressedSize),
        savings: Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100))
      })

      const formData = new FormData()
      formData.append('image', compressedFile)

      const headers = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        headers,
        body: formData
      })

      if (!res.ok) throw new Error('Upload failed')

      const data = await res.json()
      const uploadedUrl = data.imageUrl?.startsWith('http')
        ? data.imageUrl
        : `${API_URL}${data.imageUrl}`

      setCarouselForm(prev => ({ ...prev, image: uploadedUrl }))
      addNotification?.({ type: 'success', message: 'Image center-cropped to 1:1 circle & compressed to WebP' })
    } catch (err) {
      addNotification?.({ type: 'error', message: 'Failed to process image: ' + err.message })
    } finally {
      setCarouselUploading(false)
      if (carouselFileInputRef.current) carouselFileInputRef.current.value = ''
    }
  }

  // Selected entities
  const safeMenu = Array.isArray(menu) ? menu : []
  const selectedTopItem = safeMenu.find(item => item.id === selectedTopItemId) || safeMenu[0]
  const selectedRegion = selectedTopItem?.continents?.find(r => r.id === selectedRegionId) || selectedTopItem?.continents?.[0]

  // Update selected region when selected top item changes
  const handleSelectTopItem = (id) => {
    setSelectedTopItemId(id)
    const item = safeMenu.find(i => i.id === id)
    if (item && item.continents && item.continents.length > 0) {
      setSelectedRegionId(item.continents[0].id)
    } else {
      setSelectedRegionId(null)
    }
  }

  // Helpers for deep state updates
  const updateMenu = (updater) => {
    setMenu(prev => updater([...prev]))
  }

  // Top Item Mutators
  const toggleTopItemVisibility = (id) => {
    updateMenu(prev => prev.map(item => item.id === id ? { ...item, visible: item.visible === false ? true : false } : item))
  }

  const moveTopItem = (index, dir) => {
    const targetIdx = index + dir
    if (targetIdx < 0 || targetIdx >= menu.length) return
    updateMenu(prev => {
      const next = [...prev]
      const temp = next[index]
      next[index] = next[targetIdx]
      next[targetIdx] = temp
      return next
    })
  }

  const deleteTopItem = (id) => {
    if (!window.confirm('Are you sure you want to delete this navigation item and all its sub-destinations?')) return
    updateMenu(prev => {
      const next = prev.filter(item => item.id !== id)
      if (selectedTopItemId === id && next.length > 0) {
        setSelectedTopItemId(next[0].id)
        setSelectedRegionId(next[0].continents?.[0]?.id || null)
      }
      return next
    })
  }

  const handleAddTopItem = () => {
    if (!newTopItem.label.trim()) return
    const id = newTopItem.label.toLowerCase().replace(/[^a-z0-9]+/g, '_')
    const itemToAdd = {
      id,
      label: newTopItem.label.trim(),
      type: newTopItem.type,
      visible: true,
      ...(newTopItem.type === 'megamenu' ? {
        isSplit: true,
        topTabs: [],
        continents: []
      } : newTopItem.type === 'dropdown' ? {
        columns: [{ heading: 'Featured Trips', links: [] }]
      } : {
        page: newTopItem.page || 'destinations'
      })
    }
    updateMenu(prev => [...prev, itemToAdd])
    setSelectedTopItemId(id)
    setSelectedRegionId(null)
    setAddTopModalOpen(false)
    setNewTopItem({ label: '', type: 'megamenu', page: 'destinations', isSplit: true })
  }

  // ── Tour Highlights Mutators ──
  const getHighlights = (item) => {
    if (!item) return []
    if (Array.isArray(item.tourHighlights)) return item.tourHighlights
    if (item.columns?.[0]?.links) {
      return item.columns[0].links.map((l, i) => ({
        id: `th-${i + 1}`,
        title: l.label,
        region: l.region || 'Europe',
        destination: l.search || l.label,
        active: true
      }))
    }
    return [
      { id: 'th-1', title: 'Santorini Sunset Cruise', region: 'Europe', destination: 'Greece', active: true },
      { id: 'th-2', title: 'Glacier Express Scenic Rail', region: 'Europe', destination: 'Switzerland', active: true },
      { id: 'th-3', title: 'Pangong Lake Luxury Camp', region: 'India', destination: 'Ladakh', active: true }
    ]
  }

  const setTopItemHighlights = (newHighlights) => {
    if (!selectedTopItem) return
    updateMenu(prev => prev.map(item => {
      if (item.id !== selectedTopItem.id) return item
      const updatedLinks = newHighlights
        .filter(h => h.active)
        .map(h => ({
          label: h.title,
          page: 'destinations',
          region: h.region,
          search: h.destination
        }))
      return {
        ...item,
        tourHighlights: newHighlights,
        columns: item.columns ? [{ ...item.columns[0], links: updatedLinks }] : [{ heading: 'Popular Group Expeditions', links: updatedLinks }]
      }
    }))
  }

  const toggleHighlightActive = (highlightId) => {
    const current = getHighlights(selectedTopItem)
    const next = current.map(h => h.id === highlightId ? { ...h, active: !h.active } : h)
    setTopItemHighlights(next)
  }

  const moveHighlight = (index, dir) => {
    const current = getHighlights(selectedTopItem)
    const targetIdx = index + dir
    if (targetIdx < 0 || targetIdx >= current.length) return
    const next = [...current]
    const temp = next[index]
    next[index] = next[targetIdx]
    next[targetIdx] = temp
    setTopItemHighlights(next)
  }

  const deleteHighlight = (highlightId) => {
    const current = getHighlights(selectedTopItem)
    const next = current.filter(h => h.id !== highlightId)
    setTopItemHighlights(next)
  }

  const handleSaveHighlight = () => {
    if (!highlightForm.title.trim()) return
    const current = getHighlights(selectedTopItem)
    if (editingHighlight?.id) {
      const next = current.map(h => h.id === editingHighlight.id ? { ...h, ...highlightForm } : h)
      setTopItemHighlights(next)
    } else {
      const newH = {
        id: `th-${Date.now()}`,
        title: highlightForm.title.trim(),
        region: highlightForm.region || 'Europe',
        destination: highlightForm.destination.trim() || highlightForm.title.trim(),
        active: highlightForm.active !== false
      }
      setTopItemHighlights([...current, newH])
    }
    setHighlightModalOpen(false)
    setEditingHighlight(null)
  }

  // Region Mutators
  const toggleRegionVisibility = (regionId) => {
    updateMenu(prev => prev.map(item => {
      if (item.id !== selectedTopItem.id) return item
      return {
        ...item,
        continents: item.continents.map(r => r.id === regionId ? { ...r, visible: r.visible === false ? true : false } : r)
      }
    }))
  }

  const moveRegion = (index, dir) => {
    if (!selectedTopItem?.continents) return
    const targetIdx = index + dir
    if (targetIdx < 0 || targetIdx >= selectedTopItem.continents.length) return
    updateMenu(prev => prev.map(item => {
      if (item.id !== selectedTopItem.id) return item
      const list = [...item.continents]
      const temp = list[index]
      list[index] = list[targetIdx]
      list[targetIdx] = temp
      return { ...item, continents: list }
    }))
  }

  const deleteRegion = (regionId) => {
    if (!window.confirm('Delete this regional category and all of its countries/states?')) return
    updateMenu(prev => prev.map(item => {
      if (item.id !== selectedTopItem.id) return item
      const filtered = item.continents.filter(r => r.id !== regionId)
      if (selectedRegionId === regionId) {
        setSelectedRegionId(filtered[0]?.id || null)
      }
      return { ...item, continents: filtered }
    }))
  }

  const handleAddRegion = () => {
    if (!newRegion.name.trim() || !selectedTopItem) return
    const id = newRegion.id.trim() || newRegion.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const regionObj = {
      id,
      name: newRegion.name.trim(),
      visible: true,
      allLink: {
        label: `All of ${newRegion.name.trim()}`,
        region: 'Asia',
        search: newRegion.search.trim() || newRegion.name.trim()
      },
      countries: []
    }
    updateMenu(prev => prev.map(item => {
      if (item.id !== selectedTopItem.id) return item
      return { ...item, continents: [...(item.continents || []), regionObj] }
    }))
    setSelectedRegionId(id)
    setAddRegionModalOpen(false)
    setNewRegion({ name: '', id: '', search: '' })
  }

  // Country / State Column Mutators
  const handleAddColumn = () => {
    if (!newColumnName.trim() || !selectedTopItem || !selectedRegion) return
    const columnObj = {
      name: newColumnName.trim(),
      visible: true,
      cities: []
    }
    updateMenu(prev => prev.map(item => {
      if (item.id !== selectedTopItem.id) return item
      return {
        ...item,
        continents: item.continents.map(r => {
          if (r.id !== selectedRegion.id) return r
          return { ...r, countries: [...(r.countries || []), columnObj] }
        })
      }
    }))
    setAddColumnModalOpen(false)
    setNewColumnName('')
  }

  const toggleColumnVisibility = (countryIndex) => {
    updateMenu(prev => prev.map(item => {
      if (item.id !== selectedTopItem.id) return item
      return {
        ...item,
        continents: item.continents.map(r => {
          if (r.id !== selectedRegion.id) return r
          const countries = [...(r.countries || [])]
          countries[countryIndex] = {
            ...countries[countryIndex],
            visible: countries[countryIndex].visible === false ? true : false
          }
          return { ...r, countries }
        })
      }
    }))
  }

  const deleteColumn = (countryIndex) => {
    if (!window.confirm('Delete this state/column and all associated destinations?')) return
    updateMenu(prev => prev.map(item => {
      if (item.id !== selectedTopItem.id) return item
      return {
        ...item,
        continents: item.continents.map(r => {
          if (r.id !== selectedRegion.id) return r
          const countries = r.countries.filter((_, idx) => idx !== countryIndex)
          return { ...r, countries }
        })
      }
    }))
  }

  // City / Destination Mutators
  const handleAddCity = () => {
    if (!newCity.label.trim() || activeCountryIndex === null || !selectedTopItem || !selectedRegion) return
    const cityObj = {
      label: newCity.label.trim(),
      search: newCity.search.trim() || newCity.label.trim(),
      visible: true
    }
    updateMenu(prev => prev.map(item => {
      if (item.id !== selectedTopItem.id) return item
      return {
        ...item,
        continents: item.continents.map(r => {
          if (r.id !== selectedRegion.id) return r
          const countries = [...(r.countries || [])]
          countries[activeCountryIndex] = {
            ...countries[activeCountryIndex],
            cities: [...(countries[activeCountryIndex].cities || []), cityObj]
          }
          return { ...r, countries }
        })
      }
    }))
    setAddCityModalOpen(false)
    setNewCity({ label: '', search: '' })
  }

  const toggleCityVisibility = (countryIndex, cityIndex) => {
    updateMenu(prev => prev.map(item => {
      if (item.id !== selectedTopItem.id) return item
      return {
        ...item,
        continents: item.continents.map(r => {
          if (r.id !== selectedRegion.id) return r
          const countries = [...(r.countries || [])]
          const cities = [...(countries[countryIndex].cities || [])]
          const current = cities[cityIndex]
          const isObj = typeof current === 'object' && current !== null
          const nextVisible = isObj ? (current.visible === false ? true : false) : false
          cities[cityIndex] = isObj ? { ...current, visible: nextVisible } : { label: current, search: current, visible: nextVisible }
          countries[countryIndex] = { ...countries[countryIndex], cities }
          return { ...r, countries }
        })
      }
    }))
  }

  const deleteCity = (countryIndex, cityIndex) => {
    updateMenu(prev => prev.map(item => {
      if (item.id !== selectedTopItem.id) return item
      return {
        ...item,
        continents: item.continents.map(r => {
          if (r.id !== selectedRegion.id) return r
          const countries = [...(r.countries || [])]
          const cities = countries[countryIndex].cities.filter((_, idx) => idx !== cityIndex)
          countries[countryIndex] = { ...countries[countryIndex], cities }
          return { ...r, countries }
        })
      }
    }))
  }

  const updateCityField = (countryIndex, cityIndex, field, value) => {
    updateMenu(prev => prev.map(item => {
      if (item.id !== selectedTopItem.id) return item
      return {
        ...item,
        continents: item.continents.map(r => {
          if (r.id !== selectedRegion.id) return r
          const countries = [...(r.countries || [])]
          const cities = [...(countries[countryIndex].cities || [])]
          const current = cities[cityIndex]
          const isObj = typeof current === 'object' && current !== null
          const currentLabel = isObj ? current.label : current
          const currentSearch = isObj ? current.search : current
          const currentVis = isObj ? current.visible !== false : true

          cities[cityIndex] = {
            label: field === 'label' ? value : currentLabel,
            search: field === 'search' ? value : currentSearch,
            visible: field === 'visible' ? value : currentVis
          }
          countries[countryIndex] = { ...countries[countryIndex], cities }
          return { ...r, countries }
        })
      }
    }))
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-stone-500">
        <svg className="w-8 h-8 animate-spin text-amber-500 mb-3" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-sm font-medium">Loading Navigation Structure...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-20">
      {/* ── Page Header & Action Controls ── */}
      <div className="bg-white rounded-2xl p-6 border border-stone-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-serif font-bold text-stone-900 tracking-tight">Navigation & Mega Menu CMS</h1>
            {isDirty && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                Unsaved Changes
              </span>
            )}
          </div>
          <p className="text-stone-500 text-sm mt-1">
            Manage top-level navigation links, mega menu regions, destination columns, and search keyword filters with instant live preview.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Live Preview
          </button>

          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/60 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reset Defaults
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !isDirty}
            className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold shadow-xs transition-all cursor-pointer ${
              isDirty && !saving
                ? 'bg-amber-600 hover:bg-amber-700 text-white active:scale-95'
                : 'bg-stone-200 text-stone-400 cursor-not-allowed'
            }`}
          >
            {saving ? (
              <>
                <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Publishing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Publish Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── 3-Column Visual CMS Hierarchy ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── COLUMN 1: Top Bar Navigation Items (width: 3 cols) ── */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-stone-200/80 shadow-xs p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div>
              <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider">Top Bar Tabs</h2>
              <span className="text-xs text-stone-400">{menu.length} total items</span>
            </div>
            <button
              onClick={() => setAddTopModalOpen(true)}
              className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 transition-colors"
              title="Add Navbar Item"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          <div className="space-y-2">
            {menu.map((item, idx) => {
              const isSelected = item.id === selectedTopItemId
              const isVis = item.visible !== false
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelectTopItem(item.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 group ${
                    isSelected
                      ? 'border-amber-500 bg-amber-50/40 shadow-xs'
                      : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${isVis ? 'bg-emerald-500' : 'bg-stone-300'}`} />
                    <div className="truncate">
                      <div className="font-semibold text-stone-800 text-sm truncate">{item.label}</div>
                      <div className="text-[11px] text-stone-400 flex items-center gap-1.5 capitalize">
                        <span>{item.type || 'megamenu'}</span>
                        {item.type === 'megamenu' && <span>• {item.continents?.length || 0} regions</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => toggleTopItemVisibility(item.id)}
                      className={`p-1 rounded hover:bg-stone-200/60 transition-colors ${isVis ? 'text-stone-500' : 'text-stone-300'}`}
                      title={isVis ? 'Hide from navigation' : 'Show in navigation'}
                    >
                      {isVis ? (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                        </svg>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveTopItem(idx, -1)}
                      className="p-1 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 disabled:opacity-20"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      disabled={idx === menu.length - 1}
                      onClick={() => moveTopItem(idx, 1)}
                      className="p-1 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 disabled:opacity-20"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteTopItem(item.id)}
                      className="p-1 rounded text-rose-400 hover:text-rose-600 hover:bg-rose-50"
                      title="Delete Navbar Item"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── COLUMN 2: Sidebar Regions / Categories (width: 3 cols) ── */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-stone-200/80 shadow-xs p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div>
              <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
                {selectedTopItem?.type === 'megamenu' ? 'Regions / Tabs' : 'Content Details'}
              </h2>
              <span className="text-xs text-stone-400">
                {selectedTopItem?.label} ({selectedTopItem?.type || 'megamenu'})
              </span>
            </div>

            {selectedTopItem?.type === 'megamenu' && (
              <button
                onClick={() => setAddRegionModalOpen(true)}
                className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 transition-colors"
                title="Add Region"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )}
          </div>

          {selectedTopItem?.type === 'megamenu' ? (
            <div className="space-y-2">
              {(!selectedTopItem.continents || selectedTopItem.continents.length === 0) && (
                <div className="p-4 rounded-xl border border-dashed border-stone-200 text-center text-xs text-stone-400">
                  No regions added yet. Click &quot;+&quot; to add one.
                </div>
              )}
              {selectedTopItem.continents?.map((region, rIdx) => {
                const isSelected = region.id === selectedRegionId
                const isVis = region.visible !== false
                return (
                  <div
                    key={region.id}
                    onClick={() => setSelectedRegionId(region.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/40 shadow-xs'
                        : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50/50'
                    }`}
                  >
                    <div className="truncate">
                      <div className="font-semibold text-stone-800 text-sm truncate">{region.name}</div>
                      <div className="text-[11px] text-stone-400">
                        {region.countries?.length || 0} destination columns
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => toggleRegionVisibility(region.id)}
                        className={`p-1 rounded hover:bg-stone-200/60 ${isVis ? 'text-stone-500' : 'text-stone-300'}`}
                      >
                        {isVis ? (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                          </svg>
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={rIdx === 0}
                        onClick={() => moveRegion(rIdx, -1)}
                        className="p-1 rounded text-stone-400 hover:text-stone-700 disabled:opacity-20"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        disabled={rIdx === selectedTopItem.continents.length - 1}
                        onClick={() => moveRegion(rIdx, 1)}
                        className="p-1 rounded text-stone-400 hover:text-stone-700 disabled:opacity-20"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRegion(region.id)}
                        className="p-1 rounded text-rose-400 hover:text-rose-600 hover:bg-rose-50"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : selectedTopItem?.type === 'link' ? (
            <div className="space-y-4 p-4 rounded-xl bg-stone-50 border border-stone-200">
              <div>
                <label className="text-xs font-semibold text-stone-700">Item Label</label>
                <input
                  type="text"
                  value={selectedTopItem.label || ''}
                  onChange={(e) => {
                    const val = e.target.value
                    updateMenu(prev => prev.map(item => item.id === selectedTopItem.id ? { ...item, label: val } : item))
                  }}
                  className="w-full mt-1 px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-700">Target Page Route</label>
                <input
                  type="text"
                  value={selectedTopItem.page || ''}
                  onChange={(e) => {
                    const val = e.target.value
                    updateMenu(prev => prev.map(item => item.id === selectedTopItem.id ? { ...item, page: val } : item))
                  }}
                  placeholder="e.g. corporate, gallery, giftcards"
                  className="w-full mt-1 px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4 p-4 rounded-xl bg-stone-50 border border-stone-200">
              <div>
                <label className="text-xs font-semibold text-stone-700">Dropdown Menu Title</label>
                <input
                  type="text"
                  value={selectedTopItem.label || ''}
                  onChange={(e) => {
                    const val = e.target.value
                    updateMenu(prev => prev.map(item => item.id === selectedTopItem.id ? { ...item, label: val } : item))
                  }}
                  className="w-full mt-1 px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm"
                />
              </div>

              <div className="pt-2 border-t border-stone-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-stone-800">
                    Tour Highlights ({getHighlights(selectedTopItem).length})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingHighlight(null)
                      setHighlightForm({ title: '', region: 'Europe', destination: '', active: true })
                      setHighlightModalOpen(true)
                    }}
                    className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[11px] font-bold cursor-pointer"
                  >
                    + Add Highlight
                  </button>
                </div>
                <p className="text-[11px] text-stone-500 mb-3">
                  Administrators can view, edit, add, remove, and reorder tour highlights for active packages/dropdowns.
                </p>

                <div className="space-y-2 max-h-[360px] overflow-y-auto">
                  {getHighlights(selectedTopItem).length === 0 ? (
                    <div className="p-3 text-center text-xs text-stone-400 border border-dashed rounded-lg">
                      No tour highlights configured. Click &quot;+ Add Highlight&quot; to create one.
                    </div>
                  ) : (
                    getHighlights(selectedTopItem).map((h, hIdx) => (
                      <div
                        key={h.id || hIdx}
                        className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 text-xs transition-all ${
                          h.active ? 'bg-white border-stone-200 shadow-xs' : 'bg-stone-100 border-stone-200 opacity-60'
                        }`}
                      >
                        <div className="truncate flex-1">
                          <div className="font-semibold text-stone-800 truncate">{h.title}</div>
                          <div className="text-[10px] text-stone-400 truncate">{h.region} • {h.destination}</div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleHighlightActive(h.id)}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer ${
                              h.active ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'
                            }`}
                            title={h.active ? 'Click to deactivate' : 'Click to activate'}
                          >
                            {h.active ? 'Active' : 'Hidden'}
                          </button>
                          <button
                            type="button"
                            disabled={hIdx === 0}
                            onClick={() => moveHighlight(hIdx, -1)}
                            className="p-1 rounded text-stone-400 hover:text-stone-700 disabled:opacity-20 cursor-pointer"
                            title="Move Up"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            disabled={hIdx === getHighlights(selectedTopItem).length - 1}
                            onClick={() => moveHighlight(hIdx, 1)}
                            className="p-1 rounded text-stone-400 hover:text-stone-700 disabled:opacity-20 cursor-pointer"
                            title="Move Down"
                          >
                            ▼
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingHighlight(h)
                              setHighlightForm({
                                title: h.title || '',
                                region: h.region || 'Europe',
                                destination: h.destination || '',
                                active: h.active !== false
                              })
                              setHighlightModalOpen(true)
                            }}
                            className="p-1 rounded text-stone-400 hover:text-amber-700 cursor-pointer"
                            title="Edit"
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteHighlight(h.id)}
                            className="p-1 rounded text-rose-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                            title="Delete"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── COLUMN 3: Destination Columns & Cities (width: 6 cols) ── */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-stone-200/80 shadow-xs p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div>
              <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
                {selectedTopItem?.type === 'megamenu'
                  ? (selectedRegion ? `Destinations in ${selectedRegion.name}` : 'Destination Columns')
                  : 'Tour Highlights & Featured Expeditions'}
              </h2>
              <span className="text-xs text-stone-400">
                {selectedTopItem?.type === 'megamenu'
                  ? 'Filter by search keywords or configure individual city cards'
                  : 'Configure active tour highlights and popular expeditions for dropdown navigation'}
              </span>
            </div>

            {selectedTopItem?.type === 'megamenu' && selectedRegion && (
              <button
                onClick={() => setAddColumnModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add State / Column
              </button>
            )}

            {selectedTopItem?.type !== 'megamenu' && (
              <button
                type="button"
                onClick={() => {
                  setEditingHighlight(null)
                  setHighlightForm({ title: '', region: 'Europe', destination: '', active: true })
                  setHighlightModalOpen(true)
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Tour Highlight
              </button>
            )}
          </div>

          {selectedTopItem?.type !== 'megamenu' ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/80 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-amber-950">Active Tour Highlights CMS</h3>
                  <p className="text-xs text-amber-700 font-light mt-0.5">
                    Tour highlights and featured itineraries configured here persist via Navigation API and reflect dynamically across the customer site.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {getHighlights(selectedTopItem).map((h, hIdx) => (
                  <div
                    key={h.id || hIdx}
                    className={`rounded-xl border p-4 flex flex-col justify-between gap-3 transition-all ${
                      h.active ? 'bg-white border-stone-200 shadow-xs' : 'bg-stone-50 border-stone-200 opacity-60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          h.active ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'
                        }`}>
                          {h.active ? 'Live / Active' : 'Hidden'}
                        </span>
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          {h.region}
                        </span>
                      </div>
                      <h4 className="font-bold text-stone-900 text-sm mt-2">{h.title}</h4>
                      <p className="text-xs text-stone-500 mt-1">Destination: <strong className="text-stone-700">{h.destination}</strong></p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={hIdx === 0}
                          onClick={() => moveHighlight(hIdx, -1)}
                          className="px-2 py-1 rounded bg-stone-100 text-stone-600 hover:bg-stone-200 disabled:opacity-30 text-xs font-bold cursor-pointer"
                          title="Move Up"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          disabled={hIdx === getHighlights(selectedTopItem).length - 1}
                          onClick={() => moveHighlight(hIdx, 1)}
                          className="px-2 py-1 rounded bg-stone-100 text-stone-600 hover:bg-stone-200 disabled:opacity-30 text-xs font-bold cursor-pointer"
                          title="Move Down"
                        >
                          ▼
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggleHighlightActive(h.id)}
                          className="px-2.5 py-1 text-xs font-medium rounded-lg text-stone-600 hover:bg-stone-100 border border-stone-200 cursor-pointer"
                        >
                          {h.active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingHighlight(h)
                            setHighlightForm({
                              title: h.title || '',
                              region: h.region || 'Europe',
                              destination: h.destination || '',
                              active: h.active !== false
                            })
                            setHighlightModalOpen(true)
                          }}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteHighlight(h.id)}
                          className="px-2 py-1 text-xs font-bold rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Remove Highlight"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : !selectedRegion ? (
            <div className="p-8 text-center text-stone-400 text-sm">
              Select a region on the left to edit its states and city destinations.
            </div>
          ) : (!selectedRegion.countries || selectedRegion.countries.length === 0) ? (
            <div className="p-8 text-center border border-dashed border-stone-200 rounded-xl text-stone-400 text-sm">
              No states or country columns in this region yet. Click &quot;Add State / Column&quot; to begin.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedRegion.countries.map((country, cIdx) => {
                const isColVis = country.visible !== false
                return (
                  <div
                    key={country.name + cIdx}
                    className={`rounded-xl border p-3.5 flex flex-col gap-2.5 transition-all ${
                      isColVis ? 'bg-stone-50/70 border-stone-200' : 'bg-stone-100/50 border-stone-200/50 opacity-70'
                    }`}
                  >
                    {/* Column Header */}
                    <div className="flex items-center justify-between gap-2 border-b border-stone-200/70 pb-2">
                      <div className="flex items-center gap-2 truncate">
                        <span className={`w-2 h-2 rounded-full ${isColVis ? 'bg-amber-500' : 'bg-stone-300'}`} />
                        <span className="font-bold text-stone-800 text-sm truncate">{country.name}</span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleColumnVisibility(cIdx)}
                          className="p-1 rounded text-stone-400 hover:text-stone-700"
                          title={isColVis ? 'Hide Column' : 'Show Column'}
                        >
                          {isColVis ? (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                            </svg>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteColumn(cIdx)}
                          className="p-1 rounded text-rose-400 hover:text-rose-600"
                          title="Delete Column"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Cities / Links List */}
                    <div className="space-y-1.5 min-h-[40px]">
                      {(!country.cities || country.cities.length === 0) && (
                        <p className="text-[11px] text-stone-400 italic py-1">No destinations in this group.</p>
                      )}
                      {country.cities?.map((city, ctIdx) => {
                        const isObj = typeof city === 'object' && city !== null
                        const label = isObj ? city.label : city
                        const search = isObj ? city.search : city
                        const isCityVis = isObj ? city.visible !== false : true

                        return (
                          <div
                            key={label + ctIdx}
                            className={`flex items-center justify-between gap-1.5 px-2 py-1 rounded-md text-xs border transition-colors ${
                              isCityVis ? 'bg-white border-stone-200' : 'bg-stone-100 text-stone-400 border-stone-200/50'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="font-medium text-stone-800 truncate">{label}</span>
                              <span className="text-[10px] text-stone-400 bg-stone-100 px-1 py-0.2 rounded font-mono truncate">
                                tag: {search}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => toggleCityVisibility(cIdx, ctIdx)}
                                className={`p-0.5 rounded hover:bg-stone-100 ${isCityVis ? 'text-emerald-600' : 'text-stone-300'}`}
                                title={isCityVis ? 'Visible' : 'Hidden'}
                              >
                                <span className={`inline-block w-1.5 h-1.5 rounded-full ${isCityVis ? 'bg-emerald-500' : 'bg-stone-300'}`} />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteCity(cIdx, ctIdx)}
                                className="p-0.5 rounded text-stone-300 hover:text-rose-500"
                                title="Remove City"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Add City Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveCountryIndex(cIdx)
                        setAddCityModalOpen(true)
                      }}
                      className="w-full mt-1 py-1 px-2 rounded-lg border border-dashed border-stone-300 hover:border-amber-400 hover:bg-amber-50/50 text-[11px] font-semibold text-stone-500 hover:text-amber-800 transition-colors flex items-center justify-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Destination
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── SECTION: Explore Destinations Carousel CMS (Circular Bubbles) ── */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs p-5 flex flex-col gap-4 mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
                Explore Destinations Carousel (Circular Bubbles)
              </h2>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              Manage circular destination bubbles shown under &quot;Explore destinations&quot; on the customer homepage. Images are automatically cropped 1:1 and compressed to WebP.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenAddCarousel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Destination Bubble
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-5 gap-4 pt-2">
          {carouselItems.map((item, idx) => {
            const itemImg = item.image?.startsWith('http')
              ? item.image
              : (item.image ? `${API_URL}${item.image.startsWith('/') ? '' : '/'}${item.image}` : 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=400&q=80')

            return (
              <div
                key={item.id || idx}
                className={`p-3.5 rounded-2xl border flex flex-col items-center text-center justify-between transition-all group ${
                  item.isActive ? 'bg-[#FDFCF7] border-stone-200 shadow-xs' : 'bg-stone-100/60 border-stone-200 opacity-60'
                }`}
              >
                <div className="flex flex-col items-center w-full">
                  {/* Active status pill */}
                  <div className="w-full flex justify-end mb-1">
                    <button
                      type="button"
                      onClick={() => handleToggleCarouselActive(item.id)}
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full cursor-pointer ${
                        item.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'
                      }`}
                    >
                      {item.isActive ? 'Active' : 'Hidden'}
                    </button>
                  </div>

                  {/* Circular image preview */}
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-stone-100 ring-2 ring-stone-200/80 shadow-md my-1 group-hover:scale-105 transition-transform">
                    <img
                      src={itemImg}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.onerror = null
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=400&q=80'
                      }}
                    />
                  </div>

                  {/* Name & Region */}
                  <h4 className="font-bold text-xs text-stone-900 mt-2 truncate w-full">{item.name}</h4>
                  <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60 mt-1">
                    {item.region}
                  </span>

                  <span className="text-[10px] text-stone-400 font-mono mt-1">
                    {item.tourCount || 'Dynamic count'}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="w-full pt-2 mt-2 border-t border-stone-200/60 flex items-center justify-between">
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveCarouselItem(idx, -1)}
                      className="p-1 rounded text-stone-400 hover:text-stone-800 disabled:opacity-20 cursor-pointer"
                      title="Move Left"
                    >
                      ◀
                    </button>
                    <button
                      type="button"
                      disabled={idx === carouselItems.length - 1}
                      onClick={() => handleMoveCarouselItem(idx, 1)}
                      className="p-1 rounded text-stone-400 hover:text-stone-800 disabled:opacity-20 cursor-pointer"
                      title="Move Right"
                    >
                      ▶
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditCarousel(item)}
                      className="p-1.5 rounded-lg text-stone-600 hover:text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer"
                      title="Edit Item"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCarouselItem(item.id)}
                      className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Delete Item"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── MODAL: Add Top Item ── */}
      {addTopModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-stone-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={(e) => { if (e.target === e.currentTarget) setAddTopModalOpen(false) }}
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 animate-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-stone-900 mb-4">Add Navbar Item</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-stone-700">Tab Label (e.g. &quot;Middle East&quot;)</label>
                <input
                  type="text"
                  value={newTopItem.label}
                  onChange={e => setNewTopItem({ ...newTopItem, label: e.target.value })}
                  placeholder="e.g. Cruise Vacations"
                  className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-xl text-sm"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700">Item Type</label>
                <select
                  value={newTopItem.type}
                  onChange={e => setNewTopItem({ ...newTopItem, type: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-xl text-sm bg-white"
                >
                  <option value="megamenu">Mega Menu (Split sidebar &amp; multi-column grid)</option>
                  <option value="dropdown">Dropdown (Simple link list)</option>
                  <option value="link">Direct Page Link (e.g. corporate, gallery)</option>
                </select>
              </div>

              {newTopItem.type === 'link' && (
                <div>
                  <label className="text-xs font-semibold text-stone-700">Target Page</label>
                  <input
                    type="text"
                    value={newTopItem.page}
                    onChange={e => setNewTopItem({ ...newTopItem, page: e.target.value })}
                    placeholder="e.g. corporate, gallery, giftcards"
                    className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-xl text-sm"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6">
              <button
                type="button"
                onClick={() => setAddTopModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddTopItem}
                disabled={!newTopItem.label.trim()}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 cursor-pointer"
              >
                Add Item
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── MODAL: Add Region ── */}
      {addRegionModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-stone-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={(e) => { if (e.target === e.currentTarget) setAddRegionModalOpen(false) }}
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 animate-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-stone-900 mb-4">Add Regional Category</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-stone-700">Region Name</label>
                <input
                  type="text"
                  value={newRegion.name}
                  onChange={e => setNewRegion({ ...newRegion, name: e.target.value })}
                  placeholder="e.g. Central Europe"
                  className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-xl text-sm"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700">Search Filter Tag</label>
                <input
                  type="text"
                  value={newRegion.search}
                  onChange={e => setNewRegion({ ...newRegion, search: e.target.value })}
                  placeholder="Defaults to region name if blank"
                  className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-xl text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6">
              <button
                type="button"
                onClick={() => setAddRegionModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddRegion}
                disabled={!newRegion.name.trim()}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 cursor-pointer"
              >
                Add Region
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── MODAL: Add Column Group ── */}
      {addColumnModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-stone-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={(e) => { if (e.target === e.currentTarget) setAddColumnModalOpen(false) }}
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 animate-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-stone-900 mb-4">Add State / Column Group</h3>
            <div>
              <label className="text-xs font-semibold text-stone-700">State / Group Heading</label>
              <input
                type="text"
                value={newColumnName}
                onChange={e => setNewColumnName(e.target.value)}
                placeholder="e.g. Kerala, Switzerland, California"
                className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-xl text-sm"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6">
              <button
                type="button"
                onClick={() => setAddColumnModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddColumn}
                disabled={!newColumnName.trim()}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 cursor-pointer"
              >
                Add Column
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── MODAL: Add City Destination ── */}
      {addCityModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-stone-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={(e) => { if (e.target === e.currentTarget) setAddCityModalOpen(false) }}
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 animate-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-stone-900 mb-4">Add Destination / City</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-stone-700">Destination Name</label>
                <input
                  type="text"
                  value={newCity.label}
                  onChange={e => setNewCity({ ...newCity, label: e.target.value })}
                  placeholder="e.g. Munnar, Interlaken, Kyoto"
                  className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-xl text-sm"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700">Search Filter Keyword</label>
                <input
                  type="text"
                  value={newCity.search}
                  onChange={e => setNewCity({ ...newCity, search: e.target.value })}
                  placeholder="Keyword to filter Destinations page (defaults to name)"
                  className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-xl text-sm"
                />
                <span className="text-[11px] text-stone-400 mt-1 block">
                  When a customer clicks this link, it instantly queries the destinations catalog with this tag.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6">
              <button
                type="button"
                onClick={() => setAddCityModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddCity}
                disabled={!newCity.label.trim()}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 cursor-pointer"
              >
                Add Destination
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── MODAL: Reset Defaults Confirmation ── */}
      {showResetConfirm && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-stone-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={(e) => { if (e.target === e.currentTarget) setShowResetConfirm(false) }}
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 animate-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-stone-900">Reset to Factory Navigation?</h3>
            <p className="text-sm text-stone-500 mt-1">
              This will restore the complete original India, International, Group Tours, and destination hierarchy. Any custom categories added will be reverted.
            </p>

            <div className="flex items-center justify-end gap-2.5 mt-6">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={resetting}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50 cursor-pointer"
              >
                {resetting ? 'Resetting...' : 'Yes, Reset Defaults'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── DRAWER / MODAL: Live Preview of Mega Menu, Tour Highlights & Destination Carousel ── */}
      {showPreview && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-stone-950/80 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPreview(false)
          }}
        >
          <div
            className="bg-stone-900 text-white rounded-3xl max-w-5xl w-full p-6 shadow-2xl border border-stone-800 my-auto max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-stone-800 gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-base font-bold text-white tracking-wide">Live Website Simulation</h3>
                
                {/* Mode Selector Tabs */}
                <div className="flex items-center gap-1 bg-stone-800/90 p-1 rounded-xl text-xs ml-1 sm:ml-3">
                  <button
                    type="button"
                    onClick={() => setPreviewSubTab('nav')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                      previewSubTab === 'nav' ? 'bg-amber-600 text-white shadow-xs' : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    Navigation Bar
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewSubTab('highlights')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                      previewSubTab === 'highlights' ? 'bg-amber-600 text-white shadow-xs' : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    Tour Highlights ({getHighlights(selectedTopItem).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewSubTab('carousel')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                      previewSubTab === 'carousel' ? 'bg-amber-600 text-white shadow-xs' : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    Destination Carousel ({carouselItems.length})
                  </button>
                </div>
              </div>

              <button
                onClick={() => setShowPreview(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer self-end sm:self-auto"
                title="Close (Esc)"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* PREVIEW SUB-TAB 1: Navigation Bar & Menus */}
            {previewSubTab === 'nav' && (
              <div className="flex flex-col flex-1 min-h-0">
                {/* Simulating Customer Navbar */}
                <div className="py-4 border-b border-stone-800/80 flex items-center justify-center gap-2 flex-wrap shrink-0">
                  {menu.filter(item => item.visible !== false).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelectTopItem(item.id)}
                      className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                        selectedTopItemId === item.id
                          ? 'text-amber-400 bg-white/10 font-semibold'
                          : 'text-stone-300 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {/* Mega Menu View */}
                {selectedTopItem?.type === 'megamenu' && (
                  <div className="mt-4 bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col text-stone-900 flex-1 min-h-[380px] max-h-[550px]">
                    <div className="flex items-center justify-between px-5 py-2.5 bg-stone-50 border-b border-stone-200 shrink-0">
                      <span className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                        {selectedTopItem.label} Destinations
                      </span>
                      <span className="text-[11px] text-stone-400 font-semibold">
                        Hover/Click continent to explore
                      </span>
                    </div>

                    <div className="flex flex-1 min-h-0 overflow-hidden">
                      {/* Sidebar */}
                      <div className="w-56 bg-stone-100 border-r border-stone-200 py-2 flex flex-col overflow-y-auto shrink-0">
                        {selectedTopItem.continents?.filter(r => r.visible !== false).map((cont) => {
                          const isActive = cont.id === selectedRegionId
                          return (
                            <button
                              key={cont.id}
                              onClick={() => setSelectedRegionId(cont.id)}
                              className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                                isActive
                                  ? 'bg-amber-600 text-white font-bold'
                                  : 'text-stone-600 hover:bg-stone-200/70 hover:text-stone-900'
                              }`}
                            >
                              <span>{cont.name}</span>
                              <span className="text-[10px] opacity-70">&rarr;</span>
                            </button>
                          )
                        })}
                      </div>

                      {/* Destination Grid */}
                      <div className="flex-1 p-5 overflow-y-auto bg-white min-h-0">
                        {selectedRegion ? (
                          <div>
                            <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
                              <h4 className="text-sm font-bold text-stone-900">{selectedRegion.name}</h4>
                              <span className="text-xs text-amber-600 font-semibold">
                                {selectedRegion.allLink?.label || `All of ${selectedRegion.name}`} &rarr;
                              </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                              {selectedRegion.countries?.filter(c => c.visible !== false).map((country) => (
                                <div key={country.name} className="space-y-1.5">
                                  <h5 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                                    {country.name}
                                  </h5>
                                  <div className="space-y-1">
                                    {country.cities?.filter(ct => (typeof ct === 'object' ? ct.visible !== false : true)).map((city, idx) => {
                                      const cLabel = typeof city === 'object' ? city.label : city
                                      const cSearch = typeof city === 'object' ? (city.search || city.label) : city
                                      return (
                                        <button
                                          key={cLabel + idx}
                                          onClick={() => {
                                            addNotification?.({
                                              type: 'info',
                                              message: `Preview Click: Filters Destinations page by "${cSearch}"`
                                            })
                                          }}
                                          className="block text-left text-xs text-stone-500 hover:text-amber-600 transition-colors py-0.5 cursor-pointer"
                                        >
                                          {cLabel}
                                        </button>
                                      )
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="p-8 text-center text-stone-400 text-xs">
                            Select a region from the sidebar
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Dropdown Menu View */}
                {selectedTopItem?.type === 'dropdown' && (
                  <div className="mt-4 bg-white rounded-2xl overflow-hidden shadow-2xl p-6 text-stone-900 flex-1 min-h-[380px] max-h-[550px] overflow-y-auto">
                    <div className="border-b border-stone-200 pb-3 mb-4 flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                        Dropdown Menu Simulation: {selectedTopItem.label}
                      </span>
                      <span className="text-xs text-stone-400">Renders as floating dropdown with tour highlights</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {getHighlights(selectedTopItem).map((h, idx) => (
                        <div key={h.id || idx} className="p-4 rounded-xl border border-stone-200 bg-stone-50/80 flex flex-col justify-between">
                          <div>
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded uppercase">
                              {h.region}
                            </span>
                            <h4 className="font-bold text-sm text-stone-900 mt-2">{h.title}</h4>
                            <p className="text-xs text-stone-500 mt-0.5">Destination: {h.destination}</p>
                          </div>
                          <span className="text-xs text-amber-600 font-semibold mt-3 flex items-center gap-1">
                            Explore Tour &rarr;
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Link View */}
                {selectedTopItem?.type === 'link' && (
                  <div className="mt-4 bg-white rounded-2xl overflow-hidden shadow-2xl p-8 text-stone-900 flex-1 min-h-[380px] max-h-[550px] flex flex-col items-center justify-center text-center">
                    <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-2xl text-amber-600 mb-3 shadow-sm">
                      🔗
                    </div>
                    <h4 className="font-display font-bold text-lg text-stone-900">{selectedTopItem.label}</h4>
                    <p className="text-xs text-stone-500 mt-1 max-w-sm">
                      Direct Route Link: <code className="bg-stone-100 text-amber-700 px-2 py-0.5 rounded font-mono font-semibold">/{selectedTopItem.page || selectedTopItem.route || 'corporate'}</code>
                    </p>
                    <div className="mt-5 p-4 bg-stone-50 rounded-2xl border border-stone-200/80 text-xs text-stone-600 max-w-md text-left space-y-1">
                      <p className="font-semibold text-stone-800">Customer Site Behavior:</p>
                      <p>Clicking <strong>&quot;{selectedTopItem.label}&quot;</strong> directly routes visitors to the {selectedTopItem.label} surface with full page details.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PREVIEW SUB-TAB 2: Tour Highlights Grid */}
            {previewSubTab === 'highlights' && (
              <div className="mt-4 bg-white rounded-2xl overflow-hidden shadow-2xl p-6 text-stone-900 flex-1 min-h-[380px] max-h-[550px] overflow-y-auto">
                <div className="border-b border-stone-200 pb-3 mb-4 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-stone-900 uppercase tracking-wider">Active Tour Highlights Preview</h4>
                    <p className="text-xs text-stone-400 mt-0.5">These featured cards appear in navigation dropdowns and curated homepage highlights.</p>
                  </div>
                  <span className="text-xs font-semibold bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg border border-amber-200">
                    {getHighlights(selectedTopItem).filter(h => h.active !== false).length} Active Highlights
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {getHighlights(selectedTopItem).map((h, idx) => (
                    <div
                      key={h.id || idx}
                      className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                        h.active ? 'bg-[#FAF9F5] border-stone-200 shadow-xs' : 'bg-stone-100 border-stone-200 opacity-50'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded uppercase">
                            {h.region}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${h.active ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'}`}>
                            {h.active ? 'Live' : 'Hidden'}
                          </span>
                        </div>
                        <h5 className="font-bold text-sm text-stone-900">{h.title}</h5>
                        <p className="text-xs text-stone-500 mt-1">Destination: <strong className="text-stone-700">{h.destination}</strong></p>
                      </div>
                      <span className="text-xs text-amber-600 font-semibold mt-4 flex items-center gap-1">
                        View Itinerary &rarr;
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PREVIEW SUB-TAB 3: Destination Carousel */}
            {previewSubTab === 'carousel' && (
              <div className="mt-4 bg-[#FDFCF7] rounded-2xl overflow-hidden shadow-2xl p-6 text-stone-900 flex-1 min-h-[380px] max-h-[550px] overflow-y-auto">
                <div className="text-center flex flex-col items-center max-w-md mx-auto mb-6">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-700 mb-1 block">
                    Browse by Region
                  </span>
                  <h4 className="font-display text-xl font-bold text-stone-900 tracking-tight">
                    Explore destinations
                  </h4>
                  <p className="text-xs text-stone-500 mt-1 font-light">
                    Seven continents. One curator. Each region hand-picked for the discerning traveller.
                  </p>
                </div>

                <div className="flex justify-start sm:justify-center gap-5 sm:gap-6 overflow-x-auto pb-4 pt-2 px-2 custom-scrollbar">
                  {carouselItems.filter(item => item.isActive !== false).map((dest, idx) => {
                    const img = dest.image?.startsWith('http')
                      ? dest.image
                      : (dest.image ? `${API_URL}${dest.image.startsWith('/') ? '' : '/'}${dest.image}` : 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=400&q=80')

                    return (
                      <div key={dest.id || idx} className="group flex flex-col items-center gap-2 shrink-0 min-w-[85px] text-center">
                        <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-stone-100 shadow-md ring-2 ring-stone-200/80 transition-transform group-hover:scale-105">
                          <img
                            src={img}
                            alt={dest.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.onerror = null
                              e.currentTarget.src = 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=400&q=80'
                            }}
                          />
                          <div className="absolute inset-0 bg-stone-950/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-[10px] font-mono font-bold text-white bg-black/60 px-1.5 py-0.5 rounded">
                              {dest.tourCount || '2 tours'}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-stone-800 leading-tight">{dest.name}</span>
                        <span className="text-[10px] text-stone-400 font-mono">{dest.tourCount || 'Explore'}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ── MODAL: Add / Edit Destination Carousel Item ── */}
      {carouselModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-stone-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={(e) => { if (e.target === e.currentTarget) setCarouselModalOpen(false) }}
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  {editingCarouselItem ? 'Edit Destination Bubble' : 'Add Destination Bubble'}
                </h3>
                <p className="text-[11px] text-stone-400 mt-0.5">Images are center-cropped to 1:1 circle and compressed to WebP (&lt;80KB).</p>
              </div>
              <button
                type="button"
                onClick={() => setCarouselModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-600 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCarouselItem} className="space-y-3.5">
              {/* Circular Photo Preview & Upload */}
              <div className="flex flex-col items-center">
                <label className="text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-2">
                  Circular Bubble Image (1:1 Ratio) *
                </label>

                <div
                  onClick={() => carouselFileInputRef.current?.click()}
                  className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-dashed border-stone-300 hover:border-amber-500 bg-[#FAF9F5] shadow-sm flex flex-col items-center justify-center cursor-pointer group transition-all"
                >
                  {carouselForm.image ? (
                    <>
                      <img
                        src={carouselForm.image.startsWith('http') ? carouselForm.image : `${API_URL}${carouselForm.image.startsWith('/') ? '' : '/'}${carouselForm.image}`}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-stone-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] text-white font-bold">
                        Change
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-2">
                      <svg className="w-6 h-6 text-stone-400 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-[10px] text-stone-600 font-semibold block leading-tight">Upload</span>
                    </div>
                  )}
                </div>

                <input
                  ref={carouselFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleCarouselImageSelect}
                  className="hidden"
                />

                {carouselUploading && (
                  <span className="text-[11px] text-amber-600 mt-1 flex items-center gap-1 font-medium">
                    <span className="w-3 h-3 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                    Cropping 1:1 & compressing...
                  </span>
                )}

                {carouselCompressionInfo && (
                  <span className="text-[10px] text-emerald-700 font-medium mt-1">
                    Compressed: {carouselCompressionInfo.compressed} (-{carouselCompressionInfo.savings}%)
                  </span>
                )}
              </div>

              <div>
                <label className="text-[11px] font-bold text-stone-700 uppercase tracking-wider">Destination Name *</label>
                <input
                  type="text"
                  required
                  value={carouselForm.name}
                  onChange={e => setCarouselForm({ ...carouselForm, name: e.target.value })}
                  placeholder="e.g. Switzerland"
                  className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-xl text-xs outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-stone-700 uppercase tracking-wider">Region / Continent *</label>
                  <select
                    value={carouselForm.region}
                    onChange={e => setCarouselForm({ ...carouselForm, region: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-xl text-xs outline-none focus:border-amber-500"
                  >
                    <option value="Europe">Europe</option>
                    <option value="Asia">Asia</option>
                    <option value="Middle East">Middle East</option>
                    <option value="India">India</option>
                    <option value="Africa">Africa</option>
                    <option value="North America">North America</option>
                    <option value="South America">South America</option>
                    <option value="Australia">Australia</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-stone-700 uppercase tracking-wider">Search Keyword</label>
                  <input
                    type="text"
                    value={carouselForm.search}
                    onChange={e => setCarouselForm({ ...carouselForm, search: e.target.value })}
                    placeholder="e.g. Switzerland"
                    className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-xl text-xs outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-stone-700 uppercase tracking-wider">Tour Count / Status Badge</label>
                <input
                  type="text"
                  value={carouselForm.tourCount}
                  onChange={e => setCarouselForm({ ...carouselForm, tourCount: e.target.value })}
                  placeholder="e.g. 2 tours or Coming soon (leave blank for auto)"
                  className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-xl text-xs outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="carouselIsActive"
                  checked={carouselForm.isActive}
                  onChange={e => setCarouselForm({ ...carouselForm, isActive: e.target.checked })}
                  className="w-4 h-4 text-amber-600 rounded cursor-pointer accent-amber-600"
                />
                <label htmlFor="carouselIsActive" className="text-xs font-semibold text-stone-700 cursor-pointer">
                  Visible in Carousel on Homepage
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setCarouselModalOpen(false)}
                  className="px-3 py-1.5 text-stone-600 hover:bg-stone-100 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={carouselUploading}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  Save Bubble
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Add / Edit Tour Highlight ── */}
      {highlightModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-stone-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={(e) => { if (e.target === e.currentTarget) setHighlightModalOpen(false) }}
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 animate-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-stone-900 mb-4">
              {editingHighlight ? 'Edit Tour Highlight' : 'Add New Tour Highlight'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-stone-700">Tour Title *</label>
                <input
                  type="text"
                  value={highlightForm.title}
                  onChange={e => setHighlightForm({ ...highlightForm, title: e.target.value })}
                  placeholder="e.g. Santorini Sunset Cruise"
                  className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-xl text-sm"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-stone-700">Region</label>
                  <select
                    value={highlightForm.region}
                    onChange={e => setHighlightForm({ ...highlightForm, region: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-xl text-sm bg-white"
                  >
                    <option value="Europe">Europe</option>
                    <option value="Asia">Asia</option>
                    <option value="India">India</option>
                    <option value="Middle East">Middle East</option>
                    <option value="Africa">Africa</option>
                    <option value="America">America</option>
                    <option value="Australia">Australia</option>
                    <option value="Antarctica">Antarctica</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-stone-700">Destination</label>
                  <input
                    type="text"
                    value={highlightForm.destination}
                    onChange={e => setHighlightForm({ ...highlightForm, destination: e.target.value })}
                    placeholder="e.g. Greece, Switzerland"
                    className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-stone-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={highlightForm.active}
                    onChange={e => setHighlightForm({ ...highlightForm, active: e.target.checked })}
                    className="rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <span>Display as Live Active Highlight</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6">
              <button
                type="button"
                onClick={() => setHighlightModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveHighlight}
                disabled={!highlightForm.title.trim()}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 cursor-pointer"
              >
                {editingHighlight ? 'Save Changes' : 'Add Highlight'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

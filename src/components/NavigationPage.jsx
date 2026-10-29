import { useState, useEffect, useMemo, useRef } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export default function NavigationPage({ token, addNotification, user }) {
  const [menu, setMenu] = useState([])
  const [baselineMenu, setBaselineMenu] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

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

  // Fetch navigation data
  const fetchNavigation = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/navigation`)
      if (!res.ok) throw new Error('Failed to load navigation menu')
      const data = await res.json()
      setMenu(data)
      setBaselineMenu(JSON.parse(JSON.stringify(data)))
      if (data.length > 0) {
        setSelectedTopItemId(data[0].id)
        if (data[0].continents && data[0].continents.length > 0) {
          setSelectedRegionId(data[0].continents[0].id)
        }
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

  // Dirty state tracking
  const isDirty = useMemo(() => {
    if (!baselineMenu) return false
    return JSON.stringify(menu) !== JSON.stringify(baselineMenu)
  }, [menu, baselineMenu])

  // Save changes to backend
  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/api/navigation`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(menu)
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to save navigation')
      }

      const updated = await res.json()
      setMenu(updated)
      setBaselineMenu(JSON.parse(JSON.stringify(updated)))
      addNotification?.({ type: 'success', message: 'Navigation menu successfully published live!' })
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
      if (defaults.length > 0) {
        setSelectedTopItemId(defaults[0].id)
        if (defaults[0].continents && defaults[0].continents.length > 0) {
          setSelectedRegionId(defaults[0].continents[0].id)
        }
      }
      setShowResetConfirm(false)
      addNotification?.({ type: 'success', message: 'Navigation menu reset to factory default configuration.' })
    } catch (err) {
      addNotification?.({ type: 'error', message: err.message })
    } finally {
      setResetting(false)
    }
  }

  // Selected entities
  const selectedTopItem = menu.find(item => item.id === selectedTopItemId) || menu[0]
  const selectedRegion = selectedTopItem?.continents?.find(r => r.id === selectedRegionId) || selectedTopItem?.continents?.[0]

  // Update selected region when selected top item changes
  const handleSelectTopItem = (id) => {
    setSelectedTopItemId(id)
    const item = menu.find(i => i.id === id)
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
            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-500">
              Dropdown menu links are automatically populated with active packages and group departures.
            </div>
          )}
        </div>

        {/* ── COLUMN 3: Destination Columns & Cities (width: 6 cols) ── */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-stone-200/80 shadow-xs p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div>
              <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
                {selectedRegion ? `Destinations in ${selectedRegion.name}` : 'Destination Columns'}
              </h2>
              <span className="text-xs text-stone-400">
                Filter by search keywords or configure individual city cards
              </span>
            </div>

            {selectedRegion && (
              <button
                onClick={() => setAddColumnModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add State / Column
              </button>
            )}
          </div>

          {!selectedRegion ? (
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

      {/* ── MODAL: Add Top Item ── */}
      {addTopModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200 animate-scale-up">
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
                className="px-4 py-2 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddTopItem}
                disabled={!newTopItem.label.trim()}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
              >
                Add Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Add Region ── */}
      {addRegionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200 animate-scale-up">
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
                className="px-4 py-2 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddRegion}
                disabled={!newRegion.name.trim()}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
              >
                Add Region
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Add Column Group ── */}
      {addColumnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200 animate-scale-up">
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
                className="px-4 py-2 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddColumn}
                disabled={!newColumnName.trim()}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
              >
                Add Column
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Add City Destination ── */}
      {addCityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200 animate-scale-up">
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
                className="px-4 py-2 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddCity}
                disabled={!newCity.label.trim()}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
              >
                Add Destination
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Reset Defaults Confirmation ── */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200">
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
                className="px-4 py-2 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={resetting}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
              >
                {resetting ? 'Resetting...' : 'Yes, Reset Defaults'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DRAWER / MODAL: Live Preview of Mega Menu ── */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-stone-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-stone-900 text-white rounded-3xl max-w-5xl w-full p-6 shadow-2xl border border-stone-800 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-base font-bold text-white tracking-wide">Live Mega Menu Simulation</h3>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Simulating Customer Navbar */}
            <div className="py-4 border-b border-stone-800/80 flex items-center justify-center gap-2 flex-wrap">
              {menu.filter(item => item.visible !== false).map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelectTopItem(item.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedTopItemId === item.id
                      ? 'text-amber-400 bg-white/10 font-semibold'
                      : 'text-stone-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Simulating Mega Menu Dropdown */}
            {selectedTopItem?.type === 'megamenu' && (
              <div className="mt-4 bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col text-stone-900 max-h-[550px]">
                <div className="flex items-center justify-between px-5 py-2.5 bg-stone-50 border-b border-stone-200">
                  <span className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                    {selectedTopItem.label} Destinations
                  </span>
                  <span className="text-[11px] text-stone-400 font-semibold">
                    Hover/Click continent to explore
                  </span>
                </div>

                <div className="flex flex-1 min-h-[350px] overflow-hidden">
                  {/* Sidebar */}
                  <div className="w-56 bg-stone-100 border-r border-stone-200 py-2 flex flex-col overflow-y-auto">
                    {selectedTopItem.continents?.filter(r => r.visible !== false).map((cont) => {
                      const isActive = cont.id === selectedRegionId
                      return (
                        <button
                          key={cont.id}
                          onClick={() => setSelectedRegionId(cont.id)}
                          className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors flex items-center justify-between ${
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
                  <div className="flex-1 p-5 overflow-y-auto bg-white">
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
                                      className="block text-left text-xs text-stone-500 hover:text-amber-600 transition-colors py-0.5"
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
          </div>
        </div>
      )}
    </div>
  )
}

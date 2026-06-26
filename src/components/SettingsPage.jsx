import { useState, useCallback } from 'react'

export default function SettingsPage({ settings = {}, setSettings, addNotification, packages = [] }) {
  const [editingOfferId, setEditingOfferId] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [offerForm, setOfferForm] = useState({
    title: '',
    subtitle: '',
    imageUrl: '',
    buttonText: 'Explore Packages',
    targetPage: 'destinations'
  })

  const handleSaveOffer = (e) => {
    e.preventDefault()
    if (!offerForm.title || !offerForm.subtitle || !offerForm.imageUrl) {
      if (addNotification) addNotification('Please fill in all required fields', 'warning')
      return
    }

    const currentOffers = settings.specialOffers ?? []
    let updatedOffers

    if (editingOfferId) {
      updatedOffers = currentOffers.map(o => o.id === editingOfferId ? { ...o, ...offerForm } : o)
      if (addNotification) addNotification('Special offer updated successfully!', 'success')
    } else {
      const newOffer = {
        ...offerForm,
        id: Date.now().toString()
      }
      updatedOffers = [...currentOffers, newOffer]
      if (addNotification) addNotification('Special offer added successfully!', 'success')
    }

    setSettings({
      ...settings,
      specialOffers: updatedOffers
    })

    setOfferForm({
      title: '',
      subtitle: '',
      imageUrl: '',
      buttonText: 'Explore Packages',
      targetPage: 'destinations'
    })
    setEditingOfferId(null)
    setIsFormOpen(false)
  }

  const handleEditOffer = (offer) => {
    setOfferForm({
      title: offer.title,
      subtitle: offer.subtitle,
      imageUrl: offer.imageUrl,
      buttonText: offer.buttonText ?? 'Explore Packages',
      targetPage: offer.targetPage ?? 'destinations'
    })
    setEditingOfferId(offer.id)
    setIsFormOpen(true)
  }

  const handleDeleteOffer = (id) => {
    const currentOffers = settings.specialOffers ?? []
    const updatedOffers = currentOffers.filter(o => o.id !== id)
    setSettings({
      ...settings,
      specialOffers: updatedOffers
    })
    if (addNotification) addNotification('Special offer deleted successfully!', 'info')
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      if (addNotification) addNotification('File size exceeds the 5MB limit!', 'warning')
      return
    }

    const formData = new FormData()
    formData.append('image', file)

    try {
      if (addNotification) addNotification('Uploading image...', 'info')
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const token = localStorage.getItem('kraft_token')
      const response = await fetch(`${API_URL}/api/upload`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.error || 'Failed to upload image')
      }

      const data = await response.json()
      setOfferForm(prev => ({ ...prev, imageUrl: data.imageUrl }))
      if (addNotification) addNotification('Image uploaded successfully!', 'success')
    } catch (err) {
      console.error(err)
      if (addNotification) addNotification(err.message || 'Image upload failed', 'error')
    }
  }

  const permissions = settings.permissions ?? {
    admin: { viewFinancials: true, editPricing: true, supplierCreds: true, clientScans: true },
    manager: { viewFinancials: true, editPricing: true, supplierCreds: false, clientScans: true },
    agent: { viewFinancials: false, editPricing: false, supplierCreds: false, clientScans: true }
  }

  const togglePermission = (role, key) => {
    const updated = {
      ...permissions,
      [role]: {
        ...permissions[role],
        [key]: !permissions[role][key]
      }
    }
    setSettings({
      ...settings,
      permissions: updated
    })
    if (addNotification) {
      addNotification(`Updated permissions for ${role}`, 'info')
    }
  }

  const apis = settings.apis ?? {
    sabre: { connected: true, endpoint: 'https://api.sabre.com/v2/flights', key: '••••••••••••••••••••' },
    amadeus: { connected: false, endpoint: 'https://api.amadeus.com/v1/booking', key: '' },
    bedbank: { connected: true, endpoint: 'https://api.hotelbeds.com/hotel/v3', key: '••••••••••••••••••••' }
  }

  const toggleApiConnection = (apiName) => {
    const updated = {
      ...apis,
      [apiName]: {
        ...apis[apiName],
        connected: !apis[apiName].connected
      }
    }
    setSettings({
      ...settings,
      apis: updated
    })
    const status = updated[apiName].connected ? 'connected' : 'disconnected'
    if (addNotification) {
      addNotification(`${apiName} API ${status}`, 'info')
    }
  }

  const handleApiKeyChange = (apiName, value) => {
    const updated = {
      ...apis,
      [apiName]: {
        ...apis[apiName],
        key: value
      }
    }
    setSettings({
      ...settings,
      apis: updated
    })
  }

  const defaultMarkup = parseInt(settings.rules?.markup ?? settings.defaultMarkup ?? '15')
  const defaultAgentSplit = parseInt(settings.rules?.agentSplit ?? settings.defaultAgentSplit ?? '40')
  const inrToUsdRate = parseFloat(settings.inrToUsdRate ?? 0)
  const [saving, setSaving] = useState(null)
  const [weatherRefreshing, setWeatherRefreshing] = useState(false)

  const setDefaultMarkup = (val) => {
    setSettings({
      ...settings,
      defaultMarkup: val,
      rules: {
        ...settings.rules,
        markup: val.toString()
      }
    })
  }

  const setDefaultAgentSplit = (val) => {
    setSettings({
      ...settings,
      defaultAgentSplit: val,
      rules: {
        ...settings.rules,
        agentSplit: val.toString()
      }
    })
  }

  const setInrToUsdRate = (val) => {
    setSettings({
      ...settings,
      inrToUsdRate: parseFloat(val) || 0
    })
  }

  const handleSaveSection = useCallback(async (section) => {
    setSaving(section)
    try {
      await setSettings(s => ({ ...s }))
      if (addNotification) addNotification(`${section === 'rate' ? 'Exchange rate' : 'Branding details'} saved`, 'success')
    } catch {
      if (addNotification) addNotification('Failed to save', 'error')
    } finally {
      setSaving(null)
    }
  }, [setSettings, addNotification])

  const agencyName = settings.agencyName ?? ''
  const agencyAddress = settings.agencyAddress ?? ''
  const agencyPhone = settings.agencyPhone ?? ''
  const agencyEmail = settings.agencyEmail ?? ''
  const setAgencyAddress = (val) => {
    setSettings({
      ...settings,
      agencyAddress: val
    })
  }

  const setAgencyPhone = (val) => {
    setSettings({
      ...settings,
      agencyPhone: val
    })
  }

  const setAgencyEmail = (val) => {
    setSettings({
      ...settings,
      agencyEmail: val
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-stone-900 tracking-tight">Agency Operations & Settings</h2>
        <p className="text-xs text-stone-400">Manage permissions, link API credentials, and set global markup standards.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Left column (2 cols) */}
        <div className="xl:col-span-2 space-y-6">
          {/* Access Control Matrix */}
          <section className="bg-white border border-stone-200/80 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-stone-200/50">
              <h3 className="text-sm font-bold text-stone-900 tracking-tight">Staff Roles & Permissions</h3>
              <p className="text-[11px] text-stone-400">Configure access levels across executive, management, and junior staff roles.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50/50 border-b border-stone-200/50 text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                    <th className="py-3 px-6">Operational Capability</th>
                    <th className="py-3 px-6 text-center">Administrator</th>
                    <th className="py-3 px-6 text-center">Senior Manager</th>
                    <th className="py-3 px-6 text-center">Travel Agent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-xs">
                  <tr className="hover:bg-stone-50/10">
                    <td className="py-3 px-6 font-semibold text-stone-800">Access Global Agency Reports</td>
                    {['admin', 'manager', 'agent'].map((role) => (
                      <td key={role} className="py-3 px-6 text-center">
                        <input
                          type="checkbox"
                          checked={permissions[role].viewFinancials}
                          onChange={() => togglePermission(role, 'viewFinancials')}
                          className="rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                      </td>
                    ))}
                  </tr>
                  <tr className="hover:bg-stone-50/10">
                    <td className="py-3 px-6 font-semibold text-stone-800">Override Pricing & Markup Rules</td>
                    {['admin', 'manager', 'agent'].map((role) => (
                      <td key={role} className="py-3 px-6 text-center">
                        <input
                          type="checkbox"
                          checked={permissions[role].editPricing}
                          onChange={() => togglePermission(role, 'editPricing')}
                          className="rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                      </td>
                    ))}
                  </tr>
                  <tr className="hover:bg-stone-50/10">
                    <td className="py-3 px-6 font-semibold text-stone-800">Configure Supplier Credentials</td>
                    {['admin', 'manager', 'agent'].map((role) => (
                      <td key={role} className="py-3 px-6 text-center">
                        <input
                          type="checkbox"
                          checked={permissions[role].supplierCreds}
                          onChange={() => togglePermission(role, 'supplierCreds')}
                          className="rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                      </td>
                    ))}
                  </tr>
                  <tr className="hover:bg-stone-50/10">
                    <td className="py-3 px-6 font-semibold text-stone-800">View Client Documents Locker</td>
                    {['admin', 'manager', 'agent'].map((role) => (
                      <td key={role} className="py-3 px-6 text-center">
                        <input
                          type="checkbox"
                          checked={permissions[role].clientScans}
                          onChange={() => togglePermission(role, 'clientScans')}
                          className="rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Special Offers Banner Management */}
          <section className="bg-white border border-stone-200/80 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-bold text-stone-900 tracking-tight">Special Offers Banner Management</h3>
                <p className="text-[11px] text-stone-400">Add, edit, or delete promotional offer banners displayed on the customer-facing home page.</p>
              </div>
              {!isFormOpen && (
                <button
                  onClick={() => {
                    setEditingOfferId(null)
                    setOfferForm({
                      title: '',
                      subtitle: '',
                      imageUrl: '',
                      buttonText: 'Explore Packages',
                      targetPage: 'destinations'
                    })
                    setIsFormOpen(true)
                  }}
                  className="text-[10px] font-bold px-3 py-1.5 bg-amber-600 hover:bg-amber-550 border border-transparent text-white rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Add Offer
                </button>
              )}
            </div>

            {/* Form */}
            {isFormOpen && (
              <form onSubmit={handleSaveOffer} className="p-4 bg-[#FAF9F5]/50 border border-stone-200/40 rounded-xl space-y-4 animate-in fade-in duration-200">
                <h4 className="text-xs font-bold text-stone-900 uppercase">
                  {editingOfferId ? 'Edit Special Offer' : 'Add New Special Offer'}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="sm:col-span-2">
                    <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1">Offer Title</label>
                    <input
                      type="text"
                      placeholder="e.g., Maldives Paradise Escape"
                      value={offerForm.title}
                      onChange={(e) => setOfferForm({ ...offerForm, title: e.target.value })}
                      className="w-full bg-white border border-stone-200 focus:border-amber-500 rounded-lg p-2 text-stone-800 outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1">Offer Subtitle / Description</label>
                    <input
                      type="text"
                      placeholder="e.g., Book a luxury 5-day overwater villa stay and receive a complimentary couples spa."
                      value={offerForm.subtitle}
                      onChange={(e) => setOfferForm({ ...offerForm, subtitle: e.target.value })}
                      className="w-full bg-white border border-stone-200 focus:border-amber-500 rounded-lg p-2 text-stone-800 outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1">CTA Button Text</label>
                    <input
                      type="text"
                      placeholder="e.g., View Packages"
                      value={offerForm.buttonText}
                      onChange={(e) => setOfferForm({ ...offerForm, buttonText: e.target.value })}
                      className="w-full bg-white border border-stone-200 focus:border-amber-500 rounded-lg p-2 text-stone-800 outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1">Target Page</label>
                    <select
                      value={offerForm.targetPage}
                      onChange={(e) => setOfferForm({ ...offerForm, targetPage: e.target.value })}
                      className="w-full bg-white border border-stone-200 focus:border-amber-500 rounded-lg p-2 text-stone-800 outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="destinations">Explore Packages (Destinations)</option>
                      <option value="booking">Inquire Form (Booking)</option>
                      <option value="about">About Page</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1">Banner Image</label>
                    {offerForm.imageUrl ? (
                      <div className="flex items-center gap-3 p-2.5 bg-stone-50 border border-stone-200 rounded-xl">
                        <img
                          src={offerForm.imageUrl}
                          alt="Preview"
                          className="w-16 h-10 object-cover rounded-lg border border-stone-200 shrink-0"
                        />
                        <div className="flex-grow min-w-0">
                          <span className="block text-[8px] font-bold text-stone-400 uppercase">Selected Image</span>
                          <span className="block text-[9px] text-stone-600 truncate">{offerForm.imageUrl}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setOfferForm({ ...offerForm, imageUrl: '' })}
                          className="text-[9px] font-bold px-2 py-1 bg-white hover:bg-stone-150 border border-stone-200 rounded-lg text-stone-600 transition-all shrink-0 cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-stone-200 hover:border-amber-400 rounded-xl p-4 text-center cursor-pointer transition-all bg-white relative group">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="flex flex-col items-center justify-center gap-1">
                          <svg className="w-5 h-5 text-stone-400 group-hover:text-amber-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-[10px] font-bold text-stone-600">Upload Banner Image (Max 5MB)</span>
                          <span className="text-[8px] text-stone-400">Compatible with PNG, JPG, WEBP, GIF, SVG</span>
                        </div>
                      </div>
                    )}

                    {/* Presets */}
                    <div className="space-y-1.5">
                      <span className="block text-[8px] font-bold text-stone-400 uppercase tracking-wider">Quick Presets:</span>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { name: 'Maldives Paradise', url: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?auto=format&fit=crop&w=1000&q=80' },
                          { name: 'Swiss Alps Hiking', url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1000&q=80' },
                          { name: 'Santorini Sunset', url: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=1000&q=80' },
                          { name: 'African Safari', url: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=1000&q=80' },
                          { name: 'Tokyo City', url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1000&q=80' }
                        ].map((preset) => (
                          <button
                            key={preset.name}
                            type="button"
                            onClick={() => setOfferForm({ ...offerForm, imageUrl: preset.url })}
                            className={`text-[9px] px-2.5 py-1 rounded-md border font-semibold transition-all ${offerForm.imageUrl === preset.url
                              ? 'bg-amber-500/10 border-amber-450 text-amber-800'
                              : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                              }`}
                          >
                            {preset.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsFormOpen(false)
                      setEditingOfferId(null)
                    }}
                    className="text-[10px] font-bold px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="text-[10px] font-bold px-3 py-1.5 bg-amber-600 hover:bg-amber-550 text-white rounded-lg transition-all"
                  >
                    {editingOfferId ? 'Save Changes' : 'Create Offer'}
                  </button>
                </div>
              </form>
            )}

            {/* List */}
            <div className="space-y-3">
              {(settings.specialOffers ?? []).length === 0 ? (
                <div className="py-6 text-center text-stone-400 text-xs border border-dashed border-stone-200 rounded-xl">
                  No promotional offers configured. Fallback banners will be displayed on the customer site.
                </div>
              ) : (
                (settings.specialOffers ?? []).map((offer) => (
                  <div key={offer.id} className="flex items-center gap-3 p-3 bg-stone-50/30 border border-stone-200/40 rounded-xl">
                    <img
                      src={offer.imageUrl}
                      alt={offer.title}
                      className="w-16 h-12 object-cover rounded-lg border border-stone-200/50 shrink-0"
                    />
                    <div className="flex-grow min-w-0">
                      <h4 className="text-xs font-bold text-stone-900 truncate">{offer.title}</h4>
                      <p className="text-[10px] text-stone-500 truncate">{offer.subtitle}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-[8px] font-bold bg-amber-500/10 text-amber-700 px-1.5 py-0.5 rounded border border-amber-500/10 uppercase">
                          {offer.buttonText ?? 'Explore'}
                        </span>
                        <span className="text-[8px] font-bold bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded uppercase border border-stone-200/30">
                          ➔ {offer.targetPage === 'booking' ? 'Booking Form' : offer.targetPage === 'about' ? 'About Page' : 'Destinations'}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => handleEditOffer(offer)}
                        className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-200/50 rounded-lg transition-all"
                        title="Edit Offer"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteOffer(offer.id)}
                        className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        title="Delete Offer"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Right column (1 col) */}
        <div className="xl:col-span-1 space-y-6">
          {/* Default Rules */}
          <section className="bg-white border border-stone-200/80 rounded-2xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-stone-900 tracking-tight">Agency Pricing Standards</h3>
              <p className="text-[11px] text-stone-400">Configure global margin defaults for custom itineraries.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1">
                  Standard Markup (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={defaultMarkup}
                  onChange={(e) => setDefaultMarkup(parseInt(e.target.value) || 0)}
                  className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2 text-xs text-stone-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1">
                  Agent Commission Share (% of net margin)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={defaultAgentSplit}
                  onChange={(e) => setDefaultAgentSplit(parseInt(e.target.value) || 0)}
                  className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2 text-xs text-stone-800 outline-none"
                />
              </div>

              <div className="pt-2 border-t border-stone-100">
                <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1">
                  INR → USD Exchange Rate
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={inrToUsdRate || ''}
                    onChange={(e) => setInrToUsdRate(e.target.value)}
                    placeholder="e.g. 85.50"
                    className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2 text-xs text-stone-800 outline-none"
                  />
                  {inrToUsdRate > 0 && (
                    <span className="text-[10px] text-emerald-600 font-semibold whitespace-nowrap">
                      1 USD = ₹{inrToUsdRate.toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
                <p className="text-[9px] text-stone-400 mt-1">Set to 0 to disable USD pricing across the platform.</p>
                <button
                  type="button"
                  onClick={() => handleSaveSection('rate')}
                  disabled={saving === 'rate'}
                  className="mt-2 w-full px-3 py-1.5 text-[10px] font-bold rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 cursor-pointer transition-all flex items-center justify-center gap-1.5"
                >
                  {saving === 'rate' ? (
                    <><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Saving...</>
                  ) : 'Save Exchange Rate'}
                </button>
              </div>
            </div>
          </section>

          {/* Branding Customizer */}
          <section className="bg-white border border-stone-200/80 rounded-2xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-stone-900 tracking-tight">Invoice & Voucher Branding</h3>
              <p className="text-[11px] text-stone-400">Customize generated client correspondence files.</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1">Brand Corporate Name</label>
                <input
                  type="text"
                  disabled
                  value={agencyName}
                  className="w-full bg-stone-100 border border-stone-200 rounded-lg p-2 text-xs text-stone-400 cursor-not-allowed outline-none select-none"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1">Physical Address</label>
                <textarea
                  rows="2"
                  value={agencyAddress}
                  onChange={(e) => setAgencyAddress(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2 text-xs text-stone-800 outline-none resize-none"
                ></textarea>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1">Contact Phone Number</label>
                <input
                  type="text"
                  value={agencyPhone}
                  onChange={(e) => setAgencyPhone(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2 text-xs text-stone-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1">Contact Email Address</label>
                <input
                  type="email"
                  value={agencyEmail}
                  onChange={(e) => setAgencyEmail(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2 text-xs text-stone-800 outline-none"
                />
              </div>

              <div className="pt-2">
                <span className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1">Branded Header Preview</span>
                <div className="p-3 bg-stone-100 rounded-xl border border-stone-200 border-dashed text-center">
                  <h4 className="text-xs font-bold text-stone-900 tracking-tight">{agencyName}</h4>
                  <p className="text-[8px] text-stone-400/85 leading-normal">{agencyAddress}</p>
                  <p className="text-[8px] text-stone-400/80 mt-1">{agencyPhone} | {agencyEmail}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSaveSection('branding')}
                  disabled={saving === 'branding'}
                  className="mt-2 w-full px-3 py-1.5 text-[10px] font-bold rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 cursor-pointer transition-all flex items-center justify-center gap-1.5"
                >
                  {saving === 'branding' ? (
                    <><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Saving...</>
                  ) : 'Save Branding Details'}
                </button>
              </div>
            </div>
          </section>

          {/* Destination Weather Cache Management */}
          <section className="bg-white border border-stone-200/80 rounded-2xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-stone-900 tracking-tight">Destination Weather Cache</h3>
              <p className="text-[11px] text-stone-400">Historical weather insights cached from Open-Meteo. Data refreshes update all region forecasts atomically.</p>
            </div>

            {/* Last Updated Info */}
            <div className="bg-stone-50 border border-stone-200/70 p-3.5 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wider">Last Refreshed</span>
                <span className="text-xs font-bold text-stone-800">
                  {settings.weatherCache?.lastUpdated
                    ? new Date(settings.weatherCache.lastUpdated).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
                    : 'Never synced'}
                </span>
              </div>
              {settings.weatherCache?.lastUpdated && (
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-[10px] text-emerald-600 font-semibold">Cache active — valid for 7 days</span>
                </div>
              )}
            </div>

            {/* Representative Region Cities */}
            <div className="space-y-2">
              <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block">Region Coverage</span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { region: 'Asia', city: 'Tokyo', coords: '35.68°N, 139.69°E' },
                  { region: 'Europe', city: 'Paris', coords: '48.85°N, 2.35°E' },
                  { region: 'Middle East', city: 'Dubai', coords: '25.20°N, 55.27°E' },
                  { region: 'India', city: 'Delhi', coords: '28.61°N, 77.23°E' },
                ].map((loc) => (
                  <div key={loc.region} className="p-2.5 bg-[#FAF9F5]/40 border border-stone-200/40 rounded-xl">
                    <span className="text-[9px] text-stone-400 font-bold uppercase block">{loc.region}</span>
                    <span className="text-xs font-semibold text-stone-800">{loc.city}</span>
                    <span className="text-[9px] text-stone-400 block">{loc.coords}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Refresh Button */}
            <button
              onClick={async () => {
                setWeatherRefreshing(true)
                try {
                  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
                  const token = localStorage.getItem('kraft_token')
                  const res = await fetch(`${API_URL}/api/weather/refresh`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    }
                  })
                  if (!res.ok) throw new Error(`Server returned ${res.status}`)
                  // Re-fetch settings to get updated cache timestamp
                  const settingsRes = await fetch(`${API_URL}/api/settings`, {
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                  })
                  if (settingsRes.ok) {
                    const updatedSettings = await settingsRes.json()
                    setSettings(s => ({ ...s, weatherCache: updatedSettings.weatherCache }))
                  }
                  if (addNotification) addNotification('Weather cache refreshed successfully!', 'success')
                } catch (err) {
                  console.error('Weather refresh failed:', err)
                  if (addNotification) addNotification(err.message || 'Failed to refresh weather cache', 'error')
                } finally {
                  setWeatherRefreshing(false)
                }
              }}
              disabled={weatherRefreshing}
              className="w-full py-2 bg-[#3D7BFF] hover:bg-[#1D63FF] text-white rounded-xl text-xs font-bold shadow-sm disabled:bg-stone-100 disabled:text-stone-400 disabled:shadow-none active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {weatherRefreshing ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Refreshing Cache...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89" />
                  </svg>
                  Refresh Weather Cache
                </>
              )}
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}

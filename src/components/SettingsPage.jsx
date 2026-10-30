import { useState, useCallback, useEffect, useMemo } from 'react'
import { roleHas } from '../utils/permissions'
import SpecialityCategoriesAdmin from './SpecialityCategoriesAdmin'
import SaveConfirmationModal from './SaveConfirmationModal'
import NavigationPage from './NavigationPage'
import { validateEmail, validatePhone, validatePercentage, validateNumber } from '../utils/validation'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const imgUrl = (url) => {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `${API_URL}${url}`
}

export default function SettingsPage({
  settings = {},
  setSettings,
  testimonials = [],
  setTestimonials,
  addNotification,
  user,
  packages = [],
  token
}) {
  const [activeSubTab, setActiveSubTab] = useState('homepage')
  const [saving, setSaving] = useState(null)
  const [weatherRefreshing, setWeatherRefreshing] = useState(false)
  const [baselineSettings, setBaselineSettings] = useState(null)
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, sectionName: '', changes: [] })

  // Synchronize baseline snapshot once initial settings are loaded
  useEffect(() => {
    if (settings && Object.keys(settings).length > 0 && !baselineSettings) {
      setBaselineSettings(JSON.parse(JSON.stringify(settings)))
    }
  }, [settings, baselineSettings])

  const canWriteSettings = roleHas(user?.role, 'write:settings')

  // ─────────────────────────────────────────────
  // 1. HOMEPAGE & SPECIAL OFFERS STATE
  // ─────────────────────────────────────────────
  const [editingOfferId, setEditingOfferId] = useState(null)
  const [isOfferFormOpen, setIsOfferFormOpen] = useState(false)
  const [offerForm, setOfferForm] = useState({
    title: '',
    subtitle: '',
    imageUrl: '',
    linkUrl: '',
    buttonText: 'Explore Offer'
  })

  const heroSection = settings.heroSection ?? {
    bgImage: '/photo-1506929562872-bb421503ef21.jpeg',
    titleMain: 'Kraft your perfect',
    titleItalic: 'journey.',
    description: "Handcrafted travel to the world's most extraordinary places \nfrom ancient temples in Kyoto to overwater villas in the Maldives. Your escape, designed end-to-end.",
    btnPrimaryText: 'Explore Packages',
    btnSecondaryText: 'Plan a Custom Trip',
    stats: [
      { value: '10+', label: 'Trips Crafted', icon: 'Compass' },
      { value: '52%', label: 'Satisfaction', icon: 'Sparkles' },
      { value: '40+', label: 'Destinations', icon: 'Globe' }
    ]
  }

  const ctaSection = settings.ctaSection ?? {
    bgImage: '/assets/unsplash-app-hero.jpg',
    badgeText: 'Your Next Chapter',
    heading: 'Ready to start planning your escape?',
    description: 'Get in touch with our expert luxury travel specialists. We will customize every detail of your itinerary to build your perfect journey.',
    buttonText: 'Request custom quote'
  }

  const updateSectionVisibility = (key, value) => {
    setSettings(prev => ({
      ...prev,
      sectionVisibility: {
        ...(prev.sectionVisibility || {}),
        [key]: value
      }
    }))
  }

  const updateHeroField = (field, value) => {
    setSettings({
      ...settings,
      heroSection: {
        ...heroSection,
        [field]: value
      }
    })
  }

  const updateHeroStat = (index, field, value) => {
    const updatedStats = [...(heroSection.stats || [])]
    while (updatedStats.length <= index) {
      updatedStats.push({ value: '', label: '', icon: 'Compass' })
    }
    updatedStats[index] = { ...updatedStats[index], [field]: value }
    setSettings({
      ...settings,
      heroSection: {
        ...heroSection,
        stats: updatedStats
      }
    })
  }

  const updateCtaField = (field, value) => {
    setSettings({
      ...settings,
      ctaSection: {
        ...ctaSection,
        [field]: value
      }
    })
  }

  const handleHeroBgUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      if (addNotification) addNotification('File size exceeds the 5MB limit!', 'warning')
      return
    }
    const formData = new FormData()
    formData.append('image', file)
    try {
      if (addNotification) addNotification('Uploading hero image...', 'info')
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
      updateHeroField('bgImage', data.imageUrl)
      if (addNotification) addNotification('Hero background image updated!', 'success')
    } catch (err) {
      if (addNotification) addNotification(err.message || 'Hero image upload failed', 'error')
    }
  }

  const handleCtaBgUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      if (addNotification) addNotification('File size exceeds the 5MB limit!', 'warning')
      return
    }
    const formData = new FormData()
    formData.append('image', file)
    try {
      if (addNotification) addNotification('Uploading CTA background image...', 'info')
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
      updateCtaField('bgImage', data.imageUrl)
      if (addNotification) addNotification('CTA background image updated!', 'success')
    } catch (err) {
      if (addNotification) addNotification(err.message || 'CTA image upload failed', 'error')
    }
  }

  const handleOfferImgUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      if (addNotification) addNotification('File size exceeds the 5MB limit!', 'warning')
      return
    }
    const formData = new FormData()
    formData.append('image', file)
    try {
      if (addNotification) addNotification('Uploading offer image...', 'info')
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
      if (addNotification) addNotification('Offer image uploaded successfully!', 'success')
    } catch (err) {
      if (addNotification) addNotification(err.message || 'Offer image upload failed', 'error')
    }
  }

  const handleSaveOffer = (e) => {
    e.preventDefault()
    if (!canWriteSettings) {
      if (addNotification) addNotification('You do not have permission to modify settings', 'error')
      return
    }
    if (!offerForm.title || !offerForm.subtitle || !offerForm.imageUrl) {
      if (addNotification) addNotification('Please fill in title, subtitle, and image link', 'warning')
      return
    }
    const currentOffers = settings.specialOffers ?? []
    const payload = {
      ...offerForm,
      linkUrl: offerForm.linkUrl || offerForm.targetPage || 'destinations',
      buttonText: offerForm.buttonText || 'Explore Offer'
    }
    let updatedOffers
    if (editingOfferId) {
      updatedOffers = currentOffers.map(o => o.id === editingOfferId ? { ...o, ...payload } : o)
      if (addNotification) addNotification('Special offer updated', 'success')
    } else {
      const newOffer = { ...payload, id: Date.now().toString() }
      updatedOffers = [...currentOffers, newOffer]
      if (addNotification) addNotification('Special offer added', 'success')
    }
    setSettings({ ...settings, specialOffers: updatedOffers })
    setConfirmModal({
      isOpen: true,
      sectionName: 'Special Promotional Offers',
      changes: [
        { label: 'Offer Title', newVal: offerForm.title },
        { label: 'Offer Redirect Link', newVal: payload.linkUrl },
        { label: 'Banner Image', newVal: offerForm.imageUrl }
      ]
    })
    setOfferForm({ title: '', subtitle: '', imageUrl: '', linkUrl: '', buttonText: 'Explore Offer' })
    setEditingOfferId(null)
    setIsOfferFormOpen(false)
  }

  const handleDeleteOffer = (id) => {
    if (!canWriteSettings) return
    const currentOffers = settings.specialOffers ?? []
    setSettings({ ...settings, specialOffers: currentOffers.filter(o => o.id !== id) })
    if (addNotification) addNotification('Special offer removed', 'info')
  }

  // ─────────────────────────────────────────────
  // 2. ABOUT US PAGE STATE
  // ─────────────────────────────────────────────
  const aboutSection = settings.aboutSection ?? {
    banner: {
      badge: 'Our Story',
      title: 'Curating bespoke travel',
      description: "Founded on the belief that travel should be art, KRAFT YOUR TRIP transforms ordinary vacations into masterfully tailored luxury itineraries.",
      bgImage: '/assets/unsplash-about-hero.jpg'
    },
    philosophy: {
      badge: 'Our Philosophy',
      heading: 'Bespoke travel, curated down to the finest detail.',
      p1: "We understand that the true luxury of travel isn't just the 5-star accommodations or private transport — it's the luxury of peace of mind, of deep local experiences, and of memories created without friction.",
      p2: "Whether it is exploring Kyoto's historic shrines in traditional dress, trekking the alpine trails facing the Matterhorn, or floating in a private overwater bungalow in the Maldives, our specialists spend months designing, testing, and perfecting each detail to guarantee a perfect trip.",
      image: '/assets/unsplash-about-section.jpg'
    },
    values: [
      { title: 'Bespoke Curation', desc: 'No two journeys are the same. Our luxury travel designers create custom-tailored itineraries to meet your exact desires.', icon: 'Sparkles' },
      { title: 'Expert Local Guides', desc: 'Gain exclusive access and deep cultural connection through our network of elite professional guides and historians.', icon: 'Compass' },
      { title: 'Seamless Coordination', desc: 'From VIP fast-track airport customs to private jet and helicopter charters, we coordinate every detail flawlessly.', icon: 'Sliders' },
      { title: '24/7 Concierge Support', desc: 'Travel with absolute confidence. Our operations team and local field agents are on call around the clock to support you.', icon: 'PhoneCall' }
    ]
  }

  const updateAboutBanner = (field, val) => {
    setSettings({
      ...settings,
      aboutSection: {
        ...aboutSection,
        banner: {
          ...(aboutSection.banner || {}),
          [field]: val
        }
      }
    })
  }

  const updateAboutPhilosophy = (field, val) => {
    setSettings({
      ...settings,
      aboutSection: {
        ...aboutSection,
        philosophy: {
          ...(aboutSection.philosophy || {}),
          [field]: val
        }
      }
    })
  }

  const updateAboutValue = (index, field, val) => {
    const list = [...(aboutSection.values || [])]
    if (list[index]) {
      list[index] = { ...list[index], [field]: val }
      setSettings({
        ...settings,
        aboutSection: {
          ...aboutSection,
          values: list
        }
      })
    }
  }

  const handleAboutBannerBgUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('image', file)
    try {
      if (addNotification) addNotification('Uploading About banner...', 'info')
      const token = localStorage.getItem('kraft_token')
      const response = await fetch(`${API_URL}/api/upload`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        method: 'POST',
        body: formData
      })
      if (!response.ok) throw new Error('Upload failed')
      const data = await response.json()
      updateAboutBanner('bgImage', data.imageUrl)
      if (addNotification) addNotification('About banner updated!', 'success')
    } catch (err) {
      if (addNotification) addNotification(err.message, 'error')
    }
  }

  const handleAboutPhilosophyImgUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('image', file)
    try {
      if (addNotification) addNotification('Uploading Philosophy photo...', 'info')
      const token = localStorage.getItem('kraft_token')
      const response = await fetch(`${API_URL}/api/upload`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        method: 'POST',
        body: formData
      })
      if (!response.ok) throw new Error('Upload failed')
      const data = await response.json()
      updateAboutPhilosophy('image', data.imageUrl)
      if (addNotification) addNotification('Philosophy image updated!', 'success')
    } catch (err) {
      if (addNotification) addNotification(err.message, 'error')
    }
  }

  // ─────────────────────────────────────────────
  // 3. REVIEWS & TESTIMONIALS MODERATION STATE
  // ─────────────────────────────────────────────
  const [reviewFilter, setReviewFilter] = useState('All')
  const [editingReview, setEditingReview] = useState(null)
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false)
  const [reviewForm, setReviewForm] = useState({
    name: '',
    location: '',
    avatar: '',
    rating: 5,
    text: '',
    package: '',
    role: 'Customer',
    status: 'approved'
  })

  const toggleReviewStatus = (t) => {
    if (!setTestimonials) return
    const nextStatus = t.status === 'approved' ? 'hidden' : 'approved'
    const updated = testimonials.map(item => item.id === t.id ? { ...item, status: nextStatus } : item)
    setTestimonials(updated)
    if (addNotification) {
      addNotification(
        `Review from "${t.name}" is now ${nextStatus === 'approved' ? 'Active on website' : 'Hidden from website'}`,
        'success'
      )
    }
  }

  const handleDeleteReview = (t) => {
    if (!setTestimonials) return
    if (!confirm(`Are you sure you want to permanently delete the review from "${t.name}"?`)) return
    const updated = testimonials.filter(item => item.id !== t.id)
    setTestimonials(updated)
    if (addNotification) addNotification(`Review from "${t.name}" deleted`, 'info')
  }

  const handleSaveReviewModal = (e) => {
    e.preventDefault()
    if (!setTestimonials) return
    if (!reviewForm.name.trim() || !reviewForm.text.trim()) {
      if (addNotification) addNotification('Reviewer Name and Review Text are required', 'warning')
      return
    }
    if (editingReview) {
      const updated = testimonials.map(item => item.id === editingReview.id ? { ...item, ...reviewForm } : item)
      setTestimonials(updated)
      if (addNotification) addNotification(`Review from "${reviewForm.name}" updated`, 'success')
    } else {
      const newReview = {
        id: Date.now().toString(),
        ...reviewForm,
        images: []
      }
      setTestimonials([newReview, ...testimonials])
      if (addNotification) addNotification(`Review from "${reviewForm.name}" added`, 'success')
    }
    setIsReviewModalOpen(false)
    setEditingReview(null)
    setReviewForm({ name: '', location: '', avatar: '', rating: 5, text: '', package: '', role: 'Customer', status: 'approved' })
  }

  // ─────────────────────────────────────────────
  // 4. FOOTER & OFFICE CONTACT DETAILS STATE
  // ─────────────────────────────────────────────
  const agencyName = settings.agencyName ?? 'KRAFT YOUR TRIP'
  const agencyAddress = settings.agencyAddress ?? ''
  const agencyPhone = settings.agencyPhone ?? ''
  const agencyEmail = settings.agencyEmail ?? ''
  const agencyTagline = settings.agencyTagline ?? ''
  const workingHours = settings.workingHours ?? ''
  const socialLinks = settings.socialLinks ?? {}

  const setAgencyAddress = (val) => setSettings({ ...settings, agencyAddress: val })
  const setAgencyPhone = (val) => setSettings({ ...settings, agencyPhone: val })
  const setAgencyEmail = (val) => setSettings({ ...settings, agencyEmail: val })
  const setAgencyTagline = (val) => setSettings({ ...settings, agencyTagline: val })
  const setWorkingHours = (val) => setSettings({ ...settings, workingHours: val })
  const setSocialLink = (platform, val) => {
    setSettings({
      ...settings,
      socialLinks: {
        ...(settings.socialLinks || {}),
        [platform]: val
      }
    })
  }

  // ─────────────────────────────────────────────
  // 5. AGENCY OPERATIONS STATE
  // ─────────────────────────────────────────────
  const defaultMarkup = parseInt(settings.rules?.markup ?? settings.defaultMarkup ?? '15')
  const defaultAgentSplit = parseInt(settings.rules?.agentSplit ?? settings.defaultAgentSplit ?? '40')
  const inrToUsdRate = parseFloat(settings.inrToUsdRate ?? 0)

  const setDefaultMarkup = (val) => {
    setSettings({
      ...settings,
      defaultMarkup: val,
      rules: { ...settings.rules, markup: val.toString() }
    })
  }

  const setDefaultAgentSplit = (val) => {
    setSettings({
      ...settings,
      defaultAgentSplit: val,
      rules: { ...settings.rules, agentSplit: val.toString() }
    })
  }

  const setInrToUsdRate = (val) => {
    setSettings({
      ...settings,
      inrToUsdRate: parseFloat(val) || 0
    })
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
    setSettings({ ...settings, permissions: updated })
    if (addNotification) addNotification(`Updated permissions for ${role}`, 'info')
  }

  // ─────────────────────────────────────────────
  // DIRTY CHECKING & DIFF COMPUTATION
  // ─────────────────────────────────────────────
  const getHeroDiff = useCallback((curr, base) => {
    if (!base) return []
    const diffs = []
    const c = curr?.heroSection || {}
    const b = base?.heroSection || {}
    if ((c.titleMain || '') !== (b.titleMain || '')) {
      diffs.push({ label: 'Hero Main Title', oldVal: b.titleMain, newVal: c.titleMain })
    }
    if ((c.titleItalic || '') !== (b.titleItalic || '')) {
      diffs.push({ label: 'Hero Italic Title', oldVal: b.titleItalic, newVal: c.titleItalic })
    }
    if ((c.description || '') !== (b.description || '')) {
      diffs.push({ label: 'Hero Description', oldVal: b.description, newVal: c.description })
    }
    if ((c.btnPrimaryText || '') !== (b.btnPrimaryText || '')) {
      diffs.push({ label: 'Primary Button Label', oldVal: b.btnPrimaryText, newVal: c.btnPrimaryText })
    }
    if ((c.btnSecondaryText || '') !== (b.btnSecondaryText || '')) {
      diffs.push({ label: 'Secondary Button Label', oldVal: b.btnSecondaryText, newVal: c.btnSecondaryText })
    }
    if ((c.bgImage || '') !== (b.bgImage || '')) {
      diffs.push({ label: 'Hero Background Image', oldVal: b.bgImage, newVal: c.bgImage })
    }
    const cStats = c.stats || []
    const bStats = b.stats || []
    cStats.forEach((st, idx) => {
      const bSt = bStats[idx] || {}
      if ((st.value || '') !== (bSt.value || '') || (st.label || '') !== (bSt.label || '')) {
        diffs.push({ label: `Hero Stat #${idx + 1} (${st.label || bSt.label || 'Metric'})`, oldVal: bSt.value, newVal: st.value })
      }
    })
    return diffs
  }, [])

  const getCtaDiff = useCallback((curr, base) => {
    if (!base) return []
    const diffs = []
    const c = curr?.ctaSection || {}
    const b = base?.ctaSection || {}
    if ((c.badgeText || '') !== (b.badgeText || '')) {
      diffs.push({ label: 'CTA Tagline Badge', oldVal: b.badgeText, newVal: c.badgeText })
    }
    if ((c.heading || '') !== (b.heading || '')) {
      diffs.push({ label: 'CTA Heading', oldVal: b.heading, newVal: c.heading })
    }
    if ((c.description || '') !== (b.description || '')) {
      diffs.push({ label: 'CTA Description', oldVal: b.description, newVal: c.description })
    }
    if ((c.buttonText || '') !== (b.buttonText || '')) {
      diffs.push({ label: 'CTA Button Text', oldVal: b.buttonText, newVal: c.buttonText })
    }
    if ((c.bgImage || '') !== (b.bgImage || '')) {
      diffs.push({ label: 'CTA Background Image', oldVal: b.bgImage, newVal: c.bgImage })
    }
    return diffs
  }, [])

  const getAboutBannerDiff = useCallback((curr, base) => {
    if (!base) return []
    const diffs = []
    const c = curr?.aboutSection?.banner || {}
    const b = base?.aboutSection?.banner || {}
    if ((c.badge || '') !== (b.badge || '')) {
      diffs.push({ label: 'Story Tagline Badge', oldVal: b.badge, newVal: c.badge })
    }
    if ((c.title || '') !== (b.title || '')) {
      diffs.push({ label: 'Story Headline', oldVal: b.title, newVal: c.title })
    }
    if ((c.description || '') !== (b.description || '')) {
      diffs.push({ label: 'Story Paragraph', oldVal: b.description, newVal: c.description })
    }
    if ((c.bgImage || '') !== (b.bgImage || '')) {
      diffs.push({ label: 'Story Banner Background', oldVal: b.bgImage, newVal: c.bgImage })
    }
    return diffs
  }, [])

  const getPhilosophyDiff = useCallback((curr, base) => {
    if (!base) return []
    const diffs = []
    const c = curr?.aboutSection?.philosophy || {}
    const b = base?.aboutSection?.philosophy || {}
    if ((c.badge || '') !== (b.badge || '')) {
      diffs.push({ label: 'Philosophy Badge', oldVal: b.badge, newVal: c.badge })
    }
    if ((c.heading || '') !== (b.heading || '')) {
      diffs.push({ label: 'Philosophy Heading', oldVal: b.heading, newVal: c.heading })
    }
    if ((c.p1 || '') !== (b.p1 || '')) {
      diffs.push({ label: 'Philosophy Paragraph 1', oldVal: b.p1, newVal: c.p1 })
    }
    if ((c.p2 || '') !== (b.p2 || '')) {
      diffs.push({ label: 'Philosophy Paragraph 2', oldVal: b.p2, newVal: c.p2 })
    }
    if ((c.image || '') !== (b.image || '')) {
      diffs.push({ label: 'Philosophy Feature Photo', oldVal: b.image, newVal: c.image })
    }
    return diffs
  }, [])

  const getValuesDiff = useCallback((curr, base) => {
    if (!base) return []
    const diffs = []
    const c = curr?.aboutSection?.values || []
    const b = base?.aboutSection?.values || []
    c.forEach((v, idx) => {
      const bV = b[idx] || {}
      if ((v.title || '') !== (bV.title || '')) {
        diffs.push({ label: `Value #${idx + 1} Title`, oldVal: bV.title, newVal: v.title })
      }
      if ((v.desc || '') !== (bV.desc || '')) {
        diffs.push({ label: `Value #${idx + 1} Description`, oldVal: bV.desc, newVal: v.desc })
      }
    })
    return diffs
  }, [])

  const getContactDiff = useCallback((curr, base) => {
    if (!base) return []
    const diffs = []
    const fields = [
      { key: 'agencyName', label: 'Brand Corporate Name' },
      { key: 'agencyAddress', label: 'Office Address' },
      { key: 'agencyPhone', label: 'Contact Phone Number' },
      { key: 'agencyEmail', label: 'Contact Email Address' },
      { key: 'agencyTagline', label: 'Footer Tagline' },
      { key: 'workingHours', label: 'Business Operating Hours' }
    ]
    fields.forEach(({ key, label }) => {
      if ((curr[key] ?? '') !== (base[key] ?? '')) {
        diffs.push({ label, oldVal: base[key] ?? '', newVal: curr[key] ?? '' })
      }
    })
    const cSoc = curr.socialLinks || {}
    const bSoc = base.socialLinks || {}
    const platforms = ['whatsapp', 'instagram', 'facebook', 'twitter', 'linkedin', 'youtube']
    platforms.forEach(p => {
      if ((cSoc[p] || '') !== (bSoc[p] || '')) {
        diffs.push({ label: `${p.charAt(0).toUpperCase() + p.slice(1)} URL`, oldVal: bSoc[p] || '', newVal: cSoc[p] || '' })
      }
    })
    return diffs
  }, [])

  const getFinancialDiff = useCallback((curr, base) => {
    if (!base) return []
    const diffs = []
    const cMarkup = String(curr.rules?.markup ?? curr.defaultMarkup ?? '15')
    const bMarkup = String(base.rules?.markup ?? base.defaultMarkup ?? '15')
    if (cMarkup !== bMarkup) {
      diffs.push({ label: 'Default Agency Markup (%)', oldVal: `${bMarkup}%`, newVal: `${cMarkup}%` })
    }
    const cSplit = String(curr.rules?.agentSplit ?? curr.defaultAgentSplit ?? '40')
    const bSplit = String(base.rules?.agentSplit ?? base.defaultAgentSplit ?? '40')
    if (cSplit !== bSplit) {
      diffs.push({ label: 'Agent Commission Split (%)', oldVal: `${bSplit}%`, newVal: `${cSplit}%` })
    }
    const cRate = Number(curr.inrToUsdRate ?? 0)
    const bRate = Number(base.inrToUsdRate ?? 0)
    if (cRate !== bRate) {
      diffs.push({ label: 'INR to USD Exchange Rate', oldVal: bRate, newVal: cRate })
    }
    return diffs
  }, [])

  const getVisibilityDiff = useCallback((curr, base) => {
    if (!base) return []
    const diffs = []
    const cVis = curr.sectionVisibility || {}
    const bVis = base.sectionVisibility || {}
    const sections = [
      { key: 'hero', label: 'Hero Banner Section' },
      { key: 'categories', label: 'Explore Destinations Categories Strip' },
      { key: 'featured', label: 'Featured Luxury Packages (2 Rows)' },
      { key: 'groupTours', label: 'Upcoming Group Departures' },
      { key: 'testimonials', label: 'Customer Reviews & Testimonial Wall' },
      { key: 'speciality', label: 'Speciality Tour Categories' },
      { key: 'cta', label: 'Final Call to Action Banner' },
      { key: 'giftcards', label: 'Gift Cards' }
    ]
    sections.forEach(({ key, label }) => {
      const cVal = cVis[key] !== false
      const bVal = bVis[key] !== false
      if (cVal !== bVal) {
        diffs.push({ label, oldVal: bVal ? 'Visible (Ticked)' : 'Hidden (Unticked)', newVal: cVal ? 'Visible (Ticked)' : 'Hidden (Unticked)' })
      }
    })
    return diffs
  }, [])

  const getSectionDiff = useCallback((sectionName, curr, base) => {
    switch (sectionName) {
      case 'Section Visibility': return getVisibilityDiff(curr, base)
      case 'Homepage Hero': return getHeroDiff(curr, base)
      case 'Homepage CTA': return getCtaDiff(curr, base)
      case 'About Us Banner': return getAboutBannerDiff(curr, base)
      case 'Philosophy Section': return getPhilosophyDiff(curr, base)
      case 'Core Values': return getValuesDiff(curr, base)
      case 'Footer & Contact': return getContactDiff(curr, base)
      case 'Financial Rules': return getFinancialDiff(curr, base)
      default: return []
    }
  }, [getVisibilityDiff, getHeroDiff, getCtaDiff, getAboutBannerDiff, getPhilosophyDiff, getValuesDiff, getContactDiff, getFinancialDiff])

  const visibilityDiff = useMemo(() => getVisibilityDiff(settings, baselineSettings), [settings, baselineSettings, getVisibilityDiff])
  const heroDiff = useMemo(() => getHeroDiff(settings, baselineSettings), [settings, baselineSettings, getHeroDiff])
  const ctaDiff = useMemo(() => getCtaDiff(settings, baselineSettings), [settings, baselineSettings, getCtaDiff])
  const aboutBannerDiff = useMemo(() => getAboutBannerDiff(settings, baselineSettings), [settings, baselineSettings, getAboutBannerDiff])
  const philosophyDiff = useMemo(() => getPhilosophyDiff(settings, baselineSettings), [settings, baselineSettings, getPhilosophyDiff])
  const valuesDiff = useMemo(() => getValuesDiff(settings, baselineSettings), [settings, baselineSettings, getValuesDiff])
  const contactDiff = useMemo(() => getContactDiff(settings, baselineSettings), [settings, baselineSettings, getContactDiff])
  const financialDiff = useMemo(() => getFinancialDiff(settings, baselineSettings), [settings, baselineSettings, getFinancialDiff])

  const handleSaveSection = useCallback(async (sectionName) => {
    if (!canWriteSettings) {
      if (addNotification) addNotification('You do not have permission to modify settings', 'error')
      return
    }

    if (sectionName === 'Footer & Contact') {
      if (agencyEmail) {
        const emailCheck = validateEmail(agencyEmail)
        if (!emailCheck.isValid) {
          if (addNotification) addNotification(emailCheck.error, 'error')
          return
        }
      }
      if (agencyPhone) {
        const phoneCheck = validatePhone(agencyPhone)
        if (!phoneCheck.isValid) {
          if (addNotification) addNotification(phoneCheck.error, 'error')
          return
        }
      }
    }

    if (sectionName === 'Financial Rules') {
      const markupCheck = validatePercentage(defaultMarkup, 'Default Agency Markup')
      if (!markupCheck.isValid) {
        if (addNotification) addNotification(markupCheck.error, 'error')
        return
      }
      const splitCheck = validatePercentage(defaultAgentSplit, 'Agent Commission Split')
      if (!splitCheck.isValid) {
        if (addNotification) addNotification(splitCheck.error, 'error')
        return
      }
      const rateCheck = validateNumber(inrToUsdRate, { min: 0.0001, fieldName: 'INR / USD Multiplier' })
      if (!rateCheck.isValid) {
        if (addNotification) addNotification(rateCheck.error, 'error')
        return
      }
    }

    const changes = getSectionDiff(sectionName, settings, baselineSettings)
    if (changes.length === 0) {
      if (addNotification) addNotification('No changes detected in this section', 'info')
      return
    }

    setSaving(sectionName)
    try {
      await setSettings(s => ({ ...s }))
      setBaselineSettings(JSON.parse(JSON.stringify(settings)))
      setConfirmModal({
        isOpen: true,
        sectionName,
        changes
      })
      if (addNotification) addNotification(`${sectionName} saved successfully!`, 'success')
    } catch {
      if (addNotification) addNotification('Failed to save settings', 'error')
    } finally {
      setSaving(null)
    }
  }, [settings, baselineSettings, getSectionDiff, setSettings, addNotification, canWriteSettings])

  const handleRefreshWeather = async () => {
    setWeatherRefreshing(true)
    try {
      const token = localStorage.getItem('kraft_token')
      const res = await fetch(`${API_URL}/api/weather/refresh`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
      if (!res.ok) throw new Error('Failed to refresh weather')
      if (addNotification) addNotification('Weather data refreshed from Open-Meteo', 'success')
    } catch (err) {
      if (addNotification) addNotification(err.message, 'error')
    } finally {
      setWeatherRefreshing(false)
    }
  }

  // Sub-tabs list
  const SUB_TABS = [
    {
      id: 'homepage',
      label: 'Homepage',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
    {
      id: 'about',
      label: 'About Us',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      id: 'reviews',
      label: 'Reviews',
      badge: testimonials.length,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      )
    },
    {
      id: 'footer',
      label: 'Footer & Contact',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
    {
      id: 'operations',
      label: 'Agency & Operations',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
    {
      id: 'navigation',
      label: 'Tour Highlights & Navigation',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" />
        </svg>
      )
    }
  ]

  const filteredReviews = testimonials.filter(t => {
    if (reviewFilter === 'Approved') return (t.status || 'approved') === 'approved'
    if (reviewFilter === 'Hidden') return t.status === 'hidden'
    return true
  })

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2.5">
            <span>Website CMS & Agency Settings</span>
          </h2>
          <p className="text-xs text-stone-400">
            Control all public content on Kraft Your Trip: Homepage, About Us, Reviews, Footer and operational parameters.
          </p>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex items-center gap-1.5 border-b border-stone-200 overflow-x-auto pb-px">
        {SUB_TABS.map((tab) => {
          const isActive = activeSubTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'border-amber-600 text-amber-700 bg-amber-50/50'
                  : 'border-transparent text-stone-500 hover:text-stone-800 hover:bg-stone-50'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isActive ? 'bg-amber-600 text-white' : 'bg-stone-200 text-stone-600'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. HOMEPAGE SUB-TAB */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'homepage' && (
        <div className="space-y-6">
          {/* Section Visibility Controls (CMS To Frontend) */}
          <section className="bg-white border border-stone-200/80 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-stone-100 pb-4 gap-3">
              <div>
                <h3 className="text-sm font-bold text-stone-900 tracking-tight flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Frontend Section Visibility (CMS Control)
                </h3>
                <p className="text-xs text-stone-500">Tick or untick to instantly toggle what is visible on the live customer website without touching code.</p>
              </div>
              <button
                type="button"
                onClick={() => handleSaveSection('Section Visibility')}
                disabled={saving === 'Section Visibility' || visibilityDiff.length === 0}
                className={`px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all ${
                  visibilityDiff.length > 0
                    ? 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer'
                    : 'bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed'
                }`}
              >
                {saving === 'Section Visibility' ? 'Saving...' : visibilityDiff.length > 0 ? `Save Visibility Changes (${visibilityDiff.length})` : 'Saved (No changes)'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              {[
                { key: 'hero', label: 'Hero Banner', desc: 'Main headline, search, counters' },
                { key: 'categories', label: 'Explore Destinations', desc: 'Destination countries strip' },
                { key: 'featured', label: 'Featured Packages', desc: '2 full rows (8 packages)' },
                { key: 'groupTours', label: 'Upcoming Group Tours', desc: 'Group departures showcase' },
                { key: 'testimonials', label: 'Customer Reviews Wall', desc: 'Affect UI testimonial wall' },
                { key: 'speciality', label: 'Speciality Categories', desc: 'Honeymoon, wildlife, luxury' },
                { key: 'cta', label: 'Call to Action Banner', desc: 'Bottom lead conversion bar' },
                { key: 'giftcards', label: 'Gift Cards', desc: 'Voucher & gift cards module' }
              ].map(({ key, label, desc }) => {
                const isChecked = (settings.sectionVisibility || {})[key] !== false
                return (
                  <label
                    key={key}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                      isChecked
                        ? 'bg-amber-50/40 border-amber-300 text-stone-900 shadow-xs'
                        : 'bg-stone-50/60 border-stone-200 text-stone-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => updateSectionVisibility(key, e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded text-amber-600 focus:ring-amber-500 border-stone-300 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="text-xs font-bold leading-snug">{label}</div>
                      <div className="text-[10px] text-stone-500 leading-tight mt-0.5">{desc}</div>
                      <div className="mt-1">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${isChecked ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'}`}>
                          {isChecked ? 'Live / Visible' : 'Hidden'}
                        </span>
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
          </section>

          {/* Hero Banner Section */}
          <section className="bg-white border border-stone-200/80 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <div>
                <h3 className="text-sm font-bold text-stone-900 tracking-tight">Hero Banner & Main Visual</h3>
                <p className="text-xs text-stone-500">Edit titles, subtitle paragraph, background imagery, and stat counters.</p>
              </div>
              <button
                type="button"
                onClick={() => handleSaveSection('Homepage Hero')}
                disabled={saving === 'Homepage Hero' || heroDiff.length === 0}
                className={`px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all ${
                  heroDiff.length > 0
                    ? 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer'
                    : 'bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed'
                }`}
              >
                {saving === 'Homepage Hero' ? 'Saving...' : heroDiff.length > 0 ? `Save Hero Changes (${heroDiff.length})` : 'Saved (No changes)'}
              </button>
            </div>

            <div className="space-y-4">
              {/* Background Image Upload */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-2">Hero Background Image</label>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-full sm:w-48 h-24 rounded-xl overflow-hidden bg-stone-100 border border-stone-200 shrink-0">
                    <img
                      src={imgUrl(heroSection.bgImage)}
                      alt="Hero Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none'
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="inline-flex items-center px-3.5 py-2 bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs font-semibold rounded-lg shadow-xs cursor-pointer transition-colors">
                      <svg className="w-4 h-4 mr-2 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Upload New Hero Image
                      <input type="file" accept="image/*" onChange={handleHeroBgUpload} className="hidden" />
                    </label>
                    <p className="text-[11px] text-stone-400">Stored directly in database. High-resolution landscape (JPG, PNG, WebP up to 5MB).</p>
                  </div>
                </div>
              </div>

              {/* Title Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Headline Main Text</label>
                  <input
                    type="text"
                    value={heroSection.titleMain || ''}
                    onChange={(e) => updateHeroField('titleMain', e.target.value)}
                    placeholder="e.g. Kraft your perfect"
                    className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Headline Italic Accent Text</label>
                  <input
                    type="text"
                    value={heroSection.titleItalic || ''}
                    onChange={(e) => updateHeroField('titleItalic', e.target.value)}
                    placeholder="e.g. journey."
                    className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 italic"
                  />
                </div>
              </div>

              {/* Subtitle Description */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Hero Subtitle Paragraph</label>
                <textarea
                  rows={3}
                  value={heroSection.description || ''}
                  onChange={(e) => updateHeroField('description', e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                />
              </div>

              {/* Buttons Text */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Primary Button Label</label>
                  <input
                    type="text"
                    value={heroSection.btnPrimaryText || ''}
                    onChange={(e) => updateHeroField('btnPrimaryText', e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Secondary Button Label</label>
                  <input
                    type="text"
                    value={heroSection.btnSecondaryText || ''}
                    onChange={(e) => updateHeroField('btnSecondaryText', e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                  />
                </div>
              </div>

              {/* Highlight Stat Counters */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-stone-800 mb-2">3 Highlight Stat Counters</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[0, 1, 2].map((idx) => {
                    const stat = (heroSection.stats && heroSection.stats[idx]) || { value: '', label: '', icon: 'Compass' }
                    return (
                      <div key={idx} className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
                        <span className="text-[10px] font-bold text-stone-400 uppercase">Counter #{idx + 1}</span>
                        <input
                          type="text"
                          value={stat.value}
                          onChange={(e) => updateHeroStat(idx, 'value', e.target.value)}
                          placeholder="e.g. 500+"
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-200 rounded-lg font-bold"
                        />
                        <input
                          type="text"
                          value={stat.label}
                          onChange={(e) => updateHeroStat(idx, 'label', e.target.value)}
                          placeholder="e.g. Trips Crafted"
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-200 rounded-lg"
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* Bottom Call to Action Section */}
          <section className="bg-white border border-stone-200/80 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <div>
                <h3 className="text-sm font-bold text-stone-900 tracking-tight">Bottom Call To Action (CTA) Banner</h3>
                <p className="text-xs text-stone-500">Customize the high-conversion lead banner at the bottom of the homepage.</p>
              </div>
              <button
                type="button"
                onClick={() => handleSaveSection('Homepage CTA')}
                disabled={saving === 'Homepage CTA' || ctaDiff.length === 0}
                className={`px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all ${
                  ctaDiff.length > 0
                    ? 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer'
                    : 'bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed'
                }`}
              >
                {saving === 'Homepage CTA' ? 'Saving...' : ctaDiff.length > 0 ? `Save CTA Changes (${ctaDiff.length})` : 'Saved (No changes)'}
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Tagline Badge Text</label>
                  <input
                    type="text"
                    value={ctaSection.badgeText || ''}
                    onChange={(e) => updateCtaField('badgeText', e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Heading</label>
                  <input
                    type="text"
                    value={ctaSection.heading || ''}
                    onChange={(e) => updateCtaField('heading', e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 font-semibold"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={ctaSection.description || ''}
                    onChange={(e) => updateCtaField('description', e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Button Text</label>
                  <input
                    type="text"
                    value={ctaSection.buttonText || ''}
                    onChange={(e) => updateCtaField('buttonText', e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                  />
                </div>
              </div>

              {/* CTA Background Image */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-2">CTA Background Image</label>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-full sm:w-48 h-24 rounded-xl overflow-hidden bg-stone-100 border border-stone-200 shrink-0">
                    <img
                      src={imgUrl(ctaSection.bgImage)}
                      alt="CTA Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none'
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="inline-flex items-center px-3.5 py-2 bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs font-semibold rounded-lg shadow-xs cursor-pointer transition-colors">
                      <svg className="w-4 h-4 mr-2 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Upload New CTA Image
                      <input type="file" accept="image/*" onChange={handleCtaBgUpload} className="hidden" />
                    </label>
                    <p className="text-[11px] text-stone-400">Stored directly in database. High-resolution banner photo for the bottom conversion card.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Special Offers Section */}
          <section className="bg-white border border-stone-200/80 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-stone-900 tracking-tight">Special Promotional Offers</h3>
                <p className="text-xs text-stone-500">Banner cards highlighting active discounts or featured destinations with redirect links.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingOfferId(null)
                  setOfferForm({ title: '', subtitle: '', imageUrl: '', buttonText: 'Explore Offer', linkUrl: '' })
                  setIsOfferFormOpen(true)
                }}
                className="px-3.5 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                + Add Offer Card
              </button>
            </div>

            {/* Offer Form Modal / Drawer */}
            {isOfferFormOpen && (
              <form onSubmit={handleSaveOffer} className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">Offer Title</label>
                    <input
                      type="text"
                      value={offerForm.title}
                      onChange={(e) => setOfferForm({ ...offerForm, title: e.target.value })}
                      placeholder="e.g. Maldives Paradise Escape"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">Offer Subtitle / Description</label>
                    <input
                      type="text"
                      value={offerForm.subtitle}
                      onChange={(e) => setOfferForm({ ...offerForm, subtitle: e.target.value })}
                      placeholder="Book 5-day overwater villa and receive..."
                      className="w-full px-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">
                      Target Link / Redirect Destination
                    </label>
                    <input
                      type="text"
                      value={offerForm.linkUrl || ''}
                      onChange={(e) => setOfferForm({ ...offerForm, linkUrl: e.target.value })}
                      placeholder="e.g. https://... or package:pkg_123 or destinations"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg font-mono"
                    />
                    <p className="text-[10px] text-stone-400 mt-1">
                      Direct link: external URL (<code>https://...</code>), page (<code>booking</code>, <code>about</code>, <code>enquiry</code>), or package ID.
                    </p>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">
                      Link to Existing Package (Quick Fill)
                    </label>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          setOfferForm({ ...offerForm, linkUrl: e.target.value })
                        }
                      }}
                      defaultValue=""
                      className="w-full px-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg text-stone-700"
                    >
                      <option value="">-- Or choose a Package to link --</option>
                      {packages.map(p => (
                        <option key={p.id} value={`package:${p.id}`}>
                          {p.name} ({p.region || 'Tour'})
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-stone-400 mt-1">
                      Automatically fills redirect link to take travelers directly to this package.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">Banner Image</label>
                    <div className="flex items-center gap-3">
                      {offerForm.imageUrl ? (
                        <div className="w-16 h-10 rounded border border-stone-200 overflow-hidden shrink-0 bg-stone-100">
                          <img
                            src={imgUrl(offerForm.imageUrl)}
                            alt="Preview"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none'
                            }}
                          />
                        </div>
                      ) : null}
                      <label className="inline-flex items-center px-3.5 py-1.5 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold rounded-lg border border-stone-300 shadow-2xs cursor-pointer transition-colors shrink-0">
                        <svg className="w-3.5 h-3.5 mr-1.5 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        {offerForm.imageUrl ? 'Change Offer Banner' : 'Upload Offer Banner'}
                        <input type="file" accept="image/*" onChange={handleOfferImgUpload} className="hidden" />
                      </label>
                      <span className="text-[11px] text-stone-400">Stored directly in database</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">CTA Button Label</label>
                    <input
                      type="text"
                      value={offerForm.buttonText || ''}
                      onChange={(e) => setOfferForm({ ...offerForm, buttonText: e.target.value })}
                      placeholder="Explore Offer"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsOfferFormOpen(false)}
                    className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-200 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-lg shadow-xs cursor-pointer"
                  >
                    {editingOfferId ? 'Update Offer' : 'Save Offer'}
                  </button>
                </div>
              </form>
            )}

            {/* Existing Offers Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(settings.specialOffers || []).map((offer) => (
                <div key={offer.id} className="p-4 bg-stone-50 border border-stone-200/80 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {offer.imageUrl && (
                      <img
                        src={imgUrl(offer.imageUrl)}
                        alt={offer.title}
                        className="w-12 h-12 object-cover rounded-lg border border-stone-200 shrink-0"
                        onError={(e) => {
                          e.target.src = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=80'
                        }}
                      />
                    )}
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-stone-900 truncate">{offer.title}</h4>
                      <p className="text-[11px] text-stone-500 truncate mt-0.5">{offer.subtitle}</p>
                      {offer.linkUrl && (
                        <span className="inline-block mt-1 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60 font-mono truncate max-w-full">
                          Target: {offer.linkUrl}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setOfferForm(offer)
                        setEditingOfferId(offer.id)
                        setIsOfferFormOpen(true)
                      }}
                      className="px-2 py-1 text-[11px] font-medium text-stone-600 hover:bg-stone-200 rounded cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteOffer(offer.id)}
                      className="px-2 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Speciality Categories */}
          <SpecialityCategoriesAdmin token={token} addNotification={addNotification} />
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. ABOUT US SUB-TAB */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'about' && (
        <div className="space-y-6">
          {/* About Banner */}
          <section className="bg-white border border-stone-200/80 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <div>
                <h3 className="text-sm font-bold text-stone-900 tracking-tight">About Us — Top Hero Banner</h3>
                <p className="text-xs text-stone-500">Edit the top story banner that introduces your brand philosophy.</p>
              </div>
              <button
                type="button"
                onClick={() => handleSaveSection('About Us Banner')}
                disabled={saving === 'About Us Banner' || aboutBannerDiff.length === 0}
                className={`px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all ${
                  aboutBannerDiff.length > 0
                    ? 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer'
                    : 'bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed'
                }`}
              >
                {saving === 'About Us Banner' ? 'Saving...' : aboutBannerDiff.length > 0 ? `Save Banner (${aboutBannerDiff.length})` : 'Saved (No changes)'}
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Badge Tagline</label>
                  <input
                    type="text"
                    value={aboutSection.banner?.badge || ''}
                    onChange={(e) => updateAboutBanner('badge', e.target.value)}
                    placeholder="e.g. Our Story"
                    className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Hero Title</label>
                  <input
                    type="text"
                    value={aboutSection.banner?.title || ''}
                    onChange={(e) => updateAboutBanner('title', e.target.value)}
                    placeholder="e.g. Curating bespoke travel"
                    className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Story Introduction Paragraph</label>
                <textarea
                  rows={3}
                  value={aboutSection.banner?.description || ''}
                  onChange={(e) => updateAboutBanner('description', e.target.value)}
                  placeholder="e.g. Founded on the belief that travel should be art..."
                  className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-2">Banner Background Image</label>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-full sm:w-48 h-24 rounded-xl overflow-hidden bg-stone-100 border border-stone-200 shrink-0">
                    <img
                      src={imgUrl(aboutSection.banner?.bgImage)}
                      alt="About Hero Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none'
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="inline-flex items-center px-3.5 py-2 bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs font-semibold rounded-lg shadow-xs cursor-pointer transition-colors">
                      <svg className="w-4 h-4 mr-2 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Upload Banner Image
                      <input type="file" accept="image/*" onChange={handleAboutBannerBgUpload} className="hidden" />
                    </label>
                    <p className="text-[11px] text-stone-400">Stored directly in database. High-resolution banner photo for About Us.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Philosophy Section */}
          <section className="bg-white border border-stone-200/80 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <div>
                <h3 className="text-sm font-bold text-stone-900 tracking-tight">Our Philosophy Section</h3>
                <p className="text-xs text-stone-500">Edit the detailed philosophy section, 2 explanatory paragraphs, and section photograph.</p>
              </div>
              <button
                type="button"
                onClick={() => handleSaveSection('Philosophy Section')}
                disabled={saving === 'Philosophy Section' || philosophyDiff.length === 0}
                className={`px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all ${
                  philosophyDiff.length > 0
                    ? 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer'
                    : 'bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed'
                }`}
              >
                {saving === 'Philosophy Section' ? 'Saving...' : philosophyDiff.length > 0 ? `Save Philosophy (${philosophyDiff.length})` : 'Saved (No changes)'}
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Badge Tagline</label>
                  <input
                    type="text"
                    value={aboutSection.philosophy?.badge || ''}
                    onChange={(e) => updateAboutPhilosophy('badge', e.target.value)}
                    placeholder="e.g. Our Philosophy"
                    className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Headline</label>
                  <input
                    type="text"
                    value={aboutSection.philosophy?.heading || ''}
                    onChange={(e) => updateAboutPhilosophy('heading', e.target.value)}
                    placeholder="e.g. Bespoke travel, curated down to the finest detail."
                    className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Paragraph 1 (Peace of mind & memories)</label>
                <textarea
                  rows={3}
                  value={aboutSection.philosophy?.p1 || ''}
                  onChange={(e) => updateAboutPhilosophy('p1', e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Paragraph 2 (Destinations & curation commitment)</label>
                <textarea
                  rows={3}
                  value={aboutSection.philosophy?.p2 || ''}
                  onChange={(e) => updateAboutPhilosophy('p2', e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-2">Section Feature Photograph</label>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-full sm:w-48 h-32 rounded-xl overflow-hidden bg-stone-100 border border-stone-200 shrink-0">
                    <img
                      src={imgUrl(aboutSection.philosophy?.image)}
                      alt="Philosophy Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none'
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="inline-flex items-center px-3.5 py-2 bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs font-semibold rounded-lg shadow-xs cursor-pointer transition-colors">
                      <svg className="w-4 h-4 mr-2 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Upload Section Image
                      <input type="file" accept="image/*" onChange={handleAboutPhilosophyImgUpload} className="hidden" />
                    </label>
                    <p className="text-[11px] text-stone-400">Stored directly in database. Portrait or landscape editorial photo for Brand Philosophy.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Core Values Section */}
          <section className="bg-white border border-stone-200/80 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-stone-900 tracking-tight">The KRAFT Standard — 4 Core Values</h3>
                <p className="text-xs text-stone-500">Edit titles and descriptions of the 4 pillar cards displayed on the About Us page.</p>
              </div>
              <button
                type="button"
                onClick={() => handleSaveSection('Core Values')}
                disabled={saving === 'Core Values' || valuesDiff.length === 0}
                className={`px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all ${
                  valuesDiff.length > 0
                    ? 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer'
                    : 'bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed'
                }`}
              >
                {saving === 'Core Values' ? 'Saving...' : valuesDiff.length > 0 ? `Save Values (${valuesDiff.length})` : 'Saved (No changes)'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(aboutSection.values || []).map((val, idx) => (
                <div key={idx} className="p-4 bg-stone-50 border border-stone-200/80 rounded-xl space-y-2">
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Value #{idx + 1}</span>
                  <input
                    type="text"
                    value={val.title}
                    onChange={(e) => updateAboutValue(idx, 'title', e.target.value)}
                    placeholder="Value Title"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg font-bold"
                  />
                  <textarea
                    rows={2}
                    value={val.desc}
                    onChange={(e) => updateAboutValue(idx, 'desc', e.target.value)}
                    placeholder="Description..."
                    className="w-full px-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg"
                  />
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. REVIEWS & TESTIMONIALS SUB-TAB */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'reviews' && (
        <div className="space-y-6">
          <section className="bg-white border border-stone-200/80 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
              <div>
                <h3 className="text-sm font-bold text-stone-900 tracking-tight flex items-center gap-2">
                  <span>Guest Reviews & Website Moderation</span>
                  <span className="text-xs bg-amber-100 text-amber-800 font-extrabold px-2 py-0.5 rounded-full">
                    {testimonials.filter(t => (t.status || 'approved') === 'approved').length} Active on Site
                  </span>
                </h3>
                <p className="text-xs text-stone-500">
                  Select which reviews to display on the rotating website carousel. Instantly hide, edit, or delete fake reviews.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center bg-stone-100 p-0.5 rounded-lg border border-stone-200 text-xs font-semibold">
                  {['All', 'Approved', 'Hidden'].map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setReviewFilter(f)}
                      className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                        reviewFilter === f ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-800'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditingReview(null)
                    setReviewForm({ name: '', location: '', avatar: '', rating: 5, text: '', package: '', role: 'Customer', status: 'approved' })
                    setIsReviewModalOpen(true)
                  }}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-all"
                >
                  + Add Review
                </button>
              </div>
            </div>

            {/* Reviews List */}
            {filteredReviews.length === 0 ? (
              <div className="text-center py-12 text-stone-400 text-xs italic">
                No reviews found matching current filter.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredReviews.map((t) => {
                  const isApproved = (t.status || 'approved') === 'approved'
                  return (
                    <div
                      key={t.id}
                      className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        isApproved
                          ? 'bg-stone-50/60 border-stone-200/80 hover:bg-white'
                          : 'bg-stone-100/40 border-stone-200/50 opacity-60'
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-bold text-stone-900">{t.name}</h4>
                          {t.location && (
                            <span className="text-[11px] text-stone-400 font-medium">({t.location})</span>
                          )}
                          <span className="text-amber-500 text-xs font-bold">
                            {'★'.repeat(t.rating || 5)}
                          </span>
                          {t.package && (
                            <span className="text-[10px] bg-amber-50 text-amber-800 font-semibold px-2 py-0.5 rounded">
                              {t.package}
                            </span>
                          )}
                          {isApproved ? (
                            <span className="text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Live on Website
                            </span>
                          ) : (
                            <span className="text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded bg-stone-200 text-stone-600">
                              Hidden
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-stone-600 font-light italic leading-relaxed line-clamp-2">
                          &ldquo;{t.text}&rdquo;
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* 1-Click Show/Hide Toggle */}
                        <button
                          type="button"
                          onClick={() => toggleReviewStatus(t)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            isApproved
                              ? 'bg-stone-200 hover:bg-stone-300 text-stone-700'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                          }`}
                        >
                          {isApproved ? 'Hide from Site' : 'Show on Site'}
                        </button>

                        {/* Edit */}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingReview(t)
                            setReviewForm({
                              name: t.name || '',
                              location: t.location || '',
                              avatar: t.avatar || '',
                              rating: t.rating || 5,
                              text: t.text || '',
                              package: t.package || '',
                              role: t.role || 'Customer',
                              status: t.status || 'approved'
                            })
                            setIsReviewModalOpen(true)
                          }}
                          className="px-3 py-1.5 bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          Edit
                        </button>

                        {/* Delete permanently */}
                        <button
                          type="button"
                          onClick={() => handleDeleteReview(t)}
                          className="px-3 py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Add / Edit Review Modal */}
          {isReviewModalOpen && (
            <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <div className="bg-white border border-stone-200 rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <h3 className="font-bold text-stone-900 text-sm">
                    {editingReview ? 'Edit Guest Review' : 'Add Genuine Guest Review'}
                  </h3>
                  <button
                    onClick={() => setIsReviewModalOpen(false)}
                    className="text-stone-400 hover:text-stone-700 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSaveReviewModal} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-stone-600 mb-1">Reviewer Name *</label>
                      <input
                        type="text"
                        value={reviewForm.name}
                        onChange={(e) => setReviewForm({ ...reviewForm, name: e.target.value })}
                        placeholder="e.g. Priya & Rahul"
                        className="w-full px-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-stone-600 mb-1">Location</label>
                      <input
                        type="text"
                        value={reviewForm.location}
                        onChange={(e) => setReviewForm({ ...reviewForm, location: e.target.value })}
                        placeholder="e.g. Mumbai, India"
                        className="w-full px-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-stone-600 mb-1">Package / Tour Name</label>
                      <input
                        type="text"
                        value={reviewForm.package}
                        onChange={(e) => setReviewForm({ ...reviewForm, package: e.target.value })}
                        placeholder="e.g. Swiss Alps Odyssey"
                        className="w-full px-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-stone-600 mb-1">Rating (1-5)</label>
                      <select
                        value={reviewForm.rating}
                        onChange={(e) => setReviewForm({ ...reviewForm, rating: parseInt(e.target.value) })}
                        className="w-full px-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg"
                      >
                        {[5, 4, 3, 2, 1].map(r => (
                          <option key={r} value={r}>{r} Stars {'★'.repeat(r)}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">Review Quote *</label>
                    <textarea
                      rows={4}
                      value={reviewForm.text}
                      onChange={(e) => setReviewForm({ ...reviewForm, text: e.target.value })}
                      placeholder="Write the guest story or review here..."
                      className="w-full px-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">Status</label>
                    <select
                      value={reviewForm.status}
                      onChange={(e) => setReviewForm({ ...reviewForm, status: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg"
                    >
                      <option value="approved">Live on Website (Approved)</option>
                      <option value="hidden">Hidden from Website</option>
                    </select>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
                    <button
                      type="button"
                      onClick={() => setIsReviewModalOpen(false)}
                      className="px-4 py-2 text-xs text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-xl shadow-xs cursor-pointer"
                    >
                      {editingReview ? 'Save Changes' : 'Publish Review'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. FOOTER & CONTACT SUB-TAB */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'footer' && (
        <div className="space-y-6">
          <section className="bg-white border border-stone-200/80 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <div>
                <h3 className="text-sm font-bold text-stone-900 tracking-tight">Office Address & Contact Details</h3>
                <p className="text-xs text-stone-500">
                  Changes made here update the website footer, top navigation contact pill, vouchers, and invoice correspondence.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleSaveSection('Footer & Contact')}
                disabled={saving === 'Footer & Contact' || contactDiff.length === 0}
                className={`px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all ${
                  contactDiff.length > 0
                    ? 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer'
                    : 'bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed'
                }`}
              >
                {saving === 'Footer & Contact' ? 'Saving...' : contactDiff.length > 0 ? `Save Contact Details (${contactDiff.length})` : 'Saved (No changes)'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Form column */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Brand Corporate Name</label>
                  <input
                    type="text"
                    disabled
                    value={agencyName}
                    className="w-full bg-stone-100 border border-stone-200 rounded-lg p-2 text-xs text-stone-400 cursor-not-allowed select-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Physical Office Address</label>
                  <textarea
                    rows={2}
                    value={agencyAddress}
                    onChange={(e) => setAgencyAddress(e.target.value)}
                    placeholder="e.g. 456 Sandstone Ave, Suite 100, San Francisco, CA"
                    className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2 text-xs text-stone-800 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Contact Phone Number</label>
                    <input
                      type="text"
                      value={agencyPhone}
                      onChange={(e) => setAgencyPhone(e.target.value)}
                      placeholder="e.g. +91 7046704693"
                      className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2 text-xs text-stone-800 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Contact Email Address</label>
                    <input
                      type="email"
                      value={agencyEmail}
                      onChange={(e) => setAgencyEmail(e.target.value)}
                      placeholder="e.g. concierge@kraftyourtrip.com"
                      className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2 text-xs text-stone-800 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Working Hours</label>
                    <input
                      type="text"
                      value={workingHours}
                      onChange={(e) => setWorkingHours(e.target.value)}
                      placeholder="e.g. Mon – Sat: 9 AM – 6 PM"
                      className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2 text-xs text-stone-800 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Tagline & Philosophy</label>
                    <input
                      type="text"
                      value={agencyTagline}
                      onChange={(e) => setAgencyTagline(e.target.value)}
                      placeholder="e.g. Handcrafting bespoke luxury travel experiences."
                      className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2 text-xs text-stone-800 outline-none"
                    />
                  </div>
                </div>

                {/* Social Links */}
                <div className="pt-2 border-t border-stone-100">
                  <label className="block text-xs font-bold text-stone-800 mb-2">Social Media Channels</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {['instagram', 'facebook', 'twitter', 'linkedin', 'youtube'].map((platform) => (
                      <div key={platform}>
                        <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                          {platform}
                        </label>
                        <input
                          type="text"
                          value={socialLinks[platform] || ''}
                          onChange={(e) => setSocialLink(platform, e.target.value)}
                          placeholder={`https://${platform}.com/...`}
                          className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 rounded-lg p-2 text-xs text-stone-800 outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Live Preview Card */}
              <div className="space-y-3">
                <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block">Live Website Footer Preview</span>
                <div className="bg-[#0B132B] text-stone-300 p-6 rounded-2xl border border-stone-800 shadow-md space-y-5">
                  <div className="text-center space-y-1.5 pb-4 border-b border-white/10">
                    <h4 className="text-sm font-bold tracking-wider text-white uppercase">{agencyName}</h4>
                    <span className="text-[9px] text-amber-400 font-semibold uppercase tracking-widest block">Luxury Travel Concierge</span>
                    <p className="text-xs text-stone-400 font-light italic">{agencyTagline || 'Handcrafting bespoke luxury travel experiences across the globe.'}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-stone-400 block">Address</span>
                      <span className="text-stone-200 leading-tight block mt-0.5">{agencyAddress || '456 Sandstone Ave, Suite 100'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-stone-400 block">Phone</span>
                      <span className="text-amber-300 font-medium block mt-0.5">{agencyPhone || '+91 7046704693'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-stone-400 block">Email</span>
                      <span className="text-amber-300 font-medium block mt-0.5 break-all">{agencyEmail || 'concierge@kraftyourtrip.com'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-stone-400 block">Hours</span>
                      <span className="text-stone-200 block mt-0.5">{workingHours || 'Mon – Sat: 9 AM – 6 PM'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 5. AGENCY OPERATIONS SUB-TAB */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'operations' && (
        <div className="space-y-6">
          {/* Financial & Currency Rules */}
          <section className="bg-white border border-stone-200/80 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <div>
                <h3 className="text-sm font-bold text-stone-900 tracking-tight">Financial Markups & Currency Conversion</h3>
                <p className="text-xs text-stone-500">Global markup standards, agent splits, and INR/USD conversion multiplier.</p>
              </div>
              <button
                type="button"
                onClick={() => handleSaveSection('Financial Rules')}
                disabled={saving === 'Financial Rules' || financialDiff.length === 0}
                className={`px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all ${
                  financialDiff.length > 0
                    ? 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer'
                    : 'bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed'
                }`}
              >
                {saving === 'Financial Rules' ? 'Saving...' : financialDiff.length > 0 ? `Save Rules (${financialDiff.length})` : 'Saved (No changes)'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-1">
                <label className="block text-[11px] font-bold text-stone-600 uppercase">Default Agency Markup (%)</label>
                <input
                  type="number"
                  value={defaultMarkup}
                  onChange={(e) => setDefaultMarkup(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg font-bold"
                />
                <span className="text-[10px] text-stone-400">Baseline margin added to wholesale package costs.</span>
              </div>

              <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-1">
                <label className="block text-[11px] font-bold text-stone-600 uppercase">Agent Commission Split (%)</label>
                <input
                  type="number"
                  value={defaultAgentSplit}
                  onChange={(e) => setDefaultAgentSplit(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg font-bold"
                />
                <span className="text-[10px] text-stone-400">Default percentage credited to sales agents.</span>
              </div>

              <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-1">
                <label className="block text-[11px] font-bold text-stone-600 uppercase">INR / USD Exchange Multiplier</label>
                <input
                  type="number"
                  step="0.001"
                  value={inrToUsdRate}
                  onChange={(e) => setInrToUsdRate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg font-bold"
                />
                <span className="text-[10px] text-stone-400">Conversion multiplier for international currency quotes.</span>
              </div>
            </div>
          </section>

          {/* Open-Meteo Weather Cache Control */}
          <section className="bg-white border border-stone-200/80 rounded-2xl p-6 shadow-sm flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-stone-900 tracking-tight">Live Weather Archive Cache</h3>
              <p className="text-xs text-stone-500">Open-Meteo free archive forecasts cached for 7 days. Force a refresh anytime.</p>
            </div>
            <button
              type="button"
              onClick={handleRefreshWeather}
              disabled={weatherRefreshing}
              className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50 shrink-0"
            >
              {weatherRefreshing ? 'Refreshing...' : 'Refresh Weather Forecasts'}
            </button>
          </section>

          {/* Staff Roles & Permissions Access Control Matrix */}
          <section className="bg-white border border-stone-200/80 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-stone-200/50">
              <h3 className="text-sm font-bold text-stone-900 tracking-tight">Staff Roles & Operational Permissions</h3>
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
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 6. NAVIGATION & TOUR HIGHLIGHTS CMS SUB-TAB */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'navigation' && (
        <div className="space-y-4">
          <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 text-xs text-amber-900 flex items-center justify-between gap-3">
            <div>
              <span className="font-bold text-sm">Tour Highlights & Navigation CMS</span>
              <p className="text-amber-700 font-light mt-0.5">
                Configure top-level destination mega-menus, dropdown tour highlights, and navigation links. Changes reflect live on the public site.
              </p>
            </div>
          </div>
          <NavigationPage token={token} addNotification={addNotification} user={user} />
        </div>
      )}

      {/* HTML Save Confirmation Modal */}
      <SaveConfirmationModal
        isOpen={confirmModal.isOpen}
        sectionName={confirmModal.sectionName}
        changes={confirmModal.changes}
        onClose={() => setConfirmModal({ isOpen: false, sectionName: '', changes: [] })}
      />
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { cropAndCompressImage, formatFileSize } from '../utils/imageCompressor'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const FALLBACK_CATEGORY_IMG = 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80'

export default function SpecialityCategoriesAdmin({ addNotification, token }) {
  const [categories, setCategories] = useState([])
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [compressionInfo, setCompressionInfo] = useState(null)
  const fileInputRef = useRef(null)

  const [form, setForm] = useState({
    name: '',
    subtitle: '',
    keyword: '',
    imageUrl: '',
    isActive: true
  })

  const fetchData = () => {
    setLoading(true)
    Promise.all([
      fetch(`${API_URL}/api/speciality-categories`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_URL}/api/packages`).then((r) => (r.ok ? r.json() : []))
    ])
      .then(([cats, pkgs]) => {
        setCategories(cats)
        setPackages(pkgs)
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchData()
  }, [])

  const getDynamicTourCount = (catId) => {
    if (!catId || !Array.isArray(packages) || packages.length === 0) return 0
    return packages.filter((pkg) => {
      return Array.isArray(pkg.categoryIds) && pkg.categoryIds.includes(catId)
    }).length
  }

  const handleOpenNew = () => {
    setForm({
      name: '',
      subtitle: '',
      keyword: '',
      imageUrl: '',
      isActive: true
    })
    setCompressionInfo(null)
    setEditingId(null)
    setIsModalOpen(true)
  }

  const handleEdit = (cat) => {
    setForm({
      name: cat.name || '',
      subtitle: cat.subtitle || '',
      keyword: cat.keyword || '',
      imageUrl: cat.imageUrl || '',
      isActive: cat.isActive !== false
    })
    setCompressionInfo(null)
    setEditingId(cat.id)
    setIsModalOpen(true)
  }

  const handleImageFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsUploading(true)
      const originalSize = file.size

      // 4:3 card aspect ratio center crop and WebP compression
      const compressedFile = await cropAndCompressImage(file, {
        aspectRatio: 4 / 3,
        maxWidth: 800,
        maxHeight: 600,
        quality: 0.85,
        format: 'image/webp'
      })

      const compressedSize = compressedFile.size
      setCompressionInfo({
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

      if (!res.ok) {
        throw new Error('Upload failed')
      }

      const data = await res.json()
      const uploadedUrl = data.imageUrl?.startsWith('http')
        ? data.imageUrl
        : `${API_URL}${data.imageUrl}`

      setForm((prev) => ({ ...prev, imageUrl: uploadedUrl }))
      if (addNotification) {
        addNotification('Image cropped to 4:3 & compressed successfully', 'success')
      }
    } catch (err) {
      console.error('Image compression upload error:', err)
      if (addNotification) {
        addNotification('Failed to process image: ' + err.message, 'error')
      }
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleToggleActive = (cat) => {
    const updatedStatus = !cat.isActive
    fetch(`${API_URL}/api/speciality-categories/${cat.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...cat, isActive: updatedStatus })
    })
      .then((res) => res.json())
      .then(() => {
        fetchData()
        if (addNotification) {
          addNotification(`Category "${cat.name}" ${updatedStatus ? 'activated' : 'hidden'}`, 'info')
        }
      })
      .catch(() => {
        if (addNotification) addNotification('Failed to update status', 'error')
      })
  }

  const handleDelete = (id) => {
    if (!window.confirm('Are you sure you want to delete this speciality category?')) return
    fetch(`${API_URL}/api/speciality-categories/${id}`, {
      method: 'DELETE'
    })
      .then((res) => res.json())
      .then(() => {
        fetchData()
        if (addNotification) addNotification('Category deleted successfully', 'success')
      })
      .catch(() => {
        if (addNotification) addNotification('Failed to delete category', 'error')
      })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.keyword.trim()) return

    const method = editingId ? 'PUT' : 'POST'
    const url = editingId
      ? `${API_URL}/api/speciality-categories/${editingId}`
      : `${API_URL}/api/speciality-categories`

    fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
      .then((res) => res.json())
      .then(() => {
        fetchData()
        setIsModalOpen(false)
        if (addNotification) {
          addNotification(`Category "${form.name}" saved successfully`, 'success')
        }
      })
      .catch(() => {
        if (addNotification) addNotification('Failed to save category', 'error')
      })
  }

  return (
    <div className="bg-white border border-stone-200/80 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-200/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-amber-600 font-bold text-sm">✨</span>
            <h3 className="text-sm font-bold text-stone-900 tracking-tight">Speciality Categories Management</h3>
          </div>
          <p className="text-[11px] text-stone-400 mt-0.5">
            Manage category cards displayed on the customer site. Icons removed in favor of cropped and compressed photo backgrounds.
          </p>
        </div>
        <button
          onClick={handleOpenNew}
          className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span>Add Category</span>
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-stone-400">Loading categories...</div>
      ) : categories.length === 0 ? (
        <div className="py-8 text-center text-sm text-stone-400">No categories found. Click "Add Category" to create one.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map((cat) => {
            const tourCount = getDynamicTourCount(cat.id)
            const catImg = cat.imageUrl || FALLBACK_CATEGORY_IMG
            return (
              <div
                key={cat.id}
                className={`relative rounded-2xl border overflow-hidden flex flex-col justify-between transition-all group shadow-sm hover:shadow-md ${
                  cat.isActive ? 'border-stone-200 bg-white' : 'border-stone-200 bg-stone-100/50 opacity-60'
                }`}
              >
                {/* 4:3 Card Photo Preview */}
                <div className="relative aspect-[4/3] w-full bg-stone-900 overflow-hidden">
                  <img
                    src={catImg}
                    alt={cat.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      e.currentTarget.onerror = null
                      e.currentTarget.src = FALLBACK_CATEGORY_IMG
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/30 to-transparent" />
                  
                  {/* Status badge top right */}
                  <div className="absolute top-2.5 right-2.5 z-10">
                    <button
                      onClick={() => handleToggleActive(cat)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-md cursor-pointer transition-colors ${
                        cat.isActive
                          ? 'bg-emerald-500/90 text-white shadow-xs'
                          : 'bg-stone-800/80 text-stone-300'
                      }`}
                    >
                      {cat.isActive ? 'Active' : 'Hidden'}
                    </button>
                  </div>

                  {/* Title overlay on bottom of photo */}
                  <div className="absolute bottom-2.5 left-3 right-3 z-10">
                    <h4 className="font-display font-bold text-sm text-white tracking-tight drop-shadow-sm">
                      {cat.name}
                    </h4>
                    <span className="text-[10px] font-semibold text-amber-300 tracking-wider uppercase">
                      {tourCount} {tourCount === 1 ? 'Tour' : 'Tours'}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 flex flex-col justify-between flex-1">
                  <div>
                    <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">{cat.subtitle}</p>
                    <div className="text-[11px] text-stone-400 mt-2 font-mono flex items-center justify-between">
                      <span>Keyword:</span>
                      <span className="text-stone-700 font-semibold bg-stone-100 px-1.5 py-0.5 rounded">
                        {cat.keyword}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1 pt-3 mt-2 border-t border-stone-100">
                    <button
                      onClick={() => handleEdit(cat)}
                      className="p-1.5 text-stone-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                      title="Edit Category"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id)}
                      className="p-1.5 text-stone-600 hover:text-red-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete Category"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] bg-stone-900/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl my-auto border border-stone-200">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100 mb-5">
              <div>
                <h3 className="font-bold text-base text-stone-900 tracking-tight">
                  {editingId ? 'Edit Speciality Category' : 'New Speciality Category'}
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">Images are automatically center-cropped to 4:3 and compressed to WebP.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100 cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Image Upload & Cropped Preview */}
              <div>
                <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-1.5">
                  Category Card Image (4:3 Ratio) <span className="text-amber-600">*</span>
                </label>

                {form.imageUrl ? (
                  <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden border border-stone-200 shadow-sm bg-stone-900 group">
                    <img
                      src={form.imageUrl}
                      alt="Category Preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-stone-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 bg-white/90 hover:bg-white text-stone-900 rounded-xl text-xs font-semibold shadow-md cursor-pointer"
                      >
                        Change Image
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, imageUrl: '' }))}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-md cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-stone-200 hover:border-amber-500/60 bg-[#FAF9F5] hover:bg-amber-50/20 rounded-2xl aspect-[4/3] flex flex-col items-center justify-center cursor-pointer transition-colors p-6 text-center"
                  >
                    <svg className="w-10 h-10 text-stone-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs font-semibold text-stone-700">Click to upload photo</span>
                    <span className="text-[10px] text-stone-400 mt-1">Auto-crops to 4:3 & compresses to WebP (&lt;120KB)</span>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageFileSelect}
                  className="hidden"
                />

                {isUploading && (
                  <div className="flex items-center gap-2 text-xs text-amber-600 mt-2 font-medium">
                    <span className="w-3.5 h-3.5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                    Cropping & compressing image...
                  </div>
                )}

                {compressionInfo && (
                  <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-800 flex items-center justify-between">
                    <span>Compressed: {compressionInfo.compressed} (was {compressionInfo.original})</span>
                    <span className="font-bold text-emerald-700">-{compressionInfo.savings}% saved</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Wildlife Safari"
                  className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-xs outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-1">
                  Subtitle
                </label>
                <input
                  type="text"
                  value={form.subtitle}
                  onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                  placeholder="e.g. Safari & nature expeditions"
                  className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-xs outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-1">
                  Search Keyword
                </label>
                <input
                  type="text"
                  value={form.keyword}
                  onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                  placeholder="e.g. Safari"
                  className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-xs outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="w-4 h-4 text-amber-600 rounded cursor-pointer accent-amber-600"
                />
                <label htmlFor="isActive" className="text-xs font-semibold text-stone-700 cursor-pointer">
                  Active (Visible on Website)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

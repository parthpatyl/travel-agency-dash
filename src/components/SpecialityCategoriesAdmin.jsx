import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const ICON_OPTIONS = [
  { label: 'Compass (Adventure)', value: 'Compass' },
  { label: 'Sparkles (Wellness)', value: 'Sparkles' },
  { label: 'Heart (Honeymoon)', value: 'Heart' },
  { label: 'Binoculars (Wildlife)', value: 'Binoculars' },
  { label: 'Utensils (Culinary)', value: 'Utensils' },
  { label: 'Ship (Cruises)', value: 'Ship' },
  { label: 'Camera (Photography)', value: 'Camera' },
  { label: 'Users (Group Tours)', value: 'Users' },
]

export default function SpecialityCategoriesAdmin({ addNotification }) {
  const [categories, setCategories] = useState([])
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState({
    name: '',
    subtitle: '',
    keyword: '',
    iconName: 'Compass',
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
      iconName: 'Compass',
      isActive: true
    })
    setEditingId(null)
    setIsModalOpen(true)
  }

  const handleEdit = (cat) => {
    setForm({
      name: cat.name || '',
      subtitle: cat.subtitle || '',
      keyword: cat.keyword || '',
      iconName: cat.iconName || 'Compass',
      isActive: cat.isActive !== false
    })
    setEditingId(cat.id)
    setIsModalOpen(true)
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
            Manage tour category cards displayed on customer site & navbar. Real-time matching tour counts are dynamically calculated from active packages.
          </p>
        </div>
        <button
          onClick={handleOpenNew}
          className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0"
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
            return (
              <div
                key={cat.id}
                className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                  cat.isActive ? 'bg-stone-50/70 border-stone-200' : 'bg-stone-100/50 border-stone-200 opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-stone-900 px-2 py-0.5 rounded-md bg-stone-200/60">
                      {cat.iconName || 'Compass'}
                    </span>
                    <button
                      onClick={() => handleToggleActive(cat)}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full cursor-pointer ${
                        cat.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'
                      }`}
                    >
                      {cat.isActive ? 'Active' : 'Hidden'}
                    </button>
                  </div>
                  <h4 className="font-bold text-sm text-stone-900">{cat.name}</h4>
                  <p className="text-xs text-stone-500 mt-1 line-clamp-2">{cat.subtitle}</p>
                  <div className="text-[11px] text-stone-400 mt-2 font-mono">
                    Keyword: <span className="text-stone-700 font-semibold">{cat.keyword}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 mt-3 border-t border-stone-200/60">
                  <span className="text-xs text-stone-600 font-semibold">
                    {tourCount} {tourCount === 1 ? 'Tour' : 'Tours'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(cat)}
                      className="p-1.5 text-stone-600 hover:text-amber-600 hover:bg-stone-200/50 rounded-lg transition-colors cursor-pointer"
                      title="Edit"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id)}
                      className="p-1.5 text-stone-600 hover:text-red-600 hover:bg-stone-200/50 rounded-lg transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
        <div className="fixed inset-0 z-[100] bg-stone-900/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 pt-20 sm:pt-24 pb-8 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl my-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-stone-900">
                {editingId ? 'Edit Category' : 'New Speciality Category'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-600 rounded-lg cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Adventure"
                  className="w-full px-3.5 py-2 border border-stone-200 rounded-xl text-sm outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Subtitle
                </label>
                <input
                  type="text"
                  value={form.subtitle}
                  onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                  placeholder="e.g. Thrilling treks & expeditions"
                  className="w-full px-3.5 py-2 border border-stone-200 rounded-xl text-sm outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Search Keyword
                </label>
                <input
                  type="text"
                  value={form.keyword}
                  onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                  placeholder="e.g. Adventure"
                  className="w-full px-3.5 py-2 border border-stone-200 rounded-xl text-sm outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Icon
                </label>
                <select
                  value={form.iconName}
                  onChange={(e) => setForm({ ...form, iconName: e.target.value })}
                  className="w-full px-3.5 py-2 border border-stone-200 rounded-xl text-sm outline-none focus:border-amber-500"
                >
                  {ICON_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="w-4 h-4 text-amber-600 rounded cursor-pointer"
                />
                <label htmlFor="isActive" className="text-xs font-medium text-stone-700 cursor-pointer">
                  Active (Visible on Website)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
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

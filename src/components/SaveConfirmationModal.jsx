import React, { useEffect } from 'react'

/**
 * SaveConfirmationModal
 * 
 * HTML confirmation modal displayed after settings modifications are saved.
 * Shows an executive summary of updated fields, while reinforcing that
 * all untouched fields remain preserved.
 */
export default function SaveConfirmationModal({ isOpen, onClose, sectionName, changes = [] }) {
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div
        className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-md w-full overflow-hidden transition-all transform scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with checkmark badge */}
        <div className="p-6 pb-4 flex items-start gap-4 border-b border-stone-100">
          <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0 text-emerald-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="confirm-modal-title" className="text-base font-bold text-stone-900 tracking-tight">
              Changes Saved Successfully
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Updates to <span className="font-semibold text-stone-800">{sectionName}</span> are now live.
            </p>
          </div>
        </div>

        {/* Changed Fields Summary */}
        <div className="p-6 py-4 space-y-3.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-stone-600 uppercase tracking-wider">
            <span>Modified Fields ({changes.length})</span>
            <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/50">Live</span>
          </div>

          <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
            {changes.map((item, idx) => (
              <div key={idx} className="p-2.5 bg-stone-50 border border-stone-200/80 rounded-xl text-xs space-y-1">
                <div className="font-semibold text-stone-800 flex items-center justify-between">
                  <span>{item.label}</span>
                </div>
                <div className="text-stone-700 truncate font-mono text-[11px] bg-white px-2 py-1 rounded border border-stone-200">
                  {typeof item.newVal === 'object' ? JSON.stringify(item.newVal) : String(item.newVal || '(empty)')}
                </div>
              </div>
            ))}
          </div>

          {/* Guarantee of untouched fields */}
          <div className="flex items-center gap-2 text-[11px] text-stone-500 bg-stone-50/70 p-2.5 rounded-xl border border-stone-100">
            <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>All other fields and website sections remain preserved as they were.</span>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-stone-50/80 border-t border-stone-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="w-full sm:w-auto px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            OK, Got it
          </button>
        </div>
      </div>
    </div>
  )
}

import { useId } from 'react'
import {
  generateConciergeEmailHtml,
  generateEmailSubject,
  generateEmailReplyUrl,
} from '../utils/commsPipeline'

const XIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const MailIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
)

export default function EmailPreviewModal({
  isOpen,
  onClose,
  enquiry,
  packages = []
}) {
  const titleId = useId()

  if (!isOpen || !enquiry) return null

  const htmlContent = generateConciergeEmailHtml(enquiry, packages)
  const subject = generateEmailSubject(enquiry)
  const mailtoUrl = generateEmailReplyUrl(enquiry, packages)

  return (
    <div
      className="fixed inset-0 bg-stone-950/70 backdrop-blur-sm z-[110] flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-2xl max-h-[92vh] flex flex-col my-auto overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-stone-200 flex items-center justify-between bg-stone-50/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
              <MailIcon className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 id={titleId} className="text-sm font-bold text-stone-900 leading-tight">
                Customer Email Preview
              </h3>
              <p className="text-[11px] text-stone-500 font-light mt-0.5">
                Exact email layout sent to recipient
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors cursor-pointer"
            aria-label="Close Email Preview"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Recipient & Subject Bar */}
        <div className="px-5 py-2.5 bg-[#FAF9F5] border-b border-stone-200 text-xs space-y-1 shrink-0">
          <div className="flex items-center gap-2 text-stone-600">
            <span className="font-bold text-stone-400 uppercase text-[10px] w-12 shrink-0">To:</span>
            <span className="font-semibold text-stone-900">{enquiry.name || 'Traveler'} &lt;{enquiry.email || 'N/A'}&gt;</span>
          </div>
          <div className="flex items-center gap-2 text-stone-600">
            <span className="font-bold text-stone-400 uppercase text-[10px] w-12 shrink-0">Subject:</span>
            <span className="text-stone-800 font-medium">{subject}</span>
          </div>
        </div>

        {/* Pure Email Preview Body */}
        <div className="flex-1 bg-stone-100 p-4 sm:p-5 overflow-y-auto flex justify-center items-start min-h-[440px]">
          <div className="w-full max-w-[580px] bg-white rounded-xl shadow border border-stone-300/70 overflow-hidden">
            <iframe
              title="Email Template Rendered Preview"
              srcDoc={htmlContent}
              className="w-full min-h-[560px] border-0"
              sandbox="allow-same-origin"
            />
          </div>
        </div>

        {/* Action Footer */}
        <div className="px-5 py-3 border-t border-stone-200 bg-white flex items-center justify-between shrink-0">
          <span className="text-[11px] text-stone-400">
            Rendered as received by customer
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 border border-stone-200 text-stone-600 hover:bg-stone-50 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            >
              Close
            </button>
            <a
              href={mailtoUrl}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 shadow-xs transition-colors cursor-pointer"
              title="Launch email client"
            >
              <MailIcon className="w-3.5 h-3.5" />
              <span>Send via Mail App</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

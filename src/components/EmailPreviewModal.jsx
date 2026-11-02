import { useId, useState } from 'react'
import {
  generateConciergeEmailHtml,
  generateEmailSubject,
  generateEmailReplyUrl,
  generateGmailWebComposeUrl,
  generateEmailPlainText,
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
  const [copied, setCopied] = useState(false)

  if (!isOpen || !enquiry) return null

  const htmlContent = generateConciergeEmailHtml(enquiry, packages)
  const subject = generateEmailSubject(enquiry)
  const mailtoUrl = generateEmailReplyUrl(enquiry, packages)
  const gmailUrl = generateGmailWebComposeUrl(enquiry, packages)
  const plainText = generateEmailPlainText(enquiry, packages)

  const handleCopyStyledEmail = async () => {
    try {
      if (typeof window !== 'undefined' && navigator?.clipboard && window.ClipboardItem) {
        const htmlBlob = new Blob([htmlContent], { type: 'text/html' })
        const textBlob = new Blob([plainText], { type: 'text/plain' })
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': htmlBlob,
            'text/plain': textBlob,
          })
        ])
        setCopied('styled')
        setTimeout(() => setCopied(null), 3000)
      } else {
        await navigator.clipboard.writeText(plainText)
        setCopied('plain')
        setTimeout(() => setCopied(null), 3000)
      }
    } catch {
      // Fallback
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(plainText)
      }
      setCopied('plain')
      setTimeout(() => setCopied(null), 3000)
    }
  }

  const handleCopyPlainText = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(plainText)
      }
      setCopied('plain')
      setTimeout(() => setCopied(null), 3000)
    } catch {
      setCopied(null)
    }
  }

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
            />
          </div>
        </div>

        {/* Action Footer */}
        <div className="px-5 py-3 border-t border-stone-200 bg-white flex flex-col gap-2 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-stone-500">
              {copied === 'styled' ? (
                <span className="text-emerald-700 font-bold">✓ Formatted email card copied! Paste (Ctrl+V) into Gmail to keep full styling & button.</span>
              ) : copied === 'plain' ? (
                <span className="text-emerald-700 font-bold">✓ Plain text copied to clipboard.</span>
              ) : (
                <span>To keep styling: Click <strong>Copy Styled Email</strong> and paste (<kbd className="font-mono px-1 py-0.5 bg-stone-100 border border-stone-300 rounded text-[10px]">Ctrl+V</kbd>) into Gmail.</span>
              )}
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopyStyledEmail}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  copied === 'styled'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-bold'
                    : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 border-amber-500/30'
                }`}
                title="Copy rich HTML card with dark header, table, and gold button to clipboard"
              >
                {copied === 'styled' ? '✓ Copied Styled Card' : 'Copy Styled Email'}
              </button>

              <button
                type="button"
                onClick={handleCopyPlainText}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-stone-200 text-stone-600 hover:bg-stone-50 transition-all cursor-pointer"
                title="Copy plain text fallback"
              >
                Copy Text
              </button>

              <a
                href={gmailUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 border border-stone-200 shadow-2xs transition-colors cursor-pointer"
                title="Open draft directly in Gmail Web"
              >
                <svg className="w-3.5 h-3.5 text-red-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.263H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L12 9.545l8.073-6.052C21.69 2.28 24 3.434 24 5.457z"/>
                </svg>
                <span>Gmail Web</span>
              </a>

              <a
                href={mailtoUrl}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 shadow-xs transition-colors cursor-pointer"
                title="Launch desktop email client (Outlook / Apple Mail)"
              >
                <MailIcon className="w-3.5 h-3.5" />
                <span>Send via Mail App</span>
              </a>

              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 border border-stone-200 text-stone-600 hover:bg-stone-50 rounded-lg text-xs font-semibold transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

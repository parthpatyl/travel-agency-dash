import { useState, useId } from 'react'
import {
  generateConciergeEmailHtml,
  generateEmailSubject,
  generateEmailReplyUrl,
  getPackageUrl,
  formatDateDisplay,
} from '../utils/commsPipeline'

const CopyIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
)

const CheckIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
)

const ExternalLinkIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
)

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
  addNotification
}) {
  const [viewMode, setViewMode] = useState('rendered') // 'rendered' | 'html' | 'text'
  const [deviceView, setDeviceView] = useState('desktop') // 'desktop' (620px) | 'mobile' (380px)
  const [copiedType, setCopiedType] = useState(null)
  const titleId = useId()

  if (!isOpen || !enquiry) return null

  const htmlContent = generateConciergeEmailHtml(enquiry)
  const subject = generateEmailSubject(enquiry)
  const mailtoUrl = generateEmailReplyUrl(enquiry)
  const packageUrl = getPackageUrl(enquiry)
  const plainText = `Subject: ${subject}
To: ${enquiry.name || 'Traveler'} <${enquiry.email || 'N/A'}>

Dear ${enquiry.name || 'Distinguished Traveler'},

Thank you for reaching out to Kraft Your Trip regarding your upcoming journey to ${enquiry.destination || 'Luxury Tour'} (${enquiry.guests || 1} traveler(s)).

Our concierge specialists are reviewing your request for travel around ${formatDateDisplay(enquiry.travelDate)} and curating a bespoke itinerary.

Inquiry Overview:
- Destination: ${enquiry.destination || 'Luxury Tour'}
- Travel Window: ${formatDateDisplay(enquiry.travelDate)}
- Party Size: ${enquiry.guests || 1} traveler(s)
- Package Itinerary: ${packageUrl}
${enquiry.notes ? `- Special Requests: ${enquiry.notes}\n` : ''}
Could you please confirm if your dates are flexible, and if you have any preferred airline class or suite category?

Warm regards,
Kraft Your Trip Concierge Desk
+91 7046704693 | contact@kraftyourtrip.com
https://kraftyourtrip.com`

  const handleCopy = async (type, text) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      }
      setCopiedType(type)
      setTimeout(() => setCopiedType(null), 2000)
      if (addNotification) {
        addNotification(
          type === 'html' ? 'Styled HTML email copied to clipboard!' : 'Plain text message copied!',
          'success'
        )
      }
    } catch {
      // fallback
    }
  }

  return (
    <div
      className="fixed inset-0 bg-stone-950/70 backdrop-blur-sm z-[110] flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-4xl max-h-[92vh] flex flex-col my-auto overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
              <MailIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 id={titleId} className="text-sm sm:text-base font-bold text-stone-900 leading-tight">
                Concierge Email Preview
              </h3>
              <p className="text-[11px] text-stone-500 font-light mt-0.5">
                Luxury HTML email template with package link & inquiry highlights
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors cursor-pointer"
              aria-label="Close Email Preview"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Email Meta Bar */}
        <div className="px-5 py-3 bg-[#FAF9F5] border-b border-stone-200 text-xs space-y-1.5 shrink-0">
          <div className="flex items-center gap-2 text-stone-600">
            <span className="font-bold text-stone-400 uppercase text-[10px] w-14 shrink-0">From:</span>
            <span className="font-medium text-stone-900">Kraft Concierge &lt;contact@kraftyourtrip.com&gt;</span>
          </div>
          <div className="flex items-center gap-2 text-stone-600">
            <span className="font-bold text-stone-400 uppercase text-[10px] w-14 shrink-0">To:</span>
            <span className="font-medium text-stone-900">{enquiry.name || 'Traveler'} &lt;{enquiry.email || 'N/A'}&gt;</span>
          </div>
          <div className="flex items-center gap-2 text-stone-600">
            <span className="font-bold text-stone-400 uppercase text-[10px] w-14 shrink-0">Subject:</span>
            <span className="font-semibold text-stone-900">{subject}</span>
          </div>
          <div className="flex items-center gap-2 text-stone-600">
            <span className="font-bold text-stone-400 uppercase text-[10px] w-14 shrink-0">Package:</span>
            <a
              href={packageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-amber-700 hover:text-amber-800 underline inline-flex items-center gap-1"
            >
              <span>{packageUrl}</span>
              <ExternalLinkIcon className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Controls Toolbar */}
        <div className="px-5 py-2.5 border-b border-stone-200 bg-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Mode Switcher */}
          <div className="inline-flex rounded-lg bg-stone-100 p-0.5 border border-stone-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('rendered')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                viewMode === 'rendered' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Rendered HTML
            </button>
            <button
              type="button"
              onClick={() => setViewMode('html')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                viewMode === 'html' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              HTML Code
            </button>
            <button
              type="button"
              onClick={() => setViewMode('text')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                viewMode === 'text' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Plain Text
            </button>
          </div>

          {/* Device & Action Buttons */}
          <div className="flex items-center gap-2">
            {viewMode === 'rendered' && (
              <div className="inline-flex rounded-lg bg-stone-100 p-0.5 border border-stone-200 text-xs font-semibold mr-1">
                <button
                  type="button"
                  onClick={() => setDeviceView('desktop')}
                  className={`px-2.5 py-1 rounded-md text-[11px] transition-all cursor-pointer ${
                    deviceView === 'desktop' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-800'
                  }`}
                  title="Desktop View (620px)"
                >
                  Desktop
                </button>
                <button
                  type="button"
                  onClick={() => setDeviceView('mobile')}
                  className={`px-2.5 py-1 rounded-md text-[11px] transition-all cursor-pointer ${
                    deviceView === 'mobile' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-800'
                  }`}
                  title="Mobile View (380px)"
                >
                  Mobile
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => handleCopy('html', htmlContent)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 shadow-xs transition-colors cursor-pointer"
            >
              {copiedType === 'html' ? <CheckIcon className="w-3.5 h-3.5 text-emerald-600" /> : <CopyIcon className="w-3.5 h-3.5 text-stone-400" />}
              <span>{copiedType === 'html' ? 'HTML Copied!' : 'Copy HTML'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleCopy('text', plainText)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 shadow-xs transition-colors cursor-pointer"
            >
              {copiedType === 'text' ? <CheckIcon className="w-3.5 h-3.5 text-emerald-600" /> : <CopyIcon className="w-3.5 h-3.5 text-stone-400" />}
              <span>{copiedType === 'text' ? 'Text Copied!' : 'Copy Text'}</span>
            </button>

            <a
              href={mailtoUrl}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 shadow-xs transition-colors cursor-pointer"
              title="Launch native email client with pre-populated message"
            >
              <MailIcon className="w-3.5 h-3.5" />
              <span>Open in Mail App</span>
            </a>
          </div>
        </div>

        {/* Viewport Content Area */}
        <div className="flex-1 bg-stone-100 p-4 sm:p-6 overflow-y-auto flex justify-center items-start min-h-[380px]">
          {viewMode === 'rendered' && (
            <div
              className={`bg-white rounded-xl shadow-lg border border-stone-300/80 transition-all duration-200 overflow-hidden ${
                deviceView === 'desktop' ? 'w-full max-w-[620px]' : 'w-full max-w-[380px]'
              }`}
            >
              <iframe
                title="Email Template Rendered Preview"
                srcDoc={htmlContent}
                className="w-full min-h-[640px] border-0"
                sandbox="allow-same-origin"
              />
            </div>
          )}

          {viewMode === 'html' && (
            <div className="w-full bg-stone-900 text-stone-100 p-4 rounded-xl font-mono text-xs overflow-x-auto shadow-inner border border-stone-800">
              <pre className="whitespace-pre-wrap break-all leading-relaxed">{htmlContent}</pre>
            </div>
          )}

          {viewMode === 'text' && (
            <div className="w-full max-w-2xl bg-white p-6 rounded-xl font-mono text-xs text-stone-800 border border-stone-200 shadow-sm overflow-x-auto">
              <pre className="whitespace-pre-wrap leading-relaxed">{plainText}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

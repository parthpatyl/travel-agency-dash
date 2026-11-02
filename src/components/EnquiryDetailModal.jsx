import { useState, useEffect } from 'react'
import {
  formatDateDisplay,
  generateWhatsAppMessage,
  generateWhatsAppUrl,
  generateEmailReplyUrl
} from '../utils/commsPipeline'

const WhatsAppIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2zm.01 18.25c-1.5 0-2.97-.4-4.25-1.16l-.3-.18-3.15.83.84-3.07-.2-.32a8.204 8.204 0 01-1.25-4.44c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.82 2.42a8.182 8.182 0 012.41 5.83c.01 4.54-3.69 8.23-8.22 8.23zm4.52-6.17c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.79.97-.14.17-.29.19-.54.07-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43s-.56-1.34-.76-1.84c-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.44.06-.66.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.12.17 1.77 2.71 4.3 3.79.6.26 1.07.41 1.44.53.61.19 1.16.17 1.6.1.49-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.11-.23-.17-.48-.29z" />
  </svg>
)

const CopyIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
)

const MailIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
)

const PhoneIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
)

const CalendarIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)

const UsersIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
)

const MapPinIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const XIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const LoaderIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M21 3v5h-5.182" />
  </svg>
)

const ArrowRightIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
  </svg>
)

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export default function EnquiryDetailModal({ 
  enquiryId, 
  isOpen, 
  onClose, 
  token,
  addNotification,
  setBookingDraft,
  setActiveTab
}) {
  const [enquiry, setEnquiry] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  const handleCopyWhatsApp = async () => {
    if (!enquiry) return
    const msg = generateWhatsAppMessage(enquiry)
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(msg)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      if (addNotification) {
        addNotification('WhatsApp concierge message copied to clipboard', 'info')
      }
    } catch {
      // clipboard fallback
    }
  }

  useEffect(() => {
    if (!isOpen || !enquiryId) return

    const fetchEnquiryDetails = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${API_URL}/api/enquiries/${enquiryId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.message || 'Failed to load enquiry details')
        }
        setEnquiry(data.data)
      } catch (err) {
        console.error('Error fetching enquiry details:', err)
        setError(err.message)
        if (addNotification) {
          addNotification(`Failed to load enquiry: ${err.message}`, 'error')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchEnquiryDetails()
  }, [enquiryId, isOpen, token]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleConvertToBooking = () => {
    if (!enquiry) return
    
    // Set booking draft
    setBookingDraft({
      client: enquiry.name,
      clientEmail: enquiry.email,
      package: enquiry.destination,
      guests: enquiry.guests,
      date: enquiry.travelDate,
      notes: enquiry.notes
    })

    // Navigate to bookings tab
    setActiveTab('bookings')
    
    if (addNotification) {
      addNotification(`Enquiry details converted to booking draft for ${enquiry.name}`, 'success')
    }
    
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 pt-20 sm:pt-24 pb-8 bg-stone-900/60 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-2xl bg-white border border-stone-200/90 rounded-2xl shadow-2xl max-h-[85vh] flex flex-col my-auto overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-stone-100">
          <div>
            <span className="text-[10px] font-mono text-stone-400 font-bold uppercase tracking-wider">
              Enquiry Details
            </span>
            <h3 className="text-base font-bold text-stone-950">
              {enquiryId}
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-stone-500">
              <LoaderIcon className="w-8 h-8 text-amber-600 animate-spin mb-3" />
              <p className="text-xs font-light">Retrieving enquiry details...</p>
            </div>
          ) : error || !enquiry ? (
            <div className="py-8 text-center">
              <p className="text-sm text-stone-500 mb-4">{error || 'Enquiry not found'}</p>
              <button 
                onClick={onClose}
                className="px-4 py-2 bg-stone-900 text-white rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Client Profile Section */}
              <div className="bg-stone-50 border border-stone-200/65 rounded-xl p-4 space-y-3">
                <h4 className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                  Contact Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <span className="text-[9px] text-stone-400 font-semibold uppercase tracking-[0.05em] block">Full Name</span>
                    <span className="text-sm font-semibold text-stone-900">{enquiry.name}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-stone-400 font-semibold uppercase tracking-[0.05em] block">Email</span>
                    <a href={`mailto:${enquiry.email}`} className="text-xs font-semibold text-amber-700 hover:text-amber-600 flex items-center gap-1 mt-0.5">
                      <MailIcon className="w-3.5 h-3.5" />
                      {enquiry.email}
                    </a>
                  </div>
                  <div>
                    <span className="text-[9px] text-stone-400 font-semibold uppercase tracking-[0.05em] block">Phone</span>
                    <a href={`tel:${enquiry.phone}`} className="text-xs font-semibold text-amber-700 hover:text-amber-600 flex items-center gap-1 mt-0.5">
                      <PhoneIcon className="w-3.5 h-3.5" />
                      {enquiry.phone}
                    </a>
                  </div>
                </div>
              </div>

              {/* Omnichannel Concierge Fast-Track Action Bar */}
              <div className="bg-amber-50/50 border border-amber-200/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <h5 className="text-xs font-bold text-stone-900">Omnichannel Concierge Fast-Track</h5>
                  </div>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    1-click customer engagement with pre-filled luxury itinerary greeting
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {enquiry.phone && (
                    <a
                      href={generateWhatsAppUrl(enquiry)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition-all cursor-pointer"
                    >
                      <WhatsAppIcon className="w-3.5 h-3.5 fill-current" />
                      <span>WhatsApp Concierge</span>
                    </a>
                  )}
                  {enquiry.email && (
                    <a
                      href={generateEmailReplyUrl(enquiry)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 shadow-xs transition-colors cursor-pointer"
                    >
                      <MailIcon className="w-3.5 h-3.5 text-stone-500" />
                      <span>Email Reply</span>
                    </a>
                  )}
                  {enquiry.phone && (
                    <button
                      type="button"
                      onClick={handleCopyWhatsApp}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-stone-600 bg-white hover:bg-stone-50 border border-stone-200 transition-colors cursor-pointer inline-flex items-center gap-1"
                      title="Copy WhatsApp greeting to clipboard"
                    >
                      <CopyIcon className="w-3.5 h-3.5 text-stone-400" />
                      <span>{copied ? 'Copied!' : 'Copy Msg'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Trip Preferences Section */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                  Travel Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex items-center gap-2.5 p-3 border border-stone-100 rounded-xl">
                    <MapPinIcon className="w-4 h-4 text-stone-400" />
                    <div>
                      <span className="text-[9px] text-stone-400 font-medium block">Destination</span>
                      <span className="text-xs font-bold text-stone-800">{enquiry.destination}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 p-3 border border-stone-100 rounded-xl">
                    <CalendarIcon className="w-4 h-4 text-stone-400" />
                    <div>
                      <span className="text-[9px] text-stone-400 font-medium block">Travel Date</span>
                      <span className="text-xs font-bold text-stone-800">
                        {formatDateDisplay(enquiry.travelDate)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 p-3 border border-stone-100 rounded-xl">
                    <UsersIcon className="w-4 h-4 text-stone-400" />
                    <div>
                      <span className="text-[9px] text-stone-400 font-medium block">Group Size</span>
                      <span className="text-xs font-bold text-stone-800">{enquiry.guests} {enquiry.guests > 1 ? 'Travellers' : 'Traveller'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Preferences */}
              {enquiry.preferences && Object.keys(enquiry.preferences).length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                    Bespoke Preferences
                  </h4>
                  <div className="border border-stone-100 rounded-xl p-4 divide-y divide-stone-50 text-xs">
                    {enquiry.preferences.accommodations && (
                      <div className="flex justify-between py-2">
                        <span className="text-stone-500">Accommodation Class</span>
                        <span className="font-semibold text-stone-800 capitalize">{enquiry.preferences.accommodations}</span>
                      </div>
                    )}
                    {enquiry.preferences.dietary && (
                      <div className="flex justify-between py-2">
                        <span className="text-stone-500">Dietary Profile</span>
                        <span className="font-semibold text-stone-800">{enquiry.preferences.dietary}</span>
                      </div>
                    )}
                    {enquiry.preferences.activities && enquiry.preferences.activities.length > 0 && (
                      <div className="py-2">
                        <span className="text-stone-500 block mb-1.5">Desired Activities</span>
                        <div className="flex flex-wrap gap-1">
                          {enquiry.preferences.activities.map((act, i) => (
                            <span key={i} className="px-2 py-0.5 bg-stone-50 border border-stone-150 text-stone-600 rounded-full text-[10px] capitalize font-medium">
                              {act}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              {enquiry.notes && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                    Customer Requirements
                  </h4>
                  <div className="p-4 bg-amber-500/5 border border-amber-500/10 text-stone-700 text-xs leading-relaxed rounded-xl whitespace-pre-line">
                    {enquiry.notes}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && enquiry && (
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-stone-100 bg-stone-50/50">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-stone-200 text-stone-600 hover:bg-stone-50 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={handleConvertToBooking}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
            >
              Convert to Booking
              <ArrowRightIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

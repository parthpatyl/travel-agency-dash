import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import Markdown from 'react-markdown'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const DEFAULT_IMAGE = `${API_URL}/assets/unsplash-pkg-card.jpg`

const imgUrl = (url) => {
  if (!url) return DEFAULT_IMAGE
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `${API_URL}${url}`
}

const formatINR = (price) =>
  price != null ? `₹${Number(price).toLocaleString('en-IN')}` : ''

const PrinterIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
  </svg>
)
const XIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
)
const CheckCircleIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)
const ShipIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9 1.2 5.6 3.1 7.5M12 10V4m0 0L9 7m3-3l3 3" />
  </svg>
)
const PhoneIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
)
const MailIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
)
const MapPinIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)
const HotelIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
)
const CompassIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.243 7.757l-2.121 6.364-6.364 2.121 2.121-6.364 6.364-2.121z" />
  </svg>
)
const UserIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
)
const CarIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 17a2 2 0 100-4 2 2 0 000 4zm8 0a2 2 0 100-4 2 2 0 000 4z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l2-4h14l2 4M3 9h18v7a1 1 0 01-1 1H4a1 1 0 01-1-1V9z" />
  </svg>
)
const PlaneIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
)

export default function PackageBrochureModal({ pkg, isOpen, onClose, settings = {} }) {
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    const beforePrint = () => {
      document.body.classList.add('is-printing')
    }
    const afterPrint = () => {
      document.body.classList.remove('is-printing')
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('beforeprint', beforePrint)
    window.addEventListener('afterprint', afterPrint)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('beforeprint', beforePrint)
      window.removeEventListener('afterprint', afterPrint)
      document.body.classList.remove('is-printing')
    }
  }, [isOpen, onClose])

  if (!isOpen || !pkg) return null

  const handlePrint = () => {
    document.body.classList.add('is-printing')
    window.print()
    setTimeout(() => {
      document.body.classList.remove('is-printing')
    }, 1000)
  }

  const agencyName = settings.agencyName || 'KRAFT YOUR TRIP'
  const agencyPhone = settings.agencyPhone || '+1 (555) 019-2831'
  const agencyEmail = settings.agencyEmail || 'concierge@kraftyourtrip.com'
  const agencyAddress = settings.agencyAddress || '456 Sandstone Ave, Suite 100, San Francisco, CA'

  // Standardize package attributes across variants
  const pkgName = pkg.name || pkg.destination || 'Tour Package'
  const pkgDuration = pkg.duration || (pkg.nights ? `${pkg.nights} Nights` : '')
  const pkgRegion = pkg.region || pkg.category || 'International'
  const pkgPrice = pkg.price ?? pkg.basePrice ?? pkg.startingPrice
  const isBespoke = pkg.isBespoke || false
  const inclusionsSelection = pkg.inclusionsSelection || pkg.inclusions || {}

  const modalContent = (
    <div className="print-portal-root">
      <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/80 backdrop-blur-sm flex justify-center p-2 sm:p-4 md:p-6">
        <div className="relative bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
          {/* Action Header bar (Hidden when printing) */}
          <div className="no-print bg-stone-900 text-white px-6 py-4 flex items-center justify-between border-b border-stone-800 shrink-0">
            <div className="flex items-center gap-3">
              <span className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
                <PrinterIcon className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-display text-base font-semibold text-white">Client Package Brochure</h3>
                <p className="text-xs text-stone-400 font-light">Generate printable brochure / Save as PDF for client</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-full text-xs font-semibold shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <PrinterIcon className="w-4 h-4" />
                <span>Download PDF / Print</span>
              </button>
              <button
                onClick={onClose}
                className="p-2 text-stone-400 hover:text-white rounded-full hover:bg-stone-800 transition-colors"
                title="Close Preview"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Printable Content Area */}
          <div className="print-area overflow-y-auto px-5 py-4 sm:px-7 sm:py-5 space-y-4 text-stone-800 bg-white" id="admin-package-printable-area">
            {/* Print Header / Agency Branding */}
            <div className="border-b-2 border-amber-600/30 pb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h1 className="font-display text-lg sm:text-xl text-stone-900 tracking-wider font-extrabold uppercase">
                  {agencyName}
                </h1>
                <p className="text-xs text-amber-700 font-semibold tracking-[0.2em] uppercase mt-0.5">
                  Bespoke & Luxury Travel Experiences
                </p>
              </div>
              <div className="text-xs text-stone-600 space-y-1 sm:text-right font-light">
                <div className="flex items-center gap-1.5 sm:justify-end">
                  <PhoneIcon className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>{agencyPhone}</span>
                </div>
                <div className="flex items-center gap-1.5 sm:justify-end">
                  <MailIcon className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>{agencyEmail}</span>
                </div>
                <div className="flex items-center gap-1.5 sm:justify-end">
                  <MapPinIcon className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>{agencyAddress}</span>
                </div>
              </div>
            </div>

            {/* Package Title Banner */}
            <div className="relative rounded-2xl overflow-hidden border border-stone-200 shadow-sm bg-stone-900 text-white min-h-[100px] flex flex-col justify-end p-4">
              <img
                src={imgUrl(pkg.heroImage || pkg.imageUrl || pkg.cardImage)}
                onError={(e) => { e.target.src = DEFAULT_IMAGE }}
                alt={pkgName}
                className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-overlay"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-900/60 to-transparent" />
              
              <div className="relative z-10 space-y-2">
                <div className="flex flex-wrap gap-2 items-center">
                  {pkgRegion && (
                    <span className="px-2.5 py-0.5 bg-amber-500 text-stone-950 text-[10px] font-extrabold uppercase tracking-widest rounded-full">
                      {pkgRegion}
                    </span>
                  )}
                  {pkgDuration && (
                    <span className="px-2.5 py-0.5 bg-white/90 text-stone-900 text-[10px] font-extrabold uppercase tracking-widest rounded-full">
                      {pkgDuration}
                    </span>
                  )}
                  {isBespoke && (
                    <span className="px-2.5 py-0.5 bg-stone-800 text-amber-300 border border-amber-400/30 text-[10px] font-extrabold uppercase tracking-widest rounded-full">
                      Bespoke Custom
                    </span>
                  )}
                  {pkg.bestMonth && (
                    <span className="px-2.5 py-0.5 bg-sky-500/90 text-white text-[10px] font-extrabold uppercase tracking-widest rounded-full">
                      Best in {pkg.bestMonth}
                    </span>
                  )}
                </div>
                <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white">
                  {pkgName}
                </h2>
              </div>
            </div>

            {/* Key Facts & Pricing Info */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3 bg-stone-50 border border-stone-200 rounded-xl print-break-inside-avoid min-w-0">
              <div className="sm:col-span-4 space-y-1 min-w-0">
                <span className="text-[10px] uppercase font-bold tracking-widest text-stone-400 block">Pricing Details</span>
                {isBespoke ? (
                  <span className="font-display text-lg font-bold text-amber-800">Custom Quote</span>
                ) : pkgPrice ? (
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="font-display text-xl font-bold text-stone-900">{formatINR(pkgPrice)}</span>
                    <span className="text-xs text-stone-500 font-medium">INR / person</span>
                  </div>
                ) : (
                  <span className="font-display text-base font-bold text-stone-700">Contact for Pricing</span>
                )}
              </div>

              <div className="sm:col-span-3 space-y-1 min-w-0">
                <span className="text-[10px] uppercase font-bold tracking-widest text-stone-400 block">Duration & Region</span>
                <p className="text-sm font-semibold text-stone-800">{pkgDuration || 'N/A'} · {pkgRegion}</p>
              </div>

              <div className="sm:col-span-5 space-y-1 min-w-0">
                <span className="text-[10px] uppercase font-bold tracking-widest text-stone-400 block">Included Amenities</span>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-stone-700 pt-0.5 min-w-0 overflow-hidden">
                  {(inclusionsSelection.hotel || inclusionsSelection.hotels) && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium shrink-0" title="Hotel">
                      <HotelIcon className="w-3.5 h-3.5 text-amber-700 shrink-0" /> Hotel
                    </span>
                  )}
                  {(inclusionsSelection.sightseeing || inclusionsSelection.tours) && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium shrink-0" title="Sightseeing">
                      <CompassIcon className="w-3.5 h-3.5 text-amber-700 shrink-0" /> Tours
                    </span>
                  )}
                  {inclusionsSelection.guide && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium shrink-0" title="Guide">
                      <UserIcon className="w-3.5 h-3.5 text-amber-700 shrink-0" /> Guide
                    </span>
                  )}
                  {(inclusionsSelection.airportTransfer || inclusionsSelection.transfers) && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium shrink-0" title="Transfers">
                      <CarIcon className="w-3.5 h-3.5 text-amber-700 shrink-0" /> Transfer
                    </span>
                  )}
                  {inclusionsSelection.flight && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium shrink-0" title="Flight">
                      <PlaneIcon className="w-3.5 h-3.5 text-amber-700 shrink-0" /> Flight
                    </span>
                  )}
                  {inclusionsSelection.cruise && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium shrink-0" title="Cruise">
                      <ShipIcon className="w-3.5 h-3.5 text-amber-700 shrink-0" /> Cruise
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Overview */}
            {pkg.description && (
              <div className="space-y-2 print-break-inside-avoid">
                <h3 className="font-display text-base font-bold text-stone-900 border-b border-stone-200 pb-1">
                  Trip Overview
                </h3>
                <p className="text-sm text-stone-600 leading-relaxed font-light whitespace-pre-line">
                  {pkg.description}
                </p>
              </div>
            )}

            {/* Terms & Conditions */}
            {(pkg.termsAndConditions || pkg.terms_and_conditions) && (
              <div className="space-y-2 print-break-inside-avoid">
                <h3 className="font-display text-base font-bold text-stone-900 border-b border-stone-200 pb-1">
                  Terms & Conditions
                </h3>
                <div className="text-xs text-stone-600 leading-relaxed font-light bg-stone-50 p-3 rounded-xl border border-stone-200">
                  <Markdown>{pkg.termsAndConditions || pkg.terms_and_conditions}</Markdown>
                </div>
              </div>
            )}

            {/* Highlights */}
            {pkg.highlights && pkg.highlights.length > 0 && (
              <div className="space-y-3 print-break-inside-avoid">
                <h3 className="font-display text-base font-bold text-stone-900 border-b border-stone-200 pb-1">
                  Trip Highlights
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {pkg.highlights.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-stone-700">
                      <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
                        ✓
                      </span>
                      <span className="leading-snug">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Day-by-Day Itinerary */}
            {pkg.itinerary && pkg.itinerary.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-display text-base font-bold text-stone-900 border-b border-stone-200 pb-1">
                  Day-by-Day Itinerary
                </h3>
                <div className="space-y-2">
                  {pkg.itinerary.map((dayItem, idx) => (
                    <div key={idx} className="p-2.5 bg-stone-50 border border-stone-200/80 rounded-xl space-y-1 print-break-inside-avoid">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-amber-600 text-white font-bold text-[10px] uppercase tracking-wider rounded">
                          Day {dayItem.day}
                        </span>
                        <h4 className="font-display text-sm font-bold text-stone-900">
                          {dayItem.title}
                        </h4>
                      </div>
                      <p className="text-xs text-stone-600 leading-relaxed font-light whitespace-pre-line pl-1">
                        {dayItem.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inclusions & Exclusions */}
            {((pkg.inclusions && pkg.inclusions.length > 0) || (pkg.exclusions && pkg.exclusions.length > 0)) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print-break-inside-avoid">
                {Array.isArray(pkg.inclusions) && pkg.inclusions.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider border-b border-stone-200 pb-1.5 flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full" /> What's Included
                    </h4>
                    <ul className="space-y-1.5">
                      {pkg.inclusions.map((inc, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-stone-700">
                          <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{inc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {Array.isArray(pkg.exclusions) && pkg.exclusions.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider border-b border-stone-200 pb-1.5 flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-rose-500 rounded-full" /> What's Excluded
                    </h4>
                    <ul className="space-y-1.5">
                      {pkg.exclusions.map((exc, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-stone-700">
                          <span className="w-3.5 h-3.5 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">✕</span>
                          <span>{exc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Footer Contact & Booking Note */}
            <div className="pt-3 border-t-2 border-stone-200 text-center space-y-2 print-break-inside-avoid">
              <p className="text-xs font-semibold text-stone-800">
                Prepared by {agencyName}
              </p>
              <div className="flex flex-wrap justify-center gap-4 text-xs text-stone-600 font-light">
                <span>📞 {agencyPhone}</span>
                <span>✉️ {agencyEmail}</span>
                <span>📍 {agencyAddress}</span>
              </div>
              <p className="text-[10px] text-stone-400 italic pt-2">
                Generated on {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })} · Prices and availability subject to final confirmation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

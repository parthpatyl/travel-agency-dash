/**
 * Omnichannel Communications Pipeline Utilities
 * Provides sanitized phone formatting, WhatsApp deep links, and pre-composed email replies
 * adhering to omnichannel-comms-builder safety and consent rules.
 */

export const formatDateDisplay = (dateStr) => {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

/**
 * Sanitizes phone numbers into E.164 digits for WhatsApp links.
 * Defaults 10-digit national numbers to India prefix (91).
 */
export function getCleanPhoneForWhatsApp(phone) {
  if (!phone) return ''
  let clean = phone.replace(/[^0-9]/g, '')
  if (clean.length === 10) {
    clean = '91' + clean
  }
  return clean
}

/**
 * Pre-populates a bespoke concierge greeting message for WhatsApp.
 */
export function generateWhatsAppMessage(enquiry) {
  if (!enquiry) return ''
  const name = enquiry.name || 'there'
  const dest = enquiry.destination || 'your upcoming trip'
  const guests = enquiry.guests ? `${enquiry.guests} traveler(s)` : 'your party'
  const dateStr = formatDateDisplay(enquiry.travelDate)
  return `Hello ${name}! This is the Kraft Your Trip concierge desk regarding your inquiry for ${dest} (${guests}, planned around ${dateStr}). We are curating your tailored luxury itinerary and would love to assist you with any custom preferences.`
}

/**
 * Returns full https://wa.me/... link with encoded greeting.
 */
export function generateWhatsAppUrl(enquiry) {
  if (!enquiry || !enquiry.phone) return ''
  const cleanPhone = getCleanPhoneForWhatsApp(enquiry.phone)
  if (!cleanPhone) return ''
  const text = generateWhatsAppMessage(enquiry)
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
}

/**
 * Pre-populates an email mailto: URL with subject and structured travel overview.
 */
export function generateEmailReplyUrl(enquiry) {
  if (!enquiry || !enquiry.email) return ''
  const name = enquiry.name || 'Traveler'
  const dest = enquiry.destination || 'Luxury Tour'
  const guests = enquiry.guests ? `${enquiry.guests} traveler(s)` : 'your party'
  const dateStr = formatDateDisplay(enquiry.travelDate)
  const subject = `Kraft Your Trip Concierge — Inquiry for ${dest}`
  const body = `Dear ${name},

Thank you for reaching out to Kraft Your Trip regarding your upcoming journey to ${dest} (${guests}).

Our concierge specialists are reviewing your request for travel around ${dateStr} and curating a bespoke itinerary.

Inquiry Overview:
- Destination: ${dest}
- Travel Window: ${dateStr}
- Party Size: ${guests}
${enquiry.notes ? `- Special Requests: ${enquiry.notes}\n` : ''}
Could you please confirm if your dates are flexible, and if you have any preferred airline class or suite category?

Warm regards,
Kraft Your Trip Concierge Desk
+91 7046704693 | contact@kraftyourtrip.com
https://kraftyourtrip.com`

  return `mailto:${enquiry.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

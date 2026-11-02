/**
 * Omnichannel Communications Pipeline Utilities
 * Provides sanitized phone formatting, universal WhatsApp links,
 * strict package ID link resolution, and luxury HTML email templates.
 */

export const formatDateDisplay = (dateStr) => {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

/**
 * Returns the customer site base URL dynamically (localhost:5173 in dev, production URL in prod).
 */
export function getCustomerSiteBaseUrl() {
  if (typeof window !== 'undefined' && window.location) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:5173'
    }
  }
  return (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CUSTOMER_SITE_URL) || 'https://kraftyourtrip.com'
}

/**
 * Sanitizes phone numbers into strict E.164 digits for WhatsApp links.
 * Strips non-digits, strips leading zeros, and prefixes standard 10-digit Indian numbers with '91'.
 */
export function getCleanPhoneForWhatsApp(phone) {
  if (!phone) return ''
  let clean = String(phone).replace(/[^0-9]/g, '')
  if (!clean) return ''

  // Strip leading 0s (e.g. 09820012345 -> 9820012345)
  clean = clean.replace(/^0+/, '')

  // 10 digits national Indian number
  if (clean.length === 10) {
    clean = '91' + clean
  }

  return clean
}

/**
 * Strictly resolves canonical customer-site package URL ONLY if enquiry has a valid DB package ID.
 * Returns null if no package ID is present (e.g. custom bespoke enquiries), avoiding broken slugs.
 */
export function getPackageUrl(enquiry, packages = []) {
  if (!enquiry) return null

  // 1. Explicit valid packageUrl
  if (enquiry.packageUrl && typeof enquiry.packageUrl === 'string' && enquiry.packageUrl.includes('/package/')) {
    return enquiry.packageUrl
  }

  // 2. Strict ID matching: only use if packageId or package_id is present and not a generic string
  const pkgId = enquiry.packageId || enquiry.package_id
  if (pkgId && typeof pkgId === 'string') {
    const trimmed = pkgId.trim()
    const isGeneric = ['custom', 'custom-other', 'bespoke', 'other'].includes(trimmed.toLowerCase())
    if (!isGeneric) {
      // If packages list is available, verify package exists
      if (Array.isArray(packages) && packages.length > 0) {
        const found = packages.find(p => p.id === trimmed || p.id?.toLowerCase() === trimmed.toLowerCase())
        if (found) {
          return `${getCustomerSiteBaseUrl()}/package/${found.id}`
        }
      }
      // If starts with PKG- or UUID pattern, treat as valid package ID
      if (trimmed.startsWith('PKG-') || /^[0-9a-f-]{36}$/i.test(trimmed)) {
        return `${getCustomerSiteBaseUrl()}/package/${trimmed}`
      }
    }
  }

  // 3. If packages array is provided, match by exact name
  if (Array.isArray(packages) && packages.length > 0 && (enquiry.packageName || enquiry.destination)) {
    const targetName = (enquiry.packageName || enquiry.destination).trim().toLowerCase()
    const foundByName = packages.find(p => p.name?.trim().toLowerCase() === targetName)
    if (foundByName) {
      return `${getCustomerSiteBaseUrl()}/package/${foundByName.id}`
    }
  }

  // No valid package ID -> return null (do not invent slugs)
  return null
}

/**
 * Pre-populates a bespoke concierge greeting message for WhatsApp.
 * Appends package link only if a valid package URL exists.
 */
export function generateWhatsAppMessage(enquiry, packages = []) {
  if (!enquiry) return ''
  const name = enquiry.name || 'there'
  const dest = enquiry.destination || 'your upcoming trip'
  const guests = enquiry.guests ? `${enquiry.guests} traveler(s)` : 'your party'
  const dateStr = formatDateDisplay(enquiry.travelDate)
  const pkgUrl = getPackageUrl(enquiry, packages)

  let msg = `Hello ${name}! This is the Kraft Your Trip concierge desk regarding your inquiry for ${dest} (${guests}, planned around ${dateStr}). We are curating your tailored luxury itinerary and would love to assist you with any custom preferences.`
  if (pkgUrl) {
    msg += ` View package details: ${pkgUrl}`
  }
  return msg
}

/**
 * Returns universal WhatsApp deep link using api.whatsapp.com.
 */
export function generateWhatsAppUrl(enquiry, packages = []) {
  if (!enquiry || !enquiry.phone) return ''
  const cleanPhone = getCleanPhoneForWhatsApp(enquiry.phone)
  if (!cleanPhone) return ''
  const text = generateWhatsAppMessage(enquiry, packages)
  return `https://api.whatsapp.com/send/?phone=${cleanPhone}&text=${encodeURIComponent(text)}`
}

/**
 * Generates email subject line for an inquiry.
 */
export function generateEmailSubject(enquiry) {
  if (!enquiry) return 'Kraft Your Trip Concierge — Inquiry'
  const dest = enquiry.destination || 'Bespoke Luxury Tour'
  return `Kraft Your Trip Concierge — Inquiry for ${dest}`
}

/**
 * Pre-populates an email mailto: URL with subject and structured travel overview.
 */
export function generateEmailReplyUrl(enquiry, packages = []) {
  if (!enquiry || !enquiry.email) return ''
  const name = enquiry.name || 'Traveler'
  const dest = enquiry.destination || 'Luxury Tour'
  const guests = enquiry.guests ? `${enquiry.guests} traveler(s)` : 'your party'
  const dateStr = formatDateDisplay(enquiry.travelDate)
  const pkgUrl = getPackageUrl(enquiry, packages)
  const subject = generateEmailSubject(enquiry)

  const body = `Dear ${name},

Thank you for reaching out to Kraft Your Trip regarding your upcoming journey to ${dest} (${guests}).

Our concierge specialists are reviewing your request for travel around ${dateStr} and curating a bespoke itinerary.

Inquiry Overview:
- Destination: ${dest}
- Travel Window: ${dateStr}
- Party Size: ${guests}
${pkgUrl ? `- Package Itinerary: ${pkgUrl}\n` : ''}${enquiry.notes ? `- Special Requests: ${enquiry.notes}\n` : ''}
Could you please confirm if your dates are flexible, and if you have any preferred airline class or suite category?

Warm regards,
Kraft Your Trip Concierge Desk
+91 7046704693 | contact@kraftyourtrip.com
https://kraftyourtrip.com`

  return `mailto:${enquiry.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

/**
 * Generates an inline-styled, luxury HTML email template as the customer receives it.
 */
export function generateConciergeEmailHtml(enquiry, packages = []) {
  if (!enquiry) return ''
  const name = enquiry.name || 'Distinguished Traveler'
  const dest = enquiry.destination || 'Bespoke Luxury Tour'
  const guests = enquiry.guests ? `${enquiry.guests} traveler(s)` : 'Your Party'
  const dateStr = formatDateDisplay(enquiry.travelDate)
  const pkgUrl = getPackageUrl(enquiry, packages)
  const notes = enquiry.notes ? enquiry.notes.trim() : null

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kraft Your Trip Concierge</title>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #f7f6f2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #292524; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e7e5e4; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
    <!-- Header Banner -->
    <tr>
      <td style="background-color: #1c1917; padding: 32px 28px; text-align: center; border-bottom: 2px solid #b45309;">
        <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.25em; color: #f59e0b; display: block; margin-bottom: 6px;">
          Bespoke Concierge Atelier
        </span>
        <h1 style="margin: 0; font-family: 'Playfair Display', Georgia, serif; font-size: 24px; font-weight: 700; letter-spacing: 0.02em; color: #ffffff;">
          KRAFT YOUR TRIP
        </h1>
        <p style="margin: 6px 0 0; font-size: 12px; color: #a8a29e; font-weight: 300;">
          Handcrafted Luxury Escapes Across 7 Continents
        </p>
      </td>
    </tr>

    <!-- Main Content -->
    <tr>
      <td style="padding: 32px 28px 24px;">
        <h2 style="margin: 0 0 14px; font-size: 19px; font-weight: 700; color: #1c1917; font-family: 'Playfair Display', Georgia, serif;">
          Dear ${name},
        </h2>
        <p style="margin: 0 0 18px; font-size: 14px; line-height: 1.65; color: #57534e;">
          Thank you for entrusting Kraft Your Trip with your upcoming journey. Our concierge specialists have received your inquiry for <strong>${dest}</strong> and are actively curating a bespoke itinerary tailored to your party.
        </p>

        <!-- Itinerary Summary Card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fafaf9; border: 1px solid #e7e5e4; border-radius: 12px; margin: 20px 0; overflow: hidden;">
          <tr>
            <td style="padding: 14px 20px; border-bottom: 1px solid #e7e5e4; background-color: #f5f5f4;">
              <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; color: #78716c;">
                Trip Inquiry Overview
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding: 5px 0; font-size: 13px; color: #78716c; width: 35%;">Destination</td>
                  <td style="padding: 5px 0; font-size: 13px; font-weight: 600; color: #1c1917;">${dest}</td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; font-size: 13px; color: #78716c;">Travel Window</td>
                  <td style="padding: 5px 0; font-size: 13px; font-weight: 600; color: #1c1917;">${dateStr}</td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; font-size: 13px; color: #78716c;">Party Size</td>
                  <td style="padding: 5px 0; font-size: 13px; font-weight: 600; color: #1c1917;">${guests}</td>
                </tr>
                ${notes ? `
                <tr>
                  <td style="padding: 5px 0; font-size: 13px; color: #78716c; vertical-align: top;">Special Requests</td>
                  <td style="padding: 5px 0; font-size: 13px; color: #44403c; line-height: 1.5;">${notes}</td>
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>
        </table>

        ${pkgUrl ? `
        <!-- Direct Package CTA -->
        <div style="text-align: center; margin: 24px 0 28px;">
          <a href="${pkgUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #b45309; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; padding: 13px 26px; border-radius: 9999px; box-shadow: 0 4px 12px rgba(180, 83, 9, 0.25);">
            View Curated Package Itinerary &rarr;
          </a>
        </div>
        ` : ''}

        <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.65; color: #57534e;">
          A dedicated private concierge will connect with you to review flight arrangements, private suite upgrades, and custom culinary requests.
        </p>

        <!-- Signoff Block -->
        <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #e7e5e4;">
          <p style="margin: 0; font-size: 13px; color: #78716c;">Warm regards,</p>
          <p style="margin: 3px 0 0; font-size: 14px; font-weight: 700; color: #1c1917;">Kraft Your Trip Concierge Desk</p>
          <p style="margin: 5px 0 0; font-size: 12px; color: #a8a29e;">
            +91 70467 04693 • contact@kraftyourtrip.com • https://kraftyourtrip.com
          </p>
        </div>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #fafaf9; padding: 16px 28px; text-align: center; border-top: 1px solid #e7e5e4;">
        <p style="margin: 0; font-size: 11px; color: #a8a29e; line-height: 1.5;">
          © ${new Date().getFullYear()} Kraft Your Trip Private Limited. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

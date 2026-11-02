/**
 * Omnichannel Communications Pipeline Utilities
 * Provides sanitized phone formatting, WhatsApp deep links, package URL mapping,
 * and pre-composed email replies with luxury HTML templates.
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
 * Resolves canonical customer-site package URL for an inquiry.
 * Supports explicit packageUrl, packageId, packageName, or destination slug.
 */
export function getPackageUrl(enquiry) {
  if (!enquiry) return 'https://kraftyourtrip.com'
  if (enquiry.packageUrl) return enquiry.packageUrl

  const pkgId = enquiry.packageId || enquiry.package_id
  if (pkgId && pkgId !== 'custom-other' && pkgId !== 'custom') {
    return `https://kraftyourtrip.com/package/${pkgId}`
  }

  const target = enquiry.packageName || enquiry.destination
  if (target && !['custom', 'custom trip', 'bespoke', 'other', 'luxury tour'].includes(target.toLowerCase().trim())) {
    const slug = target
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
    if (slug) {
      return `https://kraftyourtrip.com/package/${slug}`
    }
  }

  return 'https://kraftyourtrip.com/#destinations'
}

/**
 * Pre-populates a bespoke concierge greeting message for WhatsApp,
 * including travel details and canonical package itinerary link.
 */
export function generateWhatsAppMessage(enquiry) {
  if (!enquiry) return ''
  const name = enquiry.name || 'there'
  const dest = enquiry.destination || 'your upcoming trip'
  const guests = enquiry.guests ? `${enquiry.guests} traveler(s)` : 'your party'
  const dateStr = formatDateDisplay(enquiry.travelDate)
  const pkgUrl = getPackageUrl(enquiry)

  return `Hello ${name}! This is the Kraft Your Trip concierge desk regarding your inquiry for ${dest} (${guests}, planned around ${dateStr}). We are curating your tailored luxury itinerary and would love to assist you with any custom preferences. Explore your package details: ${pkgUrl}`
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
 * Generates email subject line for an inquiry.
 */
export function generateEmailSubject(enquiry) {
  if (!enquiry) return 'Kraft Your Trip Concierge — Inquiry'
  const dest = enquiry.destination || 'Bespoke Luxury Tour'
  return `Kraft Your Trip Concierge — Inquiry for ${dest}`
}

/**
 * Pre-populates an email mailto: URL with subject and structured travel overview including package link.
 */
export function generateEmailReplyUrl(enquiry) {
  if (!enquiry || !enquiry.email) return ''
  const name = enquiry.name || 'Traveler'
  const dest = enquiry.destination || 'Luxury Tour'
  const guests = enquiry.guests ? `${enquiry.guests} traveler(s)` : 'your party'
  const dateStr = formatDateDisplay(enquiry.travelDate)
  const pkgUrl = getPackageUrl(enquiry)
  const subject = generateEmailSubject(enquiry)

  const body = `Dear ${name},

Thank you for reaching out to Kraft Your Trip regarding your upcoming journey to ${dest} (${guests}).

Our concierge specialists are reviewing your request for travel around ${dateStr} and curating a bespoke itinerary.

Inquiry Overview:
- Destination: ${dest}
- Travel Window: ${dateStr}
- Party Size: ${guests}
- Package Itinerary: ${pkgUrl}
${enquiry.notes ? `- Special Requests: ${enquiry.notes}\n` : ''}
Could you please confirm if your dates are flexible, and if you have any preferred airline class or suite category?

Warm regards,
Kraft Your Trip Concierge Desk
+91 7046704693 | contact@kraftyourtrip.com
https://kraftyourtrip.com`

  return `mailto:${enquiry.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

/**
 * Generates an inline-styled, luxury HTML email template suitable for
 * rich-text email clients, SMTP delivery, or in-app preview.
 */
export function generateConciergeEmailHtml(enquiry) {
  if (!enquiry) return ''
  const name = enquiry.name || 'Distinguished Traveler'
  const dest = enquiry.destination || 'Bespoke Luxury Tour'
  const guests = enquiry.guests ? `${enquiry.guests} traveler(s)` : 'Your Party'
  const dateStr = formatDateDisplay(enquiry.travelDate)
  const pkgUrl = getPackageUrl(enquiry)
  const notes = enquiry.notes ? enquiry.notes.trim() : null

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kraft Your Trip Concierge</title>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #f7f6f2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #292524; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e7e5e4; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
    <!-- Header Banner -->
    <tr>
      <td style="background-color: #1c1917; padding: 36px 32px 30px; text-align: center; border-bottom: 2px solid #b45309;">
        <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.25em; color: #f59e0b; display: block; margin-bottom: 6px;">
          Bespoke Concierge Atelier
        </span>
        <h1 style="margin: 0; font-family: 'Playfair Display', Georgia, serif; font-size: 26px; font-weight: 700; letter-spacing: 0.02em; color: #ffffff;">
          KRAFT YOUR TRIP
        </h1>
        <p style="margin: 8px 0 0; font-size: 12px; color: #a8a29e; font-weight: 300; letter-spacing: 0.05em;">
          Handcrafted Luxury Escapes Across 7 Continents
        </p>
      </td>
    </tr>

    <!-- Main Content -->
    <tr>
      <td style="padding: 36px 32px 28px;">
        <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #1c1917; font-family: 'Playfair Display', Georgia, serif;">
          Dear ${name},
        </h2>
        <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.65; color: #57534e;">
          Thank you for entrusting Kraft Your Trip with your upcoming journey. Our concierge specialists have received your inquiry for <strong>${dest}</strong> and are actively curating a bespoke itinerary tailored to your party.
        </p>

        <!-- Itinerary Summary Card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fafaf9; border: 1px solid #e7e5e4; border-radius: 12px; margin: 24px 0; overflow: hidden;">
          <tr>
            <td style="padding: 18px 22px; border-bottom: 1px solid #e7e5e4; background-color: #f5f5f4;">
              <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; color: #78716c;">
                Trip Inquiry Overview
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding: 18px 22px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #78716c; width: 38%;">Destination</td>
                  <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #1c1917;">${dest}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #78716c;">Travel Window</td>
                  <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #1c1917;">${dateStr}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #78716c;">Party Size</td>
                  <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #1c1917;">${guests}</td>
                </tr>
                ${notes ? `
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #78716c; vertical-align: top;">Special Requests</td>
                  <td style="padding: 6px 0; font-size: 13px; color: #44403c; line-height: 1.5;">${notes}</td>
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>
        </table>

        <!-- Direct Package CTA -->
        <div style="text-align: center; margin: 28px 0 32px;">
          <a href="${pkgUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #b45309; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 14px 28px; border-radius: 9999px; box-shadow: 0 4px 12px rgba(180, 83, 9, 0.25);">
            View Curated Package Itinerary &rarr;
          </a>
          <span style="display: block; margin-top: 10px; font-size: 11px; color: #a8a29e;">
            Direct link: <a href="${pkgUrl}" style="color: #b45309; text-decoration: underline;">${pkgUrl}</a>
          </span>
        </div>

        <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.65; color: #57534e;">
          A dedicated private concierge will connect with you to review flight arrangements, private suite upgrades, and custom culinary requests. If your travel dates are flexible, please let us know so we can secure optimal allocations.
        </p>

        <!-- Signoff Block -->
        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e7e5e4;">
          <p style="margin: 0; font-size: 13px; color: #78716c;">Warm regards,</p>
          <p style="margin: 4px 0 0; font-size: 15px; font-weight: 700; color: #1c1917;">Kraft Your Trip Concierge Desk</p>
          <p style="margin: 6px 0 0; font-size: 12px; color: #a8a29e;">
            Direct: <a href="tel:+917046704693" style="color: #b45309; text-decoration: none; font-weight: 600;">+91 70467 04693</a> •
            Email: <a href="mailto:contact@kraftyourtrip.com" style="color: #b45309; text-decoration: none;">contact@kraftyourtrip.com</a>
          </p>
          <p style="margin: 4px 0 0; font-size: 12px; color: #a8a29e;">
            Official Portal: <a href="https://kraftyourtrip.com" style="color: #b45309; text-decoration: none;">kraftyourtrip.com</a>
          </p>
        </div>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #fafaf9; padding: 20px 32px; text-align: center; border-top: 1px solid #e7e5e4;">
        <p style="margin: 0; font-size: 11px; color: #a8a29e; line-height: 1.5;">
          © ${new Date().getFullYear()} Kraft Your Trip Private Limited. All rights reserved.<br>
          Handcrafted Bespoke Journeys • Verified Luxury Suppliers
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

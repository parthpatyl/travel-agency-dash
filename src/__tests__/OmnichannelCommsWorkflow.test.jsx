import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

if (typeof globalThis.localStorage === 'undefined' || !globalThis.localStorage?.clear) {
  const store = new Map()
  const mockStorage = {
    getItem: (key) => store.get(key) || null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    get length() { return store.size },
    key: (i) => Array.from(store.keys())[i] || null,
  }
  globalThis.localStorage = mockStorage
  if (typeof window !== 'undefined') {
    window.localStorage = mockStorage
  }
}

import EnquiryDetailModal from '../components/EnquiryDetailModal'
import EnquiriesPage from '../components/EnquiriesPage'
import EmailPreviewModal from '../components/EmailPreviewModal'
import {
  getCleanPhoneForWhatsApp,
  getPackageUrl,
  generateWhatsAppMessage,
  generateWhatsAppUrl,
  generateEmailSubject,
  generateEmailReplyUrl,
  generateConciergeEmailHtml,
} from '../utils/commsPipeline'

describe('Omnichannel Comms: Strict Links, Sanitized WhatsApp & Minimalist 3-Button Fast-Track', () => {
  const samplePackages = [
    { id: 'PKG-SWISS-ALPS-01', name: 'Swiss Alpine Luxury' },
    { id: 'PKG-KASHMIR-01', name: 'Kashmir Valley & Dal Lake Paradise' },
    { id: 'PKG-GREECE-01', name: 'Greece Odyssey & Santorini Sunset' }
  ]

  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('1. Comms Pipeline: Strict Package Resolution & Universal Phone Sanitization', () => {
    it('normalizes international phone numbers, strips leading zeros, and prefixes 10-digit Indian numbers with 91', () => {
      expect(getCleanPhoneForWhatsApp('+91 70467-04693')).toBe('917046704693')
      expect(getCleanPhoneForWhatsApp('7046704693')).toBe('917046704693')
      expect(getCleanPhoneForWhatsApp('09820012345')).toBe('919820012345') // Strips leading 0
      expect(getCleanPhoneForWhatsApp('+1 (555) 234-5678')).toBe('15552345678')
      expect(getCleanPhoneForWhatsApp('')).toBe('')
      expect(getCleanPhoneForWhatsApp(null)).toBe('')
    })

    it('strictly resolves canonical package URLs with valid DB package IDs and never invents broken slugs', () => {
      // Valid explicit DB packageId
      const validUrl = getPackageUrl({ packageId: 'PKG-SWISS-ALPS-01' })
      expect(validUrl).toContain('/package/PKG-SWISS-ALPS-01')

      // Matched via packages catalog
      const matchedByName = getPackageUrl(
        { destination: 'Kashmir Valley & Dal Lake Paradise' },
        samplePackages
      )
      expect(matchedByName).toContain('/package/PKG-KASHMIR-01')

      // Matched via known destination fallback even without packages catalog
      const matchedByKnown = getPackageUrl({ destination: 'Kashmir Valley & Dal Lake Paradise' })
      expect(matchedByKnown).toContain('/package/PKG-KASHMIR-01')

      // Custom/bespoke or unmapped destination returns valid catalog link instead of broken 404 slug
      expect(getPackageUrl({ destination: 'Custom Atlantis Deep Sea' })).toContain('/#destinations')
      expect(getPackageUrl({ packageId: 'custom-other' })).toContain('/#destinations')
      expect(getPackageUrl(null)).toContain('/#destinations')
    })

    it('generates WhatsApp greeting message containing valid package link for all enquiries', () => {
      // With valid package
      const enqWithPkg = {
        name: 'Rohan Sharma',
        destination: 'Swiss Alpine Luxury',
        packageId: 'PKG-SWISS-ALPS-01',
        guests: 2,
        travelDate: '2026-10-15'
      }
      const msg1 = generateWhatsAppMessage(enqWithPkg)
      expect(msg1).toContain('Rohan Sharma')
      expect(msg1).toContain('Swiss Alpine Luxury')
      expect(msg1).toContain('/package/PKG-SWISS-ALPS-01')

      // Without explicit package (custom/bespoke) - provides valid destinations catalog link
      const enqWithoutPkg = {
        name: 'Anita Roy',
        destination: 'Bespoke Moon Expedition',
        guests: 2,
        travelDate: '2026-11-01'
      }
      const msg2 = generateWhatsAppMessage(enqWithoutPkg)
      expect(msg2).toContain('Anita Roy')
      expect(msg2).toContain('View package details')
      expect(msg2).toContain('/#destinations')
    })

    it('constructs universal WhatsApp URL with api.whatsapp.com', () => {
      const enquiry = {
        name: 'Aarav Patel',
        phone: '09876543210',
        destination: 'Kashmir Valley & Dal Lake Paradise',
        packageId: 'PKG-KASHMIR-01',
        guests: 2,
        travelDate: '2026-12-01'
      }
      const url = generateWhatsAppUrl(enquiry)
      expect(url).toMatch(/^https:\/\/api\.whatsapp\.com\/send\/\?phone=919876543210&text=/)
      expect(url).toContain(encodeURIComponent('Aarav Patel'))
      expect(url).toContain(encodeURIComponent('/package/PKG-KASHMIR-01'))
    })

    it('constructs mailto: URL and luxury HTML email template with valid package CTA', () => {
      const enqWithoutPkg = {
        name: 'Pooja Nair',
        email: 'pooja@example.com',
        destination: 'Custom Himalayan Trek',
        guests: 3,
        travelDate: '2026-11-20',
        notes: 'Interested in local sherpa guides.'
      }
      const mailto = generateEmailReplyUrl(enqWithoutPkg)
      expect(decodeURIComponent(mailto)).toContain('Package Itinerary:')

      const html = generateConciergeEmailHtml(enqWithoutPkg)
      expect(html).toContain('Dear Pooja Nair,')
      expect(html).toContain('Custom Himalayan Trek')
      expect(html).toContain('View Curated Package Itinerary')
    })
  })

  describe('2. Streamlined EmailPreviewModal (Zero Fluff, As Received by Customer)', () => {
    const sampleEnquiry = {
      name: 'Julian Thorne',
      email: 'julian@thorneinvestments.com',
      destination: 'Swiss Alpine Luxury',
      packageId: 'PKG-SWISS-ALPS-01',
      guests: 2,
      travelDate: '2026-11-10',
      notes: 'Glacier express window seats.'
    }

    it('renders customer email preview showing recipient, subject, and rendered preview iframe', () => {
      render(
        <EmailPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          enquiry={sampleEnquiry}
          packages={samplePackages}
        />
      )

      expect(screen.getByText(/Customer Email Preview/i)).toBeInTheDocument()
      expect(screen.getByText(/julian@thorneinvestments.com/i)).toBeInTheDocument()
      expect(screen.getByTitle('Email Template Rendered Preview')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /Send via Mail App/i })).toBeInTheDocument()
    })
  })

  describe('3. EnquiryDetailModal: 3 Focused Buttons ([WhatsApp], [Email Preview], [Copy Text])', () => {
    const mockEnquiry = {
      id: 'ENQ-2026-88',
      name: 'Vikram Malhotra',
      email: 'vikram@luxurytravel.com',
      phone: '+91 9820012345',
      destination: 'Swiss Alpine Luxury',
      packageId: 'PKG-SWISS-ALPS-01',
      travelDate: '2026-12-20',
      guests: 2,
      notes: 'Require 5-star glass igloo accommodations and private superjeep tour.'
    }

    beforeEach(() => {
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/api/enquiries/ENQ-2026-88')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: mockEnquiry })
          })
        }
        return Promise.resolve({ ok: true, json: async () => ({}) })
      })
    })

    it('renders exactly the 3 minimalist buttons: WhatsApp, Email Preview, and Copy Text', async () => {
      render(
        <EnquiryDetailModal
          enquiryId="ENQ-2026-88"
          isOpen={true}
          onClose={vi.fn()}
          token="mock-token"
          addNotification={vi.fn()}
          setBookingDraft={vi.fn()}
          setActiveTab={vi.fn()}
          packages={samplePackages}
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/Omnichannel Concierge Fast-Track/i)).toBeInTheDocument()
      })

      // 1. WhatsApp Button
      const waLink = screen.getByRole('link', { name: /^WhatsApp$/i })
      expect(waLink).toBeInTheDocument()
      expect(waLink).toHaveAttribute('href', expect.stringContaining('https://api.whatsapp.com/send/?phone=919820012345'))
      expect(waLink).toHaveAttribute('href', expect.stringContaining(encodeURIComponent('/package/PKG-SWISS-ALPS-01')))

      // 2. Email Preview Button
      const previewBtn = screen.getByRole('button', { name: /^Email Preview$/i })
      expect(previewBtn).toBeInTheDocument()

      // 3. Copy Text Button
      const copyBtn = screen.getByRole('button', { name: /Copy Text/i })
      expect(copyBtn).toBeInTheDocument()

      // Verify no cluttered legacy buttons exist
      expect(screen.queryByRole('link', { name: /Package Link/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /Email Reply/i })).not.toBeInTheDocument()
    })

    it('opens streamlined EmailPreviewModal when Email Preview is clicked', async () => {
      render(
        <EnquiryDetailModal
          enquiryId="ENQ-2026-88"
          isOpen={true}
          onClose={vi.fn()}
          token="mock-token"
          addNotification={vi.fn()}
          setBookingDraft={vi.fn()}
          setActiveTab={vi.fn()}
          packages={samplePackages}
        />
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^Email Preview$/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /^Email Preview$/i }))

      await waitFor(() => {
        expect(screen.getByText(/Customer Email Preview/i)).toBeInTheDocument()
        expect(screen.getAllByText(/vikram@luxurytravel.com/i).length).toBeGreaterThanOrEqual(1)
      })
    })

    it('copies concise concierge message to clipboard on Copy Text button click', async () => {
      const mockWriteText = vi.fn().mockResolvedValue()
      Object.assign(navigator, {
        clipboard: { writeText: mockWriteText }
      })

      const addNotification = vi.fn()

      render(
        <EnquiryDetailModal
          enquiryId="ENQ-2026-88"
          isOpen={true}
          onClose={vi.fn()}
          token="mock-token"
          addNotification={addNotification}
          setBookingDraft={vi.fn()}
          setActiveTab={vi.fn()}
          packages={samplePackages}
        />
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Copy Text/i })).toBeInTheDocument()
      })

      const copyBtn = screen.getByRole('button', { name: /Copy Text/i })
      fireEvent.click(copyBtn)

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith(expect.stringContaining('Vikram Malhotra'))
        expect(mockWriteText).toHaveBeenCalledWith(expect.stringContaining('/package/PKG-SWISS-ALPS-01'))
        expect(addNotification).toHaveBeenCalledWith(
          expect.stringContaining('copied to clipboard'),
          'info'
        )
      })
    })
  })

  describe('4. EnquiriesPage: Clean Toolbar Without Temp Button & Row Email Preview', () => {
    const mockEnquiries = [
      {
        id: 'ENQ-101',
        name: 'Sunita Rao',
        email: 'sunita@example.com',
        phone: '09988776655',
        destination: 'Swiss Alpine Luxury',
        packageId: 'PKG-SWISS-ALPS-01',
        travelDate: '2026-11-05',
        guests: 4,
        status: 'logged',
        leadSource: 'Website Inquiry',
        submittedAt: '2026-10-01'
      }
    ]

    beforeEach(() => {
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/api/enquiries')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: mockEnquiries })
          })
        }
        return Promise.resolve({ ok: true, json: async () => [] })
      })
    })

    it('renders clean toolbar without temporary preview buttons and opens email preview from table row', async () => {
      const onSelectEnquiry = vi.fn()
      const addNotification = vi.fn()

      render(
        <EnquiriesPage
          API_URL="http://localhost:5000"
          authHeaders={{ Authorization: 'Bearer token' }}
          addNotification={addNotification}
          onSelectEnquiry={onSelectEnquiry}
          packages={samplePackages}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Sunita Rao')).toBeInTheDocument()
      })

      // Verify temp preview button is removed from top toolbar
      expect(screen.queryByRole('button', { name: /\+ Temp Preview User/i })).not.toBeInTheDocument()

      // Verify Email Preview quick action button exists in table row
      const emailPreviewRowBtn = screen.getByTitle(/Preview Concierge Email for Sunita Rao/i)
      expect(emailPreviewRowBtn).toBeInTheDocument()

      fireEvent.click(emailPreviewRowBtn)

      await waitFor(() => {
        expect(screen.getByText(/Customer Email Preview/i)).toBeInTheDocument()
        expect(screen.getAllByText(/sunita@example.com/i).length).toBeGreaterThanOrEqual(2)
      })
    })
  })
})

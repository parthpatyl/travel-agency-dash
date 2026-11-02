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

      // Custom/bespoke or unmapped destination returns null instead of a broken slug
      expect(getPackageUrl({ destination: 'Kashmir Valley & Dal Lake Paradise' })).toBeNull()
      expect(getPackageUrl({ destination: 'Custom Trip' })).toBeNull()
      expect(getPackageUrl({ packageId: 'custom-other' })).toBeNull()
      expect(getPackageUrl(null)).toBeNull()
    })

    it('generates WhatsApp greeting message containing package link ONLY if a valid package exists', () => {
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

      // Without valid package (custom/bespoke)
      const enqWithoutPkg = {
        name: 'Anita Roy',
        destination: 'Bespoke European Roadtrip',
        guests: 2,
        travelDate: '2026-11-01'
      }
      const msg2 = generateWhatsAppMessage(enqWithoutPkg)
      expect(msg2).toContain('Anita Roy')
      expect(msg2).not.toContain('/package/')
      expect(msg2).not.toContain('View package details')
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

    it('constructs mailto: URL and luxury HTML email template strictly omitting package CTA when no valid package exists', () => {
      const enqWithoutPkg = {
        name: 'Pooja Nair',
        email: 'pooja@example.com',
        destination: 'Custom Himalayan Trek',
        guests: 3,
        travelDate: '2026-11-20',
        notes: 'Interested in local sherpa guides.'
      }
      const mailto = generateEmailReplyUrl(enqWithoutPkg)
      expect(mailto).not.toContain('Package Itinerary:')

      const html = generateConciergeEmailHtml(enqWithoutPkg)
      expect(html).toContain('Dear Pooja Nair,')
      expect(html).toContain('Custom Himalayan Trek')
      expect(html).not.toContain('View Curated Package Itinerary')
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

  describe('4. EnquiriesPage: Temp Preview User with Valid Package ID', () => {
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

    it('generates temporary preview user Eleanor Vance with valid package ID and opens preview', async () => {
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

      const tempUserBtn = screen.getByRole('button', { name: /\+ Temp Preview User/i })
      expect(tempUserBtn).toBeInTheDocument()

      fireEvent.click(tempUserBtn)

      await waitFor(() => {
        expect(screen.getByText('Eleanor Vance')).toBeInTheDocument()
        expect(screen.getAllByText(/Swiss Alpine Luxury/i).length).toBeGreaterThanOrEqual(2)
        expect(onSelectEnquiry).toHaveBeenCalledWith(expect.stringMatching(/^ENQ-PREV-\d+/))
        expect(addNotification).toHaveBeenCalledWith(
          expect.stringContaining('Eleanor Vance'),
          'success'
        )
      })
    })
  })
})

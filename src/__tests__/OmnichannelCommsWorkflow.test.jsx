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
  formatDateDisplay
} from '../utils/commsPipeline'

describe('Omnichannel Comms, Package Links & Email Preview Workflow', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('1. Comms Pipeline & Package Link Mapping', () => {
    it('normalizes international phone numbers and prefixes 10-digit numbers with India code (91)', () => {
      expect(getCleanPhoneForWhatsApp('+91 70467-04693')).toBe('917046704693')
      expect(getCleanPhoneForWhatsApp('7046704693')).toBe('917046704693')
      expect(getCleanPhoneForWhatsApp('+1 (555) 234-5678')).toBe('15552345678')
      expect(getCleanPhoneForWhatsApp('')).toBe('')
      expect(getCleanPhoneForWhatsApp(null)).toBe('')
    })

    it('resolves canonical package URLs accurately across formats', () => {
      // 1. Explicit packageUrl
      expect(getPackageUrl({ packageUrl: 'https://kraftyourtrip.com/package/custom-luxury' }))
        .toBe('https://kraftyourtrip.com/package/custom-luxury')

      // 2. packageId
      expect(getPackageUrl({ packageId: 'greece-odyssey-2026' }))
        .toBe('https://kraftyourtrip.com/package/greece-odyssey-2026')

      // 3. package_id
      expect(getPackageUrl({ package_id: 'swiss-alps-express' }))
        .toBe('https://kraftyourtrip.com/package/swiss-alps-express')

      // 4. Destination slugification
      expect(getPackageUrl({ destination: 'Amalfi Coast & Capri Yacht' }))
        .toBe('https://kraftyourtrip.com/package/amalfi-coast-capri-yacht')

      // 5. Fallback for generic/bespoke
      expect(getPackageUrl({ destination: 'Custom Trip' }))
        .toBe('https://kraftyourtrip.com/#destinations')
      expect(getPackageUrl(null))
        .toBe('https://kraftyourtrip.com')
    })

    it('generates personalized WhatsApp greeting message with package link and luxury concierge tone', () => {
      const enquiry = {
        name: 'Rohan Sharma',
        destination: 'Swiss Alps',
        packageId: 'swiss-alps-luxury',
        guests: 2,
        travelDate: '2026-10-15'
      }
      const msg = generateWhatsAppMessage(enquiry)
      expect(msg).toContain('Rohan Sharma')
      expect(msg).toContain('Swiss Alps')
      expect(msg).toContain('2 traveler(s)')
      expect(msg).toContain('Kraft Your Trip concierge desk')
      expect(msg).toContain('https://kraftyourtrip.com/package/swiss-alps-luxury')
    })

    it('constructs wa.me deep links with encoded greeting and package URL', () => {
      const enquiry = {
        name: 'Aarav Patel',
        phone: '+91 9876543210',
        destination: 'Maldives Overwater',
        packageId: 'maldives-overwater-bungalow',
        guests: 2,
        travelDate: '2026-12-01'
      }
      const url = generateWhatsAppUrl(enquiry)
      expect(url).toMatch(/^https:\/\/wa\.me\/919876543210\?text=/)
      expect(url).toContain(encodeURIComponent('Aarav Patel'))
      expect(url).toContain(encodeURIComponent('https://kraftyourtrip.com/package/maldives-overwater-bungalow'))
    })

    it('constructs mailto: URL with structured travel details, package link, and concierge signature', () => {
      const enquiry = {
        name: 'Pooja Nair',
        email: 'pooja@example.com',
        destination: 'Kyoto Cultural Heritage',
        packageId: 'kyoto-cultural-heritage',
        guests: 3,
        travelDate: '2026-11-20',
        notes: 'Interested in private tea ceremonies.'
      }
      const mailto = generateEmailReplyUrl(enquiry)
      expect(mailto).toMatch(/^mailto:pooja@example\.com\?subject=/)
      expect(mailto).toContain('Kraft%20Your%20Trip%20Concierge')
      expect(mailto).toContain('Kyoto%20Cultural%20Heritage')
      expect(mailto).toContain('Interested%20in%20private%20tea%20ceremonies')
      expect(mailto).toContain(encodeURIComponent('https://kraftyourtrip.com/package/kyoto-cultural-heritage'))
    })

    it('generates rich inline-styled HTML luxury email template with package link CTA', () => {
      const enquiry = {
        name: 'Eleanor Vance',
        destination: 'Amalfi Coast Private Yacht Charter',
        packageId: 'amalfi-coast-luxury-escape',
        guests: 2,
        travelDate: '2026-12-25',
        notes: 'Sunset cruise to Capri and vintage champagne.'
      }
      const html = generateConciergeEmailHtml(enquiry)
      expect(html).toContain('KRAFT YOUR TRIP')
      expect(html).toContain('Bespoke Concierge Atelier')
      expect(html).toContain('Dear Eleanor Vance,')
      expect(html).toContain('Amalfi Coast Private Yacht Charter')
      expect(html).toContain('Sunset cruise to Capri and vintage champagne.')
      expect(html).toContain('https://kraftyourtrip.com/package/amalfi-coast-luxury-escape')
      expect(html).toContain('View Curated Package Itinerary &rarr;')
      expect(html).toContain('contact@kraftyourtrip.com')
    })
  })

  describe('2. EmailPreviewModal Rendering & Copy Features', () => {
    const sampleEnquiry = {
      name: 'Julian Thorne',
      email: 'julian@thorneinvestments.com',
      destination: 'Serengeti Migration Luxury Safari',
      packageId: 'serengeti-migration-safari',
      guests: 2,
      travelDate: '2026-11-10',
      notes: 'Hot air balloon safari requested.'
    }

    it('renders metadata, rendered iframe, and package link', () => {
      render(
        <EmailPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          enquiry={sampleEnquiry}
          addNotification={vi.fn()}
        />
      )

      expect(screen.getByText(/Concierge Email Preview/i)).toBeInTheDocument()
      expect(screen.getByText(/julian@thorneinvestments.com/i)).toBeInTheDocument()
      expect(screen.getByText('https://kraftyourtrip.com/package/serengeti-migration-safari')).toBeInTheDocument()
      expect(screen.getByTitle('Email Template Rendered Preview')).toBeInTheDocument()
    })

    it('switches between Rendered HTML, HTML Code, and Plain Text tabs', () => {
      render(
        <EmailPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          enquiry={sampleEnquiry}
          addNotification={vi.fn()}
        />
      )

      // Switch to HTML code
      fireEvent.click(screen.getByRole('button', { name: /HTML Code/i }))
      expect(screen.getByText(/<!DOCTYPE html>/i)).toBeInTheDocument()

      // Switch to Plain Text
      fireEvent.click(screen.getByRole('button', { name: /Plain Text/i }))
      expect(screen.getByText(/Subject: Kraft Your Trip Concierge/i)).toBeInTheDocument()
    })

    it('copies HTML and Plain Text to clipboard on click', async () => {
      const mockWriteText = vi.fn().mockResolvedValue()
      Object.assign(navigator, {
        clipboard: { writeText: mockWriteText }
      })
      const addNotification = vi.fn()

      render(
        <EmailPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          enquiry={sampleEnquiry}
          addNotification={addNotification}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /Copy HTML/i }))
      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith(expect.stringContaining('KRAFT YOUR TRIP'))
        expect(addNotification).toHaveBeenCalledWith(
          expect.stringContaining('HTML email copied'),
          'success'
        )
      })

      fireEvent.click(screen.getByRole('button', { name: /Copy Text/i }))
      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith(expect.stringContaining('Julian Thorne'))
      })
    })
  })

  describe('3. EnquiryDetailModal Fast-Track Outreach & Conversion', () => {
    const mockEnquiry = {
      id: 'ENQ-2026-88',
      name: 'Vikram Malhotra',
      email: 'vikram@luxurytravel.com',
      phone: '+91 9820012345',
      destination: 'Iceland Northern Lights',
      packageId: 'iceland-northern-lights-escape',
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

    it('renders WhatsApp Concierge with package link, Email Reply, Preview Email, and Package Link pill', async () => {
      render(
        <EnquiryDetailModal
          enquiryId="ENQ-2026-88"
          isOpen={true}
          onClose={vi.fn()}
          token="mock-token"
          addNotification={vi.fn()}
          setBookingDraft={vi.fn()}
          setActiveTab={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/Omnichannel Concierge Fast-Track/i)).toBeInTheDocument()
      })

      // WhatsApp Concierge Link
      const waLink = screen.getByRole('link', { name: /WhatsApp Concierge/i })
      expect(waLink).toBeInTheDocument()
      expect(waLink).toHaveAttribute('href', expect.stringContaining('https://wa.me/919820012345'))
      expect(waLink).toHaveAttribute('href', expect.stringContaining(encodeURIComponent('https://kraftyourtrip.com/package/iceland-northern-lights-escape')))

      // Email Reply Link
      const emailLink = screen.getByRole('link', { name: /Email Reply/i })
      expect(emailLink).toBeInTheDocument()
      expect(emailLink).toHaveAttribute('href', expect.stringContaining('mailto:vikram@luxurytravel.com'))
      expect(emailLink).toHaveAttribute('href', expect.stringContaining(encodeURIComponent('https://kraftyourtrip.com/package/iceland-northern-lights-escape')))

      // Package Link Pill
      const pkgPill = screen.getByRole('link', { name: /Package Link/i })
      expect(pkgPill).toBeInTheDocument()
      expect(pkgPill).toHaveAttribute('href', 'https://kraftyourtrip.com/package/iceland-northern-lights-escape')

      // Preview Email Button
      const previewBtn = screen.getByRole('button', { name: /Preview Email/i })
      expect(previewBtn).toBeInTheDocument()
    })

    it('opens EmailPreviewModal when Preview Email is clicked', async () => {
      render(
        <EnquiryDetailModal
          enquiryId="ENQ-2026-88"
          isOpen={true}
          onClose={vi.fn()}
          token="mock-token"
          addNotification={vi.fn()}
          setBookingDraft={vi.fn()}
          setActiveTab={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Preview Email/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Preview Email/i }))

      await waitFor(() => {
        expect(screen.getByText(/Concierge Email Preview/i)).toBeInTheDocument()
        expect(screen.getAllByText(/vikram@luxurytravel.com/i).length).toBeGreaterThanOrEqual(1)
      })
    })

    it('copies WhatsApp greeting message to clipboard on button click', async () => {
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
        />
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Copy Msg/i })).toBeInTheDocument()
      })

      const copyBtn = screen.getByRole('button', { name: /Copy Msg/i })
      fireEvent.click(copyBtn)

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith(expect.stringContaining('Vikram Malhotra'))
        expect(mockWriteText).toHaveBeenCalledWith(expect.stringContaining('https://kraftyourtrip.com/package/iceland-northern-lights-escape'))
        expect(addNotification).toHaveBeenCalledWith(
          expect.stringContaining('copied to clipboard'),
          'info'
        )
      })
    })

    it('converts enquiry into booking draft, populates parameters and routes to bookings tab', async () => {
      const setBookingDraft = vi.fn()
      const setActiveTab = vi.fn()
      const onClose = vi.fn()
      const addNotification = vi.fn()

      render(
        <EnquiryDetailModal
          enquiryId="ENQ-2026-88"
          isOpen={true}
          onClose={onClose}
          token="mock-token"
          addNotification={addNotification}
          setBookingDraft={setBookingDraft}
          setActiveTab={setActiveTab}
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/Convert to Booking/i)).toBeInTheDocument()
      })

      const convertBtn = screen.getByRole('button', { name: /Convert to Booking/i })
      fireEvent.click(convertBtn)

      expect(setBookingDraft).toHaveBeenCalledWith({
        client: 'Vikram Malhotra',
        clientEmail: 'vikram@luxurytravel.com',
        package: 'Iceland Northern Lights',
        guests: 2,
        date: '2026-12-20',
        notes: 'Require 5-star glass igloo accommodations and private superjeep tour.'
      })
      expect(setActiveTab).toHaveBeenCalledWith('bookings')
      expect(onClose).toHaveBeenCalled()
      expect(addNotification).toHaveBeenCalledWith(
        expect.stringContaining('converted to booking draft'),
        'success'
      )
    })
  })

  describe('4. EnquiriesPage Fast-Track & Temp Preview User Generation', () => {
    const mockEnquiries = [
      {
        id: 'ENQ-101',
        name: 'Sunita Rao',
        email: 'sunita@example.com',
        phone: '+91 9988776655',
        destination: 'Bali Tropical',
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

    it('renders customer phone, WhatsApp action, and email preview action in enquiries table', async () => {
      render(
        <EnquiriesPage
          API_URL="http://localhost:5000"
          authHeaders={{ Authorization: 'Bearer token' }}
          addNotification={vi.fn()}
          onSelectEnquiry={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Sunita Rao')).toBeInTheDocument()
      })

      // Verify phone number is displayed in customer column
      expect(screen.getByText('+91 9988776655')).toBeInTheDocument()

      // Verify 1-click WhatsApp link exists with correct wa.me link
      const waBtn = screen.getByTitle(/WhatsApp Sunita Rao/i)
      expect(waBtn).toBeInTheDocument()
      expect(waBtn).toHaveAttribute('href', expect.stringContaining('https://wa.me/919988776655'))

      // Verify 1-click email preview button exists
      const emailPreviewBtn = screen.getByTitle(/Preview Concierge Email for Sunita Rao/i)
      expect(emailPreviewBtn).toBeInTheDocument()
    })

    it('generates a temporary preview user Eleanor Vance with package link and opens details/preview', async () => {
      const onSelectEnquiry = vi.fn()
      const addNotification = vi.fn()

      render(
        <EnquiriesPage
          API_URL="http://localhost:5000"
          authHeaders={{ Authorization: 'Bearer token' }}
          addNotification={addNotification}
          onSelectEnquiry={onSelectEnquiry}
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
        expect(screen.getByText(/Amalfi Coast & Capri Private Yacht Charter/i)).toBeInTheDocument()
        expect(onSelectEnquiry).toHaveBeenCalledWith(expect.stringMatching(/^ENQ-PREV-\d+/))
        expect(addNotification).toHaveBeenCalledWith(
          expect.stringContaining('Eleanor Vance'),
          'success'
        )
      })
    })
  })
})

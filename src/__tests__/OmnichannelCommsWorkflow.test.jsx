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
import {
  getCleanPhoneForWhatsApp,
  generateWhatsAppMessage,
  generateWhatsAppUrl,
  generateEmailReplyUrl,
  formatDateDisplay
} from '../utils/commsPipeline'

describe('Phase 3 & 4: Omnichannel Comms & Dashboard Operations Verification', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('1. Comms Pipeline Utility Functions', () => {
    it('normalizes international phone numbers and prefixes 10-digit numbers with India code (91)', () => {
      expect(getCleanPhoneForWhatsApp('+91 70467-04693')).toBe('917046704693')
      expect(getCleanPhoneForWhatsApp('7046704693')).toBe('917046704693')
      expect(getCleanPhoneForWhatsApp('+1 (555) 234-5678')).toBe('15552345678')
      expect(getCleanPhoneForWhatsApp('')).toBe('')
      expect(getCleanPhoneForWhatsApp(null)).toBe('')
    })

    it('generates personalized WhatsApp greeting message with luxury concierge tone', () => {
      const enquiry = {
        name: 'Rohan Sharma',
        destination: 'Swiss Alps',
        guests: 2,
        travelDate: '2026-10-15'
      }
      const msg = generateWhatsAppMessage(enquiry)
      expect(msg).toContain('Rohan Sharma')
      expect(msg).toContain('Swiss Alps')
      expect(msg).toContain('2 traveler(s)')
      expect(msg).toContain('Kraft Your Trip concierge desk')
    })

    it('constructs wa.me deep links with properly encoded text query parameter', () => {
      const enquiry = {
        name: 'Aarav Patel',
        phone: '+91 9876543210',
        destination: 'Maldives Overwater',
        guests: 2,
        travelDate: '2026-12-01'
      }
      const url = generateWhatsAppUrl(enquiry)
      expect(url).toMatch(/^https:\/\/wa\.me\/919876543210\?text=/)
      expect(url).toContain(encodeURIComponent('Aarav Patel'))
      expect(url).toContain(encodeURIComponent('Maldives Overwater'))
    })

    it('constructs mailto: URL with structured travel details and concierge signature', () => {
      const enquiry = {
        name: 'Pooja Nair',
        email: 'pooja@example.com',
        destination: 'Kyoto Cultural Heritage',
        guests: 3,
        travelDate: '2026-11-20',
        notes: 'Interested in private tea ceremonies.'
      }
      const mailto = generateEmailReplyUrl(enquiry)
      expect(mailto).toMatch(/^mailto:pooja@example\.com\?subject=/)
      expect(mailto).toContain('Kraft%20Your%20Trip%20Concierge')
      expect(mailto).toContain('Kyoto%20Cultural%20Heritage')
      expect(mailto).toContain('Interested%20in%20private%20tea%20ceremonies')
    })
  })

  describe('2. EnquiryDetailModal Fast-Track Outreach & Conversion', () => {
    const mockEnquiry = {
      id: 'ENQ-2026-88',
      name: 'Vikram Malhotra',
      email: 'vikram@luxurytravel.com',
      phone: '+91 9820012345',
      destination: 'Iceland Northern Lights',
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

    it('renders WhatsApp Concierge and Email Reply actions with proper deep links', async () => {
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

      const waLink = screen.getByRole('link', { name: /WhatsApp Concierge/i })
      expect(waLink).toBeInTheDocument()
      expect(waLink).toHaveAttribute('href', expect.stringContaining('https://wa.me/919820012345'))
      expect(waLink).toHaveAttribute('target', '_blank')
      expect(waLink).toHaveAttribute('rel', 'noopener noreferrer')

      const emailLink = screen.getByRole('link', { name: /Email Reply/i })
      expect(emailLink).toBeInTheDocument()
      expect(emailLink).toHaveAttribute('href', expect.stringContaining('mailto:vikram@luxurytravel.com'))
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

  describe('3. EnquiriesPage Fast-Track Omnichannel Table Integration', () => {
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

    it('renders customer phone and 1-click WhatsApp quick action in enquiries table', async () => {
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
    })
  })
})

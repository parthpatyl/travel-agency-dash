import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import * as XLSX from 'xlsx'

// Intercept XLSX.writeFile to capture workbook and sheets for deep inspection
let capturedWb = null
let capturedFilename = null

vi.mock('xlsx', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    writeFile: (wb, filename) => {
      capturedWb = wb
      capturedFilename = filename
    }
  }
})

// Polyfill localStorage for Node/JSDOM test runner
if (typeof globalThis.localStorage === 'undefined' || !globalThis.localStorage?.clear) {
  const memoryStore = new Map()
  const storagePolyfill = {
    getItem: (key) => memoryStore.get(key) || null,
    setItem: (key, val) => memoryStore.set(key, String(val)),
    removeItem: (key) => memoryStore.delete(key),
    clear: () => memoryStore.clear(),
    get length() { return memoryStore.size },
    key: (i) => Array.from(memoryStore.keys())[i] || null,
  }
  globalThis.localStorage = storagePolyfill
  if (typeof window !== 'undefined') {
    window.localStorage = storagePolyfill
  }
}

import BookingsPage from '../components/BookingsPage'
import ClientsPage from '../components/ClientsPage'
import EnquiriesPage from '../components/EnquiriesPage'
import ReportsPage from '../components/ReportsPage'

describe('Empirical Challenger Gen 2 Stress Suite — Milestone 3 (Admin Dashboard)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    capturedWb = null
    capturedFilename = null
  })

  // =========================================================================
  // TARGET 1: Cancellation reasons prompt modal
  // =========================================================================
  describe('Target 1: Cancellation Reasons Prompt Modal Resilience', () => {
    const testBooking = {
      id: 'BK-CHALLENGER-101',
      client: 'Aditya Birla',
      package: 'Rajasthan Heritage Odyssey',
      amount: 250000,
      date: '2026-11-20',
      status: 'Confirmed',
      guests: 4
    }

    it('blocks immediate status mutation on select change and presents required modal', async () => {
      const mockSetBookings = vi.fn()
      const mockSetClients = vi.fn()

      render(
        <BookingsPage
          bookings={[testBooking]}
          setBookings={mockSetBookings}
          clients={[{ id: 'cli-ab', name: 'Aditya Birla', status: 'Active', logs: [] }]}
          setClients={mockSetClients}
          packages={[]}
          user={{ role: 'admin' }}
        />
      )

      const statusSelect = screen.getByRole('combobox')
      expect(statusSelect.value).toBe('Confirmed')

      // Attempt to change status directly to 'Cancelled'
      fireEvent.change(statusSelect, { target: { value: 'Cancelled' } })

      // Crucial assertion: status must NOT be updated synchronously
      expect(mockSetBookings).not.toHaveBeenCalled()
      expect(mockSetClients).not.toHaveBeenCalled()

      // Modal must be open and display target booking info
      expect(screen.getByText(/cancel booking #bk-challenger-101/i)).toBeInTheDocument()
      expect(screen.getByText(/client: aditya birla/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /keep booking/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /confirm cancellation/i })).toBeInTheDocument()
    })

    it('cancels modal when "Keep Booking" is pressed without applying cancellation', async () => {
      const mockSetBookings = vi.fn()
      const mockSetClients = vi.fn()

      render(
        <BookingsPage
          bookings={[testBooking]}
          setBookings={mockSetBookings}
          clients={[{ id: 'cli-ab', name: 'Aditya Birla', status: 'Active', logs: [] }]}
          setClients={mockSetClients}
          packages={[]}
          user={{ role: 'admin' }}
        />
      )

      const statusSelect = screen.getByRole('combobox')
      fireEvent.change(statusSelect, { target: { value: 'Cancelled' } })

      const keepBtn = screen.getByRole('button', { name: /keep booking/i })
      fireEvent.click(keepBtn)

      // Modal dismissed
      expect(screen.queryByText(/cancel booking #bk-challenger-101/i)).not.toBeInTheDocument()
      // Zero mutations applied
      expect(mockSetBookings).not.toHaveBeenCalled()
      expect(mockSetClients).not.toHaveBeenCalled()
    })

    it('allows selection of reason and persists cancellationReason onto booking and client audit log', async () => {
      let currentBookings = [testBooking]
      const mockSetBookings = vi.fn((newBookings) => { currentBookings = newBookings })
      let currentClients = [{ id: 'cli-ab', name: 'Aditya Birla', status: 'Active', logs: [] }]
      const mockSetClients = vi.fn((fnOrVal) => {
        currentClients = typeof fnOrVal === 'function' ? fnOrVal(currentClients) : fnOrVal
      })

      render(
        <BookingsPage
          bookings={currentBookings}
          setBookings={mockSetBookings}
          clients={currentClients}
          setClients={mockSetClients}
          packages={[]}
          user={{ role: 'admin' }}
        />
      )

      const statusSelect = screen.getByRole('combobox')
      fireEvent.change(statusSelect, { target: { value: 'Cancelled' } })

      // Change reason in modal
      const reasonSelect = screen.getAllByRole('combobox').find(sel =>
        sel.value.includes('Price too high')
      )
      expect(reasonSelect).toBeTruthy()
      fireEvent.change(reasonSelect, { target: { value: 'Destination weather / Safety concern' } })

      const confirmBtn = screen.getByRole('button', { name: /confirm cancellation/i })
      fireEvent.click(confirmBtn)

      // Verified: booking updated to Cancelled with reason
      expect(mockSetBookings).toHaveBeenCalledTimes(1)
      const updatedList = mockSetBookings.mock.calls[0][0]
      const updatedBooking = updatedList.find(b => b.id === 'BK-CHALLENGER-101')
      expect(updatedBooking.status).toBe('Cancelled')
      expect(updatedBooking.cancellationReason).toBe('Destination weather / Safety concern')

      // Verified: client profile status updated to Cancelled and audit log recorded
      expect(mockSetClients).toHaveBeenCalledTimes(1)
      expect(currentClients[0].status).toBe('Cancelled')
      expect(currentClients[0].logs[0].text).toContain('Destination weather / Safety concern')
    })

    it('handles "Other" reason option with custom input text or fallback', async () => {
      let currentBookings = [testBooking]
      const mockSetBookings = vi.fn((newBookings) => { currentBookings = newBookings })
      const mockSetClients = vi.fn()

      render(
        <BookingsPage
          bookings={currentBookings}
          setBookings={mockSetBookings}
          clients={[{ id: 'cli-ab', name: 'Aditya Birla', status: 'Active', logs: [] }]}
          setClients={mockSetClients}
          packages={[]}
          user={{ role: 'admin' }}
        />
      )

      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Cancelled' } })

      const reasonSelect = screen.getAllByRole('combobox').find(sel =>
        sel.value.includes('Price too high')
      )
      fireEvent.change(reasonSelect, { target: { value: 'Other' } })

      // Custom reason input appears
      const customInput = screen.getByPlaceholderText(/enter reason/i)
      expect(customInput).toBeInTheDocument()

      fireEvent.change(customInput, { target: { value: 'Medical visa delay for senior member' } })

      fireEvent.click(screen.getByRole('button', { name: /confirm cancellation/i }))

      expect(mockSetBookings).toHaveBeenCalledTimes(1)
      const updatedBooking = mockSetBookings.mock.calls[0][0][0]
      expect(updatedBooking.cancellationReason).toBe('Medical visa delay for senior member')
    })

    it('blocks unauthorized users without write permissions from cancelling bookings', () => {
      const mockSetBookings = vi.fn()
      const mockAddNotification = vi.fn()

      render(
        <BookingsPage
          bookings={[testBooking]}
          setBookings={mockSetBookings}
          clients={[]}
          packages={[]}
          user={{ role: 'auditor' }}
          addNotification={mockAddNotification}
        />
      )

      // For auditor, status dropdown is disabled or absent (rendered as badge)
      const selects = screen.queryAllByRole('combobox')
      const statusSelect = selects.find(s => s.value === 'Confirmed')
      expect(statusSelect).toBeUndefined()
      expect(mockSetBookings).not.toHaveBeenCalled()
    })
  })

  // =========================================================================
  // TARGET 2: Kavita client cancellation scenario
  // =========================================================================
  describe('Target 2: Kavita Client Cancellation Scenario', () => {
    it('accurately derives "Cancelled" client status and "None scheduled" next trip when all trips cancelled', () => {
      const kavitaClient = {
        id: 'CLI-KAVITA-01',
        name: 'Kavita Patel',
        email: 'kavita.patel@example.com',
        phone: '+91 98200 12345',
        status: 'Active',
        country: 'India',
        passport: { number: 'M9876543', expires: '2029-12-31', status: 'Valid' },
        logs: []
      }

      const kavitaBooking = {
        id: 'BK-KAVITA-001',
        client: 'Kavita Patel',
        package: 'Santorini Sunset Deluxe',
        amount: 320000,
        date: '2026-10-15',
        status: 'Cancelled',
        cancellationReason: 'Found alternative provider / Competitor'
      }

      render(
        <ClientsPage
          clients={[kavitaClient]}
          bookings={[kavitaBooking]}
          setClients={vi.fn()}
          user={{ role: 'admin' }}
        />
      )

      // Verified: status badge shows 'Cancelled' with rose styling
      const statusBadges = screen.getAllByText('Cancelled')
      expect(statusBadges.length).toBeGreaterThan(0)
      const roseBadge = statusBadges.find(b => b.classList.contains('text-rose-600'))
      expect(roseBadge).toBeTruthy()

      // Verified: next trip says 'None scheduled'
      expect(screen.getByText('None scheduled')).toBeInTheDocument()
      expect(screen.queryByText(/Santorini Sunset Deluxe \(2026-10-15\)/i)).not.toBeInTheDocument()
    })

    it('keeps client status "Active" and displays upcoming trip if at least one non-cancelled booking remains', () => {
      const kavitaClient = {
        id: 'CLI-KAVITA-02',
        name: 'Kavita Patel',
        email: 'kavita.patel@example.com',
        status: 'Active',
        country: 'India',
        passport: { number: 'M9876543', expires: '2029-12-31', status: 'Valid' },
        logs: []
      }

      const bookings = [
        {
          id: 'BK-KAV-1',
          client: 'Kavita Patel',
          package: 'Greek Island Hopper',
          amount: 200000,
          date: '2026-08-10',
          status: 'Cancelled',
          cancellationReason: 'Dates / Schedule mismatch'
        },
        {
          id: 'BK-KAV-2',
          client: 'Kavita Patel',
          package: 'Swiss Alps Winter Retreat',
          amount: 450000,
          date: '2026-12-20',
          status: 'Confirmed'
        }
      ]

      render(
        <ClientsPage
          clients={[kavitaClient]}
          bookings={bookings}
          setClients={vi.fn()}
          user={{ role: 'admin' }}
        />
      )

      // Active status retained
      expect(screen.getByText('Active')).toBeInTheDocument()
      // Next trip reflects the active Swiss trip, NOT the cancelled Greek trip
      expect(screen.getByText(/Swiss Alps Winter Retreat \(2026-12-20\)/i)).toBeInTheDocument()
    })

    it('reactivates client status dynamically if a previously cancelled client receives an active booking', () => {
      const kavitaClient = {
        id: 'CLI-KAVITA-03',
        name: 'Kavita Patel',
        email: 'kavita.patel@example.com',
        status: 'Cancelled', // previously marked as Cancelled
        country: 'India',
        passport: { number: 'M9876543', expires: '2029-12-31', status: 'Valid' },
        logs: []
      }

      const bookings = [
        {
          id: 'BK-KAV-OLD',
          client: 'Kavita Patel',
          package: 'Old Tour',
          amount: 100000,
          date: '2026-01-01',
          status: 'Cancelled'
        },
        {
          id: 'BK-KAV-NEW',
          client: 'Kavita Patel',
          package: 'New Adventure',
          amount: 350000,
          date: '2026-12-25',
          status: 'Confirmed'
        }
      ]

      render(
        <ClientsPage
          clients={[kavitaClient]}
          bookings={bookings}
          setClients={vi.fn()}
          user={{ role: 'admin' }}
        />
      )

      // Client status dynamically reverts to 'Active'
      expect(screen.getByText('Active')).toBeInTheDocument()
      expect(screen.getByText(/New Adventure \(2026-12-25\)/i)).toBeInTheDocument()
    })

    it('performs case-insensitive client matching for booking cancellation status aggregation', () => {
      const kavitaClient = {
        id: 'CLI-KAVITA-04',
        name: 'Kavita Patel',
        status: 'Active',
        country: 'India',
        logs: []
      }

      const bookings = [
        {
          id: 'BK-KAV-LOWER',
          client: 'kavita patel', // lowercase name in booking record
          package: 'Kerala Backwaters',
          amount: 120000,
          date: '2026-10-10',
          status: 'Cancelled',
          cancellationReason: 'Personal emergency'
        }
      ]

      render(
        <ClientsPage
          clients={[kavitaClient]}
          bookings={bookings}
          setClients={vi.fn()}
          user={{ role: 'admin' }}
        />
      )

      // Must derive Cancelled despite casing differences
      const statusBadges = screen.getAllByText('Cancelled')
      expect(statusBadges.some(b => b.classList.contains('text-rose-600'))).toBe(true)
      expect(screen.getByText('None scheduled')).toBeInTheDocument()
    })
  })

  // =========================================================================
  // TARGET 3: Itinerary Download badge in Bookings and Enquiries
  // =========================================================================
  describe('Target 3: Itinerary Download Badge Display in Bookings and Enquiries', () => {
    it('renders purple "Itinerary Download" badge in BookingsPage for leadSource, isItineraryDownload, or source', () => {
      const bookings = [
        {
          id: 'BK-DL-1',
          client: 'Rahul Dravid',
          package: 'Maldives Overwater Luxury',
          amount: 350000,
          date: '2026-11-01',
          status: 'Pending',
          leadSource: 'Itinerary Download'
        },
        {
          id: 'BK-DL-2',
          client: 'VVS Laxman',
          package: 'Dubai Desert Safari',
          amount: 150000,
          date: '2026-11-05',
          status: 'Confirmed',
          isItineraryDownload: true
        },
        {
          id: 'BK-NORM-1',
          client: 'Sourav Ganguly',
          package: 'Kashmir Autumn',
          amount: 180000,
          date: '2026-11-10',
          status: 'Paid',
          leadSource: 'Walk-in'
        }
      ]

      render(
        <BookingsPage
          bookings={bookings}
          setBookings={vi.fn()}
          clients={[]}
          packages={[]}
          user={{ role: 'admin' }}
        />
      )

      // Should render exactly 2 Itinerary Download badges
      const badges = screen.getAllByText('Itinerary Download')
      expect(badges.length).toBe(2)
      badges.forEach(badge => {
        expect(badge.className).toContain('bg-purple-100')
        expect(badge.className).toContain('text-purple-700')
      })
    })

    it('renders purple "Itinerary Download" badge in inspection drawer when row is clicked', () => {
      const booking = {
        id: 'BK-INSPECT-01',
        client: 'Kapil Dev',
        package: 'Lord’s Cricket Tour',
        amount: 500000,
        date: '2026-07-15',
        status: 'Confirmed',
        leadSource: 'Itinerary Download'
      }

      render(
        <BookingsPage
          bookings={[booking]}
          setBookings={vi.fn()}
          clients={[]}
          packages={[]}
          settings={{ depositPercent: 30, markupPercent: 15 }}
          user={{ role: 'admin' }}
        />
      )

      // Click row to inspect
      fireEvent.click(screen.getByText('Kapil Dev'))

      // Badges should now appear in table AND drawer
      const badges = screen.getAllByText('Itinerary Download')
      expect(badges.length).toBeGreaterThanOrEqual(2)
    })

    it('renders purple "Itinerary Download" badge in EnquiriesPage', async () => {
      const mockEnquiries = [
        {
          id: 'ENQ-DL-001',
          name: 'Ananya Roy',
          email: 'ananya@example.com',
          destination: 'Japan Cherry Blossom',
          travelDate: '2027-04-01',
          guests: 2,
          status: 'logged',
          leadSource: 'Itinerary Download',
          submittedAt: '2026-10-25'
        },
        {
          id: 'ENQ-NORM-002',
          name: 'Vikram Seth',
          email: 'vikram@example.com',
          destination: 'Italy Discovery',
          travelDate: '2027-05-10',
          guests: 3,
          status: 'contacted',
          leadSource: 'LinkedIn',
          submittedAt: '2026-10-26'
        }
      ]

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        if (url.includes('/api/enquiries')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: mockEnquiries })
          }
        }
        return { ok: true, status: 200, json: async () => ({}) }
      })

      render(
        <EnquiriesPage
          API_URL="http://localhost:5000"
          authHeaders={() => ({})}
          user={{ role: 'admin' }}
        />
      )

      await waitFor(() => {
        const badges = screen.getAllByText('Itinerary Download')
        expect(badges.length).toBeGreaterThanOrEqual(1)
      })
    })
  })

  // =========================================================================
  // TARGET 4: Lead Source dropdown and conditional Referral Name in Create Enquiry modal
  // =========================================================================
  describe('Target 4: Lead Source & Conditional Referral Name Input', () => {
    it('contains all 7 lead sources and toggles Referral Name input conditionally', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: [] })
      })

      render(
        <EnquiriesPage
          API_URL="http://localhost:5000"
          authHeaders={() => ({})}
          user={{ role: 'admin' }}
        />
      )

      await waitFor(() => {
        expect(screen.queryByText(/loading enquiries/i)).not.toBeInTheDocument()
      })

      // Click "Create Enquiry" button
      const createBtn = screen.getByRole('button', { name: /create enquiry/i })
      fireEvent.click(createBtn)

      // Modal open
      const leadSourceSelect = screen.getByLabelText(/lead acquisition source/i)
      expect(leadSourceSelect).toBeInTheDocument()

      const expectedOptions = [
        'Instagram',
        'Facebook',
        'LinkedIn',
        'Google/Search',
        'Referral',
        'Walk-in',
        'Direct/Other'
      ]
      const renderedOptions = Array.from(leadSourceSelect.querySelectorAll('option')).map(o => o.value)
      expect(renderedOptions).toEqual(expectedOptions)

      // Initially 'Instagram' -> Referral Name should NOT be in document
      expect(screen.queryByPlaceholderText(/name of referrer/i)).not.toBeInTheDocument()

      // Switch to 'Facebook' -> still not visible
      fireEvent.change(leadSourceSelect, { target: { value: 'Facebook' } })
      expect(screen.queryByPlaceholderText(/name of referrer/i)).not.toBeInTheDocument()

      // Switch to 'Referral' -> Referral Name input MUST be visible and required
      fireEvent.change(leadSourceSelect, { target: { value: 'Referral' } })
      const refInput = screen.getByPlaceholderText(/name of referrer/i)
      expect(refInput).toBeInTheDocument()
      expect(refInput).toBeRequired()

      // Switch to 'LinkedIn' -> Referral Name disappears again
      fireEvent.change(leadSourceSelect, { target: { value: 'LinkedIn' } })
      expect(screen.queryByPlaceholderText(/name of referrer/i)).not.toBeInTheDocument()
    })

    it('submits leadSource and trimmed referralName to API and resets modal properly', async () => {
      let postedBody = null
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, opts) => {
        if (url.includes('/api/enquiries/submit')) {
          postedBody = JSON.parse(opts.body)
          return {
            ok: true,
            status: 201,
            json: async () => ({
              message: 'Enquiry created successfully',
              data: {
                id: 'ENQ-NEW-01',
                ...postedBody
              }
            })
          }
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [] })
        }
      })

      render(
        <EnquiriesPage
          API_URL="http://localhost:5000"
          authHeaders={() => ({})}
          user={{ role: 'admin' }}
          clients={[{ id: 'CLI-01', name: 'Manish Pandey' }]}
        />
      )

      await waitFor(() => {
        expect(screen.queryByText(/loading enquiries/i)).not.toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /create enquiry/i }))

      // Select existing client
      const clientSelect = screen.getByDisplayValue(/select a client/i)
      fireEvent.change(clientSelect, { target: { value: 'Manish Pandey' } })

      // Enter destination and date
      const destInput = screen.getByPlaceholderText(/e\.g\. bali, indonesia/i)
      fireEvent.change(destInput, { target: { value: 'Switzerland Summer' } })
      const form = destInput.closest('form')
      const dateInput = form.querySelector('input[type="date"]')
      fireEvent.change(dateInput, { target: { value: '2026-07-15' } })

      // Switch to Referral
      const leadSourceSelect = screen.getByLabelText(/lead acquisition source/i)
      fireEvent.change(leadSourceSelect, { target: { value: 'Referral' } })

      const refInput = screen.getByPlaceholderText(/name of referrer/i)
      fireEvent.change(refInput, { target: { value: '  Deepak Chahar  ' } })

      // Submit
      const submitBtn = screen.getByRole('button', { name: /submit enquiry/i })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(postedBody).toBeTruthy()
      })

      expect(postedBody.leadSource).toBe('Referral')
      expect(postedBody.referralName).toBe('Deepak Chahar') // trimmed!
    })
  })

  // =========================================================================
  // TARGET 5: Excel export: test date filtering, export .xlsx structure, column formatting
  // =========================================================================
  describe('Target 5: Enquiries Excel Export & Date Range Filtering', () => {
    const testEnquiries = [
      {
        id: 'ENQ-SEPT-01',
        name: 'Pooja Hegde',
        email: 'pooja@example.com',
        phone: '+91 9988776655',
        destination: 'Bali Romance',
        travelDate: '2026-09-10',
        guests: 2,
        status: 'converted',
        leadSource: 'Referral',
        referralName: 'Kunal Kapoor',
        notes: 'Ocean view suite requested',
        submittedAt: '2026-09-01T10:00:00Z'
      },
      {
        id: 'ENQ-OCT-02',
        name: 'Ramesh Powar',
        email: 'ramesh@example.com',
        phone: '+91 9123456789',
        destination: 'Australia Outback',
        travelDate: '2026-10-15',
        guests: 4,
        status: 'logged',
        leadSource: 'Instagram',
        referralName: null,
        notes: '',
        submittedAt: '2026-10-05T12:00:00Z'
      },
      {
        id: 'ENQ-NOV-03',
        name: 'Suresh Raina',
        email: 'suresh@example.com',
        phone: '+91 9876501234',
        destination: 'Iceland Aurora',
        travelDate: '2026-11-20',
        guests: 2,
        status: 'contacted',
        leadSource: 'Google/Search',
        referralName: null,
        notes: 'Looking for photography guide',
        submittedAt: '2026-11-10T08:00:00Z'
      }
    ]

    it('filters exported enquiries strictly by date range and formats all columns', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: testEnquiries })
      })

      render(
        <EnquiriesPage
          API_URL="http://localhost:5000"
          authHeaders={() => ({})}
          user={{ role: 'admin' }}
        />
      )

      await waitFor(() => {
        expect(screen.queryByText(/loading enquiries/i)).not.toBeInTheDocument()
      })

      // Set From Date to '2026-10-01' and To Date to '2026-10-31'
      const fromInput = screen.getByLabelText(/filter from date/i)
      const toInput = screen.getByLabelText(/filter to date/i)

      fireEvent.change(fromInput, { target: { value: '2026-10-01' } })
      fireEvent.change(toInput, { target: { value: '2026-10-31' } })

      // Export to Excel
      const exportBtn = screen.getByRole('button', { name: /export to excel/i })
      fireEvent.click(exportBtn)

      expect(capturedFilename).toBe('kraft_enquiries_report.xlsx')
      expect(capturedWb).toBeTruthy()
      expect(capturedWb.SheetNames).toContain('Enquiries')

      const sheet = capturedWb.Sheets['Enquiries']
      const rows = XLSX.utils.sheet_to_json(sheet)

      // Only October enquiry should be exported
      expect(rows.length).toBe(1)
      expect(rows[0]['Enquiry ID']).toBe('ENQ-OCT-02')
      expect(rows[0]['Customer Name']).toBe('Ramesh Powar')
      expect(rows[0]['Email']).toBe('ramesh@example.com')
      expect(rows[0]['Phone']).toBe('+91 9123456789')
      expect(rows[0]['Destination']).toBe('Australia Outback')
      expect(rows[0]['Lead Source']).toBe('Instagram')
      expect(rows[0]['Referral Name']).toBe('—')
    })

    it('exports all 12 columns with appropriate default fallbacks', async () => {
      const singleEnquiry = [
        {
          id: 'ENQ-DEF-01',
          name: 'Irfan Pathan',
          email: 'irfan@example.com',
          phone: null,
          destination: 'Dubai Expo',
          travelDate: '2026-12-01',
          guests: 1,
          status: 'logged',
          leadSource: null,
          isItineraryDownload: true,
          referralName: null,
          notes: null,
          submittedAt: '2026-11-01'
        }
      ]

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: singleEnquiry })
      })

      render(
        <EnquiriesPage
          API_URL="http://localhost:5000"
          authHeaders={() => ({})}
          user={{ role: 'admin' }}
        />
      )

      await waitFor(() => {
        expect(screen.queryByText(/loading enquiries/i)).not.toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /export to excel/i }))

      const sheet = capturedWb.Sheets['Enquiries']
      const rows = XLSX.utils.sheet_to_json(sheet)
      expect(rows.length).toBe(1)
      expect(rows[0]['Phone']).toBe('—')
      expect(rows[0]['Lead Source']).toBe('Itinerary Download')
      expect(rows[0]['Referral Name']).toBe('—')
    })
  })

  // =========================================================================
  // TARGET 6: Reports date filtering and 'Download Full Report' (.xlsx) with all 5 sheets
  // =========================================================================
  describe('Target 6: Reports Date Filtering & Full 5-Sheet Excel Export', () => {
    const reportBookings = [
      {
        id: 'BK-REP-01',
        client: 'Priyanka Chopra',
        package: 'New York City Lights',
        amount: 500000,
        date: '2026-06-15',
        status: 'Paid',
        agent: 'Rajesh',
        leadSource: 'Instagram'
      },
      {
        id: 'BK-REP-02',
        client: 'Kavita Patel',
        package: 'Santorini Sunset Deluxe',
        amount: 320000,
        date: '2026-06-20',
        status: 'Cancelled',
        cancellationReason: 'Dates / Schedule mismatch',
        agent: 'Priya',
        leadSource: 'Referral'
      },
      {
        id: 'BK-REP-03',
        client: 'Ranbir Kapoor',
        package: 'Swiss Alps Winter Retreat',
        amount: 450000,
        date: '2026-08-10',
        status: 'Confirmed',
        agent: 'Rajesh',
        leadSource: 'LinkedIn'
      }
    ]

    const reportEnquiries = [
      {
        id: 'ENQ-REP-01',
        name: 'Alia Bhatt',
        email: 'alia@example.com',
        destination: 'Paris Luxury Weekend',
        travelDate: '2026-06-25',
        guests: 2,
        status: 'converted',
        leadSource: 'Instagram',
        submittedAt: '2026-06-10'
      },
      {
        id: 'ENQ-REP-02',
        name: 'Varun Dhawan',
        email: 'varun@example.com',
        destination: 'Dubai Adventure',
        travelDate: '2026-08-15',
        guests: 4,
        status: 'logged',
        leadSource: 'Google/Search',
        submittedAt: '2026-08-01'
      }
    ]

    it('downloads complete 5-sheet workbook with all required sheets and metrics', () => {
      render(
        <ReportsPage
          bookings={reportBookings}
          enquiries={reportEnquiries}
          token="test-token"
          API_URL="http://localhost:5000"
          addNotification={vi.fn()}
        />
      )

      // Filter to June 2026 using start / end date filters
      const fromInput = screen.getByLabelText(/start date filter/i)
      const toInput = screen.getByLabelText(/end date filter/i)
      fireEvent.change(fromInput, { target: { value: '2026-06-01' } })
      fireEvent.change(toInput, { target: { value: '2026-06-30' } })

      // Click "Download Full Report (.xlsx)"
      const downloadBtn = screen.getByRole('button', { name: /download full report/i })
      fireEvent.click(downloadBtn)

      expect(capturedFilename).toMatch(/kraft_full_executive_report_\d{4}-\d{2}-\d{2}\.xlsx/)
      expect(capturedWb).toBeTruthy()

      // Verify all 5 sheets exist with exact expected titles
      const expectedSheets = [
        'Executive Summary',
        'Lost Queries Breakdown',
        'Acquisition Channels',
        'Bookings Detail',
        'Enquiries Detail'
      ]
      expect(capturedWb.SheetNames).toEqual(expectedSheets)

      // Inspect Sheet 1: Executive Summary
      const summaryRows = XLSX.utils.sheet_to_json(capturedWb.Sheets['Executive Summary'])
      const metricMap = Object.fromEntries(summaryRows.map(r => [r.Metric, r.Value]))
      // In June: BK-REP-01 (Paid), BK-REP-02 (Cancelled), ENQ-REP-01 (converted) => 3 total queries
      expect(metricMap['Total Queries / Leads Received']).toBe(3)
      expect(metricMap['Confirmed Bookings']).toBe(1)
      expect(metricMap['Lost Queries / Cancellations']).toBe(1)
      expect(metricMap['Gross Sales Revenue (INR)']).toBe(500000)
      expect(metricMap['Total Lost Revenue (INR)']).toBe(320000)

      // Inspect Sheet 2: Lost Queries Breakdown
      const lostRows = XLSX.utils.sheet_to_json(capturedWb.Sheets['Lost Queries Breakdown'])
      expect(lostRows.length).toBe(1)
      expect(lostRows[0]['Cancellation Reason']).toBe('Dates / Schedule mismatch')
      expect(lostRows[0]['Lost Lead Count']).toBe(1)
      expect(lostRows[0]['Lost Revenue (INR)']).toBe(320000)

      // Inspect Sheet 3: Acquisition Channels
      const channelRows = XLSX.utils.sheet_to_json(capturedWb.Sheets['Acquisition Channels'])
      expect(channelRows.length).toBeGreaterThan(0)
      const igChannel = channelRows.find(c => c['Acquisition Channel'] === 'Instagram')
      expect(igChannel).toBeTruthy()

      // Inspect Sheet 4: Bookings Detail
      const bookingRows = XLSX.utils.sheet_to_json(capturedWb.Sheets['Bookings Detail'])
      expect(bookingRows.length).toBe(2)
      expect(bookingRows.map(b => b['Booking ID'])).toEqual(['BK-REP-01', 'BK-REP-02'])

      // Inspect Sheet 5: Enquiries Detail
      const enquiryRows = XLSX.utils.sheet_to_json(capturedWb.Sheets['Enquiries Detail'])
      expect(enquiryRows.length).toBe(1)
      expect(enquiryRows[0]['Enquiry ID']).toBe('ENQ-REP-01')
    })

    it('gracefully generates fallback rows when date range yields 0 records', () => {
      render(
        <ReportsPage
          bookings={reportBookings}
          enquiries={reportEnquiries}
          token="test-token"
          API_URL="http://localhost:5000"
          addNotification={vi.fn()}
        />
      )

      // Future date with 0 records
      const fromInput = screen.getByLabelText(/start date filter/i)
      const toInput = screen.getByLabelText(/end date filter/i)
      fireEvent.change(fromInput, { target: { value: '2029-01-01' } })
      fireEvent.change(toInput, { target: { value: '2029-01-31' } })

      fireEvent.click(screen.getByRole('button', { name: /download full report/i }))

      expect(capturedWb.SheetNames).toEqual([
        'Executive Summary',
        'Lost Queries Breakdown',
        'Acquisition Channels',
        'Bookings Detail',
        'Enquiries Detail'
      ])

      // Fallback row in Lost Queries Breakdown
      const lostRows = XLSX.utils.sheet_to_json(capturedWb.Sheets['Lost Queries Breakdown'])
      expect(lostRows[0]['Cancellation Reason']).toBe('No cancellations in period')
      expect(lostRows[0]['Lost Lead Count']).toBe(0)

      // Fallback row in Bookings Detail
      const bkRows = XLSX.utils.sheet_to_json(capturedWb.Sheets['Bookings Detail'])
      expect(bkRows[0]['Booking ID']).toBe('None')
    })
  })
})

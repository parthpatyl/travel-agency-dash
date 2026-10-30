import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Mock XLSX to intercept workbook and sheet contents
let capturedWorkbook = null
let capturedFilename = null
const writeFileMock = vi.fn((wb, fn) => {
  capturedWorkbook = wb
  capturedFilename = fn
})

vi.mock('xlsx', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    writeFile: (...args) => writeFileMock(...args),
  }
})

// Polyfill localStorage
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

import BookingsPage from '../components/BookingsPage'
import ClientsPage from '../components/ClientsPage'
import EnquiriesPage from '../components/EnquiriesPage'
import ReportsPage from '../components/ReportsPage'
import XLSX from 'xlsx'

describe('Empirical Verification Suite — Milestone 3 (Challenger Verification)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    writeFileMock.mockClear()
    capturedWorkbook = null
    capturedFilename = null
  })

  // =========================================================================
  // MISSION TARGET 1: Cancellation Reasons Prompt Modal
  // =========================================================================
  describe('Mission 1: Cancellation Reasons Prompt Modal', () => {
    const sampleBooking = {
      id: 'BK-TEST-001',
      client: 'Sunil Gavaskar',
      package: 'Kashmir Autumn Splendor',
      amount: 180000,
      date: '2026-09-15',
      status: 'Pending',
      guests: 2
    }

    it('blocks immediate cancellation on quick status change and displays cancellation prompt modal', async () => {
      const mockSetBookings = vi.fn()
      const mockSetClients = vi.fn()

      render(
        <BookingsPage
          bookings={[sampleBooking]}
          setBookings={mockSetBookings}
          clients={[{ id: 'cli-sunil', name: 'Sunil Gavaskar', status: 'Active', logs: [] }]}
          setClients={mockSetClients}
          packages={[]}
          user={{ role: 'admin' }}
        />
      )

      // Find status select dropdown
      const statusSelect = screen.getByRole('combobox')
      fireEvent.change(statusSelect, { target: { value: 'Cancelled' } })

      // Immediate booking status change should be BLOCKED (setBookings not yet called with Cancelled)
      expect(mockSetBookings).not.toHaveBeenCalled()

      // Modal should appear
      expect(screen.getByText(/cancel booking #bk-test-001/i)).toBeInTheDocument()
      expect(screen.getByText(/client: sunil gavaskar/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /keep booking/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /confirm cancellation/i })).toBeInTheDocument()
    })

    it('dismisses modal without cancelling when "Keep Booking" is clicked', async () => {
      const mockSetBookings = vi.fn()

      render(
        <BookingsPage
          bookings={[sampleBooking]}
          setBookings={mockSetBookings}
          clients={[]}
          packages={[]}
          user={{ role: 'admin' }}
        />
      )

      const statusSelect = screen.getByRole('combobox')
      fireEvent.change(statusSelect, { target: { value: 'Cancelled' } })

      const keepBtn = screen.getByRole('button', { name: /keep booking/i })
      fireEvent.click(keepBtn)

      // Modal should close
      expect(screen.queryByText(/cancel booking #bk-test-001/i)).not.toBeInTheDocument()
      // Booking was not cancelled
      expect(mockSetBookings).not.toHaveBeenCalled()
    })

    it('persists selected cancellation reason and updates booking and client when confirmed', async () => {
      let currentBookings = [sampleBooking]
      const mockSetBookings = vi.fn((newVal) => { currentBookings = newVal })
      const mockSetClients = vi.fn()

      render(
        <BookingsPage
          bookings={currentBookings}
          setBookings={mockSetBookings}
          clients={[{ id: 'cli-sunil', name: 'Sunil Gavaskar', status: 'Active', logs: [] }]}
          setClients={mockSetClients}
          packages={[]}
          user={{ role: 'admin' }}
        />
      )

      const statusSelect = screen.getByRole('combobox')
      fireEvent.change(statusSelect, { target: { value: 'Cancelled' } })

      // Select reason: 'Dates / Schedule mismatch'
      const modalSelect = screen.getByRole('dialog').querySelector('select')
      fireEvent.change(modalSelect, { target: { value: 'Dates / Schedule mismatch' } })

      const confirmBtn = screen.getByRole('button', { name: /confirm cancellation/i })
      fireEvent.click(confirmBtn)

      await waitFor(() => {
        expect(mockSetBookings).toHaveBeenCalled()
        const updatedBookings = mockSetBookings.mock.calls[0][0]
        const updated = updatedBookings.find(b => b.id === 'BK-TEST-001')
        expect(updated.status).toBe('Cancelled')
        expect(updated.cancellationReason).toBe('Dates / Schedule mismatch')
      })

      // setClients should be synchronized
      expect(mockSetClients).toHaveBeenCalled()
    })

    it('allows "Other" custom reason and falls back gracefully if custom text is omitted', async () => {
      const mockSetBookings = vi.fn()

      render(
        <BookingsPage
          bookings={[sampleBooking]}
          setBookings={mockSetBookings}
          clients={[]}
          packages={[]}
          user={{ role: 'admin' }}
        />
      )

      const statusSelect = screen.getByRole('combobox')
      fireEvent.change(statusSelect, { target: { value: 'Cancelled' } })

      // Choose "Other"
      const modalSelect = screen.getByRole('dialog').querySelector('select')
      fireEvent.change(modalSelect, { target: { value: 'Other' } })

      // Input should appear
      const customInput = screen.getByPlaceholderText(/enter reason/i)
      expect(customInput).toBeInTheDocument()

      // Enter custom text
      fireEvent.change(customInput, { target: { value: 'Client relocated to Singapore' } })
      const confirmBtn = screen.getByRole('button', { name: /confirm cancellation/i })
      fireEvent.click(confirmBtn)

      await waitFor(() => {
        const updated = mockSetBookings.mock.calls[0][0][0]
        expect(updated.cancellationReason).toBe('Client relocated to Singapore')
      })
    })

    it('prevents non-authorized users without write permission from triggering cancellation', async () => {
      const mockNotification = vi.fn()
      const mockSetBookings = vi.fn()

      render(
        <BookingsPage
          bookings={[sampleBooking]}
          setBookings={mockSetBookings}
          clients={[]}
          packages={[]}
          user={{ role: 'viewer' }} // Read-only role
          addNotification={mockNotification}
        />
      )

      // In viewer mode, status dropdown is not editable
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
      expect(screen.queryByText(/cancel booking/i)).not.toBeInTheDocument()
    })
  })

  // =========================================================================
  // MISSION TARGET 2: Kavita Client Cancellation Scenario
  // =========================================================================
  describe('Mission 2: Kavita Client Cancellation Scenario', () => {
    const kavitaClient = {
      id: 'cli-kavita-789',
      name: 'Kavita',
      email: 'kavita@example.com',
      phone: '+91 98765 43210',
      status: 'Active',
      tier: 'Gold',
      passport: { number: 'M9876543', expires: '2028-12-31', status: 'Valid' },
      historicalBookingsCount: 0,
      historicalLtv: 0,
      logs: []
    }

    it('client profile reflects "Cancelled" status and nextTrip "None scheduled" when all bookings are cancelled', () => {
      const kavitaBookings = [
        {
          id: 'BK-KAV-1',
          client: 'Kavita',
          package: 'Greek Odyssey',
          amount: 220000,
          date: '2026-11-20',
          status: 'Cancelled',
          cancellationReason: 'Personal emergency / Health reasons'
        }
      ]

      render(
        <ClientsPage
          clients={[kavitaClient]}
          bookings={kavitaBookings}
          setClients={vi.fn()}
          user={{ role: 'admin' }}
        />
      )

      // Kavita in list
      expect(screen.getByText('Kavita')).toBeInTheDocument()
      // Status shown as Cancelled
      const cancelledBadges = screen.getAllByText('Cancelled')
      expect(cancelledBadges.length).toBeGreaterThan(0)
      // Next trip displays 'None scheduled'
      expect(screen.getByText('None scheduled')).toBeInTheDocument()
    })

    it('full profile workspace for Kavita shows Cancelled status and None scheduled next trip', () => {
      const kavitaBookings = [
        {
          id: 'BK-KAV-1',
          client: 'Kavita',
          package: 'Greek Odyssey',
          amount: 220000,
          date: '2026-11-20',
          status: 'Cancelled',
          cancellationReason: 'Personal emergency / Health reasons'
        }
      ]

      render(
        <ClientsPage
          clients={[kavitaClient]}
          bookings={kavitaBookings}
          initialSelectedClientId="cli-kavita-789"
          setClients={vi.fn()}
          user={{ role: 'admin' }}
        />
      )

      // In full workspace view
      expect(screen.getByText('Back to All Clients')).toBeInTheDocument()
      expect(screen.getByText('Kavita')).toBeInTheDocument()
      // Status label in header
      expect(screen.getByText(/Status:/i)).toBeInTheDocument()
      const cancelledBadges = screen.getAllByText('Cancelled')
      expect(cancelledBadges.some(b => b.classList.contains('text-rose-600'))).toBe(true)
    })

    it('retains "Active" status if Kavita retains at least one active upcoming booking', () => {
      const mixedBookings = [
        {
          id: 'BK-KAV-1',
          client: 'Kavita',
          package: 'Greek Odyssey',
          amount: 220000,
          date: '2026-08-10',
          status: 'Cancelled',
          cancellationReason: 'Dates mismatch'
        },
        {
          id: 'BK-KAV-2',
          client: 'Kavita',
          package: 'Japanese Winter Wonders',
          amount: 350000,
          date: '2026-12-15',
          status: 'Confirmed'
        }
      ]

      render(
        <ClientsPage
          clients={[kavitaClient]}
          bookings={mixedBookings}
          setClients={vi.fn()}
          user={{ role: 'admin' }}
        />
      )

      expect(screen.getByText('Kavita')).toBeInTheDocument()
      expect(screen.getByText('Active')).toBeInTheDocument()
      expect(screen.getByText(/Japanese Winter Wonders \(2026-12-15\)/i)).toBeInTheDocument()
    })

    it('cancelling Kavita booking in BookingsPage synchronizes client status and appends cancellation audit log', async () => {
      let clientState = [{ ...kavitaClient }]
      const setClientsMock = vi.fn((updateFn) => {
        clientState = updateFn(clientState)
      })

      const kavitaActiveBooking = {
        id: 'BK-KAV-ACTIVE',
        client: 'Kavita',
        package: 'Dubai Luxury Getaway',
        amount: 140000,
        date: '2026-10-05',
        status: 'Pending'
      }

      render(
        <BookingsPage
          bookings={[kavitaActiveBooking]}
          setBookings={vi.fn()}
          clients={clientState}
          setClients={setClientsMock}
          packages={[]}
          user={{ role: 'admin' }}
        />
      )

      const statusSelect = screen.getByRole('combobox')
      fireEvent.change(statusSelect, { target: { value: 'Cancelled' } })

      const confirmBtn = screen.getByRole('button', { name: /confirm cancellation/i })
      fireEvent.click(confirmBtn)

      await waitFor(() => {
        expect(setClientsMock).toHaveBeenCalled()
      })

      // Check synchronized client status and audit log
      expect(clientState[0].status).toBe('Cancelled')
      expect(clientState[0].logs.length).toBeGreaterThan(0)
      expect(clientState[0].logs[0].text).toContain('Booking BK-KAV-ACTIVE cancelled')
      expect(clientState[0].logs[0].text).toContain('Reason: Price too high / Budget constraints')
    })
  })

  // =========================================================================
  // MISSION TARGET 3: Itinerary Download Badge in Bookings and Enquiries
  // =========================================================================
  describe('Mission 3: Itinerary Download Badge in Bookings and Enquiries', () => {
    it('renders "Itinerary Download" badge in Bookings table for leadSource "Itinerary Download" and variants', () => {
      const bookingsWithSources = [
        { id: 'B1', client: 'Alpha User', package: 'Pkg A', amount: 10000, date: '2026-07-01', status: 'Pending', leadSource: 'Itinerary Download' },
        { id: 'B2', client: 'Beta User', package: 'Pkg B', amount: 20000, date: '2026-07-02', status: 'Pending', isItineraryDownload: true },
        { id: 'B3', client: 'Gamma User', package: 'Pkg C', amount: 30000, date: '2026-07-03', status: 'Pending', source: 'itinerary_download' },
        { id: 'B4', client: 'Delta User', package: 'Pkg D', amount: 40000, date: '2026-07-04', status: 'Pending', leadSource: 'Instagram' }
      ]

      render(
        <BookingsPage
          bookings={bookingsWithSources}
          setBookings={vi.fn()}
          clients={[]}
          packages={[]}
          user={{ role: 'admin' }}
        />
      )

      // Should have 3 badges for B1, B2, B3 and NONE for B4
      const badges = screen.getAllByText('Itinerary Download')
      expect(badges.length).toBe(3)

      // Delta User should not have the badge
      const deltaRow = screen.getByText('Delta User').closest('tr')
      expect(deltaRow).not.toHaveTextContent('Itinerary Download')
    })

    it('renders "Itinerary Download" badge in Enquiries table for leadSource "Itinerary Download"', async () => {
      const enquiriesWithSources = [
        { id: 'E1', name: 'Leila Croft', email: 'leila@tomb.com', destination: 'Egypt', travelDate: '2026-10-01', guests: 2, status: 'logged', leadSource: 'Itinerary Download' },
        { id: 'E2', name: 'Nathan Drake', email: 'nathan@uncharted.com', destination: 'Madagascar', travelDate: '2026-11-01', guests: 1, status: 'logged', leadSource: 'Google/Search' }
      ]

      vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ data: enquiriesWithSources })
        })
      )

      render(
        <EnquiriesPage
          API_URL="http://localhost:5000"
          authHeaders={() => ({})}
          clients={[]}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Leila Croft')).toBeInTheDocument()
        expect(screen.getByText('Nathan Drake')).toBeInTheDocument()
      })

      // Leila Croft should have Itinerary Download badge
      const leilaRow = screen.getByText('Leila Croft').closest('tr')
      expect(leilaRow).toHaveTextContent('Itinerary Download')

      // Nathan Drake should NOT have Itinerary Download badge
      const nathanRow = screen.getByText('Nathan Drake').closest('tr')
      expect(nathanRow).not.toHaveTextContent('Itinerary Download')
      expect(nathanRow).toHaveTextContent('Google/Search')
    })
  })

  // =========================================================================
  // MISSION TARGET 4: Lead Source & Conditional Referral Name in Create Enquiry
  // =========================================================================
  describe('Mission 4: Lead Source Dropdown & Conditional Referral Name', () => {
    it('Create Enquiry modal contains all 7 Lead Acquisition Source options', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ data: [] })
        })
      )

      render(
        <EnquiriesPage
          API_URL="http://localhost:5000"
          authHeaders={() => ({})}
          clients={[{ id: 'c1', name: 'Vijay Mallya', email: 'vm@example.com' }]}
        />
      )

      await waitFor(() => {
        expect(screen.queryByText(/loading enquiries/i)).not.toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Create Enquiry'))

      const select = screen.getByLabelText(/lead acquisition source/i)
      expect(select).toBeInTheDocument()

      const expectedOptions = [
        'Instagram',
        'Facebook',
        'LinkedIn',
        'Google/Search',
        'Referral',
        'Walk-in',
        'Direct/Other'
      ]

      const actualOptions = Array.from(select.querySelectorAll('option')).map(o => o.value)
      expect(actualOptions).toEqual(expectedOptions)
    })

    it('conditionally reveals Referral Name input ONLY when Referral is chosen', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ data: [] })
        })
      )

      render(
        <EnquiriesPage
          API_URL="http://localhost:5000"
          authHeaders={() => ({})}
          clients={[{ id: 'c1', name: 'Vijay Mallya', email: 'vm@example.com' }]}
        />
      )

      await waitFor(() => {
        expect(screen.queryByText(/loading enquiries/i)).not.toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Create Enquiry'))

      const select = screen.getByLabelText(/lead acquisition source/i)

      // Default is Instagram -> no referral name input
      expect(screen.queryByPlaceholderText(/name of referrer/i)).not.toBeInTheDocument()

      // Change to Facebook -> still no referral name
      fireEvent.change(select, { target: { value: 'Facebook' } })
      expect(screen.queryByPlaceholderText(/name of referrer/i)).not.toBeInTheDocument()

      // Change to Referral -> referral name input appears and is required
      fireEvent.change(select, { target: { value: 'Referral' } })
      const refInput = screen.getByPlaceholderText(/name of referrer/i)
      expect(refInput).toBeInTheDocument()
      expect(refInput).toBeRequired()

      // Change back to Walk-in -> referral name input disappears
      fireEvent.change(select, { target: { value: 'Walk-in' } })
      expect(screen.queryByPlaceholderText(/name of referrer/i)).not.toBeInTheDocument()
    })

    it('submits leadSource and referralName to API and renders in enquiries list', async () => {
      let submitPayload = null
      vi.spyOn(globalThis, 'fetch').mockImplementation((url, opts) => {
        if (url.includes('/api/enquiries/submit')) {
          submitPayload = JSON.parse(opts.body)
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                id: 'ENQ-NEW-123',
                ...submitPayload,
                status: 'logged',
                submittedAt: new Date().toISOString()
              }
            })
          })
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] })
        })
      })

      render(
        <EnquiriesPage
          API_URL="http://localhost:5000"
          authHeaders={() => ({})}
          clients={[{ id: 'c1', name: 'Deepak Chopra', email: 'deepak@wellness.com' }]}
        />
      )

      await waitFor(() => {
        expect(screen.queryByText(/loading enquiries/i)).not.toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Create Enquiry'))

      // Select existing client Deepak Chopra
      const modal = screen.getByRole('dialog')
      const clientSelect = modal.querySelector('select')
      fireEvent.change(clientSelect, { target: { value: 'Deepak Chopra' } })

      // Enter destination
      const destInput = screen.getByPlaceholderText(/e\.g\. Bali/i)
      fireEvent.change(destInput, { target: { value: 'Himalayan Retreat' } })

      // Enter date
      const dateInput = modal.querySelector('input[type="date"]')
      fireEvent.change(dateInput, { target: { value: '2026-10-15' } })

      // Enter guests
      const guestsInput = modal.querySelector('input[type="number"]')
      fireEvent.change(guestsInput, { target: { value: '3' } })

      // Select Lead Source = Referral
      const sourceSelect = screen.getByLabelText(/lead acquisition source/i)
      fireEvent.change(sourceSelect, { target: { value: 'Referral' } })

      // Enter Referral Name
      const refInput = screen.getByPlaceholderText(/name of referrer/i)
      fireEvent.change(refInput, { target: { value: 'Anand Mahindra' } })

      // Submit form
      const submitBtn = screen.getByRole('button', { name: /submit enquiry/i })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(submitPayload).not.toBeNull()
        expect(submitPayload.leadSource).toBe('Referral')
        expect(submitPayload.referralName).toBe('Anand Mahindra')
        expect(submitPayload.destination).toBe('Himalayan Retreat')
      })

      // The new enquiry should be listed in the table with "via Anand Mahindra"
      await waitFor(() => {
        expect(screen.getByText('via Anand Mahindra')).toBeInTheDocument()
      })
    })
  })

  // =========================================================================
  // MISSION TARGET 5: Enquiries Excel Export (.xlsx) & Date Filtering
  // =========================================================================
  describe('Mission 5: Enquiries Excel Export (.xlsx) & Date Filtering', () => {
    const enquiriesBatch = [
      {
        id: 'ENQ-MAY-1',
        name: 'May Person',
        email: 'may@example.com',
        phone: '+91 99999 11111',
        destination: 'Paris',
        travelDate: '2026-05-15',
        guests: 2,
        status: 'logged',
        leadSource: 'Instagram',
        referralName: '',
        submittedAt: '2026-05-10'
      },
      {
        id: 'ENQ-JUN-1',
        name: 'June Person',
        email: 'june@example.com',
        phone: '+91 99999 22222',
        destination: 'London',
        travelDate: '2026-06-20',
        guests: 4,
        status: 'proposing',
        leadSource: 'Referral',
        referralName: 'May Person',
        submittedAt: '2026-06-05'
      },
      {
        id: 'ENQ-JUL-1',
        name: 'July Person',
        email: 'july@example.com',
        phone: '+91 99999 33333',
        destination: 'Tokyo',
        travelDate: '2026-07-25',
        guests: 1,
        status: 'converted',
        leadSource: 'Google/Search',
        referralName: '',
        submittedAt: '2026-07-01'
      }
    ]

    it('filters enquiries table and exported rows by date bounds', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ data: enquiriesBatch })
        })
      )

      render(
        <EnquiriesPage
          API_URL="http://localhost:5000"
          authHeaders={() => ({})}
          clients={[]}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('May Person')).toBeInTheDocument()
        expect(screen.getByText('June Person')).toBeInTheDocument()
        expect(screen.getByText('July Person')).toBeInTheDocument()
      })

      // EnquiriesPage date filters (using aria-label)
      const fromInput = screen.getByLabelText(/filter from date/i)
      const toInput = screen.getByLabelText(/filter to date/i)

      fireEvent.change(fromInput, { target: { value: '2026-06-01' } })
      fireEvent.change(toInput, { target: { value: '2026-06-30' } })

      // May and July should be filtered out; June should remain visible
      expect(screen.queryByText('May Person')).not.toBeInTheDocument()
      expect(screen.getByText('June Person')).toBeInTheDocument()
      expect(screen.queryByText('July Person')).not.toBeInTheDocument()

      // Click Export to Excel
      const exportBtn = screen.getByRole('button', { name: /export to excel/i })
      fireEvent.click(exportBtn)

      expect(writeFileMock).toHaveBeenCalled()
      expect(capturedFilename).toBe('kraft_enquiries_report.xlsx')

      // Verify the generated workbook content
      const sheet = capturedWorkbook.Sheets['Enquiries']
      expect(sheet).toBeDefined()
      const jsonRows = XLSX.utils.sheet_to_json(sheet)
      // Exactly 1 row for June Person
      expect(jsonRows.length).toBe(1)
      expect(jsonRows[0]['Customer Name']).toBe('June Person')
      expect(jsonRows[0]['Destination']).toBe('London')
      expect(jsonRows[0]['Lead Source']).toBe('Referral')
      expect(jsonRows[0]['Referral Name']).toBe('May Person')
      expect(jsonRows[0]['Status']).toBe('Proposing')
    })

    it('exported Excel contains all required column headers', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ data: enquiriesBatch })
        })
      )

      render(
        <EnquiriesPage
          API_URL="http://localhost:5000"
          authHeaders={() => ({})}
          clients={[]}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('May Person')).toBeInTheDocument()
      })

      const exportBtn = screen.getByRole('button', { name: /export to excel/i })
      fireEvent.click(exportBtn)

      const sheet = capturedWorkbook.Sheets['Enquiries']
      const jsonRows = XLSX.utils.sheet_to_json(sheet)
      expect(jsonRows.length).toBe(3)

      const requiredHeaders = [
        'Enquiry ID',
        'Customer Name',
        'Email',
        'Phone',
        'Destination',
        'Travel Date',
        'Guests',
        'Status',
        'Lead Source',
        'Referral Name',
        'Notes',
        'Submitted At'
      ]

      const firstRowKeys = Object.keys(jsonRows[0])
      for (const h of requiredHeaders) {
        expect(firstRowKeys).toContain(h)
      }
    })
  })

  // =========================================================================
  // MISSION TARGET 6: Reports Date Filtering & 'Download Full Report' (.xlsx 5 sheets)
  // =========================================================================
  describe('Mission 6: Reports Date Filtering & Full 5-Sheet Excel Export', () => {
    const testBookings = [
      {
        id: 'BK-REP-1',
        client: 'Ramesh Gupta',
        package: 'Swiss Alps Grandeur',
        amount: 300000,
        date: '2026-06-10',
        status: 'Paid',
        leadSource: 'Instagram',
        agent: 'Priya Sharma'
      },
      {
        id: 'BK-REP-2',
        client: 'Suresh Raina',
        package: 'Maldives Private Isle',
        amount: 450000,
        date: '2026-06-25',
        status: 'Cancelled',
        cancellationReason: 'Price too high / Budget constraints',
        leadSource: 'LinkedIn',
        agent: 'Rohit Verma'
      },
      {
        id: 'BK-REP-3',
        client: 'Kapil Dev',
        package: 'Australian Outback',
        amount: 500000,
        date: '2026-08-15',
        status: 'Paid',
        leadSource: 'Referral',
        agent: 'Priya Sharma'
      }
    ]

    const testEnquiries = [
      {
        id: 'ENQ-REP-1',
        name: 'Virender Sehwag',
        email: 'viru@example.com',
        phone: '+91 99999 00000',
        destination: 'Dubai',
        travelDate: '2026-06-15',
        guests: 2,
        status: 'logged',
        leadSource: 'Instagram',
        submittedAt: '2026-06-01'
      },
      {
        id: 'ENQ-REP-2',
        name: 'Zaheer Khan',
        email: 'zak@example.com',
        phone: '+91 99999 88888',
        destination: 'Bali',
        travelDate: '2026-08-20',
        guests: 3,
        status: 'converted',
        leadSource: 'Google/Search',
        submittedAt: '2026-08-01'
      }
    ]

    it('dynamically recalculates executive metrics when date range is altered', () => {
      render(
        <ReportsPage
          bookings={testBookings}
          enquiries={testEnquiries}
          packages={[]}
          settings={{ inrToUsdRate: 85 }}
        />
      )

      // All Time: 3 bookings (1 cancelled, 2 paid) + 2 enquiries = 5 total queries
      expect(screen.getByText('5')).toBeInTheDocument()
      // Lost leads = 1
      const lostCard = screen.getByText('Lost Leads / Cancelled').closest('div')
      expect(lostCard).toHaveTextContent('1')

      // Filter to June 2026 only
      const fromInput = screen.getByLabelText(/start date filter/i)
      const toInput = screen.getByLabelText(/end date filter/i)

      fireEvent.change(fromInput, { target: { value: '2026-06-01' } })
      fireEvent.change(toInput, { target: { value: '2026-06-30' } })

      // June queries: BK-REP-1 (Paid), BK-REP-2 (Cancelled), ENQ-REP-1 = 3 total queries
      expect(screen.getByText('3')).toBeInTheDocument()
      // Gross sales in June: 300,000 (from BK-REP-1)
      const juneSales = screen.getAllByText('₹3,00,000')
      expect(juneSales.length).toBeGreaterThan(0)
    })

    it('Download Full Report exports .xlsx workbook with ALL 5 required sheets and accurate structures', () => {
      render(
        <ReportsPage
          bookings={testBookings}
          enquiries={testEnquiries}
          packages={[]}
          settings={{ inrToUsdRate: 85 }}
          addNotification={vi.fn()}
        />
      )

      const downloadBtn = screen.getByRole('button', { name: /download full report/i })
      fireEvent.click(downloadBtn)

      expect(writeFileMock).toHaveBeenCalled()
      expect(capturedFilename).toMatch(/^kraft_full_executive_report_\d{4}-\d{2}-\d{2}\.xlsx$/)

      // Verify all 5 sheets exist
      const sheetNames = capturedWorkbook.SheetNames
      expect(sheetNames).toEqual([
        'Executive Summary',
        'Lost Queries Breakdown',
        'Acquisition Channels',
        'Bookings Detail',
        'Enquiries Detail'
      ])

      // ─────────────────────────────────────────────
      // Sheet 1: Executive Summary
      const wsKpi = capturedWorkbook.Sheets['Executive Summary']
      const kpiRows = XLSX.utils.sheet_to_json(wsKpi)
      expect(kpiRows.length).toBeGreaterThanOrEqual(10)
      const kpiMap = new Map(kpiRows.map(r => [r['Metric'], r['Value']]))
      expect(kpiMap.get('Total Queries / Leads Received')).toBe(5)
      expect(kpiMap.get('Lost Queries / Cancellations')).toBe(1)
      expect(kpiMap.get('Total Lost Revenue (INR)')).toBe(450000)

      // ─────────────────────────────────────────────
      // Sheet 2: Lost Queries Breakdown
      const wsLost = capturedWorkbook.Sheets['Lost Queries Breakdown']
      const lostRows = XLSX.utils.sheet_to_json(wsLost)
      expect(lostRows.length).toBe(1)
      expect(lostRows[0]['Cancellation Reason']).toBe('Price too high / Budget constraints')
      expect(lostRows[0]['Lost Lead Count']).toBe(1)
      expect(lostRows[0]['Lost Revenue (INR)']).toBe(450000)
      expect(lostRows[0]['Share of Lost Leads (%)']).toBe('100.0%')

      // ─────────────────────────────────────────────
      // Sheet 3: Acquisition Channels
      const wsChannels = capturedWorkbook.Sheets['Acquisition Channels']
      const channelRows = XLSX.utils.sheet_to_json(wsChannels)
      expect(channelRows.length).toBeGreaterThan(0)
      const channelNames = channelRows.map(r => r['Acquisition Channel'])
      expect(channelNames).toContain('Instagram')
      expect(channelNames).toContain('LinkedIn')

      // ─────────────────────────────────────────────
      // Sheet 4: Bookings Detail
      const wsBookings = capturedWorkbook.Sheets['Bookings Detail']
      const bookingRows = XLSX.utils.sheet_to_json(wsBookings)
      expect(bookingRows.length).toBe(3)
      const bHeaders = Object.keys(bookingRows[0])
      expect(bHeaders).toContain('Booking ID')
      expect(bHeaders).toContain('Client Name')
      expect(bHeaders).toContain('Package')
      expect(bHeaders).toContain('Amount (INR)')
      expect(bHeaders).toContain('Status')
      expect(bHeaders).toContain('Cancellation Reason')
      expect(bHeaders).toContain('Lead Source')
      expect(bHeaders).toContain('Consultant / Agent')

      // ─────────────────────────────────────────────
      // Sheet 5: Enquiries Detail
      const wsEnquiries = capturedWorkbook.Sheets['Enquiries Detail']
      const enquiryRows = XLSX.utils.sheet_to_json(wsEnquiries)
      expect(enquiryRows.length).toBe(2)
      const eHeaders = Object.keys(enquiryRows[0])
      expect(eHeaders).toContain('Enquiry ID')
      expect(eHeaders).toContain('Customer Name')
      expect(eHeaders).toContain('Email')
      expect(eHeaders).toContain('Destination')
      expect(eHeaders).toContain('Travel Date')
      expect(eHeaders).toContain('Status')
      expect(eHeaders).toContain('Lead Source')
    })

    it('generates graceful placeholder rows when dataset has zero bookings/cancellations', () => {
      render(
        <ReportsPage
          bookings={[]}
          enquiries={[]}
          packages={[]}
          settings={{ inrToUsdRate: 85 }}
          addNotification={vi.fn()}
        />
      )

      const downloadBtn = screen.getByRole('button', { name: /download full report/i })
      fireEvent.click(downloadBtn)

      expect(writeFileMock).toHaveBeenCalled()

      // Sheet 2: Lost Queries Breakdown has graceful zero row
      const wsLost = capturedWorkbook.Sheets['Lost Queries Breakdown']
      const lostRows = XLSX.utils.sheet_to_json(wsLost)
      expect(lostRows.length).toBe(1)
      expect(lostRows[0]['Cancellation Reason']).toBe('No cancellations in period')
      expect(lostRows[0]['Lost Lead Count']).toBe(0)

      // Sheet 4: Bookings Detail has graceful zero row
      const wsBookings = capturedWorkbook.Sheets['Bookings Detail']
      const bookingRows = XLSX.utils.sheet_to_json(wsBookings)
      expect(bookingRows.length).toBe(1)
      expect(bookingRows[0]['Booking ID']).toBe('None')

      // Sheet 5: Enquiries Detail has graceful zero row
      const wsEnquiries = capturedWorkbook.Sheets['Enquiries Detail']
      const enquiryRows = XLSX.utils.sheet_to_json(wsEnquiries)
      expect(enquiryRows.length).toBe(1)
      expect(enquiryRows[0]['Enquiry ID']).toBe('None')
    })
  })
})

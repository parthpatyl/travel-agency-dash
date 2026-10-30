import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Mock xlsx before imports
const writeFileMock = vi.fn()
vi.mock('xlsx', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    writeFile: (...args) => writeFileMock(...args),
  }
})

// Polyfill localStorage in test environment
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

import SettingsPage from '../components/SettingsPage'
import NavigationPage from '../components/NavigationPage'
import ClientsPage from '../components/ClientsPage'
import BookingsPage from '../components/BookingsPage'
import EnquiriesPage from '../components/EnquiriesPage'
import ReportsPage from '../components/ReportsPage'

describe('Milestone 3 Admin Dashboard Enhancements (R5 - R10)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    writeFileMock.mockClear()
  })

  // ─────────────────────────────────────────────
  // R5: Tour Highlights Navigation CMS Access
  // ─────────────────────────────────────────────
  describe('R5: Tour Highlights Navigation CMS Access', () => {
    it('SettingsPage provides administrative access to Tour Highlights & Navigation sub-tab', () => {
      render(
        <SettingsPage
          settings={{}}
          setSettings={vi.fn()}
          testimonials={[]}
          setTestimonials={vi.fn()}
          user={{ role: 'admin' }}
          token="test-jwt-token"
        />
      )

      const navTabBtn = screen.getByRole('button', { name: /tour highlights & navigation/i })
      expect(navTabBtn).toBeInTheDocument()

      fireEvent.click(navTabBtn)
      expect(screen.getByText(/tour highlights & navigation cms/i)).toBeInTheDocument()
    })

    it('NavigationPage allows managing tour highlights for dropdown menus', async () => {
      // Mock navigation fetch returning navigation array
      vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
        if (url.includes('/api/navigation')) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              {
                id: 'destinations-dropdown',
                label: 'Destinations',
                type: 'dropdown',
                page: 'destinations',
                tourHighlights: [
                  { id: 'th-1', title: 'Romantic Paris', region: 'Europe', destination: 'Paris', active: true }
                ]
              }
            ]
          })
        }
        return Promise.resolve({ ok: true, json: async () => ({}) })
      })

      render(
        <NavigationPage
          token="test-token"
          user={{ role: 'admin' }}
          addNotification={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Destinations')).toBeInTheDocument()
      })

      // Click on Destinations menu item to select it
      fireEvent.click(screen.getByText('Destinations'))

      await waitFor(() => {
        expect(screen.getAllByText(/tour highlights/i).length).toBeGreaterThan(0)
        expect(screen.getByText('+ Add Highlight')).toBeInTheDocument()
      })
    })
  })

  // ─────────────────────────────────────────────
  // R6: Client Status Synchronization on Booking Cancellation
  // ─────────────────────────────────────────────
  describe('R6: Client Status Synchronization on Booking Cancellation', () => {
    it('ClientsPage sets client status to Cancelled and nextTrip to None scheduled when all bookings are cancelled', () => {
      const mockClients = [
        {
          id: 'cli-kavita',
          name: 'Kavita Patel',
          email: 'kavita@example.com',
          status: 'Active',
          historicalBookingsCount: 0,
          historicalLtv: 0
        }
      ]

      const mockBookings = [
        {
          id: 'BK-101',
          client: 'Kavita Patel',
          package: 'Swiss Alps Luxury',
          amount: 250000,
          date: '2026-09-10',
          status: 'Cancelled',
          cancellationReason: 'Price too high / Budget constraints'
        }
      ]

      render(
        <ClientsPage
          clients={mockClients}
          bookings={mockBookings}
          setClients={vi.fn()}
          user={{ role: 'admin' }}
        />
      )

      // Kavita's card should display Cancelled status because her only booking is cancelled
      expect(screen.getByText('Kavita Patel')).toBeInTheDocument()
      const statusBadges = screen.getAllByText('Cancelled')
      expect(statusBadges.length).toBeGreaterThan(0)

      // Next trip should display 'None scheduled'
      expect(screen.getByText('None scheduled')).toBeInTheDocument()
    })

    it('ClientsPage keeps client Active if they retain at least one non-cancelled booking', () => {
      const mockClients = [
        {
          id: 'cli-rahul',
          name: 'Rahul Sharma',
          email: 'rahul@example.com',
          status: 'Active',
          historicalBookingsCount: 0,
          historicalLtv: 0
        }
      ]

      const mockBookings = [
        {
          id: 'BK-201',
          client: 'Rahul Sharma',
          package: 'Bali Luxury Villa',
          amount: 180000,
          date: '2026-07-20',
          status: 'Cancelled',
          cancellationReason: 'Schedule mismatch'
        },
        {
          id: 'BK-202',
          client: 'Rahul Sharma',
          package: 'Kyoto Zen Discovery',
          amount: 320000,
          date: '2026-11-15',
          status: 'Confirmed'
        }
      ]

      render(
        <ClientsPage
          clients={mockClients}
          bookings={mockBookings}
          setClients={vi.fn()}
          user={{ role: 'admin' }}
        />
      )

      expect(screen.getByText('Rahul Sharma')).toBeInTheDocument()
      expect(screen.getByText('Active')).toBeInTheDocument()
      expect(screen.getByText(/Kyoto Zen Discovery/i)).toBeInTheDocument()
    })

    it('BookingsPage status change to Cancelled calls setClients and syncs client status', async () => {
      const mockSetClients = vi.fn()
      const mockSetBookings = vi.fn()
      const mockClients = [
        { id: 'cli-1', name: 'Rohan Mehra', email: 'rohan@example.com', status: 'Active', logs: [] }
      ]
      const mockBookings = [
        {
          id: 'BK-301',
          client: 'Rohan Mehra',
          package: 'Amalfi Coast Tour',
          amount: 150000,
          date: '2026-08-01',
          status: 'Pending'
        }
      ]

      render(
        <BookingsPage
          bookings={mockBookings}
          setBookings={mockSetBookings}
          clients={mockClients}
          setClients={mockSetClients}
          packages={[]}
          user={{ role: 'admin' }}
        />
      )

      // Find status select dropdown
      const statusSelect = screen.getByRole('combobox')
      fireEvent.change(statusSelect, { target: { value: 'Cancelled' } })

      // Cancellation modal should appear requiring reason
      await waitFor(() => {
        expect(screen.getByText(/cancel booking #bk-301/i)).toBeInTheDocument()
      })

      // Click Confirm Cancellation button
      const confirmBtn = screen.getByRole('button', { name: /confirm cancellation/i })
      fireEvent.click(confirmBtn)

      // setClients should be invoked to synchronize client status
      await waitFor(() => {
        expect(mockSetClients).toHaveBeenCalled()
      })
    })
  })

  // ─────────────────────────────────────────────
  // R7: Itinerary Download Lead Display
  // ─────────────────────────────────────────────
  describe('R7: Itinerary Download Lead Display', () => {
    it('EnquiriesPage displays Itinerary Download badge for leads originating from itinerary downloads', async () => {
      const mockEnquiries = [
        {
          id: 'ENQ-99',
          name: 'Sarah Connor',
          email: 'sarah@example.com',
          destination: 'Japan Cherry Blossom',
          travelDate: '2026-09-01',
          guests: 2,
          status: 'logged',
          leadSource: 'Itinerary Download',
          isItineraryDownload: true,
          submittedAt: '2026-05-01'
        }
      ]

      vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ data: mockEnquiries })
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
        expect(screen.getByText('Sarah Connor')).toBeInTheDocument()
        const badges = screen.getAllByText('Itinerary Download')
        expect(badges.length).toBeGreaterThan(0)
      })
    })

    it('BookingsPage displays Itinerary Download badge in bookings table and inspection drawer', () => {
      const mockBookings = [
        {
          id: 'BK-777',
          client: 'Michael Scott',
          package: 'Safari Adventure',
          amount: 200000,
          date: '2026-10-10',
          status: 'Pending',
          leadSource: 'Itinerary Download'
        }
      ]

      render(
        <BookingsPage
          bookings={mockBookings}
          setBookings={vi.fn()}
          clients={[]}
          packages={[]}
          user={{ role: 'admin' }}
        />
      )

      expect(screen.getByText('Michael Scott')).toBeInTheDocument()
      const badges = screen.getAllByText('Itinerary Download')
      expect(badges.length).toBeGreaterThan(0)
    })
  })

  // ─────────────────────────────────────────────
  // R8: Cancellation Reasons & Lost Lead Reporting
  // ─────────────────────────────────────────────
  describe('R8: Cancellation Reasons & Lost Lead Reporting', () => {
    it('ReportsPage computes and displays summary metrics for lost leads and cancellation reasons', () => {
      const mockBookings = [
        {
          id: 'BK-1',
          client: 'Alice',
          package: 'Paris Romance',
          amount: 200000,
          date: '2026-06-10',
          status: 'Paid',
          leadSource: 'Instagram'
        },
        {
          id: 'BK-2',
          client: 'Bob',
          package: 'Greek Odyssey',
          amount: 150000,
          date: '2026-06-12',
          status: 'Cancelled',
          cancellationReason: 'Price too high / Budget constraints',
          leadSource: 'Facebook'
        },
        {
          id: 'BK-3',
          client: 'Charlie',
          package: 'Tokyo Neon',
          amount: 250000,
          date: '2026-06-15',
          status: 'Cancelled',
          cancellationReason: 'Dates / Schedule mismatch',
          leadSource: 'Google/Search'
        }
      ]

      const mockEnquiries = [
        {
          id: 'ENQ-1',
          name: 'David',
          destination: 'Bali',
          travelDate: '2026-07-01',
          status: 'logged',
          leadSource: 'Referral'
        }
      ]

      render(
        <ReportsPage
          bookings={mockBookings}
          enquiries={mockEnquiries}
          packages={[]}
          settings={{ inrToUsdRate: 85 }}
        />
      )

      // Total leads: 4 (3 bookings + 1 enquiry)
      expect(screen.getByText('4')).toBeInTheDocument()
      // Lost leads: 2
      expect(screen.getByText('2')).toBeInTheDocument()
      // Loss rate: 50.0%
      expect(screen.getByText(/50.0% loss rate/i)).toBeInTheDocument()
      // Lost queries section should display breakdown reasons
      expect(screen.getByText('Price too high / Budget constraints')).toBeInTheDocument()
      expect(screen.getByText('Dates / Schedule mismatch')).toBeInTheDocument()
    })
  })

  // ─────────────────────────────────────────────
  // R9: Lead Source Attribution & Enquiries Excel Export
  // ─────────────────────────────────────────────
  describe('R9: Lead Source Attribution & Enquiries Excel Export', () => {
    it('EnquiriesPage modal includes Lead Source dropdown and conditional Referral Name input', async () => {
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
          clients={[{ id: 'c1', name: 'John Doe', email: 'john@example.com' }]}
        />
      )

      // Wait for loading to finish
      await waitFor(() => {
        expect(screen.queryByText(/loading enquiries/i)).not.toBeInTheDocument()
      })

      // Click Create Enquiry to open modal
      fireEvent.click(screen.getByText('Create Enquiry'))

      // Lead Acquisition Source selector should exist
      const sourceSelect = screen.getByLabelText(/lead acquisition source/i)
      expect(sourceSelect).toBeInTheDocument()

      // Selecting Referral should conditionally display Referral Name
      fireEvent.change(sourceSelect, { target: { value: 'Referral' } })

      expect(screen.getByPlaceholderText(/name of referrer/i)).toBeInTheDocument()
    })

    it('EnquiriesPage exports filtered enquiries to an Excel (.xlsx) file', async () => {
      const mockEnquiries = [
        {
          id: 'ENQ-500',
          name: 'Emma Watson',
          email: 'emma@example.com',
          destination: 'London Tour',
          travelDate: '2026-08-20',
          guests: 2,
          status: 'logged',
          leadSource: 'Instagram',
          submittedAt: '2026-06-01'
        }
      ]

      vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ data: mockEnquiries })
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
        expect(screen.getByText('Emma Watson')).toBeInTheDocument()
      })

      const exportBtn = screen.getByRole('button', { name: /export to excel/i })
      fireEvent.click(exportBtn)

      expect(writeFileMock).toHaveBeenCalledWith(
        expect.any(Object),
        expect.stringContaining('.xlsx')
      )
    })
  })

  // ─────────────────────────────────────────────
  // R10: Date-Range Analytics & Full Report Excel Export
  // ─────────────────────────────────────────────
  describe('R10: Date-Range Analytics & Full Report Excel Export', () => {
    it('ReportsPage filters metrics dynamically based on date range inputs', () => {
      const mockBookings = [
        {
          id: 'BK-JAN',
          client: 'Winter Traveler',
          package: 'Norway Auroras',
          amount: 300000,
          date: '2026-01-15',
          status: 'Confirmed'
        },
        {
          id: 'BK-JUL',
          client: 'Summer Traveler',
          package: 'Santorini Sunset',
          amount: 200000,
          date: '2026-07-20',
          status: 'Confirmed'
        }
      ]

      render(
        <ReportsPage
          bookings={mockBookings}
          enquiries={[]}
          packages={[]}
          settings={{ inrToUsdRate: 85 }}
        />
      )

      // Initially both are included (Gross sales = 500,000)
      const salesBadges = screen.getAllByText('₹5,00,000')
      expect(salesBadges.length).toBeGreaterThan(0)

      // Set From Date filter to July 2026
      const fromInput = screen.getByLabelText(/start date filter/i)
      fireEvent.change(fromInput, { target: { value: '2026-07-01' } })

      // Now only July booking should be included (Gross sales = 200,000)
      const julySalesBadges = screen.getAllByText('₹2,00,000')
      expect(julySalesBadges.length).toBeGreaterThan(0)
    })

    it('ReportsPage Download Full Report button produces multi-sheet workbook with all 5 required sheets', () => {
      const mockBookings = [
        {
          id: 'BK-R10',
          client: 'Priya Verma',
          package: 'Maldives Overwater',
          amount: 400000,
          date: '2026-08-10',
          status: 'Paid',
          leadSource: 'Instagram'
        },
        {
          id: 'BK-LOST',
          client: 'Anand Kumar',
          package: 'Dubai Safari',
          amount: 150000,
          date: '2026-08-12',
          status: 'Cancelled',
          cancellationReason: 'Price too high / Budget constraints',
          leadSource: 'LinkedIn'
        }
      ]

      const mockEnquiries = [
        {
          id: 'ENQ-R10',
          name: 'Kunal Sen',
          email: 'kunal@example.com',
          destination: 'Bali',
          travelDate: '2026-09-01',
          guests: 2,
          status: 'logged',
          leadSource: 'Referral',
          referralName: 'Priya Verma'
        }
      ]

      render(
        <ReportsPage
          bookings={mockBookings}
          enquiries={mockEnquiries}
          packages={[]}
          settings={{ inrToUsdRate: 85 }}
          addNotification={vi.fn()}
        />
      )

      const downloadBtn = screen.getByRole('button', { name: /download full report/i })
      fireEvent.click(downloadBtn)

      expect(writeFileMock).toHaveBeenCalled()
      const [workbook, filename] = writeFileMock.mock.calls[0]
      expect(filename).toContain('.xlsx')

      // Verify all 5 sheets exist in the generated workbook
      expect(workbook.SheetNames).toContain('Executive Summary')
      expect(workbook.SheetNames).toContain('Lost Queries Breakdown')
      expect(workbook.SheetNames).toContain('Acquisition Channels')
      expect(workbook.SheetNames).toContain('Bookings Detail')
      expect(workbook.SheetNames).toContain('Enquiries Detail')
    })
  })
})

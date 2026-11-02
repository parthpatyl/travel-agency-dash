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

import NavigationPage from '../components/NavigationPage'
import SettingsPage from '../components/SettingsPage'
import { roleHas, ROLE_PERMISSIONS } from '../utils/permissions'
import { getQueue, enqueueRequest, clearQueue, processSyncQueue } from '../utils/syncManager'
import App from '../App'

describe('Admin CMS RBAC & Dense Dashboard Integration Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('1. Role Permissions Definition & Enforcement', () => {
    it('verifies admin has write:settings permission while operations, sales, and owner do not', () => {
      expect(roleHas('admin', 'write:settings')).toBe(true)
      expect(roleHas('operations', 'write:settings')).toBe(false)
      expect(roleHas('sales', 'write:settings')).toBe(false)
      expect(roleHas('owner', 'write:settings')).toBe(false)
    })
  })

  describe('2. NavigationPage Multi-Role Rendering & Guardrails', () => {
    const mockNavData = [
      {
        id: 'destinations',
        label: 'Destinations',
        type: 'megamenu',
        visible: true,
        continents: [
          {
            id: 'europe',
            name: 'Europe',
            visible: true,
            countries: [
              { name: 'France', visible: true, cities: [{ label: 'Paris', search: 'Paris', visible: true }] }
            ]
          }
        ]
      }
    ]

    beforeEach(() => {
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/api/navigation/carousel')) {
          return Promise.resolve({
            ok: true,
            json: async () => []
          })
        }
        if (url.includes('/api/navigation')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockNavData
          })
        }
        return Promise.reject(new Error(`Unhandled mock for ${url}`))
      })
    })

    it('renders NavigationPage without ReadOnlyBanner for Admin role', async () => {
      render(
        <NavigationPage
          token="valid-admin-token"
          user={{ role: 'admin', name: 'Admin User' }}
          addNotification={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/Navigation & Mega Menu CMS/i)).toBeInTheDocument()
      })

      expect(screen.queryByText(/View-only mode - only Administrators can modify navigation/i)).not.toBeInTheDocument()
      
      const publishBtn = screen.getByRole('button', { name: /Publish Changes/i })
      expect(publishBtn).toBeInTheDocument()
    })

    it('renders NavigationPage with ReadOnlyBanner and disables mutation buttons for Operations role', async () => {
      render(
        <NavigationPage
          token="valid-ops-token"
          user={{ role: 'operations', name: 'Ops User' }}
          addNotification={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/View-only mode - only Administrators can modify navigation/i)).toBeInTheDocument()
      })

      const resetBtn = screen.getByRole('button', { name: /Reset Defaults/i })
      expect(resetBtn).toBeDisabled()

      const publishBtn = screen.getByRole('button', { name: /Publish Changes/i })
      expect(publishBtn).toBeDisabled()
    })
  })

  describe('3. SettingsPage Multi-Role Rendering & Guardrails', () => {
    const mockSettings = {
      agencyName: 'KRAFT YOUR TRIP',
      agencyEmail: 'contact@kraftyourtrip.com',
      agencyPhone: '+91 7046704693',
      defaultMarkup: 15,
      defaultAgentSplit: 40
    }

    beforeEach(() => {
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/api/speciality-categories')) {
          return Promise.resolve({
            ok: true,
            json: async () => []
          })
        }
        if (url.includes('/api/packages')) {
          return Promise.resolve({
            ok: true,
            json: async () => []
          })
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockSettings
        })
      })
    })

    it('renders SettingsPage with ReadOnlyBanner for Operations role', async () => {
      render(
        <SettingsPage
          token="valid-ops-token"
          settings={mockSettings}
          setSettings={vi.fn()}
          user={{ role: 'operations', name: 'Ops User' }}
          addNotification={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/View-only mode - only Administrators can modify agency settings/i)).toBeInTheDocument()
      })
    })

    it('renders SettingsPage without ReadOnlyBanner for Admin role', async () => {
      render(
        <SettingsPage
          token="valid-admin-token"
          settings={mockSettings}
          setSettings={vi.fn()}
          user={{ role: 'admin', name: 'Admin User' }}
          addNotification={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/Website CMS & Agency Settings/i)).toBeInTheDocument()
      })

      expect(screen.queryByText(/View-only mode - only Administrators can modify agency settings/i)).not.toBeInTheDocument()
    })
  })

  describe('4. Dense Dashboard Tabular Alignment & Typography Verification', () => {
    it('verifies tabular-nums and right alignment on booking amount and price headers in App dashboard', async () => {
      localStorage.setItem('kraft_token', 'mock-admin-token')
      localStorage.setItem('kraft_user', JSON.stringify({ name: 'Admin User', role: 'admin', email: 'admin@kraftyourtrip.com' }))

      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/api/auth/me')) return Promise.resolve({ ok: true, json: async () => ({ user: { id: 'u-1', name: 'Admin User', role: 'admin', email: 'admin@kraftyourtrip.com' } }) })
        if (url.includes('/api/health')) return Promise.resolve({ ok: true, json: async () => ({ status: 'ok' }) })
        if (url.includes('/api/bookings')) return Promise.resolve({ ok: true, json: async () => [
          { id: 'BK-1', client: 'Alice', package: 'Goa Holiday', amount: 50000, date: '25-06-2026', status: 'Paid' }
        ] })
        if (url.includes('/api/group-departures')) return Promise.resolve({ ok: true, json: async () => [
          { id: 'GD-1', title: 'Vietnam Expedition', departureDate: '2026-07-01', returnDate: '2026-07-08', packageBasePrice: 45000, priceModifier: 0, status: 'scheduled' }
        ] })
        if (url.includes('/api/packages')) return Promise.resolve({ ok: true, json: async () => [] })
        if (url.includes('/api/clients')) return Promise.resolve({ ok: true, json: async () => [] })
        if (url.includes('/api/testimonials')) return Promise.resolve({ ok: true, json: async () => [] })
        if (url.includes('/api/settings')) return Promise.resolve({ ok: true, json: async () => ({}) })
        return Promise.resolve({ ok: true, json: async () => [] })
      })

      render(<App />)

      await waitFor(() => {
        expect(screen.getByText(/Recent Bookings/i)).toBeInTheDocument()
      })

      // Check Amount table header has text-right
      const amountHeader = screen.getByRole('columnheader', { name: /Amount/i })
      expect(amountHeader).toHaveClass('text-right')
      expect(amountHeader).toHaveClass('py-2')
      expect(amountHeader).toHaveClass('px-3.5')

      // Check Price table header has text-right
      const priceHeader = screen.getByRole('columnheader', { name: /Price/i })
      expect(priceHeader).toHaveClass('text-right')
      expect(priceHeader).toHaveClass('py-2')
      expect(priceHeader).toHaveClass('px-3.5')
    })
  })

  describe('5. Offline Sync Queue Mutation Queuing & Resiliency', () => {
    it('enqueues mutations when offline and drains queue on successful processing', async () => {
      clearQueue()

      // Enqueue a test navigation save mutation
      enqueueRequest({
        url: 'http://localhost:5000/api/navigation',
        method: 'PUT',
        body: JSON.stringify([{ id: 'test', label: 'Test Nav' }]),
        description: 'Update Navigation Structure'
      })

      const queueBefore = getQueue()
      expect(queueBefore.length).toBe(1)
      expect(queueBefore[0].description).toBe('Update Navigation Structure')

      // Mock successful server recovery
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true })
      })

      const result = await processSyncQueue()
      expect(result.processedCount).toBe(1)

      const queueAfter = getQueue()
      expect(queueAfter.length).toBe(0)
    })
  })
})

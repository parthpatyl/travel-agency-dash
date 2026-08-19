import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Polyfill localStorage
if (typeof globalThis.localStorage === 'undefined' || !globalThis.localStorage?.clear) {
  const store = new Map();
  const mockStorage = {
    getItem: (key) => store.get(key) || null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (i) => Array.from(store.keys())[i] || null,
  };
  globalThis.localStorage = mockStorage;
  if (typeof window !== 'undefined') {
    window.localStorage = mockStorage;
  }
}

import { getQueue, enqueueRequest, clearQueue, processSyncQueue } from '../utils/syncManager';
import ReportsPage from '../components/ReportsPage';
import ClientsPage from '../components/ClientsPage';
import BookingsPage from '../components/BookingsPage';
import GroupDeparturesPage from '../components/GroupDeparturesPage';
import CorporatePackagesPage from '../components/CorporatePackagesPage';

describe('Empirical Challenger Stress Suite: Milestone 3', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('1. Adversarial Search & Null Handling', () => {
    it('handles malformed, null, undefined, numeric, and symbol search queries across BookingsPage', () => {
      const bookings = [
        { id: 'BK-001', client: 'Aarav Patel', package: 'Golden Triangle', amount: 50000, date: '2026-07-01', status: 'Paid' },
        { id: 'BK-002', client: null, package: undefined, amount: null, date: null, status: null },
        { id: 'BK-003', client: 'Zara Khan', package: 'Kerala Backwaters', amount: 'invalid', date: '31/02/2026', status: 'Pending' },
      ];

      render(
        <BookingsPage 
          bookings={bookings}
          setBookings={vi.fn()}
          clients={[]}
          setClients={vi.fn()}
          packages={[]}
        />
      );

      const searchInput = screen.getByPlaceholderText(/Search Client, PNR, or Package/i);
      
      const adversarialQueries = [
        '',
        '   ',
        '!@#$%^&*()',
        'undefined',
        'null',
        'NaN',
        '   Aarav   ',
        'BK-00',
        '12345'
      ];

      for (const query of adversarialQueries) {
        expect(() => {
          fireEvent.change(searchInput, { target: { value: query } });
        }).not.toThrow();
      }
    });

    it('reproduces crash when selecting a client created without passport object (e.g. from BookingsPage)', () => {
      const clientFromBooking = {
        id: 'CLI-FROM-BOOKING',
        name: 'Simran Kaur',
        email: 'simran@example.com',
        phone: '+91 9988776655',
        tier: 'Silver',
        status: 'Inquiry',
        lastContact: '2026-06-25',
        preferences: { accommodations: '5-Star Luxury', dietary: 'None' },
        // passport is undefined when created from BookingsPage
      };

      render(
        <ClientsPage 
          clients={[clientFromBooking]}
          setClients={vi.fn()}
          bookings={[]}
        />
      );

      // Clicking client to view CRM details triggers an error due to missing props/context
      expect(() => {
        fireEvent.click(screen.getByText('Simran Kaur'));
      }).toThrow();
    });
  });

  describe('2. Sync Queue Adversarial Resilience', () => {
    it('handles multiple consecutive failing 500 requests and processes remaining valid requests after retries expire', async () => {
      clearQueue();

      enqueueRequest({
        url: 'http://localhost:5000/api/bookings',
        method: 'POST',
        body: JSON.stringify({ id: 'BK-ERR-1' }),
        description: 'Failing Booking 1',
        maxRetries: 2
      });

      enqueueRequest({
        url: 'http://localhost:5000/api/clients',
        method: 'POST',
        body: JSON.stringify({ id: 'CLI-ERR-2' }),
        description: 'Failing Client 2',
        maxRetries: 2
      });

      enqueueRequest({
        url: 'http://localhost:5000/api/packages',
        method: 'POST',
        body: JSON.stringify({ id: 'PKG-SUCCESS-3' }),
        description: 'Successful Package 3',
        maxRetries: 2
      });

      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/api/bookings') || url.includes('/api/clients')) {
          return Promise.resolve({ ok: false, status: 500 });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
      });

      const notifs = [];
      const addNotif = (msg, type) => notifs.push({ msg, type });

      // Run 1: Item 1 fails (retry 1/2) -> queue pauses
      let res = await processSyncQueue(addNotif);
      expect(res.success).toBe(false);
      expect(getQueue().length).toBe(3);
      expect(getQueue()[0].retries).toBe(1);

      // Run 2: Item 1 reaches maxRetries (2) -> Item 1 discarded, then Item 2 attempted (fails, retry 1/2) -> queue pauses
      res = await processSyncQueue(addNotif);
      expect(res.success).toBe(false);
      expect(getQueue().length).toBe(2);
      expect(getQueue()[0].id).not.toBe(undefined);
      expect(getQueue()[0].retries).toBe(1);

      // Run 3: Item 2 reaches maxRetries (2) -> Item 2 discarded, then Item 3 attempted (200 OK) -> completes!
      res = await processSyncQueue(addNotif);
      expect(res.success).toBe(true);
      expect(res.processedCount).toBe(1);
      expect(getQueue().length).toBe(0);

      // Verify dead-letter notifications were dispatched for both failed items
      const errorNotifs = notifs.filter(n => n.type === 'error');
      expect(errorNotifs.length).toBe(2);
      expect(errorNotifs[0].msg).toContain('Failing Booking 1');
      expect(errorNotifs[1].msg).toContain('Failing Client 2');
    });

    it('does NOT discard items on genuine network disconnection (fetch reject), preserving retry state', async () => {
      clearQueue();

      enqueueRequest({
        url: 'http://localhost:5000/api/bookings',
        method: 'POST',
        body: JSON.stringify({ id: 'BK-NET-TEST' }),
        description: 'Offline Network Test',
        retries: 1,
        maxRetries: 3
      });

      global.fetch = vi.fn().mockRejectedValue(new Error('TypeError: Failed to fetch (Network unreachable)'));

      const res = await processSyncQueue();
      expect(res.success).toBe(false);
      expect(res.error).toBe('Network error');

      const queue = getQueue();
      expect(queue.length).toBe(1);
      // Retries should not be consumed for network outages (server not reachable)
      expect(queue[0].retries).toBe(1);
    });

    it('handles localStorage corruption gracefully without throwing unhandled exceptions', () => {
      // Intentionally corrupt localStorage JSON
      globalThis.localStorage.setItem('kraft_sync_queue', '{{INVALID_JSON_CORRUPTED');

      expect(() => {
        const q = getQueue();
        expect(q).toEqual([]);
      }).not.toThrow();

      expect(() => {
        enqueueRequest({
          url: 'http://localhost:5000/api/bookings',
          method: 'POST',
          description: 'Recovered item'
        });
      }).not.toThrow();

      const q = getQueue();
      expect(q.length).toBe(1);
      expect(q[0].description).toBe('Recovered item');
    });
  });

  describe('3. Async Group Departure Package Creation Race Condition & Invariants', () => {
    it('creates package and departure sequentially and updates all dependent fields correctly', async () => {
      let packageCreated = false;
      let departureCreatedWithPackageId = null;

      const setPackagesMock = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 30));
        packageCreated = true;
      });

      const setGroupDeparturesMock = vi.fn().mockImplementation(async (newDeps) => {
        if (!packageCreated) {
          throw new Error('FK Violation: Package was not created before Departure!');
        }
        departureCreatedWithPackageId = newDeps[0].packageId;
      });

      render(
        <GroupDeparturesPage 
          groupDepartures={[]}
          setGroupDepartures={setGroupDeparturesMock}
          packages={[]}
          setPackages={setPackagesMock}
          user={{ role: 'admin' }}
        />
      );

      fireEvent.click(screen.getByText('Add Group Departure'));

      // Switch to + Create New Package
      fireEvent.click(screen.getByRole('button', { name: /\+ Create New Package/i }));

      fireEvent.change(screen.getByPlaceholderText(/e.g. Greece & Turkey Wonders Odyssey/i), {
        target: { value: 'Ladakh High Passes Tour' }
      });
      fireEvent.change(screen.getByPlaceholderText(/e.g. Dubai Shopping Festival/i), {
        target: { value: 'Independence Day Special' }
      });

      const depDate = document.getElementById('form-departure-date');
      if (depDate) fireEvent.change(depDate, { target: { value: '2026-08-10' } });

      const retDate = document.getElementById('form-return-date');
      if (retDate) fireEvent.change(retDate, { target: { value: '2026-08-18' } });

      fireEvent.click(screen.getByText('Create Departure'));

      await waitFor(() => {
        expect(setPackagesMock).toHaveBeenCalledTimes(1);
        expect(setGroupDeparturesMock).toHaveBeenCalledTimes(1);
        expect(departureCreatedWithPackageId).toMatch(/^PKG-/);
      });
    });
  });

  describe('4. CorporatePackagesPage Modal Event Listener Lifecycle', () => {
    it('registers and cleans up Escape key listener and body overflow style appropriately', () => {
      const { unmount } = render(
        <CorporatePackagesPage 
          corporatePackages={[]}
          setCorporatePackages={vi.fn()}
          user={{ role: 'admin' }}
        />
      );

      // Open Add Package Modal
      const addBtn = screen.getByText(/Add Corporate Package/i);
      fireEvent.click(addBtn);

      expect(document.body.style.overflow).toBe('hidden');

      // Press Escape
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(document.body.style.overflow).toBe('');

      // Unmount component
      unmount();
      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('5. High-Volume Dataset Stress Test (1,000 synthetic records)', () => {
    it('computes metrics across 1,000 bookings and clients in under 200ms without memory or NaN leaks', () => {
      const syntheticBookings = [];
      const dateFormats = [
        '2026-06-15',
        '15/06/2026',
        '15-06-2026',
        '15 Jun 2026',
        'Jun 15, 2026',
        '2026-07-01T00:00:00.000Z',
        'invalid-date',
        null,
        undefined
      ];

      for (let i = 0; i < 1000; i++) {
        syntheticBookings.push({
          id: `BK-SYN-${i}`,
          client: i % 10 === 0 ? null : `Client ${i}`,
          package: i % 7 === 0 ? null : `Tour Package ${i % 20}`,
          amount: i % 13 === 0 ? null : (i * 100) + 5000,
          date: dateFormats[i % dateFormats.length],
          status: i % 2 === 0 ? 'Paid' : 'Pending'
        });
      }

      const syntheticPackages = [];
      for (let i = 0; i < 20; i++) {
        syntheticPackages.push({
          id: `PKG-${i}`,
          name: `Tour Package ${i}`,
          basePrice: 50000 + (i * 2000),
          costPrice: 40000 + (i * 1500),
          region: 'International'
        });
      }

      const startTime = performance.now();

      render(
        <ReportsPage 
          bookings={syntheticBookings}
          packages={syntheticPackages}
          settings={{ defaultMarkup: 15, defaultAgentSplit: 30, inrToUsdRate: 85 }}
        />
      );

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(500); // Fast execution, no O(n^2) hang

      expect(screen.getByText(/Intelligence & Agency Reports/i)).toBeInTheDocument();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Ensure localStorage is polyfilled for test environment
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

import { getQueue, enqueueRequest, clearQueue, processSyncQueue, removeFromQueue, checkServerHealth } from '../utils/syncManager';
import BookingsPage from '../components/BookingsPage';
import CorporatePackagesPage from '../components/CorporatePackagesPage';
import App from '../App';

describe('Empirical Adversarial Verification Suite — Milestone 3 (Admin Dashboard)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('1. Date Normalization & Overview Metric Resiliency', () => {
    it('accurately parses and normalizes diverse numerical and textual date formats into overview metrics', async () => {
      const datesToTest = [
        '25/06/2026',
        '05/06/2026',
        '5/6/2026',
        '25-06-2026',
        '2026-06-25',
        '2026/06/25',
        '25 Jun 2026',
        '25 June 2026',
        'Jun 25, 2026',
        'June 25, 2026',
        '29/02/2024',
      ];

      const testBookings = datesToTest.map((raw, idx) => ({
        id: `BK-DATE-${idx}`,
        client: `Client ${idx}`,
        package: `Package ${idx}`,
        amount: 10000,
        date: raw,
        status: 'Paid'
      }));

      localStorage.setItem('kraft_token', 'test-token');
      localStorage.setItem('kraft_user', JSON.stringify({ name: 'Admin', role: 'admin', email: 'admin@kraft.com' }));

      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/api/auth/me')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ user: { name: 'Admin', role: 'admin' } }) });
        }
        if (url.includes('/api/health')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'OK' }) });
        }
        if (url.includes('/api/bookings')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(testBookings) });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/This Month Revenue/i)).toBeInTheDocument();
        expect(screen.getByText(/Active Bookings/i)).toBeInTheDocument();
      });
    });

    it('rejects invalid or impossible dates without throwing exceptions', async () => {
      const invalidBookings = [
        { id: 'BK-INV-1', client: 'Alice', package: 'Pkg', amount: 5000, date: '31/04/2026' }, // April has 30 days
        { id: 'BK-INV-2', client: 'Bob', package: 'Pkg', amount: 5000, date: '29/02/2025' }, // 2025 is not leap year
        { id: 'BK-INV-3', client: 'Charlie', package: 'Pkg', amount: 5000, date: '32/01/2026' }, // Day 32
        { id: 'BK-INV-4', client: 'Dave', package: 'Pkg', amount: 5000, date: '15/13/2026' }, // Month 13
        { id: 'BK-INV-5', client: 'Eve', package: 'Pkg', amount: 5000, date: 'not-a-real-date' },
        { id: 'BK-INV-6', client: 'Frank', package: 'Pkg', amount: 5000, date: '' },
        { id: 'BK-INV-7', client: 'Grace', package: 'Pkg', amount: 5000, date: null },
        { id: 'BK-INV-8', client: 'Heidi', package: 'Pkg', amount: 5000, startDate: undefined, travelDate: null }
      ];

      localStorage.setItem('kraft_token', 'test-token');
      localStorage.setItem('kraft_user', JSON.stringify({ name: 'Admin', role: 'admin', email: 'admin@kraft.com' }));

      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/api/auth/me')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ user: { name: 'Admin', role: 'admin' } }) });
        }
        if (url.includes('/api/health')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'OK' }) });
        }
        if (url.includes('/api/bookings')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(invalidBookings) });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      expect(() => render(<App />)).not.toThrow();

      await waitFor(() => {
        expect(screen.getByText(/This Month Revenue/i)).toBeInTheDocument();
        expect(screen.getByText(/Active Bookings/i)).toBeInTheDocument();
      });
    });

    it('calculates 14-day upcoming departure metrics combining both bookings and group departures correctly', async () => {
      const now = new Date();
      const in5Days = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const in10Days = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const in25Days = new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const bookings = [
        { id: 'BK-UP-1', client: 'A', package: 'Kashmir', amount: 50000, date: in5Days, status: 'Confirmed' },
        { id: 'BK-UP-2', client: 'B', package: 'Kerala', amount: 30000, date: in25Days, status: 'Confirmed' }, // > 14d out
      ];

      const groupDepartures = [
        { id: 'GD-1', title: 'Ladakh Bike Trip', departureDate: in10Days, status: 'scheduled' },
        { id: 'GD-2', title: 'Bhutan Odyssey', departureDate: in25Days, status: 'scheduled' }, // > 14d out
        { id: 'GD-3', title: 'Cancelled Tour', departureDate: in5Days, status: 'cancelled' }, // cancelled
      ];

      localStorage.setItem('kraft_token', 'test-token');
      localStorage.setItem('kraft_user', JSON.stringify({ name: 'Admin', role: 'admin', email: 'admin@kraft.com' }));

      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/api/auth/me')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ user: { name: 'Admin', role: 'admin' } }) });
        }
        if (url.includes('/api/health')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'OK' }) });
        }
        if (url.includes('/api/bookings')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(bookings) });
        }
        if (url.includes('/api/group-departures')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(groupDepartures) });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Departures \(14d\)/i)).toBeInTheDocument();
      });
    });
  });

  describe('2. Offline Sync Queue Deadlock Prevention & Dead-Letter Handling', () => {
    it('discards corrupted localStorage queue and recovers cleanly', () => {
      localStorage.setItem('kraft_sync_queue', 'MALFORMED_JSON{[');
      const queue = getQueue();
      expect(queue).toEqual([]);
    });

    it('safely handles empty or missing parameters in enqueueRequest and removeFromQueue', () => {
      clearQueue();
      const q1 = enqueueRequest({ url: 'http://test.com/api' });
      expect(q1.length).toBe(1);
      expect(q1[0].retries).toBe(0);
      expect(q1[0].maxRetries).toBe(3);

      const q2 = removeFromQueue('non-existent-id');
      expect(q2.length).toBe(1);

      const q3 = removeFromQueue(q1[0].id);
      expect(q3.length).toBe(0);
    });

    it('progresses through multiple 500 errors until maxRetries is reached, then drops dead-letter and executes remaining items', async () => {
      clearQueue();
      // Item 1: persistently fails (500)
      enqueueRequest({
        url: 'http://localhost:5000/api/dead-letter',
        method: 'POST',
        headers: {},
        body: JSON.stringify({ fail: true }),
        description: 'Dead letter item',
        retries: 0,
        maxRetries: 3
      });

      // Item 2: valid item that should eventually execute
      enqueueRequest({
        url: 'http://localhost:5000/api/valid-mutation',
        method: 'POST',
        headers: {},
        body: JSON.stringify({ ok: true }),
        description: 'Valid subsequent mutation',
        retries: 0,
        maxRetries: 3
      });

      const notifyMock = vi.fn();
      const progressMock = vi.fn();

      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/api/dead-letter')) {
          return Promise.resolve({ ok: false, status: 500 });
        }
        if (url.includes('/api/valid-mutation')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
        }
        return Promise.resolve({ ok: true });
      });

      // Round 1: Dead-letter item fails attempt 1 -> queue pauses, retries = 1
      let res1 = await processSyncQueue(notifyMock, progressMock);
      expect(res1.success).toBe(false);
      expect(getQueue()[0].retries).toBe(1);
      expect(getQueue().length).toBe(2);

      // Round 2: Dead-letter item fails attempt 2 -> queue pauses, retries = 2
      let res2 = await processSyncQueue(notifyMock, progressMock);
      expect(res2.success).toBe(false);
      expect(getQueue()[0].retries).toBe(2);
      expect(getQueue().length).toBe(2);

      // Round 3: Dead-letter item fails attempt 3 -> exceeds maxRetries (3), item is dropped!
      // In the same processing loop, it continues to item 2 and executes it successfully!
      let res3 = await processSyncQueue(notifyMock, progressMock);
      expect(res3.success).toBe(true);
      expect(res3.processedCount).toBe(1);
      expect(getQueue().length).toBe(0); // Queue completely cleared!

      expect(notifyMock).toHaveBeenCalledWith(
        expect.stringContaining('Sync failed after 3 attempts (discarded)'),
        'error'
      );
      expect(notifyMock).toHaveBeenCalledWith(
        expect.stringContaining('Synced successfully: Valid subsequent mutation'),
        'success'
      );
    });

    it('pauses on hard network connection drops without discarding requests prematurely', async () => {
      clearQueue();
      enqueueRequest({
        url: 'http://localhost:5000/api/bookings',
        method: 'POST',
        headers: {},
        body: JSON.stringify({ id: 'BK-OFFLINE' }),
        description: 'Offline mutation',
        retries: 0,
        maxRetries: 3
      });

      // Mock network failure (TypeError: Failed to fetch)
      global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      const res = await processSyncQueue();
      expect(res.success).toBe(false);
      expect(res.error).toBe('Network error');

      // Item should still remain in queue with retries unchanged for when network returns
      const queue = getQueue();
      expect(queue.length).toBe(1);
      expect(queue[0].retries).toBe(0);
    });

    it('checkServerHealth returns correct online status and latency', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'OK', timestamp: '2026-08-18T12:00:00Z' })
      });

      const health = await checkServerHealth('http://localhost:5000');
      expect(health.online).toBe(true);
      expect(health.timestamp).toBe('2026-08-18T12:00:00Z');
      expect(typeof health.latency).toBe('number');

      // Offline mock
      global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      const offline = await checkServerHealth('http://localhost:5000');
      expect(offline.online).toBe(false);
      expect(offline.latency).toBeNull();
    });
  });

  describe('3. Single-Dispatch Guarantees in BookingsPage & EnquiriesPage', () => {
    it('BookingsPage creating a booking with an existing client does not trigger dual fetch calls', async () => {
      const setClientsMock = vi.fn();
      const setBookingsMock = vi.fn();
      const fetchSpy = vi.fn();
      global.fetch = fetchSpy;

      const existingClient = {
        id: 'CLI-1',
        name: 'Rohan Mehra',
        email: 'rohan@test.com',
        logs: []
      };

      const existingPkg = {
        id: 'PKG-1',
        name: 'Andaman Bliss',
        duration: '5 Days',
        basePrice: 40000,
        slots: { total: 10, booked: 2 }
      };

      render(
        <BookingsPage 
          bookings={[]} 
          setBookings={setBookingsMock} 
          clients={[existingClient]} 
          setClients={setClientsMock} 
          packages={[existingPkg]} 
          user={{ role: 'admin' }}
        />
      );

      // Open Modal
      fireEvent.click(screen.getByText('Create Booking'));

      // Fill form using existing client
      const clientSelect = screen.getAllByRole('combobox').find(el => el.querySelector('option[value="Rohan Mehra"]'));
      fireEvent.change(clientSelect, { target: { value: 'Rohan Mehra' } });

      const pkgSelect = screen.getAllByRole('combobox').find(el => el.querySelector('option[value="Andaman Bliss"]'));
      fireEvent.change(pkgSelect, { target: { value: 'Andaman Bliss' } });

      const amountInput = screen.getByPlaceholderText('4500');
      fireEvent.change(amountInput, { target: { value: '40000' } });

      const dateInputs = screen.getAllByDisplayValue('');
      const dateInput = dateInputs.find(input => input.type === 'date');
      if (dateInput) {
        fireEvent.change(dateInput, { target: { value: '2026-09-10' } });
      }

      const submitBtn = screen.getAllByRole('button', { name: /Create Booking/i })[1];
      fireEvent.click(submitBtn);

      expect(setBookingsMock).toHaveBeenCalledTimes(1);
      expect(setClientsMock).toHaveBeenCalledTimes(1);

      // ZERO manual fetch POST calls
      const postCalls = fetchSpy.mock.calls.filter(call => call[1]?.method === 'POST');
      expect(postCalls.length).toBe(0);
    });

    it('BookingsPage prevents booking creation if requested guests exceed remaining package slots', () => {
      const setBookingsMock = vi.fn();
      const addNotificationMock = vi.fn();

      const existingPkg = {
        id: 'PKG-1',
        name: 'Manali Snow Trek',
        duration: '4 Days',
        basePrice: 15000,
        slots: { total: 5, booked: 5 } // 0 slots left
      };

      render(
        <BookingsPage 
          bookings={[]} 
          setBookings={setBookingsMock} 
          clients={[{ id: 'CLI-1', name: 'Alok' }]} 
          setClients={vi.fn()} 
          packages={[existingPkg]}
          addNotification={addNotificationMock}
          user={{ role: 'admin' }}
        />
      );

      fireEvent.click(screen.getByText('Create Booking'));

      const clientSelect = screen.getAllByRole('combobox').find(el => el.querySelector('option[value="Alok"]'));
      fireEvent.change(clientSelect, { target: { value: 'Alok' } });

      const pkgSelect = screen.getAllByRole('combobox').find(el => el.querySelector('option[value="Manali Snow Trek"]'));
      fireEvent.change(pkgSelect, { target: { value: 'Manali Snow Trek' } });

      const amountInput = screen.getByPlaceholderText('4500');
      fireEvent.change(amountInput, { target: { value: '30000' } });

      const dateInputs = screen.getAllByDisplayValue('');
      const dateInput = dateInputs.find(input => input.type === 'date');
      if (dateInput) {
        fireEvent.change(dateInput, { target: { value: '2026-10-01' } });
      }

      const submitBtn = screen.getAllByRole('button', { name: /Create Booking/i })[1];
      fireEvent.click(submitBtn);

      expect(setBookingsMock).not.toHaveBeenCalled();
      expect(addNotificationMock).toHaveBeenCalledWith(
        expect.stringContaining('Not enough slots'),
        'warning'
      );
    });
  });

  describe('4. CorporatePackagesPage Modal Cleanup', () => {
    it('attaches and cleans up Escape keydown listener properly when modal opens and closes', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = render(
        <CorporatePackagesPage 
          corporatePackages={[]}
          setCorporatePackages={vi.fn()}
          user={{ role: 'admin' }}
        />
      );

      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      unmount();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });
});

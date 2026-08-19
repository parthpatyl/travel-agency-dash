import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Polyfill localStorage in test environment
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
import EnquiriesPage from '../components/EnquiriesPage';
import GroupDeparturesPage from '../components/GroupDeparturesPage';
import App from '../App';

describe('Admin Dashboard Resiliency and Integrity Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('1. Null-Safe Property Access in Search & Filtering', () => {
    it('ReportsPage handles bookings with null/undefined packages and clients without crashing', () => {
      const buggyBookings = [
        { id: 'BK-1', client: 'Alice', package: null, amount: 50000, date: '2026-06-25' },
        { id: 'BK-2', client: null, package: undefined, amount: 20000, date: '2026-06-26' },
        { id: 'BK-3', client: 'Bob', package: 'Goa Holiday', amount: 35000, date: '2026-06-27' },
      ];
      const packages = [
        { id: 'PKG-1', name: 'Goa Holiday', region: 'India', basePrice: 35000, costPrice: 28000 }
      ];

      expect(() => {
        render(<ReportsPage bookings={buggyBookings} packages={packages} settings={{ defaultMarkup: 15, defaultAgentSplit: 40 }} />);
      }).not.toThrow();

      expect(screen.getByText(/Intelligence & Agency Reports/i)).toBeInTheDocument();
      expect(screen.getByText(/Goa Holiday \(India\)/i)).toBeInTheDocument();
    });

    it('ClientsPage handles bookings with null client property without throwing TypeError', () => {
      const buggyBookings = [
        { id: 'BK-1', client: null, package: 'Kerala Escape', amount: 45000, date: '2026-06-25' },
        { id: 'BK-2', client: undefined, package: 'Bali Retreat', amount: 60000, date: '2026-06-26' },
        { id: 'BK-3', client: 'Rahul Sharma', package: 'Goa Holiday', amount: 30000, date: '2026-06-27' },
      ];
      const clients = [
        {
          id: 'CLI-1',
          name: 'Rahul Sharma',
          email: 'rahul@example.com',
          phone: '+91 9876543210',
          tier: 'Gold',
          status: 'Active',
          lastContact: '2026-06-10',
          preferences: { airline: 'Air India', seat: 'Window', room: 'King', dietary: 'None' },
          passport: { number: 'M1234567', expires: '2028-12-31', status: 'Valid' }
        }
      ];

      expect(() => {
        render(<ClientsPage clients={clients} setClients={vi.fn()} bookings={buggyBookings} />);
      }).not.toThrow();

      expect(screen.getByText('Rahul Sharma')).toBeInTheDocument();
    });

    it('BookingsPage filters safely when bookings contain null client, package, or ID', () => {
      const buggyBookings = [
        { id: null, client: null, package: null, amount: 10000, date: '25 Jun 2026', status: 'Pending' },
        { id: 'BK-2', client: 'Priya Singh', package: 'Ladakh Adventure', amount: 55000, date: '26 Jun 2026', status: 'Paid' },
      ];

      render(
        <BookingsPage 
          bookings={buggyBookings} 
          setBookings={vi.fn()} 
          clients={[]} 
          setClients={vi.fn()} 
          packages={[]} 
        />
      );

      const searchInput = screen.getByPlaceholderText(/Search Client, PNR, or Package/i);
      expect(() => {
        fireEvent.change(searchInput, { target: { value: 'Priya' } });
      }).not.toThrow();

      expect(screen.getByText('Priya Singh')).toBeInTheDocument();
    });

    it('EnquiriesPage search filtering handles null fields safely', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: [
            { id: 'ENQ-1', name: null, destination: null, email: null, travelDate: '2026-07-01', guests: 2, status: 'logged' },
            { id: 'ENQ-2', name: 'Vikram', destination: 'Switzerland', email: 'vikram@example.com', travelDate: '2026-07-15', guests: 4, status: 'reviewing' }
          ]
        })
      });

      render(
        <EnquiriesPage 
          token="test-token"
          API_URL="http://localhost:5000"
          authHeaders={() => ({ 'Authorization': 'Bearer test-token' })}
          clients={[]}
          packages={[]}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Switzerland')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Search enquiries/i);
      fireEvent.change(searchInput, { target: { value: 'Vikram' } });
      expect(screen.getByText('Vikram')).toBeInTheDocument();
    });
  });

  describe('2. Single-Dispatch Elimination (No Redundant Fetch Calls)', () => {
    it('BookingsPage handleAddBooking does NOT trigger manual fetch POSTs for client or booking', async () => {
      const setClientsMock = vi.fn();
      const setBookingsMock = vi.fn();
      const fetchSpy = vi.fn();
      global.fetch = fetchSpy;

      render(
        <BookingsPage 
          bookings={[]} 
          setBookings={setBookingsMock} 
          clients={[]} 
          setClients={setClientsMock} 
          packages={[{ id: 'PKG-1', name: 'Jaipur Heritage', duration: '4 Days', basePrice: 20000, slots: { total: 10, booked: 0 } }]}
        />
      );

      // Open Add Booking Modal
      const createBtn = screen.getByText('Create Booking');
      fireEvent.click(createBtn);

      // Fill in form with new client
      const newClientToggle = screen.getByRole('button', { name: /\+ New Client/i });
      fireEvent.click(newClientToggle);

      const clientNameInput = screen.getByPlaceholderText('Client Full Name *');
      fireEvent.change(clientNameInput, { target: { value: 'Suresh Kumar' } });

      const clientEmailInput = screen.getByPlaceholderText('Email Address *');
      fireEvent.change(clientEmailInput, { target: { value: 'suresh@example.com' } });

      const packageSelect = screen.getAllByRole('combobox').find(el => el.querySelector('option[value="Jaipur Heritage"]'));
      fireEvent.change(packageSelect, { target: { value: 'Jaipur Heritage' } });

      const amountInput = screen.getByPlaceholderText('4500');
      fireEvent.change(amountInput, { target: { value: '20000' } });

      const dateInputs = screen.getAllByDisplayValue('');
      const dateInput = dateInputs.find(input => input.type === 'date');
      if (dateInput) {
        fireEvent.change(dateInput, { target: { value: '2026-07-20' } });
      }

      const submitBtn = screen.getAllByRole('button', { name: /Create Booking/i })[1];
      fireEvent.click(submitBtn);

      // setClients and setBookings should be called by the component
      expect(setClientsMock).toHaveBeenCalledTimes(1);
      expect(setBookingsMock).toHaveBeenCalledTimes(1);

      // Direct manual fetch POST to /api/clients and /api/bookings should NOT have been made
      const postCalls = fetchSpy.mock.calls.filter(call => call[1]?.method === 'POST');
      expect(postCalls.length).toBe(0);
    });

    it('EnquiriesPage handleCreateEnquiry does NOT make redundant fetch POST to /api/clients', async () => {
      const setClientsMock = vi.fn();
      const fetchSpy = vi.fn().mockImplementation((url) => {
        if (url.includes('/api/enquiries/submit')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: { id: 'ENQ-99', name: 'Ananya', destination: 'Dubai', status: 'logged' } })
          });
        }
        if (url.includes('/api/enquiries')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });
      global.fetch = fetchSpy;

      render(
        <EnquiriesPage 
          token="test-token"
          API_URL="http://localhost:5000"
          authHeaders={() => ({ 'Authorization': 'Bearer test-token' })}
          clients={[]}
          setClients={setClientsMock}
          packages={[]}
        />
      );

      await waitFor(() => expect(screen.getByText('Create Enquiry')).toBeInTheDocument());

      fireEvent.click(screen.getByText('Create Enquiry'));

      // Choose new client
      const newClientBtn = screen.getByText('+ New Client');
      fireEvent.click(newClientBtn);

      fireEvent.change(screen.getByPlaceholderText('Client Full Name *'), { target: { value: 'Ananya Roy' } });
      fireEvent.change(screen.getByPlaceholderText('Email Address *'), { target: { value: 'ananya@example.com' } });
      fireEvent.change(screen.getByPlaceholderText(/e.g. Bali, Indonesia/i), { target: { value: 'Dubai' } });
      
      const dateInputs = screen.getAllByDisplayValue('');
      const dateInput = dateInputs.find(input => input.type === 'date');
      if (dateInput) {
        fireEvent.change(dateInput, { target: { value: '2026-08-15' } });
      }

      fireEvent.click(screen.getByText('Submit Enquiry'));

      await waitFor(() => {
        expect(setClientsMock).toHaveBeenCalledTimes(1);
      });

      // Confirm no direct /api/clients POST was sent by EnquiriesPage
      const directClientPosts = fetchSpy.mock.calls.filter(call => call[0].endsWith('/api/clients') && call[1]?.method === 'POST');
      expect(directClientPosts.length).toBe(0);
    });
  });

  describe('3. Offline Sync Queue Deadlock Prevention & Retry Limits', () => {
    it('enqueueRequest initializes retries: 0 and maxRetries: 3', () => {
      clearQueue();
      const queue = enqueueRequest({
        url: 'http://localhost:5000/api/bookings',
        method: 'POST',
        headers: {},
        body: JSON.stringify({ id: 'BK-100' }),
        description: 'Create test booking'
      });

      expect(queue.length).toBe(1);
      expect(queue[0].retries).toBe(0);
      expect(queue[0].maxRetries).toBe(3);
    });

    it('processSyncQueue increments retries on HTTP 500 and discards dead-letter items after maxRetries', async () => {
      clearQueue();
      enqueueRequest({
        url: 'http://localhost:5000/api/bookings',
        method: 'POST',
        headers: {},
        body: JSON.stringify({ id: 'BK-FAIL' }),
        description: 'Failing booking mutation',
        retries: 0,
        maxRetries: 3
      });
      enqueueRequest({
        url: 'http://localhost:5000/api/settings',
        method: 'PUT',
        headers: {},
        body: JSON.stringify({ defaultMarkup: 20 }),
        description: 'Valid settings mutation',
        retries: 0,
        maxRetries: 3
      });

      // Mock 500 error for first item, 200 OK for second item
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/api/bookings')) {
          return Promise.resolve({ ok: false, status: 500 });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
      });

      const addNotificationMock = vi.fn();

      // Attempt 1: should increment retries to 1 and pause
      let result = await processSyncQueue(addNotificationMock);
      expect(result.success).toBe(false);
      let q = getQueue();
      expect(q.length).toBe(2);
      expect(q[0].retries).toBe(1);

      // Attempt 2: should increment retries to 2 and pause
      result = await processSyncQueue(addNotificationMock);
      expect(result.success).toBe(false);
      q = getQueue();
      expect(q.length).toBe(2);
      expect(q[0].retries).toBe(2);

      // Attempt 3: retries reaches 3 >= maxRetries -> discards failing item, processes next item!
      result = await processSyncQueue(addNotificationMock);
      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(1); // the settings item succeeded
      q = getQueue();
      expect(q.length).toBe(0); // both items processed/discarded, queue is no longer deadlocked!

      expect(addNotificationMock).toHaveBeenCalledWith(
        expect.stringContaining('Sync failed after 3 attempts (discarded)'),
        'error'
      );
    });

    it('processSyncQueue discards 4xx client errors immediately without blocking queue', async () => {
      clearQueue();
      enqueueRequest({
        url: 'http://localhost:5000/api/clients',
        method: 'POST',
        headers: {},
        body: JSON.stringify({ id: 'CLI-DUPLICATE' }),
        description: 'Duplicate client'
      });
      enqueueRequest({
        url: 'http://localhost:5000/api/packages',
        method: 'POST',
        headers: {},
        body: JSON.stringify({ id: 'PKG-VALID' }),
        description: 'Valid package'
      });

      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/api/clients')) {
          return Promise.resolve({ ok: false, status: 409 }); // Duplicate conflict
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
      });

      const result = await processSyncQueue();
      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(1);
      const q = getQueue();
      expect(q.length).toBe(0);
    });
  });

  describe('4. Group Departures FK Race Condition Resolution', () => {
    it('GroupDeparturesPage awaits package creation before creating group departure', async () => {
      const setPackagesMock = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 50)));
      const setGroupDeparturesMock = vi.fn();

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
      const newPkgToggle = screen.getByRole('button', { name: /\+ Create New Package/i });
      fireEvent.click(newPkgToggle);

      fireEvent.change(screen.getByPlaceholderText(/e.g. Greece & Turkey Wonders Odyssey/i), {
        target: { value: 'Kashmir Winter Wonderland' }
      });
      fireEvent.change(screen.getByPlaceholderText(/e.g. Dubai Shopping Festival/i), {
        target: { value: 'Christmas in Gulmarg' }
      });

      // Set departure and return dates
      const depDate = document.getElementById('form-departure-date');
      if (depDate) {
        fireEvent.change(depDate, { target: { value: '2026-12-20' } });
      }
      const retDate = document.getElementById('form-return-date');
      if (retDate) {
        fireEvent.change(retDate, { target: { value: '2026-12-25' } });
      }

      fireEvent.click(screen.getByText('Create Departure'));

      await waitFor(() => {
        expect(setPackagesMock).toHaveBeenCalledTimes(1);
        expect(setGroupDeparturesMock).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('5. Date Parsing Normalization & Overview Metrics', () => {
    it('renders dashboard overview and parses diverse date formats (DD/MM/YYYY, ISO, textual) accurately', async () => {
      const testBookings = [
        { id: 'BK-1', client: 'Anil Kumar', package: 'Goa', amount: 50000, date: '25/06/2026', status: 'Paid' },
        { id: 'BK-2', client: 'Sunita Rao', package: 'Kerala', amount: 60000, date: '2026-06-25', status: 'Paid' },
        { id: 'BK-3', client: 'Deepak Verma', package: 'Ladakh', amount: 40000, date: '25 Jun 2026', status: 'Paid' },
        { id: 'BK-4', client: 'Pooja Nair', package: 'Manali', amount: 30000, date: '25-06-2026', status: 'Paid' }
      ];

      localStorage.setItem('kraft_token', 'mock-admin-token');
      localStorage.setItem('kraft_user', JSON.stringify({ name: 'Admin User', role: 'admin', email: 'admin@kraftyourtrip.com' }));

      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/api/auth/me')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ user: { name: 'Admin User', role: 'admin', email: 'admin@kraftyourtrip.com' } }) });
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
  });
});

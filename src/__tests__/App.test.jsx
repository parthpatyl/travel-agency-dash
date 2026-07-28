import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '../App';

describe('Admin Dashboard App Component', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/health')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'OK' }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });
    localStorage.clear();
  });

  it('renders login prompt or main dashboard header', async () => {
    render(<App />);
    const appElements = await screen.findAllByText(/Kraft|Dashboard|Sign In|Login/i);
    expect(appElements.length).toBeGreaterThan(0);
  });
});

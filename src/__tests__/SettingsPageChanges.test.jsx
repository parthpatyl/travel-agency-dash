import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import SettingsPage from '../components/SettingsPage'

describe('SettingsPage Dirty Tracking & Save Confirmation Modal', () => {
  const initialSettings = {
    agencyName: 'KRAFT YOUR TRIP',
    agencyAddress: '123 Luxury Way, Mumbai',
    agencyPhone: '+91 7046704693',
    agencyEmail: 'contact@kraftyourtrip.com',
    agencyTagline: 'Curating world-class journeys',
    workingHours: 'Mon - Sat: 9:00 AM - 7:00 PM IST',
    socialLinks: {
      whatsapp: 'https://wa.me/917046704693',
      instagram: 'https://instagram.com/kraftyourtrip'
    },
    heroSection: {
      titleMain: 'Kraft your perfect',
      titleItalic: 'journey.',
      description: 'Handcrafted travel to the worlds most extraordinary places',
      btnPrimaryText: 'Explore Packages',
      btnSecondaryText: 'Plan a Custom Trip',
      bgImage: '/photo-1.jpg',
      stats: [
        { value: '10+', label: 'Trips Crafted' },
        { value: '52%', label: 'Satisfaction' },
        { value: '40+', label: 'Destinations' }
      ]
    },
    aboutSection: {
      banner: {
        badge: 'Our Story',
        title: 'Curating bespoke travel',
        description: 'Founded on the belief that travel should be art.',
        bgImage: '/about-banner.jpg'
      },
      philosophy: {
        badge: 'Our Philosophy',
        heading: 'Bespoke travel curated down to the finest detail.',
        p1: 'Paragraph 1',
        p2: 'Paragraph 2',
        image: '/philosophy.jpg'
      },
      values: [
        { title: 'Bespoke Curation', desc: 'No two journeys are the same.' }
      ]
    }
  }

  const mockUser = { id: 1, role: 'admin' }

  it('keeps the Save button disabled when no changes are made', () => {
    render(
      <SettingsPage
        settings={initialSettings}
        setSettings={vi.fn()}
        user={mockUser}
        addNotification={vi.fn()}
      />
    )

    // Both Homepage Hero and CTA save buttons should be disabled initially
    const saveBtns = screen.getAllByRole('button', { name: /Saved \(No changes\)/i })
    expect(saveBtns.length).toBeGreaterThanOrEqual(2)
    saveBtns.forEach(btn => expect(btn).toBeDisabled())
  })

  it('enables the Save button when a field is edited, and shows HTML confirmation modal on save', async () => {
    let currentSettings = { ...initialSettings }
    const setSettingsMock = vi.fn().mockImplementation((updater) => {
      if (typeof updater === 'function') {
        currentSettings = updater(currentSettings)
      } else {
        currentSettings = updater
      }
      return Promise.resolve(currentSettings)
    })

    const { rerender } = render(
      <SettingsPage
        settings={currentSettings}
        setSettings={setSettingsMock}
        user={mockUser}
        addNotification={vi.fn()}
      />
    )

    // Find the Hero Main Title input and edit it
    const titleInput = screen.getByDisplayValue('Kraft your perfect')
    fireEvent.change(titleInput, { target: { value: 'Kraft your bespoke adventure' } })

    // Simulate parent state update
    currentSettings = {
      ...currentSettings,
      heroSection: {
        ...currentSettings.heroSection,
        titleMain: 'Kraft your bespoke adventure'
      }
    }

    rerender(
      <SettingsPage
        settings={currentSettings}
        setSettings={setSettingsMock}
        user={mockUser}
        addNotification={vi.fn()}
      />
    )

    // Save button should now be enabled and display unsaved count
    const saveBtn = screen.getByRole('button', { name: /Save Hero Changes \(1\)/i })
    expect(saveBtn).not.toBeDisabled()

    // Click Save Changes
    fireEvent.click(saveBtn)

    // Confirmation modal should appear with "Changes Saved Successfully"
    await waitFor(() => {
      expect(screen.getByText('Changes Saved Successfully')).toBeInTheDocument()
    })

    // It should display the modified field label and guarantee untouched fields
    expect(screen.getByText('Hero Main Title')).toBeInTheDocument()
    expect(screen.getByText('Kraft your bespoke adventure')).toBeInTheDocument()
    expect(screen.getByText(/All other fields and website sections remain preserved/i)).toBeInTheDocument()

    // Dismiss modal via "OK, Got it" button
    const okBtn = screen.getByRole('button', { name: /OK, Got it/i })
    fireEvent.click(okBtn)

    // Modal should close
    expect(screen.queryByText('Changes Saved Successfully')).not.toBeInTheDocument()
  })
})

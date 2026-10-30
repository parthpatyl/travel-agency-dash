import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getInitialRoute, TAB_PATH_MAP, PATH_TAB_MAP } from '../App'

describe('Admin Clean Routing & Experience Suite', () => {
  beforeEach(() => {
    vi.stubGlobal('location', {
      pathname: '/',
      hash: '',
    })
  })

  it('correctly maps all tabs to clean pathnames', () => {
    expect(TAB_PATH_MAP.enquiries).toBe('/enquiries')
    expect(TAB_PATH_MAP.bookings).toBe('/bookings')
    expect(TAB_PATH_MAP.clients).toBe('/clients')
    expect(TAB_PATH_MAP.reports).toBe('/reports')
    expect(TAB_PATH_MAP.navigation).toBe('/navigation')
    expect(TAB_PATH_MAP.settings).toBe('/settings')
    expect(TAB_PATH_MAP.corporatePackages).toBe('/corporate-packages')
    expect(TAB_PATH_MAP.groupDepartures).toBe('/group-departures')
  })

  it('resolves tab from clean pathname', () => {
    window.location.pathname = '/enquiries'
    window.location.hash = ''
    expect(getInitialRoute()).toEqual({ tab: 'enquiries', enquiryId: null })

    window.location.pathname = '/bookings'
    expect(getInitialRoute()).toEqual({ tab: 'bookings', enquiryId: null })

    window.location.pathname = '/corporate-packages'
    expect(getInitialRoute()).toEqual({ tab: 'corporatePackages', enquiryId: null })
  })

  it('resolves direct enquiry deep link /enquiries/:id', () => {
    window.location.pathname = '/enquiries/ENQ-88219'
    window.location.hash = ''
    expect(getInitialRoute()).toEqual({ tab: 'enquiries', enquiryId: 'ENQ-88219' })
  })

  it('supports legacy hash URLs for backward compatibility (#enquiries)', () => {
    window.location.pathname = '/'
    window.location.hash = '#enquiries'
    expect(getInitialRoute()).toEqual({ tab: 'enquiries', enquiryId: null })

    window.location.hash = '#bookings'
    expect(getInitialRoute()).toEqual({ tab: 'bookings', enquiryId: null })
  })

  it('defaults to dashboard for root path', () => {
    window.location.pathname = '/'
    window.location.hash = ''
    expect(getInitialRoute()).toEqual({ tab: 'dashboard', enquiryId: null })
  })
})

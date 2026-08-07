import { describe, it, expect } from 'vitest'
import { formatTravelMarkdown, splitBulletedItems, flattenBulletedItems } from '../utils/markdownUtils'

describe('markdownUtils', () => {
  it('converts inline bullet points to markdown lists', () => {
    const raw = "Explore landmarks: • Presidential Palace – Head • Notre Dame Cathedral • Central Post Office"
    const formatted = formatTravelMarkdown(raw)
    expect(formatted).toContain('- Presidential Palace')
    expect(formatted).toContain('- Notre Dame Cathedral')
    expect(formatted).toContain('- Central Post Office')
  })

  it('formats uppercase section headers into markdown H3s', () => {
    const raw = "Welcome to tour. CONTRACT: All tours operate... TAXATION: 5% GST applicable."
    const formatted = formatTravelMarkdown(raw)
    expect(formatted).toContain('### CONTRACT')
    expect(formatted).toContain('### TAXATION')
  })

  it('formats key travel labels into bold labels', () => {
    const raw = "Check-in Time: 15:00 hrs. Meals: Breakfast & Dinner. Guide: English Speaking. Overnight stay: in Ho Chi Minh City."
    const formatted = formatTravelMarkdown(raw)
    expect(formatted).toContain('**Meals:** Breakfast & Dinner')
    expect(formatted).toContain('**Guide:** English Speaking')
    expect(formatted).toContain('**Overnight stay:** in Ho Chi Minh City')
  })

  it('splits bulleted text into separate array items', () => {
    const text = "Main Flights Included • 4* Hotel • Transfers • Meals included"
    const items = splitBulletedItems(text)
    expect(items).toEqual([
      'Main Flights Included',
      '4* Hotel',
      'Transfers',
      'Meals included'
    ])
  })

  it('flattens array of items containing embedded bullets', () => {
    const items = [
      'Main Flights Included',
      'Accommodation on twin share • English Speaking Guide • All entrance fees'
    ]
    const flattened = flattenBulletedItems(items)
    expect(flattened).toEqual([
      'Main Flights Included',
      'Accommodation on twin share',
      'English Speaking Guide',
      'All entrance fees'
    ])
  })
})

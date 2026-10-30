import { describe, it, expect } from 'vitest'
import {
  validateEmail,
  validatePhone,
  validateName,
  validateNumber,
  validatePrice,
  validateGuests,
  validatePercentage,
  validateRating,
  validateInteger
} from '../utils/validation'

describe('Admin Dashboard Validation Suite', () => {
  describe('Email Verification', () => {
    it('accepts genuine staff and client email addresses', () => {
      expect(validateEmail('operations@kraftyourtrip.com').isValid).toBe(true)
      expect(validateEmail('sarah.connor@cyberdyne.org').isValid).toBe(true)
      expect(validateEmail('guest.vip@luxurytravels.in').isValid).toBe(true)
    })

    it('rejects malformed email formats', () => {
      expect(validateEmail('').isValid).toBe(false)
      expect(validateEmail('no-at-sign.com').isValid).toBe(false)
      expect(validateEmail('missing-domain@').isValid).toBe(false)
      expect(validateEmail('@domain.com').isValid).toBe(false)
      expect(validateEmail('double..dots@domain.com').isValid).toBe(false)
    })

    it('blocks disposable and temporary email addresses', () => {
      expect(validateEmail('user@mailinator.com').isValid).toBe(false)
      expect(validateEmail('test@tempmail.com').isValid).toBe(false)
      expect(validateEmail('someone@sharklasers.com').isValid).toBe(false)
    })

    it('blocks fake dummy prefix and domain combinations', () => {
      expect(validateEmail('test@test.com').isValid).toBe(false)
      expect(validateEmail('admin@example.com').isValid).toBe(false)
      expect(validateEmail('dummy@dummy.com').isValid).toBe(false)
    })
  })

  describe('Phone Number & Country Code Verification', () => {
    it('enforces exact 10 digits for Indian phone numbers (+91)', () => {
      const validIndia = validatePhone('9876543210', '+91')
      expect(validIndia.isValid).toBe(true)
      expect(validIndia.cleanDigits).toBe('9876543210')

      const shortIndia = validatePhone('987654321', '+91')
      expect(shortIndia.isValid).toBe(false)
      expect(shortIndia.error).toMatch(/Indian phone numbers must be exactly 10 digits/i)

      const longIndia = validatePhone('98765432100', '+91')
      expect(longIndia.isValid).toBe(false)
      expect(longIndia.error).toMatch(/Indian phone numbers must be exactly 10 digits/i)
    })

    it('handles prefixed international phone numbers (+91, +1, +44)', () => {
      expect(validatePhone('+919876543210').isValid).toBe(true)
      expect(validatePhone('+12025550188').isValid).toBe(true)
      expect(validatePhone('+447911123456').isValid).toBe(true)
    })

    it('blocks repeated identical digits and sequential ascending numbers', () => {
      expect(validatePhone('0000000000', '+91').isValid).toBe(false)
      expect(validatePhone('1111111111', '+91').isValid).toBe(false)
      expect(validatePhone('1234567890', '+91').isValid).toBe(false)
    })
  })

  describe('Numerical Fields & Financial Rules Verification', () => {
    it('validates prices, discounts and wallet amounts', () => {
      expect(validatePrice(0).isValid).toBe(true)
      expect(validatePrice(250000).isValid).toBe(true)
      expect(validatePrice('15000.50').isValid).toBe(true)
      expect(validatePrice(-50).isValid).toBe(false)
      expect(validatePrice('invalid-amount').isValid).toBe(false)
    })

    it('validates percentage boundaries (0 to 100%)', () => {
      expect(validatePercentage(0).isValid).toBe(true)
      expect(validatePercentage(15).isValid).toBe(true)
      expect(validatePercentage(100).isValid).toBe(true)
      expect(validatePercentage(-1).isValid).toBe(false)
      expect(validatePercentage(101).isValid).toBe(false)
    })

    it('validates guest counts (1 to 500 integers)', () => {
      expect(validateGuests(1).isValid).toBe(true)
      expect(validateGuests(25).isValid).toBe(true)
      expect(validateGuests(0).isValid).toBe(false)
      expect(validateGuests(-3).isValid).toBe(false)
      expect(validateGuests(2.5).isValid).toBe(false)
    })

    it('validates ratings (1 to 5 integers)', () => {
      expect(validateRating(5).isValid).toBe(true)
      expect(validateRating(1).isValid).toBe(true)
      expect(validateRating(0).isValid).toBe(false)
      expect(validateRating(6).isValid).toBe(false)
    })

    it('validates integer fields with min bounds', () => {
      expect(validateInteger(10, { min: 0 }).isValid).toBe(true)
      expect(validateInteger(-1, { min: 0 }).isValid).toBe(false)
      expect(validateInteger(10.5, { min: 0 }).isValid).toBe(false)
    })
  })
})

// Credential & Contact Validation Utilities for Kraft Admin Dashboard

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'tempmail.com', 'mailinator.com', 'guerrillamail.com', '10minutemail.com',
  'throwawaymail.com', 'yopmail.com', 'trashmail.com', 'sharklasers.com',
  'getairmail.com', 'dispostable.com', 'fake.com', 'temp-mail.org'
])

const DUMMY_EMAIL_PREFIXES = new Set([
  'test', 'testing', 'admin', 'user', 'asdf', 'fake', 'dummy', 'sample'
])

export function validateEmail(email) {
  const raw = (email || '').trim()
  if (!raw) return { isValid: false, error: 'Email address is required' }
  const rfcRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/
  if (!rfcRegex.test(raw) || raw.includes('..')) {
    return { isValid: false, error: 'Please enter a valid email address (e.g. name@domain.com)' }
  }
  const [localPart, domainPart] = raw.toLowerCase().split('@')
  if (DISPOSABLE_EMAIL_DOMAINS.has(domainPart)) {
    return { isValid: false, error: 'Disposable email addresses are not accepted' }
  }
  if (DUMMY_EMAIL_PREFIXES.has(localPart) && (domainPart === 'test.com' || domainPart === 'example.com')) {
    return { isValid: false, error: 'Please enter a genuine client email address' }
  }
  return { isValid: true, normalized: raw.toLowerCase() }
}

export function validatePhone(phone, defaultCode = '+91') {
  const raw = (phone || '').toString().trim()
  if (!raw) return { isValid: false, error: 'Phone number is required' }
  const cleanDigits = raw.replace(/\D/g, '')
  if (!cleanDigits) return { isValid: false, error: 'Phone number must contain digits' }
  if (/^(\d)\1+$/.test(cleanDigits)) {
    return { isValid: false, error: 'Phone number cannot contain all identical digits' }
  }
  if (cleanDigits.length < 7 || cleanDigits.length > 15) {
    return { isValid: false, error: 'Phone number must be between 7 and 15 digits' }
  }
  return { isValid: true, cleanDigits, formatted: raw.startsWith('+') ? raw : `${defaultCode}${cleanDigits}` }
}

export function validateName(name) {
  const raw = (name || '').trim()
  if (!raw) return { isValid: false, error: 'Full name is required' }
  if (raw.length < 2) return { isValid: false, error: 'Name must be at least 2 characters' }
  if (!/^[a-zA-Z\s.'-]+$/.test(raw)) {
    return { isValid: false, error: 'Name should contain letters and spaces only' }
  }
  return { isValid: true, normalized: raw }
}

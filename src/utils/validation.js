// Credential, Contact & Number Validation Utilities for Kraft Admin Dashboard

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'tempmail.com', 'mailinator.com', 'guerrillamail.com', '10minutemail.com',
  'throwawaymail.com', 'yopmail.com', 'trashmail.com', 'sharklasers.com',
  'getairmail.com', 'dispostable.com', 'fake.com', 'temp-mail.org',
  'fakemailgenerator.com', 'inboxkitten.com', 'nada.ltd', 'mohmal.com',
  'emailondeck.com', 'mytemp.email', 'crazymailing.com'
])

const DUMMY_EMAIL_PREFIXES = new Set([
  'test', 'testing', 'admin', 'user', 'asdf', 'fake', 'dummy', 'sample', 'qwerty'
])

const SEQUENTIAL_ASC = '01234567890123456789'

const COUNTRY_PHONE_RULES = {
  '+91': { name: 'India', min: 10, max: 10, label: 'Indian phone numbers must be exactly 10 digits' },
  '+1': { name: 'US/Canada', min: 10, max: 10, label: 'US/Canada phone numbers must be exactly 10 digits' },
  '+44': { name: 'UK', min: 10, max: 11, label: 'UK phone numbers must be 10 or 11 digits' },
  '+971': { name: 'UAE', min: 9, max: 9, label: 'UAE phone numbers must be exactly 9 digits' },
  '+65': { name: 'Singapore', min: 8, max: 8, label: 'Singapore phone numbers must be exactly 8 digits' },
  '+61': { name: 'Australia', min: 9, max: 9, label: 'Australian phone numbers must be exactly 9 digits' }
}

export function validateEmail(email, options = {}) {
  const raw = (email || '').trim()
  if (!raw) return { isValid: false, error: 'Email address is required' }
  const rfcRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/
  if (!rfcRegex.test(raw) || raw.includes('..')) {
    return { isValid: false, error: 'Please enter a valid email address (e.g. name@domain.com)' }
  }
  const [localPart, domainPart] = raw.toLowerCase().split('@')
  if (!domainPart || !domainPart.includes('.')) {
    return { isValid: false, error: 'Please enter a valid email address with a domain' }
  }
  const tld = domainPart.split('.').pop()
  if (!tld || tld.length < 2 || !/^[a-z]+$/.test(tld)) {
    return { isValid: false, error: 'Please enter a valid email address' }
  }
  if (DISPOSABLE_EMAIL_DOMAINS.has(domainPart)) {
    return { isValid: false, error: 'Disposable email addresses are not accepted' }
  }
  if (DUMMY_EMAIL_PREFIXES.has(localPart) && (domainPart === 'test.com' || domainPart === 'example.com' || domainPart === 'dummy.com')) {
    return { isValid: false, error: 'Please enter a genuine client email address' }
  }
  return { isValid: true, normalized: raw.toLowerCase() }
}

export function validatePhone(phone, defaultCode = '+91') {
  const raw = (phone || '').toString().trim()
  if (!raw) return { isValid: false, error: 'Phone number is required' }
  const allDigits = raw.replace(/\D/g, '')
  if (!allDigits) return { isValid: false, error: 'Phone number must contain digits' }

  let cc = (defaultCode || '+91').toString().trim()
  if (!cc.startsWith('+')) cc = `+${cc}`
  let localDigits = allDigits

  if (raw.startsWith('+')) {
    const knownCodes = Object.keys(COUNTRY_PHONE_RULES).sort((a, b) => b.length - a.length)
    for (const code of knownCodes) {
      if (raw.startsWith(code)) {
        cc = code
        localDigits = raw.slice(code.length).replace(/\D/g, '')
        break
      }
    }
  } else if (allDigits.length > 10 && cc && allDigits.startsWith(cc.replace('+', ''))) {
    localDigits = allDigits.slice(cc.replace('+', '').length)
  }

  // Check for repeated identical digits
  if (/^(\d)\1+$/.test(localDigits)) {
    return { isValid: false, error: 'Phone number cannot contain all identical digits' }
  }

  // Check for ascending sequential dummy numbers
  if (localDigits.length >= 8 && SEQUENTIAL_ASC.includes(localDigits)) {
    return { isValid: false, error: 'Sequential dummy phone numbers are not allowed' }
  }

  if (localDigits.length < 7 || localDigits.length > 15) {
    return { isValid: false, error: 'Phone number must be between 7 and 15 digits' }
  }

  const rule = COUNTRY_PHONE_RULES[cc]
  if (rule) {
    if (localDigits.length < rule.min || localDigits.length > rule.max) {
      return { isValid: false, error: rule.label }
    }
  }

  return { isValid: true, cleanDigits: localDigits, formatted: raw.startsWith('+') ? raw : `${cc}${localDigits}` }
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

export function validateNumber(value, options = {}) {
  const { min, max, integerOnly = false, fieldName = 'Value', required = true } = options
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    if (!required) return { isValid: true, value: null }
    return { isValid: false, error: `${fieldName} is required` }
  }
  const num = Number(value)
  if (isNaN(num) || !isFinite(num)) {
    return { isValid: false, error: `${fieldName} must be a valid number` }
  }
  if (integerOnly && !Number.isInteger(num)) {
    return { isValid: false, error: `${fieldName} must be a whole number` }
  }
  if (min !== undefined && num < min) {
    return { isValid: false, error: `${fieldName} must be at least ${min}` }
  }
  if (max !== undefined && num > max) {
    return { isValid: false, error: `${fieldName} cannot exceed ${max}` }
  }
  return { isValid: true, value: num }
}

export function validatePrice(value, fieldName = 'Price') {
  return validateNumber(value, { min: 0, fieldName })
}

export function validateGuests(value) {
  return validateNumber(value, { min: 1, max: 500, integerOnly: true, fieldName: 'Number of guests' })
}

export function validatePercentage(value, fieldName = 'Percentage') {
  return validateNumber(value, { min: 0, max: 100, fieldName })
}

export function validateRating(value) {
  return validateNumber(value, { min: 1, max: 5, integerOnly: true, fieldName: 'Rating' })
}

export function validateInteger(value, options = {}) {
  return validateNumber(value, { ...options, integerOnly: true })
}

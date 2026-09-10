import { describe, it, expect } from 'vitest'
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  formatDeviceCode,
  normalizeDeviceCode,
} from '../deviceCode'

describe('the pairing code alphabet', () => {
  it('matches the alphabet the API issues codes from', () => {
    // Pinned to the literal, not to the rules behind it: the API draws codes
    // from this exact string, and a character either side disagrees about is a
    // tablet that cannot be paired.
    expect(CODE_ALPHABET).toBe('23456789CDFHJKMNPQRTVWXY')
    expect(CODE_ALPHABET).toHaveLength(24)
    expect(CODE_LENGTH).toBe(8)
  })

  it('contains no vowel and no lookalike', () => {
    for (const excluded of '0O1ILAEIOUBGSZ') {
      expect(CODE_ALPHABET).not.toContain(excluded)
    }
  })
})

describe('normalizeDeviceCode', () => {
  it('accepts a code exactly as the tablet shows it', () => {
    const result = normalizeDeviceCode('H4KP-9TQR')
    expect(result.code).toBe('H4KP9TQR')
    expect(result.isComplete).toBe(true)
    expect(result.invalidChars).toEqual([])
  })

  it('takes lower case, stray spacing and a missing hyphen', () => {
    expect(normalizeDeviceCode(' h4kp 9tqr ').code).toBe('H4KP9TQR')
    expect(normalizeDeviceCode('h4kp9tqr').code).toBe('H4KP9TQR')
  })

  it('folds the four letters that were dropped in favour of a digit', () => {
    // Somebody typing S/Z/B/G meant the 5/2/8/6 on the tablet; no code can
    // contain those letters, so there is exactly one thing they could mean.
    expect(normalizeDeviceCode('SZBG-CDFH').code).toBe('5286CDFH')
  })

  it('reports characters that could not be anything', () => {
    // The 1 is in there with the vowels on purpose: it is excluded from the
    // alphabet as a lookalike and, unlike S/Z/B/G, has nothing to fold onto.
    const result = normalizeDeviceCode('AEIO-1234')
    expect(result.invalidChars).toEqual(['A', 'E', 'I', 'O', '1'])
    expect(result.code).toBe('234')
    expect(result.isComplete).toBe(false)
  })

  it('lists each impossible character once', () => {
    expect(normalizeDeviceCode('AAAA').invalidChars).toEqual(['A'])
  })

  it('flags a ninth symbol rather than silently sending eight of nine', () => {
    const result = normalizeDeviceCode('H4KP9TQRC')
    expect(result.isOverflowing).toBe(true)
    expect(result.code).toBe('H4KP9TQR')
  })

  it('is empty for an empty field', () => {
    const result = normalizeDeviceCode('')
    expect(result).toEqual({
      code: '',
      invalidChars: [],
      isComplete: false,
      isOverflowing: false,
    })
  })
})

describe('formatDeviceCode', () => {
  it('hyphenates a full code the way the tablet does', () => {
    expect(formatDeviceCode('H4KP9TQR')).toBe('H4KP-9TQR')
  })

  it('leaves a part-typed code alone until there is a second half', () => {
    expect(formatDeviceCode('H4KP')).toBe('H4KP')
    expect(formatDeviceCode('H4KP9')).toBe('H4KP-9')
  })
})

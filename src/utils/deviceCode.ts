/**
 * Pairing-code handling for the /link tablet pairing page.
 *
 * A code is eight symbols drawn from a 24-symbol alphabet, and the API is the
 * other half of that agreement: it draws codes from exactly this alphabet, and
 * a code either side rejects is a tablet that cannot be paired. The alphabet
 * drops AEIOU so a code can never spell a word somebody has to read aloud,
 * 0/1/I/L as the classic lookalikes, and S/Z/B/G because they read as 5/2/8/6 —
 * in each of those four pairs the digit is kept and the letter dropped.
 */

export const CODE_ALPHABET = '23456789CDFHJKMNPQRTVWXY'
export const CODE_LENGTH = 8

/**
 * The four letters dropped in favour of a digit, folded back onto that digit.
 * Somebody reading a tablet across the room and typing `S` meant the `5` that
 * is on it, so the page takes it rather than calling them wrong.
 */
const FOLDED_LETTERS: Record<string, string> = {
  S: '5',
  Z: '2',
  B: '8',
  G: '6',
}

export interface NormalizedCode {
  /** The normalised code — uppercase, unhyphenated, folded, truncated. */
  code: string
  /** Characters that are not in the alphabet and have nothing to fold onto. */
  invalidChars: string[]
  /** True when the code is exactly CODE_LENGTH alphabet symbols. */
  isComplete: boolean
  /** True when more than CODE_LENGTH symbols were given; `code` is truncated. */
  isOverflowing: boolean
}

/**
 * Uppercase, strip the display hyphen and any spacing, then fold S/Z/B/G onto
 * 5/2/8/6. Anything left over is a real error with no sensible guess behind it.
 */
export function normalizeDeviceCode(raw: string): NormalizedCode {
  const invalidChars: string[] = []
  let code = ''

  for (const rawChar of raw.toUpperCase()) {
    if (rawChar === '-' || /\s/.test(rawChar)) continue

    const char = FOLDED_LETTERS[rawChar] ?? rawChar
    if (CODE_ALPHABET.includes(char)) {
      code += char
    } else if (!invalidChars.includes(rawChar)) {
      invalidChars.push(rawChar)
    }
  }

  return {
    code: code.slice(0, CODE_LENGTH),
    invalidChars,
    isComplete: code.length >= CODE_LENGTH,
    isOverflowing: code.length > CODE_LENGTH,
  }
}

/** Display form: the tablet shows the code hyphenated in the middle. */
export function formatDeviceCode(code: string): string {
  if (code.length <= 4) return code
  return `${code.slice(0, 4)}-${code.slice(4)}`
}

/**
 * The tripwire for the two schemes.
 *
 * Every colour in this app resolves through a `--palette-*` custom property, and
 * that is the only reason a light scheme is possible at all: a `bg-black` renders
 * black under both, and one of them is wrong. The failure is not loud -- the app
 * builds, the tests pass, and one card in one corner of Settings stays dark on a
 * white page until somebody notices.
 *
 * So: no Tailwind palette colour, and no hex literal, anywhere in the app's
 * className strings. The table below is the vocabulary that replaced them.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(import.meta.dirname, '../src')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(entry) ? [path] : []
  })
}

/**
 * A colour utility naming Tailwind's own palette -- `bg-black`, `text-white`,
 * `border-neutral-800`, `hover:bg-red-500/10` -- or an arbitrary hex value.
 * Variant prefixes (`hover:`, `group-hover:`, `focus-visible:`) are part of the
 * match so the message points at the real spelling.
 */
const RAW_COLOR =
  /\b(?:[a-z-]+:)*(?:bg|text|border|divide|ring|ring-offset|outline|accent|caret|placeholder|fill|stroke|from|via|to|shadow)-(?:\[#[0-9a-fA-F]{3,8}\]|black|white|(?:slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d{2,3})?)(?:\/\d{1,3})?\b/g

describe('the colour vocabulary', () => {
  it('is the only one the app speaks', () => {
    const offenders: string[] = []

    for (const path of sourceFiles(SRC)) {
      readFileSync(path, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          for (const [match] of line.matchAll(RAW_COLOR)) {
            offenders.push(`${path.slice(SRC.length + 1)}:${i + 1}  ${match}`)
          }
        })
    }

    expect(
      offenders,
      'Use a palette token instead -- canvas, inset, surface-tile, surface-raised,\n' +
        'surface-hover(-strong), line(-faint|-strong), text-primary/secondary/muted/\n' +
        'subtle/faint, primary(-hover), on-primary, success(-strong|-hover), on-success,\n' +
        'danger(-solid|-solid-hover), on-danger, warning, pending, scrim.\n' +
        'They are declared for both schemes in packages/shared/theme.css.\n'
    ).toEqual([])
  })

  it('carries a hard-coded colour only where a shadow needs one, as a token', () => {
    // `shadow-[...]` is the one arbitrary value left, and every one of them reads
    // a --shadow-* property rather than spelling an rgba() -- a shadow is a
    // colour too, and a 50%-black one on a white page is a smudge.
    const shadows = sourceFiles(SRC)
      .flatMap((path) => [...readFileSync(path, 'utf8').matchAll(/shadow-\[[^\]]+\]/g)].map(([m]) => m))
      .filter((shadow) => !shadow.startsWith('shadow-[var(--shadow-'))

    expect(shadows).toEqual([])
  })
})

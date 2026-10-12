/**
 * Lives outside src/ for the same reason tests/manifest.test.ts does: it reads files off
 * disk, and tsconfig.app.json deliberately has no node types.
 *
 * The web-font request in index.html is render-blocking CSS on every cold load, and each
 * weight in it is a face the browser may fetch. It used to ask for weights and a whole
 * monospace family nothing used. This keeps it to what the classes in src/ need -- and
 * fails the other way too, because a weight that is used but not requested renders in a
 * fallback face with no error anywhere.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const indexHtml = readFileSync(join(ROOT, 'index.html'), 'utf8')

const WEIGHT_CLASSES: Record<string, number> = {
  'font-thin': 100,
  'font-extralight': 200,
  'font-light': 300,
  'font-normal': 400,
  'font-medium': 500,
  'font-semibold': 600,
  'font-bold': 700,
  'font-extrabold': 800,
  'font-black': 900,
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path)
    return /\.(tsx?|css)$/.test(name) ? [path] : []
  })
}

function requestedInterWeights(): number[] {
  const href = indexHtml.match(/href="(https:\/\/fonts\.googleapis\.com\/css2\?[^"]+)"/)?.[1]
  expect(href, 'index.html requests no Google font').toBeDefined()
  const inter = href!.match(/family=Inter:wght@([\d;]+)/)?.[1]
  expect(inter, 'the font request does not name Inter weights').toBeDefined()
  return inter!.split(';').map(Number)
}

describe('the web-font request in index.html', () => {
  it('asks for exactly the Inter weights the app uses, plus the 400 body weight', () => {
    const used = new Set<number>([400])
    for (const file of sourceFiles(join(ROOT, 'src'))) {
      for (const match of readFileSync(file, 'utf8').matchAll(/\bfont-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b/g)) {
        used.add(WEIGHT_CLASSES[match[0]])
      }
    }

    expect(requestedInterWeights()).toEqual([...used].sort((a, b) => a - b))
  })

  it('does not load a family nothing sets', () => {
    expect(indexHtml).not.toContain('Source+Code+Pro')
    expect(indexHtml).toContain('display=swap')
  })
})

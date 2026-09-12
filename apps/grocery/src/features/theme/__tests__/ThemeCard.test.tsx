import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeCard } from '../components/ThemeCard'
import { ThemeProvider } from '../context/ThemeContext'
import { storage } from '@/utils/storage'
import { STORAGE_KEYS } from '@/config/storageKeys'

function renderCard() {
  return render(
    <ThemeProvider>
      <ThemeCard />
    </ThemeProvider>
  )
}

beforeEach(() => {
  document.documentElement.removeAttribute('data-theme')
})

describe('the scheme picker', () => {
  it('starts on system, which is what an existing user has never chosen away from', () => {
    renderCard()

    expect(screen.getByRole('radio', { name: 'System' })).toBeChecked()
  })

  it('resolves system to dark where nothing can answer the question', () => {
    // jsdom has no matchMedia, which is the same position an embedded browser is
    // in. This app was dark for its whole life, so dark is the answer.
    renderCard()

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(screen.getByText(/currently dark/)).toBeInTheDocument()
  })

  it('flips the document as soon as a scheme is picked', async () => {
    renderCard()

    await userEvent.click(screen.getByRole('radio', { name: 'Light' }))

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(screen.getByRole('radio', { name: 'Light' })).toBeChecked()
  })

  it('remembers the choice for the next launch', async () => {
    renderCard()

    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }))

    expect(storage.getItem(STORAGE_KEYS.THEME, 'system')).toBe('dark')
  })

  it('reads back a stored choice', () => {
    storage.setItem(STORAGE_KEYS.THEME, 'light')

    renderCard()

    expect(screen.getByRole('radio', { name: 'Light' })).toBeChecked()
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('ignores a stored value it does not recognise rather than rendering nothing', () => {
    storage.setItem(STORAGE_KEYS.THEME, 'solarized')

    renderCard()

    expect(screen.getByRole('radio', { name: 'System' })).toBeChecked()
  })
})

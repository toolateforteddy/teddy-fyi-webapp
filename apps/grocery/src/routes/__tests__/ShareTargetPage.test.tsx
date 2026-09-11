import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ShareTargetPage } from '../ShareTargetPage'
import { peekSharedItem } from '@/features/grocery/utils/sharedItem'

function renderShare(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/share" element={<ShareTargetPage />} />
        <Route path="/" element={<div>the list</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  localStorage.clear()
})

describe('ShareTargetPage', () => {
  it('parks the shared text and sends the user to the list', () => {
    renderShare('/share?title=Oat%20milk&url=https://x.test')

    expect(screen.getByText('the list')).toBeInTheDocument()
    expect(peekSharedItem()).toBe('Oat milk')
  })

  // A share sheet can hand over nothing useful; that is a plain launch, not an
  // error page.
  it('still lands on the list when there is nothing to take', () => {
    renderShare('/share')

    expect(screen.getByText('the list')).toBeInTheDocument()
    expect(peekSharedItem()).toBeNull()
  })
})

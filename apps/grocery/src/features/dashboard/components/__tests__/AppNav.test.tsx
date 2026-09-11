import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ShoppingBag, Calendar } from 'lucide-react'
import { AppNav, type NavItem } from '../AppNav'

const items: NavItem[] = [
  { path: '/', label: 'Need', icon: ShoppingBag },
  { path: '/planning', label: 'Planning', icon: Calendar },
]

function renderNav(placement: 'bottom' | 'rail', currentPath = '/', labelled = false) {
  return render(
    <MemoryRouter>
      <AppNav items={items} currentPath={currentPath} placement={placement} labelled={labelled} />
    </MemoryRouter>
  )
}

describe('AppNav', () => {
  it('renders every destination in both placements', () => {
    const { unmount } = renderNav('bottom')
    expect(screen.getByRole('link', { name: 'Need' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Planning' })).toBeInTheDocument()
    unmount()

    renderNav('rail')
    expect(screen.getByRole('link', { name: 'Need' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Planning' })).toBeInTheDocument()
  })

  it('marks the current destination for assistive tech', () => {
    renderNav('bottom', '/planning')
    expect(screen.getByRole('link', { name: 'Planning' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Need' })).not.toHaveAttribute('aria-current')
  })

  it('names its destinations in every variant', () => {
    // The labelled rail sets the name beside the icon rather than under it, so
    // the accessible name has to come out the same either way -- the two
    // arrangements are one navigation, not two.
    const { unmount } = renderNav('rail', '/', true)
    expect(screen.getByRole('link', { name: 'Need' })).toBeInTheDocument()
    expect(screen.getByRole('navigation').className).toContain('w-44')
    unmount()

    renderNav('rail', '/', false)
    expect(screen.getByRole('link', { name: 'Need' })).toBeInTheDocument()
    expect(screen.getByRole('navigation').className).toContain('w-[4.5rem]')
  })

  it('reserves no bottom-bar height when it renders as a rail', () => {
    const { unmount } = renderNav('bottom')
    expect(screen.getByRole('navigation').className).toContain('min-h-[68px]')
    unmount()

    renderNav('rail')
    expect(screen.getByRole('navigation').className).not.toContain('min-h-[68px]')
    expect(screen.getByRole('navigation').className).toContain('flex-col')
  })
})

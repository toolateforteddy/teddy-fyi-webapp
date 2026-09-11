import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HelpPage } from '@/routes/HelpPage'
import { HELP_SECTIONS } from '../content'

/**
 * The page is static, so the only things worth asserting are the ones that rot: that every
 * section in the content model actually reaches the screen (a `kind` the renderer forgets to
 * handle would silently drop a whole block), and that the three corrections this page exists
 * to make are still on it.
 */
describe('HelpPage', () => {
  const renderPage = () =>
    render(
      <MemoryRouter>
        <HelpPage />
      </MemoryRouter>
    )

  it('renders a heading for every section', () => {
    renderPage()

    HELP_SECTIONS.forEach(section => {
      expect(screen.getByRole('heading', { name: section.title })).toBeInTheDocument()
    })
  })

  it('renders every block of every section', () => {
    renderPage()

    const rendered = document.body.textContent ?? ''

    HELP_SECTIONS.forEach(section => {
      section.blocks.forEach(block => {
        switch (block.kind) {
          case 'text':
          case 'note':
            expect(rendered).toContain(block.body)
            break
          case 'gesture':
            expect(rendered).toContain(block.verb)
            expect(rendered).toContain(block.what)
            break
          case 'rows':
            block.rows.forEach(row => {
              expect(rendered).toContain(row.term)
              expect(rendered).toContain(row.detail)
            })
            break
        }
      })
    })
  })

  it('says that long press does nothing, which is the whole reason for the page', () => {
    renderPage()

    expect(screen.getByText('Not used anywhere in this app')).toBeInTheDocument()
  })

  it('warns that the sync frequency control is inert', () => {
    renderPage()

    expect(screen.getByText(/Has no effect today/)).toBeInTheDocument()
  })

  it('offers a way back to the list', () => {
    renderPage()

    expect(screen.getByRole('button', { name: 'Back to list' })).toBeInTheDocument()
  })
})

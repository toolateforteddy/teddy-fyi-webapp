/**
 * Publishes how much of the layout viewport the on-screen keyboard covers, as
 * `--keyboard-inset` on the root element, so fixed bottom surfaces -- the sheets and the
 * add-task bar -- can sit on top of it rather than under it.
 *
 * On Chrome for Android this is normally 0: the viewport meta's
 * `interactive-widget=resizes-content` shrinks the layout viewport itself, so `bottom: 0`
 * is already the top of the keyboard. It covers the browsers that ignore that key (iOS
 * Safari, older Chromes), where the keyboard only shrinks the visual viewport and a
 * bottom-anchored sheet would otherwise have its buttons underneath it.
 */
export function trackKeyboardInset(): void {
  const viewport = window.visualViewport
  if (!viewport) return
  const root = document.documentElement
  const update = () => {
    const covered = window.innerHeight - viewport.height - viewport.offsetTop
    root.style.setProperty('--keyboard-inset', `${Math.max(0, Math.round(covered))}px`)
  }
  viewport.addEventListener('resize', update)
  viewport.addEventListener('scroll', update)
  update()
}

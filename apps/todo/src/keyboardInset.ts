/**
 * Follows the on-screen keyboard, for the two things the page cannot learn from focus alone.
 *
 * `--keyboard-inset` on the root element is how much of the layout viewport the keyboard
 * covers, so fixed bottom surfaces -- the sheets and the add-task bar -- can sit on top of it
 * rather than under it. On Chrome for Android this is normally 0: the viewport meta's
 * `interactive-widget=resizes-content` shrinks the layout viewport itself, so `bottom: 0` is
 * already the top of the keyboard. It covers the browsers that ignore that key (iOS Safari,
 * older Chromes), where the keyboard only shrinks the visual viewport.
 *
 * And when the keyboard is put away -- Android's back gesture, or the keyboard's own hide
 * key -- the field keeps focus, so everything keyed to "typing" (the add-task bar's place,
 * the hidden tab bar) would stay as it is with nothing to type into. The focused field is
 * blurred then, which is what it means.
 */
const KEYBOARD_MIN_HEIGHT = 150

export function trackKeyboardInset(): void {
  const viewport = window.visualViewport
  if (!viewport) return
  const root = document.documentElement

  // The tallest the viewport has been at this width: the screen with no keyboard. Keyed by
  // width so a rotation starts over rather than reading landscape as a keyboard.
  let width = window.innerWidth
  let fullHeight = viewport.height
  let keyboardUp = false

  const update = () => {
    if (window.innerWidth !== width) {
      width = window.innerWidth
      fullHeight = viewport.height
    }
    fullHeight = Math.max(fullHeight, viewport.height)

    const covered = window.innerHeight - viewport.height - viewport.offsetTop
    root.style.setProperty('--keyboard-inset', `${Math.max(0, Math.round(covered))}px`)

    const up = fullHeight - viewport.height > KEYBOARD_MIN_HEIGHT
    if (keyboardUp && !up) {
      const active = document.activeElement
      if (active instanceof HTMLElement && (active.isContentEditable || active.matches('input, textarea, select'))) active.blur()
    }
    keyboardUp = up
  }
  viewport.addEventListener('resize', update)
  viewport.addEventListener('scroll', update)
  update()
}

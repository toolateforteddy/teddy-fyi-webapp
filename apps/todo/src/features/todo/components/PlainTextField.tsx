import { useEffect, useRef, type FocusEventHandler } from 'react'

/**
 * A one-line text field that is not an `<input>`.
 *
 * Chrome on Android pins its autofill bar (saved passwords, cards, addresses) above the
 * keyboard for every focused form control, and has ignored `autocomplete="off"` for it since
 * manual fallbacks shipped. In a todo app that bar is only ever in the way -- it sits over the
 * keyboard's suggestions and over the sheet you are typing in. Autofill only attaches to form
 * controls, so a contenteditable element is the one text field it leaves alone.
 *
 * It behaves like a controlled input: `value` in, `onChange` out, Enter submits the
 * enclosing form, and pastes arrive as plain text on one line.
 */
export function PlainTextField({
  value,
  onChange,
  label,
  placeholder,
  autoFocus,
  enterKeyHint = 'done',
  onFocus,
  onBlur,
  className,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder?: string
  autoFocus?: boolean
  enterKeyHint?: 'done' | 'enter' | 'go' | 'next' | 'previous' | 'search' | 'send'
  onFocus?: FocusEventHandler<HTMLDivElement>
  onBlur?: FocusEventHandler<HTMLDivElement>
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  // Only write the DOM when it disagrees, e.g. cleared after a submit: rewriting it on every
  // keystroke would throw the caret back to the start.
  useEffect(() => {
    const el = ref.current
    if (el && el.textContent !== value) el.textContent = value
  }, [value])

  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])

  // Android keyboards often send Enter as an input event with no usable keydown, so a new line
  // is refused here too, and becomes the submit it would have been in an <input>. Native,
  // because React's onBeforeInput does not carry inputType.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onBeforeInput = (event: InputEvent) => {
      if (event.inputType === 'insertParagraph' || event.inputType === 'insertLineBreak') {
        event.preventDefault()
        el.closest('form')?.requestSubmit()
      }
    }
    el.addEventListener('beforeinput', onBeforeInput)
    return () => el.removeEventListener('beforeinput', onBeforeInput)
  }, [])

  return (
    <div
      ref={ref}
      role="textbox"
      aria-label={label}
      aria-multiline="false"
      contentEditable
      suppressContentEditableWarning
      spellCheck
      autoCapitalize="sentences"
      enterKeyHint={enterKeyHint}
      data-placeholder={placeholder}
      onInput={(event) => {
        const text = (event.currentTarget.textContent ?? '').replace(/\n/g, ' ')
        // An emptied contenteditable can keep a stray <br>; clear it so :empty shows the placeholder.
        if (text === '') event.currentTarget.textContent = ''
        onChange(text)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
          event.preventDefault()
          event.currentTarget.closest('form')?.requestSubmit()
        }
      }}
      onPaste={(event) => {
        event.preventDefault()
        const text = event.clipboardData.getData('text/plain').replace(/\s*\n\s*/g, ' ')
        document.execCommand('insertText', false, text)
      }}
      onFocus={onFocus}
      onBlur={onBlur}
      className={`plain-text-field ${className ?? ''}`}
    />
  )
}

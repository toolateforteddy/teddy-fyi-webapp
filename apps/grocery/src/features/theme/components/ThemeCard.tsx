import { Monitor, Moon, Sun } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useTheme } from '../hooks/useTheme'
import { THEME_PREFERENCES } from '../theme'
import type { ThemePreference } from '../theme'

const OPTIONS: Record<ThemePreference, { label: string; Icon: LucideIcon }> = {
  system: { label: 'System', Icon: Monitor },
  light: { label: 'Light', Icon: Sun },
  dark: { label: 'Dark', Icon: Moon },
}

/**
 * The scheme picker in Settings.
 *
 * Three choices rather than a switch, because "follow the phone" is a real
 * answer and a two-state toggle cannot express it -- a phone that turns dark at
 * sunset should take the app with it unless somebody has said otherwise.
 * 'system' is the default, so an existing user who never opens this sees dark
 * exactly as before unless their OS says light.
 */
export function ThemeCard() {
  const { preference, setPreference } = useTheme()

  // A segmented control sized to sit at the end of a Settings row.
  return (
    <div
      role="radiogroup"
      aria-label="Colour scheme"
      className="flex shrink-0 rounded-lg border border-line bg-inset p-0.5"
    >
      {THEME_PREFERENCES.map((option) => {
        const { label, Icon } = OPTIONS[option]
        const isSelected = preference === option

        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => setPreference(option)}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer',
              isSelected
                ? 'bg-surface-tile text-primary shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        )
      })}
    </div>
  )
}

export default ThemeCard

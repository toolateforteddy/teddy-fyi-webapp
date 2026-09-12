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
  const { preference, resolved, setPreference } = useTheme()

  return (
    <div className="bg-surface-tile border border-line-faint rounded-xl p-4 space-y-3">
      <div
        role="radiogroup"
        aria-label="Colour scheme"
        className="grid grid-cols-3 gap-2"
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
                'flex flex-col items-center justify-center gap-1.5 py-3 rounded-lg border text-xs font-bold transition-all active:scale-[0.99] cursor-pointer',
                isSelected
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-surface-raised border-line text-text-muted hover:bg-surface-hover hover:text-text-primary'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          )
        })}
      </div>

      <p className="text-[11px] text-text-muted">
        {preference === 'system'
          ? `Following this device, which is currently ${resolved}.`
          : `Always ${preference}, on this device. Other devices keep their own setting.`}
      </p>
    </div>
  )
}

export default ThemeCard

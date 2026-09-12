import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { NavPlacement } from '@/hooks/useAppLayout'

export interface NavItem {
  path: string
  label: string
  icon: LucideIcon
}

interface AppNavProps {
  items: NavItem[]
  currentPath: string
  /**
   * 'bottom' is the thumb-reachable bar for portrait. 'rail' is the vertical
   * strip used when the viewport is too short for a bar to be worth 68px of
   * height -- a phone in landscape -- and on anything tablet-sized or larger.
   */
  placement: NavPlacement
  /**
   * Whether the rail is wide enough to set its labels beside the icons rather
   * than under them. False on the landscape phone the rail started out for,
   * where the scarce dimension is width; true on a tablet, which is where the
   * Android app's rail also stops being a strip of icons.
   */
  labelled?: boolean
}

export function AppNav({ items, currentPath, placement, labelled = false }: AppNavProps) {
  const isRail = placement === 'rail'
  const isWideRail = isRail && labelled

  return (
    <nav
      aria-label="Primary"
      className={cn(
        'app-chrome shrink-0 bg-canvas/90 backdrop-blur-lg flex z-40',
        isRail
          ? // The rail owns the left safe-area inset, since in landscape that is
            // where the notch sits.
            'flex-col gap-1 border-r border-line-faint pl-[env(safe-area-inset-left)] py-2 shadow-[var(--shadow-rail)]'
          : 'items-center justify-around px-2 min-h-[68px] border-t border-line-faint pb-[env(safe-area-inset-bottom)] shadow-[var(--shadow-bar)]',
        isRail &&
          (isWideRail
            ? // 11rem is the width of a destination name, which is the point of
              // the wide rail: "Planning" reads as a place to go rather than as a
              // caption under a glyph.
              'w-44 items-stretch px-2 pt-3'
            : 'w-[4.5rem] items-center justify-center')
      )}
    >
      {items.map((item) => {
        const Icon = item.icon
        const isActive = currentPath === item.path

        return (
          <Link
            key={item.path}
            to={item.path}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex rounded-xl transition-all cursor-pointer group active:scale-95',
              // 44px is the smallest comfortably tappable target; every variant
              // keeps it, and the wide rail spends the extra width on the label
              // rather than on a taller row.
              isWideRail
                ? 'flex-row items-center gap-3 h-12 px-2.5'
                : 'flex-col items-center justify-center',
              !isWideRail && (isRail ? 'w-14 h-11' : 'w-16 h-12'),
              isWideRail && isActive && 'bg-primary/10'
            )}
          >
            <div
              className={cn(
                'p-1.5 rounded-full transition-all group-hover:bg-surface-raised',
                isActive
                  ? isWideRail
                    ? 'text-primary'
                    : 'bg-primary/10 text-primary scale-110'
                  : 'text-text-muted'
              )}
            >
              <Icon className="w-5 h-5 transition-transform" />
            </div>
            <span
              className={cn(
                'font-medium tracking-wide transition-colors',
                isWideRail ? 'text-sm' : 'text-[10px] mt-1',
                isActive ? 'text-primary font-semibold' : 'text-text-muted group-hover:text-text-secondary'
              )}
            >
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}

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
   * height -- a phone in landscape, mostly.
   */
  placement: NavPlacement
}

export function AppNav({ items, currentPath, placement }: AppNavProps) {
  const isRail = placement === 'rail'

  return (
    <nav
      aria-label="Primary"
      className={cn(
        'app-chrome shrink-0 bg-black/90 backdrop-blur-lg flex z-40',
        isRail
          ? // The rail owns the left safe-area inset, since in landscape that is
            // where the notch sits.
            'flex-col items-center justify-center gap-1 w-[4.5rem] border-r border-[#1a1a1a] pl-[env(safe-area-inset-left)] py-2 shadow-[10px_0_20px_rgba(0,0,0,0.5)]'
          : 'items-center justify-around px-2 min-h-[68px] border-t border-[#1a1a1a] pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_20px_rgba(0,0,0,0.5)]'
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
              'flex flex-col items-center justify-center rounded-xl transition-all cursor-pointer group active:scale-95',
              // 44px is the smallest comfortably tappable target; the rail keeps
              // it while giving back the vertical space the bar was using.
              isRail ? 'w-14 h-11' : 'w-16 h-12'
            )}
          >
            <div
              className={cn(
                'p-1.5 rounded-full transition-all group-hover:bg-neutral-900',
                isActive ? 'bg-primary/10 text-primary scale-110' : 'text-text-muted'
              )}
            >
              <Icon className="w-5 h-5 transition-transform" />
            </div>
            <span
              className={cn(
                'text-[10px] font-medium tracking-wide mt-1 transition-colors',
                isActive ? 'text-primary font-semibold' : 'text-text-muted group-hover:text-neutral-300'
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

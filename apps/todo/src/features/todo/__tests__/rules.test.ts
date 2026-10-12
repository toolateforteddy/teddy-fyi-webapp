import { describe, expect, it } from 'vitest'
import {
  addDays,
  formatTitle,
  nextRecurrenceTime,
  parseIso,
  plusMonths,
  positionChanges,
  recurrenceLabel,
  resetsDue,
  searchGroups,
  snoozeMonths,
  todayIso,
  viewGroups,
  type ViewOptions,
} from '../rules'
import { iconLigature } from '../icons'
import type { TodoItem } from '../types'

const NOW = new Date(2026, 9, 12, 14, 0).getTime() // Mon 12 Oct 2026, 14:00 local
const TODAY = '2026-10-12'

function item(overrides: Partial<TodoItem>): TodoItem {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    title: 'Task',
    isCompleted: false,
    createdAt: NOW - 1000,
    position: 0,
    scheduledDate: null,
    recurrenceRule: null,
    scheduledAt: NOW - 1000,
    userId: 'u',
    parentId: null,
    isDaily: false,
    dueDate: null,
    description: null,
    listId: null,
    priority: 0,
    icon: null,
    lastScheduledDate: null,
    syncState: 'SYNCED',
    version: 1,
    isDeleted: false,
    ...overrides,
  }
}

const view = (mode: ViewOptions['mode'], extra: Partial<ViewOptions> = {}): ViewOptions => ({
  mode,
  selectedListId: null,
  showCompletedOnly: false,
  recentlyCompleted: new Set(),
  now: NOW,
  ...extra,
})

describe('formatTitle', () => {
  it('title-cases words and keeps acronyms', () => {
    expect(formatTitle('  pay   rent ')).toBe('Pay Rent')
    expect(formatTitle('iPhone')).toBe('Iphone')
    expect(formatTitle('call the API')).toBe('Call The API')
    expect(formatTitle('"quoted" 42')).toBe('"Quoted" 42')
  })
})

describe('dates', () => {
  it('moves by calendar days and clamps months like Java', () => {
    expect(todayIso(NOW)).toBe(TODAY)
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(plusMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(plusMonths('2028-01-31', 1)).toBe('2028-02-29')
    expect(plusMonths('2026-11-15', 3)).toBe('2027-02-15')
  })

  it('snoozes a month-end task to the first of the month after rather than shortening it', () => {
    expect(snoozeMonths('2026-01-31', 1)).toBe('2026-03-01')
    expect(snoozeMonths('2028-01-30', 1)).toBe('2028-03-01')
    expect(snoozeMonths('2028-02-29', 12)).toBe('2029-03-01')
    expect(snoozeMonths('2026-12-15', 1)).toBe('2027-01-15')
  })
})

describe('recurrence', () => {
  it('labels the stored rules as Android does', () => {
    expect(recurrenceLabel('FREQ=DAILY;INTERVAL=1')).toBe('Every day')
    expect(recurrenceLabel('FREQ=DAILY;INTERVAL=3')).toBe('Every 3 days')
    expect(recurrenceLabel('FREQ=WEEKLY;BYDAY=MO,WE,FR')).toBe('Mon, Wed & Fri')
    expect(recurrenceLabel('FREQ=YEARLY')).toBe('Recurring')
    expect(recurrenceLabel(null)).toBeNull()
  })

  it('finds the next occurrence at local midnight', () => {
    expect(nextRecurrenceTime(NOW, 'FREQ=DAILY;INTERVAL=1')).toBe(parseIso('2026-10-13').getTime())
    expect(nextRecurrenceTime(NOW, 'FREQ=DAILY;INTERVAL=7')).toBe(parseIso('2026-10-19').getTime())
    // Monday: the next Tuesday or Thursday is tomorrow.
    expect(nextRecurrenceTime(NOW, 'FREQ=WEEKLY;BYDAY=TU,TH')).toBe(parseIso('2026-10-13').getTime())
    // Strictly after: Monday's next Monday is a week away.
    expect(nextRecurrenceTime(NOW, 'FREQ=WEEKLY;BYDAY=MO')).toBe(parseIso('2026-10-19').getTime())
    expect(nextRecurrenceTime(new Date(2026, 0, 31).getTime(), 'FREQ=MONTHLY;INTERVAL=1')).toBe(
      parseIso('2026-02-28').getTime(),
    )
  })
})

describe('viewGroups', () => {
  it('backlog is unscheduled, today is scheduled today, scheduled is the future', () => {
    const items = [
      item({ id: 'backlog' }),
      item({ id: 'today', scheduledDate: TODAY }),
      item({ id: 'future', scheduledDate: '2026-10-20' }),
    ]
    expect(viewGroups(items, view('BACKLOG')).map((g) => g.parent.id)).toEqual(['backlog'])
    expect(viewGroups(items, view('TODAY')).map((g) => g.parent.id)).toEqual(['today'])
    expect(viewGroups(items, view('SCHEDULED')).map((g) => g.parent.id)).toEqual(['future'])
    expect(viewGroups(items, view('PLANNING')).map((g) => g.parent.id).sort()).toEqual(['backlog', 'future', 'today'])
  })

  it('hides a recurring task until its next occurrence', () => {
    const waiting = item({ id: 'later', recurrenceRule: 'FREQ=DAILY;INTERVAL=1', scheduledAt: NOW + 86_400_000 })
    expect(viewGroups([waiting], view('BACKLOG'))).toEqual([])
  })

  it('keeps a just-completed task on screen, and the completed view shows only completed', () => {
    const done = item({ id: 'done', isCompleted: true })
    expect(viewGroups([done], view('BACKLOG'))).toEqual([])
    expect(viewGroups([done], view('BACKLOG', { recentlyCompleted: new Set(['done']) }))).toHaveLength(1)
    expect(viewGroups([done, item({ id: 'open' })], view('BACKLOG', { showCompletedOnly: true })).map((g) => g.parent.id)).toEqual(['done'])
  })

  it('puts rolled-over and high-priority tasks first', () => {
    const items = [
      item({ id: 'plain', position: 0 }),
      item({ id: 'starred', position: 5, priority: 2 }),
      item({ id: 'rolled', position: 9, lastScheduledDate: '2026-10-11' }),
    ]
    expect(viewGroups(items, view('BACKLOG')).map((g) => g.parent.id)).toEqual(['rolled', 'starred', 'plain'])
  })

  it('in today, shows a parent for a child scheduled today, with only that child', () => {
    const items = [
      item({ id: 'p' }),
      item({ id: 'c1', parentId: 'p', scheduledDate: TODAY }),
      item({ id: 'c2', parentId: 'p' }),
    ]
    const groups = viewGroups(items, view('TODAY'))
    expect(groups.map((g) => g.parent.id)).toEqual(['p'])
    expect(groups[0].children.map((c) => c.id)).toEqual(['c1'])
  })

  it('filters by space', () => {
    const items = [item({ id: 'a', listId: 'home' }), item({ id: 'b', listId: 'work' })]
    expect(viewGroups(items, view('BACKLOG', { selectedListId: 'work' })).map((g) => g.parent.id)).toEqual(['b'])
  })
})

describe('searchGroups', () => {
  it('ranks title matches, then subtask matches, then description matches, then completed', () => {
    const items = [
      item({ id: 'desc', title: 'Other', description: 'about milk' }),
      item({ id: 'sub', title: 'Shop' }),
      item({ id: 'subchild', title: 'Milk', parentId: 'sub' }),
      item({ id: 'title', title: 'Milk Run' }),
      item({ id: 'done', title: 'Milk', isCompleted: true }),
    ]
    expect(searchGroups(items, 'milk', null, NOW).map((g) => g.parent.id)).toEqual(['title', 'sub', 'desc', 'done'])
  })
})

describe('positionChanges', () => {
  const items = [item({ id: 'a', position: 0 }), item({ id: 'b', position: 1 }), item({ id: 'c', position: 2 })]
  it('swaps with a neighbour and moves past either end', () => {
    expect(positionChanges(items, items[1], 'up')).toEqual([['b', 0], ['a', 1]])
    expect(positionChanges(items, items[0], 'up')).toEqual([])
    expect(positionChanges(items, items[2], 'top')).toEqual([['c', -1]])
    expect(positionChanges(items, items[0], 'bottom')).toEqual([['a', 3]])
  })
})

describe('resetsDue', () => {
  it('rolls over once after midnight and re-arms dailies once after eight', () => {
    const yesterday = NOW - 86_400_000
    expect(resetsDue(yesterday, NOW)).toEqual({ rollover: true, daily: true })
    expect(resetsDue(NOW - 1000, NOW)).toEqual({ rollover: false, daily: false })
    const sevenAm = new Date(2026, 9, 12, 7).getTime()
    expect(resetsDue(new Date(2026, 9, 12, 1).getTime(), sevenAm)).toEqual({ rollover: false, daily: false })
  })
})

describe('iconLigature', () => {
  it('maps the stored names to Material Symbols ligatures', () => {
    expect(iconLigature('AttachMoney')).toBe('attach_money')
    expect(iconLigature('home')).toBe('home')
    expect(iconLigature('MedicalInformation')).toBe('medical_information')
    expect(iconLigature('NotAnIcon')).toBeNull()
    expect(iconLigature(null)).toBeNull()
  })
})

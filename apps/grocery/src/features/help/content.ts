/**
 * What the help screen says, as data rather than markup.
 *
 * Kept separate from the page for two reasons: the copy is the part that goes stale when a
 * gesture changes, so it should be reviewable without reading JSX around it; and the Android
 * client carries the same screen with its own (different) gestures, so having both apps hold
 * their help as a list of sections makes the two easy to diff when the clients converge.
 *
 * Every line here describes what this web client does today. Where a control exists but does
 * nothing, that is said rather than omitted -- a help page that quietly skips a control is how
 * somebody ends up assuming it works.
 */

/** The gestures this app actually uses. `press` exists only to say that it does nothing here. */
export type GestureKind = 'tap' | 'swipe' | 'scroll' | 'press'

export type HelpBlock =
  | { kind: 'text'; body: string }
  | { kind: 'gesture'; gesture: GestureKind; verb: string; what: string; then?: string }
  | { kind: 'rows'; rows: { term: string; detail: string }[] }
  | { kind: 'note'; body: string; tone?: 'info' | 'warn' }

export interface HelpSection {
  /** Stable anchor, also the React key. */
  id: string
  title: string
  blocks: HelpBlock[]
}

export const HELP_INTRO =
  'Most of this app is a tap. A few things are a tap on something that does not look tappable, which is what this page is for.'

export const HELP_TABS: { name: string; blurb: string }[] = [
  { name: 'Need', blurb: 'The list itself. Add items, adjust them, remove them.' },
  { name: 'Planning', blurb: "Re-add things you've bought before, one tap each." },
  { name: 'Shopping', blurb: "Pick the store you're standing in, then check items off." },
  { name: 'Settings', blurb: 'Stores, categories, your account, and the local cache.' },
]

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'gestures',
    title: 'Every gesture',
    blocks: [
      {
        kind: 'text',
        body: 'There are four, and two of them are just a tap. Nothing here responds to a long press.',
      },
      {
        kind: 'gesture',
        gesture: 'tap',
        verb: 'Tap an item tile',
        what: "Opens the item's edit drawer",
        then: 'Category, quantity and store availability all live in there. The tile gives no hint that it opens, which is why this is the one people miss.',
      },
      {
        kind: 'gesture',
        gesture: 'swipe',
        verb: 'Swipe an item tile left',
        what: 'Slides a red Delete button out from the right edge',
        then: 'Then tap the red button. The tile slides back if you let go early. Need list only, and only while the tile is closed.',
      },
      {
        kind: 'gesture',
        gesture: 'scroll',
        verb: 'Drag a row of chips sideways',
        what: 'Scrolls store chips that run off the edge',
        then: "The store row inside an item's drawer, and the store filter on Planning, both scroll when you have more stores than fit.",
      },
      {
        kind: 'gesture',
        gesture: 'press',
        verb: 'Long press',
        what: 'Not used anywhere in this app',
        then: "If you've been holding an item to change its store, that is why it never worked. Tap it instead.",
      },
    ],
  },
  {
    id: 'adding',
    title: 'Adding items',
    blocks: [
      {
        kind: 'gesture',
        gesture: 'tap',
        verb: 'Tap the + button',
        what: 'Bottom-right of the Need tab, opens the add sheet',
        then: "The button hides itself while an item's drawer is open, so close the drawer if you can't find it.",
      },
      {
        kind: 'rows',
        rows: [
          {
            term: 'Item name',
            detail:
              'Suggestion chips appear as you type. They come from a short built-in list of common groceries, not from your own history.',
          },
          {
            term: 'Quantity',
            detail: 'Free text, starts at 1. "2 lbs" and "a bunch" are both fine.',
          },
          {
            term: 'Category',
            detail: 'Defaults to Uncategorized. The list is whatever you have set up in Settings.',
          },
        ],
      },
      {
        kind: 'note',
        body: 'Items group under their category heading, sorted alphabetically inside each group. Uncategorized sits at the bottom.',
      },
    ],
  },
  {
    id: 'adjusting',
    title: 'Adjusting an item',
    blocks: [
      {
        kind: 'text',
        body: 'Tap the tile. It widens and reveals a drawer with everything you can change. Tap the check to close it again.',
      },
      {
        kind: 'rows',
        rows: [
          { term: 'Top row', detail: 'The trash icon deletes the item. The check just closes the drawer.' },
          { term: 'Middle row', detail: 'Category dropdown, and the minus and plus that step the quantity.' },
          {
            term: 'Bottom row',
            detail: 'Store chips. Tap one to toggle whether this item is available there. Lit means yes.',
          },
        ],
      },
      {
        kind: 'rows',
        rows: [
          { term: 'Quantity "2"', detail: 'Steps to 3 or down to 1. Never below 1.' },
          { term: 'Quantity "2 lbs"', detail: 'Steps the number and keeps the unit: "3 lbs".' },
          {
            term: 'Quantity "a bunch"',
            detail: 'No number to step, so plus replaces it with "2" and minus with "1". Lead with a number to keep your wording.',
          },
        ],
      },
      {
        kind: 'note',
        body: '"No stores configured" in the store row means you have not added any yet. Settings, then Manage Stores.',
      },
    ],
  },
  {
    id: 'removing',
    title: 'Removing an item',
    blocks: [
      {
        kind: 'gesture',
        gesture: 'swipe',
        verb: 'Swipe the tile left, then tap Delete',
        what: 'A red button slides out from under the tile',
        then: 'Or open the tile and tap the trash icon in the drawer. Same result, no swipe needed.',
      },
      {
        kind: 'rows',
        rows: [
          { term: 'Never bought', detail: 'Deleted outright. Nothing remembers it.' },
          {
            term: 'Bought before',
            detail: 'Leaves your list but is kept as history, so it can come back as a recommendation on Planning.',
          },
        ],
      },
    ],
  },
  {
    id: 'stores',
    title: 'Stores',
    blocks: [
      {
        kind: 'text',
        body: 'Stores exist so that standing in one shop shows you only what you can buy there. Three places touch them.',
      },
      {
        kind: 'rows',
        rows: [
          {
            term: 'Settings',
            detail:
              'Manage Stores: add, rename, reorder, delete. The order you set here is the order stores appear everywhere else.',
          },
          {
            term: 'Need tab',
            detail: 'Open an item and tap store chips to say where it is available. An item can be available at several.',
          },
          { term: 'Shopping tab', detail: 'Tap the store you are physically at. The list filters to it.' },
        ],
      },
      {
        kind: 'note',
        body: 'An item with no stores set shows up at every store. Once it has at least one, it is hidden at the stores you did not pick.',
      },
    ],
  },
  {
    id: 'recommendations',
    title: 'Recommendations',
    blocks: [
      {
        kind: 'text',
        body: "Planning's Smart Recommendations tray is built from items you have completed a trip with before, ranked by how often you have bought them, capped at ten.",
      },
      {
        kind: 'gesture',
        gesture: 'tap',
        verb: 'Tap a recommendation',
        what: 'Adds it to your Need list and removes the card from the tray',
        then: 'It arrives with quantity 1 and no category. If a store filter is selected, the new item is tagged as available at that store.',
      },
      {
        kind: 'note',
        tone: 'warn',
        body: 'There is no swipe-to-dismiss here. A card leaves the tray when you add it, or when the item is already on your list.',
      },
      {
        kind: 'text',
        body: 'The store chips on this tab do not narrow the recommendations: the same cards show under General as under any one store. What they change is the item you get, which is tagged as available at the store you picked.',
      },
    ],
  },
  {
    id: 'trip',
    title: 'Shopping a trip',
    blocks: [
      {
        kind: 'rows',
        rows: [
          {
            term: '1. Pick a store',
            detail: 'Until you do, the tab is an empty screen. Your choice is remembered between launches.',
          },
          {
            term: '2. Tap items',
            detail: 'Each tap moves an item into In Cart at the bottom. Tap it there to put it back.',
          },
          { term: '3. Finish', detail: 'A green Complete Shopping Trip button appears once anything is in the cart.' },
        ],
      },
      {
        kind: 'gesture',
        gesture: 'tap',
        verb: 'Tap Complete Shopping Trip',
        what: 'Asks before doing anything',
        then: 'Yes, Archive Trip files every checked item away and counts it as bought, which is what feeds the recommendation tray. Unchecked items stay exactly where they are.',
      },
      {
        kind: 'note',
        body: 'The progress bar counts against everything visible at this store, so it reads differently at different stores.',
      },
    ],
  },
  {
    id: 'sharing',
    title: 'Sharing a list',
    blocks: [
      {
        kind: 'gesture',
        gesture: 'tap',
        verb: 'Tap the pencil',
        what: 'Drops down the list panel in the top bar',
        then: 'It holds the active-list dropdown, Share List, and Join List. Tap the pencil again to close it.',
      },
      {
        kind: 'rows',
        rows: [
          {
            term: 'Share List',
            detail:
              'Makes an invite link for the list you are on. Send invite link hands it to your phone\u2019s share sheet, or copy it. Whoever opens it signs in and joins \u2014 nothing to install first. It works once, and lasts an hour.',
          },
          {
            term: 'The code under the link',
            detail:
              'The same invite, as 8 characters, for somebody you cannot send a link to. Read it out and they type it into Join List.',
          },
          { term: 'Join List', detail: 'Paste the link or type the 8 characters. The app joins, pulls everything down, and switches you to it.' },
          {
            term: 'Active List',
            detail: 'Switches which list the whole app shows. Stores and categories belong to a list, so they change too.',
          },
        ],
      },
    ],
  },
  {
    id: 'sync',
    title: 'Sync and offline',
    blocks: [
      {
        kind: 'text',
        body: 'The circular arrow in the top bar is both the status light and the sync button. Tap it any time to push and pull immediately.',
      },
      {
        kind: 'rows',
        rows: [
          { term: 'Green', detail: 'Up to date. Tap it for the time of the last sync.' },
          { term: 'Spinning', detail: 'Syncing right now.' },
          { term: 'Yellow', detail: 'Nothing has synced in over 24 hours. Tap it, and check your signal.' },
        ],
      },
      {
        kind: 'text',
        body: "A small pulsing dot beside an item's name, and a dashed border on its tile, mean that item has a change that has not reached the server yet.",
      },
      {
        kind: 'rows',
        rows: [
          { term: 'On open', detail: 'Every launch, as soon as you are signed in.' },
          { term: 'After a change', detail: 'About a second after you stop editing.' },
          { term: 'Back online', detail: 'The moment the device regains a connection.' },
        ],
      },
      {
        kind: 'note',
        body: 'Offline is a supported way to use this app. Add, edit, check off and delete with no signal; changes queue and go up when you are back. Losing the network never signs you out.',
      },
    ],
  },
  {
    id: 'install',
    title: 'Installing and updates',
    blocks: [
      {
        kind: 'text',
        body: "Installed from the browser's Add to Home Screen menu, it opens straight to your list with no browser chrome and launches from its own cache, so it opens in a shop with bad signal.",
      },
      {
        kind: 'gesture',
        gesture: 'tap',
        verb: 'Tap Reload on the update banner',
        what: '"A new version is ready" appears just above the + button',
        then: 'Dismissing it only hides it. The new version still takes over at the next cold launch, so "not now" costs nothing.',
      },
      {
        kind: 'text',
        body: 'The app checks for a new version once an hour, and every time you bring it back to the foreground.',
      },
      {
        kind: 'note',
        tone: 'warn',
        body: 'If a device gets stuck on a broken version, open the app with ?sw=off on the end of the address. That clears the cached app and stops it reinstalling; ?sw=on puts it back.',
      },
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    blocks: [
      {
        kind: 'rows',
        rows: [
          { term: 'Manage Stores', detail: 'Add, rename, reorder, delete.' },
          {
            term: 'Manage Categories',
            detail:
              'The same, plus an emoji each. Category order here sets the order of the headings on Need and Shopping.',
          },
          { term: 'Pending Local Mutations', detail: 'Changes still queued for the server. Should return to 0 within a second or two.' },
          { term: 'Auto-Sync Frequency', detail: 'Has no effect today. Sync is always automatic, whatever this says.' },
          {
            term: 'Clear Local Cache',
            detail: 'Deletes anything not yet synced, then reloads. Check that Pending Local Mutations reads 0 first.',
          },
        ],
      },
    ],
  },
]

import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { ShoppingPhase } from '../ShoppingPhase'
import { useGrocery } from '@/features/grocery/context/GroceryContext'
import { useGroceryStream } from '@/features/sync/hooks/useGroceryStream'

vi.mock('@/features/grocery/context/GroceryContext', () => ({
  useGrocery: vi.fn(),
}))

vi.mock('@/features/sync/hooks/useGroceryStream', () => ({
  useGroceryStream: vi.fn(),
}))

describe('ShoppingPhase and the live stream', () => {
  // Everything the stream asks for is a sync the server has already said is worth running,
  // so it must not cost a status round trip first.
  it('runs the sync a stream event asks for without the status pre-check', () => {
    const handleManualSync = vi.fn().mockResolvedValue(null)
    vi.mocked(useGrocery).mockReturnValue({
      activeListId: 'list-1',
      items: [],
      setItems: vi.fn(),
      stores: [],
      categories: [],
      itemStoreInfos: [],
      setItemStoreInfos: vi.fn(),
      handleManualSync,
    } as unknown as ReturnType<typeof useGrocery>)

    render(<ShoppingPhase />)

    const onInvalidate = vi.mocked(useGroceryStream).mock.calls[0][1]

    onInvalidate('invalidate')
    expect(handleManualSync).toHaveBeenLastCalledWith({ remoteChanged: true, resumed: false })

    onInvalidate('reconnect')
    expect(handleManualSync).toHaveBeenLastCalledWith({ remoteChanged: true, resumed: false })

    // A reopen after a hide is marked, so the context can drop it if its own visibility sync
    // has already run.
    onInvalidate('resume')
    expect(handleManualSync).toHaveBeenLastCalledWith({ remoteChanged: true, resumed: true })
  })
})

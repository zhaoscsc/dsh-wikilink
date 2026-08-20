import { describe, it, expect, vi } from 'vitest'
import { createIndexManager, INDEX_TTL_MS, type NoteEntry, type SessionId } from '../src/client/index-manager.ts'

const sid = (s: string): SessionId => s as unknown as SessionId

const notes: readonly NoteEntry[] = [
  { path: '/v/曼谷美食.md', relative: '曼谷美食.md', title: '曼谷美食' },
  { path: '/v/曼谷美食攻略.md', relative: '曼谷美食攻略.md', title: '曼谷美食攻略' },
]

describe('createIndexManager', () => {
  it('fetches once and serves the settled cache while warm', async () => {
    const search = vi.fn(async () => notes)
    const now = vi.fn(() => 0)
    const m = createIndexManager({ search, now })
    const first = await m.fetch(sid('s1'))
    expect(first).toEqual(notes)
    now.mockReturnValue(INDEX_TTL_MS - 1)
    const second = await m.fetch(sid('s1'))
    expect(second).toEqual(notes)
    expect(search).toHaveBeenCalledTimes(1)
  })
  it('refetches after the TTL expires', async () => {
    const search = vi.fn(async () => notes)
    const now = vi.fn(() => 0)
    const m = createIndexManager({ search, now })
    await m.fetch(sid('s1'))
    now.mockReturnValue(INDEX_TTL_MS + 1)
    await m.fetch(sid('s1'))
    expect(search).toHaveBeenCalledTimes(2)
  })
  it('joins an in-flight fetch instead of duplicating it', async () => {
    let resolve!: (v: readonly NoteEntry[]) => void
    const search = vi.fn(() => new Promise<readonly NoteEntry[]>((r) => { resolve = r }))
    const m = createIndexManager({ search })
    const a = m.fetch(sid('s1'))
    const b = m.fetch(sid('s1'))
    resolve(notes)
    await expect(Promise.all([a, b])).resolves.toEqual([notes, notes])
    expect(search).toHaveBeenCalledTimes(1)
  })
  it('finds a note by exact title after settle', async () => {
    const m = createIndexManager({ search: async () => notes })
    await m.fetch(sid('s1'))
    expect(m.find(sid('s1'), '曼谷美食')?.title).toBe('曼谷美食')
    expect(m.find(sid('s1'), '不存在')).toBeUndefined()
  })
  it('invalidateAll drops caches and resets status', async () => {
    const search = vi.fn(async () => notes)
    const m = createIndexManager({ search })
    await m.fetch(sid('s1'))
    expect(m.getStatus().state).toBe('ready')
    m.invalidateAll()
    expect(m.getStatus().state).toBe('idle')
    // A later fetch refetches (cache dropped).
    const again = await m.fetch(sid('s1'))
    expect(again).toEqual(notes)
    expect(search).toHaveBeenCalledTimes(2)
  })
  it('reports error status on a failed fetch and allows retry', async () => {
    const search = vi.fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(notes)
    const m = createIndexManager({ search })
    await expect(m.fetch(sid('s1'))).rejects.toThrow('boom')
    expect(m.getStatus().state).toBe('error')
    const retry = await m.fetch(sid('s1'))
    expect(retry).toEqual(notes)
    expect(m.getStatus().state).toBe('ready')
  })
  it('does not let a stale settlement clobber status after invalidateAll', async () => {
    let resolve!: (v: readonly NoteEntry[]) => void
    const search = vi.fn(() => new Promise<readonly NoteEntry[]>((r) => { resolve = r }))
    const m = createIndexManager({ search })
    const inflight = m.fetch(sid('s1'))
    m.invalidateAll()
    resolve(notes)
    await inflight
    expect(m.getStatus().state).toBe('idle')
  })
  it('honors a caller AbortSignal on the new-fetch path', async () => {
    let resolve!: (v: readonly NoteEntry[]) => void
    const search = vi.fn(() => new Promise<readonly NoteEntry[]>((r) => { resolve = r }))
    const m = createIndexManager({ search })
    const controller = new AbortController()
    const p = m.fetch(sid('s1'), controller.signal)
    controller.abort()
    resolve(notes)
    await expect(p).resolves.toEqual([])
    // The shared cache stays warm for the next caller.
    const again = await m.fetch(sid('s1'))
    expect(again).toEqual(notes)
    expect(search).toHaveBeenCalledTimes(1)
  })
})

/**
 * Shared workspace-index lifecycle: one hot cache per session with a TTL,
 * a single global status (the web surface is one session at a time), and
 * an invalidate hook for connection resets. Extracted from the former
 * input-trigger source so both the status strip and the self-drawn picker
 * overlay consume the same index without double-fetching.
 */

/** Minimal branded session-id type (mirrors the runtime's). */
export type SessionId = string & { readonly __sessionId: unique symbol }

/** One indexed note (mirrors contract.ts NoteEntry; local to avoid broken @deepseek-ai links). */
export interface NoteEntry {
  readonly path: string
  readonly relative: string
  readonly title: string
}

/** How long one session's index stays hot before the next menu open refetches. */
export const INDEX_TTL_MS = 30_000

/** Index lifecycle for the status strip: idle → indexing → ready | error. */
export type WikilinkIndexStatus =
  | { readonly state: 'idle' }
  | { readonly state: 'indexing' }
  | { readonly state: 'ready'; readonly count: number }
  | { readonly state: 'error'; readonly message: string }

/** Everything the manager needs from the host Remote. */
export interface IndexManagerDeps {
  search(sessionId: SessionId, signal: AbortSignal): Promise<readonly NoteEntry[]>
  /** Monotonic clock for index freshness (default Date.now). */
  now?: () => number
}

/** The manager face shared by the status strip and the overlay. */
export interface IndexManager {
  /** Resolve the session index, joined while warm/in-flight. */
  fetch(sessionId: SessionId, signal?: AbortSignal): Promise<readonly NoteEntry[]>
  /** Find one indexed note by exact title (pick-time lookup). */
  find(sessionId: SessionId, title: string): NoteEntry | undefined
  /** Drop every per-session cache (connection reset). */
  invalidateAll(): void
  /** Current index lifecycle status. */
  getStatus(): WikilinkIndexStatus
  /** Subscribe to status changes (returns the unsubscribe). */
  subscribeStatus(listener: () => void): () => void
}

export function createIndexManager(deps: IndexManagerDeps): IndexManager {
  const now = deps.now ?? (() => Date.now())
  /** Per-session in-flight cache entry; `settled` fills in when the search resolves. */
  type FetchEntry = {
    promise: Promise<readonly NoteEntry[]>
    abort: AbortController
    settled?: readonly NoteEntry[]
    at: number
  }
  const fetches = new Map<SessionId, FetchEntry>()
  let status: WikilinkIndexStatus = { state: 'idle' }
  const statusListeners = new Set<() => void>()
  const setStatus = (next: WikilinkIndexStatus): void => {
    status = next
    for (const listener of [...statusListeners]) {
      try { listener() } catch (error) { console.error('[dsh-wikilink] status listener failed:', error) }
    }
  }

  const fetch = (sessionId: SessionId, signal?: AbortSignal): Promise<readonly NoteEntry[]> => {
    const existing = fetches.get(sessionId)
    const fresh = existing !== undefined && now() - existing.at < INDEX_TTL_MS
    if (fresh) {
      if (existing.settled !== undefined) return Promise.resolve(existing.settled)
      return existing.promise
    }
    if (existing !== undefined) {
      fetches.delete(sessionId)
      existing.abort.abort()
    }
    const abort = new AbortController()
    setStatus({ state: 'indexing' })
    const promise = deps.search(sessionId, abort.signal)
    const entry: FetchEntry = { promise, abort, at: now() }
    fetches.set(sessionId, entry)
    promise.then(
      (notes) => {
        entry.settled = notes
        setStatus({ state: 'ready', count: notes.length })
      },
      (error: unknown) => {
        if (fetches.get(sessionId) === entry) fetches.delete(sessionId)
        setStatus({ state: 'error', message: error instanceof Error ? error.message : String(error) })
      },
    )
    if (signal !== undefined) {
      return promise.then(notes => (signal.aborted ? [] : notes))
    }
    return promise
  }

  const find = (sessionId: SessionId, title: string): NoteEntry | undefined =>
    fetches.get(sessionId)?.settled?.find(note => note.title === title)

  const invalidateAll = (): void => {
    for (const [key, entry] of [...fetches]) {
      fetches.delete(key)
      entry.abort.abort()
    }
    setStatus({ state: 'idle' })
  }

  return {
    fetch,
    find,
    invalidateAll,
    getStatus: () => status,
    subscribeStatus: (listener: () => void): (() => void) => {
      statusListeners.add(listener)
      return () => { statusListeners.delete(listener) }
    },
  }
}

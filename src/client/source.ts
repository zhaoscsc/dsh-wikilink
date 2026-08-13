/**
 * The '[[' input-trigger source: turns the ui-input-trigger pipeline into the
 * Obsidian-style note picker. The harness pipeline recognizes '[' as a
 * trigger only in the double-bracket form `[[` (patched detectTrigger), so
 * the picker opens exactly when a wikilink is being typed. `candidates`
 * serves the title-ranked rows (the note index is fetched once per session
 * and filtered locally per keystroke); `onPick` lands the plain-text
 * `[[title]]` reference — the draft keeps a readable token, and the Host's
 * pre-step boundary expands it into the note content when the message ships.
 * Pure factory over injected deps: the browser bundle wires the real Remote
 * and clock, tests wire stubs.
 */
import type { InputTriggerSource, TriggerChar } from '@deepseek-ai/dsh-client-ui-input-trigger'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { dirnameOf } from './model.ts'
import { rankNotes } from './search.ts'
import type { NoteEntry } from './remote.ts'
import type { WikilinkKey } from './locales.ts'

/** Owner source name (the lexicon and decoration routing key). */
export const SOURCE_NAME = 'wikilink'

/**
 * The trigger char this source binds to. The harness's TriggerChar union is
 * `'/' | '@'`; the detectTrigger patch (see repo notes) additionally
 * recognizes '[' in the `[[` form, so this source registers under the
 * widened trigger.
 */
export const TRIGGER: TriggerChar = '[' as TriggerChar

/**
 * Design cap on picker rows. The menu viewport scrolls (max-height 320px),
 * so multi-term queries (e.g. 「四川 资源」) can surface deeper-but-valid
 * hits instead of clipping them at the first screenful.
 */
export const MAX_CANDIDATES = 24

/** How long one session's index stays hot before the next menu open refetches. */
export const INDEX_TTL_MS = 30_000

/** Per-session index fetch: the shared promise, its abort handle, and the settled snapshot. */
interface IndexCache {
  readonly promise: Promise<readonly NoteEntry[]>
  readonly abort: AbortController
  /** Settled snapshot backing synchronous reads (lexicon); unset while in flight. */
  settled?: readonly NoteEntry[]
  /** Monotonic clock reading at fetch start (TTL base). */
  readonly at: number
}

/** Everything the source needs that the browser bundle supplies (tests stub). */
export interface WikilinkSourceDeps {
  /** Search the addressed session's workspace note index (Remote wrapper). */
  search(sessionId: SessionId, signal: AbortSignal): Promise<readonly NoteEntry[]>
  /** Localized submit-failure copy. */
  t: (key: WikilinkKey, params?: Record<string, string>) => string
  /** Monotonic clock for index freshness (default Date.now). */
  now?: () => number
}

/** The registered source plus the cache teardown the wiring layer owns. */
export interface WikilinkSource {
  readonly source: InputTriggerSource
  /** Drop every per-session cache and path map (connection reset). */
  invalidateAll(): void
  /** Current index lifecycle status (the dock strip renders it). */
  getStatus(): WikilinkIndexStatus
  /** Subscribe to index lifecycle changes (returns the unsubscribe). */
  subscribeStatus(listener: () => void): () => void
}

/** Index lifecycle for the status strip: idle → indexing → ready | error. */
export type WikilinkIndexStatus =
  | { readonly state: 'idle' }
  | { readonly state: 'indexing' }
  | { readonly state: 'ready'; readonly count: number }
  | { readonly state: 'error'; readonly message: string }

/**
 * Build the '[[' trigger source over the injected deps. One source per plugin
 * fiber; per-session caches live in the returned closure and die with it.
 * @param deps - Remote, locale, and clock faces.
 * @returns the source to register with `inputTriggers.registerSource`, plus
 *   the cache invalidator.
 */
export function createWikilinkSource(deps: WikilinkSourceDeps): WikilinkSource {
  const now = deps.now ?? (() => Date.now())
  const fetches = new Map<SessionId, IndexCache>()
  const lexiconListeners = new Map<SessionId, Set<() => void>>()

  // Index lifecycle (single global status; the web surface is one session at
  // a time, so per-session status would only ever render the active one).
  let status: WikilinkIndexStatus = { state: 'idle' }
  const statusListeners = new Set<() => void>()
  const setStatus = (next: WikilinkIndexStatus): void => {
    status = next
    for (const listener of [...statusListeners]) {
      try {
        listener()
      } catch (error) {
        // Contain listener failures: one faulty consumer must not starve the others.
        console.error('[dsh-wikilink] status listener failed:', error)
      }
    }
  }

  const notifyLexicon = (sessionId: SessionId): void => {
    for (const listener of [...(lexiconListeners.get(sessionId) ?? [])]) {
      try {
        listener()
      } catch (error) {
        // Contain listener failures: settlement notifies from an ignored
        // promise chain, and one faulty consumer must not starve the others.
        console.error('[dsh-wikilink] lexicon listener failed:', error)
      }
    }
  }

  const fetchIndex = (sessionId: SessionId, signal?: AbortSignal): Promise<readonly NoteEntry[]> => {
    const existing = fetches.get(sessionId)
    const fresh = existing !== undefined && now() - existing.at < INDEX_TTL_MS
    if (fresh) {
      if (existing.settled !== undefined) return Promise.resolve(existing.settled)
      // In flight and fresh: join it. The candidate caller's own signal is
      // superseded per keystroke; the shared fetch outlives the menu.
      return existing.promise
    }
    if (existing !== undefined) {
      fetches.delete(sessionId)
      existing.abort.abort()
    }
    const abort = new AbortController()
    setStatus({ state: 'indexing' })
    const promise = deps.search(sessionId, abort.signal)
    const entry: IndexCache = { promise, abort, at: now() }
    fetches.set(sessionId, entry)
    promise.then(
      (notes) => {
        entry.settled = notes
        setStatus({ state: 'ready', count: notes.length })
        notifyLexicon(sessionId)
      },
      (error: unknown) => {
        // A failed fetch must not poison the key: the next consumer retries.
        if (fetches.get(sessionId) === entry) fetches.delete(sessionId)
        setStatus({ state: 'error', message: error instanceof Error ? error.message : String(error) })
      },
    )
    if (signal !== undefined) {
      // A superseded keystroke just yields early; the shared fetch stays warm
      // and its own handlers already contain its settlement.
      return promise.then(notes => (signal.aborted ? [] : notes))
    }
    return promise
  }

  const findEntry = (sessionId: SessionId, title: string): NoteEntry | undefined =>
    fetches.get(sessionId)?.settled?.find(note => note.title === title)

  const invalidateAll = (): void => {
    for (const [key, entry] of [...fetches]) {
      fetches.delete(key)
      entry.abort.abort()
    }
    for (const listeners of [...lexiconListeners.values()]) {
      for (const listener of listeners) listener()
    }
    setStatus({ state: 'idle' })
  }

  const source: InputTriggerSource = {
    trigger: TRIGGER,
    name: SOURCE_NAME,
    async candidates(session, { query, signal }) {
      const notes = await fetchIndex(session.sessionId, signal)
      if (signal.aborted) return []
      // The [[ auto-close leaves a trailing ']]' in the draft; when the caret
      // sits past it (or the closing brackets were typed by hand) the query
      // carries them — strip trailing ']' so matching stays clean.
      const clean = query.replace(/\]+$/u, '')
      return rankNotes(notes, clean, MAX_CANDIDATES).map(note => {
        const dir = dirnameOf(note.relative)
        return {
          name: note.title,
          icon: '📄',
          ...(dir === '' ? {} : { description: dir }),
        }
      })
    },
    warm(session) {
      // Fire-and-forget scope-birth prewarm; the shared fetch reports
      // through candidates.
      fetchIndex(session.sessionId).catch(() => {})
    },
    onPick({ candidate, session }) {
      const note = findEntry(session.sessionId, candidate.name)
      if (note === undefined) return undefined
      // Plain-text reference: the draft gains the readable [[title]] token.
      // The hit span covers the second '[' plus the typed query. Because the
      // [[ auto-close already placed a trailing ']]' in the draft, the pick
      // text leads with '[' and deliberately omits its own closing ']]' —
      // otherwise the draft would end with four brackets.
      return { text: `[${note.title}` }
    },
    lexicon(session) {
      return fetches.get(session.sessionId)?.settled?.map(note => note.title)
    },
    subscribeLexicon(session, listener) {
      const key = session.sessionId
      const listeners = lexiconListeners.get(key) ?? new Set()
      listeners.add(listener)
      lexiconListeners.set(key, listeners)
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) lexiconListeners.delete(key)
      }
    },
  }

  return {
    source,
    invalidateAll,
    getStatus: () => status,
    subscribeStatus: (listener: () => void): (() => void) => {
      statusListeners.add(listener)
      return () => {
        statusListeners.delete(listener)
      }
    },
  }
}

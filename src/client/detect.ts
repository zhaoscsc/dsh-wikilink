/**
 * Pure `[[` trigger detection and replacement for the self-drawn picker.
 * Scans the draft for the LAST unclosed `[[` (or fullwidth `【【`) — i.e. a
 * trigger char pair with no closing `]]` after it — and yields the query
 * text up to the draft end. Zero DOM, zero cordis: the overlay component
 * feeds it the live draft from useInput.
 */

/** The open-trigger scan result. */
export interface OpenTrigger {
  /** Draft offset of the opening `[[` (or `【【`). */
  readonly start: number
  /** Text between the opening pair and the draft end (never includes a closing pair). */
  readonly query: string
  /** True when the trigger was typed with fullwidth `【【` (U+3010). */
  readonly fullwidth: boolean
}

const OPEN = '[['
const OPEN_FULL = '【【'
const CLOSE = ']]'

/**
 * Find the last unclosed wikilink trigger in `draft`, or null when none is
 * open. A `[[` is "open" when no `]]` appears after it. Because the scan
 * walks backward, the LAST occurrence wins; any earlier pair already closed
 * by a `]]` between it and the caret is skipped naturally.
 * @param draft - the full draft text.
 * @returns the open trigger, or null.
 */
export function findOpenTrigger(draft: string): OpenTrigger | null {
  let at = draft.length
  while (true) {
    const open = Math.max(draft.lastIndexOf(OPEN, at - 1), draft.lastIndexOf(OPEN_FULL, at - 1))
    if (open < 0) return null
    // If a closing pair exists after this opening, the token is closed; keep
    // scanning left of the closing pair for an earlier open one.
    const close = draft.indexOf(CLOSE, open + 2)
    if (close >= 0) {
      // Nothing can sit left of offset 0, and `lastIndexOf` clamps a
      // negative fromIndex back to 0, so a closed trigger at the very start
      // would otherwise re-report itself forever; it means no open one.
      if (open === 0) return null
      at = open
      continue
    }
    const fullwidth = draft.startsWith(OPEN_FULL, open)
    return { start: open, query: draft.slice(open + 2), fullwidth }
  }
}

/**
 * Build the next draft with the open token at `start` replaced by a closed
 * `[[title]]`. The closing pair is written halfwidth regardless of how the
 * trigger was typed, so the shipped prompt always carries ASCII brackets.
 * @param draft - the full current draft.
 * @param start - the open trigger offset from findOpenTrigger.
 * @param title - the picked note title.
 * @returns the next draft text.
 */
export function replaceTrigger(draft: string, start: number, title: string): string {
  return draft.slice(0, start) + `[[${title}]]`
}

/**
 * Strip a run of trailing `]` from a query (stray closing brackets typed by
 * hand, or left over from an earlier auto-close).
 * @param query - raw query text.
 * @returns the query without trailing `]` characters.
 */
export function stripTrailingBrackets(query: string): string {
  return query.replace(/\]+$/u, '')
}

/**
 * Self-drawn `[[` picker overlay, mounted on the public
 * `conversation.input.overlay` list slot. Watches the live draft through the
 * session standard kit (`useInput`), detects an unclosed `[[`/`【【` with the
 * pure detect module, ranks the cached index, and lands a closed `[[title]]`
 * via `inputActions.setDraft` — no harness pipeline, no patches.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { InputState } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type { WikilinkSettings } from '../contract.ts'
import type { IndexManager } from './index-manager.ts'
import type { NoteEntry } from './index-manager.ts'
import { findOpenTrigger, replaceTrigger, stripTrailingBrackets } from './detect.ts'
import { rankNotes } from './search.ts'
import { MAX_CANDIDATES } from './index-manager.ts'

/** Full overlay entry props: runtime standard kit + locale seat. */
export type OverlayProps = PropsRuntime<'conversation.input.overlay'> & PropsLocale<'wikilink'>

/** Business face injected by the plugin body (kept out of the standard kit). */
export interface OverlayInjected {
  index: IndexManager
  hooks: { scope: SettingsScope<WikilinkSettings> }
}

export type OverlayFullProps = OverlayProps & InjectFace<OverlayInjected>

/**
 * Render the floating picker; null when no trigger is open, disabled, or the
 * session has no input state. `sessionId` is a framework standard prop of
 * session-scope slot entries (it is NOT a field of InputState).
 */
export function WikilinkOverlay({ sessionId, useInput, inputActions, useScope, index, t }: OverlayFullProps) {
  const enabled = useScope(snapshot => snapshot.value?.enabled ?? true)
  const input = useInput((s: InputState) => s)
  const draft = input?.draft ?? ''

  const trigger = useMemo(() => findOpenTrigger(draft), [draft])
  const [highlight, setHighlight] = useState(0)
  const [candidates, setCandidates] = useState<readonly NoteEntry[]>([])
  const [suppressed, setSuppressed] = useState(false)
  const abortRef = useRef<AbortController | undefined>(undefined)
  const open = enabled && !suppressed && trigger !== null && input !== undefined

  // A manual close (Esc / outside click) stays until the draft changes again.
  useEffect(() => { setSuppressed(false) }, [draft])

  // Re-rank on every draft/query change while open.
  useEffect(() => {
    if (!open || trigger === null) { setCandidates([]); return }
    const query = stripTrailingBrackets(trigger.query)
    const controller = new AbortController()
    abortRef.current?.abort()
    abortRef.current = controller
    void index.fetch(sessionId, controller.signal)
      .then(notes => {
        if (controller.signal.aborted) return
        setCandidates(rankNotes(notes, query, MAX_CANDIDATES))
        setHighlight(0)
      })
      .catch(() => { /* status store already surfaced the failure */ })
    return () => controller.abort()
  }, [open, trigger, sessionId, index])

  const pick = (title: string): void => {
    if (trigger === null || input === undefined) return
    const next = replaceTrigger(draft, trigger.start, title)
    inputActions.setDraft(next)
  }

  // Keyboard: only while open; ignore IME composition.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.isComposing || e.keyCode === 229) return
      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, candidates.length - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)) }
      else if (e.key === 'Enter') {
        const hit = candidates[highlight]
        if (hit !== undefined) { e.preventDefault(); pick(hit.title) }
      }
      else if (e.key === 'Escape') { e.preventDefault(); setSuppressed(true) }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [open, candidates, highlight, trigger, draft, input, inputActions])

  // Click-outside: a capture-phase mousedown outside the menu closes it. The
  // `suppressed` flag keeps it closed until the next draft change, so the click
  // lands in the textarea without the menu instantly re-opening. Menu-internal
  // clicks are handled by each item's onMouseDown preventDefault.
  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent): void => {
      const el = e.target as HTMLElement | null
      if (el === null || el.closest('.dsh_wikilink_menu') === null) {
        setSuppressed(true)
      }
    }
    document.addEventListener('mousedown', onMouseDown, true)
    return () => document.removeEventListener('mousedown', onMouseDown, true)
  }, [open])

  if (!open) return null

  const empty = candidates.length === 0

  return (
    <div className="dsh_wikilink_menu" role="listbox" aria-label={t('menu.label')}>
      {empty ? (
        <div className="dsh_wikilink_menuEmpty">{t('menu.empty')}</div>
      ) : (
        candidates.map((note, i) => (
          <button
            key={note.relative}
            type="button"
            role="option"
            aria-selected={i === highlight}
            className={`dsh_wikilink_menuItem${i === highlight ? ' dsh_wikilink_menuItem_active' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); pick(note.title) }}
            onMouseEnter={() => setHighlight(i)}
          >
            <span className="dsh_wikilink_menuIcon">📄</span>
            <span className="dsh_wikilink_menuName">{note.title}</span>
            {note.relative.includes('/') && (
              <span className="dsh_wikilink_menuDir">{note.relative.slice(0, note.relative.lastIndexOf('/'))}</span>
            )}
          </button>
        ))
      )}
    </div>
  )
}

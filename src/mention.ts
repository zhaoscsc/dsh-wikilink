/**
 * The Host-side [[wikilink]] mention expansion: recognizes `[[path]]` and
 * `[[title]]` tokens in the outgoing user message and, at the
 * `agent/pre-step` boundary, resolves each to a workspace .md note, reads its
 * content, and injects it as a user-role message the model reads directly.
 * Only `source.kind === 'user'` text is scanned — external text cannot forge
 * the gesture — and every path resolves against the session's workspace cwd.
 */
import { isAbsolute } from 'node:path'
import type { UserMessage } from '@deepseek-ai/dsh-llm'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { PreStepDecision } from '@deepseek-ai/dsh-agent'
import { indexWorkspace, readFileText } from './files.ts'
import type { NoteEntry } from './contract.ts'
import type { ResolvedConfig } from './types.ts'

/** One resolved mention: the token and the note it points at. */
export interface WikilinkMention {
  readonly token: string
  readonly entry: NoteEntry
}

/** The source tag the injected content carries (transcript consumers use it). */
declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'wikilink-mention': { kind: 'wikilink-mention'; path: string; title: string }
  }
}

/** The user-message source kind this boundary scans (external text cannot forge it). */
const USER_SOURCE_KIND = 'user'

/** The literal mention token: `[[` then any text without `[` or `]`, then `]]`. */
const WIKILINK_PATTERN = /\[\[([^\[\]]+)\]\]/g

/**
 * Scan one text block for `[[...]]` tokens, deduplicated in first-seen order.
 * @param text - the message text block.
 * @returns unique trimmed tokens.
 */
export function scanWikilinks(text: string): readonly string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const match of text.matchAll(WIKILINK_PATTERN)) {
    const raw = (match[1] as string).trim()
    if (raw === '' || seen.has(raw)) continue
    seen.add(raw)
    out.push(raw)
  }
  return out
}

/** A workspace note index: maps for title and relative-path resolution. */
export interface NoteIndex {
  /** title (basename without .md) → entries (usually one; duplicates possible). */
  readonly byTitle: ReadonlyMap<string, readonly NoteEntry[]>
  /** relative path → entry (exact .md paths). */
  readonly byRelative: ReadonlyMap<string, NoteEntry>
}

/**
 * Build the note index over one bounded workspace walk.
 * @param cwd - the session's workspace directory.
 * @param config - bounds (index cap, ignore dirs).
 * @param signal - caller lifetime.
 * @returns the index maps.
 */
export async function buildNoteIndex(
  cwd: string,
  config: ResolvedConfig,
  signal: AbortSignal,
): Promise<NoteIndex> {
  const index = await indexWorkspace(cwd, {
    maxFiles: config.maxIndexedFiles,
    ignoreDirs: config.ignoreDirs,
  }, signal)
  const byTitle = new Map<string, NoteEntry[]>()
  const byRelative = new Map<string, NoteEntry>()
  for (const entry of index.files) {
    if (entry.kind !== 'file' || !entry.relative.endsWith('.md')) continue
    const base = entry.relative.slice(entry.relative.lastIndexOf('/') + 1)
    const title = base.slice(0, -3)
    const note: NoteEntry = { path: entry.path, relative: entry.relative, title }
    byRelative.set(entry.relative, note)
    const list = byTitle.get(title)
    if (list === undefined) byTitle.set(title, [note])
    else list.push(note)
  }
  return { byTitle, byRelative }
}

/**
 * Resolve one token to a note, or undefined when it does not resolve uniquely.
 * A token containing '/' is a path form; otherwise it is a title and must map
 * to exactly one note (duplicate titles stay plain prose).
 * @param token - the trimmed [[...]] token.
 * @param index - the workspace note index.
 * @returns the resolved note, or undefined.
 */
export function resolveWikilink(token: string, index: NoteIndex): NoteEntry | undefined {
  if (token.includes('/')) {
    const exact = index.byRelative.get(token)
    if (exact !== undefined) return exact
    return index.byRelative.get(`${token}.md`)
  }
  const matches = index.byTitle.get(token)
  if (matches === undefined || matches.length !== 1) return undefined
  return matches[0] as NoteEntry
}

/** The model form of one attached note. */
function noteForm(entry: NoteEntry, content: string): string {
  const body = content.endsWith('\n') ? content : `${content}\n`
  return `<note path="${entry.relative}" title="${entry.title}">\n${body}</note>`
}

/**
 * Expand every `[[...]]` mention in the user messages into injected content
 * messages, in first-seen order. Unresolvable tokens stay plain prose.
 * @param messages - the assembled step messages.
 * @param cwd - the session's workspace directory.
 * @param config - bounds (per-file cap, index cap, ignore dirs).
 * @param signal - caller lifetime.
 * @returns the injected user messages (empty when nothing matched or disabled).
 */
export async function expandWikilinks(
  messages: readonly UserMessage[],
  cwd: string | undefined,
  config: ResolvedConfig,
  signal: AbortSignal,
): Promise<UserMessage[]> {
  if (cwd === undefined || !isAbsolute(cwd)) return []
  const tokens: string[] = []
  for (const message of messages) {
    if (message.source.kind !== USER_SOURCE_KIND) continue
    for (const block of message.content) {
      if (block.type !== 'text') continue
      tokens.push(...scanWikilinks(block.text))
    }
  }
  if (tokens.length === 0) return []
  signal.throwIfAborted()
  const index = await buildNoteIndex(cwd, config, signal)
  const injections: UserMessage[] = []
  const injected = new Set<string>()
  for (const token of tokens) {
    signal.throwIfAborted()
    const entry = resolveWikilink(token, index)
    if (entry === undefined || injected.has(entry.path)) continue
    injected.add(entry.path)
    const content = await readFileText(entry.path, config.maxFileBytes, signal)
    injections.push(createUserMessage({
      content: [{ type: 'text', text: noteForm(entry, content.content) }],
      source: { kind: 'wikilink-mention', path: entry.path, title: entry.title },
    }))
  }
  return injections
}

/** The minimal agent face the pre-step handler reads. */
export interface WikilinkAgent {
  session: { header: { cwd?: string } }
}

/**
 * The `agent/pre-step` listener body: expand [[ mentions in the claimed user
 * messages and append the injections to the downstream decision. Extracted so
 * the boundary logic is unit-testable without an assembled agent scope.
 * @param agent - the addressed agent (its session header owns the cwd).
 * @param config - bounds.
 * @param isEnabled - live settings read.
 * @param messages - the claimed messages (the user's own words).
 * @param signal - caller lifetime.
 * @param next - the downstream waterfall.
 * @returns the decision with injections appended, or the downstream decision.
 */
export async function wikilinkPreStep(
  agent: WikilinkAgent,
  config: ResolvedConfig,
  isEnabled: () => boolean,
  messages: readonly UserMessage[],
  signal: AbortSignal,
  next: () => Promise<PreStepDecision>,
): Promise<PreStepDecision> {
  const decision = await next()
  if (decision.kind === 'reject') return decision
  if (!isEnabled()) return decision
  const injections = await expandWikilinks(messages, agent.session.header.cwd, config, signal)
  if (injections.length === 0) return decision
  return { kind: 'enter', messages: [...decision.messages, ...injections] }
}

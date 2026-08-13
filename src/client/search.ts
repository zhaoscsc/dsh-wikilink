/**
 * Pure note-title ranking for the [[ menu: case-insensitive matching over the
 * note title with four tiers — title contiguous substring, title subsequence,
 * relative-path contiguous substring, relative-path subsequence — so a
 * contiguous title hit always outranks a loose subsequence hit (「公考」 must
 * match 公考上岸 before it matches 公务员考核), while the subsequence tier
 * keeps the requested out-of-order matching (「成教」 finds 成都教育). The query
 * is split on whitespace into terms that must ALL match (Obsidian-style:
 * 「四川 资源」 finds 四川矿产资源); both the query and the titles are
 * NFC-normalized. The empty query lists notes alphabetically by title. Zero
 * DOM, zero cordis — the per-keystroke filter runs on the client's cached
 * index.
 */
import type { NoteEntry } from './remote.ts'

/** Ranked top-N notes matching `query` (ties break by length, then lexicographically). */
export function rankNotes(
  notes: readonly NoteEntry[],
  query: string,
  limit: number,
): readonly NoteEntry[] {
  const q = query.trim().toLowerCase().normalize('NFC')
  if (q === '') {
    return [...notes].sort(byDefault).slice(0, limit)
  }
  return notes
    .map(note => ({ note, score: scoreNote(note, q) }))
    .filter(entry => entry.score >= 0)
    .sort((a, b) => b.score - a.score
      || a.note.relative.length - b.note.relative.length
      || (a.note.relative < b.note.relative ? -1 : 1))
    .slice(0, limit)
    .map(entry => entry.note)
}

/** Default order: alphabetical by title, then by path. */
function byDefault(a: NoteEntry, b: NoteEntry): number {
  if (a.title !== b.title) return a.title < b.title ? -1 : 1
  // Unique relative paths make the equality arm unreachable.
  /* v8 ignore next -- identical paths cannot both exist in one index. */
  return a.relative < b.relative ? -1 : 1
}

/**
 * Match score for one note against one normalized query; -1 means no match.
 * The query is split into whitespace-separated terms; every term must match
 * (AND), and the score is the sum of the term scores so multi-term hits rank
 * above single-term ones. Each term scores against four tiers, highest
 * first: title substring, title subsequence, path substring, path
 * subsequence. The contiguous tiers exist so a loose subsequence hit (e.g.
 * 「公考」 matching 公务员考核) never outranks a real substring hit; inside a
 * tier the earliest greedy match position wins, and shorter paths win ties
 * through rankNotes' length break.
 * @param note - the indexed note.
 * @param q - lowercased trimmed NFC-normalized query.
 * @returns non-negative score, or -1 when any term matches nothing.
 */
function scoreNote(note: NoteEntry, q: string): number {
  const terms = q.split(/\s+/).filter(term => term !== '')
  if (terms.length === 1) return scoreTerm(note, terms[0] as string)
  let total = 0
  for (const term of terms) {
    const score = scoreTerm(note, term)
    if (score < 0) return -1
    total += score
  }
  return total
}

/**
 * Match score of one whitespace-free term against one note; -1 means no match.
 * @param note - the indexed note.
 * @param q - lowercased trimmed NFC-normalized single term.
 * @returns non-negative score, or -1 when the term matches nothing.
 */
function scoreTerm(note: NoteEntry, q: string): number {
  const title = note.title.toLowerCase().normalize('NFC')
  // Title contiguous substring (a prefix is position 0 and wins naturally).
  const atTitle = title.indexOf(q)
  if (atTitle >= 0) return 3000 - atTitle
  // Title subsequence: the requested out-of-order matching (「成教」→ 成都教育).
  const sTitle = subsequenceIndices(title, q)
  if (sTitle !== null) return 2000 - sTitle[0]
  // Relative-path contiguous substring.
  const rel = note.relative.toLowerCase().normalize('NFC')
  const atRel = rel.indexOf(q)
  if (atRel >= 0) return 1500 - atRel
  // Relative-path subsequence.
  const sRel = subsequenceIndices(rel, q)
  if (sRel !== null) return 1000 - sRel[0] - rel.length
  return -1
}

/**
 * Greedy earliest subsequence match of `needle` inside `hay`.
 * @returns the matched indices, or null when `needle` is not a subsequence.
 */
function subsequenceIndices(hay: string, needle: string): readonly number[] | null {
  /* v8 ignore next -- rankNotes guards the empty query before any score call. */
  if (needle === '') return []
  const indices: number[] = []
  let at = 0
  for (const ch of needle) {
    const found = hay.indexOf(ch, at)
    if (found < 0) return null
    indices.push(found)
    at = found + 1
  }
  return indices
}

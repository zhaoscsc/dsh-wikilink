/**
 * dsh-wikilink host types: the plugin configuration face. The wire contract
 * types live in `contract.ts` and are re-exported here for the host entry.
 */

export type { WikilinkSettings, NoteEntry, FileContent } from './contract.ts'

/** Resolved plugin configuration (schema defaults applied). */
export interface ResolvedConfig {
  /** Hard cap on indexed entries per workspace; the walk stops and reports truncation. */
  readonly maxIndexedFiles: number
  /** Hard cap on one file read; larger files are refused, never truncated. */
  readonly maxFileBytes: number
  /** Directory basenames the index walk skips entirely. */
  readonly ignoreDirs: readonly string[]
}

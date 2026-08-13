/**
 * The wikilink wire contract, shared verbatim by the host manifest
 * (`ctx.typert.register` in typert.ts) and the client contribution
 * (`ctx.remote.$mount` in client/remote.ts). The only Remote endpoint is the
 * workspace note-title index; note content reaches the model through the
 * Host's `agent/pre-step` boundary, not through a wire read.
 */
import { z } from 'zod'
import type { InvocationDescriptor } from '@deepseek-ai/dsh-typert-protocol'

/** One indexed note: an .md workspace file with its display title. */
export interface NoteEntry {
  readonly path: string
  readonly relative: string
  /** Note title: the relative basename without the .md extension. */
  readonly title: string
}

/** One bounded text-file read (the Host mention expansion's file result). */
export interface FileContent {
  readonly content: string
  readonly bytes: number
}

/** The `wikilink` settings namespace's durable shape (host and client share it). */
export interface WikilinkSettings {
  /** Whether the [[ surface is enabled; false hides the picker and the expansion. */
  readonly enabled: boolean
}

/** Wire codec: one session identity (branded string on the wire). */
export const sessionIdSchema = z.string().min(1)

/** Wire codec: one indexed note. */
export const noteEntrySchema = z.object({
  path: z.string().min(1),
  relative: z.string().min(1),
  title: z.string().min(1),
}).readonly()

/** The wikilink Remote namespace's strict invocation descriptors. */
export const WIKILINK_INVOCATIONS: readonly InvocationDescriptor[] = [
  {
    id: 'dsh-wikilink#wikilink/search',
    service: 'wikilink',
    namespace: 'wikilink',
    method: 'search',
    invocation: { kind: 'direct' },
    parameters: [
      {
        name: 'agent',
        wire: 'agentId',
        source: 'lookup',
        lookup: 'agent',
        // The type symbol must equal the agent lookup provider's wire identity
        // exactly — the gateway's strict path rejects a mismatched symbol.
        codec: { mode: 'strict', typeSymbol: '@deepseek-ai/dsh-session/types#SessionId', schema: sessionIdSchema },
      },
    ],
    cancellation: { parameter: 'signal' },
    result: {
      mode: 'strict',
      typeSymbol: 'dsh-wikilink#NoteEntry[]',
      schema: z.array(noteEntrySchema),
    },
  },
]

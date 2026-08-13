/**
 * The hand-written host Typert manifest for the wikilink Remote. Registered
 * through `ctx.typert.register` in the plugin body, it claims the wire
 * endpoints through the strict registry — the same path generated `./typert`
 * artifacts use — so the Host Gateway resolves and invokes `wikilink/search`
 * without consulting the `@Remote` marker table.
 */
import type { TypertContribution } from '@deepseek-ai/dsh-typert-registry/types'
import { WIKILINK_INVOCATIONS } from './contract.ts'

/** The wikilink namespace's host manifest (strict codecs shared with the client). */
export const TYPERT_MANIFEST: TypertContribution = {
  package: 'dsh-wikilink',
  face: 'host',
  schemas: [],
  model: {
    services: [
      {
        key: 'wikilink',
        exportName: 'WikilinkRuntime',
        description: 'Workspace note-title index for the [[ picker.',
        tags: [],
        members: [
          {
            kind: 'method',
            name: 'search',
            signature: 'search(agent: Agent, signal: AbortSignal): Promise<readonly NoteEntry[]>',
          },
        ],
        types: [],
      },
    ],
    events: [],
    objects: [],
  },
  invocations: WIKILINK_INVOCATIONS,
}

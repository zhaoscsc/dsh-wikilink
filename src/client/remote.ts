/**
 * The client-side Typert Remote contribution for the dsh-wikilink host
 * service: mounts the shared strict descriptors into `ctx.remote.wikilink`.
 * The descriptors and codecs come from the shared contract module, so the
 * browser bundle and the host manifest stay on one wire definition.
 */
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { WIKILINK_INVOCATIONS } from '../contract.ts'

export type { NoteEntry } from '../contract.ts'

/** The wikilink Remote namespace's client contribution. */
export const WIKILINK_REMOTE: TypertRemoteContribution = {
  package: 'dsh-wikilink',
  descriptors: WIKILINK_INVOCATIONS,
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  // Typed face of the mounted namespace. Note: the runtime access is NOT the
  // dotted `ctx.remote.wikilink` read — that path walks the cordis fiber chain
  // and stops at the Loader's runtime-less internal forks between a plugin
  // entry and the root fiber. The plugin resolves the namespace service
  // through `ctx.reflect.get('remote.wikilink')` instead (see client/index.ts).
  /** The `wikilink` namespace face mounted under `ctx.remote.wikilink`. */
  interface TypertRemoteNamespace$77696b696c696e6b {
    search: (agentId: SessionId, signal?: AbortSignal) => Promise<RemoteResult<readonly import('../contract.ts').NoteEntry[]>>
  }
  interface TypertRemoteMap {
    'wikilink/search': (agentId: SessionId, signal?: AbortSignal) => Promise<RemoteResult<readonly import('../contract.ts').NoteEntry[]>>
  }
  interface TypertRemoteNamespaceMap {
    wikilink: TypertRemoteNamespace$77696b696c696e6b
  }
}

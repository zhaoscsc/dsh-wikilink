/**
 * The dsh-wikilink host Remote service (`ctx.wikilink`, wire namespace
 * `wikilink`). Registered as a TypertRemoteService so the Host Gateway's
 * source-mode discovery exports its @Remote methods to the Web client under
 * `/api/wikilink/<method>` with zero generated artifacts: `search` takes the
 * resolved live Agent (the `agent` Typert lookup) and indexes its workspace's
 * .md notes. Note content never crosses this wire — the Host's pre-step
 * boundary reads it directly when the user mentions `[[path]]`.
 */
import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { indexWorkspace } from './files.ts'
import type { NoteEntry } from './contract.ts'
import type { ResolvedConfig } from './types.ts'

/** Wikilink workspace service: index the .md notes of the session workspace. */
export class WikilinkRuntime extends TypertRemoteService {
  /**
   * Register the service under the `wikilink` key (the wire namespace).
   * @param ctx - owning cordis context.
   * @param config - resolved plugin configuration.
   * @param isEnabled - live settings read; false refuses the endpoint.
   */
  constructor(
    ctx: Context,
    private readonly config: ResolvedConfig,
    private readonly isEnabled: () => boolean,
  ) {
    super(ctx, 'wikilink')
  }

  /**
   * Index the addressed agent's workspace and return the bounded note list.
   * The client caches the list per session and filters per keystroke.
   * @param agent - the live agent resolved from the `agentId` wire field; its
   *   session header owns the workspace cwd.
   * @param signal - caller lifetime; the walk races it.
   * @returns workspace-relative .md entries with their titles.
   */
  @Remote
  async search(agent: Agent, signal: AbortSignal): Promise<readonly NoteEntry[]> {
    if (!this.isEnabled()) {
      throw new Error('wikilink is disabled in Settings')
    }
    const cwd = agent.session.header.cwd
    if (cwd === undefined) {
      throw new Error('wikilink: the session has no workspace directory')
    }
    const index = await indexWorkspace(cwd, {
      maxFiles: this.config.maxIndexedFiles,
      ignoreDirs: this.config.ignoreDirs,
    }, signal)
    return index.files
      .filter((entry): entry is typeof entry & { kind: 'file' } => entry.kind === 'file' && entry.relative.endsWith('.md'))
      .map((entry) => {
        const base = entry.relative.slice(entry.relative.lastIndexOf('/') + 1)
        const title = base.endsWith('.md') ? base.slice(0, -3) : base
        return { path: entry.path, relative: entry.relative, title }
      })
      // A file literally named '.md' yields an empty title, which the wire
      // schema (title.min(1)) rejects — and one bad row fails the whole
      // boundary validation. Drop empty-title rows instead of failing.
      .filter((note) => note.title !== '')
  }
}

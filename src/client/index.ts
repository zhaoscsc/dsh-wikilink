/**
 * dsh-wikilink client plugin: the browser half of the Obsidian-style [[
 * mention. Mounts the wikilink Remote namespace, registers the self-drawn
 * picker on the `conversation.input.overlay` slot (no harness trigger
 * pipeline — the plugin detects `[[` from the live draft itself via
 * useInput), the settings section, and the locale dictionaries. Content
 * expansion is the Host's job at its pre-step boundary; this half only
 * picks and links.
 */
// Type-only: the ctx.remote merge and the forwarded Host-event face.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { SessionId } from '@deepseek-ai/dsh-api-remotes/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: the ctx.locale Context merge.
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the ctx.settingsScope Context merge and the scope contract.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { WikilinkSettings, NoteEntry } from '../contract.ts'
import { WIKILINK_REMOTE } from './remote.ts'
import { createIndexManager } from './index-manager.ts'
import { WikilinkOverlay, type OverlayInjected } from './Overlay.tsx'
import { WikilinkSection, type WikilinkSectionInjected } from './SettingsSection.tsx'
import { IndexStatusBar, type IndexStatusInjected } from './IndexStatusBar.tsx'
import { NS, zh, en } from './locales.ts'
import { adoptStyles } from './styles.ts'

/** Required services: session projection, carrier, Remote face, slots, locale, settings scope. */
export const inject = ['sessions', 'connection', 'remote', 'slots', 'locale', 'settingsScope']

/** The mounted wikilink namespace service's callable face. */
interface WikilinkNamespaceFace {
  search(sessionId: SessionId, signal?: AbortSignal): Promise<{ ok: true; value: readonly NoteEntry[] } | { ok: false; error: { code: string; message: string; details: object } }>
}

/**
 * Compose the [[ surface.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  adoptStyles()
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-wikilink: dictionaries')

  // The mounted namespace handle resolves through the service store
  // (`ctx.reflect.get`), not through `ctx.remote.wikilink`: the generated-style
  // dotted read walks the cordis fiber chain, which stops at the Loader's
  // runtime-less internal forks between a plugin entry and the root fiber.
  let wikilink: WikilinkNamespaceFace | undefined
  ctx.effect(async () => {
    const dispose = await ctx.remote.$mount(WIKILINK_REMOTE)
    wikilink = (ctx.reflect as unknown as { get(name: string): unknown }).get('remote.wikilink') as WikilinkNamespaceFace | undefined
    if (wikilink === undefined) {
      throw new Error('dsh-wikilink: the wikilink Remote namespace did not mount')
    }
    return () => {
      wikilink = undefined
      void dispose()
    }
  }, 'dsh-wikilink: remote')

  const t = ctx.locale.bind(NS)
  const scope = ctx.settingsScope.bind<WikilinkSettings>({ namespace: 'wikilink' })

  const search = async (sessionId: SessionId, signal: AbortSignal): Promise<readonly NoteEntry[]> => {
    if (wikilink === undefined) throw new Error('dsh-wikilink: the wikilink Remote is not mounted')
    const result = await wikilink.search(sessionId, signal)
    if (!result.ok) throw new Error(`search failed: ${result.error.code}: ${result.error.message}`)
    return result.value
  }

  const manager = createIndexManager({ search })
  // Reconnect may have rebuilt the host: cached indexes die with it.
  ctx.on('connection/reset', () => {
    manager.invalidateAll()
  })

  // Self-drawn picker: overlay slot entry. The component owns detection
  // (useInput → draft), ranking, and insertion (inputActions.setDraft).
  ctx.slots.inject('conversation.input.overlay', () => ctx.slots.register({
    name: 'conversation.input.overlay',
    id: 'wikilink-picker',
    order: 10,
    locale: NS,
    inject: (): OverlayInjected => ({
      index: manager,
      hooks: { scope },
    }),
  }, WikilinkOverlay))

  // The index-status strip: one line above the composer while the workspace
  // index is building, and a brief ready/error notice afterwards.
  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock',
    id: 'wikilink-index',
    order: 10,
    locale: NS,
    inject: (): IndexStatusInjected => ({
      status: { get: manager.getStatus, subscribe: manager.subscribeStatus },
      hooks: { scope },
    }),
  }, IndexStatusBar))

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'wikilink',
    order: 56,
    label: () => t('nav'),
    locale: NS,
    inject: (): WikilinkSectionInjected => ({
      hooks: { scope },
      setEnabled: async (enabled: boolean) => { await scope.set('enabled', enabled) },
    }),
  }, WikilinkSection))
}

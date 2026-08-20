/**
 * The index-status strip: one small line above the composer reporting the
 * workspace index lifecycle — indexing in progress, ready with the note
 * count, or failed. Rendered by the `conversation.input.dock` seat and gated
 * by the wikilink settings switch; ready/error notices auto-dismiss after a
 * few seconds.
 */
import { useEffect, useRef, useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type { WikilinkSettings } from '../contract.ts'
import type { IndexManager, WikilinkIndexStatus } from './index-manager.ts'

/** Injected business face: the live status subscription and the settings scope. */
export interface IndexStatusInjected {
  status: IndexManager
  hooks: { scope: SettingsScope<WikilinkSettings> }
}

/** Full dock entry props: InputZone owner share + injected face + locale seat. */
export type IndexStatusProps = PropsRuntime<'conversation.input.dock'> & InjectFace<IndexStatusInjected> & PropsLocale<'wikilink'>

/** How long a ready/error notice stays visible before auto-dismissing. */
const READY_VISIBLE_MS = 5000
const ERROR_VISIBLE_MS = 8000

/**
 * Render the status strip; null while idle, disabled, or after dismissal.
 * @param props - runtime share, the bound scope hook, the status face, and `t`.
 * @returns the strip, or null.
 */
export function IndexStatusBar({ useScope, status, t }: IndexStatusProps) {
  const enabled = useScope(snapshot => snapshot.value?.enabled ?? true)
  const [current, setCurrent] = useState<WikilinkIndexStatus>(() => status.getStatus())
  const [visible, setVisible] = useState(false)
  const hideTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    return status.subscribeStatus(() => {
      const next = status.getStatus()
      setCurrent(next)
      if (next.state === 'indexing') {
        setVisible(true)
        window.clearTimeout(hideTimer.current)
      } else if (next.state === 'ready' || next.state === 'error') {
        setVisible(true)
        window.clearTimeout(hideTimer.current)
        hideTimer.current = window.setTimeout(() => {
          setVisible(false)
        }, next.state === 'ready' ? READY_VISIBLE_MS : ERROR_VISIBLE_MS)
      }
    })
  }, [status])

  useEffect(() => () => window.clearTimeout(hideTimer.current), [])

  if (!enabled || !visible || current.state === 'idle') return null
  if (current.state === 'indexing') {
    return (
      <div className="dsh_wikilink_index" role="status">
        <span className="dsh_wikilink_indexSpinner" aria-hidden />
        <span className="dsh_wikilink_indexText">{t('index.indexing')}</span>
      </div>
    )
  }
  if (current.state === 'ready') {
    return (
      <div className="dsh_wikilink_index dsh_wikilink_index_ok" role="status">
        <span className="dsh_wikilink_indexText">{t('index.ready', { count: String(current.count) })}</span>
      </div>
    )
  }
  return (
    <div className="dsh_wikilink_index dsh_wikilink_index_err" role="status">
      <span className="dsh_wikilink_indexText">{t('index.error', { message: current.message })}</span>
    </div>
  )
}

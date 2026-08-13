/**
 * The settings page section for the `wikilink` namespace: one clearly labeled
 * enable checkbox over the durable settings scope. The checkbox is the native
 * browser control (uncontrolled), so clicking it flips instantly; the scope
 * write persists the value. The same scope value also gates the picker, so
 * this one checkbox is the whole switch. Product copy rides the `wikilink`
 * locale namespace.
 */
import type { PropsLocale, PropsRuntime, InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type { WikilinkSettings } from '../contract.ts'

/** Injected business face: the live scope (bound to `useScope`) and the write verb. */
export interface WikilinkSectionInjected {
  hooks: { scope: SettingsScope<WikilinkSettings> }
  setEnabled: (enabled: boolean) => Promise<void>
}

/** Full section props: runtime share + injected face + the locale seat. */
export type WikilinkSectionProps = PropsRuntime<'settings.section'> & InjectFace<WikilinkSectionInjected> & PropsLocale<'wikilink'>

/**
 * Render the section: one labeled enable checkbox.
 * @param props - runtime share, the bound scope hook, the write verb, and `t`.
 * @returns the section element tree.
 */
export function WikilinkSection({ useScope, setEnabled, t }: WikilinkSectionProps) {
  const enabled = useScope(snapshot => snapshot.value?.enabled ?? true)
  return (
    <section className="dsh_wikilink_section" aria-labelledby="dsh-wikilink-settings-title">
      <h2 id="dsh-wikilink-settings-title" className="dsh_wikilink_title">{t('settings.title')}</h2>
      <p className="dsh_wikilink_subtitle">{t('settings.subtitle')}</p>
      <label className="dsh_wikilink_card">
        <input
          type="checkbox"
          className="dsh_wikilink_checkbox"
          defaultChecked={enabled}
          onChange={(event) => { void setEnabled(event.target.checked) }}
        />
        <span className="dsh_wikilink_cardText">
          <span className="dsh_wikilink_cardTitle">{t('settings.enabled')}</span>
          <span className="dsh_wikilink_cardDesc">{t('settings.enabledDesc')}</span>
        </span>
      </label>
    </section>
  )
}

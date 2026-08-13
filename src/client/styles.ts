/**
 * The settings section stylesheet, hand-written as a template string and
 * injected once by the plugin body: the web server serves exactly one file
 * per client plugin, so no separate CSS artifact may exist. Tokens come only
 * from the shared `--dsw-alias-*` design platform (no literal colors); class
 * names carry the `dsh_wikilink` prefix to stay unique in the assembled shell.
 */

/** Stable `<style>` element id (idempotent injection across HMR re-runs). */
export const STYLE_ID = 'dsh-wikilink-style'

/** The section's injected stylesheet text. */
export const cssText = `
.dsh_wikilink_section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.dsh_wikilink_title {
  margin: 0;
  color: var(--dsw-alias-label-primary);
  font-size: 18px;
  line-height: 26px;
  font-weight: 600;
}
.dsh_wikilink_subtitle {
  margin: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 13px;
  line-height: 20px;
}
.dsh_wikilink_card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
  padding: 14px 16px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-1);
  cursor: pointer;
}
.dsh_wikilink_checkbox {
  flex: none;
  width: 18px;
  height: 18px;
  margin: 2px 0 0;
  accent-color: var(--dsw-alias-brand-primary);
  cursor: pointer;
}
.dsh_wikilink_cardText {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.dsh_wikilink_cardTitle {
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  line-height: 22px;
}
.dsh_wikilink_cardDesc {
  color: var(--dsw-alias-label-tertiary);
  font-size: 13px;
  line-height: 20px;
}
.dsh_wikilink_index {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 4px 12px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
}
.dsh_wikilink_index_ok {
  color: var(--dsw-alias-ok-foreground, var(--dsw-alias-label-primary));
}
.dsh_wikilink_index_err {
  color: var(--dsw-alias-danger-foreground, var(--dsw-alias-label-primary));
}
.dsh_wikilink_indexSpinner {
  width: 10px;
  height: 10px;
  flex: none;
  border: 2px solid var(--dsw-alias-border-l2);
  border-top-color: var(--dsw-alias-brand-primary);
  border-radius: 50%;
  animation: dsh_wikilink_spin 0.8s linear infinite;
}
@keyframes dsh_wikilink_spin {
  to { transform: rotate(360deg); }
}
`

/**
 * Inject the section stylesheet once (stable id; HMR-safe).
 */
export function adoptStyles(): void {
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = cssText
  document.head.appendChild(style)
}

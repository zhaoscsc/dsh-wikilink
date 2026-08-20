/**
 * The settings section stylesheet, hand-written as a template string and
 * injected once by the plugin body: the web server serves exactly one file
 * per client plugin, so no separate CSS artifact may exist. Tokens come only
 * from the shared `--dsw-alias-*` design platform (no literal colors); class
 * names carry the `dsh_wikilink` prefix to stay unique in the assembled shell.
 * Besides the settings section it also carries the `[[` picker menu styles
 * (`.dsh_wikilink_menu*` classes) used by the overlay picker.
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
  /* The strip is a flex item of the composer stack (column flex), whose
     default stretch alignment would blow the capsule up to the full row
     width — wider than the input card below. Pin it to its content
     (width: max-content), center it on the composer axis (margin: 0 auto),
     and cap it at the card width so even a long error message can never
     outgrow the input box. */
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  box-sizing: border-box;
  width: max-content;
  max-width: calc(100% - var(--dsh-composer-side-clearance) - var(--dsh-composer-side-clearance) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset));
  margin: 0 auto;
  flex: none;
  padding: 4px 12px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
}
.dsh_wikilink_indexText {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
.dsh_wikilink_menu {
  /* The overlay slot's anchor is an absolutely-positioned zero-height layer
     covering the composer; the menu must opt into floating above it exactly
     like the harness's own trigger menu (position:absolute + bottom:calc),
     otherwise it renders inline inside the anchor and overlaps the input. */
  position: absolute;
  bottom: calc(100% + 4px);
  left: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  min-width: min(260px, 100%);
  max-width: 560px;
  max-height: 320px;
  overflow-y: auto;
  padding: 4px;
  border: 1px solid var(--dsw-alias-border-inverted);
  border-radius: 12px;
  background: var(--dsw-specific-menu);
  box-shadow: var(--dsw-shadow-lv3);
}
.dsh_wikilink_menuItem {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 40px;
  padding: 8px 10px;
  border: none;
  border-radius: 10px;
  background: none;
  color: var(--dsw-alias-label-primary);
  text-align: left;
  font-size: 14px;
  line-height: 22px;
  cursor: pointer;
}
.dsh_wikilink_menuItem:hover,
.dsh_wikilink_menuItem_active {
  background: var(--dsw-alias-interactive-bg-hover);
}
.dsh_wikilink_menuIcon {
  width: 16px;
  height: 16px;
  flex: none;
}
.dsh_wikilink_menuName {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: none;
  max-width: 70%;
}
.dsh_wikilink_menuDir {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 1;
  color: var(--dsw-alias-label-tertiary);
}
.dsh_wikilink_menuEmpty {
  padding: 12px 10px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 13px;
  line-height: 20px;
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

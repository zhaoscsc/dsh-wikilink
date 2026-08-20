/**
 * `wikilink` locale namespace: the settings section copy. Chinese is the
 * product copy; English mirrors it.
 */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'nav': '双链引用',
  'index.indexing': '正在索引工作区文件…',
  'index.ready': '已索引 {count} 条笔记',
  'index.error': '索引失败：{message}',
  'menu.label': '双链引用候选',
  'menu.empty': '没有匹配的笔记',
  'settings.title': '笔记双链引用',
  'settings.subtitle': '在输入框输入 [[ 智能搜索笔记标题，回车附加后随消息把笔记完整内容交给模型。',
  'settings.enabled': '启用 [[ 双链引用',
  'settings.enabledDesc': '关闭后隐藏 [[ 笔记选择器，模型不再收到引用笔记的内容。',
} satisfies Record<string, string>

/** The `wikilink` namespace key union. */
export type WikilinkKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'nav': 'Wikilinks',
  'index.indexing': 'Indexing workspace files…',
  'index.ready': 'Indexed {count} notes',
  'index.error': 'Index failed: {message}',
  'menu.label': 'Wikilink candidates',
  'menu.empty': 'No matching notes',
  'settings.title': 'Note wikilinks',
  'settings.subtitle': 'Type [[ in the composer to smart-search note titles; press Enter to attach one and ship its full content to the model.',
  'settings.enabled': 'Enable [[ wikilinks',
  'settings.enabledDesc': 'Turning this off hides the [[ picker, and the model no longer receives attached note content.',
} satisfies Record<WikilinkKey, string>

/** Locale namespace id registered under ctx.locale. */
export const NS = 'wikilink'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The [[ settings copy. */
    [NS]: WikilinkKey
  }
}

# dsh-wikilink

> **中文版 README**：[README.zh.md](README.zh.md) · **简体中文文档入口**

Obsidian-style `[[wikilink]]` mentions for the DeepSeek Harness web GUI. Type `[[` in the composer and a note-title picker floats up: fuzzy search your workspace notes as you type — including **out-of-order (subsequence) matches** (「曼食」 finds 曼谷街头美食文化观察) and **space-separated multi-term matches** (「曼谷 美食」 finds 曼谷街头美食文化观察 / 曼谷笔记：美食 / 曼谷朱拉隆功夜市美食探索). Press Enter to attach, and the referenced note content ships to the model when the message is sent.

```
composer:  summarize  [[曼谷 美.    ← picker over the open token
            ┌────────────────────────────────────────────────────────┐
            │ 📄 曼谷街头美食文化观察：鱼鳔老太太摊位的夜间消费场景          │
            │ 📄 曼谷笔记：美食                                     │
            │ 📄 曼谷朱拉隆功夜市美食探索：KINNKUNG海鲜馆的惊喜体验         │
            └────────────────────────────────────────────────────────┘
draft:     summarize  [[曼谷笔记：美食]]   ← readable plain-text token
model:     <note path="5-存档/06-专题档案/数字游民/曼谷笔记：美食.md" title="曼谷笔记：美食">…content…</note>  ← injected at send time
```

Type `[[query` and the picker opens exactly on the double bracket; Enter replaces the token with `[[title]]` and the caret lands after `]]` (Obsidian-style). A single `[` in prose never triggers it.

## No harness patches needed

Earlier versions patched the installed `@deepseek-ai` client bundles to make the `[[` trigger work (the harness input pipeline only recognizes `/` and `@`). Since v0.2 the picker is fully self-drawn: the plugin watches the draft itself, renders its own floating menu on the public `conversation.input.overlay` slot, and writes the closed `[[title]]` back through the public input actions. **No patches, no re-apply step — install, restart, done.** The legacy patch script remains in the repo (`apply-harness-patches.mjs`) for history only.

## Install

```sh
dsh plugin --profile web add https://github.com/zhaoscsc/dsh-wikilink/archive/refs/heads/main.tar.gz
```

Restart the web server so the host half and the served client bundle pick up the plugin. The enable switch lives in **Settings → Wikilinks**.

## Configuration

Host-side tunables on the plugin row in the profile patch layer:

```yaml
- id: dsh-wikilink
  config:
    maxIndexedFiles: 100000   # hard cap on indexed entries (large vaults need this)
    maxFileBytes: 262144      # hard cap on one attached note; larger files are refused
    ignoreDirs: ['.git', 'node_modules']   # directory basenames the walk skips
```

The index is cached per session for 30 seconds; an index-status strip above the composer reports indexing in progress / done (with the note count) / failed.

## Model experience

| Aspect | Effect |
| --- | --- |
| Token cost | One attached note adds its complete content (up to `maxFileBytes`) to the request. |
| Tool calls | None — the content is already in the prompt. |
| Message format | Each note serializes as `<note path="…" title="…">…</note>`, injected as a user-role message with source `wikilink-mention`. |
| Resolution | `[[dir/title]]` resolves by exact path; `[[title]]` resolves only when the title is unique; unresolvable or ambiguous tokens stay plain prose. |

## Matching

Four tiers over the note title (then the relative path): contiguous substring > subsequence (out-of-order) > path substring > path subsequence. Queries split on whitespace must all match (AND). Both query and titles are NFC-normalized.

Real examples from a travel-note vault:

| Query | Result |
| --- | --- |
| `[[曼谷 美食]]` | 曼谷街头美食文化观察：鱼鳔老太太摊位的夜间消费场景 · 曼谷笔记：美食 · 曼谷朱拉隆功夜市美食探索 |
| `[[曼食]]` (out-of-order) | 曼谷**街**头美**食**文化观察（matches across skipped characters) |
| `[[鱼鳔]]` | 曼谷街头美食文化观察：鱼鳔老太太摊位的夜间消费场景 |

## Known limitations

- The picker triggers on an unclosed `[[`/`【【` at the **end of the draft** only — the public input state carries no caret info, so caret-not-at-end doesn't trigger.
- The self-drawn menu is styled and key-handled by the plugin itself, so it evolves independently from the `/` and `@` pipeline menus.
- The workspace index is cached per session for 30 seconds; files created later appear on the next menu open after that window.
- A note literally named `.md` is skipped (its empty title would fail the wire schema).
- **IME caveat:** some Chinese input methods (Sogou, WeChat, Baidu, system Pinyin, …) have a **symbol auto-completion** feature (smart punctuation / bracket auto-pairing) that auto-inserts a closing bracket when you type `[` or `【` (`[` → `[]`, `【` → `【】`). That breaks the double-open detection and the picker never opens. **Disable symbol auto-completion in the input method settings** (it may be called smart punctuation / bracket auto-pairing / symbol suggestion).

## Development

```sh
node build.mjs        # esbuild is vendored under ./node_modules; zod is inlined into the client bundle
```

See [DEV.md](DEV.md) for the architecture (self-drawn picker — no harness patches) and the build/dev loop.

## License

MIT

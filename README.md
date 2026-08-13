# dsh-wikilink

Obsidian-style `[[wikilink]]` mentions for the DeepSeek Harness web GUI. Type `[[` in the composer and a note-title picker floats up: fuzzy search your workspace notes as you type — including **out-of-order (subsequence) matches** (「曼食」 finds 曼谷美食) and **space-separated multi-term matches** (「曼谷 美食」 finds 曼谷美食). Press Enter to attach, and the referenced note content ships to the model when the message is sent.

```
composer:  summarize  [[曼谷 美.    ← picker over the token, auto-closed brackets
            ┌──────────────────────────────┐
            │ 📄 曼谷美食   5-存档/…   │
            │ 📄 曼谷游记   5-存档/…   │
            └──────────────────────────────┘
draft:     summarize  [[曼谷美食]]   ← readable plain-text token
model:     <note path="5-存档/…/曼谷美食.md" title="曼谷美食">…content…</note>  ← injected at send time
```

Typing `[[` auto-closes `]]` with the caret between the brackets (Obsidian-style), and the picker opens exactly on the double bracket — a single `[` in prose never triggers it.

## Prerequisites: harness patches

The harness input pipeline only recognizes `/` and `@` as trigger characters, so this plugin ships with **three small patches** to the installed `@deepseek-ai` client bundles (all in the npx installation cache):

1. `dsh-client-ui-input-trigger` — recognize `[` as a trigger, only in the `[[` double-bracket form; `[[` tokens may span spaces (note titles with spaces)
2. `dsh-client-ui-conversation` — auto-close `[[` into `[[]]` with the caret centered (IME-composition guard included)
3. `dsh-client-ui-input-trigger` — menu CSS: wider picker (760px) and 70% title share

**Without these patches the `[[` trigger and the auto-close will not work.** See [DEV.md](DEV.md) for the exact patch snippets. Reinstalling `@deepseek-ai/dsh` (npx cache rebuild) wipes them — re-apply per DEV.md.

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

## Known limitations

- The workspace index is cached per session for 30 seconds; files created later appear on the next menu open after that window.
- A note literally named `.md` is skipped (its empty title would fail the wire schema).
- Keyboard navigation beyond Enter/Escape is provided by the harness pipeline (same as the `/` and `@` menus).

## Development

```sh
node build.mjs        # esbuild is vendored under ./node_modules; zod is inlined into the client bundle
```

See [DEV.md](DEV.md) for the architecture, the harness patch snippets, and the build/dev loop.

## License

MIT

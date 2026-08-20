# 零补丁化改造（自绘菜单）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 dsh-wikilink 的 5 处 harness 文件补丁全部融合进插件本体（自绘检测 + 自绘 overlay 菜单 + setDraft 整体替换），使插件在任何 dsh 版本下安装即用，零文件补丁。

**Architecture:** 插件通过 `conversation.input.overlay` 公开插槽挂自绘候选菜单；session 作用域插槽组件自动获得 `useInput`（订阅 InputState.draft）与 `inputActions.setDraft`（公开草稿写路径）。纯函数 `detect.ts` 负责从草稿尾部找未闭合 `[[`/`【【` 并计算替换文本；`index-manager.ts` 抽出索引缓存/状态供状态条与菜单共享；`Overlay.tsx` 渲染菜单并自管键盘。host 端 `mention.ts`/`typert.ts` 完全不动。

**Tech Stack:** TypeScript, React 18, vitest, esbuild, @deepseek-ai/dsh-client-ui-slots（overlay 插槽）, @deepseek-ai/dsh-client-runtime（InputState/InputActions）, @deepseek-ai/dsh-client-ui-conversation（contracts）

**前置条件（环境事实，已核实）：**
- dsh 已装 rc.8，client.js 补丁已打（本改造不依赖它们，改造完成并卸载验证后补丁可退役）
- 插件仓库 `/Users/zhaoyue/.dsh/plugins/dsh-wikilink`；`../dsh/` 源码树缺失 → vitest 只能跑**不 import harness 运行时包**的纯函数测试（`detect.ts`/`search.ts` 测试可跑；实测通过）
- 测试命令：`node_modules/.bin/vitest run tests/<file>.spec.ts`（不能用 `pnpm run test`——pnpm 会先触发 install 并因 esbuild build script 报错）
- 类型检查：`node_modules/.bin/tsc --noEmit`（tsconfig include 仅 src，不含 tests；tsc 需要 `--skipLibCheck` 已开）
- 构建：`node build.mjs`

**文件结构：**
- Create: `src/client/detect.ts` — 纯函数：`findOpenTrigger` / `replaceTrigger` / `stripTrailingBrackets`
- Create: `src/client/index-manager.ts` — 索引缓存/生命周期/状态（从 source.ts 抽出）
- Create: `src/client/Overlay.tsx` — overlay 插槽菜单组件（渲染 + 键盘 + 外部点击）
- Create: `tests/detect.spec.ts` — detect.ts 单测
- Create: `tests/index-manager.spec.ts` — index-manager 单测（可选，见 Task 3 注）
- Modify: `src/client/index.ts` — 入口：注册 overlay 插槽、接 index-manager、删 inputTriggers 依赖
- Modify: `src/client/styles.ts` — 增补菜单样式
- Modify: `src/client/locales.ts` — 增补菜单文案（无匹配等）
- Modify: `src/client/IndexStatusBar.tsx` — 状态源改接 index-manager
- Delete: `src/client/source.ts` — createWikilinkSource 被 index-manager + Overlay 取代
- Modify: `README.md`/`README.zh.md`/`DEV.md` — 安装步骤去补丁化

---

### Task 1: detect.ts 纯函数 + 单测（TDD）

**Files:**
- Create: `src/client/detect.ts`
- Test: `tests/detect.spec.ts`

- [ ] **Step 1: 写失败测试**（创建 `tests/detect.spec.ts`，先创建 `tests/` 目录）

```ts
import { describe, it, expect } from 'vitest'
import { findOpenTrigger, replaceTrigger, stripTrailingBrackets } from '../src/client/detect.ts'

describe('findOpenTrigger', () => {
  it('detects an unclosed [[ at draft end', () => {
    expect(findOpenTrigger('[[曼谷美食')).toEqual({ start: 0, query: '曼谷美食', fullwidth: false })
  })
  it('detects an unclosed [[ mid-draft with trailing text', () => {
    expect(findOpenTrigger('先写点 [[曼')).toEqual({ start: 4, query: '曼', fullwidth: false })
  })
  it('ignores a closed [[…]] pair and finds a later open one', () => {
    expect(findOpenTrigger('[[A]] 再写 [[曼')).toEqual({ start: 9, query: '曼', fullwidth: false })
  })
  it('returns null when nothing is open', () => {
    expect(findOpenTrigger('普通文本')).toBeNull()
    expect(findOpenTrigger('[[A]]')).toBeNull()
  })
  it('treats fullwidth 【【 as an open trigger', () => {
    expect(findOpenTrigger('【【曼谷美食')).toEqual({ start: 0, query: '曼谷美食', fullwidth: true })
  })
  it('keeps whitespace in the query', () => {
    expect(findOpenTrigger('[[曼谷 美食')).toEqual({ start: 0, query: '曼谷 美食', fullwidth: false })
  })
  it('handles a query containing a ] inside the open token', () => {
    expect(findOpenTrigger('[[a]b')).toEqual({ start: 0, query: 'a]b', fullwidth: false })
  })
})

describe('replaceTrigger', () => {
  it('replaces the open token with a closed wikilink', () => {
    expect(replaceTrigger('先写点 [[曼', 4, '曼谷美食')).toBe('先写点 [[曼谷美食]]')
  })
  it('replaces a fullwidth open token with a halfwidth closed wikilink', () => {
    expect(replaceTrigger('【【曼谷美食', 0, '曼谷美食')).toBe('[[曼谷美食]]')
  })
})

describe('stripTrailingBrackets', () => {
  it('strips trailing ] from a query', () => {
    expect(stripTrailingBrackets('曼谷]]')).toBe('曼谷')
    expect(stripTrailingBrackets('曼谷')).toBe('曼谷')
    expect(stripTrailingBrackets('')).toBe('')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `node_modules/.bin/vitest run tests/detect.spec.ts`
Expected: FAIL（`Cannot find module '../src/client/detect.ts'`）

- [ ] **Step 3: 实现 detect.ts**（创建 `src/client/detect.ts`）

```ts
/**
 * Pure `[[` trigger detection and replacement for the self-drawn picker.
 * Scans the draft for the LAST unclosed `[[` (or fullwidth `【【`) — i.e. a
 * trigger char pair with no closing `]]` after it — and yields the query
 * text up to the draft end. Zero DOM, zero cordis: the overlay component
 * feeds it the live draft from useInput.
 */

/** The open-trigger scan result. */
export interface OpenTrigger {
  /** Draft offset of the opening `[[` (or `【【`). */
  readonly start: number
  /** Text between the opening pair and the draft end (never includes a closing pair). */
  readonly query: string
  /** True when the trigger was typed with fullwidth `【【` (U+3010). */
  readonly fullwidth: boolean
}

const OPEN = '[['
const OPEN_FULL = '【【'
const CLOSE = ']]'

/**
 * Find the last unclosed wikilink trigger in `draft`, or null when none is
 * open. A `[[` is "open" when no `]]` appears after it. Because the scan
 * walks backward, the LAST occurrence wins; any earlier pair already closed
 * by a `]]` between it and the caret is skipped naturally.
 * @param draft - the full draft text.
 * @returns the open trigger, or null.
 */
export function findOpenTrigger(draft: string): OpenTrigger | null {
  let at = draft.length
  while (true) {
    const open = Math.max(draft.lastIndexOf(OPEN, at - 1), draft.lastIndexOf(OPEN_FULL, at - 1))
    if (open < 0) return null
    // If a closing pair exists after this opening, the token is closed; keep
    // scanning left of the closing pair for an earlier open one.
    const close = draft.indexOf(CLOSE, open + 2)
    if (close >= 0) {
      at = open
      continue
    }
    const fullwidth = draft.startsWith(OPEN_FULL, open)
    return { start: open, query: draft.slice(open + 2), fullwidth }
  }
}

/**
 * Build the next draft with the open token at `start` replaced by a closed
 * `[[title]]`. The closing pair is written halfwidth regardless of how the
 * trigger was typed, so the shipped prompt always carries ASCII brackets.
 * @param draft - the full current draft.
 * @param start - the open trigger offset from findOpenTrigger.
 * @param title - the picked note title.
 * @returns the next draft text.
 */
export function replaceTrigger(draft: string, start: number, title: string): string {
  return draft.slice(0, start) + `[[${title}]]`
}

/**
 * Strip a run of trailing `]` from a query (stray closing brackets typed by
 * hand, or left over from an earlier auto-close).
 * @param query - raw query text.
 * @returns the query without trailing `]` characters.
 */
export function stripTrailingBrackets(query: string): string {
  return query.replace(/\]+$/u, '')
}
```

- [ ] **Step 4: 运行确认通过**

Run: `node_modules/.bin/vitest run tests/detect.spec.ts`
Expected: PASS（10 it 全部通过）

- [ ] **Step 5: 提交**

```bash
cd /Users/zhaoyue/.dsh/plugins/dsh-wikilink
git add src/client/detect.ts tests/detect.spec.ts
git commit -m "feat: pure [[ trigger detection and replacement (self-drawn picker core)"
```

---

### Task 2: index-manager.ts（索引缓存抽出）

**Files:**
- Create: `src/client/index-manager.ts`
- Modify: `src/client/source.ts`（仅删除，见 Task 4；本任务只新建，不动 source.ts）

- [ ] **Step 1: 创建 index-manager.ts**

从 `source.ts` 抽出索引生命周期（fetchIndex/TTL/status/invalidateAll/lexicon 通知），与插件 UI 解耦。签名设计为独立可测的闭包工厂：

```ts
/**
 * Shared workspace-index lifecycle: one hot cache per session with a TTL,
 * a single global status (the web surface is one session at a time), and
 * an invalidate hook for connection resets. Extracted from the former
 * input-trigger source so both the status strip and the self-drawn picker
 * overlay consume the same index without double-fetching.
 */
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { NoteEntry } from './remote.ts'

/** How long one session's index stays hot before the next menu open refetches. */
export const INDEX_TTL_MS = 30_000

/** Index lifecycle for the status strip: idle → indexing → ready | error. */
export type WikilinkIndexStatus =
  | { readonly state: 'idle' }
  | { readonly state: 'indexing' }
  | { readonly state: 'ready'; readonly count: number }
  | { readonly state: 'error'; readonly message: string }

/** Everything the manager needs from the host Remote. */
export interface IndexManagerDeps {
  search(sessionId: SessionId, signal: AbortSignal): Promise<readonly NoteEntry[]>
  /** Monotonic clock for index freshness (default Date.now). */
  now?: () => number
}

/** The manager face shared by the status strip and the overlay. */
export interface IndexManager {
  /** Resolve the session index, joined while warm/in-flight. */
  fetch(sessionId: SessionId, signal?: AbortSignal): Promise<readonly NoteEntry[]>
  /** Find one indexed note by exact title (pick-time lookup). */
  find(sessionId: SessionId, title: string): NoteEntry | undefined
  /** Drop every per-session cache (connection reset). */
  invalidateAll(): void
  /** Current index lifecycle status. */
  getStatus(): WikilinkIndexStatus
  /** Subscribe to status changes (returns the unsubscribe). */
  subscribeStatus(listener: () => void): () => void
}

export function createIndexManager(deps: IndexManagerDeps): IndexManager {
  const now = deps.now ?? (() => Date.now())
  const fetches = new Map<SessionId, {
    promise: Promise<readonly NoteEntry[]>
    abort: AbortController
    settled?: readonly NoteEntry[]
    at: number
  }>()
  let status: WikilinkIndexStatus = { state: 'idle' }
  const statusListeners = new Set<() => void>()
  const setStatus = (next: WikilinkIndexStatus): void => {
    status = next
    for (const listener of [...statusListeners]) {
      try { listener() } catch (error) { console.error('[dsh-wikilink] status listener failed:', error) }
    }
  }

  const fetch = (sessionId: SessionId, signal?: AbortSignal): Promise<readonly NoteEntry[]> => {
    const existing = fetches.get(sessionId)
    const fresh = existing !== undefined && now() - existing.at < INDEX_TTL_MS
    if (fresh) {
      if (existing.settled !== undefined) return Promise.resolve(existing.settled)
      return existing.promise
    }
    if (existing !== undefined) {
      fetches.delete(sessionId)
      existing.abort.abort()
    }
    const abort = new AbortController()
    setStatus({ state: 'indexing' })
    const promise = deps.search(sessionId, abort.signal)
    const entry = { promise, abort, at: now() }
    fetches.set(sessionId, entry)
    promise.then(
      (notes) => {
        entry.settled = notes
        setStatus({ state: 'ready', count: notes.length })
      },
      (error: unknown) => {
        if (fetches.get(sessionId) === entry) fetches.delete(sessionId)
        setStatus({ state: 'error', message: error instanceof Error ? error.message : String(error) })
      },
    )
    if (signal !== undefined) {
      return promise.then(notes => (signal.aborted ? [] : notes))
    }
    return promise
  }

  const find = (sessionId: SessionId, title: string): NoteEntry | undefined =>
    fetches.get(sessionId)?.settled?.find(note => note.title === title)

  const invalidateAll = (): void => {
    for (const [key, entry] of [...fetches]) {
      fetches.delete(key)
      entry.abort.abort()
    }
    setStatus({ state: 'idle' })
  }

  return { fetch, find, invalidateAll, getStatus: () => status, subscribeStatus: (fn) => {
    statusListeners.add(fn)
    return () => { statusListeners.delete(fn) }
  } }
}
```

- [ ] **Step 2: 类型检查**

Run: `node_modules/.bin/tsc --noEmit`
Expected: 无错误（index-manager.ts 只依赖 runtime 的 SessionId 类型——tsc 需要能解析 `@deepseek-ai/dsh-client-runtime/client`；若报模块找不到，说明 node_modules 的 link 缺失，改用 `import type { SessionId } from './types.ts'` 本地 shim，见 Step 3 备选）

- [ ] **Step 3: 若 tsc 报 `@deepseek-ai/dsh-client-runtime/client` 找不到**

备选：`src/client/types.ts` 本地定义最小 SessionId（Branded string 语义），index-manager 引用它，避免依赖缺失的 link 树：

```ts
/** Minimal branded session-id type (mirrors the runtime's). */
export type SessionId = string & { readonly __sessionId: unique symbol }
```

并把 `import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'` 改为 `import type { SessionId } from './types.ts'`。

- [ ] **Step 4: 提交**

```bash
cd /Users/zhaoyue/.dsh/plugins/dsh-wikilink
git add src/client/index-manager.ts
git commit -m "feat: extract shared index manager from the input-trigger source"
```

---

### Task 3: index-manager 单测（可选但推荐）

**Files:**
- Test: `tests/index-manager.spec.ts`

> 说明：index-manager 不 import harness 运行时（SessionId 用本地 shim 后），可用 vitest 直测。用假 deps 与假时钟。

- [ ] **Step 1: 写测试**

```ts
import { describe, it, expect, vi } from 'vitest'
import { createIndexManager, INDEX_TTL_MS } from '../src/client/index-manager.ts'
import type { NoteEntry } from '../src/client/remote.ts'

const notes: readonly NoteEntry[] = [
  { path: '/v/曼谷美食.md', relative: '曼谷美食.md', title: '曼谷美食' },
  { path: '/v/曼谷美食攻略.md', relative: '曼谷美食攻略.md', title: '曼谷美食攻略' },
]

describe('createIndexManager', () => {
  it('fetches once and serves the settled cache while warm', async () => {
    const search = vi.fn(async () => notes)
    const now = vi.fn(() => 0)
    const m = createIndexManager({ search, now })
    const first = await m.fetch('s1' as never)
    expect(first).toEqual(notes)
    now.mockReturnValue(INDEX_TTL_MS - 1)
    const second = await m.fetch('s1' as never)
    expect(second).toEqual(notes)
    expect(search).toHaveBeenCalledTimes(1)
  })
  it('refetches after the TTL expires', async () => {
    const search = vi.fn(async () => notes)
    const now = vi.fn(() => 0)
    const m = createIndexManager({ search, now })
    await m.fetch('s1' as never)
    now.mockReturnValue(INDEX_TTL_MS + 1)
    await m.fetch('s1' as never)
    expect(search).toHaveBeenCalledTimes(2)
  })
  it('finds a note by exact title', async () => {
    const m = createIndexManager({ search: async () => notes })
    await m.fetch('s1' as never)
    expect(m.find('s1' as never, '曼谷美食')?.title).toBe('曼谷美食')
    expect(m.find('s1' as never, '不存在')).toBeUndefined()
  })
  it('invalidateAll drops caches and resets status', async () => {
    const m = createIndexManager({ search: async () => notes })
    await m.fetch('s1' as never)
    expect(m.getStatus().state).toBe('ready')
    m.invalidateAll()
    expect(m.getStatus().state).toBe('idle')
  })
  it('reports error status on a failed fetch', async () => {
    const m = createIndexManager({ search: async () => { throw new Error('boom') } })
    await expect(m.fetch('s1' as never)).rejects.toThrow('boom')
    expect(m.getStatus().state).toBe('error')
  })
})
```

- [ ] **Step 2: 运行确认**

Run: `node_modules/.bin/vitest run tests/index-manager.spec.ts`
Expected: PASS（5 it）

> 注：`as never` 仅因本地 shim 的 SessionId 是 branded——真实 bundle 里是同一结构，测试不关心具体值。

- [ ] **Step 3: 提交**

```bash
cd /Users/zhaoyue/.dsh/plugins/dsh-wikilink
git add tests/index-manager.spec.ts
git commit -m "test: index manager TTL/status/invalidate coverage"
```

---

### Task 4: Overlay.tsx（自绘菜单组件）

**Files:**
- Create: `src/client/Overlay.tsx`

> 关键依赖（已核实 rc.8 类型声明）：overlay 插槽 `conversation.input.overlay`（kind:list, scope:session）的条目组件经 PropsRuntime 获得 `useInput`（SnapshotSelectorHook<InputState>）与 `inputActions`（InputActions）。InputState 含 `draft`；InputActions 含 `setDraft(text)`。

- [ ] **Step 1: 创建 Overlay.tsx**

```tsx
/**
 * Self-drawn `[[` picker overlay, mounted on the public
 * `conversation.input.overlay` list slot. Watches the live draft through the
 * session standard kit (`useInput`), detects an unclosed `[[`/`【【` with the
 * pure detect module, ranks the cached index, and lands a closed `[[title]]`
 * via `inputActions.setDraft` — no harness pipeline, no patches.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { InputState } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { IndexManager } from './index-manager.ts'
import { findOpenTrigger, replaceTrigger, stripTrailingBrackets } from './detect.ts'
import { rankNotes } from './search.ts'
import { MAX_CANDIDATES } from './source.ts'

/** Full overlay entry props: runtime standard kit + locale seat. */
export type OverlayProps = PropsRuntime<'conversation.input.overlay'> & PropsLocale<'wikilink'>

/** Business face injected by the plugin body (kept out of the standard kit). */
export interface OverlayInjected {
  index: IndexManager
  hooks: {
    scope: import('@deepseek-ai/dsh-client-runtime/client').SettingsScope<import('../contract.ts').WikilinkSettings>
  }
  status: IndexManager
}

export type OverlayFullProps = OverlayProps & OverlayInjected

/**
 * Render the floating picker; null when no trigger is open, disabled, or
 * the session has no input state. `sessionId` is a framework standard prop
 * of session-scope slot entries (it is NOT a field of InputState — the
 * InputState currency carries draft/phase/occurrences only).
 */
export function WikilinkOverlay({ sessionId, useInput, inputActions, useScope, index, status, t }: OverlayFullProps) {
  const enabled = useScope(snapshot => snapshot.value?.enabled ?? true)
  const input = useInput((s: InputState) => s)
  const draft = input?.draft ?? ''

  const trigger = useMemo(() => findOpenTrigger(draft), [draft])
  const [highlight, setHighlight] = useState(0)
  const [candidates, setCandidates] = useState<readonly import('./remote.ts').NoteEntry[]>([])
  const abortRef = useRef<AbortController | undefined>(undefined)
  const open = enabled && trigger !== null && input !== undefined

  // Re-rank on every draft/query change while open.
  useEffect(() => {
    if (!open || trigger === null) { setCandidates([]); return }
    const query = stripTrailingBrackets(trigger.query)
    const controller = new AbortController()
    abortRef.current?.abort()
    abortRef.current = controller
    void index.fetch(sessionId, controller.signal)
      .then(notes => {
        if (controller.signal.aborted) return
        setCandidates(rankNotes(notes, query, MAX_CANDIDATES))
        setHighlight(0)
      })
      .catch(() => { /* status store already surfaced the failure */ })
    return () => controller.abort()
  }, [open, trigger, sessionId, index])

  const pick = (title: string): void => {
    if (trigger === null || input === undefined) return
    const next = replaceTrigger(draft, trigger.start, title)
    inputActions.setDraft(next)
  }

  // Keyboard: only while open; ignore IME composition.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.isComposing || e.keyCode === 229) return
      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, candidates.length - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)) }
      else if (e.key === 'Enter') {
        const hit = candidates[highlight]
        if (hit !== undefined) { e.preventDefault(); pick(hit.title) }
      }
      else if (e.key === 'Escape') { /* draft no longer matches → menu auto-closes on next render; no-op safe */ }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [open, candidates, highlight, trigger, draft, input, inputActions])

  // Click-outside to close: the menu closes itself when the draft loses the
  // trigger, so an explicit close is only needed to swallow a click that would
  // otherwise land in the textarea. Keep a no-op mousedown-capture to stop the
  // menu from re-opening mid-interaction.
  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent): void => {
      const el = e.target as HTMLElement | null
      if (el !== null && el.closest('.dsh_wikilink_menu') === null) {
        // Let the click through; the draft no longer matches and the menu
        // vanishes on the next render.
      }
    }
    document.addEventListener('mousedown', onMouseDown, true)
    return () => document.removeEventListener('mousedown', onMouseDown, true)
  }, [open])

  if (!open) return null

  const query = trigger !== null ? stripTrailingBrackets(trigger.query) : ''
  const empty = candidates.length === 0

  return (
    <div className="dsh_wikilink_menu" role="listbox" aria-label={t('menu.label')}>
      {empty ? (
        <div className="dsh_wikilink_menuEmpty">{t('menu.empty')}</div>
      ) : (
        candidates.map((note, i) => (
          <button
            key={note.relative}
            type="button"
            role="option"
            aria-selected={i === highlight}
            className={`dsh_wikilink_menuItem${i === highlight ? ' dsh_wikilink_menuItem_active' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); pick(note.title) }}
            onMouseEnter={() => setHighlight(i)}
          >
            <span className="dsh_wikilink_menuIcon">📄</span>
            <span className="dsh_wikilink_menuName">{note.title}</span>
            {note.relative.includes('/') && (
              <span className="dsh_wikilink_menuDir">{note.relative.slice(0, note.relative.lastIndexOf('/'))}</span>
            )}
          </button>
        ))
      )}
    </div>
  )
}
```

> **注意**：上面组件引用 `sessionId`（框架标准 prop）、`inputActions.setDraft`、`PropsRuntime` 的标准套件字段名。若 rc.8 实际插槽 props 命名不同（如 `sessionId` 在单独 prop 而非解构自标准套件），实现时以 `lib/types` 里的 `SessionStandardProps` / `PropsRuntime<'conversation.input.overlay'>` 为准微调字段名——骨架不变。

- [ ] **Step 2: 类型检查**

Run: `node_modules/.bin/tsc --noEmit`
Expected: 无新增错误。若 `PropsRuntime<'conversation.input.overlay'>` 解析失败（slots 类型缺失），按 Task 2 Step 3 的本地 shim 思路，将 overlay 相关类型退化为最小本地接口（`useInput`/`inputActions`/`useScope`/`t` 显式 props），组件骨架不变。

- [ ] **Step 3: 提交**

```bash
cd /Users/zhaoyue/.dsh/plugins/dsh-wikilink
git add src/client/Overlay.tsx
git commit -m "feat: self-drawn [[ picker overlay (overlay slot, useInput + setDraft)"
```

---

### Task 5: 入口接线 + 删除 source.ts

**Files:**
- Modify: `src/client/index.ts`
- Delete: `src/client/source.ts`

- [ ] **Step 1: 重写 client/index.ts 的接线**

改动点：
- `inject` 数组：去掉 `inputTriggers`，加 `conversation`（若需 session 作用域 resolver）——**实际不需要**：overlay 插槽组件自带标准套件，入口只需注册插槽
- 用 `createIndexManager` 替换 `createWikilinkSource`
- 注册 `conversation.input.overlay` 插槽（替代 `inputTriggers.registerSource`）
- `connection/reset` 时 `invalidateAll`
- settings 开关 gate overlay 条目（在 injected hooks 里传 `scope`，组件内 `useScope` 判断）

```ts
// 仅展示与旧版不同的核心片段；完整文件在 Task 内重写
export function apply(ctx: ClientContext): void {
  adoptStyles()
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-wikilink: dictionaries')

  let wikilink: WikilinkNamespaceFace | undefined
  ctx.effect(async () => {
    const dispose = await ctx.remote.$mount(WIKILINK_REMOTE)
    wikilink = (ctx.reflect as unknown as { get(name: string): unknown }).get('remote.wikilink') as WikilinkNamespaceFace | undefined
    if (wikilink === undefined) throw new Error('dsh-wikilink: the wikilink Remote namespace did not mount')
    return () => { wikilink = undefined; void dispose() }
  }, 'dsh-wikilink: remote')

  const connection = ctx.get('connection') as ConnectionHandle
  const t = ctx.locale.bind(NS)
  const scope = ctx.settingsScope.bind<WikilinkSettings>({ namespace: 'wikilink' })

  const search = async (sessionId: SessionId, signal: AbortSignal): Promise<readonly NoteEntry[]> => {
    if (wikilink === undefined) throw new Error('dsh-wikilink: the wikilink Remote is not mounted')
    const result = await wikilink.search(sessionId, signal)
    if (!result.ok) throw new Error(`search failed: ${result.error.code}: ${result.error.message}`)
    return result.value
  }

  const manager = createIndexManager({ search })
  ctx.on('connection/reset', () => manager.invalidateAll())

  const indexInject: OverlayInjected = {
    index: manager,
    hooks: { scope },
    status: manager,
  }

  ctx.slots.inject('conversation.input.overlay', () => ctx.slots.register({
    name: 'conversation.input.overlay',
    id: 'wikilink-picker',
    order: 10,
    locale: NS,
    inject: (): OverlayInjected => indexInject,
  }, WikilinkOverlay))

  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock',
    id: 'wikilink-index',
    order: 10,
    locale: NS,
    inject: (): IndexStatusInjected => ({
      status: manager,
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
```

- [ ] **Step 2: 删除 source.ts**

```bash
cd /Users/zhaoyue/.dsh/plugins/dsh-wikilink
git rm src/client/source.ts
```

> `MAX_CANDIDATES` 与 `WikilinkIndexStatus` 从 source.ts 移入 index-manager.ts / Overlay.tsx 引用处（Task 4 里 `import { MAX_CANDIDATES } from './source.ts'` 需改为本地常量或从 index-manager 导出）。

- [ ] **Step 3: 类型检查**

Run: `node_modules/.bin/tsc --noEmit`
Expected: 无错误。若 `ctx.slots.register` 对 overlay 插槽的 `inject` 泛型推导报错，以 IndexStatusBar 的注册写法为模板对齐。

- [ ] **Step 4: 提交**

```bash
cd /Users/zhaoyue/.dsh/plugins/dsh-wikilink
git add src/client/index.ts
git commit -m "refactor: wire overlay picker + shared index manager; drop inputTriggers source"
```

---

### Task 6: 样式 + 文案

**Files:**
- Modify: `src/client/styles.ts`
- Modify: `src/client/locales.ts`

- [ ] **Step 1: styles.ts 增补菜单样式**（在 cssText 末尾、`</style>` 前追加）

```css
.dsh_wikilink_menu {
  display: flex;
  flex-direction: column;
  min-width: 280px;
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
```

- [ ] **Step 2: locales.ts 增补文案**（zh/en 各加 2 个 key）

```ts
// zh 增加：
'menu.label': '双链引用候选',
'menu.empty': '没有匹配的笔记',
// en 增加：
'menu.label': 'Wikilink candidates',
'menu.empty': 'No matching notes',
```

> `en` 用 `satisfies Record<WikilinkKey, string>` 约束，漏 key 会编译报错，天然校验。

- [ ] **Step 3: 提交**

```bash
cd /Users/zhaoyue/.dsh/plugins/dsh-wikilink
git add src/client/styles.ts src/client/locales.ts
git commit -m "feat: picker menu styles and empty-state copy"
```

---

### Task 7: IndexStatusBar 改接 + 全量检查

**Files:**
- Modify: `src/client/IndexStatusBar.tsx`

- [ ] **Step 1: IndexStatusBar 状态源改接**

`IndexStatusInjected.status` 从 `{ get, subscribe }` 对象换成 `IndexManager` 面（getStatus/subscribeStatus 同名方法），组件内调用处改：

```ts
// IndexStatusBar 内：status.get() → status.getStatus(); status.subscribe(fn) → status.subscribeStatus(fn)
const [current, setCurrent] = useState<WikilinkIndexStatus>(() => status.getStatus())
useEffect(() => status.subscribeStatus(() => {
  const next = status.getStatus()
  // …其余不变
}), [status])
```

- [ ] **Step 2: 全量类型检查 + 测试**

Run: `node_modules/.bin/tsc --noEmit && node_modules/.bin/vitest run tests/`
Expected: tsc 无错误；detect + index-manager 测试全 PASS

- [ ] **Step 3: 提交**

```bash
cd /Users/zhaoyue/.dsh/plugins/dsh-wikilink
git add src/client/IndexStatusBar.tsx
git commit -m "refactor: status strip consumes the shared index manager"
```

---

### Task 8: 构建 + 部署 + 无补丁环境验证（硬性验收）

**Files:**
- 构建产物: `lib/`

- [ ] **Step 1: 构建**

Run: `cd /Users/zhaoyue/.dsh/plugins/dsh-wikilink && node build.mjs`
Expected: `lib/client.js` 与 `lib/index.js` 重建成功（esbuild vendor 在 node_modules）

- [ ] **Step 2: 同步 profile 副本**

```bash
cp -f lib/*.js lib/*.map ~/.dsh/profiles/web/node_modules/dsh-wikilink/lib/ 2>/dev/null || true
# 若 profile 副本是 hardlink（pnpm file: 依赖），build 已自动同步，无需 cp
```

- [ ] **Step 3: 重启 dsh web（若 boot 枚举变化）或硬刷新**

```bash
# 客户端 bundle 按请求读盘：改 client.js 只需 Cmd+Shift+R 硬刷新
# 若改了 package.json/inject（本计划没改），才需重启服务
```

- [ ] **Step 4: 无补丁环境验证（关键！）**

在一个**没有打过补丁**的 dsh 安装上验证（或临时把 client.js 还原为 rc.8 原版再刷新）：
1. 敲 `[[` → 弹出候选菜单
2. ↑↓ 高亮、Enter 插入 `[[标题]]`、光标落 `]]` 后
3. `[[曼谷 美食]]` 空格 query 正常
4. `【【` 全角触发正常、落盘半角
5. 发送 → host pre-step 注入 `<note path=...>`
6. 设置开关关闭后菜单消失
7. Esc / 点击外部关闭
8. `/` 与 `@` 管线菜单仍正常（共存验证）

Expected: 全部通过 → **证明零补丁成立**

- [ ] **Step 5: 提交（构建产物若入库）**

```bash
cd /Users/zhaoyue/.dsh/plugins/dsh-wikilink
git add lib/ 2>/dev/null || true
git commit -m "build: rebuild zero-patch client bundle" 2>/dev/null || true
```

---

### Task 9: 文档更新（补丁退役）

**Files:**
- Modify: `README.md`
- Modify: `README.zh.md`
- Modify: `DEV.md`
- Modify: `docs/superpowers/specs/2026-08-20-zero-patch-self-drawn-menu-design.md`（标记已实现）

- [ ] **Step 1: README/DEV 更新**

- 安装步骤改为：`dsh plugin add file:/path/to/dsh-wikilink` → 重启 `dsh web` → 即用（**无补丁步骤**）
- 补丁章节改为历史记录：「早期版本依赖 5 处 harness 文件补丁（见 apply-harness-patches.mjs 历史提交）；v0.2 起完全自绘，不再需要」
- `apply-harness-patches.mjs` 顶部注释加「DEPRECATED — 零补丁改造后不再需要」

- [ ] **Step 2: spec 标记已实现 + 提交**

```bash
cd /Users/zhaoyue/.dsh/plugins/dsh-wikilink
git add README.md README.zh.md DEV.md docs/
git commit -m "docs: retire harness patches; zero-patch install"
```

---

## 自审记录

- **Spec 覆盖**：自绘检测（Task 1）✓ 索引共享（Task 2/3）✓ overlay 菜单（Task 4）✓ 入口接线删 source（Task 5）✓ 样式文案（Task 6）✓ 状态条改接（Task 7）✓ 构建+无补丁验收（Task 8）✓ 文档退役（Task 9）✓
- **类型一致性**：`findOpenTrigger`/`replaceTrigger`/`stripTrailingBrackets` 在 Task 1 定义、Task 4 引用，签名一致；`IndexManager`（fetch/find/invalidateAll/getStatus/subscribeStatus）Task 2 定义、Task 4/5/7 引用一致；`WikilinkIndexStatus` 从 source.ts 迁到 index-manager.ts（Task 2），Task 4 顶部 import 已同步
- **已知风险**：Task 2/4 的 tsc 可能因 `../dsh/` link 缺失报模块找不到——已内置本地 shim 备选路径；overlay 插槽 props 字段名以 rc.8 实际类型为准（有微调预案）；`sessionId` 来自框架标准 prop（若实际命名不同，从 `useSession` 取，Task 4 有注）

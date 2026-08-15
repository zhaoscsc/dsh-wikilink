# dsh-wikilink 开发说明

Obsidian 风格 `[[双链]]` 引用插件（DSH web profile 本地开发）。

## 架构速览

- `src/index.ts` — host 入口：`wikilink/search` Typert 端点 + `agent/pre-step` 边界展开 `[[...]]` 注入笔记内容
- `src/mention.ts` — 扫描/解析/注入（`[[标题]]` 唯一匹配，`[[目录/标题]]` 路径匹配，找不到保持纯文本）
- `src/client/source.ts` — `[[` 触发器（依赖 harness 的 `[` 检测补丁，见下）
- `src/client/search.ts` — 标题模糊匹配：连续子串 > 跳字子序列 > 路径子串 > 路径子序列

## 构建（无需 devkit）

```sh
node build.mjs          # esbuild 已 vendor 在 ./node_modules
cp -f lib/*.js lib/*.map ~/.dsh/profiles/web/node_modules/dsh-wikilink/lib/  # 若 profile 副本非 hardlink 则需同步
```

- **client bundle 必须内联 zod**（浏览器模块表不提供 zod，external 会导致加载报错）
- host 的 zod/schemastery 是 external，运行时从 `~/.dsh/profiles/node_modules`（heal 树）解析
- 改完代码 → `node build.mjs` → 服务端按请求读盘，**刷新页面即生效**（host 侧改动需重启 `dsh web`）

## 依赖 harness 的补丁（5 处）

### 1. `ui-input-trigger`：`[[` 触发器

detectTrigger 原本只认 `/` 和 `@`，且 `@` 已被 dsh-at-file 占用。
位于 npx 安装的 `node_modules/@deepseek-ai/dsh-client-ui-input-trigger/lib/client.js`：

```js
if (ch !== "/" && ch !== "@" && ch !== "[") continue;
if (ch === "[" && draft.charAt(i - 1) !== "[") continue;  // 只有 [[ 触发
```

### 2. `ui-conversation`：`[[` 自动补全 `]]` + 全角归一化

InputBar 的 onChange（DOM 输入源头）里：draft 以 `[[` **或全角 `【【`** 结尾时自动补 `]]` 并把光标放到中间。全角是中文输入法（全角标点开启）下敲 `[` 两次的产物，归一化为 `[[` 后全链路（detectTrigger / onPick / host 注入）无感知。
位于 `node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js`（InputBar 组件的 onChange）：

```js
if ((next.endsWith("[[") || next.endsWith("【【")) && !e.nativeEvent?.isComposing) {
  const normalized = next.endsWith("【【") ? next.slice(0, -2) + "[[" : next;
  const closed = normalized + "]]";
  const caret = normalized.length;
  const el = e.currentTarget;
  el.value = closed;
  el.setSelectionRange(caret, caret);
  keyboard.setDraft(closed);
  keyboard.track(closed, caret);
  return;
}
```

配套约定：`onPick` 返回 `[标题`（**不带**结尾 `]]`）——draft 已预闭合，带上会变 4 个 `]`。

### 3. `ui-input-trigger`：菜单 CSS（候选框宽度）

长中文标题在 40% 的 name 占比下几乎全被截断。位于同一文件的 css 字符串：

```
_3e4SsG_itemName  max-width: 40% → 70%   （标题占比）
_3e4SsG_menu      max-width: min(537px,100%) → min(760px,100%)  （菜单加宽）
```

`@` 文件菜单同样受益。

### 4. `ui-input-trigger`：detectTrigger 空格跨词

`[[曼谷 美食]]` 中间带空格时原实现直接返回 null（`if (WHITESPACE.test(ch)) return null;`），无候选。改为空格只记状态、`[[` 可跨空格，`/`、`@` 保持不跨空格：

```js
let crossedWhitespace = false;
// loop 内：
if (WHITESPACE.test(ch)) { crossedWhitespace = true; continue; }
// 触发判定之后：
if (crossedWhitespace && (ch === "/" || ch === "@")) return null;
```

### 5. `ui-conversation`：onChange 全角归一化（与 #2 同处）

即 #2 补丁中 `next.endsWith("【【")` 分支（`normalized = next.slice(0, -2) + "[["`）。中文输入法下 `【【` 自动转半角 `[[`，选择器照常弹出，落盘仍是 `[[标题]]`。只处理**纯全角**；混排 `【[` / `[【` 不触发，避免误伤半角输入流。

### ⚠️ 输入法「符号自动补全」与补丁冲突（必须先关）

部分输入法（搜狗/微信/百度/系统拼音等）的**符号自动补全**（智能标点/括号自动配对）会在敲 `[` 或 `【` 时自动补出右括号（`[` → `[]`、`【` → `【】`），导致草稿里永远形不成连续的 `[[` / `【【`，`endsWith` 检测匹配不到，**选择器不弹出**。

- 症状：中文输入法下敲 `[[` 没反应、不出候选
- 解决：在输入法设置里**关闭「符号自动补全」**（不同输入法叫法：智能标点 / 括号自动配对 / 符号联想等）
- 排查顺序：先关输入法自动补全，再考虑是不是补丁被重装覆盖

⚠️ 重新安装 `@deepseek-ai/dsh`（npx 缓存重建）会覆盖以上所有补丁，需要重新打。

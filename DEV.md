# dsh-wikilink 开发说明

Obsidian 风格 `[[双链]]` 引用插件（DSH web profile 本地开发）。

## 架构速览

- `src/index.ts` — host 入口：`wikilink/search` Typert 端点 + `agent/pre-step` 边界展开 `[[...]]` 注入笔记内容
- `src/mention.ts` — 扫描/解析/注入（`[[标题]]` 唯一匹配，`[[目录/标题]]` 路径匹配，找不到保持纯文本）
- `src/client/detect.ts` — 纯函数：`findOpenTrigger`/`replaceTrigger`/`stripTrailingBrackets`（草稿尾部未闭合 `[[`/`【【` 检测与整体替换）
- `src/client/index-manager.ts` — 共享索引缓存（fetch/TTL/status/invalidateAll），索引状态条与选择器菜单共用
- `src/client/Overlay.tsx` — 自绘选择器：注册在 `conversation.input.overlay` 插槽，`useInput` 订阅草稿 → `rankNotes` 排序 → `setDraft` 插入
- `src/client/search.ts` — 标题模糊匹配：连续子串 > 跳字子序列 > 路径子串 > 路径子序列

`[[` 触发完全在插件侧完成（`findOpenTrigger` 自检测），不依赖任何 harness 补丁。

## 构建（无需 devkit）

```sh
node build.mjs          # esbuild 已 vendor 在 ./node_modules
cp -f lib/*.js lib/*.map ~/.dsh/profiles/web/node_modules/dsh-wikilink/lib/  # 若 profile 副本非 hardlink 则需同步
```

- **client bundle 必须内联 zod**（浏览器模块表不提供 zod，external 会导致加载报错）
- host 的 zod/schemastery 是 external，运行时从 `~/.dsh/profiles/node_modules`（heal 树）解析
- 改完代码 → `node build.mjs` → 服务端按请求读盘，**刷新页面即生效**（host 侧改动需重启 `dsh web`）

## 自绘选择器架构（零补丁）

选择器完全自绘，不依赖任何 harness 补丁：

- **检测**：`detect.ts` 的 `findOpenTrigger` 从草稿尾部向前找最后一个未闭合的 `[[`/`【【`，返回 `{start, query, fullwidth}`；全角 `【【` 等价识别，插入统一落半角 `[[标题]]`；无命中返回 null 关闭菜单。v1 限定**光标在草稿末尾**的场景——公开的 `InputState` 不含 caret 信息。
- **菜单**：自绘浮层挂在公开的 `conversation.input.overlay` 插槽（`kind:'list'; scope:'session'`，与 `/`、`@` 管线菜单同为 list 条目、互不干扰）；`useInput` 订阅草稿，每次变化重渲染；候选经 `rankNotes` 过滤。样式由 `styles.ts` 的 `.dsh_wikilink_menu*` 全权控制（`position:absolute; bottom:calc(100%+4px)` 浮于输入框上方）。
- **键盘/交互**：↑↓ 高亮、Enter 选中（必须 `preventDefault`，否则消息被发出）、Esc 关闭、点击外部关闭；`isComposing`/`keyCode===229` 期间不响应。全部插件自管。
- **插入**：`replaceTrigger` 把 `[[query` 整体替换为 `[[标题]]` → `inputActions.setDraft(next)` 写回，光标落 `]]` 之后（React 受控 textarea 默认行为）。**刻意不做光标居中**——公开 API 控不了 caret，Obsidian 式「整体替换」恰好绕开旧补丁 2 的诉求。

**为什么零补丁可行**：harness 的输入触发管线对插件是硬编码的（`TriggerChar = '/' | '@'`，`detectTrigger` 只认这两个），声明式做不到——但 harness 暴露了绕开管线的公开扩展面：`conversation.input.overlay` 插槽 + 会话标准套件（`useInput` / `inputActions`）。检测、渲染、写回全部在插件侧完成，无需改任何 `@deepseek-ai` bundle。

**历史补丁（5 处，已成历史）**：早期版本靠 5 处 client.js 补丁实现 `[[` 触发 / 自动补 `]]` 光标居中 / 菜单 CSS 加宽 / 空格跨词 / `【【` 全角归一化，dsh 每次升级都会冲掉、需重打。这些能力现已被自绘实现取代，逐一对应关系与取舍见[零补丁自绘菜单设计](docs/superpowers/specs/2026-08-20-zero-patch-self-drawn-menu-design.md)（含 5→0 对照表），补丁脚本已随零补丁改造删除，不再参与安装流程。

### ⚠️ 输入法「符号自动补全」与自检测冲突（必须先关）

部分输入法（搜狗/微信/百度/系统拼音等）的**符号自动补全**（智能标点/括号自动配对）会在敲 `[` 或 `【` 时自动补出右括号（`[` → `[]`、`【` → `【】`），导致草稿里永远形不成连续的 `[[` / `【【`，`findOpenTrigger` 匹配不到，**选择器不弹出**。

- 症状：中文输入法下敲 `[[` 没反应、不出候选
- 解决：在输入法设置里**关闭「符号自动补全」**（不同输入法叫法：智能标点 / 括号自动配对 / 符号联想等）
- 排查顺序：先关输入法自动补全，再确认插件已加载（`[[` 检测在插件侧，无需任何补丁）

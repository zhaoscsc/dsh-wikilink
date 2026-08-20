# dsh-wikilink 零补丁化改造设计（自绘菜单）

> 日期：2026-08-20
> 状态：已确认（用户逐节审阅通过）
> 状态：**已实现并验收通过**（2026-08-20，v1.4）
> 目标：把 5 处 harness 文件补丁全部融合进插件，使任何人在任何 dsh 版本下「安装 → 重启 → 即用」，不再依赖 `apply-harness-patches.mjs`。

## 背景与动机

- dsh 每次升级（rc.6→rc.7→rc.8）都会冲掉 5 处 client.js 补丁；rc.8 还重构了 `detectTrigger`，旧锚点失配需逐版适配
- 补丁本质是「让 `[` 进 harness 的输入触发管线」，而管线对插件是硬编码的（`TriggerChar = '/' | '@'`，`detectTrigger` 只认这两个），插件声明式做不到 → 只能改文件
- 但 harness 暴露了绕开管线的公开路径（见下），使「零补丁」可行

## 关键公开 API 依据（rc.8 类型声明核实）

| API | 作用 | 依据 |
|---|---|---|
| `conversation.input.overlay` 插槽 | `kind:'list'; scope:'session'` 浮层锚点；ui-input-trigger 的菜单也是 list 条目之一 → 插件条目可与管线菜单共存 | `dsh-client-ui-input-trigger/lib/types/client/slots.d.ts` |
| `useInput` | session 作用域插槽组件自动获得的标准套件：订阅 InputState（含 `draft`，每次变化重渲染） | `dsh-client-ui-conversation/lib/types/client/contract/slots.d.ts` `SessionStandardProps` |
| `inputActions.setDraft(text)` | 公开草稿写路径（全量写；occurrence 数学走 diff 扫描） | 同上 `InputActions` |

限制：`InputState` 不含 caret → 检测策略为「草稿尾部未闭合 `[[`」，v1 限定光标在末尾场景。

## 目标架构

```
输入:  [[曼谷美食          ← 无自动补 ]]（Obsidian 式）
检测:  插件 watch useInput(draft) → findOpenTrigger 找最后一个未闭合 [[ 或 【【
菜单:  自绘浮层（conversation.input.overlay 插槽）→ 复用 rankNotes 标题匹配
选择:  ↑↓/Enter/Esc 插件自管（document keydown capture；IME 组合态不响应）
插入:  inputActions.setDraft(next) → replaceTrigger 整体替换为 [[标题]]，光标落 ]] 后
模型:  <note path="...">…内容…</note>  ← host 端 pre-step 注入（完全不动）
```

## 组件拆分

| 模块 | 职责 | 状态 |
|---|---|---|
| `src/client/detect.ts`（新） | `findOpenTrigger(draft)`：找最后一个未闭合 `[[`/`【【`，返回 `{start, query, fullwidth}`；`replaceTrigger(draft, title)`：整体替换；query 尾部残 `]` 剥离 | 纯函数，可单测 |
| `src/client/index-manager.ts`（新） | 从 `source.ts` 抽出 fetchIndex/TTL/status/invalidateAll，status bar 与菜单共享（命名避开已有的入口 `src/client/index.ts`） | 重构 |
| `src/client/Overlay.tsx`（新） | overlay 插槽条目：useInput 订阅 → 检测 → 拉索引 → 渲染候选；键盘/外部点击处理 | 新建 |
| `src/client/search.ts` `remote.ts` `locales.ts` `styles.ts` `SettingsSection.tsx` `IndexStatusBar.tsx` | 原样复用（styles 增补菜单样式） | 不变/小改 |
| `src/client/source.ts` 的 `createWikilinkSource` | 删除（不再注册 inputTriggers source） | 移除 |
| host 端 `mention.ts`/`typert.ts` | 不动 | 不变 |

## 交互细节

**检测**：从后往前找最后一个未闭合 `[[`（其后无配对 `]]`）；`【【`（U+3010）等价识别，插入统一落半角 `[[标题]]`；无命中返回 null 关菜单。光标不在末尾时不触发（v1 限制）。

**菜单**：
- 打开条件：命中 + 设置启用 + 索引可用
- query 空 → 显示全部标题（前 24 个，MAX_CANDIDATES）
- query 变化 → rankNotes 过滤（连续子串 > 跳字子序列 > 路径匹配）
- 键盘：↑↓ 高亮、Enter 选中（必须 preventDefault，否则消息被发出）、Esc 关闭；`isComposing`/`keyCode===229` 期间不响应
- 点击外部关闭（document mousedown）；空态显示「无匹配」文案（避免闪烁）

**插入**：`replaceTrigger` 把 `[[query` 整体替换为 `[[标题]]` → `setDraft(next)` → 光标落 `]]` 后（React 受控 textarea 默认行为）。不预补、不居中——公开 API 控不了光标，Obsidian 式交互恰好绕开补丁 2 诉求。

**共存**：overlay 为 list 插槽，与管线菜单互不干扰；触发器字符不同不会同时打开；自家 keydown 只在自家菜单打开时生效。

**设置与状态条**：启用开关继续 gate 菜单；IndexStatusBar 原样保留，索引来源换成新索引管理器。

## 补丁清理（5 → 0）

| 原补丁 | 取代它的插件侧能力 | 处置 |
|---|---|---|
| 1. `[` 进 detectTrigger | findOpenTrigger 自检测 | 不再需要 |
| 2. onChange 自动补 `]]` 光标居中 | Obsidian 式整体替换，光标落末尾 | 不再需要 |
| 3. 菜单 CSS 加宽 | 自绘菜单样式（styles.ts 全权控制） | 不再需要 |
| 4. detectTrigger 空格跨词 | 自检测天然支持空格 query | 不再需要 |
| 5. onChange `【【` 归一化 | findOpenTrigger 等价识别全角，插入落半角 | 不再需要 |

- `apply-harness-patches.mjs` 从安装流程退役，保留仓库作历史记录
- README/DEV.md 安装步骤改为：`dsh plugin add` → 重启 → 即用
- 硬性验收：在无任何补丁的 rc.8 client.js 上跑通 `[[` 全流程

## 测试

- `detect.ts` 纯函数单测（vitest，新增 `tests/` 目录）：多 `[[` 嵌套、`[[A]]` 后开新 `[[`、全角 `【【`、空格 query、尾部残 `]`、无闭合返回 null
- `search.ts` 已有测试不动
- 浏览器手动验证清单：敲 `[[` 弹菜单、↑↓ 选择、Enter 插入且光标落 `]]` 后、Esc 关闭、点击外部关闭、`【【` 全流程、发送后 host 注入 `<note>`
- 注：插件仓库当前无 `tests/` 且 `../dsh/` 源码树缺失（vitest 别名解析失败）——本次新增 `tests/` 补纯函数单测（最大质量杠杆）；若 vitest 别名仍解析失败，退化为纯函数 node 脚本断言 + 手动验证

## 落地步骤

1. `detect.ts` 纯函数 + 单测（TDD）
2. `index-manager.ts`（客户端）索引管理器抽出，IndexStatusBar 改接
3. `Overlay.tsx` overlay 插槽组件
4. `client/index.ts` 去掉 registerSource，改注册 `conversation.input.overlay`；删 `source.ts`
5. `styles.ts` 增补菜单样式
6. 构建 → 同步 profile 副本 → 重启 → 手动验证清单
7. 无补丁环境验证（硬性验收）
8. README/DEV.md/复盘笔记更新

## 取舍（写入文档）

- 光标不在草稿末尾时不触发（无 caret 信息，v1 限制）
- 自绘菜单与 `/`、`@` 管线菜单外观/行为不同步（独立演进）
- Enter 拦截、外部点击关闭等交互细节插件自管，需持续维护

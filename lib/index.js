var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __knownSymbol = (name2, symbol) => (symbol = Symbol[name2]) ? symbol : Symbol.for("Symbol." + name2);
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __decoratorStart = (base) => [, , , __create(base?.[__knownSymbol("metadata")] ?? null)];
var __decoratorStrings = ["class", "method", "getter", "setter", "accessor", "field", "value", "get", "set"];
var __expectFn = (fn) => fn !== void 0 && typeof fn !== "function" ? __typeError("Function expected") : fn;
var __decoratorContext = (kind, name2, done, metadata, fns) => ({ kind: __decoratorStrings[kind], name: name2, metadata, addInitializer: (fn) => done._ ? __typeError("Already initialized") : fns.push(__expectFn(fn || null)) });
var __decoratorMetadata = (array, target) => __defNormalProp(target, __knownSymbol("metadata"), array[3]);
var __runInitializers = (array, flags, self, value) => {
  for (var i = 0, fns = array[flags >> 1], n = fns && fns.length; i < n; i++) flags & 1 ? fns[i].call(self) : value = fns[i].call(self, value);
  return value;
};
var __decorateElement = (array, flags, name2, decorators, target, extra) => {
  var fn, it, done, ctx, access, k = flags & 7, s = !!(flags & 8), p = !!(flags & 16);
  var j = k > 3 ? array.length + 1 : k ? s ? 1 : 2 : 0, key = __decoratorStrings[k + 5];
  var initializers = k > 3 && (array[j - 1] = []), extraInitializers = array[j] || (array[j] = []);
  var desc = k && (!p && !s && (target = target.prototype), k < 5 && (k > 3 || !p) && __getOwnPropDesc(k < 4 ? target : { get [name2]() {
    return __privateGet(this, extra);
  }, set [name2](x) {
    return __privateSet(this, extra, x);
  } }, name2));
  k ? p && k < 4 && __name(extra, (k > 2 ? "set " : k > 1 ? "get " : "") + name2) : __name(target, name2);
  for (var i = decorators.length - 1; i >= 0; i--) {
    ctx = __decoratorContext(k, name2, done = {}, array[3], extraInitializers);
    if (k) {
      ctx.static = s, ctx.private = p, access = ctx.access = { has: p ? (x) => __privateIn(target, x) : (x) => name2 in x };
      if (k ^ 3) access.get = p ? (x) => (k ^ 1 ? __privateGet : __privateMethod)(x, target, k ^ 4 ? extra : desc.get) : (x) => x[name2];
      if (k > 2) access.set = p ? (x, y) => __privateSet(x, target, y, k ^ 4 ? extra : desc.set) : (x, y) => x[name2] = y;
    }
    it = (0, decorators[i])(k ? k < 4 ? p ? extra : desc[key] : k > 4 ? void 0 : { get: desc.get, set: desc.set } : target, ctx), done._ = 1;
    if (k ^ 4 || it === void 0) __expectFn(it) && (k > 4 ? initializers.unshift(it) : k ? p ? extra = it : desc[key] = it : target = it);
    else if (typeof it !== "object" || it === null) __typeError("Object expected");
    else __expectFn(fn = it.get) && (desc.get = fn), __expectFn(fn = it.set) && (desc.set = fn), __expectFn(fn = it.init) && initializers.unshift(fn);
  }
  return k || __decoratorMetadata(array, target), desc && __defProp(target, name2, desc), p ? k ^ 4 ? extra : desc : target;
};
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateIn = (member, obj) => Object(obj) !== obj ? __typeError('Cannot use the "in" operator on this value') : member.has(obj);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);

// src/index.ts
import z3 from "@deepseek-ai/schemastery";

// src/runtime.ts
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";

// src/files.ts
import { opendir, readFile, stat } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
var BINARY_PROBE_BYTES = 8192;
function raceAbort(operation, signal) {
  if (signal === void 0) return operation;
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      operation.catch(() => {
      });
      reject(asError(signal.reason));
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
    operation.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (reason) => {
        signal.removeEventListener("abort", onAbort);
        reject(asError(reason));
      }
    );
  });
}
function asError(reason) {
  return reason instanceof Error ? reason : new Error(String(reason));
}
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}
function displayRelative(root, child) {
  return relative(root, child).split(sep).join("/");
}
function closeOrSwallow(handle, signal) {
  const closing = handle.close();
  if (signal?.aborted) {
    closing.catch(() => {
    });
    return Promise.resolve();
  }
  return closing;
}
async function indexWorkspace(root, options, signal) {
  const ignore = new Set(options.ignoreDirs);
  const files = [];
  const queue = [root];
  let truncated = false;
  while (queue.length > 0) {
    signal?.throwIfAborted();
    const dir = queue.shift();
    let handle;
    try {
      handle = await raceAbort(opendir(dir), signal);
    } catch (error) {
      signal?.throwIfAborted();
      throw new Error(`at-file: cannot list "${dir}": ${messageOf(error)}`);
    }
    try {
      for (; ; ) {
        const dirent = await raceAbort(handle.read(), signal);
        if (dirent === null) break;
        if (files.length >= options.maxFiles) {
          truncated = true;
          break;
        }
        if (dirent.isSymbolicLink()) continue;
        const child = join(dir, dirent.name);
        if (dirent.isDirectory()) {
          if (ignore.has(dirent.name)) continue;
          files.push({ path: child, relative: displayRelative(root, child), kind: "dir" });
          queue.push(child);
          continue;
        }
        if (dirent.isFile()) files.push({ path: child, relative: displayRelative(root, child), kind: "file" });
      }
    } finally {
      await closeOrSwallow(handle, signal);
    }
    if (truncated) break;
  }
  files.sort((a, b) => a.relative < b.relative ? -1 : 1);
  return { files, truncated };
}
async function readFileText(path, maxBytes, signal) {
  if (!isAbsolute(path)) {
    throw new Error(`at-file: "${path}" is not an absolute path`);
  }
  const info = await raceAbort(stat(path), signal).catch((error) => {
    signal?.throwIfAborted();
    throw new Error(`at-file: cannot read "${path}": ${messageOf(error)}`);
  });
  if (info.isDirectory()) {
    throw new Error(`at-file: "${path}" is a directory`);
  }
  if (info.size > maxBytes) {
    throw new Error(
      `at-file: "${path}" is ${String(info.size)} bytes; the limit is ${String(maxBytes)} bytes (host config maxFileBytes)`
    );
  }
  const buffer = await raceAbort(readFile(path), signal).catch((error) => {
    signal?.throwIfAborted();
    throw new Error(`at-file: cannot read "${path}": ${messageOf(error)}`);
  });
  if (buffer.subarray(0, BINARY_PROBE_BYTES).includes(0)) {
    throw new Error(`at-file: "${path}" is a binary file`);
  }
  return { content: buffer.toString("utf8"), bytes: buffer.byteLength };
}

// src/runtime.ts
var _search_dec, _a, _init;
var WikilinkRuntime = class extends (_a = TypertRemoteService, _search_dec = [Remote], _a) {
  /**
   * Register the service under the `wikilink` key (the wire namespace).
   * @param ctx - owning cordis context.
   * @param config - resolved plugin configuration.
   * @param isEnabled - live settings read; false refuses the endpoint.
   */
  constructor(ctx, config, isEnabled) {
    super(ctx, "wikilink");
    this.config = config;
    this.isEnabled = isEnabled;
    __runInitializers(_init, 5, this);
  }
  async search(agent, signal) {
    if (!this.isEnabled()) {
      throw new Error("wikilink is disabled in Settings");
    }
    const cwd = agent.session.header.cwd;
    if (cwd === void 0) {
      throw new Error("wikilink: the session has no workspace directory");
    }
    const index = await indexWorkspace(cwd, {
      maxFiles: this.config.maxIndexedFiles,
      ignoreDirs: this.config.ignoreDirs
    }, signal);
    return index.files.filter((entry) => entry.kind === "file" && entry.relative.endsWith(".md")).map((entry) => {
      const base = entry.relative.slice(entry.relative.lastIndexOf("/") + 1);
      const title = base.endsWith(".md") ? base.slice(0, -3) : base;
      return { path: entry.path, relative: entry.relative, title };
    }).filter((note) => note.title !== "");
  }
};
_init = __decoratorStart(_a);
__decorateElement(_init, 1, "search", _search_dec, WikilinkRuntime);
__decoratorMetadata(_init, WikilinkRuntime);

// src/contract.ts
import { z } from "zod";
var sessionIdSchema = z.string().min(1);
var noteEntrySchema = z.object({
  path: z.string().min(1),
  relative: z.string().min(1),
  title: z.string().min(1)
}).readonly();
var WIKILINK_INVOCATIONS = [
  {
    id: "dsh-wikilink#wikilink/search",
    service: "wikilink",
    namespace: "wikilink",
    method: "search",
    invocation: { kind: "direct" },
    parameters: [
      {
        name: "agent",
        wire: "agentId",
        source: "lookup",
        lookup: "agent",
        // The type symbol must equal the agent lookup provider's wire identity
        // exactly — the gateway's strict path rejects a mismatched symbol.
        codec: { mode: "strict", typeSymbol: "@deepseek-ai/dsh-session/types#SessionId", schema: sessionIdSchema }
      }
    ],
    cancellation: { parameter: "signal" },
    result: {
      mode: "strict",
      typeSymbol: "dsh-wikilink#NoteEntry[]",
      schema: z.array(noteEntrySchema)
    }
  }
];

// src/typert.ts
var TYPERT_MANIFEST = {
  package: "dsh-wikilink",
  face: "host",
  schemas: [],
  model: {
    services: [
      {
        key: "wikilink",
        exportName: "WikilinkRuntime",
        description: "Workspace note-title index for the [[ picker.",
        tags: [],
        members: [
          {
            kind: "method",
            name: "search",
            signature: "search(agent: Agent, signal: AbortSignal): Promise<readonly NoteEntry[]>"
          }
        ],
        types: []
      }
    ],
    events: [],
    objects: []
  },
  invocations: WIKILINK_INVOCATIONS
};

// src/settings.ts
import z2 from "@deepseek-ai/schemastery";
import { settingsNamespace } from "@deepseek-ai/dsh-settings";
var WIKILINK_NAMESPACE = settingsNamespace("wikilink");
var WikilinkSettingsSchema = z2.object({
  enabled: z2.boolean().default(true)
});
function registerWikilinkSettings(ctx) {
  return ctx.settings.register(WIKILINK_NAMESPACE, WikilinkSettingsSchema, { applies: "live" });
}

// src/mention.ts
import { isAbsolute as isAbsolute2 } from "node:path";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
var USER_SOURCE_KIND = "user";
var WIKILINK_PATTERN = /\[\[([^\[\]]+)\]\]/g;
function scanWikilinks(text) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const match of text.matchAll(WIKILINK_PATTERN)) {
    const raw = match[1].trim();
    if (raw === "" || seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
  }
  return out;
}
async function buildNoteIndex(cwd, config, signal) {
  const index = await indexWorkspace(cwd, {
    maxFiles: config.maxIndexedFiles,
    ignoreDirs: config.ignoreDirs
  }, signal);
  const byTitle = /* @__PURE__ */ new Map();
  const byRelative = /* @__PURE__ */ new Map();
  for (const entry of index.files) {
    if (entry.kind !== "file" || !entry.relative.endsWith(".md")) continue;
    const base = entry.relative.slice(entry.relative.lastIndexOf("/") + 1);
    const title = base.slice(0, -3);
    const note = { path: entry.path, relative: entry.relative, title };
    byRelative.set(entry.relative, note);
    const list = byTitle.get(title);
    if (list === void 0) byTitle.set(title, [note]);
    else list.push(note);
  }
  return { byTitle, byRelative };
}
function resolveWikilink(token, index) {
  if (token.includes("/")) {
    const exact = index.byRelative.get(token);
    if (exact !== void 0) return exact;
    return index.byRelative.get(`${token}.md`);
  }
  const matches = index.byTitle.get(token);
  if (matches === void 0 || matches.length !== 1) return void 0;
  return matches[0];
}
function noteForm(entry, content) {
  const body = content.endsWith("\n") ? content : `${content}
`;
  return `<note path="${entry.relative}" title="${entry.title}">
${body}</note>`;
}
async function expandWikilinks(messages, cwd, config, signal) {
  if (cwd === void 0 || !isAbsolute2(cwd)) return [];
  const tokens = [];
  for (const message of messages) {
    if (message.source.kind !== USER_SOURCE_KIND) continue;
    for (const block of message.content) {
      if (block.type !== "text") continue;
      tokens.push(...scanWikilinks(block.text));
    }
  }
  if (tokens.length === 0) return [];
  signal.throwIfAborted();
  const index = await buildNoteIndex(cwd, config, signal);
  const injections = [];
  const injected = /* @__PURE__ */ new Set();
  for (const token of tokens) {
    signal.throwIfAborted();
    const entry = resolveWikilink(token, index);
    if (entry === void 0 || injected.has(entry.path)) continue;
    injected.add(entry.path);
    const content = await readFileText(entry.path, config.maxFileBytes, signal);
    injections.push(createUserMessage({
      content: [{ type: "text", text: noteForm(entry, content.content) }],
      source: { kind: "wikilink-mention", path: entry.path, title: entry.title }
    }));
  }
  return injections;
}
async function wikilinkPreStep(agent, config, isEnabled, messages, signal, next) {
  const decision = await next();
  if (decision.kind === "reject") return decision;
  if (!isEnabled()) return decision;
  const injections = await expandWikilinks(messages, agent.session.header.cwd, config, signal);
  if (injections.length === 0) return decision;
  return { kind: "enter", messages: [...decision.messages, ...injections] };
}

// src/index.ts
var name = "dsh-wikilink";
var inject = ["typert", "settings", "agents"];
var Config = z3.object({
  // 100k covers large vaults (~40k entries here); the old 5k default
  // truncated the walk in mid-tree and deep directories never indexed.
  maxIndexedFiles: z3.natural().min(1).default(1e5),
  maxFileBytes: z3.natural().min(1).default(256 * 1024),
  ignoreDirs: z3.array(z3.string()).default([".git", "node_modules"])
});
function apply(ctx, config) {
  const resolved = Config(config ?? {});
  const settings = registerWikilinkSettings(ctx);
  const isEnabled = () => settings.get().enabled;
  new WikilinkRuntime(ctx, resolved, isEnabled);
  ctx.effect(() => {
    const dispose = ctx.typert.register(TYPERT_MANIFEST);
    return () => {
      void dispose();
    };
  }, "dsh-wikilink: typert manifest");
  ctx.on("agent/created", ({ agent }) => {
    agent.ctx.effect(() => {
      const stop = agent.ctx.on("agent/pre-step", async ({ messages, signal }, next) => {
        return wikilinkPreStep(agent, resolved, isEnabled, messages, signal, next);
      });
      return () => {
        stop();
      };
    }, "dsh-wikilink: pre-step mention expansion");
  });
}
export {
  Config,
  apply,
  inject,
  name
};
//# sourceMappingURL=index.js.map

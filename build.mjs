/**
 * Single-file client + ESM host build for dsh-wikilink.
 *
 * The web server serves exactly one file per plugin (/plugins/dsh-wikilink/client.js),
 * so the client half is one CJS bundle wrapped in the ModuleLoader factory
 * handshake. `@deepseek-ai/dsh-*`, cordis, and the react family stay external
 * (the browser module table and the profile's healed node_modules provide
 * them); **zod is bundled into the client** because the browser module table
 * does not ship it. The host half is plain ESM for Node, externalizing
 * @deepseek-ai/dsh-* plus cordis, zod, and schemastery (the Loader resolves
 * them from the healed `~/.dsh/profiles/node_modules` at runtime).
 *
 * Dev-loop notes: esbuild is vendored under ./node_modules (no devkit needed);
 * `nodePaths` points at the healed profile node_modules so zod resolves for
 * the client bundle. Run `node build.mjs` from this directory, then sync the
 * hardlinked profile copy if needed:
 *   cp -f lib/*.js lib/*.map ~/.dsh/profiles/web/node_modules/dsh-wikilink/lib/
 */
import { build } from 'esbuild'
import { mkdirSync } from 'node:fs'

mkdirSync('lib', { recursive: true })

const dshExternal = ['@deepseek-ai/cordis', '@deepseek-ai/dsh-*']
const healedModules = ['/Users/zhaoyue/.dsh/profiles/node_modules']

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: ['node22'],
  sourcemap: true,
  // zod and schemastery resolve at runtime from the healed profile node_modules.
  external: [...dshExternal, 'zod', '@deepseek-ai/schemastery'],
  logLevel: 'info',
})

await build({
  entryPoints: ['src/client/index.ts'],
  outfile: 'lib/client.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['es2022'],
  sourcemap: true,
  jsx: 'automatic',
  // zod is deliberately NOT external here: the browser module table does not
  // ship it, so it must be inlined (nodePaths resolves it from the heal tree).
  nodePaths: healedModules,
  external: [...dshExternal, 'react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'scheduler'],
  banner: {
    js: "window.__ModuleLoader__.load({ id: 'dsh-wikilink', factory: (require) => { var module = { exports: {} }; var exports = module.exports;",
  },
  footer: {
    js: 'return module.exports; } });',
  },
  logLevel: 'info',
})

// The d.ts/typecheck pass needs the full devkit (link:../dsh), which this
// standalone checkout does not have; skip it here — lib/*.js are the runtime
// artifacts the Loader and the web server actually consume.

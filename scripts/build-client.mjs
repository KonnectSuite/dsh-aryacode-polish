/**
 * Emit `lib/client.js` from `client/face.js` and `client/switches.json`.
 *
 * The Shell loads a browser face through `window.__ModuleLoader__.load({ id,
 * factory })`, where `id` must equal the package name and `factory` receives the
 * Shell's frozen module table as `require`. There is no bundler here: the face
 * only names modules the Shell already answers (`react`), so wrapping the source
 * is enough, and keeping it a wrapper means the emitted bundle stays readable
 * when someone has to debug it inside a running app.
 */

import { readFileSync, writeFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'))
const declaration = JSON.parse(readFileSync(new URL('client/switches.json', root), 'utf8'))
const money = readFileSync(new URL('client/money.js', root), 'utf8')
const account = readFileSync(new URL('client/account.js', root), 'utf8')
const face = readFileSync(new URL('client/face.js', root), 'utf8')
/*
 * html2canvas is the one third-party script the face needs: the right panel can
 * only be captured by rasterising the DOM, because the Shell exposes no
 * screenshot bridge (see docs/panel-screenshot.md). It is vendored rather than
 * required because the Shell's module table answers react and react-dom only.
 * The UMD build assigns itself to globalThis, which is where face.js reads it.
 */
const html2canvas = readFileSync(new URL('vendor/html2canvas.min.js', root), 'utf8')

const id = manifest.name
if (typeof id !== 'string' || !id.startsWith('@')) {
  throw new Error(`package.json name is not a scoped package name: ${String(id)}`)
}
if (!Array.isArray(declaration.switches)) {
  throw new Error('client/switches.json must carry a "switches" array')
}
if (typeof declaration.row !== 'string' || declaration.row === '') {
  throw new Error('client/switches.json must name the row id it configures')
}

/** Indent every line of a block by four spaces, leaving blank lines empty. */
const indent = text => text.split('\n').map(line => (line === '' ? '' : '    ' + line)).join('\n')

const constants = [
  `const SWITCHES = ${JSON.stringify(declaration.switches, null, 2)}`,
  `const ROW_ID = ${JSON.stringify(declaration.row)}`,
  `const ROW_KEY = ${JSON.stringify(id)} + '#' + ROW_ID`,
  `const CLIENT_VERSION = ${JSON.stringify(manifest.version)}`,
].join('\n')

const header = [
  '/**',
  ` * ${id} — the browser face bundle.`,
  ' *',
  ' * GENERATED FILE. Edit client/face.js or client/switches.json and run',
  ' * `pnpm build:client`; nothing here should be hand-edited.',
  ' */',
].join('\n')

const bundle = `${header}
window.__ModuleLoader__.load({
  id: ${JSON.stringify(id)},
  factory: (require) => {
${indent(constants)}

/* html2canvas 1.4.1 — MIT, vendored from vendor/html2canvas.min.js.
 * A UMD build, so it assigns itself to globalThis; face.js reads it lazily. */
${indent(html2canvas.trimEnd())}

${indent(money.trimEnd().replace(/^export /gm, ''))}

${indent(account.trimEnd().replace(/^export /gm, ''))}

${indent(face.trimEnd())}
  },
})
`

writeFileSync(new URL('lib/client.js', root), bundle, 'utf8')
process.stdout.write(`wrote lib/client.js (${bundle.length} bytes, ${declaration.switches.length} switch(es))\n`)

/**
 * The browser face is what makes every feature switchable, so these checks hold
 * it to the two facts the Shell depends on: the bundle registers itself under
 * the package name, and the Configure page it registers is keyed to this
 * bundle's row. The switch list must also agree with the host registry — a
 * switch with no feature would toggle nothing, and a feature with no switch
 * could never be turned off.
 */

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

import { features } from '../entries/registry.js'

const root = new URL('../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const manifest = JSON.parse(read('package.json'))
const declaration = JSON.parse(read('client/switches.json'))
const bundle = read('lib/client.js')

test('the manifest declares a browser face the Shell can find', () => {
  assert.equal(manifest.dsh.client?.platform, 'web')
  assert.equal(manifest.exports?.['./client'], './lib/client.js')
  assert.ok(existsSync(new URL('lib/client.js', root)), 'lib/client.js must be committed; the Shell loads it at runtime')
  assert.deepEqual(manifest.files.filter(entry => entry === 'client/**/*'), ['client/**/*'], 'the face source ships with the package')
})

test('the emitted bundle is loaded under the package name', () => {
  assert.match(bundle, /window\.__ModuleLoader__\.load\(/)
  assert.ok(bundle.includes(`id: ${JSON.stringify(manifest.name)}`), 'the module id must equal the package name')
  assert.ok(bundle.includes('plugins.row.config'), 'the face must register the row configuration slot')
})

test('the row configuration entry is keyed to this bundle row', () => {
  assert.ok(bundle.includes(`${JSON.stringify(manifest.name)} + '#' + ROW_ID`), 'the key is built from the package name and the row id')
  assert.ok(bundle.includes(`const ROW_ID = ${JSON.stringify(declaration.row)}`))
  assert.equal(declaration.row, 'polish', 'the row id must match cordis.patch.yml')
})

test('the face requires only modules the Shell answers', () => {
  const required = [...bundle.matchAll(/require\('([^']+)'\)/g)].map(match => match[1])
  assert.deepEqual(
    required,
    ['react', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives'],
    'the frozen module table answers these three; anything else must be inlined',
  )
})

test('the cost pill wears the composer stat skin instead of a widget of its own', () => {
  assert.ok(bundle.includes("'data-composer-stat': 'polish-cost'"), 'the pill is addressable as a composer stat')
  assert.ok(bundle.includes('whiteSpace: \'nowrap\''), 'the label never wraps')
  assert.ok(bundle.includes('var(--dsw-alias-label-tertiary'), 'it takes the row\'s tertiary label colour')
  assert.ok(bundle.includes('tabular-nums'), 'digits keep the row\'s alignment')
  assert.ok(bundle.includes("React.createElement('dl'"), 'the card readings are a definition list like the native dialog')
  assert.ok(bundle.includes('ReactDOM.createPortal'), 'the card escapes the composer\'s clipping')
  assert.ok(bundle.includes('--dsw-elevation-prominent'), 'the card takes the harness dialog elevation')
})

test('every portaled panel paints an opaque surface of its own', () => {
  assert.ok(
    bundle.includes("backgroundColor: 'Canvas'"),
    'the panel carries an opaque base: a plugin portal sits outside the themed tree, and the AryaCode desktop build does not composite backdrop-filter',
  )
  assert.ok(
    bundle.includes('linear-gradient(var(--dsw-specific-menu'),
    'the harness menu fill is layered as a tint over that base rather than used as the background itself',
  )
  assert.ok(
    bundle.includes('var(--dsw-menu-backdrop-filter'),
    'the blur is still requested where the platform honours it',
  )
})

test('the GitHub dialog can sign the CLI in and out from inside the app', () => {
  assert.ok(bundle.includes("'Sign in with GitHub'"), 'a signed-out machine is offered the sign-in')
  assert.ok(bundle.includes("'Sign out'"), 'a signed-in machine is offered the way out')
  assert.ok(bundle.includes("githubCall('login')"), 'sign-in starts the CLI device flow through the Host')
  assert.ok(bundle.includes("githubCall('loginStatus')"), 'the flow is polled rather than assumed')
  assert.ok(bundle.includes("githubCall('loginCancel')"), 'a pending flow can be abandoned')
  assert.ok(bundle.includes("githubCall('logout')"), 'sign-out goes through the Host')
  assert.ok(bundle.includes("'data-polish-github': 'code'"), 'the one-time code is shown verbatim')
  assert.ok(bundle.includes('https://github.com/login/device'), 'the device page is linked')
})

test('a sign-out says which account is signed in afterwards', () => {
  // `gh auth logout --user` only removes the account it names; the CLI then makes
  // another keyring account active, so silence would be a lie.
  assert.ok(bundle.includes("githubCall('logoutAll')"), 'every account can be signed out at once')
  assert.ok(bundle.includes("'data-polish-github': 'signoutall'"), 'the multi-account sign-out is reachable')
  assert.ok(bundle.includes('The GitHub CLI is now signed in as'), 'a fallback account is named, not hidden')
  assert.ok(bundle.includes("'data-polish-github': 'notice'"), 'the outcome is shown in the dialog')
  assert.ok(bundle.includes('githubStatusStore.set(status)'), 'the footer follows a status the dialog read')
  assert.ok(bundle.includes('React.useSyncExternalStore(githubStatusStore.subscribe, githubStatusStore.get)'), 'the footer subscribes to that store')
})

test('every switch has a label and a description', () => {
  for (const entry of declaration.switches) {
    assert.equal(typeof entry.key, 'string')
    assert.match(entry.key, /^[a-z][A-Za-z0-9]*$/)
    assert.ok(entry.label.length > 0, `${entry.key} needs a label`)
    assert.ok(entry.description.length > 0, `${entry.key} needs a description`)
  }
})

test('the face registers every surface it ships, each under its own key', () => {
  for (const slot of [
    'plugins.row.config',
    'conversation.composer.dock',
    'sidebar.footer.action',
    'sidebar.workspaces.session.menu.item',
    'sidebar.workspaces.directoryFlow',
  ]) {
    assert.ok(bundle.includes(`'${slot}'`), `the face must register ${slot}`)
  }
  assert.match(bundle, /id: 'polish-cost'/)
  assert.match(bundle, /id: 'polish-balance'/)
  assert.match(bundle, /id: 'polish-open-folder'/)
  assert.match(bundle, /id: 'polish-github'/)
})

test('the Workspaces "+" menu offers both sources and honours the flow contract', () => {
  assert.ok(bundle.includes("'On this PC'"), 'the source menu names the machine')
  assert.ok(bundle.includes("'GitHub repository…'"), 'the source menu names GitHub')
  assert.ok(
    bundle.includes('__DSH_DIRECTORY_PICKER__'),
    'in the desktop app the machine source must open the real OS chooser through the preload bridge',
  )
  assert.ok(
    bundle.includes("foldersCall({ action: 'roots' })"),
    'a browser has no OS chooser bridge, so the flow lists folders instead of waiting on one',
  )
  assert.ok(
    bundle.includes("foldersCall({ action: 'ls', path })"),
    'the browser walks folders through the same route, so it behaves the same in the app and in the web build',
  )
  assert.equal(
    bundle.includes('directoryPicker'),
    false,
    'the Remote picker is not used: it hangs in a browser, and the preload bridge already covers the app',
  )
  for (const handedBack of ['props.onPicked(path)', 'props.onCancel()']) {
    assert.ok(
      bundle.includes(handedBack),
      `the flow hands the chosen path back through ${handedBack}, so the Shell creates the workspace`,
    )
  }
  assert.ok(
    bundle.includes('takePicker()'),
    'a dialog opened by the flow gives the clone back to the flow instead of creating a second workspace',
  )
  assert.ok(
    bundle.includes('priority: -1'),
    'a single slot clashes at equal priority and the lowest renders, so the flow must shadow the shipped picker instead of colliding with it',
  )
})

test('a cloned repository becomes a workspace through the Workspace service', () => {
  assert.ok(
    bundle.includes("inject(['workspaces']"),
    'the workspace create call needs the workspaces service declared, or the Shell refuses it',
  )
  assert.ok(
    bundle.includes('workspaces.create({ path })'),
    'a clone is registered through the same create call the "+" menu uses',
  )
  assert.ok(
    !bundle.includes('remote.workspaces'),
    'the Remote namespace is remote.workspace (singular); the service is the documented door',
  )
  assert.ok(bundle.includes('data-polish-github'), 'the dialog and its entry are addressable for verification')
})

test('the workspace row opens the folder through the Session Remote', () => {
  assert.ok(
    bundle.includes('openWorkspacePath('),
    'opening a folder is the Session Remote method, not a shell hack',
  )
  assert.ok(
    bundle.includes('canOpenWorkspacePath('),
    'the Host is asked whether it can open a path before the row is offered',
  )
  assert.ok(
    bundle.includes("inject(['workspaces', 'remote', 'remote.session']"),
    'the workspace row declares every service it reaches; the Shell refuses an undeclared namespace',
  )
  assert.ok(
    !bundle.includes('onContextMenu'),
    'the workspace row is not hijacked: a plugin cannot own that menu without a shell change',
  )
})

test('the balance line registers only where the account namespace exists', () => {
  assert.ok(
    bundle.includes("inject(['remote', 'remote.account']"),
    'the balance surface must wait for the account namespace instead of reading through ctx.get',
  )
  assert.ok(bundle.includes('getBalance('), 'the balance comes from the account Remote method')
  assert.ok(bundle.includes('CLIENT_VERSION'), 'the account call needs a client version the build stamps')
  assert.ok(
    !bundle.includes("whenAccess('account/watch'"),
    'the balance read must not wait for a grant a plugin is not given',
  )
})

test('the switch list and the feature registry agree', () => {
  const declared = declaration.switches.map(entry => entry.key).sort()
  const registered = features.map(feature => feature.id).sort()
  assert.deepEqual(declared, registered, 'client/switches.json and entries/registry.js must name the same features')
})

test('the emitted bundle lists exactly the declared switches', () => {
  for (const entry of declaration.switches) {
    assert.ok(bundle.includes(`"key": ${JSON.stringify(entry.key)}`), `${entry.key} is missing from lib/client.js; run pnpm build:client`)
  }
})

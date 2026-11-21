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
const faceSource = read('client/face.js')
const previewSource = read('client/preview.js')
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
  assert.match(bundle, /id: 'polish-shot'/)
})

test('the composer row can photograph the open right panel into the chat', () => {
  assert.ok(
    bundle.includes('html2canvas'),
    'the rasteriser has to travel inside the bundle: the Shell answers react and react-dom only',
  )
  assert.ok(
    bundle.includes('[data-sidebar-right-session][data-sidebar-right-open] [data-dockkit-pane-active]'),
    'the capture targets the open right-panel tab, which is the same node for the Shell sidebar and better-sidebar',
  )
  assert.ok(
    bundle.includes('data-dockkit-strip-chrome'),
    'the camera is portalled into the docking kit chrome seat, so it shares the Shell own controls\' gap, box and alignment instead of floating on coordinates',
  )
  assert.ok(
    bundle.includes('ReactDOM.createPortal(') && bundle.includes('SHOT_CHROME_SELECTOR'),
    'the strip control is mounted into the strip itself, which is what makes it join the cluster in docked, split and fullscreen layouts',
  )
  assert.ok(
    !bundle.includes('function shotAnchor('),
    'no coordinate maths is left over from the floating draft of this button',
  )
  assert.ok(
    bundle.includes('shotStore.set('),
    'the session-scoped composer props travel up to the root overlay through the store, because only a session slot receives them',
  )
  assert.ok(
    !bundle.includes("'data-composer-stat': 'polish-shot'"),
    'the composer row no longer carries the camera: the panel header does',
  )
  assert.ok(
    bundle.includes('conversation.createDrafts('),
    'the picture enters the chat through the conversation service draft intake, so it lands where a pasted image does',
  )
  assert.ok(
    bundle.includes('addAttachments('),
    'minting a draft is only half the job: the composer is what actually holds the image',
  )
  assert.ok(
    bundle.includes("new ClipboardItem({ 'image/png': blob })"),
    'the same picture goes to the clipboard',
  )
  assert.ok(bundle.includes("'data-polish-shot': phase"), 'the control reports its own state')
})

test('a panel capture paints its busy state and photographs a copy, not the app document', () => {
  assert.ok(
    bundle.includes('const SHOT_PIXEL_BUDGET = 2_400_000'),
    'the rasteriser blocks the thread, so the canvas area has a budget instead of a bare device ratio',
  )
  assert.ok(
    bundle.includes('function shotScale(width, height)'),
    'the scale comes from the box being captured, not from the screen alone',
  )
  assert.ok(
    bundle.includes('function shotCascade()') && bundle.includes('shotCascadeText'),
    'the app cascade is serialised once, because copying it per capture is the slow part',
  )
  assert.ok(
    bundle.includes('async function captureInFrame(node, width, height)') && bundle.includes('frame.srcdoc'),
    'the panel is cloned into a small document of its own so the rasteriser clones that, not the whole shell',
  )
  assert.ok(
    bundle.includes('await captureInFrame(node, width, height)') && bundle.includes('} catch {'),
    'drawing in place stays as the fallback when the frame path cannot run',
  )
  assert.ok(
    bundle.includes('width,') && bundle.includes('height,') && bundle.includes('imageTimeout: 2000'),
    'the capture is bounded to the visible box so a tall panel cannot rasterise its whole scroll height',
  )
  assert.ok(
    bundle.includes('function nextPaint()') && bundle.includes('await nextPaint()'),
    'the busy state is painted before the synchronous rasteriser starts, so the click is acknowledged',
  )
  assert.ok(
    bundle.includes('function ShotSpinnerGlyph()') && bundle.includes("phase === 'busy'"),
    'a turning ring, not a dead camera, is what the button shows while the capture runs',
  )
})

test('the Workspaces "+" menu offers both sources and honours the flow contract', () => {
  assert.ok(bundle.includes("'On this PC'"), 'the source menu names the machine')
  assert.ok(bundle.includes("'GitHub repository…'"), 'the source menu names GitHub')
  assert.ok(bundle.includes("'Install the GitHub CLI'"), 'a machine without the CLI is offered the install')
  assert.ok(bundle.includes("githubCall('install')"), 'install runs through the Host, not the browser')
  assert.ok(bundle.includes("githubCall('installStatus')"), 'the install is polled like the sign-in')
  assert.ok(bundle.includes("'data-polish-github': 'install'"), 'the install button is addressable')
  assert.ok(bundle.includes("'GitHub · no CLI'"), 'the footer says the CLI is missing, not signed out')
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
  // A plugin may not reach into a row the Shell draws. The folder row therefore
  // stays a menu row of its own, and the workspace row is reached the sanctioned
  // way: the shared menu service, which the polish.workspace contribution below
  // adds a Copy path row to.
  assert.ok(
    !bundle.includes('data-row-key'),
    'no private row attribute is patched: a release would erase that',
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

test('the foot stacks instead of competing for the row', () => {
  // `sidebar.footer.action` is one flex ROW shared with every installed plugin, so
  // a crowded foot is a width contest: our status text once crushed a
  // remote-access plugin's button down to `Rem…`. Polish turns the row into a
  // column while its entry is mounted and restores it when it goes.
  for (const marker of [
    'const footerStack = { claims: 0, restore: undefined }',
    "rowStyle.flexDirection = 'column'",
    "rowStyle.alignItems = 'stretch'",
    "display === 'contents'",
    'const FOOT_ENTRY = {',
    "width: '100%'",
  ]) {
    assert.ok(faceSource.includes(marker), 'the face should carry ' + marker)
  }
  assert.equal(
    (faceSource.match(/claimFooterRow\(root\.current\)/g) || []).length,
    1,
    'the GitHub identity is the one footer seat',
  )
  for (const marker of ['footerStack', 'claimFooterRow', 'flexDirection']) {
    assert.ok(bundle.includes(marker), 'the bundle should carry ' + marker)
  }
})

test('the GitHub row is an identity peer of the account row, with its picture', () => {
  // Same metrics as `ui-settings-account`'s trigger: 44px row, 24px picture,
  // 14px label. The picture comes from the Host as a data URL, so the webview
  // never asks a third-party host for it.
  for (const marker of [
    'const IDENTITY_ROW = {',
    "height: '44px'",
    "width: '24px'",
    "fontSize: '14px'",
    "'data-polish-github-avatar': 'photo'",
    "githubCall('avatar')",
  ]) {
    assert.ok(faceSource.includes(marker), 'the face should carry ' + marker)
  }
  assert.ok(!faceSource.includes("`GitHub · ${String(current.login)}`"), 'the signed-in label is the login, like the account row')
  for (const marker of ['data-polish-github-avatar', "githubCall('avatar')"]) {
    assert.ok(bundle.includes(marker), 'the bundle should carry ' + marker)
  }
  const githubHost = read('entries/github.js')
  for (const marker of ["action === 'avatar'", 'readAvatar', 'avatars.githubusercontent.com', 'MAX_AVATAR_BYTES']) {
    assert.ok(githubHost.includes(marker), 'the GitHub host half should carry ' + marker)
  }
})

test('the balance sits at the right end of the DeepSeek row', () => {
  // The row is the Shell's and offers no seat, so the pill is portalled into the
  // settings row itself — located by the Shell's own `data-slot`, never by a
  // CSS-module class name.
  for (const marker of [
    'function accountRow()',
    '[data-slot="sidebar.settings"]',
    "'data-polish-balance-slot'",
    "title: 'DeepSeek API balance'",
    "'data-polish-balance': 'ready'",
  ]) {
    assert.ok(faceSource.includes(marker), 'the face should carry ' + marker)
  }
  assert.equal(
    /name: 'sidebar\.footer\.action',[\s\S]{0,240}?id: 'polish-balance'/.test(faceSource),
    false,
    'the balance no longer takes a footer line',
  )
  assert.ok(faceSource.includes("name: 'shell.overlay'"), 'the pill rides the frame overlay')
  assert.equal(/\.[A-Za-z]+Row|triggerRow/.test(faceSource), false, 'the row is found structurally, not by class name')
  for (const marker of ['data-polish-balance-slot', 'DeepSeek API balance', 'sidebar.settings']) {
    assert.ok(bundle.includes(marker), 'the bundle should carry ' + marker)
  }
})

test('inline previews ride the turn tail the Shell already renders', () => {
  // `conversation.chat.turnTail` is a LIST seat: ui-deliverables, ui-plan and
  // ui-schedule already contribute cards there, so this is an addition. A keyed
  // `tool.call.toolview` occupant would have replaced the shipped write/edit row
  // — its diff, output and state — which is the fork this bundle avoids.
  for (const marker of [
    "ctx.slots.inject('conversation.chat.turnTail'",
    "id: 'polish-inline-preview'",
  ]) {
    assert.ok(faceSource.includes(marker), 'the face should carry ' + marker)
  }
  assert.ok(!faceSource.includes("'tool.call.toolview'"), 'the card must not replace the shipped tool rows')
  for (const marker of [
    "'data-polish-preview-frame'",
    "sandbox: 'allow-scripts'",
    'previewDocument(',
    'Content-Security-Policy',
    "default-src 'none'",
    "'data-polish-preview-open'",
    "'data-polish-preview-zoom'",
    "height: '280px'",
    "'live · '",
  ]) {
    assert.ok(previewSource.includes(marker), 'the card should carry ' + marker)
  }
  assert.ok(!previewSource.includes('allow-same-origin'), 'a framed document never gets same-origin')
  assert.ok(!previewSource.includes('srcdoc='), 'the frame is fed srcDoc, never a URL it could navigate')
  for (const marker of ['polish-inline-preview', 'data-polish-preview-frame', 'inlinePreviews']) {
    assert.ok(bundle.includes(marker), 'the bundle should carry ' + marker)
  }
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


test('the workspace row menu gains exactly one row: Copy path', () => {
  // The shipped list already registers Rename, Reveal and Delete for a workspace.
  // This package adds the row it does not - the path on the clipboard - as one
  // registration against the Shell menu service, and replaces no shipped surface.
  assert.ok(faceSource.includes("ctx.inject(['contextMenus']"), 'the face binds the shared menu service')
  assert.ok(faceSource.includes('contextMenus.register({'), 'the face contributes to a menu')
  assert.ok(faceSource.includes("id: 'polish.workspace'"), 'the contribution is keyed to this package')
  assert.ok(faceSource.includes("target: 'workspace'"), 'it targets the workspace row')
  assert.ok(faceSource.includes('order: 250'), 'it sits with the read-only rows, before the Delete separator')
  assert.ok(faceSource.includes("id: 'copyPath'"), 'the row copies the path')
  assert.ok(faceSource.includes("icon: { key: 'workspace.copy' }"), 'it wears an icon key the shipped menu already draws')
  assert.ok(faceSource.includes('contextMenus.notify('), 'the copy reports itself to the menu')
  for (const marker of [
    "id: 'polish.workspace'",
    "target: 'workspace'",
    "id: 'copyPath'",
    'contextMenus.register(',
  ]) {
    assert.ok(bundle.includes(marker), 'the bundle should carry ' + marker)
  }
  assert.equal((bundle.match(/polish\.workspace/g) || []).length, 1, 'exactly one workspace menu contribution')
  // And the mirror that used to stand in for the shipped list is gone from both.
  assert.ok(!bundle.includes('installWorkspaceSeat('), 'the seat that replaced the sidebar list is gone')
  assert.ok(!faceSource.includes('installWorkspaceSeat('), 'the seat is gone from the source too')
  assert.ok(!bundle.includes('conversation.hero.workspace'), 'the Hero picker override is gone')
  assert.ok(!bundle.includes('data-polish-trash'), 'the trash UI is gone')
})

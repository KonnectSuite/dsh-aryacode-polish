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
const workspaceSource = read('client/workspace.js')
const manifest = JSON.parse(read('package.json'))
const declaration = JSON.parse(read('client/switches.json'))
const bundle = read('lib/client.js')

test('the filter says how many rows survived it, and marks the part that matched', () => {
  assert.match(workspaceSource, /'data-polish-ws-matches'/)
  assert.match(workspaceSource, /'data-polish-hit': 'true'/)
  assert.match(workspaceSource, /highlightParts\(/)
  // A session row is focused by its walk index; a workspace row has its own flag. Mixing the two
  // threw "rowFocused is not defined" inside the seat and blanked the whole tree.
  assert.match(workspaceSource, /'data-polish-cursor': rowFocused \? 'true' : undefined/)
  assert.match(workspaceSource, /'data-polish-cursor': focused \? 'true' : undefined/)
  assert.match(workspaceSource, /event\.key === 'Home' \|\| event\.key === 'End'/)
})

test('a session can be pinned by dropping it on the Pinned header', () => {
  assert.match(workspaceSource, /dropping === 'pinned'/)
  assert.match(workspaceSource, /kind: 'pinned'/)
  assert.match(workspaceSource, /services\.pinSession\(moving\.id\)/)
  assert.match(workspaceSource, /services\.unpinSession\(moving\.id\)/)
  assert.match(workspaceSource, /typeBufferRef/)
})

test('a folder wears its own colour and glyph', () => {
  assert.match(workspaceSource, /'data-polish-folder-tone-pick'/)
  assert.match(workspaceSource, /'data-polish-folder-glyph-pick'/)
  assert.match(workspaceSource, /'data-polish-folder-strong'/)
  assert.match(workspaceSource, /folderLookOf\(/)
  assert.match(workspaceSource, /FOLDER_LOOK_PREFIX/)
})

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
  // A plugin may not reach into a Shell-rendered row, so the menu row stays a menu
  // row. The right-click menu lives on the rows Better workspace renders itself,
  // inside the surface it replaced - that is the sanctioned route.
  assert.ok(
    !bundle.includes('data-row-key'),
    'no private row attribute is patched: a release would erase that',
  )
  assert.ok(
    bundle.includes('onContextMenu'),
    'the replaced surface owns its own rows, so their menus are ours to draw',
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

test('the better workspace seat shadows the shipped browser without re-declaring its children', () => {
  // A child-hole declaration is exclusive: the shipped entry owns session.menu.item,
  // so re-declaring it throws and the seat is dropped. The occupants are read off
  // the slots service instead and rendered by hand.
  assert.ok(bundle.includes("'sidebar.workspaces'"))
  assert.ok(bundle.includes('priority: -1'))
  assert.ok(bundle.includes("slots.entries('sidebar.workspaces.session.menu.item')"))
  assert.ok(bundle.includes('menuOpenState'))
  assert.ok(bundle.includes('installWorkspaceSeat('))
  assert.ok(!bundle.includes('children: {'), 'no child-hole declaration may ride this registration')
})

test('the workspace seat also offers the Hero picker, with the same colours', () => {
  assert.ok(bundle.includes('conversation.hero.workspace'), 'the Hero seat is registered')
  assert.ok(bundle.includes('data-polish-hero'), 'the picker marks its rows')
  assert.ok(bundle.includes('data-polish-tone'), 'the palette exposes one button per tone')
  assert.ok(workspaceSource.includes('aryacode-polish:workspace-appearance'), 'the palette has a storage key')
  assert.ok(workspaceSource.includes('writeAppearance(next)'), 'a colour is written when it is chosen')
})

test('folders and saved orders ride the same workspace seat', () => {
  assert.ok(workspaceSource.includes('data-polish-ws-folder'), 'a folder row is rendered')
  assert.ok(workspaceSource.includes('aryacode-polish:workspace-order'), 'the preset has a storage key')
  assert.ok(workspaceSource.includes("'data-polish-order': 'remember'"), 'the menu can remember the order')
  assert.ok(workspaceSource.includes('planReorder('), 'restoring walks an insertBefore plan')
  assert.ok(workspaceSource.includes("'data-polish-ws-rename': 'open'"), 'the menu can rename a workspace')
  assert.ok(workspaceSource.includes('workspaces.rename('), 'the rename is a Host call')
  assert.ok(workspaceSource.includes('data-polish-switcher'), 'Ctrl-K opens a switcher')
  assert.ok(workspaceSource.includes('aryacode-polish:folded'), 'the folded state has a storage key')

})

test('the tree offers density modes and an archived section', () => {
  assert.ok(workspaceSource.includes("'data-polish-ws-density'"), 'the header carries the density switch')
  assert.ok(workspaceSource.includes('aryacode-polish:density'), 'the chosen density is remembered')
  assert.ok(workspaceSource.includes('DENSITY_METRICS'), 'density changes row height from a table')
  assert.ok(workspaceSource.includes("'data-polish-ws-archived'"), 'archived sessions get their own section')
  assert.ok(workspaceSource.includes("'data-polish-ws-unarchive'"), 'an archived row can be restored')
  assert.ok(workspaceSource.includes('workspaces.unarchiveSession('), 'restoring goes through the Host verb')
  assert.ok(workspaceSource.includes('splitArchived('), 'archived sessions leave their workspace rows')
})

test('a workspace can wear a glyph and carry a note', () => {
  assert.ok(workspaceSource.includes("'data-polish-glyph'"), 'the menu can open the glyph picker')
  assert.ok(workspaceSource.includes("'data-polish-glyph-pick'"), 'the picker offers badges')
  assert.ok(workspaceSource.includes("'data-polish-note'"), 'the menu can open the note editor')
  assert.ok(workspaceSource.includes("'data-polish-note-input'"), 'the note is typed into a field')
  assert.ok(workspaceSource.includes("'data-polish-ws-glyph'"), 'the row renders the chosen glyph')
  assert.ok(workspaceSource.includes('looks.note || undefined'), 'the note rides the row tooltip')
})

test('a workspace can be dropped on a folder and shows its note on hover', () => {
  assert.ok(workspaceSource.includes('fileUnder('), 'dropping uses the filing helper')
  assert.ok(workspaceSource.includes("'folder:' + folder"), 'the folder header is a drop target')
  assert.ok(workspaceSource.includes("'Filed under '"), 'a drop reports what happened')
  assert.ok(workspaceSource.includes("'data-polish-note-card'"), 'the note appears in a card')
  assert.ok(workspaceSource.includes('setCard({ text: note'), 'the card only exists when a note does')
})

test('a folder can exist before it holds a workspace', () => {
  assert.ok(workspaceSource.includes("'data-polish-folder-new'"), 'the menu can declare a folder')
  assert.ok(workspaceSource.includes("'data-polish-folder-input'"), 'the folder name is typed into a field')
  assert.ok(workspaceSource.includes('aryacode-polish:folders'), 'declared folders are remembered')
  assert.ok(workspaceSource.includes("'data-polish-ws-empty'"), 'an empty folder still draws a header')
  assert.ok(workspaceSource.includes("'data-polish-folder-remove'"), 'an empty folder can be removed')
  assert.ok(workspaceSource.includes('folderNamesOf('), 'declared folders join the ones the workspaces imply')
})

test('a workspace can leave its folder, and a folder can be renamed', () => {
  assert.ok(workspaceSource.includes("'data-polish-ws-unfile'"), 'the workspace menu can lift a workspace out')
  assert.ok(workspaceSource.includes('unfiled('), 'lifting uses the prefix helper')
  assert.ok(workspaceSource.includes("'data-polish-folder-edit'"), 'a folder header carries a rename action')
  assert.ok(workspaceSource.includes("'data-polish-folder-edit-input'"), 'the new name is typed into a field')
  assert.ok(workspaceSource.includes('fileUnder(workspaceLabel(workspace), target)'), 'renaming a folder refiles each member')
})

test('the tree can flag a session, note it, and copy itself as text', () => {
  for (const marker of [
    'aryacode-polish:session-marks',
    'data-polish-session-flag',
    'data-polish-session-note',
    'data-polish-mark-input',
    'data-polish-mark-flag',
    'data-polish-ws-copy',
    'treeText(',
    'navigator.clipboard.writeText',
  ]) {
    assert.ok(bundle.includes(marker), 'bundle is missing ' + marker)
  }
})

test('the tree can hop between workspaces and show folders only', () => {
  for (const marker of ['jumpWorkspace(', 'nextDensity(', 'folders', "'['", "']'"]) {
    assert.ok(bundle.includes(marker), 'bundle is missing ' + marker)
  }
})

test('a row can start a session in its workspace and pin a session in one click', () => {
  for (const marker of ['data-polish-ws-new-session', 'data-polish-session-pin', 'startSession(', 'unpinSession(']) {
    assert.ok(bundle.includes(marker), 'bundle is missing ' + marker)
  }
})

test('a look can be saved as a preset and applied elsewhere', () => {
  for (const marker of ['data-polish-preset-apply', 'data-polish-preset-forget', 'withPreset(', 'aryacode-polish:workspace-presets']) {
    assert.ok(bundle.includes(marker), 'bundle is missing ' + marker)
  }
})

test('the tree can sort A to Z and the switcher can jump to a workspace', () => {
  for (const marker of ['data-polish-ws-sort', 'aryacode-polish:sort.v1', "'workspace:' + group.workspace.workspaceId", 'revealWorkspace(']) {
    assert.ok(bundle.includes(marker), 'bundle is missing ' + marker)
  }
})

test('a pinned session is lifted into its own section', () => {
  for (const marker of ['data-polish-ws-pinned', 'data-polish-ws-pinned-row', 'splitPinned(', "'Pinned'"]) {
    assert.ok(bundle.includes(marker), 'bundle is missing ' + marker)
  }
})

test('a session row can show what it has cost', () => {
  for (const marker of ['data-polish-ws-cost', 'costLabel(costOf(sessionState', 'projectionsBySession']) {
    assert.ok(bundle.includes(marker), 'bundle is missing ' + marker)
  }
})

test('a session can be renamed in place, and a filed workspace dragged back out', () => {
  for (const marker of ['requestRenameSession', 'onDoubleClick', 'data-polish-ws-topzone', 'Drop here to leave the folder', 'unfiled(workspaceLabel(dragged.workspace))']) {
    assert.ok(bundle.includes(marker), 'bundle is missing ' + marker)
  }
})


test('a workspace and a folder show the same running total as their sessions', () => {
  const bundle = read('lib/client.js')
  assert.ok(bundle.includes("'data-polish-ws-cost-total'"))
  assert.ok(bundle.includes("'data-polish-ws-folder-cost'"))
  assert.ok(bundle.includes('sumCostLabel('))
})


test('a folder can grow a workspace, and the menus are reachable from the keyboard', () => {
  const bundle = read('lib/client.js')
  assert.ok(bundle.includes("'data-polish-folder-add'"))
  assert.ok(bundle.includes("event.key === 'ContextMenu'"))
  assert.ok(bundle.includes("'F10' && event.shiftKey"))
  assert.ok(bundle.includes("fileUnder(workspaceLabel(created), into)"))
})


test('a folder shows a running dot, and Alt folds the others', () => {
  const bundle = read('lib/client.js')
  assert.ok(bundle.includes("'data-polish-folder-running'"))
  assert.ok(bundle.includes('folderHasRunning('))
  assert.ok(bundle.includes('event.altKey === true'))
})


test('dropping a workspace on another one refiles it, and an archived row can open or copy', () => {
  const bundle = read('lib/client.js')
  assert.ok(bundle.includes("'data-polish-archived-open'"))
  assert.ok(bundle.includes("'data-polish-archived-copy'"))
  assert.ok(bundle.includes('Moved into '))
  assert.ok(bundle.includes('await reorderWorkspace(moving.id, targetId)'))
})


test('the tree can explain itself, and stops hinting once it has', () => {
  const bundle = read('lib/client.js')
  assert.ok(bundle.includes("'data-polish-ws-help': 'open'"))
  assert.ok(bundle.includes("'data-polish-ws-help-row'"))
  assert.ok(bundle.includes("'data-polish-ws-help-hint'"))
  assert.ok(bundle.includes('aryacode-polish:help.v1'))
  assert.ok(bundle.includes("event.key !== '?'"))
})


test('a pinned row shows its cost and can be unpinned in place', () => {
  const bundle = read('lib/client.js')
  assert.ok(bundle.includes("'data-polish-pinned-cost'"))
  assert.ok(bundle.includes("'data-polish-pinned-unpin'"))
  assert.ok(bundle.includes("hover === 'pinned:' + row.id"))
})


test('a running session is marked the same way in its workspace and when pinned', () => {
  const bundle = read('lib/client.js')
  assert.ok(bundle.includes("'data-polish-session-running'"))
  assert.ok(bundle.includes("'data-polish-pinned-running'"))
})

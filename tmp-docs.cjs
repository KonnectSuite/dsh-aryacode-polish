const fs = require('node:fs')
const doc = `# Better workspace

Our own sidebar browser, mounted into \`sidebar.workspaces\` at \`priority: -1\` so it
shadows the shipped one while the switch is on, and steps aside the moment it is off.

## Why a takeover instead of a menu item

A plugin can add a menu to any surface it renders itself, and it can extend a
Shell-rendered surface only through a slot that surface declares. The workspace row
declares none: its "..." menu is a closed two-item array and the row has no
\`onContextMenu\`. So the only sanctioned route to "right-click a workspace" is to
replace the region that draws it - this feature - and own that region's upkeep.

## The two traps

**No \`children\` declaration.** A single-occupant seat renders its LOWEST priority
entry, which is why \`priority: -1\` shadows the shipped browser without touching it.
But declaring children is exclusive: the shipped registration already owns
\`sidebar.workspaces.session.menu.item\` and its siblings, so a second declaration
throws and the whole seat is dropped. This file reads the occupants off the slots
service (\`slots.entries('sidebar.workspaces.session.menu.item')\`) and renders them
by hand, reproducing exactly the two props the renderer would have synthesised:

- \`t\` - the occupant's own namespace bound through the locale face, so the shipped
  labels stay translated;
- \`useMenuOpenState\` - the row's open-state pair, produced by the owner's declared
  hook factory (\`inject.hooks.menuOpenState(standard, hookContext)\`).

Everything else on the occupant (Pin, Rename, Fork, Archive, Copy Session ID, and our
own "Open workspace folder") therefore keeps working untouched.

**Presence is the switch.** Because presence is what shadows the shipped browser, the
seat is registered and disposed with the \`betterWorkspace\` switch rather than
registered once and hidden. \`installWorkspaceSeat\` subscribes to the row's live
config form and adds/removes the registration each time the switch flips.

## What M1 ships

- Workspace rows: caret, folder, title, session count; click to fold.
- Session rows underneath, newest first, click to open.
- Session "..." menu: the shipped occupant list rendered as above.
- Workspace right-click menu: Open in File Explorer, Copy path, Remove workspace
  (two-click confirm).
- \`docs/panel-screenshot.md\`-style honesty: a broken third-party menu row is caught
  by a boundary so the tree still renders.

## What is not here yet

Drag and drop, reorder and pinned ordering, the "/" name grouping the reference
plugin offers, appearance options, and the same tree in the New Session picker. Those
are M2/M3; the seat is already the right place for them.
`
fs.writeFileSync('docs/better-workspace.md', doc)
const ch = 'CHANGELOG.md'
let c = fs.readFileSync(ch, 'utf8')
if (!c.includes('## [0.9.0]')) {
  c = c.replace('# Changelog\n', `# Changelog

## [0.9.0] - 2026-10-28

### Added

- Better workspace (\`betterWorkspace\`): our own sidebar browser registered into
  \`sidebar.workspaces\` at \`priority: -1\`, with the shipped session menu rendered
  inside it and a right-click menu on every workspace row (open, copy path, remove).
  See \`docs/better-workspace.md\` for why this is a takeover rather than a menu item.
`)
  fs.writeFileSync(ch, c)
}
const r = 'README.md'
let readme = fs.readFileSync(r, 'utf8')
if (!readme.includes('Better workspace')) {
  readme = readme.replace(/(\| Switch \| Default \| What it does \|\n\|[-\s|]+\|\n)/, `$1| Better workspace | On | Replaces the sidebar workspace list with our own tree and a right-click menu on each workspace. |\n`)
  readme = readme.replace(/Status: \*\*([a-z]+) features shipped\./, 'Status: **seven features shipped.')
  fs.writeFileSync(r, readme)
}
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.version = '0.9.0'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
console.log('version ' + pkg.version + '; readme has switch row: ' + fs.readFileSync(r, 'utf8').includes('| Better workspace |'))

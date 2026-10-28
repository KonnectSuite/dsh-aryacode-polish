const fs = require('node:fs')
let d = fs.readFileSync('docs/better-workspace.md', 'utf8')
if (!d.includes('## Colour and weight')) {
  d += `
## Colour and weight

Right-click a workspace → **Colour and weight…** opens a six-tone palette (slate, blue,
green, amber, rose, violet) plus "none", and toggles a bold label. The choice is kept in
the app's own storage under \`aryacode-polish:workspace-appearance.v1\` as
\`{ [workspaceId]: { tone, strong } }\`, so it survives a restart without asking the Host
to remember anything. \`readAppearance\`/\`writeAppearance\` swallow every failure
(missing storage, quota, a locked-down webview), so a broken store costs the colours
and nothing else. \`appearanceOf\` ignores a tone it does not know, which keeps an old
entry from breaking the row if the palette ever changes.

## The Hero picker

The blank-session Hero's workspace chip is the same list, not a second implementation:
\`conversation.hero.workspace\` is a \`single\` slot at the root, so this bundle shadows it
at \`priority: -1\` beside \`sidebar.workspaces\` and both seats come and go with the one
switch. The slot hands over \`{ open, anchorRef, selectedId, onPick, onClose }\`: the card
is portalled to the anchor's bottom-left only while \`open\` is true (an unconditional
list floated over the Hero copy), it shows the same tone dots and bold labels as the
sidebar, and picking a row calls \`onPick(workspaceId)\` then \`onClose()\`.
`
  fs.writeFileSync('docs/better-workspace.md', d)
}
console.log('docs updated')

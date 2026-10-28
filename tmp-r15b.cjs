const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const swap = (from, to) => {
  if (!src.includes(from)) throw new Error('missing anchor: ' + from.slice(0, 70))
  src = src.replace(from, to)
}

/* state */
swap(`  const [marks, setMarks] = React.useState(() => readMarks())`,
`  const [marks, setMarks] = React.useState(() => readMarks())
  const [presets, setPresets] = React.useState(() => readPresets())`)
swap(`  React.useEffect(() => { writeMarks(marks) }, [marks])`,
`  React.useEffect(() => { writeMarks(marks) }, [marks])
  React.useEffect(() => { writePresets(presets) }, [presets])`)

/* the menu: save the current look, apply any preset, forget one */
swap(`      React.createElement('button', {
        type: 'button',
        'data-polish-folder-new': 'open',`,
`      React.createElement('button', {
        type: 'button',
        'data-polish-preset': 'save',
        style: WS_MENU_ITEM,
        onClick: () => {
          const target = menu.workspace
          const name = workspaceLabel(target)
          const look = lookOf(look, target.workspaceId)
          closeMenu()
          if (!look.tone && !look.glyph && !look.strong) { setNotice('Give this workspace a look first.'); return }
          setPresets((prev) => withPreset(prev, name, look))
          setNotice('Saved the look of ' + name + '.')
        },
      }, 'Save this look as a preset'),
      presetNames(presets).map((name) => React.createElement('div', {
        key: 'preset:' + name,
        style: Object.assign({}, WS_MENU_ITEM, { display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }),
      },
      React.createElement('button', {
        type: 'button',
        'data-polish-preset-apply': name,
        style: Object.assign({}, WS_MENU_ITEM, { flex: '1 1 auto' }),
        onClick: () => {
          const target = menu.workspace
          const preset = presets[name]
          closeMenu()
          paintLook(target.workspaceId, preset)
          setNotice('Applied ' + name + '.')
        },
      }, 'Apply: ' + name),
      React.createElement('button', {
        type: 'button',
        'data-polish-preset-forget': name,
        title: 'Forget this preset',
        'aria-label': 'Forget this preset',
        style: Object.assign({}, WS_ROW_ACTION, { marginRight: '4px' }),
        onClick: () => {
          setPresets((prev) => withoutPreset(prev, name))
          setNotice('Forgot ' + name + '.')
        },
      }, '\\u00d7'))),
      React.createElement('button', {
        type: 'button',
        'data-polish-folder-new': 'open',`)

fs.writeFileSync(p, src)
console.log('preset menu added')

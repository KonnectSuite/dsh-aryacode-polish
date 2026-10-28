const fs = require('node:fs')
const p = 'client/workspace.js'
let s = fs.readFileSync(p, 'utf8')
const before = s
s = s.replace(`        React.createElement('div', { style: WS_PAINT_ROW },
          GLYPHS.map((glyph) => React.createElement('button', {
            key: glyph,
            type: 'button',
            'data-polish-folder-glyph-pick': glyph,
            'aria-label': 'Glyph ' + glyph,
            title: glyph,
            style: Object.assign({}, WS_SWATCH, { background: 'transparent', fontSize: '14px' }),
            onClick: () => paint({ glyph: current.glyph === glyph ? undefined : glyph }),
          }))),`, `        React.createElement('div', { style: WS_GLYPH_GRID },
          GLYPHS.map((glyph) => React.createElement('button', {
            key: glyph,
            type: 'button',
            'data-polish-folder-glyph-pick': glyph,
            'aria-label': 'Glyph ' + glyph,
            title: 'Use ' + glyph,
            style: Object.assign({}, WS_GLYPH_BUTTON, {
              background: current.glyph === glyph ? 'var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06))' : undefined,
            }),
            onClick: () => paint({ glyph: current.glyph === glyph ? undefined : glyph }),
          }))),`)
if (s === before) throw new Error('glyph row anchor missing')
fs.writeFileSync(p, s)
console.log('folder glyph grid uses the shared glyph styles')

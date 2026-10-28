const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
src = src.replace(
  /\/\*\* Keeps one broken third-party row from blanking the whole tree\. \*\/\nclass RowBoundary extends React\.Component \{[\s\S]*?\n\}\n/,
  `/**
 * Keeps one broken third-party row from blanking the whole tree. Built lazily so
 * this file stays importable from a plain Node test, where React is absent.
 */
function rowBoundary() {
  if (typeof React === 'undefined') {
    return function Passthrough(props) {
      return props.children
    }
  }
  return class RowBoundary extends React.Component {
    constructor(props) {
      super(props)
      this.state = { failed: false }
    }

    static getDerivedStateFromError() {
      return { failed: true }
    }

    render() {
      return this.state.failed ? null : this.props.children
    }
  }
}
`,
)
src = src.replace("React.createElement(RowBoundary, { key: (entry.options && entry.options.id) || index }", "React.createElement(RowBoundary, { key: (entry.options && entry.options.id) || index }")
src = src.replace("  const entries = React.useMemo(() => rowMenuEntries(slots)", "  const RowBoundary = React.useMemo(() => rowBoundary(), [])\n  const entries = React.useMemo(() => rowMenuEntries(slots)")
src = src.replace("'Remove workspace?\" '", "'Remove workspace?'");
fs.writeFileSync(p, src)
console.log('lazy boundary: ' + src.includes('function rowBoundary()'))
console.log('boundary used in memo: ' + src.includes('const RowBoundary = React.useMemo'))
console.log('typo gone: ' + !src.includes('Remove workspace?" '))

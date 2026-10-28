const fs = require('node:fs')
const lines = fs.readFileSync('client/workspace.js', 'utf8').split('\n')
const hero = lines.findIndex((line) => line.includes('function HeroWorkspacePicker'))
const treeFn = lines.findIndex((line) => line.includes('function BetterWorkspace'))
console.log('HeroWorkspacePicker: ' + (hero + 1) + '  BetterWorkspace: ' + (treeFn + 1))
// where does the empty block sit relative to BetterWorkspace's start?
const empty = lines.findIndex((line) => line.includes('data-polish-ws-empty-tree'))
console.log('empty block: ' + (empty + 1))
const ws = lines.findIndex((line) => line.includes("'data-polish-ws': 'tree'"))
console.log('tree attribute: ' + (ws + 1))
// hero: does it have children.push or data-polish-ws tree?
const heroEnd = hero + 300
lines.slice(hero, heroEnd).forEach((line, offset) => {
  if (/children\.push|data-polish-ws'|data-polish-hero'|const rows/.test(line)) console.log((hero + 1 + offset) + ': ' + line.trim().slice(0, 90))
})

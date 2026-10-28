const fs = require('node:fs')
let src = fs.readFileSync('client/workspace.js', 'utf8')
src = src.replace("return total ? costLabel(total) : String.fromCharCode(0) && ''", "return total ? costLabel(total) : ''")
fs.writeFileSync('client/workspace.js', src)

const spec = 'test/workspace.spec.mjs'
let body = fs.readFileSync(spec, 'utf8')
if (body.includes('sumCost adds up')) { console.log('spec already'); process.exit(0) }
body = body.replace(
  "import {",
  "import {",
)
const imports = body.match(/import \{([\s\S]*?)\} from '\.\.\/client\/workspace\.js'/)
if (!imports) throw new Error('import list missing')
if (!imports[1].includes('sumCost')) {
  const next = imports[0].replace('costLabel', 'costLabel, sumCost, sumCostLabel')
  body = body.replace(imports[0], next)
}
body += `

test('sumCost adds up what a group of sessions cost', () => {
  const snapshot = {
    projectionsBySession: {
      a: { values: { polishCost: { costUsd: '0.00010000' } } },
      b: { values: { polishCost: { costUsd: '0.00020000' } } },
      c: { values: {} },
    },
  }
  const total = sumCost([{ id: 'a' }, { id: 'b' }, { id: 'c' }], snapshot)
  assert.equal(total.usd, '0.00030000')
  assert.equal(total.cny, undefined)
  assert.equal(sumCostLabel([{ id: 'a' }, { id: 'b' }], snapshot), '\\u2248$0.00030')
})

test('sumCost keeps the currency it actually saw', () => {
  const snapshot = {
    projectionsBySession: {
      a: { values: { polishCost: { costCny: '0.0042' } } },
    },
  }
  const total = sumCost([{ id: 'a' }], snapshot)
  assert.equal(total.usd, undefined)
  assert.equal(total.cny, '0.00420000')
  assert.equal(sumCostLabel([{ id: 'a' }], snapshot), '\\u2248\\u00a50.0042')
})

test('sumCost says nothing when no session is priced', () => {
  assert.equal(sumCost([], {}), undefined)
  assert.equal(sumCost([{ id: 'a' }], { projectionsBySession: {} }), undefined)
  assert.equal(sumCostLabel([{ id: 'a' }], undefined), '')
})
`
fs.writeFileSync(spec, body)

const face = 'test/client-face.spec.mjs'
let faceBody = fs.readFileSync(face, 'utf8')
if (!faceBody.includes('data-polish-ws-cost-total')) {
  faceBody += `

test('a workspace and a folder show the same running total as their sessions', () => {
  const bundle = read('lib/client.js')
  assert.ok(bundle.includes("'data-polish-ws-cost-total'"))
  assert.ok(bundle.includes("'data-polish-ws-folder-cost'"))
  assert.ok(bundle.includes('sumCostLabel('))
})
`
  fs.writeFileSync(face, faceBody)
}
console.log('specs updated')

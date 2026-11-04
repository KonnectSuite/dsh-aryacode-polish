/**
 * The two halves of inline previews, held to the facts that keep them safe.
 *
 * The card runs model-authored markup, so these checks are mostly about what it
 * refuses: which suffixes reach a frame, that the policy lands before any script,
 * that a Turn's produced list is filtered and capped, and that the Host route
 * answer a refusal rather than a guess.
 */

import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  PREVIEW_LIMIT, PREVIEW_POLICY, previewDocument, previewKindOf, previewName, previewPaths,
} from '../client/preview.js'
import {
  PREVIEW_MAX_IMAGE_BYTES, PREVIEW_MAX_MARKUP_BYTES, handlePreview, inlineAssets, previewKindOf as hostKindOf, readPreview, resolveAsset,
} from '../entries/preview.js'

const names = ['cat.html', 'cat.HTM', 'drawing.svg', 'shot.png', 'shot.jpeg', 'shot.gif', 'shot.webp']
const refused = ['notes.txt', 'app.js', 'index.ts', 'data.json', 'no-extension', '']

test('the chat card and the Host route agree about what is previewable', () => {
  for (const name of names) {
    assert.equal(previewKindOf(name), hostKindOf(name), 'the two halves disagree about ' + name)
    assert.ok(previewKindOf(name) !== undefined, name + ' should be previewable')
  }
  for (const name of refused) {
    assert.equal(previewKindOf(name), undefined, name + ' must not reach a frame')
    assert.equal(hostKindOf(name), undefined, name + ' must be refused by the Host too')
  }
})

test('a card title is the file name, on either kind of path', () => {
  assert.equal(previewName('C:\\work\\ship\\cat.html'), 'cat.html')
  assert.equal(previewName('/home/me/cat.html'), 'cat.html')
  assert.equal(previewName('cat.html'), 'cat.html')
  assert.equal(previewName(undefined), '')
})

test('the policy is the first thing in a framed document head', () => {
  const framed = previewDocument('<html><head><title>x</title></head><body><script>1</script></body></html>')
  // The meta must precede the script the policy is meant to constrain.
  assert.ok(framed.indexOf('Content-Security-Policy') < framed.indexOf('<title>'), 'the policy lands before the rest of the head')
  assert.ok(framed.includes('default-src'), 'the policy names its default source')
  assert.ok(framed.includes(PREVIEW_POLICY), 'the constant is what the document carries')
})

test('a fragment and a bare html tag both become documents', () => {
  const fragment = previewDocument('<p>hello</p>')
  assert.ok(fragment.startsWith('<!doctype html>'), 'a fragment gets a document around it')
  assert.ok(fragment.includes('<p>hello</p>'), 'the fragment survives')
  assert.ok(fragment.includes('Content-Security-Policy'), 'the fragment gets the policy too')
  const bare = previewDocument('<html lang="en"><body>x</body></html>')
  assert.ok(bare.includes('<head><meta http-equiv="Content-Security-Policy"'), 'a headless html gets one inserted')
  assert.equal(previewDocument(undefined).includes('<body></body>'), true, 'a missing source is an empty document, not a crash')
})

test('a turn lists only what this card draws, capped', () => {
  const turn = {
    data: {
      get: key => key === 'deliverables'
        ? { produced: [{ path: 'a.html' }, { path: 'notes.txt' }, { path: 'b.png' }, { path: 'a.html' }, 'c.svg', { path: 'd.webp' }] }
        : undefined,
    },
  }
  assert.deepEqual(previewPaths(turn), ['a.html', 'b.png', 'c.svg'], 'drawn suffixes only, deduplicated, in order')
  assert.equal(previewPaths(turn).length <= PREVIEW_LIMIT, true, 'the card never exceeds its cap')
  assert.deepEqual(previewPaths({ data: { get: () => undefined } }), [], 'a turn without the projection previews nothing')
  assert.deepEqual(previewPaths(undefined), [], 'no turn, no card')
  assert.deepEqual(previewPaths({ get data() { throw new Error('boom') } }), [], 'a broken projection is not a crash')
})

test('the Host reads a small file and refuses everything else by name', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'polish-preview-'))
  try {
    const html = join(dir, 'cat.html')
    writeFileSync(html, '<html><body>meow</body></html>', 'utf8')
    const png = join(dir, 'shot.png')
    // One transparent pixel is enough to prove the data URL path.
    writeFileSync(png, Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex'))
    const text = join(dir, 'notes.txt')
    writeFileSync(text, 'not previewable', 'utf8')

    const markup = await readPreview(html)
    assert.equal(markup.kind, 'markup')
    assert.equal(markup.name, 'cat.html')
    assert.ok(markup.text.includes('meow'), 'markup comes back as text')
    assert.equal(typeof markup.bytes, 'number')

    const image = await readPreview(png)
    assert.equal(image.kind, 'image')
    assert.ok(image.dataUrl.startsWith('data:image/png;base64,'), 'an image comes back as a data URL')

    await assert.rejects(readPreview(text), /not previewed/, 'a text file is refused')
    await assert.rejects(readPreview('relative/cat.html'), /absolute/, 'a relative path is refused')
    await assert.rejects(readPreview(''), /path is required/, 'an empty path is refused')
    await assert.rejects(readPreview(join(dir, 'missing.html')), undefined, 'a missing file rejects')

    const refusedRead = await handlePreview({ action: 'read', path: text })
    assert.equal(refusedRead.status, 400, 'the route answers 400 with a readable body')
    const body = await refusedRead.json()
    assert.equal(body.ok, false, 'and says so in the body, not in a stack trace')
    assert.match(body.error, /not previewed/, 'the message names the reason')

    const wrongAction = await handlePreview({ action: 'list' })
    assert.equal(wrongAction.status, 400, 'only one action exists')
    assert.equal((await wrongAction.json()).error, 'unknown action list')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('the size caps are finite', () => {
  assert.ok(Number.isFinite(PREVIEW_MAX_MARKUP_BYTES) && PREVIEW_MAX_MARKUP_BYTES > 0)
  assert.ok(Number.isFinite(PREVIEW_MAX_IMAGE_BYTES) && PREVIEW_MAX_IMAGE_BYTES > PREVIEW_MAX_MARKUP_BYTES)
})

test('a document that links its own siblings is folded into one frame', async () => {
  // The reported turn wrote index.html + style.css + script.js; a srcdoc frame has
  // no base URL, so the page arrived blank. The Host now folds those in.
  const dir = mkdtempSync(join(tmpdir(), 'polish-inline-'))
  try {
    writeFileSync(join(dir, 'style.css'), 'body { color: #123456; }', 'utf8')
    writeFileSync(join(dir, 'app.js'), 'window.polishTest = 1;', 'utf8')
    writeFileSync(join(dir, 'dot.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"></svg>', 'utf8')
    const source = '<!doctype html><html><head><link rel="stylesheet" href="style.css"></head>'
      + '<body><img src="dot.svg"><script src="app.js"></script></body></html>'

    const framed = await inlineAssets(source, dir)
    assert.equal(framed.inlined, 3, 'the stylesheet, the script and the image are folded in')
    assert.ok(framed.text.includes('<style data-polish-inlined>body { color: #123456; }</style>'), 'the sheet becomes a style block')
    assert.ok(framed.text.includes('<script data-polish-inlined>window.polishTest = 1;</script>'), 'the script becomes inline')
    assert.match(framed.text, /src="data:image\/svg\+xml;base64,/, 'the image becomes a data URL')
    assert.equal(framed.text.includes('href="style.css"'), false, 'no relative reference is left to fail')
    assert.equal(framed.text.includes('src="app.js"'), false, 'no relative script is left to fail')

    // And the route reports that it did it, so a blank frame can be told apart.
    writeFileSync(join(dir, 'index.html'), framed.text, 'utf8')
    const read = await readPreview(join(dir, 'index.html'))
    assert.equal(read.kind, 'markup')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a sibling outside the folder, or above the cap, is left exactly as written', async () => {
  const parent = mkdtempSync(join(tmpdir(), 'polish-inline-parent-'))
  const dir = join(parent, 'doc')
  try {
    mkdirSync(dir)
    writeFileSync(join(parent, 'secret.css'), 'body { color: red; }', 'utf8')
    writeFileSync(join(dir, 'huge.css'), 'x'.repeat(2048), 'utf8')
    const source = '<link rel="stylesheet" href="../secret.css"><link rel="stylesheet" href="huge.css">'
    const framed = await inlineAssets(source, dir, { maxAssetBytes: 1024 })
    assert.equal(framed.inlined, 0, 'neither reference is folded in')
    assert.equal(framed.text, source, 'the document is untouched')

    assert.equal(resolveAsset('../secret.css', dir), undefined, 'a parent path is refused')
    assert.equal(resolveAsset('style.css', dir), join(dir, 'style.css'), 'a sibling resolves')
    assert.equal(resolveAsset('https://example.com/x.css', dir), undefined, 'an absolute URL is refused')
  } finally {
    rmSync(parent, { recursive: true, force: true })
  }
})

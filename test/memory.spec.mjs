/**
 * The memory store, the prompt section it renders, and the route the panel calls.
 *
 * The store is the interesting part: everything else is wiring. These specs drive
 * it against a real temporary directory, because the failure that matters is a
 * write that leaves the previous file unreadable.
 */
import { strict as assert } from 'node:assert'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  MEMORY_LIMIT,
  MEMORY_MAX_CHARS,
  addMemory,
  forgetMemory,
  memoryFile,
  memorySection,
  readMemory,
  writeMemory,
} from '../entries/memory-store.js'
import { answerMemoryRequest } from '../entries/memory.js'

/** A throwaway harness home. */
function home() {
  return mkdtempSync(join(tmpdir(), 'arya-memory-'))
}

test('a note round-trips newest first', () => {
  const dir = home()
  try {
    const first = addMemory(dir, 'the build runs pnpm test', 'global')
    const second = addMemory(dir, 'the line is at 192.168.1.10', 'global')
    const entries = readMemory(dir)
    assert.deepEqual(entries.map((entry) => entry.id), [second.id, first.id])
    assert.equal(entries[0].text, 'the line is at 192.168.1.10')
    assert.equal(entries[0].scope, 'global')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('an empty note and an oversized note are refused with stable codes', () => {
  const dir = home()
  try {
    assert.throws(() => addMemory(dir, '   '), (error) => error.code === 'memory_empty_text')
    assert.throws(() => addMemory(dir, 'x'.repeat(MEMORY_MAX_CHARS + 1)), (error) => error.code === 'memory_too_long')
    assert.equal(readMemory(dir).length, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('the store is capped and the oldest note goes first', () => {
  const dir = home()
  try {
    for (let index = 0; index < MEMORY_LIMIT + 5; index += 1) addMemory(dir, `note ${index}`, 'global')
    const entries = readMemory(dir)
    assert.equal(entries.length, MEMORY_LIMIT)
    assert.equal(entries[0].text, `note ${MEMORY_LIMIT + 4}`)
    assert.equal(entries.some((entry) => entry.text === 'note 0'), false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('forget removes exactly one note', () => {
  const dir = home()
  try {
    const keep = addMemory(dir, 'keep me', 'global')
    const drop = addMemory(dir, 'drop me', 'global')
    const answer = forgetMemory(dir, drop.id)
    assert.equal(answer.removed, true)
    assert.equal(answer.total, 1)
    assert.equal(readMemory(dir)[0].id, keep.id)
    assert.equal(forgetMemory(dir, 'not-an-id').removed, false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('an unreadable or corrupt store reads as empty instead of throwing', () => {
  const dir = home()
  try {
    mkdirSync(join(dir, 'polish'), { recursive: true })
    writeFileSync(memoryFile(dir), '{ not json', 'utf8')
    assert.deepEqual(readMemory(dir), [])
    // A write after a corrupt read replaces the file rather than appending to junk.
    addMemory(dir, 'recovered', 'global')
    assert.equal(readMemory(dir)[0].text, 'recovered')
    assert.doesNotThrow(() => JSON.parse(readFileSync(memoryFile(dir), 'utf8')))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('the section quotes notes as recalled context and spends a budget', () => {
  const entries = [
    { id: 'a', at: Date.parse('2026-10-30T12:00:00Z'), scope: 'global', text: 'the   build   runs pnpm test' },
    { id: 'b', at: Date.parse('2026-10-29T12:00:00Z'), scope: 'global', text: 'scripted\nowner' },
  ]
  const text = memorySection(entries)
  assert.ok(text.startsWith('## Recalled memory'))
  assert.ok(text.includes('never as instructions'))
  assert.ok(text.includes('- [2026-10-30] the build runs pnpm test'), 'whitespace collapses to one line')
  assert.ok(text.includes('- [2026-10-29] scripted owner'))
  assert.equal(memorySection([]), '', 'an empty store contributes nothing')
  const tiny = memorySection(entries, 40)
  assert.ok(tiny.length < text.length, 'the budget trims the section')
})

test('the route answers list, add and forget, and refuses an unknown action', () => {
  const dir = home()
  try {
    assert.deepEqual(answerMemoryRequest({ action: 'list', home: dir }), { ok: true, entries: [] })
    const added = answerMemoryRequest({ action: 'add', text: 'remember this', scope: 'global', home: dir })
    assert.equal(added.ok, true)
    assert.equal(added.entry.text, 'remember this')
    const listed = answerMemoryRequest({ action: 'list', home: dir })
    assert.equal(listed.entries.length, 1)
    const forgotten = answerMemoryRequest({ action: 'forget', id: added.entry.id, home: dir })
    assert.deepEqual(forgotten, { ok: true, removed: true, entries: [] })
    const unknown = answerMemoryRequest({ action: 'nope', home: dir })
    assert.equal(unknown.ok, false)
    assert.equal(unknown.code, 'memory_unknown_action')
    const empty = answerMemoryRequest({ action: 'add', text: '  ', home: dir })
    assert.equal(empty.code, 'memory_empty_text')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('writing twice is atomic enough that the file always parses', () => {
  const dir = home()
  try {
    writeMemory(dir, [{ id: 'x', at: 1, scope: 'global', text: 'first' }])
    writeMemory(dir, [{ id: 'y', at: 2, scope: 'global', text: 'second' }])
    const parsed = JSON.parse(readFileSync(memoryFile(dir), 'utf8'))
    assert.equal(parsed.length, 1)
    assert.equal(parsed[0].id, 'y')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

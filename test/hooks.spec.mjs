/**
 * Hook rules: parsing, validation and this bundle's dispatch contract.
 *
 * A rule that silently never fires is the failure that matters here, so the specs
 * lean on validation: an unknown event, a missing command or a malformed args list
 * must be reported rather than dropped. Dispatch itself is driven with a stub
 * runner — nothing in a test may launch a process.
 */
import { strict as assert } from 'node:assert'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { HOOK_EVENTS, loadHooks, parseHooks } from '../entries/hooks-config.js'
import { createHookRuntime } from '../entries/hooks.js'

/** A throwaway harness home. */
function home() {
  return mkdtempSync(join(tmpdir(), 'arya-hooks-'))
}

function writeHome(dir, contents) {
  mkdirSync(join(dir, 'polish'), { recursive: true })
  writeFileSync(join(dir, 'polish', 'hooks.json'), JSON.stringify(contents), 'utf8')
}

test('a well-formed rule list is accepted with its documented defaults', () => {
  const parsed = parseHooks({
    hooks: [
      { name: 'notify', on: 'turn/stopping', action: { kind: 'exec', command: ' notify-send', args: ['done'] } },
      { on: 'compaction/end', action: { kind: 'exec', command: 'echo', timeoutMs: 2500 } },
    ],
  })
  assert.deepEqual(parsed.errors, [])
  assert.equal(parsed.rules.length, 2)
  assert.equal(parsed.rules[0].action.command, 'notify-send')
  assert.deepEqual(parsed.rules[0].action.args, ['done'])
  assert.equal(parsed.rules[0].action.timeoutMs, 10000)
  assert.equal(parsed.rules[1].name, 'rule-2')
  assert.equal(parsed.rules[1].action.timeoutMs, 2500)
  assert.ok(Object.isFrozen(parsed.rules[0]))
})

test('a bare array is accepted too', () => {
  const parsed = parseHooks([{ name: 'a', on: 'agent/error', action: { kind: 'exec', command: 'true' } }])
  assert.deepEqual(parsed.errors, [])
  assert.equal(parsed.rules.length, 1)
})

test('every malformed rule is reported with its index, not dropped silently', () => {
  const parsed = parseHooks([
    'not a rule',
    { name: 'bad-event', on: 'turn/start', action: { kind: 'exec', command: 'true' } },
    { name: 'no-action', on: 'turn/stopping' },
    { name: 'bad-kind', on: 'turn/stopping', action: { kind: 'shell' } },
    { name: 'no-command', on: 'turn/stopping', action: { kind: 'exec' } },
    { name: 'bad-args', on: 'turn/stopping', action: { kind: 'exec', command: 'true', args: 'oops' } },
  ])
  assert.deepEqual(parsed.errors.map((error) => error.index), [0, 1, 2, 3, 4, 5])
  assert.equal(parsed.rules.length, 0)
  assert.ok(parsed.errors[1].message.includes('turn/start'))
})

test('the accepted event list is the dispatch table', () => {
  assert.deepEqual([...HOOK_EVENTS], ['turn/stopping', 'agent/error', 'compaction/summary', 'compaction/end'])
})

test('a missing file is an empty rule list, not an error', () => {
  const dir = home()
  try {
    const loaded = loadHooks(dir)
    assert.deepEqual(loaded.rules, [])
    assert.deepEqual(loaded.errors, [])
    assert.ok(loaded.path.endsWith('hooks.json'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a file that is not JSON is reported against the file, not a rule', () => {
  const dir = home()
  try {
    mkdirSync(join(dir, 'polish'), { recursive: true })
    writeFileSync(join(dir, 'polish', 'hooks.json'), '{ nope', 'utf8')
    const loaded = loadHooks(dir)
    assert.equal(loaded.errors.length, 1)
    assert.equal(loaded.errors[0].index, -1)
    assert.ok(loaded.errors[0].message.includes('not JSON'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('dispatch runs only the rules for the event and records each outcome', async () => {
  const dir = home()
  try {
    writeHome(dir, { hooks: [
      { name: 'turn-hook', on: 'turn/stopping', action: { kind: 'exec', command: 'true' } },
      { name: 'compact-hook', on: 'compaction/end', action: { kind: 'exec', command: 'true' } },
    ] })
    const calls = []
    const runtime = createHookRuntime({
      home: dir,
      run: async (rule, event, payload) => {
        calls.push({ rule: rule.name, event, payload })
        return { ok: rule.name === 'turn-hook', ms: 7, detail: rule.name }
      },
    })
    assert.equal(runtime.dispatch('turn/stopping', { turn: 3 }), 1)
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(calls.length, 1)
    assert.equal(calls[0].rule, 'turn-hook')
    assert.deepEqual(calls[0].payload, { turn: 3 })
    assert.equal(runtime.log.length, 1)
    assert.equal(runtime.log[0].ok, true)
    assert.equal(runtime.log[0].ms, 7)
    const answer = runtime.route({ action: 'list' })
    assert.equal(answer.ok, true)
    assert.equal(answer.rules.length, 2)
    assert.equal(answer.dispatches.length, 1)
    assert.equal(runtime.route({ action: 'nope' }).code, 'hooks_unknown_action')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a runner that throws is recorded as a failed dispatch, never thrown into the loop', async () => {
  const dir = home()
  try {
    writeHome(dir, [{ name: 'boom', on: 'agent/error', action: { kind: 'exec', command: 'true' } }])
    const runtime = createHookRuntime({
      home: dir,
      run: async () => {
        throw new Error('could not start')
      },
    })
    assert.doesNotThrow(() => runtime.dispatch('agent/error', {}))
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(runtime.log[0].ok, false)
    assert.ok(runtime.log[0].detail.includes('could not start'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('the dispatch log is bounded', async () => {
  const dir = home()
  try {
    writeHome(dir, [{ name: 'spam', on: 'turn/stopping', action: { kind: 'exec', command: 'true' } }])
    const runtime = createHookRuntime({ home: dir, run: async () => ({ ok: true, ms: 1, detail: '' }) })
    for (let index = 0; index < 60; index += 1) runtime.dispatch('turn/stopping', { turn: index })
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(runtime.log.length, 50)
    assert.equal(runtime.log[0].event, 'turn/stopping')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

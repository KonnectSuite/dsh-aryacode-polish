/**
 * Reading and validating the hook rules.
 *
 * A hooks file is code-equivalent: one rule can run a command. So it is parsed
 * strictly — an unknown event, a missing action or a non-string command is a
 * reported error rather than a rule that silently never fires. Nothing here
 * executes anything; `hooks.js` owns dispatch.
 *
 * @module dsh-aryacode-polish-hooks-config
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Events a rule may subscribe to. */
export const HOOK_EVENTS = Object.freeze([
  'turn/stopping',
  'agent/error',
  'compaction/summary',
  'compaction/end',
])

/** Actions a rule may take. */
export const HOOK_ACTIONS = Object.freeze(['exec'])

/** Longest command line accepted, in characters. */
export const HOOK_MAX_COMMAND = 500

/** Largest dispatch log kept in memory. */
export const HOOK_LOG_LIMIT = 50

/**
 * Path of the hooks file for one harness home.
 * @param {string} home the harness home directory.
 * @returns {string} the absolute path.
 */
export function hooksFile(home) {
  return join(home, 'polish', 'hooks.json')
}

/**
 * Read the raw hooks file, if there is one.
 * @param {string} home the harness home directory.
 * @returns {unknown} the parsed file, an empty list when absent, or a parse error carrier.
 */
export function readHooksFile(home) {
  const path = hooksFile(home)
  if (!existsSync(path)) return { rules: [], errors: [] }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'))
    return { raw: parsed, rules: [], errors: [] }
  } catch (error) {
    return { rules: [], errors: [{ index: -1, message: `hooks file is not JSON: ${error instanceof Error ? error.message : 'parse failed'}` }] }
  }
}

/**
 * Validate one rule list.
 *
 * The file may be a bare array or `{ hooks: [...] }`; both are accepted because a
 * hand-written file is usually the array and the documented example carries the
 * key.
 *
 * @param {unknown} raw the file contents, or the list itself.
 * @returns {{ rules: Array<object>, errors: Array<{ index: number, message: string }> }} accepted rules and per-rule errors.
 */
export function parseHooks(raw) {
  const list = Array.isArray(raw) ? raw : raw !== null && typeof raw === 'object' && Array.isArray(raw.hooks) ? raw.hooks : null
  if (list === null) return { rules: [], errors: [{ index: -1, message: 'expected an array, or an object with a hooks array' }] }
  const rules = []
  const errors = []
  list.forEach((candidate, index) => {
    const fail = (message) => errors.push({ index, message })
    if (candidate === null || typeof candidate !== 'object') return fail('a rule must be an object')
    const name = typeof candidate.name === 'string' && candidate.name.trim().length > 0 ? candidate.name.trim() : `rule-${index + 1}`
    if (!HOOK_EVENTS.includes(candidate.on)) return fail(`unknown event "${String(candidate.on)}"`)
    const action = candidate.action
    if (action === null || typeof action !== 'object') return fail('a rule needs an action')
    if (!HOOK_ACTIONS.includes(action.kind)) return fail(`unknown action "${String(action.kind)}"`)
    if (action.kind === 'exec') {
      if (typeof action.command !== 'string' || action.command.trim().length === 0) return fail('exec needs a command')
      if (action.command.length > HOOK_MAX_COMMAND) return fail(`command is longer than ${HOOK_MAX_COMMAND} characters`)
      if (action.args !== undefined && !(Array.isArray(action.args) && action.args.every((arg) => typeof arg === 'string'))) {
        return fail('exec args must be an array of strings')
      }
    }
    const timeout = Number(action.timeoutMs)
    rules.push(Object.freeze({
      name,
      on: candidate.on,
      action: Object.freeze({
        kind: action.kind,
        command: action.command.trim(),
        args: Object.freeze(Array.isArray(action.args) ? action.args.slice() : []),
        timeoutMs: Number.isFinite(timeout) && timeout > 0 ? Math.min(120000, Math.round(timeout)) : 10000,
      }),
    }))
  })
  return { rules, errors }
}

/**
 * Read and validate in one step.
 * @param {string} home the harness home directory.
 * @returns {{ rules: Array<object>, errors: Array<{ index: number, message: string }>, path: string }} the validated rules and the file they came from.
 */
export function loadHooks(home) {
  const path = hooksFile(home)
  const read = readHooksFile(home)
  if (read.raw === undefined) return { rules: [], errors: read.errors, path }
  const parsed = parseHooks(read.raw)
  return { rules: parsed.rules, errors: parsed.errors, path }
}

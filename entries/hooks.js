/**
 * Lifecycle hooks: a rule list that runs a command when something happens.
 *
 * Dispatch is observational. A hook never vetoes a tool call or blocks a turn:
 * it runs after the fact, with a timeout, and its outcome is recorded so the
 * panel can show what fired. Vetoing needs a waterfall contract this bundle has
 * not confirmed, and a hook that can silently stop work is worse than no hook.
 *
 * The event payload reaches the command as JSON in `POLISH_HOOK_PAYLOAD`, not as
 * arguments: no shell, no quoting, no injection.
 *
 * @module dsh-aryacode-polish-hooks
 */

import { execFile } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { HOOK_LOG_LIMIT, hooksFile, loadHooks } from './hooks-config.js'

/** Absolute path the Host registers; the browser calls `api/polish.hooks`. */
export const HOOKS_PATH = '/api/polish.hooks'

/** Where the hooks file lives when the host sets neither home variable. */
function homeDirectory() {
  const home = process.env.DSH_HOME ?? process.env.ARYACODE_HOME
  return home !== undefined && home !== '' ? home : join(homedir(), '.dsh')
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/**
 * Run one command with a timeout and a bounded output read.
 * @param {object} rule the accepted rule.
 * @param {string} event the event name.
 * @param {unknown} payload the event payload, passed as JSON in the environment.
 * @returns {Promise<{ ok: boolean, ms: number, detail: string }>} the outcome.
 */
function runCommand(rule, event, payload) {
  const started = Date.now()
  return new Promise((resolve) => {
    let settled = false
    const finish = (ok, detail) => {
      if (settled) return
      settled = true
      resolve({ ok, ms: Date.now() - started, detail })
    }
    try {
      const child = execFile(rule.action.command, rule.action.args, {
        timeout: rule.action.timeoutMs,
        windowsHide: true,
        maxBuffer: 64 * 1024,
        env: {
          ...process.env,
          POLISH_HOOK_EVENT: event,
          POLISH_HOOK_NAME: rule.name,
          POLISH_HOOK_PAYLOAD: JSON.stringify(payload ?? null),
        },
      }, (error, stdout, stderr) => {
        if (error !== null && error !== undefined) {
          finish(false, String(stderr || error.message || 'failed').slice(0, 400))
          return
        }
        finish(true, String(stdout || '').trim().slice(0, 400))
      })
      child.once('error', (error) => finish(false, error.message))
    } catch (error) {
      finish(false, error instanceof Error ? error.message : 'could not start the command')
    }
  })
}

/**
 * Build the dispatcher and its bounded log.
 * @param {{ home: string, run?: Function }} options the harness home and an optional runner.
 * @returns {{ dispatch: Function, log: object[], load: Function, file: string, route: Function }} the runtime.
 */
export function createHookRuntime(options) {
  const home = options.home
  const run = typeof options.run === 'function' ? options.run : runCommand
  const log = []
  const record = (rule, event, outcome) => {
    log.unshift({
      at: Date.now(),
      hook: rule.name,
      event,
      ok: outcome.ok === true,
      ms: Number(outcome.ms) || 0,
      detail: typeof outcome.detail === 'string' ? outcome.detail : '',
    })
    if (log.length > HOOK_LOG_LIMIT) log.length = HOOK_LOG_LIMIT
  }
  const dispatch = (event, payload) => {
    const loaded = loadHooks(home)
    for (const rule of loaded.rules) {
      if (rule.on !== event) continue
      Promise.resolve()
        .then(() => run(rule, event, payload))
        .then((outcome) => record(rule, event, outcome))
        .catch((error) => record(rule, event, { ok: false, ms: 0, detail: error instanceof Error ? error.message : 'failed' }))
    }
    return loaded.rules.filter((rule) => rule.on === event).length
  }
  const route = (body) => {
    const loaded = loadHooks(home)
    if (body.action === 'validate' || body.action === 'list') {
      return {
        ok: true,
        path: hooksFile(home),
        events: true,
        rules: loaded.rules.map((rule) => ({
          name: rule.name,
          on: rule.on,
          kind: rule.action.kind,
          command: rule.action.command + (rule.action.args.length === 0 ? '' : ' ' + rule.action.args.join(' ')),
          timeoutMs: rule.action.timeoutMs,
        })),
        errors: loaded.errors,
        dispatches: log.slice(0, HOOK_LOG_LIMIT),
      }
    }
    return { ok: false, code: 'hooks_unknown_action', message: 'unknown action' }
  }
  return { dispatch, log, load: () => loadHooks(home), file: hooksFile(home), route }
}

/** The host half mounted by the hooks feature. */
export const hooksFeature = {
  name: 'polish-hooks',
  inject: ['connection'],
  apply(ctx) {
    const runtime = createHookRuntime({ home: homeDirectory() })
    ctx.effect(() => ctx.on('agent/turn-stopping', (payload) => {
      runtime.dispatch('turn/stopping', { agent: payload?.agent?.id, turn: payload?.turn })
    }))
    ctx.effect(() => ctx.on('agent/error', (payload) => {
      runtime.dispatch('agent/error', { turn: payload?.turn, step: payload?.step, error: payload?.error?.message })
    }))
    ctx.effect(() => ctx.on('session/event', (session, event) => {
      const type = event?.type
      if (type !== 'compaction/summary' && type !== 'compaction/end') return
      runtime.dispatch(type, {
        sessionId: session?.id,
        compactionId: event?.data?.compactionId,
        error: event?.data?.error,
      })
    }))
    ctx.effect(() => ctx.connection.fetch.register({
      path: HOOKS_PATH,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: async (request) => {
        if (request.method !== 'POST') return json({ ok: false, code: 'hooks_post_required' }, 405)
        let payload = {}
        try {
          payload = (await request.json()) || {}
        } catch {
          return json({ ok: false, code: 'hooks_bad_request', message: 'body must be JSON' }, 400)
        }
        const answer = runtime.route(payload)
        return json(answer, answer.ok ? 200 : 400)
      },
    }))
  },
}

/** Mount point the registry calls for the hooks feature. */
export async function mountHooks(ctx) {
  await ctx.plugin(hooksFeature)
}

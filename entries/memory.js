/**
 * Cross-session memory: one system-prompt section, one route, one store.
 *
 * The section is the whole model-facing surface. It is a provider rather than a
 * fixed string, so the prompt is rebuilt from the store on every assembly and an
 * empty store contributes nothing at all. Nothing is injected per step: the
 * transcript stays exactly what the session recorded, and memory is context the
 * prompt carries, not a message the model sent itself.
 *
 * The route is the panel's only door: `list`, `add` and `forget`. It answers with
 * stable codes so the browser never forwards a filesystem message.
 *
 * @module dsh-aryacode-polish-memory
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import { addMemory, forgetMemory, memorySection, readMemory } from './memory-store.js'

/** Absolute path the Host registers; the browser calls `api/polish.memory`. */
export const MEMORY_PATH = '/api/polish.memory'

/** The prompt section name; a duplicate registration throws, so it is fixed. */
export const MEMORY_SECTION_NAME = 'arya-memory'

/** Where the store lives when the host sets neither home variable. */
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
 * Answer one panel request.
 * @param {{ action?: unknown, text?: unknown, scope?: unknown, id?: unknown, home: string }} options
 *   the request fields and the store root.
 * @returns {{ ok: true, entries?: object[], entry?: object, removed?: boolean, total?: number } | { ok: false, code: string, message: string }}
 *   the answer.
 */
export function answerMemoryRequest(options) {
  try {
    if (options.action === 'list') return { ok: true, entries: readMemory(options.home) }
    if (options.action === 'add') {
      const entry = addMemory(options.home, options.text, options.scope)
      return { ok: true, entry, entries: readMemory(options.home) }
    }
    if (options.action === 'forget') {
      const answer = forgetMemory(options.home, options.id)
      return { ok: true, removed: answer.removed, entries: readMemory(options.home) }
    }
    throw Object.assign(new Error('unknown action'), { code: 'memory_unknown_action' })
  } catch (error) {
    return { ok: false, code: error?.code || 'memory_failed', message: error instanceof Error ? error.message : 'memory failed' }
  }
}

/** The host half mounted by the memory feature. */
export const memoryFeature = {
  name: 'polish-memory',
  inject: ['connection'],
  apply(ctx) {
    const home = homeDirectory()
    // The prompt service is optional: a composition without it still gets the
    // panel, it simply has nowhere to recall into.
    ctx.effect(() => {
      const systemPrompt = typeof ctx.get === 'function' ? ctx.get('systemPrompt', false) : undefined
      if (systemPrompt === undefined || systemPrompt === null || typeof systemPrompt.section !== 'function') return () => {}
      return systemPrompt.section({
        name: MEMORY_SECTION_NAME,
        order: 900,
        interpolate: false,
        text: () => memorySection(readMemory(home)),
      })
    })
    ctx.effect(() => ctx.connection.fetch.register({
      path: MEMORY_PATH,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: async (request) => {
        if (request.method !== 'POST') return json({ ok: false, code: 'memory_post_required' }, 405)
        let payload = {}
        try {
          payload = (await request.json()) || {}
        } catch {
          return json({ ok: false, code: 'memory_bad_request', message: 'body must be JSON' }, 400)
        }
        const answer = answerMemoryRequest({
          action: payload.action,
          text: payload.text,
          scope: payload.scope,
          id: payload.id,
          home,
        })
        return json(answer, answer.ok ? 200 : 400)
      },
    }))
  },
}

/** Mount point the registry calls for the memory feature. */
export async function mountMemory(ctx) {
  await ctx.plugin(memoryFeature)
}

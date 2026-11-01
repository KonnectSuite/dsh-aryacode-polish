/**
 * The Session trash route.
 *
 * One POST route, `api/polish.trash`, answering five actions. The browser sends
 * `{ action, sessionId?, title? }`, and every answer is JSON the tree can render
 * without knowing anything about the filesystem.
 *
 * The one gate the host owns is the archive check. The browser's tree only offers
 * the row inside the Archived section, and the browser is not the security
 * boundary, so the answer re-reads the Host's own archive set from
 * `ctx.workspaceRegistry` for every trash request. A browser that lies about a
 * live Session gets `trash_not_archived`, and the Session log stays where it is.
 *
 * Failure answers carry the store's code (`trash_bad_id`, `trash_not_archived`,
 * `trash_not_found`, `trash_already_trashed`, `trash_restore_target_busy`,
 * `trash_missing_entry`) so the tree can name the gate that stopped the action
 * rather than passing a raw filesystem message through.
 *
 * @module dsh-aryacode-polish-trash
 */

import {
  emptyTrash,
  listTrash,
  purgeSession,
  restoreSession,
  trashSession,
} from './trash-store.js'

/** Absolute path the Host registers; the browser calls `api/polish.trash`. */
export const TRASH_PATH = '/api/polish.trash'

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/**
 * Is this Session archived, by the Host's own record?
 * @param ctx - the host context.
 * @param {string} sessionId - the Session id.
 * @returns {boolean | null} the answer, or null when the registry is not there.
 */
function archivedAt(ctx, sessionId) {
  let registry
  try {
    registry = ctx.get('workspaceRegistry')
  } catch {
    return null
  }
  if (!registry) return null
  const ids = registry.archivedSessionIds
  return Array.isArray(ids) ? ids.map(String).indexOf(String(sessionId)) !== -1 : null
}

/**
 * Answer one trash request.
 *
 * Exported on its own so a spec can drive all five actions and every failure code
 * without a context, a port, or the filesystem's home resolution.
 *
 * @param {object} options the request.
 * @param {string} [options.home] the harness home to operate on.
 * @param {string} [options.action] one of list / trash / restore / purge / empty.
 * @param {string} [options.sessionId] the Session for the single-item actions.
 * @param {string} [options.title] the row title recorded for the trash list.
 * @param {(id: string) => boolean | null} [options.isArchived] the archive check.
 * @returns {Promise<{ok: boolean, code?: string, [key: string]: unknown}>} the answer.
 */
export async function answerTrashRequest(options) {
  const action = String(options.action || 'list')
  try {
    if (action === 'list') return Object.assign({ ok: true }, listTrash({ home: options.home }))
    if (action === 'empty') return Object.assign({ ok: true }, emptyTrash({ home: options.home }))
    if (action === 'trash') {
      const archived = options.isArchived ? options.isArchived(options.sessionId) : null
      if (archived === null) {
        throw Object.assign(new Error('the workspace registry is not available'), { code: 'trash_registry_unavailable' })
      }
      if (archived !== true) {
        throw Object.assign(new Error('only an archived session can be trashed'), { code: 'trash_not_archived' })
      }
      return Object.assign({ ok: true }, trashSession({
        home: options.home,
        sessionId: options.sessionId,
        archived: true,
        title: options.title,
      }))
    }
    if (action === 'restore') return Object.assign({ ok: true }, restoreSession({ home: options.home, sessionId: options.sessionId }))
    if (action === 'purge') return Object.assign({ ok: true }, purgeSession({ home: options.home, sessionId: options.sessionId }))
    throw Object.assign(new Error('unknown action'), { code: 'trash_unknown_action' })
  } catch (error) {
    return { ok: false, code: error?.code || 'trash_failed', message: error instanceof Error ? error.message : 'trash failed' }
  }
}

/** The host half mounted by the trash feature. */
export const trashFeature = {
  name: 'polish-trash',
  inject: ['connection'],
  apply(ctx) {
    ctx.effect(() => ctx.connection.fetch.register({
      path: TRASH_PATH,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: async (request) => {
        if (request.method !== 'POST') return json({ ok: false, code: 'trash_post_required' }, 405)
        // `requestBody: 'buffered'` hands us bytes, not a string: parse the Request,
        // never stringify the body — `String(new ArrayBuffer(...))` is a parse failure.
        let payload = {}
        try {
          payload = (await request.json()) || {}
        } catch {
          return json({ ok: false, code: 'trash_bad_request', message: 'body must be JSON' }, 400)
        }
        const answer = await answerTrashRequest({
          action: payload.action,
          sessionId: payload.sessionId,
          title: payload.title,
          isArchived: (id) => archivedAt(ctx, id),
        })
        return json(answer, answer.ok ? 200 : 400)
      },
    }))
  },
}

/** Mount point the registry calls for the trash feature. */
export async function mountTrash(ctx) {
  await ctx.plugin(trashFeature)
}

/**
 * Which listed sessions are subagent sessions.
 *
 * The sidebar's own payload carries no lineage, but the Host's list does: `list.ts` adds
 * `parentSessionId` for any Session whose header has a parent, and the harness nests sessions with
 * exactly that field. So the route answers the parent link and nothing else — no titles, no prompts,
 * no content of any kind.
 */

/** Absolute path the Host registers; the browser calls `api/polish.sessions`. */
export const SESSIONS_PATH = '/api/polish.sessions'

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/**
 * Answer one request: the session ids that have a parent, with that parent.
 *
 * @param ctx - the host context, used only to reach the session controller.
 * @returns a Response with `{ total, items: [{ id, parent }] }`.
 */
export async function readSubagentSessions(ctx) {
  const controller = ctx.get('sessionController')
  if (!controller || typeof controller.list !== 'function') return { total: 0, items: [] }
  const answer = await controller.list({}, new AbortController().signal)
  const items = Array.isArray(answer && answer.items) ? answer.items : []
  const children = items
    .filter((entry) => entry && typeof entry.parentSessionId === 'string' && entry.parentSessionId !== '')
    .map((entry) => ({ id: String(entry.sessionId), parent: String(entry.parentSessionId) }))
  return { total: items.length, items: children }
}

/** The host half mounted by the workspace feature. */
export const sessionsFeature = {
  name: 'polish-sessions',
  inject: ['connection'],
  apply(ctx) {
    ctx.effect(() => ctx.connection.fetch.register({
      path: SESSIONS_PATH,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: async (request) => {
        if (request.method !== 'POST') return json({ error: 'POST required' }, 405)
        try {
          return json(await readSubagentSessions(ctx))
        } catch (error) {
          return json({ error: error instanceof Error ? error.message : 'cannot list sessions' }, 400)
        }
      },
    }))
  },
}

/** Mount point the registry calls for the workspace feature. */
export async function mountSessions(ctx) {
  await ctx.plugin(sessionsFeature)
}

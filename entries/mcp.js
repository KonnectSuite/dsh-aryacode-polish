/**
 * The `mcpManager` feature: the MCP server page's host half.
 *
 * One manager (the server list plus one mounted bridge fiber per enabled server)
 * and one route. The route is registered through `connection.fetch`, the same
 * transport the GitHub feature uses, so it works over the desktop bridge and over
 * a plain web origin without a second mechanism.
 *
 * @module dsh-aryacode-polish-mcp
 */

import { createMcpManager } from '../mcp/manager.js'
import { MCP_ROUTE, createHandler } from '../mcp/routes.js'
import { json } from './github.js'

export { MCP_ROUTE }

/** Where the GitHub token comes from: the environment first, then the CLI. */
async function resolveToken() {
  if (typeof process === 'object' && typeof process.env?.GITHUB_TOKEN === 'string' && process.env.GITHUB_TOKEN !== '') {
    return process.env.GITHUB_TOKEN
  }
  try {
    const { ghToken } = await import('./github.js')
    return await ghToken()
  } catch {
    return undefined
  }
}

/**
 * Mount the feature on a context that provides `connection`.
 * @param {object} ctx the host context.
 * @param {object} config the row config (unused; kept for the feature contract).
 * @returns {object} the plugin fiber.
 */
export function mountMcpManager(ctx, config = {}) {
  return ctx.plugin({ ...mcpFeature, config })
}

/** The feature plugin object. */
export const mcpFeature = {
  name: 'polish-mcp',
  apply(ctx) {
    const manager = createMcpManager({ ctx })
    const handle = createHandler(manager, { resolveToken })

    // A mounted bridge holds child processes: they must die with the switch.
    ctx.effect(() => () => {
      void manager.disposeAll()
    })

    ctx.inject(['connection'], (inner) => {
      inner.connection.fetch.register({
        path: MCP_ROUTE,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          if (request.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405)
          let body
          try {
            body = await request.json()
          } catch {
            return json({ ok: false, error: 'body must be JSON' }, 400)
          }
          return json(await handle(body))
        },
      })
    })

    // Import the bridge once, then mount what the store already holds. A failure
    // is reported on the page instead of taking the plugin down.
    void manager.loadBridge().then(() => manager.start())
  },
}

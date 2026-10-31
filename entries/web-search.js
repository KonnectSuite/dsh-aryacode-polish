/**
 * The `aryaSearch` feature: AryaSearch (a SearXNG instance) as a search provider
 * for the harness's `web` seam, plus the policy that keeps `web_search` alive on a
 * model route that has no DeepSeek credential.
 *
 * The built-in `web_search` tool is offered per model step only while
 * `ctx.web.searchReady(modelSelection.provider)` is true, and that answer comes
 * from whichever provider `web.searchProvider` names. The base composition pins
 * `deepseek-official`, whose readiness is false without a `DEEPSEEK_API_KEY`. So
 * this feature does two things:
 *
 * 1. registers a provider that is ready for every route (a configured SearXNG
 *    instance needs no model credential), and
 * 2. in `auto` mode, pins `web.searchProvider` to it while DeepSeek has no key,
 *    and unpins the moment a key appears.
 *
 * The pin is a volatile field on the `web` row, written through the settings
 * service, which is the same path the shipped Web search card uses; it takes
 * effect on the next tool step and survives a restart.
 *
 * @module dsh-aryacode-polish-aryasearch
 */

import { ARYASEARCH_PROVIDER_ID, createAryaSearchProvider, runSearch } from '../web/provider.js'
import {
  defaultSettings,
  isConfigured,
  normalizeSettings,
  publicSettings,
  readSettings,
  settingsPath,
  writeSettings,
} from '../web/settings.js'

/** The route the Host registers; the browser addresses `api/polish.websearch`. */
export const WEB_SEARCH_ROUTE = '/api/polish.websearch'

/** The credential reference the DeepSeek search provider looks at. */
const DEEPSEEK_CREDENTIAL_REF = 'DEEPSEEK_API_KEY'

/** The row whose volatile `searchProvider` field selects the search backend. */
const WEB_ENTRY_ID = 'web'

/**
 * Mount the feature.
 * @param {object} ctx the host context.
 * @param {object} config the row config (unused).
 * @returns {object} the plugin fiber.
 */
export function mountAryaSearch(ctx, config = {}) {
  return ctx.plugin({ ...aryaSearchFeature, config })
}

/** The feature plugin object. */
export const aryaSearchFeature = {
  name: 'polish-aryasearch',
  // The provider registers on the web seam; without this the service is not
  // visible on the context and apply() throws before the route exists.
  inject: ['web'],
  apply(ctx) {
    const file = settingsPath()
    const loaded = readSettings(file)
    let settings = loaded.settings
    let lastReconcile = { at: 0, changed: false, skipped: true, reason: 'not run yet' }

    const store = {
      get: () => settings,
      save(input) {
        const { settings: next, errors } = normalizeSettings(input)
        if (errors.length > 0) return { ok: false, errors }
        settings = next
        writeSettings(file, settings)
        return { ok: true }
      },
    }

    /** Resolve the bearer token through the credentials service when one is referenced. */
    const resolveToken = async () => {
      if (settings.tokenRef === '') return undefined
      const credentials = safeGet(ctx, 'credentials')
      if (credentials === undefined) return undefined
      try {
        const resolved = await credentials.resolve(settings.tokenRef)
        return typeof resolved?.value === 'string' ? resolved.value : undefined
      } catch {
        return undefined
      }
    }

    // The provider registers for this fiber's lifetime: switching the feature off
    // unregisters it, and the pin is reset on the way out (see below).
    ctx.web.registerSearchProvider(createAryaSearchProvider({ getSettings: store.get, resolveToken }))
    safeLog(ctx, 'aryasearch: provider registered as ' + ARYASEARCH_PROVIDER_ID + (isConfigured(settings) ? ' (' + settings.baseURL + ')' : ' (no base URL yet)'))

    /**
     * The effective and composed-default search provider, read from the settings
     * service rather than assumed.
     * @param {object | undefined} settingsService the host settings service.
     * @returns {{ effective?: string, base?: string }} the selection.
     */
    const selection = settingsService => {
      if (settingsService === undefined) return {}
      try {
        const row = settingsService.describe().find(entry => entry.ns === WEB_ENTRY_ID)
        return {
          effective: typeof row?.value?.searchProvider === 'string' ? row.value.searchProvider : undefined,
          base: typeof row?.base?.searchProvider === 'string' ? row.base.searchProvider : undefined,
        }
      } catch {
        return {}
      }
    }

    /**
     * Whether DeepSeek could search on its own: the API key the shipped provider
     * checks, in the same credential store it reads.
     * @returns {Promise<{ configured: boolean, source?: string }>} the answer.
     */
    const deepseekCredential = async () => {
      const credentials = safeGet(ctx, 'credentials')
      if (credentials === undefined) return { configured: false }
      try {
        const described = await credentials.describe(DEEPSEEK_CREDENTIAL_REF)
        return { configured: described?.configured === true, source: described?.source }
      } catch {
        return { configured: false }
      }
    }

    /**
     * Apply the mode: `auto` pins while DeepSeek has no key, `always` pins, `off`
     * restores the composed default. Never touches a selection it does not own.
     * @param {{ force?: boolean }} [options] `force` writes even in a no-op state.
     * @returns {Promise<object>} what happened.
     */
    const reconcile = async (options = {}) => {
      const settingsService = safeGet(ctx, 'settings')
      const current = selection(settingsService)
      const credential = await deepseekCredential()
      const configured = isConfigured(settings)
      const baseDefault = current.base ?? 'deepseek-official'
      let desired = baseDefault
      let reason = 'mode off'
      if (settings.mode === 'always' && configured) {
        desired = ARYASEARCH_PROVIDER_ID
        reason = 'mode always'
      } else if (settings.mode === 'auto' && configured) {
        if (credential.configured) {
          desired = baseDefault
          reason = 'DeepSeek has a key'
        } else {
          desired = ARYASEARCH_PROVIDER_ID
          reason = 'no DeepSeek key'
        }
      } else if (settings.mode === 'auto' || settings.mode === 'always') {
        reason = 'AryaSearch is not configured'
      }

      // Only manage a selection we own: our id or the composed default. A user who
      // pinned the DeepSeek Search API keeps it.
      const owned = current.effective === undefined || current.effective === ARYASEARCH_PROVIDER_ID || current.effective === baseDefault
      if (!owned && settings.mode !== 'always') {
        lastReconcile = { at: Date.now(), changed: false, skipped: true, reason: `selection is "${String(current.effective)}"`, desired }
        return lastReconcile
      }
      if (current.effective === desired && options.force !== true) {
        lastReconcile = { at: Date.now(), changed: false, skipped: true, reason, desired }
        return lastReconcile
      }
      if (settingsService === undefined) {
        lastReconcile = { at: Date.now(), changed: false, skipped: true, reason: 'the settings service is not available', desired }
        return lastReconcile
      }
      try {
        await settingsService.update(WEB_ENTRY_ID, { searchProvider: desired })
        lastReconcile = { at: Date.now(), changed: true, skipped: false, reason, desired, from: current.effective }
      } catch (error) {
        lastReconcile = { at: Date.now(), changed: false, skipped: true, reason: `the pin could not be written: ${error instanceof Error ? error.message : String(error)}`, desired }
      }
      return lastReconcile
    }

    /**
     * Whether the seam would offer web_search right now. This is the fact the
     * card exists to explain: readiness comes from the selected provider, so a
     * local model loses the tool the moment the selection has no credential.
     * @returns {Promise<boolean | undefined>} the answer, or undefined when the
     *   web service cannot be asked.
     */
    const searchOffered = async () => {
      try {
        return await ctx.web.searchReady()
      } catch {
        return undefined
      }
    }

    /** The card's read model. */
    const status = async () => {
      const settingsService = safeGet(ctx, 'settings')
      const current = selection(settingsService)
      const credential = await deepseekCredential()
      return {
        ok: true,
        path: file,
        recovered: loaded.recovered,
        readiness: await searchOffered(),
        settings: publicSettings(settings),
        configured: isConfigured(settings),
        selection: { effective: current.effective, base: current.base, pinned: current.effective === ARYASEARCH_PROVIDER_ID },
        deepseek: credential,
        reconcile: lastReconcile,
      }
    }

    /** Run one real search for the card's Test button. */
    const test = async query => {
      const started = Date.now()
      try {
        const outcome = await runSearch({ settings, request: { query }, resolveToken, })
        return {
          ok: true,
          ms: outcome.diagnostics.ms ?? Date.now() - started,
          count: outcome.result.sources.length,
          engines: outcome.diagnostics.engines ?? [],
          unresponsive: outcome.diagnostics.unresponsive ?? [],
          content: outcome.result.content ?? '',
          first: outcome.result.sources[0] ?? null,
          redirect: outcome.diagnostics.redirect ?? '',
        }
      } catch (error) {
        return { ok: false, ms: Date.now() - started, error: error instanceof Error ? error.message : String(error), code: error?.code }
      }
    }

    // The message bus is how the host learns that the DeepSeek key appeared or
    // vanished; the client mirror emits the same name.
    if (typeof ctx.on === 'function') {
      ctx.on('credentials/reference-updated', ref => {
        if (ref === DEEPSEEK_CREDENTIAL_REF) void reconcile()
      })
    }

    ctx.inject(['connection'], inner => {
      inner.connection.fetch.register({
        path: WEB_SEARCH_ROUTE,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async request => {
          if (request.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405)
          let body
          try {
            body = await request.json()
          } catch {
            return json({ ok: false, error: 'body must be JSON' }, 400)
          }
          const action = typeof body?.action === 'string' ? body.action : ''
          try {
            if (action === 'status') return json(await status())
            if (action === 'save') {
              const saved = store.save(body.settings)
              if (saved.ok !== true) return json({ ok: false, errors: saved.errors })
              const pinned = await reconcile()
              return json({ ...(await status()), reconcile: pinned })
            }
            if (action === 'reconcile') return json({ ok: true, reconcile: await reconcile({ force: true }), ...(await status()) })
            if (action === 'test') return json(await test(typeof body.query === 'string' && body.query.trim() !== '' ? body.query : 'arya test'))
            if (action === 'defaults') return json({ ok: true, settings: publicSettings(defaultSettings()) })
            return json({ ok: false, error: `Unknown action "${action}".` })
          } catch (error) {
            return json({ ok: false, error: error instanceof Error ? error.message : String(error) })
          }
        },
      })
    })

    // Reset the pin on the way out, so switching the feature off cannot leave the
    // `web` row pointing at a provider that is no longer registered.
    ctx.effect(() => () => {
      const settingsService = safeGet(ctx, 'settings')
      if (settingsService === undefined) return
      const current = selection(settingsService)
      if (current.effective !== ARYASEARCH_PROVIDER_ID) return
      void settingsService.update(WEB_ENTRY_ID, { searchProvider: current.base ?? 'deepseek-official' }).catch(() => {})
    })

    // Reconcile once the settings service exists: the row mounts before it, and an
    // early call would find no service to write the pin through.
    ctx.inject(['settings'], () => {
      void reconcile()
    })
  },
}

/** Log through the host logger when one is present. */
function safeLog(ctx, line) {
  try {
    ctx.logger?.info?.(line)
  } catch {
    // Logging must never take the feature down.
  }
}

/** Read a service without throwing when it is absent. */
function safeGet(ctx, name) {
  try {
    return ctx.get(name)
  } catch {
    return undefined
  }
}

/** A JSON response, matching the other routes in this bundle. */
function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

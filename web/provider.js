/**
 * The AryaSearch search provider: a SearXNG instance speaking `format=json`,
 * registered on the harness's own `ctx.web` seam.
 *
 * The seam calls `search({ query, maxResults }, signal)` on whichever provider the
 * `web` row selects. This provider answers the same shape the shipped DeepSeek one
 * does - `{ sources, content?, truncated }` - so the built-in `web_search` tool
 * renders it without knowing who produced the results.
 *
 * SearXNG specifics worth remembering:
 * - `format=json` must be listed in the instance's `search.formats`, otherwise it
 *   answers 403 with an HTML page;
 * - a `!bang` query answers with a 302 to the destination instead of results, so
 *   a redirect becomes one source pointing at that destination;
 * - `answers[]` carries the instant-answer text, which becomes the result's
 *   `content`;
 * - `unresponsive_engines` names engines that failed for that query (a CAPTCHA on
 *   one engine is normal and not fatal).
 *
 * @module dsh-aryacode-polish-aryasearch-provider
 */

import { isConfigured } from './settings.js'

/** The provider id the `web` row pins to select this engine. */
export const ARYASEARCH_PROVIDER_ID = 'aryasearch'

/** Stable codes, matching the seam's `WebError` vocabulary where one exists. */
export const ARYASEARCH_ERRORS = Object.freeze({
  notConfigured: 'WEB_PROVIDER_UNAVAILABLE',
  aborted: 'WEB_ABORTED',
  http: 'WEB_PROVIDER_ERROR',
  format: 'WEB_PROVIDER_ERROR',
  network: 'WEB_PROVIDER_ERROR',
})

/** An error the seam and the card can route on. */
export class AryaSearchError extends Error {
  /**
   * @param {string} message what happened, in a sentence the user can act on.
   * @param {string} code a stable code.
   * @param {{ cause?: unknown }} [options] the underlying failure.
   */
  constructor(message, code, options) {
    super(message, options)
    this.name = 'AryaSearchError'
    this.code = code
  }
}

/**
 * Build the search URL for one query.
 * @param {object} settings the normalized settings.
 * @param {string} query the user's query, forwarded verbatim (bangs included).
 * @returns {string} the absolute URL.
 */
export function buildSearchUrl(settings, query) {
  const url = new URL(`${settings.baseURL}/search`)
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'json')
  if (settings.language !== '') url.searchParams.set('language', settings.language)
  if (settings.safesearch !== '') url.searchParams.set('safesearch', settings.safesearch)
  if (settings.categories !== '') url.searchParams.set('categories', settings.categories)
  if (settings.timeRange !== '') url.searchParams.set('time_range', settings.timeRange)
  return url.toString()
}

/**
 * The request headers, including whichever authentication the settings name.
 * @param {object} settings the normalized settings.
 * @param {() => Promise<string | undefined>} resolveToken resolves the credential reference.
 * @returns {Promise<Record<string, string>>} the headers.
 */
export async function authHeaders(settings, resolveToken) {
  const headers = { accept: 'application/json', 'user-agent': 'aryacode-polish/aryasearch' }
  if (settings.auth === 'header') {
    for (const [key, value] of Object.entries(settings.headers ?? {})) headers[key] = value
    return headers
  }
  if (settings.auth === 'basic') {
    headers.authorization = `Basic ${Buffer.from(`${settings.basicUser}:${settings.basicPass}`).toString('base64')}`
    return headers
  }
  if (settings.auth === 'bearer') {
    const referenced = settings.tokenRef === '' ? undefined : await resolveToken()
    const token = referenced !== undefined && referenced !== '' ? referenced : settings.token
    if (token === undefined || token === '') {
      throw new AryaSearchError('AryaSearch bearer authentication has no token: set a credential reference or a token in the AryaSearch card.', ARYASEARCH_ERRORS.notConfigured)
    }
    headers.authorization = `Bearer ${token}`
  }
  return headers
}

/** Decode the handful of entities SearXNG result text carries. */
function decodeEntities(text) {
  return String(text)
    .replace(/&amp;/gu, '&')
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'")
    .replace(/\s+/gu, ' ')
    .trim()
}

/**
 * Map one SearXNG JSON body to the seam's search result.
 * @param {object} body the parsed JSON.
 * @returns {{ result: { sources: object[], content?: string, truncated: boolean }, diagnostics: object }} the
 *   normalized result and what the Test button reports.
 */
export function mapSearchResponse(body) {
  const seen = new Set()
  const sources = []
  for (const item of Array.isArray(body?.results) ? body.results : []) {
    const url = typeof item?.url === 'string' ? item.url : ''
    if (url === '' || seen.has(url)) continue
    seen.add(url)
    const title = typeof item.title === 'string' ? decodeEntities(item.title) : ''
    const snippet = typeof item.content === 'string' ? decodeEntities(item.content) : ''
    const publishedAt = typeof item.publishedDate === 'string' ? item.publishedDate : ''
    sources.push({
      url,
      ...(title === '' ? {} : { title }),
      ...(snippet === '' ? {} : { snippet }),
      ...(publishedAt === '' ? {} : { publishedAt }),
    })
  }
  const answer = Array.isArray(body?.answers) && typeof body.answers[0]?.answer === 'string' ? decodeEntities(body.answers[0].answer) : ''
  const engines = [...new Set(sources.map(source => {
    const item = (body.results ?? []).find(candidate => candidate.url === source.url)
    return typeof item?.engine === 'string' ? item.engine : ''
  }).filter(engine => engine !== ''))]
  const unresponsive = Array.isArray(body?.unresponsive_engines)
    ? body.unresponsive_engines.filter(entry => Array.isArray(entry) && entry.length > 0).map(entry => ({ engine: String(entry[0]), reason: String(entry[1] ?? '') }))
    : []
  return {
    result: {
      sources,
      ...(answer === '' ? {} : { content: answer }),
      truncated: false,
    },
    diagnostics: { engines, unresponsive, resultCount: sources.length },
  }
}

/**
 * Race a fetch against the caller's signal and the configured timeout.
 * @param {object} settings the settings (for `timeoutMs`).
 * @param {AbortSignal | undefined} signal the caller's cancellation.
 * @returns {{ signal: AbortSignal, dispose: () => void, timedOut: () => boolean }} the
 *   combined signal and how to tell a timeout from a cancellation.
 */
function operationSignal(settings, signal) {
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, settings.timeoutMs)
  const onAbort = () => controller.abort()
  if (signal !== undefined) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', onAbort, { once: true })
  }
  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    },
    timedOut: () => timedOut,
  }
}

/**
 * Run one search and return both the seam result and the diagnostics the card shows.
 * @param {object} options the search inputs.
 * @param {object} options.settings the normalized settings.
 * @param {{ query: string }} options.request the seam request.
 * @param {AbortSignal | undefined} options.signal the caller's cancellation.
 * @param {typeof fetch} [options.fetchImpl] a fetch override for tests.
 * @param {() => Promise<string | undefined>} [options.resolveToken] credential resolution.
 * @returns {Promise<{ result: object, diagnostics: object }>} the search outcome.
 */
export async function runSearch(options) {
  const { settings, request, signal } = options
  const fetchImpl = options.fetchImpl ?? fetch
  const resolveToken = options.resolveToken ?? (async () => undefined)
  if (!isConfigured(settings)) {
    throw new AryaSearchError('AryaSearch has no base URL yet: open Plugins > AryaSearch and save one.', ARYASEARCH_ERRORS.notConfigured)
  }
  const query = typeof request?.query === 'string' ? request.query : ''
  if (query.trim() === '') throw new AryaSearchError('AryaSearch needs a non-empty query.', ARYASEARCH_ERRORS.http)
  const url = buildSearchUrl(settings, query)
  const headers = await authHeaders(settings, resolveToken)
  const op = operationSignal(settings, signal)
  const started = Date.now()
  // A cancellation that arrived before dispatch never reaches fetch: report it as
  // the seam's cancellation instead of calling the network.
  if (op.signal.aborted) {
    op.dispose()
    if (op.timedOut()) throw new AryaSearchError(`AryaSearch did not answer within ${Math.round(settings.timeoutMs / 1000)}s (${settings.baseURL}).`, ARYASEARCH_ERRORS.network)
    throw new AryaSearchError('The search was cancelled.', ARYASEARCH_ERRORS.aborted)
  }
  try {
    let response
    try {
      response = await fetchImpl(url, { method: 'GET', headers, redirect: 'manual', signal: op.signal })
    } catch (error) {
      if (op.timedOut()) throw new AryaSearchError(`AryaSearch did not answer within ${Math.round(settings.timeoutMs / 1000)}s (${settings.baseURL}).`, ARYASEARCH_ERRORS.network, { cause: error })
      if (signal?.aborted === true) throw new AryaSearchError('The search was cancelled.', ARYASEARCH_ERRORS.aborted, { cause: error })
      throw new AryaSearchError(`AryaSearch could not be reached at ${settings.baseURL}: ${error instanceof Error ? error.message : String(error)}. Check the URL and that the Tailnet is up.`, ARYASEARCH_ERRORS.network, { cause: error })
    }
    if (response.status >= 300 && response.status < 400) {
      // A bang or an instance-level redirect: report the destination as the one source.
      const location = response.headers.get('location') ?? ''
      const destination = location === '' ? '' : new URL(location, settings.baseURL).toString()
      if (destination === '') {
        throw new AryaSearchError(`AryaSearch redirected (HTTP ${response.status}) without a destination.`, ARYASEARCH_ERRORS.http)
      }
      return {
        result: { sources: [{ url: destination, title: query }], truncated: false },
        diagnostics: { engines: [], unresponsive: [], resultCount: 1, redirect: destination, ms: Date.now() - started },
      }
    }
    if (!response.ok) {
      const status = response.status
      const hint = status === 401 || status === 403
        ? 'The instance answered without JSON. Enable "json" in its search.formats (settings.yml), and if it sits behind a proxy check the authentication in this card.'
        : status === 429
          ? 'The instance is rate limiting. Wait a moment, or relax its limiter for this client.'
          : `The instance answered HTTP ${status}.`
      throw new AryaSearchError(`AryaSearch refused the search (HTTP ${status}). ${hint}`, ARYASEARCH_ERRORS.http)
    }
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('json')) {
      throw new AryaSearchError(`AryaSearch answered with ${contentType === '' ? 'an unknown content type' : contentType} instead of JSON. Enable "json" in its search.formats (settings.yml).`, ARYASEARCH_ERRORS.format)
    }
    let body
    try {
      body = await response.json()
    } catch (error) {
      throw new AryaSearchError('AryaSearch returned a body that is not JSON.', ARYASEARCH_ERRORS.format, { cause: error })
    }
    const mapped = mapSearchResponse(body)
    return {
      result: mapped.result,
      diagnostics: { ...mapped.diagnostics, ms: Date.now() - started, url },
    }
  } finally {
    op.dispose()
  }
}

/**
 * Create the provider object `ctx.web.registerSearchProvider` expects.
 * @param {{ getSettings: () => object, resolveToken?: () => Promise<string | undefined>, fetchImpl?: typeof fetch }} options
 *   the settings source and the two injection points.
 * @returns {object} the provider.
 */
export function createAryaSearchProvider(options) {
  const provider = {
    id: ARYASEARCH_PROVIDER_ID,
    available: () => isConfigured(options.getSettings()),
    // No model-route credential is involved: a configured instance can search for
    // any route, which is what keeps web_search offered on a local model.
    ready: () => isConfigured(options.getSettings()),
    async search(request, signal) {
      const { result } = await runSearch({
        settings: options.getSettings(),
        request,
        signal,
        fetchImpl: options.fetchImpl,
        resolveToken: options.resolveToken,
      })
      return result
    },
  }
  return provider
}

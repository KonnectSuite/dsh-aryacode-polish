/**
 * The AryaSearch provider: settings rules, URL construction, SearXNG mapping and
 * the failures the card and the model should see.
 */
import { strict as assert } from 'node:assert'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  ARYASEARCH_PROVIDER_ID,
  AryaSearchError,
  authHeaders,
  buildSearchUrl,
  createAryaSearchProvider,
  mapSearchResponse,
  runSearch,
} from '../web/provider.js'
import {
  defaultSettings,
  isConfigured,
  normalizeSettings,
  publicSettings,
  readSettings,
  settingsPath,
  writeSettings,
} from '../web/settings.js'

/** Settings good enough to search. */
function liveSettings(overrides = {}) {
  return normalizeSettings({ baseURL: 'https://search.example.ts.net', ...overrides }).settings
}

/** A fetch that answers with one canned response. */
function fakeFetch(response) {
  const calls = []
  const impl = async (url, init) => {
    calls.push({ url, init })
    return response()
  }
  return { impl, calls }
}

/** A JSON response helper. */
function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  })
}

test('defaults are inert and safe', () => {
  const settings = defaultSettings()
  assert.equal(settings.mode, 'auto')
  assert.equal(settings.auth, 'none')
  assert.equal(settings.baseURL, '')
  assert.equal(isConfigured(settings), false)
  assert.equal(settings.timeoutMs, 20000)
})

test('normalization trims the URL and enforces the bounds', () => {
  const { settings, errors } = normalizeSettings({ baseURL: '  https://s.example.ts.net/// ', timeoutMs: 999999, mode: 'auto' })
  assert.deepEqual(errors, [])
  assert.equal(settings.baseURL, 'https://s.example.ts.net')
  assert.equal(settings.timeoutMs, 60000, 'the timeout clamps to the maximum')
  assert.equal(isConfigured(settings), true)
})

test('a non-http URL and an unknown mode are refused', () => {
  const bad = normalizeSettings({ baseURL: 'ftp://x', mode: 'sometimes' })
  assert.equal(bad.errors.some(error => error.field === 'baseURL'), true)
  assert.equal(bad.errors.some(error => error.field === 'mode'), true)
})

test('authentication requirements are checked before saving', () => {
  const bearer = normalizeSettings({ baseURL: 'https://x', auth: 'bearer' })
  assert.equal(bearer.errors.some(error => error.field === 'tokenRef'), true)
  const withRef = normalizeSettings({ baseURL: 'https://x', auth: 'bearer', tokenRef: 'ARYASEARCH_TOKEN' })
  assert.deepEqual(withRef.errors, [])
  const basic = normalizeSettings({ baseURL: 'https://x', auth: 'basic', basicUser: 'u' })
  assert.equal(basic.errors.some(error => error.field === 'basicUser'), true)
})

test('public settings mask both secrets and name the keys', () => {
  const { settings } = normalizeSettings({ baseURL: 'https://x', auth: 'bearer', token: 'secret-token', basicPass: 'pw' })
  const shown = publicSettings(settings)
  assert.equal(shown.token, '********')
  assert.equal(shown.basicPass, '********')
  assert.deepEqual(shown.secretKeys.sort(), ['basicPass', 'token'])
  assert.equal(shown.baseURL, 'https://x')
})

test('the settings file round-trips and survives corruption', () => {
  const dir = mkdtempSync(join(tmpdir(), 'arya-search-'))
  try {
    const file = settingsPath(dir)
    const { settings } = normalizeSettings({ baseURL: 'https://s.example', mode: 'always', language: 'en' })
    writeSettings(file, settings)
    assert.deepEqual(readSettings(file).settings, settings)
    writeFileSync(file, '{ nope', 'utf8')
    const recovered = readSettings(file)
    assert.equal(recovered.settings.baseURL, '')
    assert.notEqual(recovered.recovered, null)
    assert.equal(readFileSync(recovered.recovered, 'utf8'), '{ nope')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('the search URL carries the query and every option', () => {
  const settings = liveSettings({ language: 'en', safesearch: '1', categories: 'general,news', timeRange: 'week' })
  const url = new URL(buildSearchUrl(settings, '!gh deepseek'))
  assert.equal(url.pathname, '/search')
  assert.equal(url.searchParams.get('q'), '!gh deepseek')
  assert.equal(url.searchParams.get('format'), 'json')
  assert.equal(url.searchParams.get('language'), 'en')
  assert.equal(url.searchParams.get('safesearch'), '1')
  assert.equal(url.searchParams.get('categories'), 'general,news')
  assert.equal(url.searchParams.get('time_range'), 'week')
})

test('a bearer token comes from the credential reference first', async () => {
  const settings = liveSettings({ auth: 'bearer', tokenRef: 'ARYASEARCH_TOKEN', token: 'literal' })
  const headers = await authHeaders(settings, async () => 'from-store')
  assert.equal(headers.authorization, 'Bearer from-store')
  const fallback = await authHeaders(settings, async () => undefined)
  assert.equal(fallback.authorization, 'Bearer literal')
})

test('SearXNG results map to the seam shape, deduped', () => {
  const mapped = mapSearchResponse({
    results: [
      { url: 'https://a.example', title: 'A &amp; B', content: '  first\n  line  ', publishedDate: '2026-01-02T03:04:05', engine: 'brave' },
      { url: 'https://a.example', title: 'duplicate', content: 'x', engine: 'brave' },
      { url: 'https://b.example', title: 'B', content: '', engine: 'google cse' },
      { title: 'no url' },
    ],
    answers: [{ answer: '42' }],
    unresponsive_engines: [['duckduckgo', 'CAPTCHA']],
  })
  assert.equal(mapped.result.sources.length, 2)
  assert.deepEqual(mapped.result.sources[0], {
    url: 'https://a.example',
    title: 'A & B',
    snippet: 'first line',
    publishedAt: '2026-01-02T03:04:05',
  })
  assert.equal(mapped.result.sources[1].snippet, undefined)
  assert.equal(mapped.result.content, '42')
  assert.equal(mapped.result.truncated, false)
  assert.deepEqual(mapped.diagnostics.engines.sort(), ['brave', 'google cse'])
  assert.deepEqual(mapped.diagnostics.unresponsive, [{ engine: 'duckduckgo', reason: 'CAPTCHA' }])
})

test('a search returns sources and diagnostics', async () => {
  const { impl, calls } = fakeFetch(() => jsonResponse({ results: [{ url: 'https://a.example', title: 'A', content: 'hello', engine: 'brave' }] }))
  const outcome = await runSearch({ settings: liveSettings(), request: { query: 'arya' }, fetchImpl: impl })
  assert.equal(outcome.result.sources.length, 1)
  assert.equal(outcome.diagnostics.engines[0], 'brave')
  assert.equal(calls[0].init.redirect, 'manual')
  assert.equal(new URL(calls[0].url).searchParams.get('q'), 'arya')
})

test('a bang redirect becomes one source at the destination', async () => {
  const { impl } = fakeFetch(() => new Response('', { status: 302, headers: { location: 'https://en.wikipedia.org/wiki/SearXNG' } }))
  const outcome = await runSearch({ settings: liveSettings(), request: { query: '!wikipedia searxng' }, fetchImpl: impl })
  assert.equal(outcome.result.sources.length, 1)
  assert.equal(outcome.result.sources[0].url, 'https://en.wikipedia.org/wiki/SearXNG')
})

test('the JSON-format mistake is named, not guessed at', async () => {
  const html = fakeFetch(() => new Response('<html>nope</html>', { status: 403, headers: { 'content-type': 'text/html' } }))
  await assert.rejects(
    runSearch({ settings: liveSettings(), request: { query: 'x' }, fetchImpl: html.impl }),
    error => error instanceof AryaSearchError && /json/u.test(error.message) && /format/u.test(error.message),
  )
})

test('a 200 with an HTML body is a format error', async () => {
  const wrong = fakeFetch(() => new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } }))
  await assert.rejects(
    runSearch({ settings: liveSettings(), request: { query: 'x' }, fetchImpl: wrong.impl }),
    error => /instead of JSON/u.test(error.message),
  )
})

test('an unreachable host says which URL failed', async () => {
  const down = fakeFetch(() => {
    throw new Error('getaddrinfo ENOTFOUND search.example.ts.net')
  })
  await assert.rejects(
    runSearch({ settings: liveSettings(), request: { query: 'x' }, fetchImpl: down.impl }),
    error => /could not be reached/u.test(error.message) && /ENOTFOUND/u.test(error.message),
  )
})

test('a timeout is reported as a timeout', async () => {
  const slow = async (_url, init) => {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 5000)
      init.signal.addEventListener('abort', () => {
        clearTimeout(timer)
        reject(new DOMException('aborted', 'AbortError'))
      })
    })
    return jsonResponse({ results: [] })
  }
  const settings = normalizeSettings({ baseURL: 'https://x', timeoutMs: 2000 }).settings
  await assert.rejects(
    runSearch({ settings, request: { query: 'x' }, fetchImpl: slow }),
    error => /did not answer within 2s/u.test(error.message),
  )
})

test('a cancelled search reports cancellation', async () => {
  const controller = new AbortController()
  const slow = async (_url, init) => {
    if (init.signal.aborted) throw new DOMException('aborted', 'AbortError')
    await new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    })
    return jsonResponse({ results: [] })
  }
  const promise = runSearch({ settings: liveSettings(), request: { query: 'x' }, fetchImpl: slow, signal: controller.signal })
  controller.abort()
  await assert.rejects(promise, error => error.code === 'WEB_ABORTED')
})

test('an unconfigured provider never makes a request', async () => {
  const { impl, calls } = fakeFetch(() => jsonResponse({ results: [] }))
  const provider = createAryaSearchProvider({ getSettings: () => defaultSettings(), fetchImpl: impl })
  assert.equal(provider.id, ARYASEARCH_PROVIDER_ID)
  assert.equal(provider.available(), false)
  assert.equal(provider.ready(), false)
  await assert.rejects(provider.search({ query: 'x' }), error => /no base URL/u.test(error.message))
  assert.equal(calls.length, 0)
})

test('a configured provider is ready and searches', async () => {
  const { impl } = fakeFetch(() => jsonResponse({ results: [{ url: 'https://a.example', title: 'A' }] }))
  const provider = createAryaSearchProvider({ getSettings: () => liveSettings(), fetchImpl: impl })
  assert.equal(provider.available(), true)
  assert.equal(provider.ready('local-library'), true)
  const result = await provider.search({ query: 'arya' })
  assert.equal(result.sources[0].url, 'https://a.example')
})

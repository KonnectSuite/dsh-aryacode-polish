/**
 * Estimated session cost, priced from recorded provider usage.
 *
 * The Host half registers one durable projection: the fold replays
 * model-attributed token usage from the session log, and the wire view prices
 * it at the published DeepSeek rates. The browser half only formats numbers,
 * so no rate table and no money arithmetic live in the bundle.
 */
import { z } from 'zod'
import { applyModelUsage, initialModelUsage } from './usage.js'

/**
 * Off-peak price per million tokens. Peak is twice this. `usd` is the English
 * price page and `cny` the Chinese one; cache writes are billed as misses.
 *
 * Verified 2026-10-27 against both pages:
 * https://api-docs.deepseek.com/quick_start/pricing/
 * https://api-docs.deepseek.com/zh-cn/quick_start/pricing
 * `test/cost.spec.mjs` pins all twelve numbers so an edit cannot drift silently.
 */
const OFF_PEAK = {
  flash: {
    usd: { cache: '0.003', miss: '0.15', output: '0.6' },
    cny: { cache: '0.02', miss: '1', output: '4' },
  },
  pro: {
    usd: { cache: '0.022', miss: '0.66', output: '1.98' },
    cny: { cache: '0.15', miss: '4.5', output: '13.5' },
  },
}

/**
 * Days the table above describes. Append a new period when prices change; the
 * fold stamps each row with the hour its usage landed in.
 */
const RATE_PERIODS = [{ from: Date.parse('2026-09-10T04:00:00Z'), until: Infinity, rates: OFF_PEAK }]

/** Providers whose prices this table describes. */
const PRICED_PROVIDERS = ['deepseek-official', 'deepseek-account']

/** Models that bill at the flash rate. */
const FLASH_MODELS = ['deepseek-flash', 'deepseek-v4-flash', 'deepseek-v4-flash-vision-exp']

/** Models that bill at the pro rate. */
const PRO_MODELS = ['deepseek-v4-pro']

const bucketsSchema = z.object({
  uncachedInputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cacheReadTokens: z.number().int().nonnegative(),
  cacheWriteTokens: z.number().int().nonnegative(),
}).strict()

const rowSchema = z.object({
  provider: z.string(),
  model: z.string(),
  requests: z.number().int().nonnegative(),
  hour: z.number().int().nonnegative(),
  peak: bucketsSchema,
  offPeak: bucketsSchema,
}).strict()

const viewSchema = z.object({ models: z.array(rowSchema) }).strict()

const lastSchema = z.object({
  turn: z.number().int().nonnegative(),
  step: z.number().int().nonnegative(),
  key: z.string(),
  peak: z.boolean(),
  buckets: bucketsSchema,
}).strict()

const stateSchema = z.object({
  rows: z.record(z.string(), rowSchema),
  pending: z.object({ provider: z.string(), model: z.string() }).strict().nullable(),
  last: lastSchema.nullable(),
  view: viewSchema,
}).strict()

/** One priced model row: tokens, requests, and money when a rate is known. */
const pricedModelSchema = z.object({
  provider: z.string(),
  model: z.string(),
  requests: z.number().int().nonnegative(),
  cacheRead: z.number().int().nonnegative(),
  uncached: z.number().int().nonnegative(),
  cacheWrite: z.number().int().nonnegative(),
  output: z.number().int().nonnegative(),
  incomplete: z.boolean(),
  costCny: z.string().optional(),
  costUsd: z.string().optional(),
}).strict()

/** The wire view: session totals plus one row per model. */
const pricedSessionSchema = z.object({
  tokens: z.number().int().nonnegative(),
  cacheRead: z.number().int().nonnegative(),
  uncached: z.number().int().nonnegative(),
  cacheWrite: z.number().int().nonnegative(),
  output: z.number().int().nonnegative(),
  requests: z.number().int().nonnegative(),
  incomplete: z.boolean(),
  models: z.array(pricedModelSchema),
  costCny: z.string().optional(),
  costUsd: z.string().optional(),
}).strict()

/**
 * @param {string} provider - routed provider id.
 * @param {string} model - routed model id.
 * @param {number} time - event time in milliseconds.
 * @returns {object | undefined} the rate table for that route, when one is known.
 */
export function rateTable(provider, model, time) {
  if (!PRICED_PROVIDERS.includes(provider)) return undefined
  const kind = PRO_MODELS.includes(model) ? 'pro' : FLASH_MODELS.includes(model) ? 'flash' : undefined
  if (kind === undefined) return undefined
  const period = RATE_PERIODS.find(candidate => time >= candidate.from && time < candidate.until)
  return period === undefined ? undefined : period.rates[kind]
}

/**
 * @param {number} tokens - tokens billed at that rate.
 * @param {string} perMillion - published price per million tokens.
 * @param {boolean} peak - whether to double the price.
 * @returns {number} money for those tokens.
 */
function price(tokens, perMillion, peak) {
  const rate = Number(perMillion)
  return (peak ? rate * 2 : rate) * tokens / 1_000_000
}

/**
 * @param {object} band - one band's four counts.
 * @returns {object} the same counts under the names the surface shows.
 */
function bandTokens(band) {
  return {
    cacheRead: band.cacheReadTokens,
    uncached: band.uncachedInputTokens,
    cacheWrite: band.cacheWriteTokens,
    output: band.outputTokens,
  }
}

/**
 * @param {object} row - one usage row.
 * @returns {object} both bands added up.
 */
function addCounts(row) {
  const peak = bandTokens(row.peak)
  const off = bandTokens(row.offPeak)
  return {
    cacheRead: peak.cacheRead + off.cacheRead,
    uncached: peak.uncached + off.uncached,
    cacheWrite: peak.cacheWrite + off.cacheWrite,
    output: peak.output + off.output,
  }
}

/**
 * @param {object} band - one band's four counts.
 * @param {object} table - rate table for the route.
 * @param {boolean} peak - whether that band is billed as peak.
 * @returns {{ cny: number, usd: number }} money for that band.
 */
function priceBand(band, table, peak) {
  // Cache writes are a disjoint input bucket; DeepSeek bills them with misses.
  const input = band.uncachedInputTokens + band.cacheWriteTokens
  return {
    cny: price(band.cacheReadTokens, table.cny.cache, peak)
      + price(input, table.cny.miss, peak)
      + price(band.outputTokens, table.cny.output, peak),
    usd: price(band.cacheReadTokens, table.usd.cache, peak)
      + price(input, table.usd.miss, peak)
      + price(band.outputTokens, table.usd.output, peak),
  }
}

/** The priced view of a session that has recorded nothing yet. */
const EMPTY_PRICED = {
  tokens: 0, cacheRead: 0, uncached: 0, cacheWrite: 0, output: 0, requests: 0, incomplete: false, models: [],
}

/**
 * Price the durable model projection at the published DeepSeek rates.
 * Unknown providers, models, or periods keep their tokens and mark the subtotal
 * incomplete, so the surface never reports money it cannot stand behind.
 * @param {object} usage - the projection's raw view.
 * @returns {object} token totals, money for priced models, and one row per model.
 */
export function priceModelUsage(usage) {
  if (usage === undefined || !Array.isArray(usage.models) || usage.models.length === 0) return EMPTY_PRICED
  let cacheRead = 0
  let uncached = 0
  let cacheWrite = 0
  let output = 0
  let requests = 0
  let cny = 0
  let usd = 0
  let priced = false
  let incomplete = false
  const grouped = new Map()
  for (const row of usage.models) {
    const counts = addCounts(row)
    cacheRead += counts.cacheRead
    uncached += counts.uncached
    cacheWrite += counts.cacheWrite
    output += counts.output
    requests += row.requests
    const table = rateTable(row.provider, row.model, row.hour * 3_600_000)
    let costs
    if (table !== undefined) {
      const peakCost = priceBand(row.peak, table, true)
      const offCost = priceBand(row.offPeak, table, false)
      costs = { cny: peakCost.cny + offCost.cny, usd: peakCost.usd + offCost.usd }
    }
    if (costs === undefined) incomplete = true
    else {
      cny += costs.cny
      usd += costs.usd
      priced = true
    }
    const key = JSON.stringify([row.provider, row.model])
    const previous = grouped.get(key)
    const merged = {
      provider: row.provider,
      model: row.model,
      requests: row.requests + (previous?.requests ?? 0),
      cacheRead: counts.cacheRead + (previous?.cacheRead ?? 0),
      uncached: counts.uncached + (previous?.uncached ?? 0),
      cacheWrite: counts.cacheWrite + (previous?.cacheWrite ?? 0),
      output: counts.output + (previous?.output ?? 0),
      incomplete: costs === undefined || previous?.incomplete === true,
    }
    if (costs !== undefined || previous?.costUsd !== undefined) {
      merged.costCny = ((costs?.cny ?? 0) + Number(previous?.costCny ?? 0)).toFixed(8)
      merged.costUsd = ((costs?.usd ?? 0) + Number(previous?.costUsd ?? 0)).toFixed(8)
    }
    grouped.set(key, merged)
  }
  return {
    tokens: cacheRead + uncached + cacheWrite + output,
    cacheRead,
    uncached,
    cacheWrite,
    output,
    requests,
    incomplete,
    models: [...grouped.values()],
    ...priced ? { costCny: cny.toFixed(8), costUsd: usd.toFixed(8) } : {},
  }
}

/**
 * The durable unit this feature registers. The fold is `entries/usage.js`; the
 * wire view is its priced shape, so the browser half receives money, not rates.
 */
export const costProjection = {
  key: 'polishCost',
  stateVersion: 1,
  stateSchema,
  init: initialModelUsage,
  apply: applyModelUsage,
  wire: { viewSchema: pricedSessionSchema, view: state => priceModelUsage(state.view) },
}

/**
 * Mount the host half of the cost surface.
 * @param {object} ctx - the feature's own cordis context; its effects release the registration.
 * @returns {Promise<void>} resolves once the projection is registered.
 */
export async function mountCost(ctx) {
  const projections = ctx.get('sessionProjections')
  if (projections === undefined) return
  await projections.register(costProjection)
}

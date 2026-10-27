import assert from 'node:assert/strict'
import { test } from 'node:test'
import { deriveModelUsage, isBeijingPeak } from '../entries/usage.js'
import { costProjection, priceModelUsage, rateTable } from '../entries/cost.js'

/** A Tuesday 10:00 in Asia/Shanghai: a billed peak hour. */
const PEAK = Date.parse('2026-10-27T02:00:00Z')
/** The same Tuesday 08:00 in Asia/Shanghai: off-peak. */
const OFF_PEAK = Date.parse('2026-10-27T00:00:00Z')
/** A Sunday 10:00 in Asia/Shanghai: off-peak all day. */
const SUNDAY = Date.parse('2026-10-25T02:00:00Z')

/**
 * @param usage - provider usage for one assistant message.
 * @param time - event time.
 * @param overrides - fields to override on the message source.
 * @returns a durable assistant message event.
 */
function message(usage, time = OFF_PEAK, overrides = {}) {
  const provider = overrides.provider ?? 'deepseek-account'
  const model = overrides.model ?? 'deepseek-flash'
  return {
    type: 'assistant/message',
    time,
    data: {
      turn: overrides.turn ?? 0,
      step: overrides.step ?? 0,
      message: { source: { provider, model } },
      usage,
    },
  }
}

test('peak hours are Beijing weekdays 09-12 and 14-18', () => {
  assert.equal(isBeijingPeak(PEAK), true)
  assert.equal(isBeijingPeak(OFF_PEAK), false)
  assert.equal(isBeijingPeak(SUNDAY), false)
  assert.equal(isBeijingPeak(Date.parse('2026-10-27T08:00:00Z')), true)
  assert.equal(isBeijingPeak(Date.parse('2026-10-27T10:00:00Z')), false)
})

test('a Chinese statutory holiday is off-peak even on a weekday', () => {
  // 2026 National Day runs Oct 1 (Thu) - Oct 7 (Wed). Both instants below are
  // 10:30 in Beijing on a Thursday or Friday, i.e. inside the peak window; only
  // the holiday one is billed off-peak. Getting this wrong doubles the estimate.
  assert.equal(isBeijingPeak(Date.parse('2026-10-02T02:30:00Z')), false, 'Oct 2 is a holiday')
  assert.equal(isBeijingPeak(Date.parse('2026-10-08T02:30:00Z')), true, 'Oct 8 is an ordinary Thursday')
  // Spring Festival 2026 covers Feb 15 - Feb 23; Feb 24 is ordinary again.
  assert.equal(isBeijingPeak(Date.parse('2026-02-18T02:30:00Z')), false, 'Spring Festival')
  assert.equal(isBeijingPeak(Date.parse('2026-02-24T02:30:00Z')), true, 'the day after')
})

test('the fold attributes usage to the model that reported it', () => {
  const view = deriveModelUsage([message({ inputTokens: 1000, outputTokens: 500, cacheReadTokens: 2000 })])
  assert.equal(view.models.length, 1)
  assert.equal(view.models[0].provider, 'deepseek-account')
  assert.equal(view.models[0].model, 'deepseek-flash')
  assert.equal(view.models[0].requests, 1)
  assert.equal(view.models[0].offPeak.uncachedInputTokens, 1000)
  assert.equal(view.models[0].offPeak.cacheReadTokens, 2000)
  assert.equal(view.models[0].offPeak.outputTokens, 500)
})

test('a retried step keeps both attempts, because the failed one was billed too', () => {
  const first = message({ inputTokens: 1000, outputTokens: 0 })
  const retry = { type: 'llm/retry-started', time: OFF_PEAK, data: { turn: 0, step: 0 } }
  const again = message({ inputTokens: 2000, outputTokens: 0 })
  const view = deriveModelUsage([first, retry, again])
  assert.equal(view.models[0].requests, 2)
  assert.equal(view.models[0].offPeak.uncachedInputTokens, 3000)
})

test('a repeated sample for the same turn and step replaces the earlier one', () => {
  const view = deriveModelUsage([
    message({ inputTokens: 1000, outputTokens: 0 }),
    message({ inputTokens: 4000, outputTokens: 0 }),
  ])
  assert.equal(view.models[0].requests, 1)
  assert.equal(view.models[0].offPeak.uncachedInputTokens, 4000)
})

test('the request header supplies the route when a message names none', () => {
  const header = {
    type: 'request/header',
    time: OFF_PEAK,
    data: { header: { config: { provider: 'deepseek-account', model: 'deepseek-v4-pro' } } },
  }
  const event = message({ inputTokens: 1000, outputTokens: 0 })
  delete event.data.message.source
  const view = deriveModelUsage([header, event])
  assert.equal(view.models[0].model, 'deepseek-v4-pro')
})

test('off-peak flash bills uncached input at the miss rate', () => {
  const priced = priceModelUsage(deriveModelUsage([
    message({ inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0 }),
  ]))
  assert.equal(priced.costUsd, '0.15000000')
  assert.equal(priced.incomplete, false)
})

test('peak doubles the price of the same tokens', () => {
  const priced = priceModelUsage(deriveModelUsage([
    message({ inputTokens: 1_000_000, outputTokens: 0 }, PEAK),
  ]))
  assert.equal(priced.costUsd, '0.30000000')
})

test('cached input bills at the cache rate and cache writes bill as misses', () => {
  const priced = priceModelUsage(deriveModelUsage([
    message({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 1_000_000, cacheWriteTokens: 1_000_000 }),
  ]))
  // cache 0.003 + miss 0.15 for the write
  assert.equal(priced.costUsd, '0.15300000')
})

test('an unknown model keeps its tokens and marks the estimate incomplete', () => {
  const priced = priceModelUsage(deriveModelUsage([
    message({ inputTokens: 1000, outputTokens: 100 }, OFF_PEAK, { model: 'some-other-model' }),
  ]))
  assert.equal(priced.tokens, 1100)
  assert.equal(priced.incomplete, true)
  assert.equal(priced.costUsd, undefined)
})

test('an unpriced provider leaves the session unpriced rather than free', () => {
  const priced = priceModelUsage(deriveModelUsage([
    message({ inputTokens: 1000, outputTokens: 0 }, OFF_PEAK, { provider: 'someone-else' }),
  ]))
  assert.equal(priced.incomplete, true)
  assert.equal(priced.costUsd, undefined)
})

test('two hours of one model are grouped into a single row', () => {
  const priced = priceModelUsage(deriveModelUsage([
    message({ inputTokens: 1000, outputTokens: 0 }, OFF_PEAK, { turn: 0 }),
    message({ inputTokens: 1000, outputTokens: 0 }, PEAK, { turn: 1 }),
  ]))
  assert.equal(priced.models.length, 1)
  assert.equal(priced.models[0].requests, 2)
  assert.equal(priced.requests, 2)
})

test('the wire view is the priced shape and prices no empty session', () => {
  assert.equal(costProjection.key, 'polishCost')
  assert.equal(costProjection.stateVersion, 1)
  const empty = costProjection.wire.view(costProjection.init())
  assert.equal(empty.tokens, 0)
  assert.equal(empty.costUsd, undefined)
  assert.deepEqual(empty.models, [])
})

test('rate tables are keyed by provider, model, and the period the usage landed in', () => {
  assert.equal(rateTable('deepseek-account', 'deepseek-flash', OFF_PEAK).usd.miss, '0.15')
  assert.equal(rateTable('deepseek-official', 'deepseek-v4-pro', OFF_PEAK).cny.miss, '4.5')
  assert.equal(rateTable('deepseek-account', 'deepseek-flash', Date.parse('2020-01-01T00:00:00Z')), undefined)
  assert.equal(rateTable('nobody', 'deepseek-flash', OFF_PEAK), undefined)
})

test('every published rate is exactly what the price pages say', () => {
  // Pinned against both pages on 2026-10-27:
  //   https://api-docs.deepseek.com/quick_start/pricing/          (usd)
  //   https://api-docs.deepseek.com/zh-cn/quick_start/pricing     (cny)
  // Off-peak, per million tokens. Peak is twice these, which the pricing tests
  // above already exercise. If DeepSeek changes a price, append a period in
  // `RATE_PERIODS` and update this table — never edit history silently.
  const published = {
    'deepseek-flash': { usd: { cache: '0.003', miss: '0.15', output: '0.6' }, cny: { cache: '0.02', miss: '1', output: '4' } },
    'deepseek-v4-pro': { usd: { cache: '0.022', miss: '0.66', output: '1.98' }, cny: { cache: '0.15', miss: '4.5', output: '13.5' } },
  }
  for (const [model, expected] of Object.entries(published)) {
    assert.deepEqual(rateTable('deepseek-account', model, OFF_PEAK), expected, `${model} drifted from the published rates`)
  }
  // The legacy Flash names are still billed at the Flash price, per the same page.
  for (const legacy of ['deepseek-v4-flash', 'deepseek-v4-flash-vision-exp']) {
    assert.deepEqual(rateTable('deepseek-official', legacy, OFF_PEAK), published['deepseek-flash'], `${legacy} must bill as Flash`)
  }
})

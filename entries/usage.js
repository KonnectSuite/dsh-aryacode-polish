/**
 * Model-attributed provider usage, replayed from the durable session log.
 *
 * The Host keeps this fold so the browser half never has to read the event
 * window itself: the projection's wire view carries everything the cost
 * surface shows.
 */

/** The empty wire view handed to a session with no usage yet. */
const EMPTY_VIEW = { models: [] }

/** One empty token band. */
function zero() {
  return { uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }
}

/**
 * Chinese statutory public holidays, as Beijing calendar dates.
 *
 * DeepSeek bills peak hours at twice the off-peak rate, and its rule is "Beijing
 * time, Monday to Friday (excluding Chinese statutory public holidays) 09:00-12:00
 * and 14:00-18:00"; weekends and holidays are off-peak all day. A weekday holiday
 * that is not listed here would be priced at peak and overstate the estimate, so
 * this list is dated data like the rate table: append the next year's notice, do
 * not edit history.
 *
 * 2026: General Office of the State Council, Guo Ban Fa Ming Dian [2025] No. 7
 * (2025-11-04),
 * https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm
 *
 * Designated make-up working days stay off-peak: the published rule names
 * Monday through Friday, so a working Saturday is still a Saturday.
 */
const CHINA_HOLIDAYS = new Set([
  // New Year 2026: Jan 1 (Thu) - Jan 3 (Sat)
  '2026-01-01', '2026-01-02', '2026-01-03',
  // Spring Festival: Feb 15 (Sun) - Feb 23 (Mon)
  '2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19',
  '2026-02-20', '2026-02-21', '2026-02-22', '2026-02-23',
  // Qingming: Apr 4 (Sat) - Apr 6 (Mon)
  '2026-04-04', '2026-04-05', '2026-04-06',
  // Labour Day: May 1 (Fri) - May 5 (Tue)
  '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05',
  // Dragon Boat: Jun 19 (Fri) - Jun 21 (Sun)
  '2026-06-19', '2026-06-20', '2026-06-21',
  // Mid-Autumn: Sep 25 (Fri) - Sep 27 (Sun)
  '2026-09-25', '2026-09-26', '2026-09-27',
  // National Day: Oct 1 (Thu) - Oct 7 (Wed)
  '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
  '2026-10-05', '2026-10-06', '2026-10-07',
])

/**
 * Beijing peak is weekdays 09:00-12:00 and 14:00-18:00, minus Chinese statutory
 * public holidays; weekends are off-peak all day. DeepSeek bills peak hours at
 * twice the off-peak rate.
 * @param {number} time - event time in milliseconds.
 * @returns {boolean} whether that instant is a billed peak instant.
 */
export function isBeijingPeak(time) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date(time))
  const part = type => parts.find(entry => entry.type === type)?.value
  const weekday = part('weekday')
  const hour = Number(part('hour'))
  if (weekday === 'Sat' || weekday === 'Sun' || !Number.isInteger(hour)) return false
  const date = `${part('year')}-${part('month')}-${part('day')}`
  if (CHINA_HOLIDAYS.has(date)) return false
  return (hour >= 9 && hour < 12) || (hour >= 14 && hour < 18)
}

/** @returns {boolean} whether the value is a usable non-negative integer count. */
function isCount(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

/**
 * @param {object} usage - provider-reported usage for one call.
 * @returns {object | undefined} the four disjoint buckets, or undefined when the sample is unusable.
 */
function bucketsFrom(usage) {
  if (!isCount(usage.inputTokens) || !isCount(usage.outputTokens)) return undefined
  if (usage.cacheReadTokens !== undefined && !isCount(usage.cacheReadTokens)) return undefined
  if (usage.cacheWriteTokens !== undefined && !isCount(usage.cacheWriteTokens)) return undefined
  return {
    uncachedInputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheReadTokens: usage.cacheReadTokens ?? 0,
    cacheWriteTokens: usage.cacheWriteTokens ?? 0,
  }
}

/**
 * @param {object} left - first band.
 * @param {object} right - second band.
 * @returns {boolean} whether the two bands hold the same four counts.
 */
function bucketsEqual(left, right) {
  return left.uncachedInputTokens === right.uncachedInputTokens
    && left.outputTokens === right.outputTokens
    && left.cacheReadTokens === right.cacheReadTokens
    && left.cacheWriteTokens === right.cacheWriteTokens
}

/**
 * The last raw stream chunk of one type, scanning backwards.
 * @param {readonly object[]} stream - compact records from one durable settlement.
 * @param {string} type - chunk type that only appears as a raw record.
 * @returns {object | undefined} the stream's final chunk of that type.
 */
function lastChunk(stream, type) {
  if (!Array.isArray(stream)) return undefined
  for (let index = stream.length - 1; index >= 0; index -= 1) {
    const record = stream[index]
    if (record?.type === 'chunk' && record.chunk?.type === type) return record.chunk
  }
  return undefined
}

/**
 * @param {object} event - one durable session event.
 * @returns {object | undefined} the provider usage reported by that event.
 */
function usageOf(event) {
  if (event.type === 'assistant/message' && event.data?.usage !== undefined) return event.data.usage
  if (event.type !== 'assistant/message' && event.type !== 'assistant/attempt') return undefined
  return lastChunk(event.data?.stream, 'usage')?.usage
}

/**
 * @param {object} route - provider and model.
 * @param {number} hour - UTC hour bucket.
 * @returns {string} the row key for one route in one hour.
 */
function routeKey(route, hour) {
  return JSON.stringify([route.provider, route.model, hour])
}

/**
 * @param {object} event - one durable session event.
 * @param {object | null} pending - route carried over from the request header.
 * @returns {object} the route that produced this sample.
 */
function routeOf(event, pending) {
  if (event.type === 'assistant/message') {
    const source = event.data?.message?.source
    if (typeof source?.provider === 'string' && source.provider.length > 0
      && typeof source?.model === 'string' && source.model.length > 0) {
      return { provider: source.provider, model: source.model }
    }
  }
  return pending ?? { provider: '', model: '' }
}

/**
 * @param {object} event - one `request/header` event.
 * @returns {object | undefined} the routed provider and model, when both are named.
 */
function headerRoute(event) {
  const config = event.data?.header?.config
  const provider = config?.provider
  const model = config?.model
  if (typeof provider !== 'string' || typeof model !== 'string') return undefined
  if (provider.length === 0 || model.length === 0) return undefined
  return { provider, model }
}

/**
 * @param {object} row - one usage row.
 * @returns {number} every bucket of both bands added up.
 */
function totalTokens(row) {
  const bands = [row.peak, row.offPeak]
  return bands.reduce((sum, band) => sum
    + band.uncachedInputTokens + band.cacheReadTokens + band.cacheWriteTokens + band.outputTokens, 0)
}

/**
 * @param {Record<string, object>} rows - usage rows by key.
 * @returns {object} the wire view: the non-empty rows, heaviest first.
 */
function viewOf(rows) {
  const models = Object.values(rows).filter(row => totalTokens(row) > 0).sort((left, right) => {
    const delta = totalTokens(right) - totalTokens(left)
    if (delta !== 0) return delta
    if (left.model === right.model && left.provider === right.provider) return left.hour - right.hour
    if (left.model === right.model) return left.provider < right.provider ? -1 : 1
    return left.model < right.model ? -1 : 1
  })
  return models.length === 0 ? EMPTY_VIEW : { models }
}

/**
 * @param {object} band - band to change.
 * @param {object} delta - counts to add or remove.
 * @param {1 | -1} sign - direction.
 * @returns {object} the changed band.
 */
function addBand(band, delta, sign) {
  return {
    uncachedInputTokens: band.uncachedInputTokens + sign * delta.uncachedInputTokens,
    outputTokens: band.outputTokens + sign * delta.outputTokens,
    cacheReadTokens: band.cacheReadTokens + sign * delta.cacheReadTokens,
    cacheWriteTokens: band.cacheWriteTokens + sign * delta.cacheWriteTokens,
  }
}

/**
 * Record one sample, replacing the sample this turn and step reported before.
 * @param {object} state - previous fold.
 * @param {object} route - provider and model that produced the sample.
 * @param {boolean} peak - whether the sample fell in a billed peak hour.
 * @param {object} buckets - the sample's four disjoint counts.
 * @param {number} turn - turn index.
 * @param {number} step - step index within the turn.
 * @param {number} hour - UTC hour bucket.
 * @returns {object} the updated fold.
 */
function withSample(state, route, peak, buckets, turn, step, hour) {
  const key = routeKey(route, hour)
  const previous = state.last !== null && state.last.turn === turn && state.last.step === step
    ? state.last
    : undefined
  if (previous !== undefined
    && previous.key === key
    && previous.peak === peak
    && bucketsEqual(previous.buckets, buckets)) return state

  const rows = { ...state.rows }
  const touch = (modelKey, bandPeak, delta, sign, requests) => {
    const current = rows[modelKey] ?? {
      provider: route.provider,
      model: route.model,
      hour,
      requests: 0,
      peak: zero(),
      offPeak: zero(),
    }
    rows[modelKey] = {
      ...current,
      requests: current.requests + requests,
      peak: bandPeak ? addBand(current.peak, delta, sign) : current.peak,
      offPeak: bandPeak ? current.offPeak : addBand(current.offPeak, delta, sign),
    }
  }

  if (previous === undefined) touch(key, peak, buckets, 1, 1)
  else {
    touch(previous.key, previous.peak, previous.buckets, -1, previous.key === key ? 0 : -1)
    touch(key, peak, buckets, 1, previous.key === key ? 0 : 1)
  }
  return {
    ...state,
    rows,
    last: { turn, step, key, peak, buckets },
    view: viewOf(rows),
  }
}

/**
 * Fold one durable event.
 * @param {object} state - previous fold.
 * @param {object} event - next durable event.
 * @returns {object} the updated fold.
 */
export function applyModelUsage(state, event) {
  if (event.type === 'request/header') {
    const route = headerRoute(event)
    if (route === undefined) return { ...state, pending: null }
    if (state.pending?.provider === route.provider && state.pending.model === route.model) return state
    return { ...state, pending: route }
  }
  if (event.type === 'llm/retry-started') {
    return state.last?.turn === event.data?.turn && state.last?.step === event.data?.step
      ? { ...state, last: null }
      : state
  }
  if (event.type !== 'assistant/message' && event.type !== 'assistant/attempt') return state
  const sample = usageOf(event)
  if (sample === undefined) return state
  const buckets = bucketsFrom(sample)
  if (buckets === undefined) return state
  return withSample(
    state, routeOf(event, state.pending), isBeijingPeak(event.time), buckets,
    event.data?.turn ?? 0, event.data?.step ?? 0, Math.floor(event.time / 3_600_000),
  )
}

/**
 * @returns {object} an empty accumulator.
 */
export function initialModelUsage() {
  return { rows: {}, pending: null, last: null, view: EMPTY_VIEW }
}

/**
 * @param {readonly object[]} events - durable events in session order.
 * @returns {object} usage grouped by provider, model, and hour.
 */
export function deriveModelUsage(events) {
  let state = initialModelUsage()
  for (const event of events) state = applyModelUsage(state, event)
  return state.view
}

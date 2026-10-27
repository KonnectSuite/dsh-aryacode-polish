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
 * Beijing peak is weekdays 09:00-12:00 and 14:00-18:00; weekends are off-peak
 * all day. DeepSeek bills peak hours at twice the off-peak rate.
 * @param {number} time - event time in milliseconds.
 * @returns {boolean} whether that instant is a billed peak instant.
 */
export function isBeijingPeak(time) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai', weekday: 'short', hour: 'numeric', hourCycle: 'h23',
  }).formatToParts(new Date(time))
  const weekday = parts.find(part => part.type === 'weekday')?.value
  const hour = Number(parts.find(part => part.type === 'hour')?.value)
  if (weekday === 'Sat' || weekday === 'Sun' || !Number.isInteger(hour)) return false
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

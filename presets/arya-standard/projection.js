/**
 * The session projection the Compaction tab reads.
 *
 * DSH folds every durable session event through a registered projection; the wire
 * half is what the browser sees through `props.useProjection('aryaStandard')`. The
 * fold keeps three things, because the tab draws three things:
 *
 *   - one card per committed checkpoint (`compaction/summary`), so the tab can
 *     show what was replaced, against which model, and what it bought;
 *   - one point per assistant response (`assistant/message` with `usage`), which
 *     is the context trajectory — the same series the provider billed, not an
 *     estimate the client makes up;
 *   - the last route (`request/context`), which is the only durable source of the
 *     context window and the model the session actually runs on.
 *
 * `compaction/start` is a lock that may never close; `compaction/end` carries the
 * failure when it does not, so the last failure is kept separately and shown
 * instead of silently disappearing.
 *
 * Summaries are trimmed on the wire — a checkpoint body can be long, and the tab
 * previews it. The series is capped and downsampled for the same reason: a long
 * session must not ship megabytes to the browser to draw one line.
 *
 * @module dsh-aryacode-polish-arya-standard-projection
 */
import { z } from 'zod'

/** The projection key the client asks for. */
export const ARYA_STANDARD_PROJECTION_KEY = 'aryaStandard'

/** Cards kept per session; older checkpoints would never fit on screen. */
const CARD_LIMIT = 40

/** Usage points kept per session, newest last. */
const SERIES_LIMIT = 400

/** Points the wire view ships; the chart draws at most this many columns. */
const SERIES_WIRE_LIMIT = 240

/** Characters of a checkpoint body the wire preview keeps. */
const PREVIEW_LIMIT = 2000

const checkpointSchema = z.object({
  id: z.string(),
  at: z.number(),
  startSeq: z.number(),
  endSeq: z.number(),
  shadowedNodes: z.number(),
  shadowedTokens: z.number(),
  provider: z.string(),
  model: z.string(),
  summary: z.string(),
  manual: z.boolean(),
}).strict()

const policySchema = z.object({
  thresholdRatio: z.number(),
  headroomTokens: z.number(),
  retainRatio: z.number(),
  maxTokens: z.number(),
  keepUserTokens: z.number(),
  auto: z.boolean(),
}).strict()

const failureSchema = z.object({
  at: z.number(),
  compactionId: z.string(),
  message: z.string(),
}).strict()

const windowSchema = z.object({
  provider: z.string(),
  model: z.string(),
  contextWindow: z.number(),
  at: z.number(),
}).strict()

const pointSchema = z.object({
  seq: z.number(),
  at: z.number(),
  input: z.number(),
  cached: z.number(),
  output: z.number(),
}).strict()

const totalsSchema = z.object({
  requests: z.number(),
  input: z.number(),
  cached: z.number(),
  output: z.number(),
}).strict()

const stateSchema = z.object({
  checkpoints: z.array(checkpointSchema),
  policy: policySchema,
  failure: failureSchema.nullable(),
  window: windowSchema.nullable(),
  series: z.array(pointSchema),
  totals: totalsSchema,
}).strict()

const cardSchema = checkpointSchema.extend({
  freedTokens: z.number(),
  truncated: z.boolean(),
  pin: z.string(),
})

const viewSchema = z.object({
  count: z.number(),
  checkpoints: z.array(cardSchema),
  policy: policySchema,
  failure: failureSchema.nullable(),
  window: windowSchema.nullable(),
  series: z.array(pointSchema),
  totals: totalsSchema,
  thresholdTokens: z.number(),
  savedTokens: z.number(),
  cacheHitRatio: z.number(),
})

/**
 * Join the text parts of a summary payload.
 * @param {unknown} summary the `summary` blocks a checkpoint carries.
 * @returns {string} the summary text.
 */
function summaryText(summary) {
  if (typeof summary === 'string') return summary
  if (!Array.isArray(summary)) return ''
  const parts = []
  for (const block of summary) {
    if (block?.type === 'text' && typeof block.text === 'string') parts.push(block.text)
  }
  return parts.join('\n')
}

/**
 * Read one usage record into a trajectory point.
 * @param {{ type: string, data?: any, time?: number, seq?: number }} event one durable session event.
 * @returns {{ seq: number, at: number, input: number, cached: number, output: number } | null}
 *   the point, or null when the event carries no usable usage.
 */
function usagePoint(event) {
  const usage = event?.data?.usage
  if (usage === null || typeof usage !== 'object') return null
  const input = Number(usage.inputTokens)
  const output = Number(usage.outputTokens)
  if (!Number.isFinite(input) || !Number.isFinite(output) || input < 0 || output < 0) return null
  const cached = Number(usage.cacheReadTokens)
  return {
    seq: typeof event.seq === 'number' ? event.seq : 0,
    at: typeof event.time === 'number' ? event.time : 0,
    input: input + (Number.isFinite(cached) && cached > 0 ? cached : 0),
    cached: Number.isFinite(cached) && cached > 0 ? cached : 0,
    output,
  }
}

/**
 * Fold one event into the state.
 * @param {object} state the current state.
 * @param {{ type: string, data?: any, time?: number, seq?: number }} event one durable session event.
 * @returns {object} the next state.
 */
function applyAryaStandard(state, event) {
  const type = event?.type
  const data = event?.data
  const at = typeof event?.time === 'number' ? event.time : 0

  if (type === 'request/context' && data !== null && typeof data === 'object') {
    const contextWindow = Number(data.contextWindow)
    if (!Number.isFinite(contextWindow) || contextWindow <= 0) return state
    return {
      ...state,
      window: {
        provider: typeof data.provider === 'string' ? data.provider : '',
        model: typeof data.model === 'string' ? data.model : '',
        contextWindow,
        at,
      },
    }
  }

  if (type === 'assistant/message') {
    const point = usagePoint(event)
    if (point === null) return state
    const series = [...state.series, point]
    const trimmed = series.length > SERIES_LIMIT ? series.slice(-SERIES_LIMIT) : series
    return {
      ...state,
      series: trimmed,
      totals: {
        requests: state.totals.requests + 1,
        input: state.totals.input + point.input,
        cached: state.totals.cached + point.cached,
        output: state.totals.output + point.output,
      },
    }
  }

  if (type === 'compaction/summary' && data !== null && typeof data === 'object') {
    const range = data.shadowedRange !== null && typeof data.shadowedRange === 'object' ? data.shadowedRange : {}
    const card = {
      id: typeof data.compactionId === 'string' ? data.compactionId : '',
      at,
      startSeq: typeof range.start === 'number' ? range.start : 0,
      endSeq: typeof range.end === 'number' ? range.end : 0,
      shadowedNodes: Array.isArray(data.shadowedSeqs) ? data.shadowedSeqs.length : 0,
      shadowedTokens: typeof data.shadowedTokenCount === 'number' ? data.shadowedTokenCount : 0,
      provider: typeof data.provider === 'string' ? data.provider : '',
      model: typeof data.model === 'string' ? data.model : '',
      summary: summaryText(data.summary),
      manual: data.sourceCommandId !== undefined,
    }
    const checkpoints = [...state.checkpoints, card].slice(-CARD_LIMIT)
    return { ...state, checkpoints, failure: null }
  }

  if (type === 'compaction/end' && data?.error !== undefined && data.error !== null) {
    const message = typeof data.error?.message === 'string'
      ? data.error.message
      : typeof data.error === 'string' ? data.error : 'compaction failed'
    const failure = {
      at,
      compactionId: typeof data.compactionId === 'string' ? data.compactionId : '',
      message,
    }
    return { ...state, failure }
  }

  return state
}

/**
 * Ship at most {@link SERIES_WIRE_LIMIT} points, keeping the first and the last.
 * @param {ReadonlyArray<object>} series the folded series.
 * @returns {Array<object>} the downsampled series.
 */
function sample(series) {
  if (series.length <= SERIES_WIRE_LIMIT) return series
  const step = (series.length - 1) / (SERIES_WIRE_LIMIT - 1)
  const out = []
  for (let index = 0; index < SERIES_WIRE_LIMIT; index += 1) out.push(series[Math.round(index * step)])
  return out
}

/**
 * Build the projection for one settings snapshot.
 * @param {{ [key: string]: boolean | number | string }} settings validated settings.
 * @returns {{ key: string, stateVersion: number, stateSchema: object, init: () => object, apply: Function, wire: { viewSchema: object, view: Function } }}
 *   a projection `ctx.get('sessionProjections').register()` accepts.
 */
export function createAryaStandardProjection(settings) {
  const policy = {
    auto: settings.auto === true,
    thresholdRatio: Number(settings.thresholdRatio),
    headroomTokens: Number(settings.headroomTokens),
    retainRatio: Number(settings.retainRatio),
    maxTokens: Number(settings.maxTokens),
    keepUserTokens: Number(settings.keepUserTokens),
  }
  return {
    key: ARYA_STANDARD_PROJECTION_KEY,
    stateVersion: 2,
    stateSchema,
    init: () => ({
      checkpoints: [],
      policy,
      failure: null,
      window: null,
      series: [],
      totals: { requests: 0, input: 0, cached: 0, output: 0 },
    }),
    apply: applyAryaStandard,
    wire: {
      viewSchema,
      view: (state) => {
        const contextWindow = state.window === null ? 0 : state.window.contextWindow
        const thresholdTokens = contextWindow > 0
          ? Math.min(
            Math.floor(contextWindow * policy.thresholdRatio),
            Math.max(0, contextWindow - policy.headroomTokens),
          )
          : 0
        const savedTokens = state.checkpoints.reduce((sum, checkpoint) => sum + checkpoint.shadowedTokens, 0)
        // `totals.input` already counts cache reads (the point folds them in), so
        // the hit ratio is cached over the whole prompt the provider billed.
        return {
          count: state.checkpoints.length,
          checkpoints: state.checkpoints.map((checkpoint) => ({
            ...checkpoint,
            freedTokens: checkpoint.shadowedTokens,
            truncated: checkpoint.summary.length > PREVIEW_LIMIT,
            pin: `${checkpoint.provider}/${checkpoint.model}`,
            summary: checkpoint.summary.length > PREVIEW_LIMIT
              ? `${checkpoint.summary.slice(0, PREVIEW_LIMIT)}…`
              : checkpoint.summary,
          })),
          policy,
          failure: state.failure,
          window: state.window,
          series: sample(state.series),
          totals: state.totals,
          thresholdTokens,
          savedTokens,
          cacheHitRatio: state.totals.input > 0 ? state.totals.cached / state.totals.input : 0,
        }
      },
    },
  }
}

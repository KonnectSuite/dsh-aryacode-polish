/**
 * The summarizer hook, driven without a Host.
 *
 * `compaction-basic` owns the trigger, the durable lock, the event transaction and
 * the shrink guard, so the only thing worth testing here is the swap it calls:
 * the request must be Codex's checkpoint prompt appended to the replayed span, and
 * the answer must be Codex's handoff framing plus the verbatim user section.
 *
 * The base class, the assembler and the stream are stubs — the real ones need a
 * Host — but the shapes they are stubbed at are the ones read out of
 * `dsh-compaction-basic` and `dsh-llm`.
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  ARYA_STANDARD_RETAINED_PREAMBLE,
  createAryaStandardCompaction,
  dropOldestTurn,
  finishError,
  resolveSummarizationTarget,
  retainedUserMessages,
  summaryTextBlocks,
} from '../presets/arya-standard/compaction.js'
import { ARYA_STANDARD_POLICY_FALLBACK, resolvePolicy } from '../presets/arya-standard/policy.js'

const PROMPT = 'You are performing a CONTEXT CHECKPOINT COMPACTION. Create a handoff summary for another LLM that will resume the task.'
const PREFIX = 'Another language model started to solve this problem and produced a summary of its thinking process.'
const OVERFLOW = 'CONTEXT_WINDOW_EXCEEDED'

class StubLlmError extends Error {
  constructor(message, code, details) {
    super(message)
    this.name = 'LlmError'
    this.code = code
    this.details = details
  }
}

/** A base class with the two fields the subclass touches. */
class StubBase {
  constructor(ctx, config) {
    this.ctx = ctx
    this.config = config
  }
}

/**
 * Build the kit and the fake stream for one test.
 * @param {{ blocks?: unknown[], finish?: object, usage?: object, onRequest?: (request: object) => void }} state
 *   what the fake stream produces.
 * @returns {{ kit: object, requests: object[], ctx: object }} the dependencies and the calls made.
 */
function makeKit(state = {}) {
  const requests = []
  class StubAssembler {
    constructor() {
      this.finish = state.finish
      this.usage = state.usage
    }

    push() {}

    blocks() {
      return state.blocks ?? [{ type: 'text', text: 'the checkpoint body' }]
    }
  }
  const kit = {
    BlockAssembler: StubAssembler,
    LlmError: StubLlmError,
    contentHasImage: (blocks) => Array.isArray(blocks) && blocks.some((block) => block?.type === 'image'),
    deepFreeze: (value) => value,
    checkpointPrompt: PROMPT,
    summaryPrefix: PREFIX,
    contextWindowExceededCode: OVERFLOW,
  }
  const ctx = {
    llm: {
      // Same shape as `ctx.llm.stream`: an async iterable of chunks. A queued
      // failure is thrown from the first `next()`, which is where a provider's
      // context-window refusal surfaces.
      stream(request) {
        requests.push(request)
        state.onRequest?.(request)
        const failure = state.failures?.shift()
        return (async function* chunks() {
          if (failure !== undefined) throw failure
          yield { kind: 'text' }
        })()
      },
    },
    // The policy service, as the real row provides it. Tests drive retention and
    // the checkpoint instruction through here, never through the engine config.
    get(name) {
      return name === 'aryaStandardPolicy' ? (state.policy ?? ARYA_STANDARD_POLICY_FALLBACK) : undefined
    },
    waterfall: async (name, payload, fallback) => fallback(),
  }
  return { kit, requests, ctx }
}

/**
 * Build the agent handle `summarize()` receives.
 * @param {object} [overrides] fields to override.
 * @returns {object} the agent.
 */
function makeAgent(overrides = {}) {
  return {
    session: {
      id: 'session-1',
      requestHeader: () => ({ config: { provider: 'routed-provider', model: 'routed-model' } }),
      toolHistory: () => [{ role: 'tool', content: 'a tool result' }],
    },
    options: {},
    ...overrides,
  }
}

// Only keys `compaction-basic` itself accepts. Every Arya-only knob travels
// through the policy service, which is why this object stays this small.
const CONFIG = {
  auto: true,
  thresholdRatio: 0.9,
  headroomTokens: 16000,
  retainRatio: 0.16,
  maxTokens: 20000,
}

/** Build the engine under test. */
function engineOf(state) {
  const { kit, requests, ctx } = makeKit(state)
  const Engine = createAryaStandardCompaction(StubBase, kit)
  return { engine: new Engine(ctx, { ...CONFIG }), requests, kit, ctx }
}

/** A long user message, so the retained budget has something to keep. */
function longUser(index) {
  return { role: 'user', content: [{ type: 'text', text: `message ${index} ` + 'detail '.repeat(60) }] }
}

test('the checkpoint prompt is the last message and the call is purpose-tagged', async () => {
  const { engine, requests } = engineOf()
  const messages = [...manyUsers(), { role: 'assistant', content: [{ type: 'text', text: 'working' }] }]
  const before = JSON.stringify(messages)
  await engine.summarize({ messages }, makeAgent(), undefined)
  assert.equal(requests.length, 1)
  const request = requests[0]
  assert.equal(request.purpose, 'compaction')
  assert.equal(request.provider, 'routed-provider')
  assert.equal(request.model, 'routed-model')
  assert.equal(request.maxTokens, 20000)
  assert.equal(request.sessionId, 'session-1')
  assert.deepEqual(request.toolHistory, [{ role: 'tool', content: 'a tool result' }])
  assert.equal(request.messages.length, messages.length + 1)
  const last = request.messages[request.messages.length - 1]
  assert.equal(last.role, 'user')
  assert.equal(last.content[0].type, 'text')
  assert.equal(last.content[0].text, PROMPT)
  assert.equal(JSON.stringify(messages), before, 'the prepared input must not be mutated')
  assert.equal('tools' in request, false, 'no tools are sent when the input carries none')
})

test('the summary is framed with Codex’s prefix', async () => {
  const { engine } = engineOf()
  const result = await engine.summarize({ messages: manyUsers() }, makeAgent(), undefined)
  assert.equal(result.llmStreamCall, true)
  assert.equal(result.provider, 'routed-provider')
  assert.equal(result.model, 'routed-model')
  assert.equal(result.summary[0].type, 'text')
  assert.ok(result.summary[0].text.startsWith(`${PREFIX}\n`))
  assert.ok(result.summary[0].text.endsWith('the checkpoint body'))
})

test('a large replaced span carries the user’s own words', async () => {
  const { engine } = engineOf()
  const messages = []
  for (let index = 0; index < 12; index += 1) messages.push(longUser(index))
  const result = await engine.summarize({ messages }, makeAgent(), undefined)
  assert.equal(result.summary.length, 2, 'the summary plus the verbatim section')
  assert.ok(result.summary[1].text.startsWith(ARYA_STANDARD_RETAINED_PREAMBLE))
  assert.ok(result.summary[1].text.includes('message 11'), 'the newest message is quoted')
  const quoted = result.summary[1].text.split('--- user message ').length - 1
  assert.ok(quoted >= 1 && quoted <= 8, `the budget stops the walk after a few messages, got ${quoted}`)
  assert.ok(result.summary[0].text.includes('the checkpoint body'))
})

test('the verbatim section is dropped when the body already fills the checkpoint', async () => {
  // A body that eats the room leaves nothing for the user quote. The summary must
  // still commit, framed, with the section that cannot fit left out — not fail.
  const { engine } = engineOf({ blocks: [{ type: 'text', text: 'Z'.repeat(4200) }] })
  const result = await engine.summarize({ messages: manyUsers() }, makeAgent(), undefined)
  assert.equal(result.summary.length, 1, 'only the summary block fits')
  assert.ok(result.summary[0].text.startsWith(`${PREFIX}\n`))
})

test('a previous checkpoint is never re-quoted as the user’s words', async () => {
  const { engine } = engineOf()
  const previous = { role: 'user', content: [{ type: 'text', text: `${PREFIX}\nan old checkpoint ` + 'z'.repeat(800) }] }
  const messages = [previous, longUser(1), longUser(2)]
  const result = await engine.summarize({ messages }, makeAgent(), undefined)
  assert.equal(result.summary.length, 2)
  assert.equal(result.summary[1].text.includes('an old checkpoint'), false)
})

test('a stream failure becomes the base engine’s error', async () => {
  const truncation = engineOf({ finish: { kind: 'max-tokens' } })
  await assert.rejects(() => truncation.engine.summarize({ messages: [longUser(1)] }, makeAgent(), undefined), (error) => {
    assert.equal(error.code, 'MAX_TOKENS')
    assert.match(error.message, /incomplete checkpoint/)
    return true
  })
  const provider = engineOf({ finish: { kind: 'error', failure: { message: 'upstream broke', code: 'TRANSPORT' } } })
  await assert.rejects(() => provider.engine.summarize({ messages: [longUser(1)] }, makeAgent(), undefined), (error) => {
    assert.ok(error instanceof StubLlmError)
    assert.equal(error.code, 'TRANSPORT')
    return true
  })
  const aborted = engineOf({ finish: { kind: 'aborted', failure: { message: 'stopped', code: 'ABORTED' } } })
  await assert.rejects(() => aborted.engine.summarize({ messages: [longUser(1)] }, makeAgent(), undefined), /stopped/)
})

test('an image summary and an empty summary are both refused', async () => {
  const image = engineOf({ blocks: [{ type: 'image' }] })
  await assert.rejects(() => image.engine.summarize({ messages: [longUser(1)] }, makeAgent(), undefined), (error) => {
    assert.equal(error.code, 'UNSUPPORTED_CONTENT')
    return true
  })
  const empty = engineOf({ blocks: [{ type: 'text', text: '   ' }] })
  await assert.rejects(() => empty.engine.summarize({ messages: [longUser(1)] }, makeAgent(), undefined), /no text summary content/)
})

test('a summarization target is required', async () => {
  const { engine } = engineOf()
  const agent = makeAgent({
    session: {
      id: 'session-1',
      requestHeader: () => undefined,
      toolHistory: () => [],
    },
  })
  await assert.rejects(() => engine.summarize({ messages: [longUser(1)] }, agent, undefined), /no provider\/model available for summarization/)
})

test('a configured summarizer wins over the routed model', async () => {
  const { kit, ctx, requests } = makeKit()
  const Engine = createAryaStandardCompaction(StubBase, kit)
  const engine = new Engine(ctx, { ...CONFIG, summarizationProvider: 'aux-provider', summarizationModel: 'aux-model' })
  await engine.summarize({ messages: manyUsers() }, makeAgent(), undefined)
  assert.equal(requests[0].provider, 'aux-provider')
  assert.equal(requests[0].model, 'aux-model')
})

test('the factory refuses a missing base or missing vendored text', () => {
  assert.throws(() => createAryaStandardCompaction(undefined, {}), /a base engine class is required/)
  assert.throws(() => createAryaStandardCompaction(StubBase, { summaryPrefix: 'x' }), /the checkpoint prompt is missing/)
  assert.throws(() => createAryaStandardCompaction(StubBase, { checkpointPrompt: 'x' }), /the summary prefix is missing/)
  const { kit } = makeKit()
  assert.equal(typeof createAryaStandardCompaction(StubBase, kit), 'function')
})

test('a checkpoint is fitted to a small span instead of failing the shrink guard', async () => {
  // The live failure this reproduces: a model that answers in Chinese spends
  // about one token per character, so an unfitted body plus the handoff prefix
  // and the base engine's framing is larger than the span it replaces, and
  // compaction is refused with "summary is not smaller than the shadowed
  // content". The body must be cut to fit instead.
  const body = '要点'.repeat(400)
  const { engine } = engineOf({ blocks: [{ type: 'text', text: body }] })
  const messages = [{ role: 'user', content: [{ type: 'text', text: 'x'.repeat(1200) }] }]
  const result = await engine.summarize({ messages }, makeAgent(), undefined)
  const text = result.summary.map((block) => block.text).join('\n')
  const wide = ([...text].filter((character) => character.codePointAt(0) >= 0x2e80)).length
  const latin = text.length - wide
  assert.ok(text.startsWith(PREFIX), 'the handoff prefix survives the cut')
  assert.ok(wide + latin / 4 < 300 * 0.9, `the fitted checkpoint must stay under the span, got ~${Math.round(wide + latin / 4)}`)
  assert.ok(wide > 0, 'the summary body is kept, just shortened')
})

test('a span too small to hold any checkpoint is refused clearly', async () => {
  const { engine } = engineOf()
  const messages = [{ role: 'user', content: [{ type: 'text', text: 'short' }] }]
  await assert.rejects(
    () => engine.summarize({ messages }, makeAgent(), undefined),
    /the replaced span is too small for a checkpoint/,
  )
})

test('the system prompt does not inflate the span budget', async () => {
  // The replayed prefix carries the fixed system prompt, which the base engine
  // does not count as shadowed content. If this module counted it the body would
  // never be fitted and the checkpoint would be refused as "not smaller than the
  // shadowed content".
  const body = 'Z'.repeat(3600)
  const { engine } = engineOf({ blocks: [{ type: 'text', text: body }] })
  const messages = [
    { role: 'system', content: [{ type: 'text', text: 'S'.repeat(40000) }] },
    ...manyUsers(),
  ]
  const result = await engine.summarize({ messages }, makeAgent(), undefined)
  const text = result.summary.map((block) => block.text).join('\n')
  assert.ok(text.length < 6000, `the checkpoint stays span-sized, got ${text.length} chars`)
})

test('the helpers keep their documented contracts', () => {
  assert.equal(finishError(undefined, StubLlmError), undefined)
  assert.equal(finishError({ kind: 'done' }, StubLlmError), undefined)
  assert.deepEqual(summaryTextBlocks([{ type: 'text', text: 'a' }, { type: 'tool' }], () => false, StubLlmError), [{ type: 'text', text: 'a' }])
  assert.deepEqual(resolveSummarizationTarget({ summarizationProvider: '' }, makeAgent()), { provider: 'routed-provider', model: 'routed-model' })
  assert.deepEqual(resolveSummarizationTarget({}, { session: { requestHeader: () => undefined }, options: { provider: 'own', model: 'own-model' } }), { provider: 'own', model: 'own-model' })
  assert.deepEqual(retainedUserMessages([longUser(1)], 0, PREFIX), { text: '', tokens: 0 })
  assert.deepEqual(retainedUserMessages(undefined, 100, PREFIX), { text: '', tokens: 0 })
})

/** Twelve user messages, so a 20k budget still has to stop somewhere. */
function manyUsers() {
  const messages = []
  for (let index = 0; index < 12; index += 1) messages.push(longUser(index))
  return messages
}

test('the retention budget comes from the policy service, not the engine config', async () => {
  const off = engineOf({ policy: resolvePolicy({ keepUserTokens: 0 }) })
  const withoutSection = await off.engine.summarize({ messages: manyUsers() }, makeAgent(), undefined)
  assert.equal(withoutSection.summary.length, 1, 'a zero budget keeps nothing verbatim')

  const on = engineOf({ policy: resolvePolicy({ keepUserTokens: 20000 }) })
  const withSection = await on.engine.summarize({ messages: manyUsers() }, makeAgent(), undefined)
  assert.equal(withSection.summary.length, 2, 'the service budget reaches the summarizer')
  assert.ok(withSection.summary[1].text.startsWith(ARYA_STANDARD_RETAINED_PREAMBLE))
})

test('a configured checkpoint instruction replaces the vendored one', async () => {
  const { engine, requests } = engineOf({ policy: resolvePolicy({ compactPromptOverride: 'CUSTOM CHECKPOINT INSTRUCTION' }) })
  await engine.summarize({ messages: manyUsers() }, makeAgent(), undefined)
  assert.equal(requests[0].messages.at(-1).content[0].text, 'CUSTOM CHECKPOINT INSTRUCTION')
})

test('an overflowing summarization request drops the oldest turn and retries', async () => {
  const overflow = Object.assign(new Error('context window exceeded'), { code: OVERFLOW })
  const { engine, requests } = engineOf({ failures: [overflow] })
  const messages = [
    { role: 'system', content: [{ type: 'text', text: 'the system prompt' }] },
    longUser(1),
    { role: 'assistant', content: [{ type: 'text', text: 'working' }] },
    longUser(2),
    { role: 'assistant', content: [{ type: 'text', text: 'working' }] },
    longUser(3),
  ]
  const result = await engine.summarize({ messages }, makeAgent(), undefined)
  assert.equal(requests.length, 2, 'the request was retried once')
  assert.equal(requests[0].messages.length, messages.length + 1)
  assert.equal(requests[1].messages.length, messages.length - 1, 'the oldest turn left the prefix')
  assert.equal(requests[1].messages[0].role, 'system', 'the cache-warm prefix survives')
  assert.equal(result.summary[0].text.startsWith(`${PREFIX}\n`), true)
})

test('the overflow fallback is bounded and rethrows the provider failure', async () => {
  const overflow = () => Object.assign(new Error('context window exceeded'), { code: OVERFLOW })
  const { engine, requests } = engineOf({ failures: [overflow(), overflow(), overflow()], policy: resolvePolicy({ dropOldestRetries: 1 }) })
  await assert.rejects(() => engine.summarize({ messages: manyUsers() }, makeAgent(), undefined), (error) => {
    assert.equal(error.code, OVERFLOW)
    return true
  })
  assert.equal(requests.length, 2, 'one initial attempt plus one retry')
})

test('dropOldestTurn keeps the system prefix and the newest turn', () => {
  assert.equal(dropOldestTurn(undefined), null)
  assert.equal(dropOldestTurn([]), null)
  assert.equal(dropOldestTurn([{ role: 'system', content: 's' }]), null)
  const messages = [
    { role: 'system', content: 's' },
    { role: 'user', content: 'u1' },
    { role: 'assistant', content: 'a1' },
    { role: 'user', content: 'u2' },
  ]
  const shorter = dropOldestTurn(messages)
  assert.deepEqual(shorter.map((message) => message.role), ['system', 'user'])
  assert.equal(shorter[1].content, 'u2')
  assert.equal(dropOldestTurn([{ role: 'user', content: 'only' }]), null, 'never empties the request')
})

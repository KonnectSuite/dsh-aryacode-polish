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
  finishError,
  resolveSummarizationTarget,
  retainedUserMessages,
  summaryTextBlocks,
} from '../presets/arya-standard/compaction.js'

const PROMPT = 'You are performing a CONTEXT CHECKPOINT COMPACTION. Create a handoff summary for another LLM that will resume the task.'
const PREFIX = 'Another language model started to solve this problem and produced a summary of its thinking process.'

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
  }
  const ctx = {
    llm: {
      // Same shape as `ctx.llm.stream`: an async iterable of chunks.
      stream(request) {
        requests.push(request)
        state.onRequest?.(request)
        return (async function* chunks() { yield { kind: 'text' } })()
      },
    },
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

const CONFIG = {
  auto: true,
  thresholdRatio: 0.9,
  headroomTokens: 16000,
  retainRatio: 0.16,
  maxTokens: 20000,
  keepUserTokens: 20000,
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
  const messages = [longUser(1), { role: 'assistant', content: [{ type: 'text', text: 'working' }] }]
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
  const result = await engine.summarize({ messages: [longUser(1)] }, makeAgent(), undefined)
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

test('the verbatim section is dropped when it would trip the shrink guard', async () => {
  // A 30-token span against an 85-token checkpoint: the base engine would refuse
  // the summary, so the section that can go is the one that goes.
  const { engine } = engineOf({ blocks: [{ type: 'text', text: 'Z'.repeat(240) }] })
  const messages = [{ role: 'user', content: [{ type: 'text', text: 'x'.repeat(120) }] }]
  const result = await engine.summarize({ messages }, makeAgent(), undefined)
  assert.equal(result.summary.length, 1, 'a checkpoint must stay smaller than what it replaces')
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
  await engine.summarize({ messages: [longUser(1)] }, makeAgent(), undefined)
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

test('the helpers keep their documented contracts', () => {
  assert.equal(finishError(undefined, StubLlmError), undefined)
  assert.equal(finishError({ kind: 'done' }, StubLlmError), undefined)
  assert.deepEqual(summaryTextBlocks([{ type: 'text', text: 'a' }, { type: 'tool' }], () => false, StubLlmError), [{ type: 'text', text: 'a' }])
  assert.deepEqual(resolveSummarizationTarget({ summarizationProvider: '' }, makeAgent()), { provider: 'routed-provider', model: 'routed-model' })
  assert.deepEqual(resolveSummarizationTarget({}, { session: { requestHeader: () => undefined }, options: { provider: 'own', model: 'own-model' } }), { provider: 'own', model: 'own-model' })
  assert.deepEqual(retainedUserMessages([longUser(1)], 0, PREFIX), { text: '', tokens: 0 })
  assert.deepEqual(retainedUserMessages(undefined, 100, PREFIX), { text: '', tokens: 0 })
})

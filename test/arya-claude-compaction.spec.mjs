/**
 * The Claude summarizer hook, driven without a Host.
 *
 * `compaction-basic` owns the trigger, the lock, the transaction and the shrink
 * guard, so this spec drives the one seam the preset replaces: the summarization
 * request and the checkpoint it returns. The interesting Claude-specific pieces
 * are the scratchpad/envelope handling, the two-part continuation frame, the
 * recently-read-files section, the preset-private waterfall namespace, and the
 * refusal to commit a checkpoint that cannot fit.
 *
 * The base class, assembler and stream are stubs at the shapes read out of
 * `dsh-compaction-basic` and `dsh-llm`; the kit values themselves are the shipped
 * ones from `engine.js`.
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { ARYA_CLAUDE_KIT } from '../presets/arya-claude/engine.js'
import { ARYA_CLAUDE_POLICY_FALLBACK, resolveClaudePolicy } from '../presets/arya-claude/policy.js'
import { createAryaStandardCompaction } from '../presets/arya-standard/compaction.js'

class StubLlmError extends Error {
  constructor(message, code, details) {
    super(message)
    this.name = 'LlmError'
    this.code = code
    this.details = details
  }
}

/** A base class with the fields the subclass touches, including the policy name. */
class StubBase {
  constructor(ctx, config) {
    this.ctx = ctx
    this.config = config
  }

  /** The real engine's policy service name. */
  get policyService() {
    return 'aryaClaudePolicy'
  }
}

// Only keys `compaction-basic` itself accepts.
const CONFIG = {
  auto: true,
  thresholdRatio: 0.99,
  headroomTokens: 13000,
  retainRatio: 0.16,
  maxTokens: 20000,
}

/**
 * Build the stub kit, the fake stream, and the recorded waterfall names.
 * @param {{ blocks?: unknown[], finish?: object, usage?: object, policy?: object, failures?: unknown[] }} state
 *   what the fake stream produces and which policy the service returns.
 * @returns {{ kit: object, requests: object[], ctx: object, waterfalls: string[] }} the dependencies and observations.
 */
function makeKit(state = {}) {
  const requests = []
  const waterfalls = []
  class StubAssembler {
    constructor() {
      this.finish = state.finish
      this.usage = state.usage
    }

    push() {}

    blocks() {
      return state.blocks ?? [{ type: 'text', text: 'a plain checkpoint body' }]
    }
  }
  const kit = {
    ...ARYA_CLAUDE_KIT,
    BlockAssembler: StubAssembler,
    LlmError: StubLlmError,
    contentHasImage: (blocks) => Array.isArray(blocks) && blocks.some((block) => block?.type === 'image'),
    deepFreeze: (value) => value,
  }
  const ctx = {
    llm: {
      stream(request) {
        requests.push(request)
        const failure = state.failures?.shift()
        return (async function* chunks() {
          if (failure !== undefined) throw failure
          yield { kind: 'text' }
        })()
      },
    },
    get(name) {
      return name === 'aryaClaudePolicy' ? (state.policy ?? ARYA_CLAUDE_POLICY_FALLBACK) : undefined
    },
    waterfall: async (name, payload, fallback) => {
      waterfalls.push(name)
      return fallback()
    },
  }
  return { kit, requests, ctx, waterfalls }
}

/** Build the agent handle `summarize()` receives. */
function makeAgent(overrides = {}) {
  return {
    session: {
      id: 'session-claude',
      requestHeader: () => ({ config: { provider: 'routed-provider', model: 'routed-model' } }),
      toolHistory: () => [{ role: 'tool', content: 'a tool result' }],
    },
    options: {},
    ...overrides,
  }
}

/** Build the engine under test. */
function engineOf(state) {
  const { kit, requests, ctx, waterfalls } = makeKit(state)
  const Engine = createAryaStandardCompaction(StubBase, kit)
  return { engine: new Engine(ctx, { ...CONFIG }), requests, kit, ctx, waterfalls }
}

/** A span long enough to hold a checkpoint and one tool call naming a file. */
function longSpan() {
  const messages = []
  for (let index = 0; index < 30; index += 1) {
    messages.push({ role: 'user', content: [{ type: 'text', text: `request ${index} ` + 'detail '.repeat(80) }] })
  }
  messages.push({
    role: 'assistant',
    content: [
      { type: 'text', text: 'reading the file' },
      { type: 'tool-call', id: 'call-1', name: 'read', arguments: JSON.stringify({ file_path: 'C:/repo/src/app.ts' }) },
    ],
  })
  messages.push({ role: 'tool', content: [{ type: 'text', text: 'the file body' }] })
  return messages
}

test('the checkpoint instruction is the last message and the call is purpose-tagged', async () => {
  const { engine, requests } = engineOf()
  const messages = longSpan()
  const before = JSON.stringify(messages)
  await engine.summarize({ messages }, makeAgent(), undefined)
  assert.equal(requests.length, 1)
  const request = requests[0]
  assert.equal(request.purpose, 'compaction')
  assert.equal(request.provider, 'routed-provider')
  assert.equal(request.model, 'routed-model')
  assert.equal(request.sessionId, 'session-claude')
  assert.equal(request.maxTokens, 20000)
  assert.deepEqual(request.toolHistory, [{ role: 'tool', content: 'a tool result' }])
  assert.equal(JSON.stringify(messages), before, 'the prepared input must not be mutated')
  const last = request.messages[request.messages.length - 1]
  assert.equal(last.role, 'user')
  assert.ok(last.content[0].text.includes('<summary>'), 'the authored checkpoint prompt is appended')
})

test('the policy row can replace the checkpoint instruction', async () => {
  const policy = resolveClaudePolicy({ compactPromptOverride: 'CUSTOM CHECKPOINT INSTRUCTION' })
  const { engine, requests } = engineOf({ policy })
  await engine.summarize({ messages: longSpan() }, makeAgent(), undefined)
  const last = requests[0].messages[requests[0].messages.length - 1]
  assert.equal(last.content[0].text, 'CUSTOM CHECKPOINT INSTRUCTION')
})

test('the summary is framed with the continuation prefix and the resume trailer', async () => {
  const { engine } = engineOf({ blocks: [{ type: 'text', text: 'CHECKPOINT BODY' }] })
  const result = await engine.summarize({ messages: longSpan() }, makeAgent(), undefined)
  assert.equal(result.llmStreamCall, true)
  assert.equal(result.summary.length, 1, 'keepUserTokens is 0: the prompt writes the user section')
  const text = result.summary[0].text
  assert.ok(text.startsWith(ARYA_CLAUDE_KIT.summaryPrefix))
  assert.ok(text.includes('CHECKPOINT BODY'))
  assert.ok(text.trimEnd().endsWith(ARYA_CLAUDE_KIT.summarySuffix.trim()))
})

test('the analysis scratchpad is stripped and the summary envelope is unwrapped', async () => {
  const blocks = [{ type: 'text', text: '<analysis>a private draft that must not ship</analysis>\n<summary>THE REAL CHECKPOINT</summary>' }]
  const { engine } = engineOf({ blocks })
  const result = await engine.summarize({ messages: longSpan() }, makeAgent(), undefined)
  const text = result.summary[0].text
  assert.ok(text.includes('THE REAL CHECKPOINT'))
  assert.equal(text.includes('private draft'), false, 'the scratchpad never reaches the transcript')
  assert.equal(text.includes('<summary>'), false, 'the envelope tags are removed too')
  assert.equal(text.includes('</summary>'), false)
})

test('a reply without the envelope is still committed verbatim', async () => {
  const { engine } = engineOf({ blocks: [{ type: 'text', text: 'no tags, just a body' }] })
  const result = await engine.summarize({ messages: longSpan() }, makeAgent(), undefined)
  assert.ok(result.summary[0].text.includes('no tags, just a body'))
})

test('the checkpoint lists the files the replaced span touched', async () => {
  const { engine } = engineOf({ blocks: [{ type: 'text', text: 'CHECKPOINT BODY' }] })
  const result = await engine.summarize({ messages: longSpan() }, makeAgent(), undefined)
  const text = result.summary[0].text
  assert.ok(text.includes('## Files recently read'), 'the recent-files section is appended')
  assert.ok(text.includes('- C:/repo/src/app.ts'))
  assert.ok(text.indexOf('CHECKPOINT BODY') < text.indexOf('## Files recently read'), 'the section follows the checkpoint body')
})

test('a span too small for the checkpoint is refused with the preset label', async () => {
  const { engine } = engineOf()
  await assert.rejects(
    () => engine.summarize({ messages: [{ role: 'user', content: [{ type: 'text', text: 'tiny' }] }] }, makeAgent(), undefined),
    /arya-claude compaction: the replaced span is too small for a checkpoint/,
  )
})

test('the kit validation names the preset', () => {
  const { kit } = makeKit()
  class SecondBase {}
  assert.throws(
    () => createAryaStandardCompaction(SecondBase, { ...kit, checkpointPrompt: ' ' }),
    /arya-claude compaction: the checkpoint prompt is missing/,
  )
  assert.throws(
    () => createAryaStandardCompaction(SecondBase, { ...kit, summaryPrefix: '', summarySuffix: '' }),
    /arya-claude compaction: the summary frame is missing/,
  )
})

test('the observation waterfalls are namespaced for this preset', async () => {
  const { engine, waterfalls } = engineOf({ blocks: [{ type: 'text', text: 'CHECKPOINT BODY' }] })
  await engine.summarize({ messages: longSpan() }, makeAgent(), undefined)
  assert.deepEqual(waterfalls, ['arya-claude/compaction/pre', 'arya-claude/compaction/post'])
  assert.equal(waterfalls.some((name) => name.startsWith('arya-standard/')), false)
})

/**
 * Arya Standard's compaction summary, as Codex writes it.
 *
 * DSH splits compaction in two: `@deepseek-ai/dsh-compaction-basic` owns the hard
 * part — when to compact, which surface span is safe to replace, the durable
 * `compaction/start` lock, stability revalidation, the shrink guard and the single
 * replacement message — and calls `summarize(input, agent, signal)` for the summary
 * itself. That hook is the documented seam, so this module overrides exactly it and
 * nothing else.
 *
 * What Codex does differently from the DSH default, and what this file reproduces:
 *
 *   - The instruction is Codex's `CONTEXT CHECKPOINT COMPACTION` prompt, appended
 *     as the last user message of the summarization request. Codex sends it as a
 *     plain user message over the whole history, which is what the base engine's
 *     replayed input already is, so no stripped "shadow" request is used.
 *   - The result is framed with Codex's `SUMMARY_PREFIX`, so the next model reads
 *     the checkpoint as another model's handoff rather than as its own memory.
 *   - Codex keeps up to 20k tokens of the user's own messages verbatim and drops
 *     every assistant and tool turn. The base engine cannot express that through
 *     configuration (its retention is a priced tail of the whole surface), so the
 *     retained user messages travel inside the summary text, clearly marked, and
 *     are budgeted at `keepUserTokens` capped by a tenth of what is replaced.
 *
 * Everything here is pure: the factory takes the base class and the few `dsh-llm`
 * helpers it needs, so a test can subclass a stub and drive a stub stream.
 *
 * @module dsh-aryacode-polish-arya-standard-compaction
 */

/** Marks the verbatim section inside a checkpoint. */
export const ARYA_STANDARD_RETAINED_PREAMBLE = "The user's own messages from the span that was replaced, quoted verbatim, most recent last. Treat them as the user's words rather than as part of this summary:"

/** Rough characters-per-token estimate, matching the engine's own meter. */
const CHARS_PER_TOKEN = 4

/**
 * The share of a replaced span that verbatim user text may occupy.
 *
 * Codex admits up to 20k tokens of the user's own messages next to the summary,
 * bounded only by the cap itself. The summary is what has to shrink, so the
 * user-quote section is allowed to take half the span before the shrink guard
 * starts dropping it.
 */
const RETAINED_SHARE = 0.5

/**
 * Estimate the tokens a string costs.
 * @param {string} text any text.
 * @returns {number} a whole token count.
 */
function estimateTokens(text) {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

/**
 * Read the plain text out of a derived message.
 * @param {unknown} message a derived message, possibly without content.
 * @returns {string} the text parts joined by newlines.
 */
function messageText(message) {
  const content = message?.content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  const parts = []
  for (const part of content) {
    if (part?.type === 'text' && typeof part.text === 'string') parts.push(part.text)
  }
  return parts.join('\n')
}

/**
 * Cut a string down to an approximate token budget.
 * @param {string} text the text to cut.
 * @param {number} tokens the budget, in tokens.
 * @returns {string} at most `tokens * 4` characters, trimmed.
 */
function truncateToTokens(text, tokens) {
  const allowed = Math.max(0, tokens) * CHARS_PER_TOKEN
  if (text.length <= allowed) return text
  return text.slice(0, allowed).trimEnd()
}

/**
 * Resolve the provider/model the summarization request goes to, exactly as the
 * base engine does: the configured pair, else the session's last routed target,
 * else the agent's own options.
 *
 * @param {object} config the engine row configuration.
 * @param {object} agent the agent handle `summarize()` receives.
 * @returns {{ provider: string, model: string }} the target.
 */
export function resolveSummarizationTarget(config, agent) {
  const configured = typeof config?.summarizationProvider === 'string' && config.summarizationProvider.length > 0
    ? { provider: config.summarizationProvider, model: config.summarizationModel }
    : undefined
  const latest = agent?.session?.requestHeader?.()?.config
  const own = agent?.options?.provider?.length > 0 && agent?.options?.model?.length > 0
    ? { provider: agent.options.provider, model: agent.options.model }
    : undefined
  const target = configured ?? latest ?? own
  if (target === undefined) {
    throw new Error('no provider/model available for summarization: set both BasicCompactionConfig summarization fields, route one request, or set both AgentOptions fields')
  }
  return target
}

/**
 * Turn a finished stream into the failure the base engine expects, or `undefined`.
 * @param {object | undefined} finish the assembler's finish record.
 * @param {object} LlmError the `LlmError` constructor.
 * @returns {Error | undefined} a thrown-shaped error when the stream failed.
 */
export function finishError(finish, LlmError) {
  if (finish?.kind === 'error' || finish?.kind === 'aborted') {
    return new LlmError(finish.failure.message, finish.failure.code, finish.failure)
  }
  if (finish?.kind === 'max-tokens') {
    const error = new Error('summarization truncated at the token cap (incomplete checkpoint)')
    error.code = 'MAX_TOKENS'
    return error
  }
  return undefined
}

/**
 * Keep only the text blocks of a summary, refusing image output.
 * @param {unknown} blocks the assembler's blocks.
 * @param {(blocks: unknown) => boolean} contentHasImage the `dsh-llm` predicate.
 * @param {object} LlmError the `LlmError` constructor.
 * @returns {Array<{ type: 'text', text: string }>} text blocks.
 */
export function summaryTextBlocks(blocks, contentHasImage, LlmError) {
  if (contentHasImage(blocks)) {
    throw new LlmError('compaction summary cannot contain image output', 'UNSUPPORTED_CONTENT')
  }
  if (!Array.isArray(blocks)) return []
  return blocks.filter((block) => block?.type === 'text' && typeof block.text === 'string')
}

/**
 * Collect the user's own messages from the replaced span, newest first, within a
 * token budget. Earlier checkpoints are skipped: their text is a model's summary,
 * not the user's words, and re-quoting it would grow the checkpoint every round.
 *
 * @param {ReadonlyArray<unknown>} messages the derived span messages.
 * @param {number} budget the token budget for the quoted text.
 * @param {string} summaryPrefix Codex's prefix, used to recognise a checkpoint.
 * @returns {{ text: string, tokens: number }} the quoted section (empty when nothing fits).
 */
export function retainedUserMessages(messages, budget, summaryPrefix) {
  if (!Array.isArray(messages) || budget <= 0) return { text: '', tokens: 0 }
  const kept = []
  let spent = 0
  for (let index = messages.length - 1; index >= 0 && spent < budget; index -= 1) {
    const message = messages[index]
    if (message?.role !== 'user') continue
    const text = messageText(message).trim()
    if (text.length === 0 || text.startsWith(summaryPrefix)) continue
    const tokens = estimateTokens(text)
    const remaining = budget - spent
    if (tokens > remaining) {
      const cut = truncateToTokens(text, remaining)
      if (cut.length > 0) {
        kept.unshift(cut)
        spent = budget
      }
      break
    }
    kept.unshift(text)
    spent += tokens
  }
  if (kept.length === 0) return { text: '', tokens: 0 }
  const quoted = kept.map((text, index) => `--- user message ${index + 1} ---\n${text}`).join('\n\n')
  return { text: `${ARYA_STANDARD_RETAINED_PREAMBLE}\n\n${quoted}`, tokens: spent }
}

/**
 * Estimate what the replaced span cost, for the share-based budget and the guard.
 * @param {ReadonlyArray<unknown>} messages the derived span messages.
 * @returns {number} an approximate token count.
 */
function estimateSpanTokens(messages) {
  if (!Array.isArray(messages)) return 0
  let total = 0
  for (const message of messages) total += estimateTokens(messageText(message))
  return total
}

/**
 * Build the summary subclass.
 *
 * @param {Function} Base the `BasicCompactionEngine` class (or a compatible stub).
 * @param {{
 *   BlockAssembler: new () => { push(chunk: unknown): void, finish?: object, blocks(): unknown, usage?: unknown },
 *   LlmError: new (message: string, code: string, details?: unknown) => Error,
 *   contentHasImage: (blocks: unknown) => boolean,
 *   deepFreeze: <T>(value: T) => T,
 *   checkpointPrompt: string,
 *   summaryPrefix: string,
 * }} kit the dependencies this subclass needs.
 * @returns {Function} the engine class the preset row mounts.
 */
export function createAryaStandardCompaction(Base, kit) {
  if (typeof Base !== 'function') throw new Error('arya-standard compaction: a base engine class is required')
  if (typeof kit?.checkpointPrompt !== 'string' || kit.checkpointPrompt.trim().length === 0) {
    throw new Error('arya-standard compaction: the checkpoint prompt is missing')
  }
  if (typeof kit?.summaryPrefix !== 'string' || kit.summaryPrefix.trim().length === 0) {
    throw new Error('arya-standard compaction: the summary prefix is missing')
  }

  return class AryaStandardCompaction extends Base {
    /**
     * Replace the base engine's summary with Codex's checkpoint.
     *
     * @param {object} input the prepared summarization input `{ messages, tools? }`.
     * @param {object} agent the agent that owns the turn.
     * @param {AbortSignal | undefined} signal cancellation for this request.
     * @returns {Promise<object>} the `summarized` record the base engine commits.
     */
    async summarize(input, agent, signal) {
      const messages = Array.isArray(input?.messages) ? input.messages : []
      const target = resolveSummarizationTarget(this.config, agent)
      const assembler = new kit.BlockAssembler()
      const instruction = kit.deepFreeze({
        role: 'user',
        content: [{ type: 'text', text: kit.checkpointPrompt }],
      })
      const request = {
        provider: target.provider,
        model: target.model,
        messages: [...messages, instruction],
        toolHistory: agent.session.toolHistory(),
        ...(input?.tools === undefined ? {} : { tools: [...input.tools] }),
        maxTokens: this.config.maxTokens,
        sessionId: agent.session.id,
        purpose: 'compaction',
        ...(signal === undefined ? {} : { signal }),
      }
      for await (const chunk of this.ctx.llm.stream(request)) assembler.push(chunk)
      const failure = finishError(assembler.finish, kit.LlmError)
      if (failure !== undefined) throw failure
      const rawOutput = assembler.blocks()
      const blocks = summaryTextBlocks(rawOutput, kit.contentHasImage, kit.LlmError)
      const body = blocks.map((block) => block.text).join('').trim()
      if (body.length === 0) throw new Error('summarization produced no text summary content')

      const prefix = kit.summaryPrefix
      const summary = [{ type: 'text', text: `${prefix}\n${body}` }]
      const spanTokens = estimateSpanTokens(messages)
      const budget = Math.min(
        Math.max(0, Number(this.config.keepUserTokens ?? 0)),
        Math.floor(spanTokens * RETAINED_SHARE),
      )
      const retained = retainedUserMessages(messages, budget, prefix)
      if (retained.text.length > 0) {
        const framed = estimateTokens(`${prefix}\n${body}`) + retained.tokens
        // Never hand the base engine a summary that would trip its own shrink
        // guard: the verbatim section is the part we can drop, the summary is not.
        if (framed < Math.floor(spanTokens * 0.9)) summary.push({ type: 'text', text: retained.text })
      }

      return {
        summary,
        rawOutput,
        llmStreamCall: true,
        provider: request.provider,
        model: request.model,
        maxTokens: request.maxTokens,
        ...(assembler.usage === undefined ? {} : { usage: assembler.usage }),
      }
    }
  }
}

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
 *   - The user's own messages survive verbatim next to the summary, budgeted at
 *     `keepUserTokens` and capped by half of what is replaced. The base engine
 *     cannot express that through its configuration (its retention is a priced
 *     tail of the whole surface), so the retained messages travel inside the
 *     summary text, clearly marked. The budget comes from the
 *     `aryaStandardPolicy` service rather than from the engine config, because
 *     `compaction-basic` rejects configuration keys outside its own closed set.
 *   - When the summarization request itself overflows the provider's window,
 *     Codex removes the oldest history item and retries. The same fallback runs
 *     here, over whole user turns, so the request stays structurally valid.
 *
 * Everything here is pure: the factory takes the base class and the few `dsh-llm`
 * helpers it needs, so a test can subclass a stub and drive a stub stream.
 *
 * @module dsh-aryacode-polish-arya-standard-compaction
 */

import { readPolicy } from './policy.js'

/** Marks the verbatim section inside a checkpoint. */
export const ARYA_STANDARD_RETAINED_PREAMBLE = "The user's own messages from the span that was replaced, quoted verbatim, most recent last. Treat them as the user's words rather than as part of this summary:"

/**
 * Tokens the base engine adds around a summary that this module cannot see: its
 * `CHECKPOINT_PREAMBLE` plus the `<compacted-summary>` tags. The shrink guard
 * below prices the checkpoint without them, so they are reserved here instead of
 * being absorbed by an unexplained safety factor.
 */
const FRAME_RESERVE_TOKENS = 128

/**
 * The checkpoint must stay clearly smaller than what it replaces. The gap covers
 * the difference between this module's character estimate and the token meter the
 * base engine prices the replacement with.
 */
const SHRINK_SAFETY = 0.9

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
 *
 * A flat four-characters-per-token reading is only true of Latin text. A model
 * that answers in Chinese spends roughly one token per character, so a flat
 * estimate under-prices a checkpoint by ~4x — enough to pass this module's shrink
 * check while the base engine's meter refuses the same summary as "not smaller
 * than the shadowed content".
 *
 * @param {string} text any text.
 * @returns {number} a whole token count.
 */
function estimateTokens(text) {
  let tokens = 0
  for (const character of text) {
    const code = character.codePointAt(0)
    const wide = (code >= 0x2e80 && code <= 0x9fff)
      || (code >= 0xac00 && code <= 0xd7af)
      || (code >= 0xf900 && code <= 0xfaff)
      || (code >= 0xff00 && code <= 0xffef)
    tokens += wide ? 1 : 0.25
  }
  return Math.ceil(tokens)
}

/**
 * Read the text out of a derived message, including tool output.
 *
 * The span this runs over is dominated by tool results in a real session, so a
 * text-only reading would badly under-price it.
 *
 * @param {unknown} message a derived message, possibly without content.
 * @returns {string} the text parts joined by newlines.
 */
function messageText(message) {
  const content = message?.content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  const parts = []
  for (const part of content) {
    if (part?.type === 'text' && typeof part.text === 'string') {
      parts.push(part.text)
      continue
    }
    if (part?.type !== 'tool-result' && part?.type !== 'tool_result') continue
    const inner = part.output ?? part.result ?? part.content
    if (typeof inner === 'string') parts.push(inner)
    else if (Array.isArray(inner)) parts.push(messageText({ content: inner }))
  }
  return parts.join('\n')
}

/**
 * Cut a string down to an approximate token budget.
 * @param {string} text the text to cut.
 * @param {number} tokens the budget, in tokens.
 * @returns {string} the longest prefix that fits the budget.
 */
function truncateToTokens(text, tokens) {
  if (tokens <= 0) return ''
  let used = 0
  let end = 0
  for (const character of text) {
    const code = character.codePointAt(0)
    const wide = (code >= 0x2e80 && code <= 0x9fff)
      || (code >= 0xac00 && code <= 0xd7af)
      || (code >= 0xf900 && code <= 0xfaff)
      || (code >= 0xff00 && code <= 0xffef)
    used += wide ? 1 : 0.25
    if (used > tokens) break
    end += character.length
  }
  return text.slice(0, end).trimEnd()
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
 *
 * This must price the content being replaced, not the request. `input.messages` is
 * the replayed prefix — the system prompt plus the span — and the system prompt is
 * tens of thousands of tokens on its own. Counting it inflates every budget by the
 * whole fixed prompt, so the checkpoint is never fitted and the base engine refuses
 * it as "not smaller than the shadowed content".
 *
 * @param {ReadonlyArray<unknown>} messages the derived span messages.
 * @returns {number} an approximate token count.
 */
function estimateSpanTokens(messages) {
  if (!Array.isArray(messages)) return 0
  let total = 0
  for (const message of messages) {
    if (message?.role === 'system' || message?.role === 'developer') continue
    total += estimateTokens(messageText(message))
  }
  return total
}

/**
 * Remove the oldest user turn from a replayed prefix.
 *
 * Codex answers a summarization request that overflows the window by dropping the
 * oldest history item and retrying. Dropping a single message can orphan a tool
 * result from its call, so a whole turn goes at a time and a leading system
 * message is never touched: it is the prefix the base engine replays for cache
 * warmth.
 *
 * @param {ReadonlyArray<unknown>} messages the replayed prefix.
 * @returns {ReadonlyArray<unknown> | null} the shortened prefix, or null when
 *   nothing can be dropped without emptying the request.
 */
export function dropOldestTurn(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return null
  let first = 0
  while (first < messages.length && messages[first]?.role === 'system') first += 1
  // Only the system prefix and one item left: there is no older turn to drop.
  if (first >= messages.length - 1) return null
  let cut = first + 1
  while (cut < messages.length && messages[cut]?.role !== 'user') cut += 1
  const shorter = [...messages.slice(0, first), ...messages.slice(cut)]
  // A request that kept nothing but the cache-warm prefix has nothing to
  // summarize, which is a worse failure than the overflow it was avoiding.
  if (shorter.length <= first) return null
  return shorter
}

/**
 * Ask the host whether summarization carries on.
 *
 * The base engine owns the durable transaction, so these two waterfalls wrap the
 * summarization request only — they cannot veto a commit that has not been made.
 *
 * @param {object | undefined} ctx the engine's context.
 * @param {string} name the waterfall name.
 * @param {object} payload the observation.
 * @returns {Promise<void>} resolves after every listener ran.
 */
export async function notifyWaterfall(ctx, name, payload) {
  if (typeof ctx?.waterfall !== 'function') return
  await ctx.waterfall(name, payload, () => undefined)
}

/**
 * Whether a thrown value reports an exhausted context window.
 * @param {unknown} error the failure from the stream.
 * @param {string} code the provider's context-window code.
 * @returns {boolean} true when the request should retry with less history.
 */
function isWindowOverflow(error, code) {
  if (typeof code !== 'string' || code.length === 0) return false
  let current = error
  for (let depth = 0; depth < 8 && current !== null && typeof current === 'object'; depth += 1) {
    if (current.code === code) return true
    current = current.cause
  }
  return false
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
 *   contextWindowExceededCode?: string,
 * }} kit the dependencies this subclass needs.
 * @returns {Function} the engine class the preset row mounts.
 */
export function createAryaStandardCompaction(Base, kit) {
  if (typeof Base !== 'function') throw new Error('arya-standard compaction: a base engine class is required')
  if (typeof kit?.checkpointPrompt !== 'string' || kit.checkpointPrompt.trim().length === 0) {
    throw new Error('arya-standard compaction: the checkpoint prompt is missing')
  }
  // A kit frames its checkpoints either before the body (Codex's handoff prefix)
  // or after it (Qwen Code's resume trailer), or both; one of them must be there.
  const framePrefix = typeof kit?.summaryPrefix === 'string' ? kit.summaryPrefix : ''
  const frameSuffix = typeof kit?.summarySuffix === 'string' ? kit.summarySuffix : ''
  if (framePrefix.trim().length === 0 && frameSuffix.trim().length === 0) {
    throw new Error('arya-standard compaction: the summary frame is missing')
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
      const policy = readPolicy(this.ctx, this.policyService)
      const target = resolveSummarizationTarget(this.config, agent)
      const instructionText = policy.compactPromptOverride.length > 0
        ? policy.compactPromptOverride
        : kit.checkpointPrompt
      const instruction = kit.deepFreeze({
        role: 'user',
        content: [{ type: 'text', text: instructionText }],
      })
      let messages = Array.isArray(input?.messages) ? input.messages : []
      let assembler
      let request

      for (let attempt = 0; ; attempt += 1) {
        await notifyWaterfall(this.ctx, 'arya-standard/compaction/pre', {
          session: agent.session,
          agent,
          messages,
          attempt,
        })
        request = {
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
        assembler = new kit.BlockAssembler()
        try {
          for await (const chunk of this.ctx.llm.stream(request)) assembler.push(chunk)
          break
        } catch (error) {
          // Codex answers a summarization request that overflows the window by
          // dropping the oldest history item and trying again.
          if (!isWindowOverflow(error, kit.contextWindowExceededCode) || attempt >= policy.dropOldestRetries) throw error
          const shorter = dropOldestTurn(messages)
          if (shorter === null) throw error
          messages = shorter
        }
      }

      const failure = finishError(assembler.finish, kit.LlmError)
      if (failure !== undefined) throw failure
      const rawOutput = assembler.blocks()
      const blocks = summaryTextBlocks(rawOutput, kit.contentHasImage, kit.LlmError)
      let body = blocks.map((block) => block.text).join('').trim()
      // Qwen Code's compression prompt asks for a chain-of-thought scratchpad in
      // `<analysis>` before the envelope; it is drafting material and must not
      // reach the transcript. Keeping it if the strip empties everything is safer
      // than committing an empty checkpoint.
      if (kit.stripAnalysis === true) {
        const stripped = body.replace(/<analysis>[\s\S]*?<\/analysis>/gi, '').trim()
        if (stripped.length > 0) body = stripped
      }
      if (body.length === 0) throw new Error('summarization produced no text summary content')

      const prefix = framePrefix
      const suffix = frameSuffix
      const spanTokens = estimateSpanTokens(messages)
      // The base engine prices the whole framed checkpoint against the span it
      // replaces and refuses anything that does not shrink it. Reserve the frame
      // and the handoff prefix, then fit the body into what is left: a summary the
      // provider wrote too long for a small span must be cut, not committed.
      const frameTokens = estimateTokens([prefix, suffix].filter((part) => part.length > 0).join('\n\n'))
      const room = Math.max(0, Math.floor(spanTokens * SHRINK_SAFETY) - FRAME_RESERVE_TOKENS - frameTokens)
      const fitted = estimateTokens(body) > room ? truncateToTokens(body, room).trimEnd() : body
      if (fitted.length === 0) {
        throw new Error(`arya-standard compaction: the replaced span is too small for a checkpoint (${spanTokens} estimated tokens)`)
      }
      const framed = [prefix, fitted, suffix].filter((part) => part.length > 0).join('\n\n')
      const summary = [{ type: 'text', text: framed }]
      const budget = Math.min(
        Math.max(0, policy.keepUserTokens),
        Math.floor(spanTokens * RETAINED_SHARE),
        Math.max(0, room - estimateTokens(fitted)),
      )
      const marker = typeof kit.checkpointMarker === 'string' && kit.checkpointMarker.length > 0
        ? kit.checkpointMarker
        : prefix.length > 0 ? prefix : '\u0000'
      const retained = retainedUserMessages(messages, budget, marker)
      if (retained.text.length > 0) summary.push({ type: 'text', text: retained.text })

      await notifyWaterfall(this.ctx, 'arya-standard/compaction/post', {
        session: agent.session,
        agent,
        summaryTokens: estimateTokens(framed),
        spanTokens,
        retainedTokens: retained.tokens,
      })

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

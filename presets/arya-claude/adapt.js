/**
 * The one place the authored Claude-shaped prompt is checked before it mounts.
 *
 * Arya Standard vendors another agent's prompt byte-for-byte and rewrites a few
 * sentences; this preset cannot vendor anything (Claude Code's prompt text is
 * proprietary), so its prompt is authored prose. The risk is different: a
 * sentence naming another agent's tool, a stale placeholder, or a comparison to a
 * competitor that no longer holds. This module is the auditable check for that.
 *
 * The anchors are intentionally few and structural. They pin the sections whose
 * absence changes how the preset behaves, not the exact wording.
 *
 * @module dsh-aryacode-polish-arya-claude-adapt
 */

/**
 * Sentences or headings the prompt must still contain. A prompt revision that
 * drops one of these fails here instead of silently shipping a different preset.
 * @type {ReadonlyArray<string>}
 */
export const PROMPT_ANCHORS = [
  '{{model}}',
  '## Before you change anything',
  '## While you work',
  '## Safety',
  '## Context',
  'ask_user_question',
  'todo_write',
  'exit_plan_mode',
]

/**
 * Tokens that must not survive in the shipped prompt: they name another agent,
 * another agent's tool, or an implementation this harness does not have.
 * @type {ReadonlyArray<string>}
 */
export const FORBIDDEN_TOKENS = [
  'apply_patch',
  'rg --files',
  'Codex CLI',
  'Claude Code',
  'Qwen Code',
  'the planning tool',
]

/**
 * Normalize one authored prompt: line endings to LF, no trailing blanks.
 * @param {string} source the raw file text.
 * @returns {string} the normalized text.
 */
export function normalizePrompt(source) {
  return String(source).replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * Adapt (normalize and validate) the authored base prompt.
 *
 * Idempotent by construction: the only transformation is normalization, and the
 * validation only reads.
 * @param {string} source the raw contents of `prompt.md`.
 * @returns {string} the system prompt text the preset's `persona` row carries.
 */
export function adaptClaudePrompt(source) {
  if (typeof source !== 'string' || source.trim().length === 0) {
    throw new Error('arya-claude prompt: the authored prompt is empty')
  }
  const text = normalizePrompt(source)
  if (text.length < 1000) {
    throw new Error(`arya-claude prompt: the authored prompt is too short to be a system prompt (${text.length} characters)`)
  }
  for (const anchor of PROMPT_ANCHORS) {
    if (!text.includes(anchor)) {
      throw new Error(`arya-claude prompt: missing expected section or tool name: ${anchor}`)
    }
  }
  for (const token of FORBIDDEN_TOKENS) {
    if (text.includes(token)) {
      throw new Error(`arya-claude prompt: foreign-agent token survived: ${token}`)
    }
  }
  return text
}

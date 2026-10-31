/**
 * The vendored text this preset ships, read from disk once.
 *
 * Four files live next to this module:
 *
 *   - `prompt.md` — Codex's base instructions, copied byte-for-byte;
 *   - `checkpoint-prompt.md` — Codex's `CONTEXT CHECKPOINT COMPACTION` prompt;
 *   - `summary-prefix.md` — Codex's `SUMMARY_PREFIX`, which frames a checkpoint;
 *   - `plan-mode.md` — the plan-mode guidance the shipped `standard` preset passes
 *     to `@deepseek-ai/dsh-plan-mode` (that plugin rejects a missing section).
 *
 * They are read as text rather than imported so a reader can diff any of them
 * against the upstream repository without a build step. The contents are cached
 * per process: preset registration and the engine row both ask for them, and the
 * engine row may be mounted several times in one Host.
 *
 * @module dsh-aryacode-polish-arya-standard-files
 */
import { readFileSync } from 'node:fs'

/** The files this module is allowed to read, mapped to their shipped names. */
const FILES = new Map([
  ['prompt', 'prompt.md'],
  ['checkpoint', 'checkpoint-prompt.md'],
  ['prefix', 'summary-prefix.md'],
  ['planMode', 'plan-mode.md'],
])

/** @type {Map<string, string>} */
const cache = new Map()

/**
 * Read one vendored file.
 * @param {string} key one of `prompt`, `checkpoint`, `prefix`, `planMode`.
 * @returns {string} the file's text.
 */
function read(key) {
  const name = FILES.get(key)
  if (name === undefined) throw new Error(`arya-standard: unknown vendored file ${key}`)
  const cached = cache.get(key)
  if (cached !== undefined) return cached
  const text = readFileSync(new URL(`./${name}`, import.meta.url), 'utf8')
  cache.set(key, text)
  return text
}

/**
 * Codex's base instructions, unmodified.
 * @returns {string} the raw `prompt.md` text.
 */
export function codexBasePrompt() {
  return read('prompt')
}

/**
 * Codex's compaction instruction, trimmed so it can be appended as one message.
 * @returns {string} the checkpoint prompt text.
 */
export function codexCheckpointPrompt() {
  return read('checkpoint').trim()
}

/**
 * Codex's handoff preamble, trimmed.
 * @returns {string} the summary-prefix text.
 */
export function codexSummaryPrefix() {
  return read('prefix').trim()
}

/**
 * The plan-mode guidance section shipped with the `standard` preset.
 * @returns {string} a non-empty section body.
 */
export function planModeSection() {
  return read('planMode').trim()
}

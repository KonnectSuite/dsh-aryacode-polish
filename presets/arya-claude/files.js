/**
 * The text this preset ships, read from disk once.
 *
 * Claude Code's own prompt text is proprietary, so nothing here is vendored: the
 * four markdown files beside this module are original prose written for this
 * bundle, modelled on Claude Code's *structure* (its checkpoint sections and its
 * continuation framing) rather than on its wording. They are read as text rather
 * than imported so a reader can review the exact words the preset mounts.
 *
 * The plan-mode section and the skills directory are Arya Standard's: those are
 * the harness's own text, shared by every preset of this bundle.
 *
 * @module dsh-aryacode-polish-arya-claude-files
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { planModeSection as aryaStandardPlanModeSection, skillsDirectory as aryaStandardSkillsDirectory } from '../arya-standard/files.js'

/** The files this module is allowed to read, mapped to their shipped names. */
const FILES = new Map([
  ['prompt', 'prompt.md'],
  ['native', 'native.md'],
  ['checkpoint', 'checkpoint-prompt.md'],
  ['prefix', 'summary-prefix.md'],
  ['suffix', 'summary-suffix.md'],
])

/** @type {Map<string, string>} */
const cache = new Map()

/**
 * Read one shipped file.
 * @param {string} key one of `prompt`, `native`, `checkpoint`, `prefix`, `suffix`.
 * @returns {string} the file's text.
 */
function read(key) {
  const name = FILES.get(key)
  if (name === undefined) throw new Error(`arya-claude: unknown shipped file ${key}`)
  const cached = cache.get(key)
  if (cached !== undefined) return cached
  const text = readFileSync(new URL(`./${name}`, import.meta.url), 'utf8')
  cache.set(key, text)
  return text
}

/**
 * The preset's base instructions: original prose in the Claude Code idiom.
 * @returns {string} the raw `prompt.md` text.
 */
export function claudeBasePrompt() {
  return read('prompt')
}

/**
 * The harness-capabilities section appended to the base instructions. It names
 * the tools this bundle's presets mount where the prose names a generic action.
 * @returns {string} a non-empty section body.
 */
export function claudeNativePrompt() {
  return read('native').trim()
}

/**
 * The checkpoint instruction appended as the final user message of the
 * summarization request.
 * @returns {string} the checkpoint prompt text.
 */
export function claudeCheckpointPrompt() {
  return read('checkpoint').trim()
}

/**
 * The continuation framing placed before a checkpoint body.
 * @returns {string} the summary-prefix text.
 */
export function claudeSummaryPrefix() {
  return read('prefix').trim()
}

/**
 * The resume trailer placed after a checkpoint body.
 * @returns {string} the summary-suffix text.
 */
export function claudeSummarySuffix() {
  return read('suffix').trim()
}

/**
 * The plan-mode guidance section, shared with Arya Standard: it is the harness's
 * own wording and `@deepseek-ai/dsh-plan-mode` rejects a missing section.
 * @returns {string} a non-empty section body.
 */
export function planModeSection() {
  return aryaStandardPlanModeSection()
}

/**
 * The directory holding this bundle's own skills (the review lenses).
 * @returns {string} the absolute skills directory.
 */
export function skillsDirectory() {
  return aryaStandardSkillsDirectory()
}

/**
 * Absolute path of this preset's directory, used by tests and tooling.
 * @returns {string} the preset directory path.
 */
export function presetDirectory() {
  return fileURLToPath(new URL('./', import.meta.url))
}

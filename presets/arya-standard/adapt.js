/**
 * The one place Codex's base instructions become Arya Standard's.
 *
 * `prompt.md` next to this module is a byte-for-byte copy of
 * `codex-rs/core/gpt_5_codex_prompt.md` at the commit recorded in `CODEX-LICENSE`;
 * keeping it untouched is what makes the difference between the two auditable.
 * This table is that difference, and it is intentionally small:
 *
 *   - the opener names the routed model instead of GPT-5 in the Codex CLI, so the
 *     persona section still works when a session runs on another model;
 *   - the search bullet names the two DSH tools that do the same job, because DSH
 *     ships `grep`/`glob` rather than a shell `rg`;
 *   - `apply_patch` becomes `edit`, and the plan reminder names `todo_write`.
 *
 * Each `find` must occur at least once: a prompt revision that drops a sentence
 * fails loudly here instead of silently shipping a stale substitution. Everything
 * else — tone, review mindset, the "friendly coding teammate" final-message rules,
 * the destructive-command prohibition — is Codex's wording, verbatim.
 *
 * @module dsh-aryacode-polish-arya-standard-adapt
 */

/**
 * The substitutions applied to the vendored prompt, in order.
 * @type {ReadonlyArray<{ find: string, replace: string }>}
 */
export const PROMPT_SUBSTITUTIONS = [
  {
    find: "You are Codex, based on GPT-5. You are running as a coding agent in the Codex CLI on a user's computer.",
    replace: 'You are a coding agent powered by the {{model}} model. The working style below is adapted from Codex and should be followed as written.',
  },
  {
    find: '- When searching for text or files, prefer using `rg` or `rg --files` respectively because `rg` is much faster than alternatives like `grep`. (If the `rg` command is not found, then use alternatives.)',
    replace: '- When searching for text or files, use the `grep` and `glob` tools: they search the whole workspace and are faster than shelling out to a search command.',
  },
  {
    find: 'When using the planning tool:',
    replace: 'When using `todo_write`:',
  },
  {
    find: '- Skip using the planning tool for straightforward tasks (roughly the easiest 25%).',
    replace: '- Skip using `todo_write` for straightforward tasks (roughly the easiest 25%).',
  },
  {
    find: 'Try to use apply_patch for single file edits, but it is fine to explore other options to make the edit if it does not work well. Do not use apply_patch for changes that are auto-generated',
    replace: 'Try to use `edit` for single file edits, but it is fine to explore other options to make the edit if it does not work well. Do not use `edit` for changes that are auto-generated',
  },
  {
    find: 'You are producing plain text that will later be styled by the CLI.',
    replace: 'You are producing plain text that will later be styled by the client.',
  },
]

/**
 * Substitutions that a future Codex revision may drop. They are applied when the
 * token is present and skipped otherwise, so a prompt refresh does not fail on a
 * sentence Codex no longer writes.
 * @type {ReadonlyArray<{ find: string, replace: string }>}
 */
export const OPTIONAL_SUBSTITUTIONS = [
  { find: 'update_plan', replace: 'todo_write' },
  { find: 'view_image', replace: 'read_image' },
  { find: '`shell` tool', replace: '`bash`/`pwsh` tools' },
]

/**
 * Tokens that must not survive adaptation, because they name a Codex-only tool.
 * @type {ReadonlyArray<string>}
 */
export const FORBIDDEN_TOKENS = [
  'apply_patch',
  'rg --files',
  'Codex CLI',
  'the planning tool',
]

/**
 * Apply one substitution, requiring at least one occurrence.
 * @param {string} text the text so far.
 * @param {{ find: string, replace: string }} rule the rule to apply.
 * @returns {string} the substituted text.
 */
function substitute(text, rule) {
  if (!text.includes(rule.find)) {
    throw new Error(`arya-standard prompt: missing expected Codex sentence: ${rule.find.slice(0, 60)}…`)
  }
  return text.split(rule.find).join(rule.replace)
}

/**
 * Adapt the vendored Codex prompt for this preset.
 *
 * @param {string} source the raw contents of `prompt.md`.
 * @returns {string} the system prompt text the preset's `persona` row carries.
 */
export function adaptPrompt(source) {
  if (typeof source !== 'string' || source.trim().length === 0) {
    throw new Error('arya-standard prompt: the vendored Codex prompt is empty')
  }
  let text = source
  for (const rule of PROMPT_SUBSTITUTIONS) text = substitute(text, rule)
  for (const rule of OPTIONAL_SUBSTITUTIONS) {
    if (text.includes(rule.find)) text = text.split(rule.find).join(rule.replace)
  }
  for (const token of FORBIDDEN_TOKENS) {
    if (text.includes(token)) throw new Error(`arya-standard prompt: Codex-only token survived adaptation: ${token}`)
  }
  return text
}

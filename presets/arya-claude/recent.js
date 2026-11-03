/**
 * Recently read files: what Claude Code re-attaches after a compaction, derived
 * from the conversation this harness already replays.
 *
 * Claude Code walks its own read-file state after a compact and re-injects up to
 * five files (5k tokens each, 50k total). This harness does not hand a preset the
 * engine's file-read state, and a preset cannot append messages to the
 * compaction transaction (only the base engine can). What a preset *can* do is
 * read the replaced span it is already being given: the assistant tool calls in
 * it name the exact files the previous turns were working on. Adding those paths
 * to the checkpoint gives the next model the same pointer Claude Code's restored
 * files give it, at a few lines of cost instead of a second copy of the file.
 *
 * Everything here is pure so it is testable without a host.
 *
 * @module dsh-aryacode-polish-arya-claude-recent
 */

/**
 * Tool names whose arguments name one file the turn read or wrote. The harness's
 * filesystem tools use `file_path`; the entries are lower-cased before matching.
 * @type {ReadonlySet<string>}
 */
export const FILE_TOOL_NAMES = new Set(['read', 'write', 'edit', 'multiedit', 'str-replace-editor', 'notebookedit', 'read_image', 'read-image'])

/**
 * Argument keys that carry a file path, in the order they are tried.
 * @type {ReadonlyArray<string>}
 */
export const PATH_KEYS = ['file_path', 'filePath', 'path', 'filename', 'file']

/** Character cap for one path in the checkpoint section; longer "paths" are shell text, not files. */
const MAX_PATH_CHARS = 240

/**
 * Parse a tool call's JSON arguments without throwing.
 * @param {unknown} raw the `arguments` string.
 * @returns {Record<string, unknown> | null} the parsed object, or null.
 */
function parseArguments(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return null
  try {
    const value = JSON.parse(raw)
    return value !== null && typeof value === 'object' ? value : null
  } catch {
    return null
  }
}

/**
 * Read one path out of parsed tool arguments.
 * @param {Record<string, unknown>} args parsed arguments.
 * @returns {string} the path, or an empty string.
 */
function pathOf(args) {
  for (const key of PATH_KEYS) {
    const value = args[key]
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (trimmed.length === 0 || trimmed.length > MAX_PATH_CHARS) continue
    // A shell command, an inline diff or a prose sentence is not a file path.
    if (/[\r\n]/.test(trimmed)) continue
    if (trimmed.startsWith('data:')) continue
    return trimmed
  }
  return ''
}

/**
 * Collect the file paths named by tool calls in a replaced span, newest first.
 *
 * @param {ReadonlyArray<unknown>} messages the derived span messages.
 * @param {number} [limit] maximum number of distinct paths to return.
 * @returns {string[]} paths, most recently touched first.
 */
export function recentFilePaths(messages, limit = 5) {
  const cap = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 0
  if (cap === 0 || !Array.isArray(messages)) return []
  const seen = new Set()
  const paths = []
  for (let index = messages.length - 1; index >= 0 && paths.length < cap; index -= 1) {
    const content = messages[index]?.content
    if (!Array.isArray(content)) continue
    for (let block = content.length - 1; block >= 0 && paths.length < cap; block -= 1) {
      const part = content[block]
      if (part?.type !== 'tool-call' || typeof part.name !== 'string') continue
      if (!FILE_TOOL_NAMES.has(part.name.toLowerCase())) continue
      const parsed = parseArguments(part.arguments)
      if (parsed === null) continue
      const path = pathOf(parsed)
      if (path.length === 0 || seen.has(path)) continue
      seen.add(path)
      paths.push(path)
    }
  }
  return paths
}

/**
 * The checkpoint section listing the recently touched files.
 *
 * An empty string is returned when no file was touched, so a kit can drop it
 * without a second check.
 *
 * @param {ReadonlyArray<unknown>} messages the derived span messages.
 * @param {number} [limit] maximum number of paths to list.
 * @returns {string} the markdown section, or an empty string.
 */
export function recentFilesSection(messages, limit = 5) {
  const paths = recentFilePaths(messages, limit)
  if (paths.length === 0) return ''
  const lines = [
    '## Files recently read',
    'The turns covered by this checkpoint read or edited these files most recently. Re-read any of them when the exact current contents matter; do not assume the excerpts above are still current.',
    ...paths.map((path) => `- ${path}`),
  ]
  return lines.join('\n')
}

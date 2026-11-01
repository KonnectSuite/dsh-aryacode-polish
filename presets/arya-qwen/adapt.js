/**
 * Arya Qwen's prompt adaptation.
 *
 * The vendored `prompt.md` is already mapped from Qwen Code's tool names onto this
 * harness's; what is left is the identity line, which Qwen Code builds at runtime
 * from its interaction mode and which the extractor therefore cannot carry.
 *
 * @module dsh-aryacode-polish-arya-qwen-adapt
 */

const IDENTITY = 'You are a coding agent: an interactive software-engineering agent powered by the {{model}} model. Your primary goal is to help users safely and efficiently, adhering strictly to the following instructions and utilizing your available tools.'

/**
 * Give the vendored prompt its identity line and a clean tail.
 * @param {string} text the vendored prompt.
 * @returns {string} the prompt the persona row mounts.
 */
export function adaptQwenPrompt(text) {
  const body = typeof text === 'string' ? text.trim() : ''
  if (body.startsWith('You are a coding agent')) return body + '\n'
  return `${IDENTITY}\n\n${body}\n`
}

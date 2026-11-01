/**
 * The vendored text Arya Automation Engineer ships.
 *
 * One file: `persona.md`, written for this preset from the Engineering bundle's
 * documented loop. There is no upstream project to adapt here — Codex has no
 * opinion about a controller download and Qwen Code has none about a rung id — so
 * the text is ours and lives in the repository where it can be reviewed.
 *
 * @module dsh-aryacode-polish-arya-automation-files
 */

import { readFileSync } from 'node:fs'

let cached

/**
 * Read the persona once per process.
 * @returns {string} the persona text.
 */
export function automationPersona() {
  if (cached !== undefined) return cached
  cached = readFileSync(new URL('./persona.md', import.meta.url), 'utf8')
  return cached
}

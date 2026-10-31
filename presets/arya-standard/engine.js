/**
 * The engine row the Arya Standard preset mounts.
 *
 * A preset row is loaded like any other bundle entry, so this module's default
 * export is the compaction service itself: DSH's base engine with Codex's summary
 * hung on the documented `summarize()` hook. Importing the real base class here —
 * rather than in `compaction.js` — keeps that file pure, so the summary logic is
 * testable without a Host.
 *
 * `@deepseek-ai/dsh-llm` supplies `BlockAssembler`, `LlmError` and
 * `contentHasImage`; reusing them means chunk assembly, finish classification and
 * image refusal behave exactly as the base engine does.
 *
 * @module dsh-aryacode-polish-arya-standard
 */
import { BasicCompactionEngine } from '@deepseek-ai/dsh-compaction-basic'
import { BlockAssembler, LlmError, contentHasImage } from '@deepseek-ai/dsh-llm'
import { deepFreeze } from '@deepseek-ai/dsh-util-values'
import { codexCheckpointPrompt, codexSummaryPrefix } from './files.js'
import { createAryaStandardCompaction } from './compaction.js'

export { createAryaStandardCompaction }

export default createAryaStandardCompaction(BasicCompactionEngine, {
  BlockAssembler,
  LlmError,
  contentHasImage,
  deepFreeze,
  checkpointPrompt: codexCheckpointPrompt(),
  summaryPrefix: codexSummaryPrefix(),
})

/**
 * The engine row Arya Qwen mounts.
 *
 * The trigger logic, retention maths and transaction work are Arya Standard's â€”
 * imported, not copied, so a fix to the pre-warm gate reaches both presets. What
 * differs is the kit:
 *
 *   - Qwen Code's compression prompt, which emits a `<state_snapshot>` envelope;
 *   - no handoff prefix (the envelope is self-describing) and a resume trailer
 *     after the body instead, mirroring Qwen Code's `postProcessSummary`;
 *   - the `<analysis>` drafting block is stripped before the summary is committed;
 *   - the policy comes from `aryaQwenPolicy`, not `aryaStandardPolicy`.
 *
 * @module dsh-aryacode-polish-arya-qwen
 */

import { BlockAssembler, CONTEXT_WINDOW_EXCEEDED_CODE, LlmError, contentHasImage } from '@deepseek-ai/dsh-llm'
import { deepFreeze } from '@deepseek-ai/dsh-util-values'
import { ObservableCompactionEngine } from '../arya-standard/engine.js'
import { createAryaStandardCompaction } from '../arya-standard/compaction.js'
import { qwenCheckpointPrompt, qwenSummarySuffix } from './files.js'

/** The Arya Standard engine pointed at this preset's policy service. */
export class AryaQwenEngine extends ObservableCompactionEngine {
  get policyService() {
    return 'aryaQwenPolicy'
  }
}

export default createAryaStandardCompaction(AryaQwenEngine, {
  BlockAssembler,
  LlmError,
  contentHasImage,
  deepFreeze,
  checkpointPrompt: qwenCheckpointPrompt(),
  summaryPrefix: '',
  summarySuffix: qwenSummarySuffix(),
  stripAnalysis: true,
  checkpointMarker: '<state_snapshot>',
  contextWindowExceededCode: CONTEXT_WINDOW_EXCEEDED_CODE,
})

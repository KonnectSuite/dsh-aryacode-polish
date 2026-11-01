/**
 * The engine row Arya Qwen mounts.
 *
 * The trigger logic, retention maths and transaction work are Arya Standard's Ã¢â‚¬â€
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

/** The kit both the live row and the tests read, so its shape stays checkable. */
export const ARYA_QWEN_KIT = {
  BlockAssembler,
  LlmError,
  contentHasImage,
  deepFreeze,
  checkpointPrompt: qwenCheckpointPrompt(),
  summaryPrefix: '',
  summarySuffix: qwenSummarySuffix(),
  stripAnalysis: true,
  checkpointMarker: '<state_snapshot>',
  // The envelope is ~800 tokens even when nearly empty, and cutting it at the
  // end loses `<next_step>`. Below this much room the fold is skipped instead.
  minBodyTokens: 800,
  contextWindowExceededCode: CONTEXT_WINDOW_EXCEEDED_CODE,
}

export default createAryaStandardCompaction(AryaQwenEngine, ARYA_QWEN_KIT)

/**
 * The policy row Arya Qwen's compaction group mounts.
 *
 * Same shape and same knobs as Arya Standard's row, published under its own
 * service name: a preset may only provide a service inside a realm it declares,
 * and the engine reads the policy by that name. The defaults are the ones to
 * keep in lock-step with `policy.js` in the Arya Standard preset — this row
 * exists so a Qwen session never accidentally reads a Codex session's policy,
 * not to grow a second set of knobs.
 *
 * `keepUserTokens` arrives as 0 from the definition: Qwen Code's compression
 * prompt already asks the summarizer to reproduce the user's own messages inside
 * `<all_user_messages>`, so retaining them again would duplicate them.
 *
 * @module dsh-aryacode-polish-arya-qwen-policy
 */

import { resolvePolicy } from '../arya-standard/policy.js'

/** The service name this row provides. */
export const ARYA_QWEN_POLICY_SERVICE = 'aryaQwenPolicy'

export default {
  name: 'arya-qwen-policy',
  /**
   * Publish the validated policy for the engine row beside this one.
   * @param {object} ctx the row's cordis context.
   * @param {unknown} config the row configuration.
   * @returns {void} nothing.
   */
  apply(ctx, config) {
    ctx.provide(ARYA_QWEN_POLICY_SERVICE, resolvePolicy(config))
  },
}

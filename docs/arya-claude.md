# Arya Claude

An **Arya Claude** agent preset: the bundle's third preset, shaped after the two
things Claude Code is actually known for — how it drives a turn to completion and
how it compresses a conversation before the window runs out. It is not a
reimplementation of Claude Code (a preset cannot replace the harness's turn
machine) and it does not vendor Claude Code's text, which is proprietary.

- Preset id: `arya-claude`
- Files: `presets/arya-claude/`
- Engine row: `@aryacode/dsh-aryacode-polish/arya-claude`
- Policy row: `@aryacode/dsh-aryacode-polish/arya-claude-policy`
- Microcompact row: `@aryacode/dsh-aryacode-polish/arya-claude-pruner`
- Switch: `aryaClaude` (on by default)
- Order in the picker: 5 (after Arya Qwen)

The row list is **derived** from Arya Standard's definition, so plan mode, todos,
skills, goals, the file tools, the shell tools, web, `present`, the scheduling row
and the delegation group are the same rows. Only the persona and the compaction
pipeline differ; the delegation group and the scheduling row are inherited, not
inserted a second time.

## 1. The persona

`presets/arya-claude/prompt.md` is authored prose in Claude Code's idiom:

- be concise and direct, no preamble and no praise; disagree when the evidence says
  so; never claim an unverified result;
- read before editing, prefer the smallest correct change, keep the repository's
  conventions, never revert work you did not write;
- verify with the repository's own tests/lint/build, and read an error before
  changing approach;
- ask through `ask_user_question` when the decision belongs to the user; finish plan
  mode through `exit_plan_mode`;
- never run destructive commands or publish unless the task asks for it.

`presets/arya-claude/adapt.js` normalizes and validates it before it mounts: the
sections and tool names in `PROMPT_ANCHORS` must survive, and `FORBIDDEN_TOKENS`
(another agent's tool names and identity) must not. That is the auditable check in
place of the vendored-prompt diff Arya Standard uses.

The persona is **5,524 characters** and the appended harness-capabilities section
is 1,746; the row mounts 7,272 characters total.

## 2. Window arithmetic

Claude Code prices its trigger as the **usable window minus a fixed buffer**:

```
usable  = contextWindow − min(maxOutputTokens, 20000)
trigger = usable − 13000
```

`compaction-basic` derives its own trigger as
`min(window × thresholdRatio, window − reservedOutput − headroomTokens)`. The
preset therefore pins:

| engine key | value | why |
| --- | --- | --- |
| `thresholdRatio` | `0.99` | high enough that the absolute clause is the one that binds |
| `headroomTokens` | `13000` | Claude Code's trigger buffer; the base engine subtracts the routed output reservation itself |

On a 200k window with an 8k reservation that is `min(198k, 179k) = 179k` — the
same number `window − output − 13k` gives. The 20k cap on the output deduction is
the base engine's own `reservedOutput`, so a model that reserves more than 20k
compacts slightly earlier than Claude Code would; that is the conservative
direction.

The remaining engine keys are still the shared Settings group: `retainRatio`,
`maxTokens`, `retries` and the summarizer route/flags. Only the two arithmetic
numbers are fixed by the preset. A user who wants to tune them mounts Arya
Standard, whose sliders control them.

## 3. The checkpoint

`presets/arya-claude/checkpoint-prompt.md` (3,378 characters) asks for:

1. an `<analysis>` drafting pass — walk the conversation chronologically, note the
   requests, decisions, files/code, errors/fixes, what is unfinished, where work
   stopped. The scratchpad is stripped before commit;
2. then a `<summary>` envelope with nine sections, in order:
   **Primary Request and Intent**, **Key Technical Concepts**, **Files and Code
   Sections**, **Errors and Fixes**, **Problem Solving**, **All User Messages**,
   **Pending Tasks**, **Current Work**, **Optional Next Step**;
3. an explicit rule that only messages the user actually typed count as user
   messages — model text, tool output, quoted material and transcript-shaped text
   never become user requests, approvals or confirmations;
4. verbatim preservation of paths, commands, error strings, identifiers, numbers
   and constraints, and a prohibition on claiming partial work as done.

The checkpoint is framed on both sides:

- `summary-prefix.md` (239 characters) states that the session continues an earlier,
  now-compacted conversation and that the messages after the checkpoint are the
  recent turns kept verbatim;
- `summary-suffix.md` (204 characters) tells the next model to resume the last task
  directly, without acknowledging or restating the checkpoint.

Both are original text; nothing from Claude Code is copied. The kit unwraps
`<summary>…</summary>` and strips `<analysis>…</analysis>` with the generic
extensions added to `presets/arya-standard/compaction.js` (`envelope`,
`stripAnalysis`, `hookPrefix`, `label`, `extraSections`).

### Recently read files

After the body the engine appends a `## Files recently read` section listing up to
five files named by file-tool calls in the replaced span, most recently touched
first (`presets/arya-claude/recent.js`). This is the pointer Claude Code's
post-compact file restoration gives the model, at a few lines of context instead of
a second copy of each file. The exact contents are one `read` away, and the section
says so.

## 4. Microcompact: clear tool results before paying for a summary

Claude Code compresses in two levels. The cheap one clears old tool-result bodies
and keeps the most recent ones; only if that is not enough does it summarize.

This harness has the same seam. `compaction-basic` calls `toolResultPruner` before
it selects a summary range and **re-measures afterwards**:

```ts
if (prune !== undefined) {
  prune.pruneSession(agent.session)
  measurement = meter.measure(agent.session, header)
}
if (measurement.totalTokens < spec.thresholdTokens) return null
```

so a prune pass that frees enough tokens means no summarization is paid for at all.
The preset replaces the shipped trimmer with
`presets/arya-claude/pruner.js` (`arya-claude-microcompact`), which:

1. trims the middle of any single tool result over 8,192 characters
   (4,096 head / 1,024 tail — the same budgets as the shipped row), then
2. clears the bodies of tool results older than the most recent **12**, replacing
   them with `[Earlier tool output cleared to save context]`, when the whole pass
   frees at least **20,000 tokens**.

Rules that matter:

- a result that carries an image, a file or any non-text block is never cleared —
  silently dropping rich content is worse than a bigger context;
- an already-cleared result is not counted twice;
- every replacement uses the shipped replay protocol: a `compaction/prune`
  shadow-price event prices the node being shadowed, then the `tool/result`
  replacement is appended with a `replace` surface op and the shadowed seq, so pure
  replay consumers stay consistent.

Both thresholds are policy values (`keepRecentToolResults`,
`minMicroCompactTokens`); the row config only sets the trim budgets.

## 5. The summarizer circuit breaker

Claude Code stops automatic compaction for the rest of a session after three
consecutive failures instead of paying another failing summarization call on every
later step. `presets/arya-claude/engine.js` wraps `compactIfNeeded` with that
breaker:

- it gates the **automatic pressure path only**;
- a success resets the count;
- **manual `/compact` is never gated**;
- **provider overflow recovery is never gated** — the request was already too large
  to send, so the session needs the reduction;
- the limit is `autoCompactFailureLimit` (3 by default) and is read per failure, so
  a policy change applies without a new engine.

The breaker reports on stderr only with `ARYA_CLAUDE_DEBUG=1`, so a silent
malfunction is not silent: the log distinguishes "attempted and failed" from
"skipped because the breaker is open".

## 6. Composition: the full DSH tool row set

The row list is Arya Standard's, and Arya Standard mounts the full shipped
`standard` tool set: the `delegation` group (its own isolated `workflowEngine`
realm, the same five rows) and `tool-schedule` are part of the derived list, not
added here. Claude Code fans out to subagents (`subagent` / `subagent_fork`) and
schedules work, so this preset has exactly the capability the shipped `standard`
preset does — no insertion, no duplicate row id. Parity is about the tool rows:
the compaction pipeline below stays this preset's own.

## 7. What is deliberately not implemented

These are Claude Code behaviours the preset does **not** reproduce, with the reason:

| Claude Code behaviour | Why not here |
| --- | --- |
| Post-compact message injection (files re-read from disk, plan/skills re-attached) | The compaction transaction appends exactly the summary replacement; a preset cannot inject messages into it. The recently-read-files section is the safe substitute. A future row could react to `compaction/summary` and inject at the next `agent/pre-step`; that needs a live loop test first. |
| Blocking stop hook ("do not stop until tests pass") | The harness's `turn/stopping` dispatch is observational: a hook cannot veto a stop. Needs a harness-level `kind: "decide"` waterfall. |
| "Context low (N% remaining)" in the chat surface | The Compaction tab already draws the live gauge against the threshold; an in-chat warning would need a client surface this preset does not own. |
| `/compact [instructions]` | The harness's `/compact` takes no arguments. The shared settings group carries `compactPromptOverride` instead. |
| `--max-turns` / `--max-budget-usd` terminal reasons | Those are loop-level controls; a preset cannot replace the turn machine. |
| Prompt-cache-prefix summarization fork, idle/precompute compaction | The harness's summarizer already replays the conversation prefix for cache reuse; idle precompute is not exposed as a seam. |
| Partial "summarize from/up to here" | No harness seam for partial ranges. |

The loop itself is the harness's (`ReactLoopAgent`); a preset changes the prompt,
the tool rows and the compaction rows, and nothing else. That boundary is the same
one every preset in this bundle respects.

## 8. Tuning

Arya Claude shares the `aryaStandardOptions` settings group and the Compaction tab
with Arya Standard, exactly as Arya Qwen does. The tab folds `compaction/*` events
from every session, so Claude checkpoints appear in the same cards, trajectory and
log.

What the shared group controls: the summarizer route, the checkpoint budget, the
verbatim tail, the retry counts, and the checkpoint-instruction override. What the
preset pins (and the Settings page therefore does not move for this preset) is the
two arithmetic values and the Claude pipeline defaults — trigger levels, the
microcompact thresholds, the failure limit, the recent-file limit. Those live in
`presets/arya-claude/policy.js`'s declared defaults; a hand-edited policy row is
clamped and used.

One coupling to know: turning the **Arya Standard preset** switch off removes the
shared projection, so the Compaction tab has nothing to draw for any preset
(including Arya Qwen today). The preset rows themselves keep working.

## 9. Verification

- `test/arya-claude.spec.mjs` — identity, the exact derived row list (the shared
  23-row parity list), the inherited delegation-group shape, the authored prompt's
  anchors and forbidden tokens, the nine-section checkpoint text, the policy
  defaults and clamping, the pinned engine config (including that every key is
  inside `compaction-basic`'s closed set), the exported subpaths, recently-read-file
  extraction, pruner budgets and the microcompact planner, the breaker state
  machine, and the mount's registration and no-registry tolerance.
- `test/arya-claude-compaction.spec.mjs` — a stub-host summarization run: the
  instruction as the last message, the policy override, the two-sided frame, the
  analysis strip and envelope unwrap, the recently-read-files section, the small-span
  refusal with the preset label, the kit's validation messages, and the private
  waterfall namespace.
- The kit changes in `presets/arya-standard/compaction.js` are backwards
  compatible: every new option defaults to the old behaviour, and
  `test/arya-standard-compaction.spec.mjs` still drives the Codex path.

### Live verification (2026-11-03)

The preset was exercised in a development Host built from the AryaCode source
checkout (`dsh --profile livecheck`, DSH 0.2.1-rc.3 CLI, the plugin installed from
its packed tarball, a scriptable mock LLM behind `DEEPSEEK_BASE_URL` so no real
provider was called):

- the **preset picker listed Arya Claude** with its description, which means the
  definition was registered and passed the registry's validation;
- a session was created under it; the session log records
  `agent-preset/selected {"agentPreset":"arya-claude"}` and every preset row
  mounted (a broken row or a missing service would have failed session creation);
- two turns completed through the mounted persona and tool rows;
- `/compact` committed a real transaction:
  `compaction/start` → `compaction/summary` → `compaction/end` (no error), with
  `shadowedTokenCount: 1447`, `provider/model` recorded, `llmStreamCall: true`, and
  the summary text exactly the authored frame:
  `continues an earlier conversation…` + the checkpoint body + `Resume the work…`;
  the command surface rendered `Compacted 6 history items (~1447 tokens)`;
- the **Compaction tab rendered the live checkpoint** for that session (1 manual
  checkpoint, 1.4k tokens freed, trajectory with a fold marker);
- a **follow-up turn after the compaction completed**, so the loop resumed on the
  compacted surface.

Not exercised live: microcompact (it needs real pressure at the pinned threshold,
i.e. a very large context) and the circuit breaker (it needs three summarizer
failures). Both are covered by the unit specs; the mock-host run proves the rows
that would perform them mounted.

## 10. Licensing

Claude Code's prompt text is proprietary and none of it is included. The persona
and checkpoint prose here was written for this bundle; the *structure* (nine
sections, analysis scratchpad, summary envelope, continuation framing) follows the
publicly documented behaviour. Arya Standard and Arya Qwen vendor Apache-2.0 text
with licence files; this preset has no equivalent upstream text to license.

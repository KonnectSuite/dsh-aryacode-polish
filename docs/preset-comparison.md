# The presets compared: Standard, Arya Standard, Arya Qwen

This bundle ships two agent presets beside the harness's own. This page is the
detailed comparison: what each one actually changes, the numbers behind it, and
which one to pick.

## 0. The one rule that shapes everything

**A preset cannot replace the agent loop.** Whichever preset a session mounts, the
turn machine is DSH's `ReactLoopAgent`: it samples, dispatches tool calls, and
decides whether to continue. A preset is a *composition* — a list of plugin rows —
so it can change what the model is told, which tools exist, and how compaction
behaves, but not the machine underneath.

That is why none of these presets is "Gemini CLI's loop" or "Codex's loop". Arya
Standard is Codex's prompt and compaction policy; Arya Qwen is Qwen Code's prompt
and compression prompt. Both run on DSH.

The preset is chosen **when a session is created** and fixed for its life. On this
machine the default is `arya-standard` (`agent-preset-registry.selectedDefault`), so
new sessions get it unless you pick otherwise. Changing the default affects new
sessions only.

## 1. What each layer is allowed to change

| Layer | Owned by | Preset can change it? |
|---|---|---|
| Turn machine, sampling loop, step scheduling | harness | **no** |
| System prompt / persona | `dsh-persona` row config | yes |
| Tool surface (which tool packages mount) | rows | yes |
| Compaction policy and checkpoint format | rows in the `compaction` group | yes |
| Approval policy, sandbox | harness | no |
| Runtime context section | harness (`includeRuntimeContext`) | kept on, not replaced |
| Memory, hooks | bundle-wide features | no — shared by every preset |

## 2. Side by side

| | **Standard** (shipped) | **Arya Standard** | **Arya Qwen** |
|---|---|---|---|
| Persona source | one-line harness default | Codex base instructions, adapted | Qwen Code instructions, adapted |
| System prompt | 5,695 chars | 11,637 chars | 12,109 chars (persona alone) |
| Tools | 145 | **133** | **133** (same rows) |
| Tool-schema chars | 123,050 | **105,913** | **105,913** |
| Delegation / schedules / plugin manager tools | present | absent | absent |
| Compaction engine | `compaction-basic` | our subclass, Codex kit | our subclass, Qwen kit |
| Checkpoint prompt | base's 8 sections | Codex `CONTEXT CHECKPOINT COMPACTION` (425 chars) | Qwen Code compression prompt (3,583 chars) |
| Frame | base preamble | 399-char handoff **prefix** | 168-char resume **suffix** |
| User messages kept verbatim | — | up to 20k tokens | none (summarizer reproduces them) |
| Triggers | pre-step pressure only | pre-warm 70 %, post-turn 90 %, absolute limit | identical to Arya Standard |
| `<analysis>` scratchpad | n/a | n/a | stripped before commit |
| Minimum body | — | none (end-truncation) | **800 tokens**, else the fold is refused |
| Policy service | — | `aryaStandardPolicy` | `aryaQwenPolicy` |
| Policy knobs | — | shared settings group | shared settings group |

Rows are **derived**: `presets/arya-qwen/definition.js` builds Arya Standard's
definition and rewrites exactly three things — the persona, the two compaction rows,
and the policy `keepUserTokens` value. Everything else (plan mode, the tool list,
the pruner, the manual `/compact` command) is Arya Standard's by construction, and a
spec asserts the two row lists are identical in id and order.

## 3. The prompts

**Standard** contributes almost nothing: a one-line identity, and the model leans on
tool descriptions plus runtime context.

**Arya Standard** carries Codex's base instructions (plan-first workflow, editing
constraints, ASCII default, final-message rules) followed by a short
harness-capabilities section that points the model at `ask_user_question`,
`todo_write`, `exit_plan_mode`, goals, skills, `present` and the web tools. Measured
effect against Standard on an identical task: **≈ −2,800 prompt tokens per step
(−8.1 %)**, because the 17 KB of dropped tool schemas outweigh the 6 KB of added
instructions. See [the verification report](arya-standard-verification.md#3-token-effect-measured-on-the-same-task).

**Arya Qwen** carries Qwen Code's structure — Core Mandates, Primary Workflows
(software engineering and new applications), Operational Guidelines (communicating,
tone, security, tool use) — with its tool names mapped onto this harness's
(`read`, `write`, `edit`, `grep`, `glob`, the shell tool, `todo_write`,
`exit_plan_mode`, `skill`, `ask_user_question`, `web_fetch`). At 12,109 chars it is
the longest of the three: Qwen Code's instructions are more prescriptive than
Codex's, and the tool surface is the same as Arya Standard's, so the only added cost
is prompt text.

The vendored Qwen prompt is extracted from `packages/core/src/core/prompts.ts` by a
script, not retyped, and a spec forbids extraction holes: no `${…}`
interpolations, no `@TOOL`/`@AGENT` placeholders, no `tools.<name>` receivers, no
Qwen-only tool names. Qwen Code machinery this harness lacks — interaction modes,
`UserPromptSubmit` hooks, agent teams, cron/task tools, LSP, programmatic tool
calling, the `qwen` CLI — is removed, and the removals are listed in the header of
`presets/arya-qwen/prompt.md`.

## 4. The fold: what actually happens

All three mount `compaction-basic`, which owns the trigger evaluation, the durable
lock, the event transaction and the shrink guard. The presets differ only in the
`summarize()` swap and the policy row.

**Standard** asks for eight fixed Markdown sections and commits the answer with the
base preamble. No post-turn fold, no verbatim user retention, no trigger beyond the
pre-step pressure check.

**Arya Standard** asks for Codex's checkpoint: dense prose, a handoff sentence in
front, up to 20k tokens of the user's own messages quoted verbatim underneath
(capped at half the replaced span), and a prefix the engine recognises so a previous
checkpoint is never re-quoted as user text.

**Arya Qwen** asks for Qwen Code's envelope:

```
<analysis> …drafting scratchpad, stripped before commit… </analysis>
<state_snapshot>
  <primary_request_and_intent> <key_technical_concepts> <files_and_code_sections>
  <errors_and_fixes> <problem_solving> <all_user_messages> <pending_tasks>
  <current_work> <next_step>
</state_snapshot>
Resume the prior task using the summary above. …
```

Three differences matter operationally:

1. **The scratchpad is stripped.** Qwen Code asks the summarizer to reason inside
   `<analysis>` and then discards it; keeping it would waste tokens and pull the
   resuming agent toward the summary's drafting rather than its conclusion.
2. **The trailer is appended, not generated.** It lives in the wrapper, so the
   summarizer does not re-emit it on every fold — fewer output tokens and no wording
   drift.
3. **The envelope is not truncatable.** Cutting it at the end drops `<next_step>`,
   the section a resuming agent needs most. Arya Qwen therefore sets
   `minBodyTokens: 800`: if the replaced span cannot hold the envelope, the fold is
   skipped (manual `/compact` reports why), and the session keeps its history.
   Arya Standard keeps end-truncation, which is harmless for prose.

Everything else in the fold is shared and identical: the pre-warm gate (70 %),
the post-turn gate (90 %), the absolute token limit, `dropOldestRetries` (2), the
tool-result pruner (8,192 chars, 4,096 head, 1,024 tail), and the thread/turn
budget scope.

## 5. What only Standard can do

Because Arya Standard and Arya Qwen share a row list, they share its omissions. If
you need any of these, use **Standard**:

- `subagent`, `subagent_fork`, `workflow`, `send_message`, `list_agents`,
  `interrupt_agent`, `list_subagent_models` — parallel exploration and delegation
- `schedule_create`, `schedule_list`, `schedule_delete`, `schedule_update` —
  scheduled/automation jobs
- `plugin_manager` — installing or disabling plugins from chat

Conversely, Arya Standard and Arya Qwen both keep plan mode, `todo_write`,
`ask_user_question`, goals, skills, `present`, jobs, the web tools and the full
filesystem/shell set.

## 6. Evidence

**Static.** 503 tests on the 0.111.x line. The interesting ones for this comparison:
the two row lists are identical in id and order; the Qwen persona contains no
extraction hole; the Qwen kit frames with a suffix and refuses an empty frame; the
floor rejects a span the envelope cannot fit.

**Live, Arya Standard** (verification report, 0.103.6, local model): a manual
`/compact` committed checkpoint `fa292fcf` — 4 nodes replaced, 976 tokens freed —
whose body opens with Codex's handoff sentence.

**Live, Arya Qwen** (2026-11-01, dev profile, 0.111.0): a session recording
`agent-preset/selected: arya-qwen`, one shell call (`echo arya-qwen-ok`, reply
`arya-qwen-ok`), 69.1k input tokens, 3 s. Then `/compact` committed a checkpoint
whose body **starts with `<state_snapshot>`**, has **no `<analysis>` block**, and
carries the resume trailer — the two properties the port adds. That same run
exposed the truncation defect: the checkpoint had **8 of 9 sections**, missing
`next_step`, which is what the 0.111.1 floor stops shipping. The log line
`Compacted 6 history items (~1029 tokens).` is why: a span that small cannot hold a
3.5 KB envelope.

## 7. Choosing

| If you… | Use |
|---|---|
| need subagents, scheduled jobs, or in-chat plugin management | **Standard** |
| want Codex's working style and checkpoints, on any model | **Arya Standard** |
| run Qwen models and want their prompt's structure and its XML checkpoint | **Arya Qwen** |
| are unsure | **Arya Standard** — it is the default, and it is the one with a measured token win |

Presets are per session, so this is a per-task choice, not a global setting. Memory
and hooks are bundle-wide: every preset sees the same notes and the same hooks file.

## 8. Boundaries

- **No preset is a foreign loop.** The turn machine is DSH's in all three.
- **Not byte-identical prompts.** Arya Standard adapts Codex's text to the harness's
  tool names; Arya Qwen carries the extracted default configuration of Qwen Code's
  runtime-assembled prompt, minus sections the harness cannot honour.
- **Thinking parameters are out of scope.** `enable_thinking`, thinking budgets and
  `reasoning_content` belong to the LLM adapter plugin; Arya Qwen neither reads nor
  sets them.
- **No projection per preset.** The Compaction tab folds one `aryaStandard`
  projection over every session, and both engines commit the same `compaction/*`
  events, so Qwen checkpoints appear in the same cards.
- **Qwen Code's microcompaction is not ported.** Upstream has a two-tier scheme
  (clear old tool results by tool class, then compress). This bundle has the pruner
  and the checkpoint but not the per-tool-class clearing; that is the next thing
  worth taking from Qwen Code.
- **Very short sessions do not fold under Arya Qwen.** Below roughly 800 tokens of
  headroom for the body, the envelope cannot be written whole, so the fold is
  skipped by design.

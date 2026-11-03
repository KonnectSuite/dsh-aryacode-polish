# The presets compared: Standard, Arya Standard, Arya Qwen, Arya Automation Engineer

This bundle ships three agent presets beside the harness's own. This page is the
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
and compression prompt; Arya Automation Engineer is our own engineering contract,
written for `dsh-engineering`. All three run on DSH.

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

| | **Standard** (shipped) | **Arya Standard** | **Arya Qwen** | **Arya Automation Engineer** | **Arya Claude** |
|---|---|---|---|---|---|
| Persona source | one-line harness default | Codex base instructions, adapted | Qwen Code instructions, adapted | written for this preset from `dsh-engineering`'s loop | authored prose in Claude Code's idiom |
| System prompt | 5,695 chars | 11,637 chars | 12,109 chars (persona alone) | **5,106 chars** (persona alone) | **7,272 chars** (persona + capabilities) |
| Tools | 145 | **133** | **133** (same rows) | **133** (same rows) | **133 + delegation + schedule** |
| Tool-schema chars | 123,050 | **105,913** | **105,913** | **105,913** | larger (delegation, workflow and schedule tools are back) |
| Delegation / schedules / plugin manager tools | present | absent | absent | absent | **delegation + schedule**; plugin manager absent |
| Compaction engine | `compaction-basic` | our subclass, Codex kit | our subclass, Qwen kit | our subclass, **Codex kit** | our subclass, **Claude kit** |
| Checkpoint prompt | base's 8 sections | Codex `CONTEXT CHECKPOINT COMPACTION` (425 chars) | Qwen Code compression prompt (3,583 chars) | Codex (425 chars) | authored nine-section instruction (3,378 chars), `<analysis>` then `<summary>` |
| Frame | base preamble | 399-char handoff **prefix** | 168-char resume **suffix** | 399-char handoff **prefix** | 239-char continuation **prefix** + 204-char resume **suffix** |
| User messages kept verbatim | — | up to 20k tokens | none (summarizer reproduces them) | **12k tokens** | none (checkpoint section 6 reproduces them) |
| Triggers | pre-step pressure only | pre-warm 70 %, post-turn 90 %, absolute limit | identical to Arya Standard | **pre-warm 65 %, post-turn 85 %**, absolute limit | pre-step pressure only, at `window − output − 13k` (`thresholdRatio` 0.99) |
| `<analysis>` scratchpad | n/a | n/a | stripped before commit | n/a | stripped before commit |
| Minimum body | — | none (end-truncation) | **800 tokens**, else the fold is refused | none (end-truncation) | **600 tokens**, else the fold is refused |
| Tool-result pruner | 8,192 / 4,096 / 1,024 | same | same | **16,384 / 8,192 / 2,048** | 8,192 / 4,096 / 1,024 **plus microcompact** |
| Microcompact (clear old tool results) | — | — | — | — | **keep the most recent 12, clear when the pass frees ≥ 20,000 tokens** |
| Recently read files in the checkpoint | — | — | — | — | **up to 5 paths, newest first** |
| Summarizer failure breaker | — | — | — | — | **3 consecutive automatic failures, session-scoped; manual `/compact` and overflow recovery stay available** |
| Policy service | — | `aryaStandardPolicy` | `aryaQwenPolicy` | `aryaStandardPolicy` (own realm) | `aryaClaudePolicy` |
| Policy knobs | — | shared settings group | shared settings group | engineering defaults, shared group | shared settings group; the window arithmetic and Claude pipeline defaults are pinned |

Rows are **derived**, not copied. `presets/arya-qwen/definition.js` builds Arya
Standard's definition and rewrites the persona, the two compaction rows and the
policy `keepUserTokens`; `presets/arya-automation/definition.js` rewrites the
persona, the two compaction rows' **values** and the pruner. Everything else (plan
mode, the tool list, the manual `/compact` command) is Arya Standard's by
construction, and a spec asserts all three row lists are identical in id and order.

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

**Arya Automation Engineer** has no upstream to adapt: no agent ships an opinion
about a controller download, a rung id or an ME display import. Its persona
(`presets/arya-automation/persona.md`, 5,106 chars) is written here, and it is the
shortest of the three because it argues one thing rather than everything:

- **the loop as a contract** — point at the work, read before writing, act in a copy,
  verify with the vendor engine, hand off what is human;
- **gates** — never write to a running controller unless the request names it, never
  treat a download as proof, never claim equivalence from a diff, never invent an
  instruction or address, never route around a denied call;
- **identity discipline** — every finding names the file, project, revision, program,
  routine, rung, display or tag address;
- **honesty** — a failed check is quoted, an unrun check is called unrun, and the
  message ends with what changed, what passed, and what a human must do next.

It also names the four product probes (`studio_sdk_status`, `ftview_capabilities`,
`mw_ide_status`, `optix_status`) so a session starts by finding out which half of a
surface exists.

## 4. The fold: what actually happens

All four mount `compaction-basic`, which owns the trigger evaluation, the durable
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

**Arya Automation Engineer** uses the Codex checkpoint unchanged — an engineer's
handoff reads well in prose — and moves the knobs around it instead. Engineering
sessions are read-heavy: a single L5X read can be tens of thousands of tokens, and
the transcript is mostly quoted tool output rather than the user's own words. So it
folds earlier and keeps more of a read:

| Knob | Arya Standard | Automation Engineer |
|---|---|---|
| pre-warm | 70 % | **65 %** |
| post-turn | 90 % | **85 %** |
| minimum fold | 4,000 tokens | **6,000 tokens** |
| verbatim user text | 20,000 tokens | **12,000 tokens** |
| tool-result pruner | 8,192 / 4,096 / 1,024 | **16,384 / 8,192 / 2,048** |

Everything else in the fold is shared and identical: the absolute token limit,
`dropOldestRetries` (2), and the thread/turn budget scope.

## 5. What only Standard can do

Because all three Arya presets share a row list, they share its omissions. If you
need any of these, use **Standard**:

- `subagent`, `subagent_fork`, `workflow`, `send_message`, `list_agents`,
  `interrupt_agent`, `list_subagent_models` — parallel exploration and delegation
- `schedule_create`, `schedule_list`, `schedule_delete`, `schedule_update` —
  scheduled/automation jobs
- `plugin_manager` — installing or disabling plugins from chat

Conversely, all three Arya presets keep plan mode, `todo_write`,
`ask_user_question`, goals, skills, `present`, jobs, the web tools and the full
filesystem/shell set.

## 6. Evidence

**Static.** 512 tests on the 0.112.x line. The interesting ones for this comparison:
the three row lists are identical in id and order; the Qwen persona contains no
extraction hole; the Qwen kit frames with a suffix and refuses an empty frame; the
floor rejects a span the envelope cannot fit; the engineering persona states the
loop, the gates and the honesty rules; the ledger classifies engineering tool names
and keeps a failed check red until a retry replaces it.

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

**Live, Arya Automation Engineer** (2026-11-01, dev profile, 0.112.1, the 0.22.2
Engineering bundle): a session on the preset opened `FC1000495_AFR.direct.L5X`, ran
`project_overview` and `run_checks`, and *answered in the persona's voice* — it
ended with "What this does not prove" and "nothing was modified, so there is no
hand-off step for a human yet". The Engineering tab agreed with it: READ (2 reads)
and CHECKS (passing) lit, WRITE / VERIFY / LIVE grey, the L5X path and project id in
the artifact list, `run_checks` succeeded as the last tool. That release line also
found a client bundle that did not parse; 0.112.1 fixed it and added a
`node --check` gate to the build.

## 7. Choosing

| If you… | Use |
|---|---|
| need subagents, scheduled jobs, or in-chat plugin management | **Standard**, or **Arya Claude** for subagents and scheduling with the Claude loop |
| want Codex's working style and checkpoints, on any model | **Arya Standard** |
| run Qwen models and want their prompt's structure and its XML checkpoint | **Arya Qwen** |
| want Claude Code's checkpoint shape, window arithmetic and two-level compression | **Arya Claude** |
| work in Studio 5000, FactoryTalk View ME, MotionWorks or Optix | **Arya Automation Engineer** (ships in `@aryacode/dsh-engineering`) |
| are unsure | **Arya Standard** — it is the default, and it is the one with a measured token win |

Presets are per session, so this is a per-task choice, not a global setting. Memory
and hooks are bundle-wide: every preset sees the same notes and the same hooks file.

## 8. Boundaries

- **No preset is a foreign loop.** The turn machine is DSH's in all four.
- **Not byte-identical prompts.** Arya Standard adapts Codex's text to the harness's
  tool names; Arya Qwen carries the extracted default configuration of Qwen Code's
  runtime-assembled prompt, minus sections the harness cannot honour; Arya Automation
  Engineer is written here, so it is ours to defend line by line.
- **Thinking parameters are out of scope.** `enable_thinking`, thinking budgets and
  `reasoning_content` belong to the LLM adapter plugin; no preset here reads or sets
  them.
- **No projection per preset.** The Compaction tab folds one `aryaStandard`
  projection over every session, and both engines commit the same `compaction/*`
  events, so Qwen checkpoints appear in the same cards.
- **The Engineering tab is a name table.** It classifies tool calls into Read,
  Check, Write, Verify and Live by explicit tool names; a future engineering tool
  absent from that table will not appear until it is added, because the tab never
  guesses from a prefix.
- **The automation preset inherits its tools.** It does not re-mount the Engineering
  bundle's rows; those belong to the installed bundle and stay visible to every
  preset. A preset is an additive scope, so this one cannot hide the engineering
  tools a session does not need.
- **Qwen Code's microcompaction is not ported.** Upstream has a two-tier scheme
  (clear old tool results by tool class, then compress). This bundle has the pruner
  and the checkpoint but not the per-tool-class clearing; that is the next thing
  worth taking from Qwen Code.
- **Very short sessions do not fold under Arya Qwen.** Below roughly 800 tokens of
  headroom for the body, the envelope cannot be written whole, so the fold is
  skipped by design.

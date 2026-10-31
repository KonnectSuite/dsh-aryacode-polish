# Arya Standard

An agent preset that compacts the way [Codex](https://github.com/openai/codex)
does, shipped inside this bundle.

The preset is declared as data — `presets/arya-standard/definition.js` — and
registered through the Host's preset registry when the **Arya Standard preset**
switch is on. It then appears in the session picker next to the shipped presets,
and a session mounts it like any other: one composition, one row id.

## What it changes

| Part | Shipped `standard` | Arya Standard |
| --- | --- | --- |
| System prompt | "You are a coding agent…" plus the harness runtime context | Codex's own instructions, adapted once at registration to this harness's tool names |
| Compaction backend | `compaction-basic` | `compaction-basic` with the `summarize()` hook replaced |
| Checkpoint instruction | eight fixed Markdown sections | Codex's `CONTEXT CHECKPOINT COMPACTION` prompt |
| Checkpoint framing | `<compacted-summary>` tags | Codex's `SUMMARY_PREFIX` handoff sentence, then the summary |
| What survives | a priced recent tail of the whole surface | Codex's summary framing plus up to 20k tokens of the user's own messages, quoted verbatim, over a verbatim tail |
| Subagents | `delegation` group | not mounted |
| Scheduled jobs | `tool-schedule` | not mounted |
| In-app plugin installs | `tool-plugin-manager`, `tool-plugin-market` | not mounted |

Everything else — the file, shell, search, skill, goal, plan, todo, web and
present tools, the `tool-result-pruner`, `/compact` — is the shipped toolset.

## The difference from `standard`, measured

Both presets mount the same `ReactLoopAgent`; a preset cannot replace the turn
machine. What differs is observable in a session log:

- **toolset** — an Arya Standard session declares exactly twelve fewer tools than a
  `standard` session: `interrupt_agent`, `list_agents`, `list_subagent_models`,
  `plugin_manager`, `schedule_create`, `schedule_delete`, `schedule_list`,
  `schedule_update`, `send_message`, `subagent`, `subagent_fork`, `workflow`;
- **prompt** — Codex's instructions, adapted once at registration;
- **compaction** — `compaction/summary` written by this bundle's `summarize()` hook
  carries Codex's handoff prefix and the verbatim user section, where `standard`
  writes the eight-section template wrapped in `<compacted-summary>`.

Everything else about a turn — when it starts, whether it continues, how tool calls
are dispatched — is the driver's, and identical in both presets.

## Why the engine is a subclass, not a rewrite

`@deepseek-ai/dsh-compaction` exports an abstract `CompactionEngine` whose base
class is empty: every behaviour — when to compact, which span is safe to split,
the durable `compaction/start` lock, stability revalidation, the shrink guard, the
single replacement message — lives in `compaction-basic`, and that package
documents `summarize(input, agent, signal)` as the one subclass hook.

So this bundle overrides exactly that hook (`presets/arya-standard/compaction.js`)
and nothing else. The consequences are deliberate:

- a failed summarization still leaves the blocking orphan `compaction/start` that
  the base engine's crash recovery expects, instead of a half-committed checkpoint;
- the summary is still refused when it would not shrink what it replaces — the
  verbatim user section is the part that gets dropped, never the summary;
- the auxiliary request is still replayed over the shadowed span, so it is a warm
  prefix rather than a cold one.

## What Codex does that this cannot

Codex's loop is a turn machine: it samples, runs the tool calls, and decides
mid-turn whether to roll into a new context window before the next sample. DSH's
`ReactLoopAgent` is not replaceable from a preset, so the parts that belong to the
loop are documented gaps rather than approximations:

- **post-turn compaction thresholds** (`model_post_turn_compact_threshold_percent`)
  — DSH compacts at step pressure and on a confirmed context-window error instead;
- **token-budget reminders and the auto-compact fallback prompt** — no equivalent
  fragment is injected near the limit;
- **speculative/async compaction** of a finished history.

The retention difference is approximated, not reproduced. Codex rebuilds the
history as "every real user message (up to 20k tokens) plus one summary", dropping
every assistant and tool turn. DSH needs a verbatim tail: the loop resumes on the
surface, so replacing the newest step too makes the model lose the thread and stop
mid-task. The default is therefore Codex's user-quote section on top of DSH's own
retention (`retainRatio` 0.16), and the user-quote budget is half of what is
replaced rather than a tenth, so a conversation whose user messages are small still
carries their wording.

The `keepUserTokens` section is dropped whenever adding it would make the
checkpoint stop being smaller than the span it replaces — the base engine's shrink
guard, which a summary must never trip.

## Knobs

Settings → **Arya Standard**, or this row's Configure page. The group is
`aryaStandardOptions` on the `polish` row, and it is deliberately **not**
volatile: editing it re-runs `apply()` and rebuilds the definition, so sessions
created afterwards mount the new numbers while a running session keeps the ones it
started with.

| Knob | Default | What it does |
| --- | --- | --- |
| Compact automatically | on | Off leaves `/compact` as the only trigger. |
| Threshold | 0.9 | Fraction of the context window at which a compaction is worth starting. |
| Headroom | 16000 | Tokens held back below the model's window, so the summary request itself fits. |
| Verbatim tail | 0.16 | Fraction of the window kept unsummarized after a checkpoint. Codex keeps none; a live tool loop needs its last step. |
| Checkpoint budget | 20000 | Output cap for the summary request. |
| Keep the user's words | 20000 | Upper bound on the verbatim user section; also capped at half of what is replaced, and dropped when it would trip the shrink guard. |
| Summary retries | 1 | Retries for a failed summarization. |
| Overflow retries | 1 | Retries after a provider-confirmed context-window error. |
| Summarizer provider / model | empty | Empty means "the model this session last routed to". |

## The Compaction tab

A **Compaction** view beside Chat and Trajectory, for every session — not only the
ones running the preset, because the numbers are worth seeing either way. Five
tabs:

- **Overview** — the live context pressure against the window and this preset's
  threshold, a stat row (checkpoints, tokens freed by compaction, requests, input
  tokens, cache hit rate), the trajectory, and **Compact now**, which runs
  `/compact` through the session's own command surface;
- **Trajectory** — one line per billed request (`inputTokens + cacheReadTokens`)
  against the window and threshold lines, with a mark at every checkpoint so a
  fold is visible next to the drop it caused, and a strip of how much of each
  request was already cached;
- **Checkpoints** — one card per committed checkpoint: messages replaced, tokens
  freed, sequence range, the model that wrote it, the summary text, manual or
  automatic;
- **Logs** — checkpoints and failed attempts, in time order, including the failure
  the base engine recorded on `compaction/end`;
- **Settings** — the same policy form as the Settings page and the row Configure
  page.

The data comes from the `aryaStandard` projection (`projection.js`, state version
2), which folds `request/context`, `assistant/message` usage, `compaction/summary`
and `compaction/end` out of the durable session log — the provider's own numbers,
not an estimate the browser makes up. No route of our own, no iframe: the tab
renders the same projections the rest of the chat does.

## Verifying it

1. `pnpm test` — the declaration, the summarizer hook and the browser surfaces.
2. `pnpm pack`, install into Dev AryaCode, reload.
3. Start a session, pick **Arya Standard**, run a few turns, then `/compact`.
4. The checkpoint's replacement message starts with Codex's handoff sentence; the
   **Compaction** tab shows one card, the trajectory gains a fold mark, and the
   gauge drops.

## Reading a session log

`compaction/summary` records everything the tab draws: `shadowedTokenCount`,
`shadowedRange`, `provider`, `model`, `maxTokens`, and the usage of the auxiliary
request. A checkpoint written by this preset is recognisable without any UI: its
replacement `user/message` begins with `SUMMARY_PREFIX`
(`Another language model started to solve this problem…`), while `compaction-basic`
writes `This is an automatically generated checkpoint…` and the
`<compacted-summary>` tags. `prefix` plus one text block means the verbatim user
section was dropped by the shrink guard.

## Attribution

`presets/arya-standard/prompt.md`, `checkpoint-prompt.md` and `summary-prefix.md`
are copied from [openai/codex](https://github.com/openai/codex) (`codex-rs/core/`
and `codex-rs/prompts/templates/compact/`), which is Apache-2.0; the licence text
is vendored beside them as `CODEX-LICENSE`. Only the base prompt is adapted, and
`adapt.js` lists every substitution so the differences are auditable.

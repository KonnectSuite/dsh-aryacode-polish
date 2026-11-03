# Handoff — a local-LLM agent preset

**Status: design agreed, no code written.** This is the briefing for whoever picks
this up: the decisions that are settled, the mechanism that constrains the design,
the core tool list, and the two spikes that must pass before anything else is built.

Date: 2026-11-02. Repo: `C:\Users\KNPhu\.arya\github\KonnectSuite\dsh-aryacode-polish`
(public, `main`). Working name in this document: **Arya Local** — not yet chosen.

## The goal

A preset derived from **Arya Standard**, for local models with small context
windows (4k–16k). The harness's own tools stay loaded. Every **third-party** tool
— MCP servers, plugin bundles — is hidden by default and loaded only when the job
needs it, then unloaded.

The point is prompt budget, not capability: a small model cannot afford 10k tokens
of tool schemas it will not use in this task.

## Decisions taken

1. **Core stays, third-party goes.** Do not shrink the shipped tool set; hide
   everything that is not shipped. (An earlier proposal trimmed core tools and was
   rejected — correctly.)
2. **One group per package**, and one group per MCP server. Not verb sub-groups.
   The loader can still narrow at load time with `only: [...]`.
3. **A runtime gate, not a trimmed row list.** A preset row applies a per-agent
   tool restriction; it does not remove registration.
4. **The catalog is generated from the live registry**, never hand-written, so a
   server added tomorrow appears without a code change.
5. **One extra step to load is acceptable**; the deterministic router removes it
   for predictable requests.

## The mechanism, and why it must be this shape

The harness resolves the **visible tool set per step**, and an executor may only
call tools in that step's resolved set (`packages/core/tools/src/index.ts`). A
hidden tool does not merely disappear from the prompt: naming it returns
`UNKNOWN_TOOL`. Therefore:

- **A policy cannot admit a tool on the way through.** The model cannot call a
  hidden tool and have it work in the same step.
- **Loading costs exactly one step**: the model calls the loader, the loader's
  result lands, and the next step's prompt carries the new schemas.
- Offloading (unloading) is free and immediate: the next step simply lacks them.

That trade — one cheap step versus thousands of tokens every step — is the whole
design. Everything below exists to make the load rare and the unload safe.

### The three pieces

**1. The gate — a preset row that calls `ctx.tools.restrict()`**

`restrict(filter)` lives in `@deepseek-ai/dsh-tools`
(`packages/core/tools/src/index.ts:162`). It:

- requires a **scoped context** (`agent.ctx`) and throws otherwise — "a
  context-global restriction would mask every agent";
- takes `{ allow }` and/or `{ deny }`, rejects an empty filter, and rejects names
  the scope cannot see, **listing the known names in the error** (useful as a
  diagnostic);
- intersects with other restrictions, and returns a disposer that lifts this one.

It is public and **used nowhere in the codebase today** — we would be the first
caller. That is why Spike 1 below comes first.

**2. The catalog — ~10 tokens per group in the system prompt**

One generated line per group, e.g.

```
engineering — Studio 5000, FTView, migration tools (41 tools)
```

Built at assembly time from the live registry: every `mcp__<server>__*` name
becomes a group automatically (the MCP manager already enumerates these for its
tool counts), plus a small pattern table for plugin tools
(`l5x_*`, `ftview_*`, `migration_*`, image-gen, REA, …).

**3. The loader — two small tools**

- `tools_load(group, only?)` → admits the group (or the named tools of it).
- `tools_unload(group)` → hides it again.

`only:` is not optional polish: `wincu` is 25 tools and `engineering` is ~40, so
loading a whole package to take one screenshot must be impossible.

### The rules that keep it from degrading

| Rule | Why |
|---|---|
| Cap 2 loaded groups, LRU eviction | two 25-tool servers is already 10k tokens |
| `tools_load` refuses a group whose schemas exceed a set fraction of the window, and suggests `only:` | prevents the load that cannot fit |
| Idle unload after N turns | a group loaded for one question must not tax the session |
| Force unload at every compaction boundary | restore the known-small baseline |
| Never unload a group with a pending job or approval | the model would lose the tool mid-flight |
| Load is idempotent; unknown group errors list valid groups | a bad call costs one step, not the session |
| Every load result names the group, its tools and one line of "use when" | the model must be able to act on the very next step |
| The persona states the rule once: "third-party tools are not loaded; call `tools_load` first" | otherwise the model never knows the catalog is actionable |

### The deterministic router (the "smart" part)

A regex table evaluated against each user message **before step 1**, with no model
call:

```
/\bL5X|Studio 5000|PLC|rung|tag\b/i   → engineering
/screenshot|click|window|desktop/i   → wincu
/image|picture|generate/i            → image-gen
```

A match loads the group before the model speaks, so the common case costs zero
extra steps. The table is data: testable with a should-load / should-not-load
sentence list per group, no model in the loop.

## Core allowlist — ~15 tools, roughly 3–3.5k tokens of schema

`read` · `write` · `edit` · `read_image` · `grep` · `glob` · `pwsh` ·
`job_list` · `job_output` · `job_kill` · `todo_write` · `ask_user_question` ·
`present` · `skill` · `working_directory`

Left out of core, with the reason (this is the list to argue about):

| Left out | Why |
|---|---|
| `web_search` / `web_fetch` | two schemas that fail on an offline box — **open question 2** |
| goals (`create_goal`, `get_goal`, `update_goal`) | a long-horizon loop competing with `todo_write` for a small model's attention |
| subagents (6) | delegation multiplies context rather than saving it; local models are weak at it |
| `schedule_*` (4) | Host chores, not engineering |
| `workflow`, `load_workspace_dependencies` | large schemas for rare tasks |
| MCP resources (3) | only meaningful with a server loaded |
| `exit_plan_mode` | a whole plan file for one turn |

## Shipped inventory for reference

Mounted in a plugin-free composition (31 tools, all `@deepseek-ai/*`): the core
list above, plus `create_goal`/`get_goal`/`update_goal`, `subagent`,
`subagent_fork`, `list_agents`, `send_message`, `interrupt_agent`,
`list_subagent_models`, `web_search`, `web_fetch`, `schedule_create`,
`schedule_list`, `schedule_update`, `schedule_delete`, `workflow`,
`load_workspace_dependencies`, `list_mcp_resources`,
`list_mcp_resource_templates`, `read_mcp_resource`.

Ships but is **not** mounted here, so uninstalling anything does not reveal it:
`plugin_manager`, `plugin_market`, `run_code` (PTC), `exit_plan_mode`,
`cordis_inspect_*`, `terminal_*`, `lsp`, `ralph`, `str_replace_editor`,
`session_event_*`, `propose_action`, `stagehand_*`, `spawn_teammate`/`team_*`,
`create_worktree`, `subagent_oar`.

Two facts worth keeping: the MCP-resource tools are **shipped**, not third-party,
and are useless without a server; `bash` and `pwsh` are alternatives, never both.

## Third-party groups — one per package / server

| Group | Contents |
|---|---|
| `engineering` | `l5x_*` (~24), `ftview_*`, `migration_*`, live Studio/FTView tools |
| `image-gen` | `generate_image`, `edit_image` (+ workbench) |
| `rea` | reverse-engineering tools (native, managed, browser) |
| `wincu` | `mcp__wincu__*` — 25 tools, the extreme case for `only:` |
| `comfy` | `mcp__comfy__*` |
| any future server | auto-grouped from `mcp__<server>__*` |

## Compaction — proposed values, unvalidated

The shipped defaults assume a 128k window. Proposed for 8–16k, to be measured:

| Knob | Standard default | Proposed |
|---|---|---|
| `thresholdRatio` | 0.9 | 0.65 |
| `headroomTokens` | 16000 | 3000 |
| `maxTokens` | 20000 | 4000 |
| `retainRatio` | 0.16 | 0.10 |
| `keepUserTokens` | 20000 | 2000 |
| `postTurnThresholdPercent` | 90 | 75 |
| `preemptivePercent` | 70 | 55 |
| `minFreedTokens` | 4000 | 1500 |
| `dropOldestRetries` | 2 | 3 |
| pruner `thresholdChars/head/tail` | 8192/4096/1024 | 3000/1500/400 |

Two things the knobs cannot express, which may need code: a **minimum summary
body** low enough for a small span (the Qwen engine has an 800-token floor; a
small preset needs ~400 and a compact checklist format), and a **hard prompt
budget** so a single tool result cannot eat the window before compaction runs.

## Open questions — answer these before writing code

1. **`engineering` at 41 tools.** Package-level load is the decision; confirm that
   the model is expected to pass `only:` (and that a `tools_load` without `only:`
   is allowed but reported as expensive). Alternative: package-level load with the
   router supplying the first slice.
2. **Web tools in core?** Currently excluded. If the machine has a search
   provider, two schemas may be worth it.
3. **The name.** `arya-local`, `arya-small`, `arya-compact`.
4. **Target window and model.** The thresholds above assume 8k with 16k as the
   comfortable upper bound; the model's tool-calling reliability decides whether
   the router can be trusted to load *and* whether the loader can be skipped for
   small groups.
5. **Unload granularity.** Group only, or `tools_unload(group, only: [...])` too.

## Risks

1. **`restrict()` from a preset row is unverified.** It needs a scoped context;
   preset rows mount per agent, so it *should* work — but nobody has done it.
2. **Registration order.** `restrict({ allow })` validates names against what the
   scope can currently see. Core tools and MCP tools register asynchronously; a
   preset that applies the mask at mount time may name a tool that is not there
   yet, or may run before a server registers and thus never hide it. The policy
   likely has to be **re-applied when the registry changes**, not applied once.
   This is Spike 2.
3. **Thrash.** Load/unload every turn costs a step each way.
4. **False negatives.** The model never loads and gives up. The catalog plus the
   persona rule is the mitigation; the router is the safety net.
5. **Prompt cost of the catalog.** ~10 tokens per group; 10 groups is 100 tokens —
   acceptable, but it must be measured, not assumed.

## Verification plan

**Spike 1 (blocking, ~20 minutes).** A preset row that allows only `read`, then
ask a session to list its tools. Pass = the scoped context exists and `mcp__*`
tools from the MCP rows are absent. Fail = the whole approach needs a different
seam; do not build the loader.

**Spike 2 (blocking).** Register a tool after the mask is applied (start an MCP
server late). Pass = the new tool is hidden too.

**Router tests.** Per group: two sentences that should load it, two that should
not. A data table, no model call.

**Token accounting.** Assembled prompt size for: core only; core + catalog; core +
each group. Report the delta per group so the cap has a number behind it.

**Task suite.** Five tasks (read+edit a file, grep-and-fix, run tests, add a test,
multi-file change). Record turns, tokens, wall time, and the failure mode — gave
up / wrong file / repeated read / forgot the task. Without this, "optimised for
small models" is a claim, not a result.

## Where the code goes

```
presets/arya-local/definition.js   derives from arya-standard/definition.js, filters rows
presets/arya-local/plugin.js       mounts the preset with agentPresets
presets/arya-local/persona.md      short, imperative; the "load first" rule
presets/arya-local/fields.js       knobs (compaction values above) — mirrors arya-standard/fields.js
presets/arya-local/settings.js     readSettings + engineConfig/policyConfig, as arya-standard does
presets/arya-local/tool-policy.js  THE NEW PART: gate + catalog + tools_load/tools_unload
entries/registry.js               add the feature entry beside aryaStandard/aryaQwen
client/switches.json              one switch, like every other feature
test/arya-local.spec.mjs          row derivation + persona + settings
test/arya-local-tools.spec.mjs    router table, load/unload, caps, idempotence
docs/local-preset.md              user-facing, only after the spikes pass
```

Reuse, don't copy: `presets/arya-standard/{compaction.js,engine.js,policy.js}`
are the compaction machinery the preset should mount with different values (as
Arya Qwen does). Row ids must match Arya Standard's wherever the rows are the same
— a later patch layer addresses rows by id.

## Release path

`node scripts/release.mjs --minor --note <file> --title "..."` — preflight, bump,
changelog, rebuild client, all specs, commit, push, publish, poll the registry.
Then install with the pnpm line in [docs/releasing.md](docs/releasing.md); never
copy files into a profile's `node_modules`.

## Next actions, in order

1. Spike 1 and Spike 2. Nothing else starts until both pass.
2. `definition.js` deriving Arya Standard with a row filter; `persona.md`.
3. `tool-policy.js`: gate, catalog, loader, caps, idle unload.
4. Router table + its two-sentence tests.
5. Token accounting and the five-task suite; tune the compaction numbers.
6. Docs, switch, release.

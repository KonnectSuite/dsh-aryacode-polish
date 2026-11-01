# Arya Automation Engineer

**Status: shipped in 0.112.0.** This page records what was taken from the installed
PLC Copilot, what `dsh-engineering` provides, and the preset and Engineering tab
that were built from it.

## 1. What was inspected

| Target | Method | Result |
|---|---|---|
| `C:\Users\KNPhu\AppData\Local\Programs\PLC Copilot` | directory inventory | Electron 246 MB app, `resources/app.asar` 119 MB |
| `app.asar` | `analyze_javascript_application` (REA) | refused: `artifact_integrity_mismatch` on unpacked `win-ca/lib/roots.exe` (signed after packaging) |
| `app.asar` | same call with `integrity_policy: record-and-continue` | **host timeout** at the MCP deadline — a 119 MB graph is too large for one call |
| `app.asar`, extracted | `npx @electron/asar extract` → 16,243 files | 1,065 `.js` are 3-line loaders; **1,062 `.jsc` carry the real logic** (bytenode/V8 code cache) |
| `resources/plc-copilot-mcp/server.js` | read + obfuscation analysis | one-tool MCP bridge, javascript-obfuscator string-array, no domain text |
| `resources/plc-copilot-tia-connect/` | inventory | native helper, 68 KB exe, no readable config |

REA's semantic pass did not produce a graph; the extraction did produce the
**structure**, and structure is what this design used. No REA Evidence ID is cited
because no analysis completed — the findings below are file-system observations from
the extracted archive, not decompiled behaviour.

## 2. What PLC Copilot actually contains

**The engineering engine is vendor-modelled, one file per instruction:**

| Family | Files | Meaning |
|---|---|---|
| `engine/L5X` | 820 | **Allen-Bradley L5X** — the same vendor world as `dsh-engineering` |
| `engine/ap-xx` | 848 | Siemens S7-1200/1500 (TIA) |
| `engine/adpro` | 178 | a third instruction family |
| `engine/diff` | 6 | logic comparison |
| `engine/validation` | 2 | issue catalog, sequence, report |
| `engine/backup` | 4 | snapshot/restore |
| `engine/xml` | 2 | export/import helpers |

The L5X module is itself layered: `parse`, `ir`, `instruction-ladder`,
`instruction-function-block`, `ladder`, `compilers`, `validation`, `workspace`,
`agent`, plus `instruction-catalog`, `referral`, `transfer`, `backup`,
`observability`. In other words: **parse → intermediate representation →
instruction model → generate → validate**, with a diff and a backup beside it.

**The application is project-centric, not file-centric.** Its main-process services
are `project.ipc`, `projectView.ipc`, `documents.ipc`, `provider.ipc`,
`settings.ipc`, `ladderIdLookup`, `turnContent`, `uiTurns`, `legacyTurnImport`,
`attachmentSend`. `ladderIdLookup` is the interesting one: the model addresses a
rung by a stable id, not by text.

**The MCP surface is one bridge tool.** The bundled server reads a handshake file
(`%APPDATA%/plc-copilot/...json`) containing `{port, token}`, then calls
`http://127.0.0.1:<port>/...` with an `x-plc-c…` token header and a 660 s timeout.
Its tool takes a single `question` string. The tool name and description live in the
obfuscated string table and were **not recovered** — that was not worth a decoder
build, because it is a bridge into a closed app, not a design to copy.

**No prompt text is readable.** The 654 KB renderer bundle carries one "prompt"
match and no vendor strings; the bytenode modules are compiled. Whatever system
prompt PLC Copilot uses is server-side.

**Readable assets that remain** are fixtures, not knowledge: 4 SCL stubs
(`FUNCTION_BLOCK "FB.SCL" …`) and 20 XML block fixtures used to test S7 generation.

## 3. What is portable, and what is not

| Portable | Not portable |
|---|---|
| The **operating discipline**: project addressing by id, parse → model → generate → validate, diff before/after, backup before write | The instruction engine (compiled, Siemens-first; `dsh-engineering` already models L5X instructions) |
| The **capability checklist** a commercial PLC copilot thinks it must cover (see §2 families) | Prompt text (server-side, unavailable) |
| The **bridge idea**: the desktop app exposes itself as one MCP tool over loopback with a token handshake | The vendor integrations (`tia-connect.exe`) — different vendor, different product |

This is the same shape of finding as the Codex and Qwen Code ports: the code is not
the transferable part; the **working contract** is.

## 4. What `dsh-engineering` already provides

`@aryacode/dsh-engineering` 0.74.0 — **142 tools, 7 rows, 4 products**, one skill per
product with an 8,000-character budget:

| Row | Tools | Skill | Probe |
|---|---|---|---|
| `l5x` | 53 | `rockwell-l5x` | `studio_sdk_status` |
| `ftview` | 47 | `factorytalk-view` | `ftview_capabilities` |
| `mwi` | 24 | `motionworks-iec` | `mw_ide_status` |
| `optix` | 9 | `factorytalk-optix` | `optix_status` |
| `engineering-resources` | 2 | `engineering-standards` | — |
| `migration` | 7 | `legacy-to-logix-migration` | `migration_assess` |
| `viewers` | 0 | — | — |

Its documented loop is already the one a preset should enforce: **point at the work →
read before writing → act in a copy → verify with the vendor engine → hand off what
is deliberately human**.

So the bundle does not need a preset for *capability*. It needs one for **posture,
context economy, and gates**.

## 5. The preset

**Identity**

| Field | Value |
|---|---|
| id | `arya-automation` |
| name | **Arya Automation Engineer** |
| order | 5 |
| description | "Automation-engineering posture for the Engineering bundle: read before writing, act in a copy, verify with the vendor engine, and say which steps are human." |

**Composition** — derived from Arya Standard's row list (same loop behaviour, no
delegation, no schedules, plan mode on), with two changes: the persona, and a
compaction group tuned for engineering traffic.

The engineering rows themselves are **not re-mounted**. They belong to the installed
bundle and remain visible to every session; a preset that repeated them would
double-register their tools.

**Persona** (the actual product) — five sections:

1. **Role** — an automation engineer's agent: PLC and HMI projects, not general
   software. Assume the artifact is a customer's machine and a wrong write costs a
   production stop.
2. **The loop, as a contract** — point → read → act in a copy → verify → hand off,
   with the rule that "done" means the check passed, never that a file was written.
3. **Gates** — never write to a running controller or a live HMI without an explicit
   request naming the target; never treat a successful download as verification;
   never claim equivalence between two programs from a diff alone.
4. **Identity discipline** — every finding names the artifact: file path, project id,
   controller revision, program/routine/rung, display or device. No "the project",
   no "the rung".
5. **Honesty** — a missing vendor tool is reported as missing, not worked around; an
   unrun check is reported as unrun; a failed check is quoted.

**Compaction policy** — engineering sessions are read-heavy and file-dumped, so the
defaults shift earlier and prune harder than Arya Standard:

| Knob | Arya Standard | Proposed |
|---|---|---|
| `preemptivePercent` | 70 | **65** |
| `postTurnThresholdPercent` | 90 | **85** |
| `minFreedTokens` | 4,000 | **6,000** |
| `keepUserTokens` | 20,000 | **12,000** |
| pruner | 8,192 / 4,096 / 1,024 | **16,384 / 8,192 / 2,048** |
| checkpoint prompt | Codex | Codex (an engineer's handoff reads well in prose) |

**Not in scope for v1** — a settings page, a tab, or a new tool. Those are bundle
work; the preset is a composition plus a persona.

## 6. Test plan

- row list equals Arya Standard's except persona and the compaction group (same
  assertion shape as the Arya Qwen spec);
- persona contains the five sections and **no** Qwen/Codex tool names, no
  `apply_patch`, no `${`;
- persona forbids invented instruction names and requires artifact identity in
  findings (string assertions on the section text);
- compaction policy resolves to the values in the table;
- the definition mounts (registration test), and the picker lists it.

## 7. Open questions

1. **Tool trimming.** A preset is an additive scope; inherited bundle rows stay
   visible, so the preset cannot remove the engineering tools it does not want — it
   only adds. Trimming non-engineering rows (web, delegation, jobs) is possible by
   disabling them **by id in the profile patch**, which would affect every preset,
   or by teaching the preset to disable host rows if the loader supports
   cross-scope id targeting (unverified). Which surface should the engineering
   preset actually keep?
2. **Persona source.** Arya Standard's persona is Codex's; Qwen's is Qwen Code's.
   This one has no upstream to adapt — it would be written from the bundle's own
   documented loop and the gates above. Is that acceptable as "our own" prompt, or
   should it adapt one of the two existing ones and append the engineering sections?
3. **UI.** A Settings → Engineering card showing which product rows are live (with
   their probes) would make the preset legible, but it duplicates what the bundle's
   own card already shows. Skip in v1, or ship it because the preset picker gives no
   other signal?

## 8. As built (0.112.0)

The three questions were decided as: **keep every inherited tool**, **write the
persona fresh**, and **ship the tab**.

**Preset** — `presets/arya-automation/`

| File | What it holds |
|---|---|
| `persona.md` | the engineering contract: role, the five-step loop, gates, identity discipline, honesty, how to start with the probes |
| `files.js` | reads and caches the persona |
| `definition.js` | Arya Standard's row list, with the persona and the compaction knobs replaced |
| `plugin.js` | registers the preset and the projection, releases both with the switch |
| `projection.js` | the ledger fold and its wire view |

The compaction group reuses Arya Standard's engine and policy **modules** (the
Codex checkpoint kit and its policy row), so the preset changes values, not code:
pre-warm 65 %, post-turn 85 %, minimum fold 6 000 tokens, 12 000 tokens of verbatim
user text, and a pruner at 16 384 / 8 192 / 2 048.

**Engineering tab** — `client/engineering.js`, mounted on `conversation.view` as
`arya-engineering` (order 41), reading the `aryaAutomation` projection
(stateVersion 1). It shows:

- five stage cards — Read, Checks, Write, Verify, Live/hand-off — each done only
  because the tool that proves it ran and succeeded;
- **Artifacts in play**, newest first: the file, project id, application, folder,
  controller IP or tag a tool named, with the tool that named it;
- **Checks and verifications**: one row per tool, newest result wins, failures
  chipped red and counted;
- approvals (asked/decided and the policy), live reads versus live writes, and the
  last engineering tool with its outcome.

Nothing is inferred from prose: the fold classifies `tool/call` names, correlates
`tool/result` by `callId`, and ignores every non-engineering tool. The empty state
explains the tab instead of showing an empty frame.

**Known boundary.** Classification is a name table. A future engineering tool that
is not in `READ`, `CHECK`, `WRITE`, `VERIFY` or `LIVE` will not appear in the
ledger until it is added there — the tab never guesses from a name prefix.

**Tests** — `test/arya-automation.spec.mjs` (9 specs): preset shape, persona
content, tool classification, a read/check/write fold, a failed check staying red
until a retry replaces it, non-engineering tools ignored, approval and live-write
counters, and the projection's key/version. The bundle's UI spec additionally
asserts the tab and the two new rows reach the built client.

# Arya Standard: end-to-end verification

Run on 2026-10-31 against the dev profile (`%LOCALAPPDATA%\AryaCode-dev\home`), plugin
0.103.6, local model `local-library/strata:swift-1.5-iq3_xxs` (262,144-token window).

Method: the session log records each request in full — the assembled system prompt
(`system/message`), the exact tool list and schemas (`request/header`), every step's
usage (`assistant/message.data.usage`) and every compaction event. Each claim below
was read out of those files (concatenated zstd frames, one frame per append), not out
of the UI.

## 1. Static gate

`node --test` → **361 pass, 0 fail**.

## 2. The preset changes the composition

| | `c4f05ed6` standard | `27577cf5` Arya Standard |
|---|---|---|
| tools | 145 | **133** |
| tool-schema chars | 123,050 | **105,913** |
| system-prompt chars | 5,695 | **11,637** |
| `Editing constraints` (Codex) | – | present |
| `Default to ASCII` (Codex) | – | present |
| `Presenting your work…` (Codex) | – | present |
| forbidden tokens (`You are Codex`, `GPT-5`, `apply_patch`, `update_plan`) | none | **none** |

The 12 removed tools are exactly the delegation/scheduling/meta set:
`subagent`, `subagent_fork`, `workflow`, `send_message`, `list_agents`,
`interrupt_agent`, `list_subagent_models`, `schedule_create`, `schedule_list`,
`schedule_delete`, `schedule_update`, `plugin_manager`.

The prompt adapts Codex's text rather than pasting it: `You are Codex…` is rewritten
and the Codex-only tool names are gone, which is why the forbidden-token scan is clean.

## 3. Token effect, measured on the same task

Same workspace, same model, same prompt ("Create a file named e2e-check.txt … reply
with the version").

| | standard | Arya Standard |
|---|---|---|
| steps | 4 | 5 |
| tool calls | 3 (`glob`, `read`, `write`) | 4 (`read`, `glob`, `read`, `write`) |
| first-request prompt tokens | 34,208 | **31,395** |
| per-step prompt tokens | 34,208 / 34,331 / 34,668 / 34,801 | 31,395 / 31,504 / 31,581 / 31,907 / 32,197 |
| outcome | `e2e-check.txt` = `2.0.0` | `e2e-check-arya.txt` = `2.0.0` |

≈ **−2,800 prompt tokens per step (−8.1 %)**, i.e. the 17 KB of dropped tool schemas
outweigh the 6 KB of added instructions. Both runs produced the correct artifact.

## 4. Compaction

Manual `/compact` (session `db9f83d8`): checkpoint `fa292fcf`, **4 nodes replaced,
976 tokens freed, seqs 9–12**, and the body opens with Codex's handoff sentence
("Another language model started to solve this problem…"). That framing comes from
`summary-prefix.md`; `compaction-basic` writes a different preamble.

Config-driven threshold (session `a6e6f65c` with `thresholdRatio: 0.5`,
`headroomTokens: 200000` in the row configuration): the tab header reads
**"compacts at 50% · 200,000 headroom"**, the gauge reads **"compacts at 50% · 62.1k"**
and **"room before the fold 29.6k"**. That is the documented rule
`min(window × ratio, window − headroom) = min(131,072, 62,144) = 62,144`, so the
policy really is read at mount time.

## 5. Defects found, and what happened to them

1. **The policy panel could not save (fixed in 0.103.6).** `configForms.mutate`
   accepts only volatile fields; the ten-value `aryaStandardOptions` group is
   non-volatile by design, so every write was refused ("The Host refused the policy
   change."). Verified the other half works: the volatile `aryaStandard` switch saved
   and persisted to `cordis.patch.yml`. Fix: the panel now shows the policy
   read-only, saves only the switch, and says where the policy lives. A spec pins
   that the group is never patched from the form.
2. **The read-only panel showed schema defaults, not the effective policy (fixed in
   0.103.7).** With `thresholdRatio: 0.5` and `headroomTokens: 200000` in the row
   configuration, the Compaction tab correctly reported 50 % / 62.1k while the
   Settings page displayed 0.9 / 16000, because the form snapshot does not carry the
   profile patch layer. Fix: the panel now labels those numbers as declared defaults
   and points at the session's Compaction tab, which shows what the preset actually
   mounted with. Reading the effective values on the settings page itself would need
   a policy service the settings slot does not receive.
3. **A blank session can carry a preset label without the composition (open).**
   Session `e982460f` records `agent-preset/selected: arya-standard` and then runs
   145 tools with the standard prompt. Sessions are mounted when they are created;
   sending into a reused blank session keeps the earlier composition. The only
   reliable proof of what ran is `request/header.tools`, which is why this document
   cites tool counts rather than labels.
4. **A workspace whose directory no longer exists fails the turn** with
   `working-directory: directory does not exist`. Not a preset defect, but it cost a
   run: the `dsh-aryacode-polish` workspace in the dev profile points at a
   `C:\Users\KNPhu\AryaCode\…` path that is gone.

## 6. The summarizer failure path (closed)

With `summarizationProvider: "no-such-provider"` / `summarizationModel: "no-such-model"`
in the row configuration, `Compact now` on an open session produced exactly one
compaction attempt and this record:

```
compaction/start {"compactionId":"5dc0bbb6-…","sourceCommandId":"cmd-dc4b3432-1"}
compaction/end   {"compactionId":"5dc0bbb6-…","sourceCommandId":"cmd-dc4b3432-1",
                  "error":"no adapter registered for provider \"no-such-provider\""}
command/done     {}
```

No crash, no half-written checkpoint, and the tab renders the failure as a red card
with the Host's own message above the gauge ("no adapter registered for provider
\"no-such-provider\""), while the gauge keeps reporting live pressure. The failure
reaches the `aryaStandard` projection, which is what the card reads.

## 7. What the headless run found (and fixed)

Running the same rows through `dsh --profile headless --patch <overlay>` put the
engine's import errors on stderr, where the desktop build hides them. Two findings:

1. **The engine row never mounted from 0.103.8 on.** The diagnostic build called a
   `report()` helper at module scope, above the `const DEBUG` it reads, so the import
   threw `ReferenceError: Cannot access 'DEBUG' before initialization`. Inside the
   isolated group that left the preset registered *without* an engine — no automatic
   compaction and no `/compact` either — and as a sibling row the same failure removed
   the preset from the picker. Fixed in 0.104.2; the per-call probes remain.
2. **The isolate is required, not incidental.** Without it the engine row fails with
   `service "compaction" has been registered at <BasicCompactionEngine>`: the harness
   composition already provides compaction, and a preset engine replaces it only
   inside a scoped realm. 0.104.0's "siblings" experiment was reverted for this
   reason as much as for the import error.

With the engine loading again, a session carrying 134k tokens of pasted text shows a
`compaction/prune` event at the pre-step — the model-free pass that runs *after*
pressure qualifies — but no `compaction/start`, so the engine's automatic gate
qualifies and then declines to commit a checkpoint in that state. Manual `Compact now`
on the same build does write a Codex-framed checkpoint. The next probe is the engine's
own success line (`compaction (…): shadowed … surface nodes`) plus the tab's `used`
against its threshold, in a session whose spans end on a completed turn boundary.

## 8. Not covered, and why

- **Automatic compaction crossing the threshold live.** Manual compaction is now
  verified end to end (§10), and the threshold arithmetic was verified above. The
  automatic trigger check itself is `compaction-basic`'s, not ours:
  `presets/arya-standard/engine.js` binds `BasicCompactionEngine` and overrides
  `summarize` plus the post-turn trigger added in 0.109.0. Reaching the 90 % line on
  this machine is impractical — 776.6k of a 1,048,576-token window — so the post-turn
  path has a unit spec but no live transcript yet.
- **Plan mode.** The Codex plan section is verified statically — the definition hands
  `plan-mode.md` to the `plan-mode` row, and the spec "the plan-mode row receives the
  shipped section" pins it — but this composition exposes no plan-mode control I could
  drive, so no transcript in this run contains the `codexPlan` marker.


## 9. Reproduce

```
# read one session the way this document does
node tools/read-session.mjs "<profile>/sessions/<workspace>/session-<id>/session.v4.jsonl.zstd"
```

The two scripts used here (`read-session.mjs` for the concatenated zstd frames,
`verify.mjs` for the per-session report) are kept in `%TEMP%` on this machine; moving
them into `tools/` is one commit.

## 10. The 0.109.x run: a checkpoint committed live

Run on 2026-11-01 against the dev build (`%LOCALAPPDATA%\AryaCode-dev\home`), plugin
0.109.3, `deepseek-account/deepseek-flash`, session `13dab9e4`.

The dev app was started through `AryaCode-dev.bat desktop` — that wrapper clears
`ELECTRON_RUN_AS_NODE` (the harness exports it, and `electron.exe` then rejects
`--user-data-dir`/`--remote-debugging-port` with "bad option") and gives the build a
private temp root. Session **Oka** recorded
`agent-preset/selected {"agentPreset":"arya-standard"}`, ran one turn, and then
**Compact now** wrote:

```
#49 compaction/start
#51 compaction/summary  "Another language model started to solve this problem …"
#53 compaction/end      (no error)
#54 command/done        "Compacted 6 history items (~999 tokens)."
```

The Compaction tab reads **CHECKPOINTS 1** (1 manual · 0 automatic) and **FREED BY
COMPACTION 999**, with a fold mark on the trajectory.

Three defects surfaced in that run, none reachable from the stub suites:

1. **`agent-preset/invalid: Preset services require isolate realms:
   aryaStandardPolicy`** — every `New Session` failed. A preset row may only provide a
   service inside a realm its group declares, and 0.109.0 did not declare it.
2. **`summary is not smaller than the shadowed content (1623 >= 999)`** — the token
   estimate assumed four characters per token, which under-prices a Chinese checkpoint
   by roughly 4x, and the body was never fitted to the span it replaces.
3. **`(1781 >= 999)`** after the first fix — the span budget summed the replayed
   prefix including the ~33k-token system prompt, so the fitted budget was always far
   larger than the shadowed content. Only non-system messages count now.

`ARYA_STANDARD_DEBUG` does not reach the desktop host process — the app spawns its
host with its own environment — so the engine's `[arya-standard]` lines never appear in
the launcher log. The durable session log is the reliable channel; decode it with the
concatenated-frame reader above, because Node's `zstdDecompressSync` stops at the first
frame.

## 11. The Arya Qwen run (0.111.x)

Run on 2026-11-01 against the same dev profile, plugin 0.111.0, routed model
`deepseek-account/deepseek-flash`. Session `7c2d5182`, decoded from
`session.v4.jsonl.zstd` the same way as section 10.

| Claim | Evidence in the log |
|---|---|
| The preset mounted | `agent-preset/selected` = `arya-qwen` |
| The persona and tools work | one shell call, reply `arya-qwen-ok`, `Completed in 3s`, 69.1k input tokens |
| The checkpoint is Qwen Code's | `compaction/summary.data.summary[0].text` starts with `<state_snapshot>` and opens `<primary_request_and_intent>` |
| The scratchpad is stripped | the summary text contains **no** `<analysis>` block |
| The trailer is appended | the text ends with `Resume the prior task using the summary above. Continue from the last in-flight step; �` |
| The fold was small | `command/done` = `Compacted 6 history items (~1029 tokens).` |

The same run found a defect: the checkpoint carried **8 of 9 sections**, missing
`next_step`, because the body was end-truncated to fit a ~1,029-token span. 0.111.1
adds a `minBodyTokens` floor (800 for Arya Qwen) so the fold is refused rather than
mutilated, with a regression test that reproduces the tiny-span case.

Current static gate on this line: `node --test` ? **503 pass, 0 fail**, including the
two-definition comparison, the Qwen extraction-hole scan, the suffix-framing kit test
and the floor test.

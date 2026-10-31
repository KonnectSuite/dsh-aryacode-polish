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
2. **The read-only panel shows schema defaults, not the effective policy (open).**
   With `thresholdRatio: 0.5` and `headroomTokens: 200000` in the row configuration,
   the Compaction tab correctly reports 50 % / 62.1k, but the Settings page still
   displays 0.9 / 16000. The page reads `configForms.getSnapshot().value`, which does
   not include the patched layer. Fix: read the policy from the `aryaStandard`
   projection's `policy` field, which already carries the effective values.
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

## 6. Not covered by this run

- **Automatic compaction crossing the threshold live.** Forcing a real crossing needs
  ~31 k tokens more than the base prompt; with the local model that is 20+ tool steps.
  The trigger, lock and shrink-guard paths are covered by the engine specs and the
  threshold arithmetic above, but no session in this run crossed 62 k.
- **Plan mode.** The Codex plan section is measured statically in the definition
  (`docs/arya-standard.md`); no session was run in plan mode here, so the
  `codexPlan` marker is absent from every transcript above by design.
- **The summarizer failure path** (a bad provider/model pair failing a checkpoint and
  recording it in the projection).

## 7. Reproduce

```
# read one session the way this document does
node tools/read-session.mjs "<profile>/sessions/<workspace>/session-<id>/session.v4.jsonl.zstd"
```

The two scripts used here (`read-session.mjs` for the concatenated zstd frames,
`verify.mjs` for the per-session report) are kept in `%TEMP%` on this machine; moving
them into `tools/` is one commit.

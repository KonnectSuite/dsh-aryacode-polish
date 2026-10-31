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

## 7. Not covered, and why

- **Automatic compaction crossing the threshold live.** The threshold arithmetic is
  verified (50 % / 62.1k in a real session) and manual compaction exercises the same
  `summarize()`, checkpoint write, projection fold and tab render. What is not
  exercised live is `compactIfNeeded`'s trigger check — and that code is **not ours**:
  `presets/arya-standard/engine.js` binds `BasicCompactionEngine` and overrides
  `summarize` only. Reaching 62,144 tokens on this machine is not possible from the
  UI: the only model has a 262,144-token window, the schema floors the threshold at
  `window − 200000 = 62,144`, the tool-result pruner caps every tool result at ~5 k
  chars, and the `@` attachment is passed as a path the model reads (pruned) rather
  than inlined. Two batches of ten 240 KB reads moved pressure from 31 k to 35 k.
- **Plan mode.** The Codex plan section is verified statically — the definition hands
  `plan-mode.md` to the `plan-mode` row, and the spec "the plan-mode row receives the
  shipped section" pins it — but this composition exposes no plan-mode control I could
  drive, so no transcript in this run contains the `codexPlan` marker.


## 8. Reproduce

```
# read one session the way this document does
node tools/read-session.mjs "<profile>/sessions/<workspace>/session-<id>/session.v4.jsonl.zstd"
```

The two scripts used here (`read-session.mjs` for the concatenated zstd frames,
`verify.mjs` for the per-session report) are kept in `%TEMP%` on this machine; moving
them into `tools/` is one commit.

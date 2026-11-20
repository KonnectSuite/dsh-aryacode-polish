### Removed

- **The three Arya agent presets are retired.** `aryaStandard`, `aryaQwen` and
  `aryaClaude` no longer ship: their switches, their subpath exports
  (`./arya-standard`, `./arya-standard-policy`, `./arya-qwen`,
  `./arya-qwen-policy`, `./arya-claude`, `./arya-claude-policy`,
  `./arya-claude-pruner`), the Settings page for the compaction knobs, the
  **Compaction** and **Engineering** conversation tabs, and their documents
  (`docs/arya-standard.md`, `docs/arya-standard-verification.md`,
  `docs/arya-qwen.md`, `docs/arya-claude.md`, `docs/preset-comparison.md`,
  `docs/arya-automation-engineer.md`) are gone. `presets/` no longer exists: this
  bundle registers no agent preset at all.
  - The harness's own presets — `standard`, `minimal` and `ptc` — are untouched and
    are still offered in the preset picker.
  - A session created with one of these presets keeps its own history. The ids are
    no longer registered, so no new session can be started with them.
  - `client/arya.js` stays: it is the shared style primitives the memory, hooks,
    MCP and search pages draw on. Only the preset's fields, gauges, checkpoint
    cards and log views were taken out of it.
- **The review lenses go with them.** `skills/review`, `skills/review-security` and
  `skills/review-bugs` were reachable only because the Arya Standard definition
  mounted a second `dsh-skill-filesystem` provider over `skills/`. With no preset
  to mount that provider, the three bundles and `docs/review-lenses.md` are
  removed. Nothing else in this bundle mounts a skill provider.
- **The billion-context compaction adapter is removed.** `presets/billion-context.js`
  existed for one reason: to stand the Arya compaction engine down when
  billion-context owns the context lane. There is no Arya engine to stand down, so
  the adapter, its spec and `docs/billion-context.md` go. billion-context itself is
  untouched and still owns compaction wherever it is installed.
- Nine spec files went with the code they tested (463 specs remain, all passing),
  and `presets/arya-standard/CODEX-LICENSE` went with the prompt shapes it covered.
  `NOTICE.md` named none of them, so it did not change.

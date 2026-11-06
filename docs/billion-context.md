# billion-context and the Arya presets

`billion-context` ("bili") is an HTTP proxy plus a DSH plugin bundle that
compresses the outgoing model request. When it runs, it owns the context lane
and **replaces** DSH's native compaction rather than complementing it.

That contract is easy for the shipped presets because bili disables them by
package name: its always-on `bili-compaction-gate` entry registers an
`internal/config` overlay that marks the rows named
`@deepseek-ai/dsh-compaction-basic` and `@deepseek-ai/dsh-command-compact`
`disabled: true` while bili is active. Our presets mount their own engine
subclasses under `@aryacode/dsh-aryacode-polish/arya-standard` (and the Qwen and
Claude variants), so bili's name-based walk cannot see them. Without a check on
our side, an Arya Standard / Qwen / Claude session under bili runs **two
compression pipelines over one history**.

## What this bundle does

Before building any of the three preset definitions, the plugin asks
`presets/billion-context.js` whether bili owns this process. When the answer is
yes, the definition disables exactly two rows:

| Row | bili active | bili absent or inactive |
|---|---|---|
| engine (`arya-standard-compaction`, `arya-qwen-compaction`, `arya-claude-compaction`) | **`disabled: true`** | enabled |
| `command-compact` (`/compact`) | **`disabled: true`** | enabled |
| policy (`arya-standard-policy`, …) | enabled | enabled |
| `tool-result-pruner` / `arya-claude-microcompact` | enabled | enabled |
| tool rows, persona, planning, delegation | unchanged | unchanged |

The pruner and Arya Claude's microcompact clear old tool results; they are not
summarizers, so they stay. `/compact` goes with the engine: with no summarizer
mounted there is nothing for it to run, and leaving the command live would offer
the user a second checkpoint shape bili does not know about. This is the same
pairing bili produces on the shipped presets.

The decision is made **once, at definition time**, immediately before
`agentPresets.register()`. It is not an `internal/config` overlay: a preset
registered through the Host's registry is not an entry, so bili's overlay (and
ours, had we written one) cannot reach it. A new session created after the
preset is registered gets the stand-down; a session already running keeps its
definition until the plugin remounts, exactly like any other preset-row change.

## How bili is detected

Both of these must hold. Requiring only one is not enough: the gate entry mounts
from the bundle patch even when `bili-native` is disabled, and the verdict is a
process-global that only `bili-native` writes.

1. `ctx.get('biliBasicCompactionPolicy')` resolves. That service is published by
   bili's always-on `bili-compaction-gate` entry (bili 0.1.212,
   `dist/agent/dsh-compaction-gate.js`, issue #3354/#3662).
2. `globalThis.__BILI_DSH_COMPACTION_VERDICT__ === 'active'`. That is the verdict
   `bili-native`'s `apply()` declares when its plan keeps the lane owned.

The pair is checked **before** the "is bili expected in this profile?" question.
An already-armed bili stands the preset down even when `profileContext` names no
bili bundle, because a custom preset or a profile-local patch can mount bili
directly. The expected-profile signals below only decide whether a bili that has
not armed yet is worth waiting for.

Because the two entries are separate bili bundles with no shared module state,
the gate can publish before the verdict. The definition therefore polls:

| Wait | Budget | Meaning |
|---|---|---|
| gate service | 2000 ms, one check every 25 ms | the gate entry may mount after the profile starts |
| active verdict | 500 ms, one check every 25 ms | `bili-native` may declare a moment after the gate appears |

If the gate never appears, or appears but the verdict never becomes active, the
engine stays mounted and one warning is logged:

```
billion-context is installed but its compaction gate did not become active; keeping the Arya compaction engine and /compact mounted
```

## When bili is "expected"

The wait above only happens when something says bili belongs in this profile.
Three signals, in bili's own precedence:

- **Kill switches first.** `BILLION_CONTEXT_PLUGIN=0` and `BILI_NATIVE_DSH=0`
  switch `bili-native` off (bili compares against the literal string `0`), and a
  defined `BILI_PROVIDER_REWRITES` stands it down too. Any of them means stock
  DSH compaction: the answer is `false` immediately, with no wait and no warning.
- **Attach mode.** `BILLION_CONTEXT_PROXY` or `BILLION_CONTEXT_ATTACH` names a
  proxy the launcher owns, so bili is compressing even if the bundle is not
  listed in the profile.
- **The mounted profile.**
  `profileContext.startedBundles` contains `billion-context`, or
  `profileContext.overlays` (parsed `--patch` rows) mentions the package name.

With none of these the answer is `false` immediately: no timer, no log, no change
to the registered rows. That is the no-bili path the specs pin, and it is why a
profile without bili sees no behavioural difference.

## Boundaries

- **Vendor coupling.** `biliBasicCompactionPolicy` and
  `__BILI_DSH_COMPACTION_VERDICT__` are internal to this bili version, not a
  published contract. Every reference lives in `presets/billion-context.js` with
  the version and the bili issue numbers; a bili upgrade should re-read
  `dist/agent/dsh-compaction-gate.js` and
  `dist/agent/dsh-compaction-disable.js`.
- **Fail-open on purpose.** Absence means "the engine runs", which is stock DSH
  behaviour. A duplicate compressor is recoverable by restarting without bili; a
  silently disabled compaction lane is not.
- **No runtime re-evaluation.** The gate is read when the preset definition is
  built, not on every session. Flipping a bili kill switch is a process
  environment change, so it already needs a restart; adding or removing the bili
  bundle changes `dsh.profile.bundles` and needs one too.
- **Arya Automation Engineer is out of scope.** Its preset lives in
  `@aryacode/dsh-engineering`, not in this bundle.

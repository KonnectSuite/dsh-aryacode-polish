# Hooks

Run a command when something happens in a session.

## Rules file

`<harness home>/polish/hooks.json` — either a bare array or `{ "hooks": [...] }`:

```json
{
  "hooks": [
    {
      "name": "notify",
      "on": "turn/stopping",
      "action": { "kind": "exec", "command": "notify-send", "args": ["AryaCode", "turn done"] }
    },
    {
      "name": "checkpoint-log",
      "on": "compaction/end",
      "action": { "kind": "exec", "command": "cmd", "args": ["/c", "echo checkpoint >> %TEMP%\\arya-hooks.log"], "timeoutMs": 5000 }
    }
  ]
}
```

| Field | Meaning |
|---|---|
| `name` | Label shown in the panel. Defaults to `rule-N`. |
| `on` | `turn/stopping`, `agent/error`, `compaction/summary`, `compaction/end`. |
| `action.kind` | `exec` only, for now. |
| `action.command` | Executable, run without a shell. |
| `action.args` | Argument vector — no shell quoting, no interpolation. |
| `action.timeoutMs` | 10 s default, clamped to 120 s. |

## What the command receives

The event payload arrives as JSON in the environment, never as arguments:

- `POLISH_HOOK_PAYLOAD` — the payload (`{ turn }`, `{ turn, step, error }`, or
  `{ sessionId, compactionId }`).
- `POLISH_HOOK_EVENT` — the event name.
- `POLISH_HOOK_NAME` — the rule name.

## Dispatch semantics

**Hooks are observational.** They run after the event, asynchronously, with a
timeout, and their outcome is recorded. A hook cannot veto a tool call, block a
turn, or change a message. That is deliberate: a hook that can silently stop work
is a worse failure than a hook that cannot stop work at all, and the veto path
needs a waterfall contract this bundle has not confirmed. When it does, `kind:
"decide"` can land beside `exec` without changing the file format.

A failing or missing command is recorded as a failed dispatch and never surfaced
as a session error.

## The panel

**Settings → Hooks** (`arya-hooks`, order 62) names the exact file, validates it
on demand, lists accepted rules, shows each invalid rule with its index and
message, and lists the last 50 dispatches with duration and outcome. The dispatches
live in memory and reset with the host process; the file is the durable record.

The panel does not edit the file. A hooks file is executable configuration, and a
half-editor that cannot show argument boundaries would be worse than the text
editor already open beside it.

## Boundary

- **One action kind.** `exec` only; `mcp_tool`, `inject` and `decide` are named in
  the design but not shipped.
- **Four events.** `tools/pre-execute` and `tools/post-execute` exist in the host
  but their waterfall contract has not been verified against this harness version,
  so no rule can subscribe to them yet.
- **No persistence of dispatches.** A restart forgets them; a durable log belongs
  with the session log, not with a plugin's memory.

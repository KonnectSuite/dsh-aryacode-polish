# Review lenses

Three skills that turn "review my changes" into one review with a stated method.

| Skill | Role |
|---|---|
| `review` | The router: asks which lens, then runs exactly one. |
| `review-security` | What could be exploited, escalated, leaked or traversed. |
| `review-bugs` | What is wrong: wrong result, wrong path, wrong state. |

## What they actually change

An unqualified "review this" tends to produce a mixture of taste, one loud bug and
a compliment. A review lens is a contract:

- **one lens per review.** The router asks security or bugs, and refuses to run
  both unless asked. A review that covers everything finds the loudest thing and
  calls it the only thing.
- **findings first, ordered by severity**, each with `path:line`, the trigger, the
  effect and the smallest correct fix.
- **a named blind spot list.** "Not examined: …" is part of the deliverable; a
  review that does not name what it skipped reads as a guarantee it cannot give.
- **no fixing during the review.** The deliverable is the finding, not the patch.

## How they are mounted

`skills/` in this package holds the three bundles. `presets/arya-standard/files.js`
resolves that directory, and every Arya preset (Standard, Qwen, Automation
Engineer) carries one extra row:

```yaml
- id: arya-review-skills
  name: '@deepseek-ai/dsh-skill-filesystem'
  config:
    providerName: arya-review
    includeDefaultRoots: false
    watch: false
    customSkillDirs: [<package>/skills]
```

The shipped provider still scans the project, user and `~/.agents` roots. This
second provider adds **only** this directory, so nothing is discovered twice, and
`watch` is off because a packaged directory does not change at runtime.

## Front-matter choice

Both surfaces stay open:

```yaml
disable-model-invocation: false
user-invocable: true
```

Cursor's convention is the opposite — its slash-command skills default to
`disable-model-invocation: true` so they load only when named. That suits commands
with a fixed invocation (`/goal`, `/rename-chat`). A review is different: the user
says "review this diff" in prose far more often than `/review`, and a lens that the
model cannot reach from ambient context is a lens that never runs.

`name` matches the directory because that is how the provider derives it, and the
spec asserts it.

## Boundary

- **Prompt-only.** The lenses do not run scanners, do not install anything, and do
  not claim tool results they did not get. When a scope is unreadable (no git, no
  diff), the lens says so instead of widening to "the codebase".
- **No subagent fan-out.** Cursor's lenses launch `bugbot` / `security-review`
  subagents when available. The Arya presets carry no delegation group, so these
  lenses always review in place — the same fallback Cursor documents for the case
  where the subagent type is not offered.
- **Not a gate.** A review is advice. Nothing here blocks a commit or a merge.

## Attribution

Cursor is proprietary software: the VS Code portions are MIT, its additions are not.
These lenses are **not** vendored text. The pattern — a router that picks one lens,
each lens self-contained with a fallback when a subagent is unavailable, and an
explicit "what I did not examine" section — was learned by reading the installed
`~/.cursor/skills-cursor/` bundles. Every word here is written for this bundle.

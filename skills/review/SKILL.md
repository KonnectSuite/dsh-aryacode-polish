---
name: review
description: Review the current changes through one lens. Routes to the security lens or the bug lens, then runs exactly one of them. Use when the user says review, review my changes, or asks for a code review.
disable-model-invocation: false
user-invocable: true
---

# Review

A review is one lens, not a pile of opinions. Pick the lens before reading any code.

## Route first

Ask which lens, with two options:

- **security** — what could be exploited, escalated, leaked or traversed.
- **bugs** — what is wrong: wrong result, wrong path, wrong state.

If `ask_user_question` is available, use it for that one question. If it is not,
ask in plain prose and stop until the answer arrives. Do not review "both" unless
the user asks for both; a review that covers everything finds the loudest thing and
calls it the only thing.

## Then run the lens

Follow the chosen lens's skill and nothing else:

- security → the `review-security` skill
- bugs → the `review-bugs` skill

## Scope

- Default scope is **the uncommitted change in the current repository**: the diff
  against the base branch, or the working tree when there is no branch.
- If the repository has no diff, say so and ask for the files or commits to review.
  Never silently widen to "the whole codebase".
- Name the exact range you reviewed: branch, commit ids, or the file list.

## What a review must produce

1. **Findings first**, ordered by severity. Each one carries `path:line`, what is
   wrong, why it matters, and a concrete failure or exploit scenario.
2. **Evidence**, not adjectives. Quote the line, the condition, the missing check.
3. **What you did not examine.** A review that does not name its blind spots reads
   as a guarantee it cannot give.
4. **No praise section.** If nothing is wrong, say that in one line and stop.

Do not fix the code during a review unless the user asks for fixes in the same
breath. The deliverable is the finding, not the patch.

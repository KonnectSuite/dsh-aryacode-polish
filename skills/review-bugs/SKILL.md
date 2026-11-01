---
name: review-bugs
description: Correctness review of a change. Looks for wrong results, unhandled states, broken contracts, races, leaks and missing tests. Use with the review router, or when the user asks for a bug review.
disable-model-invocation: false
user-invocable: true
---

# Bug review

Read the change as the person who will be paged at 3am because of it.

## Method

1. **State the contract.** What does this code promise its callers — input shape,
   return shape, errors thrown, side effects, idempotency? Read the callers and the
   tests to find the promise instead of assuming one.
2. **Walk the change with the contract in hand.** For each changed branch: what
   input takes the other path, and what happens there?
3. **Check the classes that actually recur:**
   - boundary conditions — empty, one, off-by-one, negative, zero, maximum;
   - missing or wrong null/undefined handling, and optional values used as present;
   - error paths — swallowed errors, wrong error type, cleanup skipped on throw;
   - state — shared mutable state, ordering, re-entrancy, retries that are not
     idempotent;
   - resources — handles, timers, listeners, streams not closed on every path;
   - contracts — changed signature or semantics that callers were not updated for;
   - concurrency — read-modify-write without a lock, check-then-act races;
   - tests — a behaviour change with no test that would fail without the change.

## Output

Findings first, highest severity first. For each:

```
[severity] path:line — what goes wrong
  Scenario: the concrete input or sequence that gets there
  Effect: the wrong result, crash, leak or corrupted state
  Fix: the smallest correct change
```

Then a short **Not examined** list. If nothing is wrong, say "no finding in the
reviewed range" and name the range.

## Rules

- A finding needs a scenario. "This could be risky" is not a finding.
- Do not report style as a bug; a review that mixes taste with correctness teaches
  the reader to ignore both.
- Prefer one proven finding over five speculative ones.
- Do not modify the code during the review unless asked.

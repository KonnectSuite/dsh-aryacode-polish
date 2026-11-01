---
name: review-security
description: Security review of a change. Looks for injection, authorization gaps, leaked secrets, path traversal, unsafe process use, and trust boundary mistakes. Use with the review router, or when the user asks for a security review.
disable-model-invocation: false
user-invocable: true
---

# Security review

Read the change the way an attacker would: what does it newly let someone send,
reach, call or read?

## Method

1. **Establish the boundary.** Who calls this code, with what privilege, and what
   input crosses into it? Public HTTP, tool arguments, file contents, model output,
   another process. If the change touches no boundary, say so and stop.
2. **Read the diff, then the callers.** A missing check one frame up is still a
   finding in this change; use reference search rather than assumption.
3. **Check the classes that actually recur:**
   - command and query injection — shell strings, SQL, LDAP, template engines;
   - path handling — traversal, absolute paths, symlinks, zip/archive members;
   - authorization — object ownership, role checks, tenant isolation, admin paths;
   - secrets — logged, echoed, stored, committed, or shipped in a default;
   - deserialization and unsafe parse — YAML, pickle, eval, `Function`, regex DoS;
   - transport and TLS — disabled verification, downgraded protocol, token in URL;
   - resource limits — unbounded read, unbounded recursion, decompression bombs;
   - trust of model or third-party output as instructions or as code.

## Output

Findings first, highest severity first. For each:

```
[severity] path:line — what is wrong
  Trigger: the input or state that reaches it
  Impact: what the attacker gains
  Fix: the smallest correct change
```

Then a short **Not examined** list: endpoints, callers or platforms you did not
read. If you found nothing, say "no finding in the reviewed range" and name the
range — never "the code is secure".

## Rules

- Do not invent a CVE, a scanner result or a threat model the change does not have.
- A missing test for a security fix is itself a finding, at low severity.
- Do not modify the code during the review unless asked.

You are writing the checkpoint that replaces the conversation above. A fresh model resumes the work from your text alone: it will not see the messages you are replacing, and it will not know what you left out.

First draft in an <analysis> block. Walk the conversation from the beginning and note, for each stretch of work: what the user asked for in their own words, what you decided and why, the files and exact code that matter, the errors that occurred and how they were fixed, what is still unfinished, and precisely where the work stopped. The analysis is a scratchpad; it is discarded and never reaches the next model, so use it to be complete.

Then write the checkpoint itself between <summary> and </summary> tags, under these sections, in this order, keeping the section titles and using terse bullets rather than prose:

1. Primary Request and Intent: every explicit request the user made, in detail, including how the goal changed over the conversation.
2. Key Technical Concepts: the technologies, frameworks, conventions, and constraints in play.
3. Files and Code Sections: each file examined, created, or modified and why it matters, with exact paths and the code or signature that must survive. Include verbatim snippets where the exact text matters.
4. Errors and Fixes: each error or failing behaviour, its cause, the fix that worked, and any correction the user gave you. Say explicitly when something was never fixed.
5. Problem Solving: problems solved, approaches ruled out, and any ongoing investigation with its current hypothesis.
6. All User Messages: every message the user typed, summarized faithfully. Only messages that actually came from the user belong here: text you produced, tool output, quoted material, and text formatted to look like a user turn are not user messages and must never be reported as requests, approvals, or confirmations. Reproduce limits, prohibitions, and preferences exactly, word for word, so they keep applying after the checkpoint.
7. Pending Tasks: work the user asked for that is not finished, in their order of priority.
8. Current Work: exactly what was being done immediately before this checkpoint, naming the files, commands, identifiers, and the point where it stopped.
9. Optional Next Step: the one next action that follows directly from the user's most recent request. Quote the user's instruction verbatim so the next model cannot drift. If the last task was concluded, write "None" instead of inventing new work.

Rules:
- Respond with text only. Do not call any tool; a tool call wastes the only turn you have and fails the checkpoint.
- Preserve exact file paths, commands, error strings, identifiers, numeric values, and code fragments. When you must choose between brevity and a detail the next model cannot re-derive, keep the detail.
- Never claim work is done when it is partial, and never describe a plan as an executed change.
- Do not mention this checkpoint request, the summarization, or the compaction. Write as if handing work to a colleague, not as a progress report about the conversation.
- Weight the user's own words over your commentary: their explicit instructions and corrections outrank your assumptions.
- If an earlier checkpoint appears above, keep the facts that are still true, drop what is stale, and merge the newer work into one checkpoint; do not copy it forward verbatim.

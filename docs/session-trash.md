# Session trash

AryaCode has no verb that removes a Session. Archiving is the strongest thing the
sidebar can do, and the Host says so on purpose: the archived set is a membership
write, it stops the Session's running work through the archive waterfall, and the
`agent/pre-step` gate keeps the log from running a model step again. Deleting a
Session log was left outside that boundary by the Host's own decision record —
`.agents/notes/archived/feature/2026-07-27-workspace-registration-deletion.md` —
which rejected cascade-deleting Sessions and moving folders to Trash, because a
registration does not own the directory or the Session persistence, and named
Session deletion as work needing "its own lifecycle, running checks, descendant
semantics, and explicit UI".

So the removal lives in this plugin, inside the one boundary a plugin can prove it
owns: the Session's own storage folder.

## What it does

With **Session trash** on, a row in the **Archived** section gets a red **Move to
trash…** row. It follows the tree's rule for a destructive row: the first press
arms it (the label becomes **Move to trash?**), the second press acts.

Trashing moves the Session's folder:

```
<home>/sessions/<encoded-cwd>/session-<id>/  →  <home>/polish-trash/sessions/<id>/
```

and records where it came from in `<home>/polish-trash/trash-manifest.json`,
written atomically with mode 0600 and read defensively: a manifest that cannot be
parsed is moved to `trash-manifest.json.corrupt-<timestamp>` and the feature keeps
answering, because that file is the only map back to the trashed logs.

A Session is named two ways by the app: the Host hands over a bare uuid where it
owns the id, and the tree lists a Session it discovered on disk by its folder name,
`session-<uuid>`, which is also the form its archive entry carries. Every request
is accepted in both spellings, the archive gate is checked against the id the row
carried, and the folder the store moves always carries the canonical uuid.

The **Archived** header menu gains **Trash · N sessions**, opening a card that
lists each trashed Session with its title, how long ago it went, and the bytes it
takes. From there:

- **Restore** moves the folder back to the exact path the manifest recorded, so the
  persistence layer finds it where it expects, and the Session reappears in the
  Archived list.
- **Delete for good** removes that one transcript permanently (armed, like the row).
- **Empty trash** removes every trashed transcript permanently and reconciles the
  manifest with the filesystem, so an empty trash is empty on disk.

Undo works the way the tree's other bulk actions do: trashing offers **Undo** for
twelve seconds, and it restores through the same route.

## What it deliberately does not touch

- **The workspace folder, and every file in it.** That is your directory, not
  AryaCode's record. The Host's decision record refuses to let any UI row be
  recursive into it, and this plugin honours that.
- **The attachment store** (`<home>/attachments/`). Its objects are
  content-addressed and shared between Sessions, so deleting them for one Session
  can break another, and no plugin can refcount them. Trashing leaves them as
  harmless bytes for a Host-owned garbage collector, if one ever ships.
- **A Session that is not archived.** The archive is the safety gate: archiving
  already stopped the turn, its subagents, its jobs and its schedules. A live
  Session is not ours to remove. The tree only ever offers the row inside the
  Archived section, and the host half re-reads the Host's own archive set on every
  trash request, so a browser that lies about a live Session gets
  `trash_not_archived` and the log stays where it is.

## Shape

- Host: `entries/trash-store.js` is the filesystem half (find / trash / restore /
  purge / empty, the manifest, the byte accounting) — plain ESM, testable against
  temp directories. `entries/trash.js` registers `POST api/polish.trash` with
  actions `list`, `trash`, `restore`, `purge`, `empty`, and owns the archive gate.
- Client: `client/workspace.js` renders the row, the confirmation, the card and the
  Undo. Failures come back with a stable code (`trash_not_archived`,
  `trash_not_found`, `trash_already_trashed`, `trash_restore_target_busy`,
  `trash_missing_entry`, `trash_registry_unavailable`, `trash_bad_id`) that
  `trashFailureNotice` turns into a sentence, because `ENOENT` tells a user nothing
  about their transcript.
- The switch is `sessionTrash`; its host half mounts and disposes with the switch,
  like every other feature in this bundle.

## Verified

On Dev AryaCode (isolated home, packaged profile), with a real archived Session:
the row arms and acts, the folder lands under `polish-trash/sessions/<id>` with the
manifest entry, the row leaves the tree, **Undo** puts it back, Restore from the
card re-lists it in Archived, **Delete for good** and **Empty trash** free the
bytes, and a live Session gets the refusal. Specs: `test/trash.spec.mjs`.

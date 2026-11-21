### Added

- **GitHub workspaces can work as either of two accounts.** The GitHub CLI keeps
  every signed-in account in the keyring and names one of them active. The dialog
  now reads that roster — `gh auth status --json hosts`, falling back to the prose
  parse for an older CLI — and offers a chip per account, the CLI's own marked.
  Picking one is remembered across reloads and rides along on every request
  (status, repository list, picture, clone), so the whole window browses and
  clones as that account while nothing outside the dialog changes; **Follow the
  CLI** releases the pick. With one in force the token is read for that account
  alone (`gh auth token --hostname github.com --user <login>`) and never falls
  back to the active one, so a repository that account cannot see simply does not
  appear rather than failing later at clone time.
- **Each account clones into its own folder:**
  `<home>/AryaCode/<account>/<owner>/<repo>`. A checkout made before this existed
  is still found — the account folder is probed first, the old flat folder second
  — so an existing repository is reused rather than cloned a second time under a
  new name.
- **A fresh clone carries that account's git identity**, written `--local` and
  never `--global`: the display name when GitHub supplies one, otherwise the
  login, and the noreply address `<id>+<login>@users.noreply.github.com`, which
  GitHub credits without publishing anyone's private email. A value the repository
  already carries is left alone, and a reused checkout is never touched.
- **Making an account active in the CLI is its own button** (`gh auth switch
  --hostname github.com --user <login>`), because that is a machine-wide change —
  a terminal's `git` and `gh` follow it — so it is never something browsing does
  silently. When the dialog works as one account and the CLI is on another, the
  sidebar foot names both. **Add another account…** reuses the existing device
  flow, which is what `gh auth login` already does to a keyring that holds
  another account; that flow now renders while a machine is already signed in,
  and a failure of it says so beside the chips.
- **The workspace row's menu gains Copy path.** The shipped row already carries
  Rename, Reveal and Delete; this bundle registers one contribution,
  `polish.workspace`, adding **Copy path** at order 250 — between Reveal and the
  separator before Delete — through the Shell's own context-menu service.

### Removed

- **The sidebar workspace list is the Shell's own again.** `betterWorkspace` and
  the 5,769-line tree that replaced that surface (`client/workspace.js`,
  `entries/sessions.js` and its own `POST api/polish.sessions` route) are gone,
  along with `docs/better-workspace.md`. The seat rested on a claim about the
  harness that turned out not to hold: the shipped workspace row does declare a
  context menu, and a plugin may add rows to it. One registration survives a
  harness update where a replacement never did.
- **Session trash is retired**: `sessionTrash`, `entries/trash.js`,
  `entries/trash-store.js` and `docs/session-trash.md`. Sessions the Shell archives
  stay archived through its own row.
- The **Workspaces +** flow is unchanged and still ships both sources — **On this
  PC** through the desktop folder bridge, **GitHub repository…** through the
  dialog — because `sidebar.workspaces.directoryFlow` is a `single` slot that
  whoever takes stands in for. Nothing in this bundle replaces a shipped sidebar
  surface any more.

### Changed

- `docs/workspace-folder.md` no longer argues that a workspace-row menu is
  impossible. It records what was thought impossible, what changed, and that the
  decision to leave the native workspace plugin untouched still stands — the
  workspace-row menu arrived from DeepSeek as a normal harness update, which is
  exactly the future that decision was protecting.
- 10 spec files went with the code they tested and 13 tests were added for the
  account half: **224 specs pass**. `package.json`'s `test` script now names only
  specs that exist — `node --test` exits 0 on a missing named file, so the script
  had been able to lie while the suite stayed green.

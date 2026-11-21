# GitHub workspaces

**Add workspace from GitHub** turns a repository you can already reach with the
GitHub CLI into a workspace, without a second sign-in and without storing a
token.

## What it does

1. **Reads the CLI session.** The host half runs `gh auth token`. That is the
   whole authentication story: no OAuth app, no device code, no token in a
   settings file, no token in the browser. A missing `gh` and a signed-out `gh`
   look the same through `gh auth token` (both fail), so the dialog also asks
   `gh --version` and separates them: a signed-out machine is offered sign-in, a
   machine without the CLI is offered **Install** — `winget install --id
   GitHub.cli` run on the Host with the agreement flags pre-accepted, polled
   every two seconds like the sign-in, cancellable, with a ten-minute ceiling.
   Where winget is unavailable the failure names the download page; where the
   install dies the failure names the code and the terminal command to repeat it
   (`winget install GitHub.cli`). After a success, sign in as usual — and
   relaunch AryaCode if its session check keeps failing (winget installs land in
   a new PATH).
2. **Lists what that session can clone.** `GET /user/repos` with
   `affiliation=owner,collaborator,organization_member`, paged through the
   `link` header, most recently updated first.
3. **Clones into your own folder.** `<home>\AryaCode\<owner>\<repo>`, created if
   missing. With an account picked in the dialog it is
   `<home>\AryaCode\<account>\<owner>\<repo>` instead — see **Two GitHub accounts
   on one machine** below. A directory that is already the same repository is
   reused instead of cloned again; a directory that is a *different* repository is
   an error, never a silent overwrite.
4. **Creates the workspace.** The clone path is handed to the workspace
   controller (`workspaces.create({ path })`), which is the same call the "+" menu
   makes, so the new workspace behaves like any other.

## Where the token goes, and where it does not

The token is read on the Host and passed to `git` as an `http.extraHeader` value
in git's own environment (`GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_0`/
`GIT_CONFIG_VALUE_0`), never in the remote URL and never on the command line — so
it cannot leak through `ps`, a stored remote, or a shell history. GitHub's git
server rejects a bearer token for clone, which is why the header carries
`x-access-token` basic auth. Every line of git output is scrubbed of the token
before it can reach the browser, and the route answers `cache-control: no-store`.

## Signing in and out

The session belongs to the GitHub CLI, and both directions stay inside the app:

- **Sign in** runs `gh auth login --hostname github.com --git-protocol https
  --web --clipboard --skip-ssh-key` on the Host. With piped stdio that command
  needs no terminal: it prints `! One-time code (XXXX-XXXX) copied to clipboard`
  and `https://github.com/login/device`, then polls GitHub until the code is
  approved. The dialog shows exactly that code with a copy button and the device
  page, polls `loginStatus` every two seconds, and refreshes the repository list
  the moment the CLI reports success. A flow that is never approved is killed
  after five minutes, and cancelling it kills the child immediately; the child
  also dies with the feature, because a pending sign-in is a live process.
- **Sign out** runs `gh auth logout --hostname github.com --user <login>` after a
  second confirming click, then re-reads the session. "not logged in" counts as
  success, because that is the state the click asked for.
- **Where you see it** is the sidebar foot: `GitHub · <login>`,
  `GitHub · signed out`, or `GitHub · no CLI` (the CLI is not installed at all) on
  one line, and the remaining balance (`$4.08 left`) on the next. That row belongs
  to no single plugin — `sidebar.footer.action` is the shell's own flex row and
  every installed plugin adds an entry to it — so polish stacks the row into a
  column while its entries are mounted (a refcount in `claimFooterRow`, restored
  when the last one goes). One line per entry means a plugin added later gets its
  own line instead of a fight over width: side by side, our status text and the
  balance squeezed a remote-access plugin's button down to `Rem…`. The dialog
  repeats the state, and the footer re-reads on window focus so a `gh auth login`
  run in a terminal shows up without a restart.

Nothing about this stores a credential of its own: the code is a one-time device
code, and the token never leaves the CLI's own credential store.

## Two GitHub accounts on one machine

The owner runs a personal account and a work account. The GitHub CLI keeps both in
the keyring and names one of them active, and everything here follows that model
rather than inventing a parallel one.

- **The roster is read from the CLI**, not from a store of our own:
  `gh auth status --json hosts` answers one entry per account with `login`,
  `active`, `state`, `tokenSource`, `scopes` and `gitProtocol`. An older CLI has
  no `--json` there, so the prose parse in `listAccounts` is the fallback rather
  than a second choice — the CLI lists the active account first, which is the only
  signal that parse can trust. A machine without the CLI has no accounts, and that
  is an empty list, not an error.
- **Picking an account is a chip strip in the dialog**: one chip per account, with
  the one the CLI would use marked `CLI active`. The pick is remembered in the
  browser (`aryacode-polish:github-account.v1`) and rides along on every call —
  status, repository list, picture, clone — so the dialog browses and clones as
  that one account while nothing outside the dialog changes. Clicking the picked
  chip again, or **Follow the CLI**, releases the pick and the dialog goes back to
  whichever account the CLI has active.
- **A picked account is used, not assumed.** With a pick in force the Host reads
  that account's token directly (`gh auth token --hostname github.com --user
  <login>`) and never falls back to the active one, so a work repository the
  personal account cannot see simply does not appear rather than appearing and
  failing at clone time. A login that is not one path segment is refused before
  any command runs.
- **Each account clones into its own folder:**
  `<home>\AryaCode\<account>\<owner>\<repo>`. A repository cloned before accounts
  existed is still found — the probe checks the account folder first and the old
  flat folder second — so an existing checkout is reused rather than copied a
  second time under a new name.
- **A fresh clone carries that account's git identity.** The checkout gets
  `user.name` and `user.email` written **locally**, never `--global`: the display
  name when GitHub supplies one, otherwise the login, and the noreply address
  `<id>+<login>@users.noreply.github.com`, which is the only address GitHub
  credits without publishing someone's private email. A value the repository
  already carries is left alone, and a reused checkout is never touched — only a
  clone this dialog just made gets an identity, which is why the identity is
  handed to the clone as a supplier and a reuse never pays for that request.
- **Making an account active in the CLI is a separate button** labelled **Make
  active in the CLI**, and it runs `gh auth switch --hostname github.com --user
  <login>`. That is a machine-wide change — a terminal's `git` and `gh` follow it —
  so it is never something browsing does silently. When the dialog works as one
  account and the CLI is on another, the footer tooltip names both.
- **Adding an account is the same device flow as the first sign-in.**
  `gh auth login` adds another account to the keyring without signing the first
  one out, so **Add another account…** reuses it and there is no second verb to
  maintain. The one-time code block therefore renders while a machine is already
  signed in, and a failure of that second flow says so beside the chips instead of
  vanishing into the signed-out block.
- **Signing out stays honest about the rest.** `gh auth logout --user <login>`
  removes only the account it names, so the notice says who is signed in
  afterwards, and **Sign out of every account** still lists them all.

## How the entry point works

The "+" menu's **Add workspace…** entry only appears when something occupies
`sidebar.workspaces.directoryFlow`, and that slot is `kind: 'single'` — whoever
takes it stands in for the folder picker. This bundle takes it and offers the
two sources the owner asked for:

- **On this PC** — the OS folder dialog. The desktop preload exposes it as
  `window.__DSH_DIRECTORY_PICKER__.pick()`, the same bridge the shipped native
  picker uses, so the flow calls it directly and behaves exactly like the picker
  it stands in for. Where that bridge is absent (the web build) the flow falls
  back to a folder browser driven by this bundle's own route
  (`api/polish.folders`, actions `roots` and `ls`): roots, a `..` row for going
  back, directories only, hidden and system entries filtered out, and **Use this
  folder** hands the current path to the flow's `onPicked`.
- **GitHub repository…** — the dialog described above. It opens on behalf of the
  flow, so a finished clone hands its path back through the flow's `onPicked`,
  and the Shell creates the workspace exactly as it does for a picked folder.

### Why the fallback exists at all

A composed directory picker serves exactly one capability: `browse` answers
`list` and `createDirectory`, `native` answers `pick`. The web profile composes
the picker whose chooser cannot open there, so `directoryPicker.pick()` waits on
a dialog that never appears — an earlier build of this flow did exactly that and
the row spun forever. The preload bridge is the reliable door in the app; the
listing is what a browser gets instead of a spinner.

The tray of the foot keeps the sign-in state (`GitHub · <login>`,
`GitHub · signed out`, or `GitHub · no CLI`) next to the balance, so the account
is visible without opening a dialog; clicking it opens the repository dialog
directly.

## Not used from the AryaAI-era plugin

`@deepseek-ai/dsh-github` was read as a reference and deliberately not reused:
it is a typert remote service with generated protocol packages, and it
authenticates through an OAuth device flow that needs a registered OAuth app.
Its ideas that were kept: reject anything that is not one path segment, reuse a
checkout whose origin already matches, present the token as basic auth in git's
environment, page the repository list, and mark a repository that is already
cloned.

## Tests

`test/github.spec.mjs` covers the path rules (`.`, `..`, separators, empty),
the destination layout, origin comparison across https/ssh forms, token
scrubbing, the CLI token's three failure modes, signed-out and signed-in status,
the missing-CLI answer (`gh --version` present/absent, and `installed: false`
with the install reason), the spawn shape of an install (winget, the CLI id,
agreement flags, the success/code/timeout outcomes, and a machine without
winget), the sign-in-shaped install polling, the `cloned` marker against a real
temporary tree, the spawn shape of a clone (command, `--`, URL, destination, and
the header in the environment rather than in the arguments), the reuse path, the
refusal to overwrite another repository, and a failing clone whose message is
scrubbed. The account half covers the roster from the real `--json hosts` payload
and from the prose fallback (and an empty answer where there is no CLI), the
argument shapes of `gh auth token --user` and `gh auth switch --user`, the
`accounts` and `setActive` actions answering while the machine is signed out, a
named account browsing with its own token and never the active one, a legacy flat
checkout still marked cloned for an account pick, a clone landing in the account
folder, a reuse of that legacy checkout, and an identity written only when the
repository does not already carry one and only ever locally.

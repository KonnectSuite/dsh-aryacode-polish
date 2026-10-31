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
   missing. A directory that is already the same repository is reused instead of
   cloned again; a directory that is a *different* repository is an error, never
   a silent overwrite.
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
  `GitHub · signed out`, or `GitHub · no CLI` (the CLI is not installed at all)
  holds the left edge of the status line, and the balance (`$4.08 left`) takes
  the right one, so the foot reads as one row instead of two
  fragments. The dialog repeats it, and the footer row re-reads on window focus so
  a `gh auth login` run in a terminal shows up without a restart.

Nothing about this stores a credential of its own: the code is a one-time device
code, and the token never leaves the CLI's own credential store.

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
scrubbed.

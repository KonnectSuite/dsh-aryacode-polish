# GitHub workspaces

**Add workspace from GitHub** turns a repository you can already reach with the
GitHub CLI into a workspace, without a second sign-in and without storing a
token.

## What it does

1. **Reads the CLI session.** The host half runs `gh auth token`. That is the
   whole authentication story: no OAuth app, no device code, no token in a
   settings file, no token in the browser. When `gh` is missing or signed out,
   the dialog says so and names the command that fixes it (`gh auth login`).
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

## Why the entry point is the sidebar foot

The "+" menu's **Add workspace** entry only appears when something occupies
`sidebar.workspaces.directoryFlow`, and that slot is `kind: 'single'`: it already
holds the folder picker, so occupying it would mean re-implementing folder
choosing (browse *and* the native desktop picker) just to add a second source.
Rather than replace the shipped picker, the feature adds its own entry in the
sidebar foot next to it. If a multi-source workspace socket ever lands in the
harness, only the registration moves; the route, the clone rules and the tests
stay as they are.

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
the `cloned` marker against a real temporary tree, the spawn shape of a clone
(command, `--`, URL, destination, and the header in the environment rather than
in the arguments), the reuse path, the refusal to overwrite another repository,
and a failing clone whose message is scrubbed.

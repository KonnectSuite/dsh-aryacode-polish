# Handoff — AryaCode Polish

AryaCode Polish is **shipped and installable**, not a plan. This file is the
briefing for whoever picks it up next: what exists, which contracts cost time,
and how to release. `README.md` is the user-facing story and lists every switch;
`docs/` carries the per-feature detail.

## State

- Harness: verified on AryaCode **0.2.2-alpha.2** (build
  `0.2.2-alpha.2.AryaCode.0.1.0`) on 2026-10-28 — installed from npm into a clean
  packaged profile, activation `live`, no import or duplicate-factory error, and
  the tree, icon filter and footer all render. `dsh.engines.dsh` still declares
  `^0.2.1-rc.3`, which excludes a 0.2.2 prerelease; widen it next release.
- Repo: `C:\Users\KNPhu\.arya\github\KonnectSuite\dsh-aryacode-polish` —
  **public**, `main`, clean. HEAD `ab60f86` (the panel-capture fix), on top of
  `a889d23` (0.98.0 docs), `bc71c4a` ("feat(workspace): a spinner while working,
  a green dot when done, the folder emoji"), `6bc2faf` (footer status line),
  `3160def` (glyph colour, icon filter, row menu that keeps its slot) and
  `55e5969`.
- Package: `@aryacode/dsh-aryacode-polish`. Current version **0.102.0**
  (0.100.1 the workspace scroll fix; 0.99.0 before it).
- Distribution: npm `latest` = 0.99.0 (published 2026-10-29T03:0xZ, tarball
  sha256 `329fb714f34e2565b124b9ea5af95859d85acf5f9e3e69e51a81dd9b55236534`) **and** the
  Arya Plugin Market (`KonnectSuite/dsh-arya-market`, branch `catalog`, entry
  `arya: true`, tarball on `registry.npmjs.org`). A market install lands as a
  digest-named tarball under `<profile>/.dsh-market/releases/`, adds itself to
  `dsh.profile.bundles`, and its surfaces mount after a restart. The published
  `lib/client.js` is byte-identical to the verified repo build
  (`fee25c1b8533a443c780cf10b6a474c3c71df0175c926e30deab767d14707eb7`).
- **Not preseeded into the AryaCode installer**, by the user's decision: the
  installer ships the market, the better sidebar and the engineering bundle;
  polish and local-llm are market-only, so users install and update them from the
  market without an app release.
- Eight shipped features, each its own switch (below). **360 specs**
  (`node --test`, ~1 s) — the old "66 specs" figure is long gone.
- Nothing was ever written to the installed AryaCode
  (`%LOCALAPPDATA%\Programs\AryaCode`) or to the installed data home. All
  verification used Dev AryaCode.

## What it ships

| Switch id | What it does | Detail |
| --- | --- | --- |
| `sessionCost` | `≈$…` pill in the composer dock from the session's recorded usage, at the published DeepSeek rates; opens a breakdown card. Host projection `polishCost`. | `entries/usage.js`, `entries/cost.js` |
| `accountBalance` | Remaining wallet in `sidebar.footer.action`, directly above the account row; renders nothing when the Host exposes no wallet. | `client/account.js` |
| `openWorkspaceFolder` | **Open workspace folder** in a Session's `…` menu. | `docs/workspace-folder.md` |
| `githubWorkspace` | Sign in with the GitHub CLI, list repositories, clone one as a workspace. Token stays on the Host, used only as git's auth header. | `docs/github-workspaces.md` |
| `workspaceSources` | **On this PC** / **GitHub repository…** behind the Workspaces **+**. | `entries/folders.js` |
| `betterWorkspace` | Replaces the sidebar workspace list with our tree: folders, pins, day grouping, find, sort, read state, money, bulk actions, keyboard, subagent hiding. **The big one.** | `docs/better-workspace.md` (46 KB, the real spec) |
| `panelScreenshot` | Camera button in the right panel: copies the open tab to the clipboard and attaches it to the message. | `docs/panel-screenshot.md` |
| `aryaStandard` | An **Arya Standard** agent preset: Codex checkpoint compaction over the unchanged `compaction-basic` transaction, a Settings page for its knobs, and a **Compaction** conversation dashboard (trajectory, cache strip, tiles, checkpoints, log, settings). | `docs/arya-standard.md`, `presets/arya-standard/` |

Parked, by the user's decision: right-click spelling corrections — it needs a
shell change no plugin can reach (`docs/parked-spellcheck.md`).

## Arya Standard, specifically

The newest feature is not a surface: it is an **agent preset**, and four contracts
made it shaped the way it is.

1. **A preset is registered in JavaScript, not by a second patch row.**
   `cordis.patch.yml` is pinned to exactly one `insert` with one row by
   `test/patch.spec.mjs`, and $DSH_WEB_APP's preset rows live inside a preset's
   `config.plugins` — nested rows no patch layer can address by id. So
   `presets/arya-standard/definition.js` builds the definition and
   `presets/arya-standard/plugin.js` calls `agentPresets.register(...)` from the
   feature mount. Duplicate registration (`Duplicate agent preset: arya-standard`)
   is logged, never thrown: the already-mounted preset is the one sessions use.
2. **The engine row resolves through the package's own exports.** The row names
   `@aryacode/dsh-aryacode-polish/arya-standard`, which is the `./arya-standard`
   export entry pointing at `presets/arya-standard/engine.js`. A preset row is
   loaded like any other bundle entry, so that default export *is* the compaction
   service.
3. **`summary()` is the only hook.** `@deepseek-ai/dsh-compaction`'s
   `CompactionEngine` is an empty base; trigger, lock, transaction, shrink guard
   and the single replacement message belong to `compaction-basic`. Never
   re-implement those here — overriding `summarize()` keeps a crash's blocking
   `compaction/start` recoverable the way the Host expects.
4. **The settings group is non-volatile on purpose.** A volatile boolean re-runs
   nothing but `sync()`; a plain object field re-runs `apply()`, which is what
   rebuilds the definition. Only sessions created afterwards pick up new numbers.
5. **The tail stays, the Codex shape sits on top.** Codex replaces every assistant
   and tool turn; DSH's loop resumes on the surface, so compacting the newest step
   away made a model stop mid-task in a real session. `retainRatio` (0.16) keeps
   the last step, and the checkpoint carries Codex's prefix plus the user's own
   messages inside it. Do not "fix" that back to 0 without a live loop test.
6. **The Compaction tab is projection-only.** Everything it draws — trajectory,
   cache strip, tiles, checkpoints, failures — is folded from durable session
   events in `presets/arya-standard/projection.js` (state version 2). No route, no
   iframe, no polling: if a number is not in the projection, add it there first.

## Shape of the package

```
cordis.patch.yml      one `- insert:` with one row, id `polish`, bare package name
entries/registry.js   THE feature list — one entry per feature, nothing else
entries/polish.js     the row: Config derived from the registry, apply(), mount/unmount
entries/config.js     accessors: resolve / flag / list / text
entries/usage.js      fold: model-attributed usage out of the session event log
entries/cost.js       polishCost projection + dated rate table + pricing
entries/sessions.js   the tree's own route (POST api/polish.sessions): parent links
entries/folders.js    workspace sources: OS folder chooser / folder list
entries/github.js     GitHub CLI auth, repo listing, clone (Host side)
client/face.js        browser face: shell surfaces, menus, cost pill, balance line
client/workspace.js   the tree itself (211 KB — read docs/better-workspace.md first)
client/arya.js        Arya Standard settings fields + the Compaction tab
presets/arya-standard/  the preset: definition, prompt adaptation, engine row, projection
client/money.js       wallet choice + amount rendering (inlined into the bundle)
client/account.js     granted, timeout-bounded balance read (inlined)
client/switches.json  browser half of the seam: one entry per switch
scripts/build-client.mjs  wraps the client modules into lib/client.js
lib/client.js         generated (≈516 KB) — never hand-edit, `pnpm build:client`
lib/index.js          mount point, re-exports the row
locale/en.json, zh.json  card title + description (keys must match)
```

### Adding a feature

1. One entry in `entries/registry.js`
   (`{ id, label, description, defaultOn, mount? }`) — that entry *is* the
   volatile switch, because the row's `Config` schema is derived from the list.
2. One matching entry in `client/switches.json`, or `test/client-face.spec.mjs`
   fails the parity check in either direction.
3. Put anything testable in a plain ESM module and let `scripts/build-client.mjs`
   inline it (`export ` is stripped); keep `client/face.js` to hooks and markup.
4. A row in the README `Switches` table — `test/docs.spec.mjs` fails when a switch
   is missing there, and the README may not claim an "N features shipped" count.
5. Test: host logic in `test/*.spec.mjs`, then `pnpm test`, `pnpm pack`, install
   into Dev AryaCode, verify in the browser, commit, release.

## Contracts that cost real time

- **A row's config namespace is the ROW ID, not the slot key.**
  `ctx.get('configForms').get('polish')` is the live form. Registering the slot
  still uses the key `` `@aryacode/dsh-aryacode-polish#polish` ``. Mixing them up
  yields `state.status === 'unavailable'` and the page silently shows
  "This row has no configuration to change."
- A config field must be `.volatile()` to reach the settings domain, and its value
  arrives as an accessor `{ get() }` — unwrap with `flag()`/`text()`/`list()`,
  never `=== true`.
- A volatile-only change does **not** re-run `apply()`. `entries/polish.js` mounts
  and disposes features from `loader/volatile-update`.
- Declaring `dsh.client` obliges `exports['./client']`, and the `id` inside
  `window.__ModuleLoader__.load({ id })` must equal the package name. The bundle's
  row in `cordis.patch.yml` must name the bare package specifier: the Shell
  classifies a client row by `exactPackageSpecifier`, so a `/polish` subpath is
  rejected and yields no client entry.
- There is **no bundler** for the face: the build is a text wrapper. Anything you
  `require` must come from the Shell's frozen module table — in practice only
  `require('react')`; everything else has to be inlined from source.
- The client session contract exposes **no events** (`ISession`,
  `SessionSnapshot`). Anything derived from the log must be a host projection via
  `ctx.sessionProjections.register(...)`, which is a ctx effect: disposal follows
  the fiber. For facts the projections cannot carry, the tree uses its own Host
  route, `POST api/polish.sessions` (`entries/sessions.js`), answered from the
  session rows' `parentSessionId` — the route exists because projections are empty
  on a profile whose subagents were never resumed (0.93.4 vs 0.94.0).
- **Slot geography matters.** `SidebarRoot` renders `footerActions`
  (`sidebar.footer.action`) *above* `settingsArea` (`sidebar.settings` →
  `settings.launcher` → the account row). Nothing documented renders below the
  login; the only way is shadowing `settings.launcher`
  (`replaceRisk: 'shadows-shipped-ui'`), which means reimplementing the account
  row and its menu. The user chose the footer action.
- An account read must be **granted and bounded**:
  `remoteAccess.whenAccess('account/watch', …)`. If the grant never arrives and
  nothing times the read out, the promise never settles — the line stays empty
  for the life of the page. `client/account.js` uses a 10 s ceiling and starts the
  call before the effect's yielded disposer.
- **The tree's metrics are the shipped list's.** 0.95.x pinned workspace rows to
  34px, session rows to 32px, 8px inline padding, titles 14/20, counts and money
  12/17 tertiary, section headings 12px sentence case, chips 22px pill height,
  density presets comfortable 34 / compact 28 / folders 30. Change one of those
  and the tree stops looking native.
- The market badge still reads **"Host requirement unknown"** even with
  `dsh.engines.dsh` declared and the package on npm. That is market-side; the same
  declaration does feed the compatibility filter
  ("Hid 0 plugins incompatible with DSH 0.2.1-rc.3").

## Editing these files

Never round-trip them through PowerShell string operations. `Set-Content
-Encoding utf8` writes a BOM that kills the specs (`SyntaxError: Unexpected token
''`), and a `-replace` round-trip once stored cp1252 bytes (`—`, `…`, `≈`)
that shipped to the UI. Bump versions with `npm pkg set version=…`
(`pnpm pkg` is not implemented in pnpm 11.0.9), and rewrite JSON through node.

## Development loop

```powershell
cd C:\Users\KNPhu\.arya\github\KonnectSuite\dsh-aryacode-polish
pnpm test                 # 322 specs, node --test
pnpm pack                 # runs build:client first

# Web profile (fastest for browser checks)
cd C:\Users\KNPhu\.arya\github\KonnectSuite\AryaCode
$env:DSH_HOME = "C:\Users\KNPhu\AppData\Local\AryaCode-dev\home"
node --import tsx/esm apps/cli/src/bin.ts plugin --profile web add <tgz>
pnpm run start:web -- --no-open      # print the token URL from the output
```

- **The desktop app resolves its home from `ARYACODE_HOME`, not `DSH_HOME`**
  (`apps/desktop/src/paths.ts:31-35`, `main.ts:6`). Launching it with only
  `DSH_HOME` set makes it share the installed app's `userData` and profile, take
  the same single-instance lock, and exit silently with code 0. `AryaCode-dev.bat`
  now sets both; do the same by hand.
- The `file:` pin means a repack at the **same version is never refetched** — bump
  the version for every install, or remove then add.
- Kill the old server before starting a new one: a second `start:web` while port
  3080 is held exits silently with code 1 (`Get-NetTCPConnection -LocalPort 3080
  -State Listen` names the owner).
- `plugin --profile desktop` is refused: *"profile 'desktop' is managed
  exclusively by the Electron application"*. Desktop installs are the user's
  action in the app.
- Browser checks: Playwright core required from
  `C:/Users/KNPhu/.arya/github/KonnectSuite/dsh-engineering/`, Chromium at
  `C:/AI/AryaBenchRuntime/browsers/chromium-1248/chrome-win64/chrome.exe`. Useful
  patterns in `C:\Users\KNPhu\OneDrive\Documents\AryaAI\Fixes\devpolish*.mjs`:
  the package name text is the clickable thing (there is no "View …" link), the
  market search box is `input` index 1, and installing needs the confirm dialog's
  **Confirm install** button, not just `Install`.
- `Invoke-WebRequest` on the token URL proves nothing about a plugin: the SPA
  never names a row. Trust the boot payload and a rendered page.

## Release

```powershell
cd C:\Users\KNPhu\.arya\github\KonnectSuite\dsh-market
node scripts/publish-arya-catalog.mjs --pull          # FIRST — otherwise the record is lost
node scripts/publish-arya-release.mjs --npm <version> `
  --source KonnectSuite/dsh-aryacode-polish `
  --description "<en>" --description-zh "<zh>" --publish
node scripts/publish-arya-catalog.mjs --push
```

- `--tarball <tgz>` also works (a GitHub release asset instead of the registry).
  The scripts refuse any archive whose manifest lacks `dsh.bundle.patch`.
- Order matters: `--pull` after a release record **overwrites it** and `--push`
  then reports "nothing to publish". Pull, release, push.
- Verify afterwards from the remote, not from the working copy:
  `gh api repos/KonnectSuite/dsh-arya-market/contents/data/arya-plugins.json?ref=catalog -H "Accept: application/vnd.github.raw"`.
  `raw.githubusercontent.com` caches for a few minutes.
- The old `publish_catalog.py` in `AryaAI\Fixes\aryastrata-tune` cannot create a
  first-time entry (`StopIteration`) and is superseded by the scripts above.
- Tell the user to quit and reopen AryaCode after a release; the market registry is
  cached in the running process.

## Open items

1. **The balance line's populated state has never been seen.** This workstation
   refuses the account platform calls (403 on the profile read), so no wallet
   exists to display; only the mounted-empty state and the unit-tested read are
   proven. Verify on a signed-in machine before trusting the number.
2. **Spellcheck stays parked** unless the user asks for it; reviving it means the
   ~10-line change in `apps/desktop/src/main.ts` described in
   `docs/parked-spellcheck.md`, shipped as a patch release of the harness.
3. The **"Host requirement unknown"** badge is a market-side gap, not a manifest
   gap.
4. Polish is deliberately **not** in the installer seed, so a machine without the
   market installed has no polish until it installs it; if that ever changes, it
   is one entry in `apps/desktop/src/starter-plugins.ts`.
5. The next features are whatever the user names — the seam is ready, and one
   feature is one registry entry plus one switch entry plus its surface.

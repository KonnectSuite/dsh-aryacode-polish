# Releasing a plugin (and making it appear)

A release has **four** independent steps, and three of them can silently look
"already done". This page is the checklist; `scripts/release.mjs` runs steps 1–3
mechanically.

| # | Step | Where it lives | What "done" looks like |
|---|------|----------------|------------------------|
| 1 | Publish the version | npm registry | `npm view <pkg>@<ver> version` answers the version, and a **cold-cache** `npm pack` downloads it |
| 2 | Install that version | the profile | `profiles/<name>/package.json` and `pnpm-lock.yaml` both name the version |
| 3 | Reload the host | the running app | the plugin's host code is the new one (a page reload does **not** do this) |
| 4 | Reload the page | the browser window | the client bundle is the new one (a host reload does **not** do this) |

Most "it published but nothing changed" reports are step 2: publishing to npm
changes nothing on any machine until that machine installs the version.

## 1. Publish

```bash
node scripts/release.mjs --minor --note docs/release-notes-0.115.0.md --title "MCP servers in the sidebar"
```

What it does, in order: preflight (clean tree, on `main`, npm authenticated),
bump `package.json`, prepend the `CHANGELOG.md` section, rebuild
`lib/client.js`, run every `test/*.spec.mjs` file in-process, commit, push,
`npm publish --access public`, then poll the registry until the version resolves.

Two registry behaviours to know:

- **`202` staging.** npm accepts the upload and answers
  `Your package is being processed and may take a few minutes`. The version can
  be 404 for one to three minutes before it appears. That is normal; the script
  waits it out. Do not conclude the publish failed.
- **`409 Cannot publish over previously staged version`.** The same version is
  already in the queue. It is not an error to fix by bumping again — poll until
  it resolves. Only bump when `npm view <pkg>@<ver>` shows a *different* body
  than yours.

Verify without trusting your own client:

```bash
npm view <pkg>@<ver> version dist.tarball dist.shasum
mkdir -p /tmp/x && cd /tmp/x && npm pack <pkg>@<ver> --cache ./cache --prefer-online
```

A cold-cache `pack` is the only proof that a stranger can install it. A plain
`Invoke-WebRequest`/`curl` against the tarball URL can answer `404` for a
published version; that is a client quirk, not a missing package.

## 2. Install it on a machine

**Never copy files into `node_modules` by hand.** It works until the next
`pnpm install` or app start reverts it, and it leaves `package.json` claiming the
old version — which is why a card can read the old number while the files are
new, or the reverse.

Use the plugin manager, or pnpm with the app's own pnpm:

```powershell
cd $env:USERPROFILE\.aryacode\profiles\desktop
node "C:\Users\<you>\AppData\Local\Programs\AryaCode\resources\runtime\primary-runtime\dependencies\pnpm\bin\pnpm.mjs" add "@scope/pkg@<ver>" --save-exact
```

`--save-exact` matters. A profile that pins `"0.114.0"` (no caret) is **up to
date** by definition, and the market's "Up to date" chip is telling the truth:
it compares what is installed against what the registry publishes, so it will
offer the update, but the *pin* never moves on its own.

Verify the install, not the intention:

```powershell
(Get-Content .\node_modules\@scope\pkg\package.json -Raw | ConvertFrom-Json).version
Select-String .\package.json -Pattern <pkg>          # the pin
Select-String .\pnpm-lock.yaml -Pattern <pkg> -Context 0,2
```

After installing, the app needs a **restart or a plugin reload** for host code
(`mcp/`, `entries/`, `presets/`), and a **page reload** for the client bundle
(`lib/client.js`). They are separate loads: a page reload alone leaves the old
host, and a plugin reload alone leaves the old bundle in the open window.

## 3. Make the market card show it

The market caches its update answers **in the host process** for 30 minutes
(`UPDATES_TTL_MS` in `@aryacode/dsh-arya-market/lib/updates.js`), and only an
install or a host restart clears that cache. So, in order:

1. Reload the page — the installed version on the card is read fresh.
2. If the card still says "Up to date" for a version you just published, it is
   the 30-minute cache, not your publish. Restart the app, or wait it out.
3. If it still offers nothing, install with pnpm (step 2). The card will then
   read the new installed version on the next page load.

## Symptom → cause

| Symptom | Cause | Fix |
|---|---|---|
| Card shows the version you installed, "Up to date" | expected — you are current | nothing |
| Card shows an **old** version after a successful install | page loaded before the install | reload the page |
| Card shows "Up to date" while npm has a newer version | 30-minute host cache | restart the app, or wait |
| New sidebar row / settings page missing | the open window still runs the old `lib/client.js` | reload the page |
| Route answers `Unknown action "..."` | the host still runs the old module; the client is new | reload the plugin (Plugins switch off/on) or restart |
| Card reads the old version but the files are new | files were hand-copied; `package.json` still pins the old one | install with pnpm, `--save-exact` |
| Publish "succeeded" but `npm view` 404s | npm is still processing a staged upload | wait 1–3 min, poll again |

## Why hand-copying is the recurring bug

Every incident in this repo's history traces back to the same shape: a file was
placed into the profile directly, so the *runtime* and the *manifest* disagreed.
The card, the lockfile and the loader each read a different one of the three.
Install through the package manager and there is only one truth.

# Changelog

## [0.3.4] - 2026-10-27

### Added

- **The bundle says which Harness it runs on.** `dsh.engines.dsh` is now declared
  (`^0.2.1-rc.3`, the revision the two surfaces were verified against), so the
  market can read the requirement instead of labelling the card "Host requirement
  unknown", and an install onto an older Host can be refused rather than failing
  at mount time. `test/manifests.spec.mjs` keeps the field present and semver.

## [0.3.3] - 2026-10-27

### Fixed

- **The balance read could wait forever.** When the Host withheld the
  `account/watch` grant, the read's promise never settled: the callback never
  ran, so nothing resolved and the line silently stayed empty for the life of the
  page. The read now carries a timeout and also starts its call before the
  effect's yielded disposer, so an effect runner that stops at the first yield
  still performs it. `test/account.spec.mjs` pins all seven refusal paths.

### Changed

- The read itself moved into `client/account.js`, beside `client/money.js`, for
  the same reason: the build inlines it into the browser bundle and the spec
  imports the same source.

## [0.3.2] - 2026-10-27

### Changed

- **The balance decisions are testable.** Which wallet a line shows, and how the
  amount is rendered (currency symbol, two decimals, unparseable values shown
  verbatim), moved into `client/money.js`. The build inlines that file into
  `lib/client.js`, so `test/money.spec.mjs` covers the exact source the browser
  runs instead of a copy.

## [0.3.1] - 2026-10-27

### Fixed

- **The balance line had no observable mount point.** When the account exposed no
  wallet it rendered `null`, which is correct for the user but indistinguishable
  from "the surface was never registered" for anyone verifying the build. The
  component now always renders its wrapper (`data-polish-balance="empty"`, hidden)
  and fills it with the amount only when the Host returns one.

## [0.3.0] - 2026-10-27

### Added

- **Remaining account balance in the sidebar foot.** A line above the account row
  shows the account's own wallet (`$17.33`), read once through a
  `remoteAccess.whenAccess('account/watch', …)` grant so the call is allowed and
  the grant is released as soon as the read settles. It renders nothing at all
  when the switch is off, when the Host exposes no wallet, or when the read is
  refused — an empty line beats a number the Host did not give us.
- **A second switch, `accountBalance`.** It is declared once in
  `entries/registry.js` and once in `client/switches.json`, exactly like the cost
  switch, so the Configure page grows it automatically.

### Notes

- The line sits in `sidebar.footer.action`, the one documented seat in the
  sidebar foot. It renders *above* the account row, because
  `SidebarRoot.tsx:405-411` puts `footerActions` before `settingsArea`; the only
  seat below the login would be `settings.launcher`, which means shadowing the
  account row and its whole menu.

## [0.2.4] - 2026-10-27

### Changed

- **The card leads with the number it is about.** It now opens with the
  "Estimated session cost" heading and the live `≈$…` amount, then a stacked bar
  showing how the session's tokens split between cached input, uncached input,
  cache writes and output, then the rows: cache hit, tokens, model, provider,
  requests, and the estimate again above the footnote. Model and provider are
  always named (they were only listed when a session had more than one), so a
  first look says which route the money was spent on.

## [0.2.3] - 2026-10-27

### Fixed

- **A sub-cent turn no longer reads `≈$0`.** `formatMoney` rounded to three
  decimals, so a real 22.1K-token turn whose actual cost was about $0.000095
  showed as zero. Amounts under a cent now keep two significant digits
  (`≈$0.000095`), cents keep three decimals, and dollars keep two.

## [0.2.2] - 2026-10-27

### Fixed

- The pill's `≈` was stored as cp1252 mojibake (`â‰ˆ`), so a real turn rendered
  `â‰ˆ$0.003` instead of `≈$0.003`. Same cause as the two strings repaired in
  0.2.1 — a PowerShell round-trip over the face source — and the last of that
  damage. Verified against a real turn in Dev AryaCode.

## [0.2.1] - 2026-10-27

### Fixed

- **The Configure page found no form.** The page body asked
  `configForms.get('<package>#<row>')`, but the Plugins page builds a row's form
  from the **row id** alone (`PluginManagerPage.tsx:1735` passes
  `form={formFor(openRow.rowId)}`, and `formFor` matches `view.ns === id`). The
  lookup now asks for `polish`, so the row's page reads the live form instead of
  saying the row has no configuration to change. The `plugins.row.config`
  registration key is unchanged: that one is still `<package>#<row>`.
- Two strings that a PowerShell round-trip had written as cp1252 mojibake
  (`Loading configuration…`, `Saving…`, and an em dash) are back to UTF-8.

## [0.2.0] - 2026-10-27

### Added

- **Estimated session cost.** A composer-dock pill (`≈$0.39`) that opens a
  breakdown card: cache hit, uncached input, cached input, output, requests, and
  the estimate itself, with the same "your provider's bill is authoritative"
  footnote. The money is computed **host-side**: `entries/usage.js` folds
  model-attributed usage out of the durable session log, and `entries/cost.js`
  registers a `polishCost` projection whose wire view is already priced at the
  published DeepSeek rates (off-peak table, peak at 2×, cache writes billed as
  misses). The browser half only formats numbers, so no rate table ships to the
  client and an unknown model or provider leaves the estimate marked incomplete
  instead of quietly reporting a wrong number.
- **`test/cost.spec.mjs`.** Fold and pricing coverage: peak/off-peak, cache
  rates, cache writes as misses, unknown route handling, retry accounting, and
  the empty-session wire view.

## [0.1.1] - 2026-10-27

### Added

- **The row's Configure page.** `lib/client.js` is the bundle's browser face: it
  registers the `polish` row's configuration page, so the row now has a page of
  its own that reads the row's live config form and writes it back with the
  Host's revision. With no feature landed yet the page states that plainly
  instead of showing a switch that toggles nothing.
- **`client/switches.json`.** The browser half of the feature seam: one entry per
  switch, and `test/client-face.spec.mjs` fails when it and `entries/registry.js`
  disagree in either direction.

## [0.1.0] - 2026-10-27

### Added

- **AryaCode Polish bundle.** One package, one row (`polish`), one switch per
  quality-of-life feature, so each refinement can be turned off from its
  Configure page without uninstalling the bundle.
- **Feature seam.** `entries/registry.js` is the single list of features, and the
  row's config schema is derived from it: a new entry gains its volatile switch
  with no second registration, and switching a feature off disposes its host
  half instead of merely hiding it.
- **`docs/parked-spellcheck.md`.** Records why right-click spelling corrections
  cannot be a plugin, and the exact shell change that would restore them.

### Not shipped

- Right-click spelling corrections. The candidates came from Chromium's
  spellchecker through the Electron main process; the shell no longer reads
  them, and no plugin contract can reach that menu. Parked with evidence.

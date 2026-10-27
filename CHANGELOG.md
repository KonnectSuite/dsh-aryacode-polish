# Changelog

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

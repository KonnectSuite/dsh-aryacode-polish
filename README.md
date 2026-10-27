# AryaCode Polish

One install for the small things that make AryaCode feel finished: GUI
refinements, shortcuts, panels and informative additions, packaged as one
plugin built on the current Cordis plugin strategy.

Status: repository created. The feature list and the package scaffold come next.

## Naming

- Display name: **AryaCode Polish**
- Repository: `KonnectSuite/dsh-aryacode-polish`
- Package: `@aryacode/dsh-polish` (short) or `@aryacode/dsh-aryacode-polish`
  (matches the repository, like `@aryacode/dsh-engineering`)

## Ground rules

- Additive only: no fork of the AryaCode shell, no patched installed app.
- Use the documented plugin contracts (client faces, `plugins.*` slots, host
  routes) so the plugin survives a harness update.
- Every surface must be switchable from the row's Configure page.
- No feature ships without a test and a README entry.

## Layout (once the features are known)

The package will follow the same shape as `dsh-engineering`: host half in
`lib/index.js`, browser face built into `lib/client.js`, and one row in the
Plugins page.

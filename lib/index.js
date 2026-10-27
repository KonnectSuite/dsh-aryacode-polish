/**
 * Host half of AryaCode Polish.
 *
 * The row in `cordis.patch.yml` names this package and not a subpath, because a
 * package registers exactly one client bundle and the Shell resolves it from the
 * exact package specifier the mounted row names. The host work itself lives in
 * `entries/polish.js` — a registry of features, each gated by one volatile
 * switch — so this module exists to be that mount point and re-exports the row.
 */
export { Config, apply, features, inject, name } from '../entries/polish.js'

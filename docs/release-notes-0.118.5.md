### Fixed

- **The custom workspace tree lost every built-in session action.** The Shell moved
  Pin, Rename, Fork, Copy session ID and Archive out of the
  `sidebar.workspaces.session.menu.item` slot and into its `contextMenus` service;
  the tree still drew its own menu from the slot, so a right-click showed only
  **More session actions…**, **Open workspace folder**, **Open this session's
  folder**, **Flag this session** and **Session note…**.
  - A session right-click or **…** now hands the Shell
    `contextMenus.open({ kind: 'session', value: { sessionId, displayTitle } })`,
    and the Shell's own overlay draws the whole menu: its built-in actions and this
    bundle's rows together. The tree's internal menu is kept only as the fallback
    for a Shell without that service.
  - The dead **More session actions…** row and the copy of the built-ins are gone;
    the service is bound with its own `ctx.inject(['contextMenus'])`, so the seat
    still mounts when a composition has no menu service.
  - `docs/better-workspace.md` now records that the Session menu belongs to the
    Shell, and `test/client-face.spec.mjs` pins that the tree opens it.

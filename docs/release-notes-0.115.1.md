### Fixed

- **The sidebar foot stacks instead of squeezing.** `sidebar.footer.action` is one
  flex row owned by the shell, so every installed plugin's entry shares it. Adding
  a remote-access plugin squeezed its button down to `Rem…` beside this bundle's
  GitHub status and balance (`$35.09 left`), because a horizontal foot is a width
  contest nobody declared.
  - Polish now claims that row and turns it into a column while its entries are
    mounted — refcounted in `claimFooterRow`, restored when the last entry leaves —
    so every entry gets a line of its own and a plugin installed later does not
    have to guess how much width it was left.
  - The walk skips the seat's `display: contents` wrapper: the row that actually
    lays an entry out is the flex container above it.
  - The GitHub status and the balance are full-width lines now, so `$35.09 left`
    keeps its word and the label only truncates when the sidebar itself is
    narrower than the text.
  - `test/client-face.spec.mjs` pins the stack, the refcount and the restore;
    `AGENTS.md` rule 8 and `docs/github-workspaces.md` record why.

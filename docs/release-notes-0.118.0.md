### Changed

- **The GitHub line is an identity row now.** It matches the account row above it
  — a 24 px profile picture, a 14 px label, a 44 px row, the same hover — instead
  of a 12 px footnote. The picture is read on the Host and handed to the browser
  as a data URL (256 KB cap, keyed by login, 24 h cache), so the webview never
  contacts a third-party host; a missing picture falls back to the login's initial,
  and a signed-out machine to a drawn person glyph.
- **The DeepSeek balance sits beside the account it belongs to.** `$26.15` is now
  portalled to the right end of the account row rather than taking a line in the
  foot. The row is the Shell's and offers no seat, so it is located by the Shell's
  own `data-slot` attribute — never a CSS-module class — re-attached if React
  re-renders it away, and hidden in the 36 px rail. When the row cannot be found,
  the amount is not drawn twice.
- **MCP moved into the sidebar and became the manager.** **Settings → MCP servers**
  is gone; the **MCP** row in the sidebar now lists every server — the ones this
  page manages and the ones another plugin mounts — with health, tool counts, its
  own mark, a detail view, and the whole add flow (catalog, GitHub search, paste,
  manual). Each server wears an icon from a bundled sprite (Simple Icons marks for
  the well-known services, drawn glyphs for the generic ones, a monogram-free
  fallback so an unknown server is never given someone else's logo).

### Added

- **GUI rules.** `AGENTS.md` rule 9 and `docs/gui.md`: design before you draw —
  tokens only, the 8 px grid, the 12/13/14 hierarchy, every state, keyboard
  reachability, and a rendered screenshot before shipping. Management surfaces
  follow AryaInfer's density; sidebar chrome copies the Shell's own metrics.

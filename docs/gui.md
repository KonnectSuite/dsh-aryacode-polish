# GUI rules

Every new or edited surface in this bundle follows this list. It is the checklist
behind `AGENTS.md` rule 9, and it applies to a five-line footer row as much as to
the MCP page.

## Where the design comes from

- **Sidebar chrome copies the Shell.** A row that sits beside the account row or
  the workspace tree uses the Shell's own metrics, taken from the source that draws
  them (`ui-settings-account`'s 44 px row, 24 px picture, 14 px label; the
  workspace tree's 34 px comfortable row). Looking like a peer matters more than
  looking like the design reference.
- **Management surfaces follow AryaInfer.** Its MCP dialog and chat pages are the
  reference for a page that manages things: a 300 px list beside a detail pane, a
  primary action at the top of the list, an icon tile per row, chips for state,
  and a toast for outcomes.
- **Colour, type and radius always come from tokens.** `--dsw-alias-*`,
  `--dsw-radius-*`, `--dsw-elevation-*`. A literal colour is a bug: it does not
  follow the light/dark switch. (`color-mix()` on a token is fine.)

## The scale

| Thing | Value |
| --- | --- |
| Spacing | 8 px grid: 4, 8, 12, 16, 24, 32 |
| Type | 12 px secondary, 13 px body, 14 px emphasis, 20–22 px page title |
| Row height | 34 px (tree), 44 px (identity), 42–44 px (page rows) |
| Icon tile | 24–28 px, radius 8, brand tint at 8 % |
| Radius | 6 / 8 / 12 px |
| Hairline | `0.5px solid var(--dsw-alias-border-l2)` |

## Every surface has to answer these

1. **States.** Empty, loading, error, and disabled are designed, not rendered as
   an empty box. A refusal says why in the user's words.
2. **Interaction.** Hover, press, focus-visible and disabled exist for every
   control. A hover style that only works with a mouse also needs a keyboard
   equivalent (`:focus-visible`).
3. **Hierarchy.** One primary action per surface. Secondary actions are quieter,
   destructive actions are red *and* confirmed.
4. **Honesty.** A number the Host did not give us is not drawn (no `$0.00`, no
   `0 tools`); a switch that could not be applied says so instead of flipping.
5. **Keyboard and labels.** Every control is reachable by Tab, has an
   `aria-label` or visible text, and the list is not a trap for Escape.
6. **Width.** The surface is drawn at the width it really gets: a sidebar page is
   not a settings dialog. Long labels ellipsize; nothing overlaps a neighbour.
7. **Theme.** Check light and dark before shipping. A colour that was fine on
   white is the usual casualty.

## Verify with a rendered picture

Source review does not prove a layout. Render it (a snippet through the image
tooling, or the app itself) and look at it — the footer-stacking work in this repo
was only correct after the rendered row showed the actual crush point.

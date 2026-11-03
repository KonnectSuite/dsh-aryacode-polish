# Inline previews in the chat

A turn that writes `cat-on-bike.html` leaves a code block behind: the Shell can
render markup and images, but only in the right-panel document tab. This feature
draws the same files under the assistant message, where the turn that made them
is.

The switch is **Inline previews in the chat** (`inlinePreviews`), on by default.
Off, the card is never registered and the conversation looks exactly like the
shipped one.

## Where the card comes from

`conversation.chat.turnTail` is a **list** seat the Shell renders under a
completed assistant message, before the action row. `ui-deliverables`, `ui-plan`
and `ui-schedule` already contribute cards there, so a preview card is an
addition, not a takeover — nothing the Shell draws is replaced.

The card is registered by this bundle's client face (`client/face.js`) and drawn
by `client/preview.js`.

## What it draws, and what it refuses

| Suffix | Rendering |
| --- | --- |
| `.html`, `.htm` | Fed to a `sandbox="allow-scripts"` iframe, with the policy below inserted into the document's head |
| `.svg` | Same frame — an SVG document renders as a document |
| `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp` | An `<img>` from the Host's base64 data URL |

Everything else is refused by both halves: the card never asks, and the Host
route rejects the extension even if it is asked. `.js` is deliberately not
previewed in the chat, even though it is text.

## Which files

The paths come from the Shell's own `deliverables` turn data — the same value the
delivered-file cards read — so this card cannot disagree with them about what the
turn produced. The first three previewable files of the turn are drawn; a turn
that writes twelve does not push the next turn off screen.

## The trust boundary

The card runs model-authored markup, so it is treated as hostile:

- `sandbox="allow-scripts"` **without** `allow-same-origin`: the frame gets an
  opaque origin, cannot read cookies, storage or the parent DOM, and cannot
  navigate the top window.
- A `Content-Security-Policy` of
  `default-src 'none'; img-src data: blob:; media-src data: blob:; font-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action 'none'; base-uri 'none'`
  is the first thing in the framed document's head. Inline style and script work
  (an animation needs both); every network fetch, form post and external image is
  refused, so markup cannot phone home.
- The policy is inserted **before** the rest of the head, so it is in force
  before any script it constrains is parsed.

The Host route is the other half of that boundary (`entries/preview.js`):

- absolute path only, resolved once, and only a regular file;
- extension allowlist above;
- a size cap — 512 KB for markup, 8 MB for an image;
- one action (`read`), POST only, answering `{ ok: false, error }` in words on
  every refusal. There is no listing, no globbing and no write.

## Open in panel

Every card carries **Open in panel**, which hands the path to the Shell's own
document preview (`openFile`) — that is where PDF, Office, Markdown, wrap and
reload already live. The chat card is the glance; the panel is the tool.

## Limits worth knowing

- Only the tail of a completed turn draws a card. A turn still streaming shows
  nothing until it finishes.
- A file the turn wrote and then deleted draws its failure line ("This file could
  not be previewed: …") rather than disappearing.
- The size caps are constants, not configuration: they bound what a preview costs
  the browser, and a file over the cap is a panel job, not a chat job.

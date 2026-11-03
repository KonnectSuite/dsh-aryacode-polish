### Added

- **Inline previews in the chat.** A turn that writes `cat-on-bike.html` now shows
  the page under its message instead of only a code block: markup renders in a
  sandboxed frame, raster images render as pictures, and every card carries
  **Open in panel**.
  - The card rides `conversation.chat.turnTail`, the list seat `ui-deliverables`,
    `ui-plan` and `ui-schedule` already contribute to, so nothing the Shell draws
    is replaced. A keyed `tool.call.toolview` occupant would have shadowed the
    shipped write/edit row and its diff.
  - Paths come from the Shell's own `deliverables` turn data, so the card never
    disagrees with the delivered-file cards about what the turn produced; the
    first three previewable files are drawn.
  - The framed document is hostile input: `sandbox="allow-scripts"` without
    `allow-same-origin`, and `default-src 'none'` with only inline style/script
    and data/blob images, inserted before the document's own `<head>` content.
  - A new Host route, `api/polish.preview`, reads one file per request: absolute
    path, regular file, extension allowlist (`.html .htm .svg .png .jpg .jpeg
    .gif .webp`), 512 KB for markup and 8 MB for an image, refusals answered in
    words.
  - Switch: **Inline previews in the chat** (`inlinePreviews`). See
    [Inline previews](docs/inline-previews.md).

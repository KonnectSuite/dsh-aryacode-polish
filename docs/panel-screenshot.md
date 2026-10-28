# Right-panel screenshot

The right panel grows a camera button in its own top-right corner, beside the
Shell's split, expand and close controls. One click photographs the right
panel's **open tab**, puts the picture on the clipboard, and attaches it to the
message being written — the same place a pasted screenshot lands, so it can be
sent with the next prompt without touching another tool.

This page records how that works, and — more importantly — what it cannot do,
because the honest limits are the part that decides whether it replaces a snip
tool for a given job.

## What it captures

The right panel is ordinary DOM in the same document as the chat, so the target
is found with an attribute selector rather than a private class name:

| target | selector |
|---|---|
| the open tab's body | `[data-sidebar-right-session][data-sidebar-right-open] [data-dockkit-pane-active]` |
| the panel itself (fallback) | `[data-sidebar-right-session][data-sidebar-right-open]` |
| the bottom panel (fallback) | `[data-dsh-panel][data-dsh-bottom-panel]` |

The first selector is what makes this work for both right sides: the Shell's own
sidebar and `dsh-better-sidebar` both render their tabs through the same dock
container, so the *active pane* is the current tab in either one. Targets are
skipped when they are smaller than 48 px in either direction, which keeps a
collapsed panel from producing a sliver.

## How the picture is made

`html2canvas` (vendored at `vendor/html2canvas.min.js`, inlined into
`lib/client.js` by `scripts/build-client.mjs`) rasterises the element in the page
at `min(2, max(1.5, devicePixelRatio))`. The background is the first opaque
ancestor colour, so a transparent panel still reads as a surface.

This is the only route a plugin has. The Shell exposes:

- **no capture bridge** — the desktop preload exposes `__DSH_DIRECTORY_PICKER__`,
  `__DSH_HOST_PATHS__`, `dshDesktopBoot`, `dshDesktop`, `dshPlatform`, and no
  screenshot channel;
- **no working `getDisplayMedia`** — the API exists, but nothing installs a
  display-media request handler on the app's session, so the call is refused
  outright rather than offering a source;
- **no Host route to pixels** — the Host runs in a separate process and has no
  access to the renderer.

Capture therefore happens in the renderer, from the DOM, which is also why it
works identically in the web build and in the app.

## What it cannot capture

1. **The browser tab and the HTML preview.** Both render inside an
   `<iframe>`/`<webview>` whose document is not readable from the page, so a
   rasteriser sees an empty rectangle there. Everything else — files, documents,
   images, diffs, plans, subagent chats, plugin tabs — is plain DOM and captures
   normally.
2. **Anything outside the app window.** The button photographs a panel, not the
   desktop, so a snip tool still wins for a region spanning two applications or a
   native dialog.
3. **Live pixels that refuse to be copied.** A cross-origin image without CORS
   headers taints the canvas and would throw; the capture fails with a notice
   instead of producing a blank picture. The Shell's own panels are same-origin,
   so this only shows up with third-party content.

## How the image reaches the message

Two calls, in this order, mirroring the composer's own intake:

```js
// mints the draft attachment and starts its upload
const drafts = ctx.get('conversation').createDrafts(sessionId, [file], true)
// puts the minted ids in the composer, where the user can see and remove them
props.inputActions.addAttachments(drafts.map((draft) => draft.id))
```

`createDrafts` is not part of the public `IConversation` interface, but it is the
only `File` → id entry point in the Shell, and the product itself reaches it the
same way. `addAttachments` is the public half: it is a standard prop on
session-scoped slots, which the composer row already is. The button itself is
root-level (it sits over the panel, not inside its DOM), so the composer dock
keeps an invisible entry that publishes the session context into a store; the
button reads that store and disappears when no Session is open. The bytes travel over
the Shell's own upload route, so a screenshot behaves exactly like a pasted
image, including for the model that receives it.

## When it refuses

The button reports its own state instead of failing silently:

- no panel open → *open a panel on the right first*
- clipboard blocked → the image is still attached, with *right panel attached,
  clipboard refused*
- anything else → the reason in the row, plus
  `[aryacode-polish] panel screenshot failed:` in the console

The switch is in the row's Configure page like every other surface, and turning
it off removes the button without unloading anything else.

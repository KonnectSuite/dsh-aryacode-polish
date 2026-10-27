# Parked: right-click spelling corrections

**Status: not implemented, and not implementable as a plugin.** This note exists
so the investigation is not repeated and so the fix can be taken up in one short
change to the shell when we choose to.

## What the user saw in AryaAI

Right-clicking a misspelled word in the composer listed candidate corrections
(`heel`, `hello`, `helot`, `heels`, `hele`) above the standard Undo/Redo/Cut/
Copy/Paste/Select All items.

## Why AryaCode does not show them

AryaAI built that menu in the Electron main process from Chromium's own
spellchecker output — `AryaAI/apps/desktop/src/main.ts:294-329`:

```ts
window.webContents.on('context-menu', (_event, params) => {
  const { isEditable, selectionText, editFlags } = params
  const suggestions = params.dictionarySuggestions
  const items: MenuItemConstructorOptions[] = []
  for (const suggestion of suggestions) {
    items.push({
      label: suggestion,
      click: () => { window.webContents.replaceMisspelling(suggestion) },
    })
  }
  if (suggestions.length > 0) items.push({ type: 'separator' })
  // …then the six standard roles
```

AryaCode's `apps/desktop/src/main.ts:285-311` is the same handler with the
suggestion block removed. It destructures only
`{ isEditable, selectionText, editFlags }`, so `dictionarySuggestions` is never
read and `replaceMisspelling` is never called. The handler is identical on
`master` and `rebrand/identity`.

Spellcheck itself is still on: the main window's `webPreferences`
(`apps/desktop/src/main.ts:238-246`) sets no `spellcheck` key, so Electron's
default `true` stands — which is why the red squiggle still appears while the
menu offers no corrections. This is a desktop-shell regression, not a missing
capability. In a plain browser, Chromium's own menu still offers suggestions.

## Why a plugin cannot do it

Four independent blockers, each sufficient on its own:

1. **The menu is built in the main process.** A client face runs with
   `contextIsolation: true, sandbox: true` and cannot reach `Menu`/`webContents`.
2. **Chromium's native menu takes no page-side entries** in a browser, and the
   page cannot read the suggestions either.
3. **The documented client contextmenu pipeline excludes the composer** —
   `packages/client/ui-chat/src/client/chat/text-interaction.ts:228` returns
   early for `[contenteditable="true"]`, and only `[data-text-interaction-source]`
   nodes (message bodies) dispatch at all.
4. **The Lexical editor handle is contractually out of reach** —
   `packages/client/ui-conversation/src/client/contract/draft-editor.ts:64-71`:
   "Handed to the composer-bar entry through its own inject — package-internal,
   never across a plugin boundary."

There is no slot key for a context menu anywhere in the generated slot catalog
(`packages/extensions/cordis-client-runner/src/client/slot-catalog.ts`). The
nearest seat, `conversation.input.overlay` (declared
`packages/client/ui-conversation/src/client/contract/slots.ts:292`, anchored
`.../skeleton/InputBar.tsx:423`), renders floating UI inside the composer card but
supplies neither the right-click trigger nor the misspelled word.

## The change that would fix it

One edit in `apps/desktop/src/main.ts:285`, restoring AryaAI's behaviour:

```ts
window.webContents.on('context-menu', (_event, { isEditable, selectionText, editFlags,
                                               misspelledWord, dictionarySuggestions }) => {
  const items: MenuItemConstructorOptions[] = []
  if (misspelledWord !== '' && dictionarySuggestions.length > 0) {
    for (const suggestion of dictionarySuggestions) {
      items.push({ label: suggestion, click: () => window.webContents.replaceMisspelling(suggestion) })
    }
    items.push({ type: 'separator' })
  }
  // …the existing role items follow, unchanged
```

`apps/desktop/tests/main-startup.spec.ts` already drives this handler by emitting
`context-menu` with fake params, so the test for the restored items is a few
lines beside the existing assertions.

Two consequences worth stating before doing it:

- It is a **shell change**, so it ships inside the next harness build and does
  not need the market at all. It survives every later update because the updater
  replaces the payload with a build from the same source.
- It cannot be turned off from a plugin switch. If it needs to be optional, that
  belongs in the shell's own settings, not in this bundle.

## What a plugin-shaped workaround would cost

A host half could `require('electron')`, remove the shell's `context-menu`
listener for each window and re-implement the whole menu with suggestions. It
would work on the desktop today and need no shell edit, but it deletes a listener
the shell owns, duplicates its localized labels, and breaks the moment that
handler changes — the code updates touch most often. It was offered and
deliberately not taken.

### Fixed

- **A chat preview of a multi-file document was blank.** The card fed the written
  page to a `srcdoc` frame, which has no base URL: a page that linked
  `style.css` and `script.js` rendered as an empty white box with scrollbars, and
  the frame's policy refused the two siblings on top of that. The Host now folds a
  document's own siblings into it first — a stylesheet becomes a `<style>` block, a
  script becomes inline script (keeping `type="module"`), an image becomes a data
  URL — following only relative references inside the document's folder and only
  `.css .js .mjs .svg .png .jpg .jpeg .gif .webp`, at 512 KB each, 2 MB total and
  at most 24 references. A blocked reference is left as written, so a partial page
  still renders.
  - What it still cannot fold: a `url()` inside a linked stylesheet, an `import`
    between scripts, `<source srcset>`, and anything needing a real origin. Those
    remain panel jobs, and `docs/inline-previews.md` says so.
  - Verified against the reported session's own `index.html` + `style.css` +
    `script.js`: the canvas scene now draws inside the card.

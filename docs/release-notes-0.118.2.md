### Changed

- **The chat preview reads as a render, not a thumbnail.** The frame is 280 px tall
  (was 220), a document card carries **Expand** to grow to 60 % of the viewport and
  back, and the header says `live` — plus `n files folded` when the Host had to
  inline a document's stylesheet or script into it. It is still the sandboxed
  `srcDoc` frame: scripts run, a canvas animates, a click lands. Verified against
  the reported session's own three-file scene inside a `sandbox="allow-scripts"`
  frame: the sun rose, the walker moved and the loop reached its rain phase
  between two captures of the same frame.

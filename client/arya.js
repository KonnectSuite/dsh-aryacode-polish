/**
 * The shared look of this face: theme tokens and the small primitives every page uses.
 *
 * Every colour is a DSH theme token, so the Memory page, the Hooks page and the
 * AryaSearch card follow light and dark mode with the rest of the app. Nothing
 * here opens a connection or renders a nested document; these are styles and one
 * chip.
 *
 * This file is a fragment, not a module: `scripts/build-client.mjs` inlines it
 * ahead of `face.js` inside the same factory, so it uses the `React` those two
 * files share and declares nothing that `face.js` already declares. Every
 * top-level name is `arya`-prefixed for that reason.
 */

/** The theme tokens this face borrows; names are stable across light and dark. */
const ARYA_THEME = {
  surface: 'var(--dsw-alias-bg-layer-1)',
  surface2: 'var(--dsw-alias-bg-layer-2)',
  overlay: 'var(--dsw-alias-bg-overlay)',
  border: 'var(--dsw-alias-border-l1)',
  borderStrong: 'var(--dsw-alias-border-l2)',
  text: 'var(--dsw-alias-label-primary)',
  muted: 'var(--dsw-alias-label-secondary)',
  brand: 'var(--dsw-alias-brand-primary)',
  ok: 'var(--dsw-alias-state-success-primary)',
  warn: 'var(--dsw-alias-state-warn-primary)',
  bad: 'var(--dsw-alias-state-error-primary)',
  idle: 'var(--dsw-alias-state-idle-primary)',
}

/** A tinted background for a chip or a marker, mixed from its own colour. */
const aryaTint = (colour, strength) => 'color-mix(in srgb, ' + colour + ' ' + String(strength) + '%, transparent)'

const ARYA_FONT_MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace'

/**
 * Data colours, kept apart from the brand token.
 *
 * The brand token is near-black in this app (it is a button colour), so a chip
 * drawn with it reads as grey. This hue stays legible on both themes; the state
 * tokens carry the warnings, because those are already tuned for contrast in
 * light and dark.
 */
const ARYA_DATA = '#4f8ff7'

const ARYA_MUTED = { margin: 0, color: ARYA_THEME.muted, fontSize: '12px', lineHeight: 1.55 }
const ARYA_EYEBROW = {
  margin: '0 0 4px',
  color: ARYA_THEME.muted,
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
}
const ARYA_CARD = {
  background: ARYA_THEME.surface,
  border: '1px solid ' + ARYA_THEME.border,
  borderRadius: '14px',
  padding: '16px',
  margin: '0 0 12px',
  minWidth: 0,
}
const ARYA_ROW = { display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }
const ARYA_TITLE = { margin: 0, fontSize: '15px', fontWeight: 650, letterSpacing: '-0.01em', color: ARYA_THEME.text }
const ARYA_BUTTON = {
  font: 'inherit',
  fontSize: '12.5px',
  fontWeight: 600,
  color: ARYA_THEME.text,
  background: ARYA_THEME.surface2,
  border: '1px solid ' + ARYA_THEME.border,
  borderRadius: '10px',
  padding: '7px 13px',
  cursor: 'pointer',
}
const ARYA_BUTTON_PRIMARY = {
  ...ARYA_BUTTON,
  color: '#ffffff',
  background: ARYA_THEME.brand,
  border: '1px solid ' + ARYA_THEME.brand,
}
const ARYA_INPUT = {
  font: 'inherit',
  fontSize: '12.5px',
  color: ARYA_THEME.text,
  background: ARYA_THEME.surface2,
  border: '1px solid ' + ARYA_THEME.border,
  borderRadius: '9px',
  padding: '6px 9px',
  width: '100%',
  textAlign: 'right',
  boxSizing: 'border-box',
}

/**
 * A small tinted chip.
 * @param {{ tone?: string, children?: unknown, title?: string }} props the chip.
 * @returns {object} the chip.
 */
function AryaChip(props) {
  const tone = props.tone === undefined ? ARYA_THEME.muted : props.tone
  return React.createElement('span', {
    title: props.title,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      padding: '2px 8px',
      borderRadius: '999px',
      fontSize: '11px',
      fontWeight: 650,
      letterSpacing: '0.01em',
      lineHeight: 1.6,
      color: tone,
      background: aryaTint(tone, 14),
      border: '1px solid ' + aryaTint(tone, 38),
      whiteSpace: 'nowrap',
    },
  }, props.children)
}

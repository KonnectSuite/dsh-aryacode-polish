/**
 * Inline previews in the chat.
 *
 * A Turn that writes `cat-on-bike.html` used to leave a code block behind: the
 * Shell can render markup and images, but only in the right-panel document tab,
 * never in the message. This card renders what the Turn produced, under the
 * assistant message, from the `deliverables` turn data the Shell already keeps —
 * so no new projection, no second copy of the produced-file list.
 *
 * It is the least-trusted surface in the bundle: it runs model-authored markup.
 * Every framed document therefore carries its own `Content-Security-Policy` (no
 * network, no same-origin) and lives in a `sandbox="allow-scripts"` iframe, which
 * cannot reach the app even when the HTML was written to do so.
 */

/** The Host route that hands over one file's bytes. Document-relative, like every app route. */
export const PREVIEW_ROUTE = 'api/polish.preview'

/** Rendering class per extension. The Host route refuses everything absent here. */
export const PREVIEW_KINDS = {
  '.html': 'markup',
  '.htm': 'markup',
  '.svg': 'markup',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.gif': 'image',
  '.webp': 'image',
}

/** How many produced files one Turn draws; a Turn that writes twelve does not push the next Turn off screen. */
export const PREVIEW_LIMIT = 3

/** What a captured document may do: inline style and script, data images, no network, no navigation. */
export const PREVIEW_POLICY = "default-src 'none'; img-src data: blob:; media-src data: blob:; font-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action 'none'; base-uri 'none'"

/**
 * The rendering class of one path.
 *
 * @param path - file name or path; only its suffix is read.
 * @returns `'markup'`, `'image'`, or undefined when this card does not draw it.
 */
export function previewKindOf(path) {
  const name = typeof path === 'string' ? path.toLowerCase() : ''
  const dot = name.lastIndexOf('.')
  if (dot === -1) return undefined
  return Object.prototype.hasOwnProperty.call(PREVIEW_KINDS, name.slice(dot)) ? PREVIEW_KINDS[name.slice(dot)] : undefined
}

/**
 * The last path segment, for the card's title.
 *
 * @param path - a Windows or POSIX path.
 * @returns the file name, or the whole string when it holds no separator.
 */
export function previewName(path) {
  const text = typeof path === 'string' ? path : ''
  const cut = Math.max(text.lastIndexOf('/'), text.lastIndexOf('\\'))
  return cut === -1 ? text : text.slice(cut + 1)
}

/**
 * The previewable files one Turn produced, in the order the Turn wrote them.
 *
 * Read from the Shell's own `deliverables` turn data — the same value the
 * delivered-file cards read — so this card can never disagree with them about
 * what the Turn wrote. A Turn without that projection, or one whose produced
 * entries this card cannot draw, yields an empty list and therefore no card.
 *
 * @param turn - the Turn the Chat hands a tail entry.
 * @returns absolute paths worth previewing, deduplicated and capped.
 */
export function previewPaths(turn) {
  let produced
  try {
    produced = turn === undefined || turn === null || turn.data === undefined ? undefined : turn.data.get('deliverables')?.produced
  } catch {
    return []
  }
  if (!Array.isArray(produced)) return []
  const paths = []
  for (const entry of produced) {
    const path = typeof entry === 'string' ? entry : entry !== null && typeof entry === 'object' ? entry.path : undefined
    if (typeof path !== 'string' || path === '') continue
    if (previewKindOf(path) === undefined || paths.includes(path)) continue
    paths.push(path)
    if (paths.length >= PREVIEW_LIMIT) break
  }
  return paths
}

/**
 * One document, framed: the model's markup with our policy in its head.
 *
 * A fragment gets a document wrapped around it; a document that already has a
 * head keeps everything and receives the meta tag first, because the policy has
 * to arrive before any script it is meant to constrain.
 *
 * @param source - HTML, or an SVG document, or a fragment of either.
 * @returns a complete document whose `srcdoc` is safe to hand a sandboxed frame.
 */
export function previewDocument(source) {
  const meta = '<meta http-equiv="Content-Security-Policy" content="' + PREVIEW_POLICY + '">'
  const text = typeof source === 'string' ? source : ''
  const head = /<head[^>]*>/i.exec(text)
  if (head !== null) {
    const cut = head.index + head[0].length
    return text.slice(0, cut) + meta + text.slice(cut)
  }
  const html = /<html[^>]*>/i.exec(text)
  if (html !== null) {
    const cut = html.index + html[0].length
    return text.slice(0, cut) + '<head>' + meta + '</head>' + text.slice(cut)
  }
  return '<!doctype html><html><head><meta charset="utf-8">' + meta
    + '<style>html,body{margin:0;height:100%;font:13px/1.45 system-ui,sans-serif;color:#1f2328;background:transparent}</style>'
    + '</head><body>' + text + '</body></html>'
}

/** One preview card: a header the eye can scan and a bounded body under it. */
const PREVIEW_CARD = {
  margin: '8px 0 0',
  border: '0.5px solid var(--dsw-alias-border-l2, rgba(0,0,0,0.12))',
  borderRadius: 'var(--dsw-radius-md, 8px)',
  overflow: 'hidden',
  background: 'var(--dsw-alias-bg-layer-2, rgba(0,0,0,0.02))',
}

const PREVIEW_HEAD = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '6px 8px',
  fontSize: '12px',
  lineHeight: '18px',
  color: 'var(--dsw-alias-label-secondary, #61666b)',
  borderBottom: '0.5px solid var(--dsw-alias-border-l2, rgba(0,0,0,0.12))',
}

const PREVIEW_NAME = {
  flex: '1 1 auto',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: 'var(--dsw-alias-label-primary, #1f2328)',
}

const PREVIEW_ACTION = {
  flex: '0 0 auto',
  border: 'none',
  borderRadius: 'var(--dsw-radius-sm, 6px)',
  background: 'transparent',
  color: 'var(--dsw-alias-label-secondary, #61666b)',
  font: 'inherit',
  cursor: 'pointer',
  padding: '1px 6px',
}

const PREVIEW_FRAME = {
  display: 'block',
  width: '100%',
  height: '280px',
  border: '0',
  background: '#ffffff',
}

/** The small "live" note beside the name: what the card is, and what it folded in. */
const PREVIEW_META = {
  flex: '0 0 auto',
  color: 'var(--dsw-alias-label-tertiary, #7a7f85)',
  fontSize: '11px',
  whiteSpace: 'nowrap',
}

const PREVIEW_NOTE = {
  margin: 0,
  padding: '14px 10px',
  fontSize: '12px',
  lineHeight: '18px',
  color: 'var(--dsw-alias-label-tertiary, #7a7f85)',
}

/**
 * Read one file's bytes from the Host.
 *
 * @param path - absolute path the Turn recorded.
 * @returns the route's value, or throws with its own message.
 */
async function previewCall(path) {
  const response = await fetch(PREVIEW_ROUTE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'read', path }),
  })
  const payload = await response.json().catch(() => undefined)
  if (payload === undefined || payload === null || typeof payload !== 'object') {
    throw new Error('the Host did not answer')
  }
  if (payload.ok !== true) throw new Error(payload.error || 'the Host refused that file')
  return payload.value
}

/**
 * One produced file, rendered.
 *
 * The bytes arrive from the route after mount, so the card appears even while the
 * read is in flight and states its own failure instead of vanishing: a preview
 * that silently disappears is indistinguishable from a Turn that wrote nothing.
 *
 * @param props - `path` to draw and `openFile` to hand it to the panel.
 * @returns the card.
 */
function InlinePreviewCard(props) {
  const path = props.path
  const [read, setRead] = React.useState({ status: 'loading' })
  // The frame is a live render, not a picture: a canvas animation, a hover state
  // and a click all work inside it. A taller card is the difference between "a
  // thumbnail" and "the thing", so a card can be expanded without leaving the chat.
  const [zoomed, setZoomed] = React.useState(false)
  React.useEffect(() => {
    let live = true
    setRead({ status: 'loading' })
    Promise.resolve()
      .then(() => previewCall(path))
      .then(value => { if (live) setRead({ status: 'ready', value }) })
      .catch(error => { if (live) setRead({ status: 'failed', error: error instanceof Error ? error.message : 'the read failed' }) })
    return () => { live = false }
  }, [path])
  const name = previewName(path)
  const framed = read.status === 'ready' && read.value.kind !== 'image'
  const body = read.status === 'failed'
    ? React.createElement('p', { style: PREVIEW_NOTE }, 'This file could not be previewed: ' + read.error)
    : read.status === 'loading'
      ? React.createElement('p', { style: PREVIEW_NOTE }, 'Reading ' + name + '…')
      : read.value.kind === 'image'
        ? React.createElement('img', {
          src: read.value.dataUrl,
          alt: name,
          style: { display: 'block', maxWidth: '100%', maxHeight: zoomed ? '60vh' : '280px', margin: '0 auto' },
        })
        : React.createElement('iframe', {
          srcDoc: previewDocument(read.value.text),
          sandbox: 'allow-scripts',
          title: name,
          'data-polish-preview-frame': read.value.kind,
          style: { ...PREVIEW_FRAME, height: zoomed ? 'min(60vh, 520px)' : '280px' },
        })
  return React.createElement('div', { 'data-polish-preview': name, style: PREVIEW_CARD },
    React.createElement('div', { style: PREVIEW_HEAD },
      React.createElement('span', { style: PREVIEW_NAME, title: path }, name),
      read.status === 'ready' && read.value.inlinedAssets > 0
        ? React.createElement('span', { style: PREVIEW_META, title: 'Styles, scripts and images beside the file were folded into it so it can run here' },
          'live · ' + String(read.value.inlinedAssets) + ' file' + (read.value.inlinedAssets === 1 ? '' : 's') + ' folded')
        : React.createElement('span', { style: PREVIEW_META }, 'live'),
      framed
        ? React.createElement('button', {
          type: 'button',
          'data-polish-preview-zoom': zoomed ? 'collapse' : 'expand',
          style: PREVIEW_ACTION,
          onClick: () => setZoomed(current => !current),
        }, zoomed ? 'Collapse' : 'Expand')
        : null,
      React.createElement('button', {
        type: 'button',
        'data-polish-preview-open': name,
        style: PREVIEW_ACTION,
        onClick: () => props.openFile(path),
      }, 'Open in panel')),
    body)
}

/**
 * The Turn tail the Chat renders under a completed assistant message.
 *
 * Registers nothing when the switch is off or the Turn produced nothing this card
 * can draw, so a conversation without artifacts looks exactly as it did.
 *
 * @param props - the Turn, its closing sequence, the panel opener, and our switch reader.
 * @returns the preview cards, or null.
 */
export function InlinePreviewTail(props) {
  const enabled = useSwitch(props.configForms, 'inlinePreviews', true)
  const paths = React.useMemo(() => previewPaths(props.turn), [props.turn])
  if (!enabled || paths.length === 0) return null
  return React.createElement('div', { 'data-polish-previews': String(paths.length) },
    paths.map(path => React.createElement(InlinePreviewCard, { key: path, path, openFile: props.openFile })))
}

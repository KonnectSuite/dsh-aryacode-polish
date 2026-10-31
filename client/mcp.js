/**
 * The MCP servers page.
 *
 * One settings section: a live list of the servers AryaCode mounts, a catalog of
 * known servers, a GitHub search, a paste-a-command importer and a manual form.
 * Everything the page knows comes from one POST route (`api/polish.mcp`); the
 * page never runs a command and never holds an unmasked secret.
 *
 * This file is a fragment inlined by `scripts/build-client.mjs` ahead of
 * `face.js`, so it shares that factory's `React` and declares only `mcp`- and
 * `Mcp`-prefixed names.
 */

/** The route the host registers; relative so the shell's base URI applies. */
const MCP_ROUTE = 'api/polish.mcp'

/** Theme tokens, the same aliases the shipped UI reads. */
const MCP_THEME = {
  surface: 'var(--dsw-alias-bg-layer-1)',
  surface2: 'var(--dsw-alias-bg-layer-2)',
  border: 'var(--dsw-alias-border-l1)',
  borderStrong: 'var(--dsw-alias-border-l2)',
  text: 'var(--dsw-alias-label-primary)',
  muted: 'var(--dsw-alias-label-secondary)',
  brand: 'var(--dsw-alias-brand-primary)',
  ok: 'var(--dsw-alias-state-success-primary)',
  warn: 'var(--dsw-alias-state-warn-primary)',
  bad: 'var(--dsw-alias-state-error-primary)',
}

const MCP_FONT_MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace'

/**
 * Create an element. A function, not a bound reference: the fragment is inlined
 * above the line that declares `React`, so touching it at module scope throws
 * "Cannot access 'React' before initialization".
 *
 * @param {...unknown} args the `React.createElement` arguments.
 * @returns {object} the element.
 */
function mcpEl(...args) {
  return React.createElement(...args)
}

/** A tinted background from a colour token. */
const mcpTint = (colour, strength) => 'color-mix(in srgb, ' + colour + ' ' + String(strength) + '%, transparent)'

const MCP_CARD = {
  background: MCP_THEME.surface,
  border: '1px solid ' + MCP_THEME.border,
  borderRadius: '14px',
  padding: '16px',
}

const MCP_INPUT = {
  font: 'inherit',
  fontSize: '13px',
  color: MCP_THEME.text,
  background: MCP_THEME.surface2,
  border: '1px solid ' + MCP_THEME.border,
  borderRadius: '9px',
  padding: '8px 10px',
  width: '100%',
  boxSizing: 'border-box',
}

const MCP_BUTTON = {
  font: 'inherit',
  fontSize: '12.5px',
  fontWeight: 600,
  color: MCP_THEME.text,
  background: MCP_THEME.surface2,
  border: '1px solid ' + MCP_THEME.border,
  borderRadius: '9px',
  padding: '7px 12px',
  cursor: 'pointer',
}

const MCP_BUTTON_PRIMARY = { ...MCP_BUTTON, color: '#fff', background: MCP_THEME.brand, border: '1px solid ' + MCP_THEME.brand }

const MCP_EYEBROW = {
  margin: '0 0 4px',
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: MCP_THEME.muted,
}

const MCP_MUTED = { margin: 0, fontSize: '12px', lineHeight: 1.55, color: MCP_THEME.muted }

/**
 * Call the host route.
 * @param {object} body the request payload.
 * @returns {Promise<object>} the JSON answer, or an error answer.
 */
async function mcpPost(body) {
  try {
    const response = await fetch(MCP_ROUTE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) return { ok: false, error: 'The host answered ' + response.status + '.' }
    return await response.json()
  } catch (error) {
    return { ok: false, error: 'The host could not be reached (' + (error instanceof Error ? error.message : String(error)) + ').' }
  }
}

/**
 * A small chip. A plain function, not a component: the page calls it from render
 * bodies, where a second positional argument would never become `children`.
 *
 * @param {string} tone a colour token.
 * @param {string} label the words.
 * @param {string} [title] a tooltip.
 * @returns {object} the chip element.
 */
function McpChip(tone, label, title) {
  const colour = tone === undefined ? MCP_THEME.muted : tone
  return mcpEl('span', {
    title,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      padding: '2px 8px',
      borderRadius: '999px',
      fontSize: '11px',
      fontWeight: 600,
      lineHeight: 1.6,
      color: colour,
      background: mcpTint(colour, 12),
      border: '1px solid ' + mcpTint(colour, 34),
      whiteSpace: 'nowrap',
    },
  }, label)
}

/**
 * One label/value pair in the drawer.
 * @param {string} label the label.
 * @param {string} value the value.
 * @returns {object} the pair.
 */
function mcpKv(label, value) {
  return mcpEl('div', null,
    mcpEl('div', { style: { ...MCP_EYEBROW, margin: '0 0 2px', fontSize: '9.5px' } }, label),
    mcpEl('div', { style: { fontSize: '12.5px', color: MCP_THEME.text, wordBreak: 'break-word' } }, value))
}

/** Status dot + word. */
function McpStatus(props) {
  const map = {
    ready: [MCP_THEME.ok, 'ready'],
    connecting: [MCP_THEME.warn, 'connecting'],
    error: [MCP_THEME.bad, 'error'],
    disabled: [MCP_THEME.muted, 'disabled'],
    external: [MCP_THEME.brand, 'plugin'],
  }
  const [tone, word] = map[props.status] ?? map.disabled
  const pulse = props.status === 'connecting'
  return mcpEl('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 600, color: tone } },
    mcpEl('span', {
      style: {
        width: '8px',
        height: '8px',
        borderRadius: '999px',
        background: tone,
        boxShadow: '0 0 0 3px ' + mcpTint(tone, 20),
        animation: pulse ? 'mcp-pulse 1.1s ease-in-out infinite' : undefined,
      },
    }),
    word)
}

/** One labelled form control. */
function McpField(props) {
  return mcpEl('label', { style: { display: 'block', marginBottom: '12px' } },
    mcpEl('span', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' } },
      mcpEl('span', { style: { fontSize: '12px', fontWeight: 600, color: MCP_THEME.text } }, props.label),
      props.optional === true ? mcpEl('span', { style: { ...MCP_MUTED, fontSize: '10.5px' } }, 'optional') : null),
    props.children,
    props.hint === undefined ? null : mcpEl('span', { style: { ...MCP_MUTED, fontSize: '11px', marginTop: '4px', display: 'block' } }, props.hint))
}

/** A key/value editor for env or headers. */
function McpMapEditor(props) {
  const rows = Object.entries(props.values ?? {})
  const secret = props.secret === true
  const update = (index, key, value) => {
    const next = {}
    rows.forEach((entry, position) => {
      const nextKey = position === index ? key : entry[0]
      const nextValue = position === index ? value : entry[1]
      if (nextKey !== '') next[nextKey] = nextValue
    })
    props.onChange(next)
  }
  const remove = index => {
    const next = {}
    rows.forEach((entry, position) => {
      if (position !== index) next[entry[0]] = entry[1]
    })
    props.onChange(next)
  }
  const add = () => props.onChange({ ...(props.values ?? {}), '': '' })
  return mcpEl('div', null,
    rows.map((entry, index) => mcpEl('div', { key: 'row' + index, style: { display: 'flex', gap: '6px', marginBottom: '6px' } },
      mcpEl('input', {
        value: entry[0],
        placeholder: secret ? 'KEY' : 'Header',
        spellCheck: false,
        onChange: event => update(index, event.target.value, entry[1]),
        style: { ...MCP_INPUT, width: '42%', fontFamily: MCP_FONT_MONO, fontSize: '11.5px' },
      }),
      mcpEl('input', {
        value: entry[1],
        placeholder: secret ? 'value' : 'value',
        spellCheck: false,
        type: secret && /token|key|secret|pass/i.test(entry[0]) ? 'password' : 'text',
        onChange: event => update(index, entry[0], event.target.value),
        style: { ...MCP_INPUT, flex: '1 1 auto' },
      }),
      mcpEl('button', {
        type: 'button',
        title: 'Remove',
        onClick: () => remove(index),
        style: { ...MCP_BUTTON, padding: '4px 9px' },
      }, '????"'))),
    mcpEl('button', { type: 'button', onClick: add, style: { ...MCP_BUTTON, fontSize: '11.5px', padding: '5px 10px' } }, '+ Add ' + (secret ? 'variable' : 'header')))
}

/** One server card. */
function McpCard(props) {
  const server = props.server
  const external = server.status === 'external'
  const tools = Array.isArray(server.tools) ? server.tools : []
  return mcpEl('div', {
    style: {
      ...MCP_CARD,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      borderColor: server.status === 'error' ? mcpTint(MCP_THEME.bad, 45) : MCP_THEME.border,
      background: server.status === 'error' ? mcpTint(MCP_THEME.bad, 4) : MCP_THEME.surface,
    },
  },
  mcpEl('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' } },
    mcpEl('div', { style: { minWidth: 0 } },
      mcpEl('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
        mcpEl('strong', { style: { fontSize: '14px', color: MCP_THEME.text, letterSpacing: '-0.01em' } }, server.label || server.serverName),
        McpChip(server.transport === 'streamable-http' ? MCP_THEME.brand : MCP_THEME.muted, server.transport === 'streamable-http' ? 'http' : server.transport === 'external' ? 'plugin' : 'stdio')),
      mcpEl('div', { style: { ...MCP_MUTED, fontSize: '11px', fontFamily: MCP_FONT_MONO, marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, server.summary || server.serverName)),
    McpStatus({ status: server.status })),
  server.error === '' || server.error === undefined ? null : mcpEl('div', {
    style: { fontSize: '11.5px', color: MCP_THEME.bad, background: mcpTint(MCP_THEME.bad, 8), border: '1px solid ' + mcpTint(MCP_THEME.bad, 25), borderRadius: '8px', padding: '7px 9px', wordBreak: 'break-word' },
  }, server.error),
  mcpEl('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' } },
    mcpEl('span', { style: { ...MCP_MUTED, fontSize: '11.5px' } },
      external ? String(server.toolCount ?? 0) + ' tools' : tools.length + (tools.length === 1 ? ' tool' : ' tools')),
    mcpEl('div', { style: { display: 'flex', gap: '6px' } },
      mcpEl('button', { type: 'button', style: { ...MCP_BUTTON, fontSize: '11.5px', padding: '5px 9px' }, onClick: () => props.onOpen(server) }, 'Details'),
      external ? null : mcpEl('button', { type: 'button', style: { ...MCP_BUTTON, fontSize: '11.5px', padding: '5px 9px' }, onClick: () => props.onEdit(server) }, 'Edit'),
      external ? null : mcpEl('button', {
        type: 'button',
        style: { ...MCP_BUTTON, fontSize: '11.5px', padding: '5px 9px' },
        onClick: () => props.onToggle(server),
      }, server.enabled ? 'Disable' : 'Enable'),
      external ? null : mcpEl('button', { type: 'button', style: { ...MCP_BUTTON, fontSize: '11.5px', padding: '5px 9px' }, onClick: () => props.onRemove(server) }, 'Remove'))))
}

/** The add/edit panel: catalog, GitHub, paste, manual. */
function McpSheet(props) {
  const [tab, setTab] = React.useState(props.mode === 'edit' ? 'manual' : props.tab ?? 'catalog')
  const [draft, setDraft] = React.useState(props.draft)
  const [catalog, setCatalog] = React.useState({ entries: [], categories: [], loading: false })
  const [catalogQuery, setCatalogQuery] = React.useState('')
  const [githubQuery, setGithubQuery] = React.useState('')
  const [github, setGithub] = React.useState(null)
  const [pasteText, setPasteText] = React.useState('')
  const [testing, setTesting] = React.useState(false)
  const [testResult, setTestResult] = React.useState(null)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')
  const [trusted, setTrusted] = React.useState(props.mode === 'edit')

  const setField = (key, value) => setDraft(current => ({ ...current, [key]: value }))

  React.useEffect(() => {
    if (tab !== 'catalog') return
    setCatalog(current => ({ ...current, loading: true }))
    void mcpPost({ action: 'catalog', query: catalogQuery }).then(answer => {
      setCatalog({ entries: answer.entries ?? [], categories: answer.categories ?? [], loading: false })
    })
  }, [tab, catalogQuery])

  const loadCatalogEntry = async id => {
    const answer = await mcpPost({ action: 'catalogEntry', id })
    if (answer.ok === false) {
      setError(answer.error ?? 'That entry could not be read.')
      return
    }
    setDraft({ ...answer.draft, enabled: true })
    setTab('manual')
    setTestResult(null)
  }

  const searchGithub = async () => {
    setGithub({ loading: true })
    const answer = await mcpPost({ action: 'search', query: githubQuery })
    setGithub({ ...answer, loading: false })
  }

  const parsePaste = async () => {
    // An exported list (or any JSON array) is an import, not a draft to edit.
    const trimmed = pasteText.trim()
    if (trimmed.startsWith('[') || trimmed.startsWith('{"version"')) {
      const answer = await mcpPost({ action: 'import', text: trimmed })
      if (answer.ok === false && Array.isArray(answer.saved) === false) {
        setError(answer.error ?? 'That list could not be imported.')
        return
      }
      props.onImported(answer)
      return
    }
    const answer = await mcpPost({ action: 'parse', text: pasteText })
    if (answer.ok === false || answer.draft === null || answer.draft === undefined) {
      setError(answer.error ?? 'That could not be parsed.')
      return
    }
    setDraft({ ...answer.draft, enabled: true })
    setTab('manual')
    setError('')
  }

  const run = async action => {
    setError('')
    const answer = await mcpPost({ action, server: draft })
    if (answer.ok === false) {
      const first = Array.isArray(answer.errors) && answer.errors.length > 0 ? answer.errors[0].message : answer.error
      setError(String(first ?? 'That did not work.'))
      return null
    }
    return answer
  }

  const test = async () => {
    setTesting(true)
    setTestResult(null)
    const answer = await run('test')
    setTesting(false)
    setTestResult(answer ?? { ok: false })
  }

  const save = async () => {
    setSaving(true)
    const answer = await run('save')
    setSaving(false)
    if (answer !== null) props.onSaved(answer.server)
  }

  const transport = draft.transport === 'streamable-http' ? 'streamable-http' : 'stdio'
  const needsTrust = transport === 'stdio' && !trusted
  const tabs = [['catalog', 'Catalog'], ['github', 'GitHub'], ['paste', 'Paste'], ['manual', 'Manual']]

  /* ---- catalogue tab ---- */
  const catalogPanel = mcpEl('div', null,
    mcpEl('input', {
      value: catalogQuery,
      placeholder: 'Search the bundled catalog - filesystem, github, playwright, postgres...',
      onChange: event => setCatalogQuery(event.target.value),
      style: { ...MCP_INPUT, marginBottom: '12px' },
    }),
    catalog.loading ? mcpEl('div', { style: MCP_MUTED }, 'Loading...') : null,
    (catalog.categories ?? []).map(category => {
      const entries = (catalog.entries ?? []).filter(entry => entry.category === category.id)
      if (entries.length === 0) return null
      return mcpEl('div', { key: category.id, style: { marginBottom: '16px' } },
        mcpEl('div', { style: MCP_EYEBROW }, category.label),
        mcpEl('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(258px, 1fr))', gap: '10px' } },
          entries.map(entry => mcpEl('button', {
            key: entry.id,
            type: 'button',
            onClick: () => void loadCatalogEntry(entry.id),
            style: { ...MCP_CARD, textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '6px' },
          },
          mcpEl('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
            mcpEl('strong', { style: { fontSize: '13px', color: MCP_THEME.text } }, entry.name),
            McpChip(MCP_THEME.muted, entry.transport === 'streamable-http' ? 'http' : 'stdio')),
          mcpEl('span', { style: { ...MCP_MUTED, fontSize: '11.5px' } }, entry.description),
          mcpEl('span', { style: { ...MCP_MUTED, fontSize: '10.5px', fontFamily: MCP_FONT_MONO } },
            'by ' + entry.publisher + (entry.env === undefined ? '' : ' - needs ' + entry.env.map(variable => variable.key).join(', ')))))))
    }))

  /* ---- GitHub tab ---- */
  const githubPanel = mcpEl('div', null,
    mcpEl('div', { style: { display: 'flex', gap: '8px', marginBottom: '12px' } },
      mcpEl('input', {
        value: githubQuery,
        placeholder: 'Search GitHub for MCP servers...',
        onChange: event => setGithubQuery(event.target.value),
        onKeyDown: event => {
          if (event.key === 'Enter') void searchGithub()
        },
        style: { ...MCP_INPUT, flex: '1 1 auto' },
      }),
      mcpEl('button', { type: 'button', onClick: () => void searchGithub(), style: MCP_BUTTON_PRIMARY }, 'Search')),
    github === null
      ? mcpEl('p', { style: MCP_MUTED }, 'Results come from the GitHub API. Without a token GitHub allows a handful of searches a minute.')
      : github.loading === true
        ? mcpEl('p', { style: MCP_MUTED }, 'Searching...')
        : github.ok === false
          ? mcpEl('p', { style: { ...MCP_MUTED, color: MCP_THEME.warn } }, github.error)
          : mcpEl('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
            (github.items ?? []).map(item => mcpEl('div', { key: item.fullName, style: { ...MCP_CARD, padding: '12px' } },
              mcpEl('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' } },
                mcpEl('strong', { style: { fontSize: '13px', color: MCP_THEME.text } }, item.fullName),
                McpChip(MCP_THEME.muted, '* ' + item.stars)),
              mcpEl('p', { style: { ...MCP_MUTED, fontSize: '11.5px', margin: '4px 0 8px' } }, item.description || 'No description.'),
              mcpEl('button', {
                type: 'button',
                style: { ...MCP_BUTTON, fontSize: '11.5px', padding: '5px 10px' },
                onClick: () => {
                  setDraft({
                    enabled: true,
                    serverName: String(item.name).replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 32),
                    label: item.name,
                    transport: 'stdio',
                    command: 'npx',
                    args: '-y ' + item.name,
                    env: {},
                    note: item.url,
                  })
                  setTab('manual')
                },
              }, 'Use this repo')))))

  /* ---- paste tab ---- */
  const pastePanel = mcpEl('div', null,
    mcpEl('textarea', {
      value: pasteText,
      rows: 6,
      placeholder: 'npx -y @modelcontextprotocol/server-memory\n\n...or https://example.com/mcp ...or a server JSON object',
      onChange: event => setPasteText(event.target.value),
      style: { ...MCP_INPUT, fontFamily: MCP_FONT_MONO, fontSize: '12px', resize: 'vertical' },
    }),
    mcpEl('button', { type: 'button', onClick: () => void parsePaste(), style: { ...MCP_BUTTON_PRIMARY, marginTop: '10px' } }, 'Parse'),
    mcpEl('p', { style: { ...MCP_MUTED, fontSize: '11.5px', marginTop: '10px' } },
      'A command line becomes a stdio server, a URL becomes a streamable HTTP server, and JSON is read as one server or a list.'))

  /* ---- manual tab ---- */
  const trustLine = transport === 'stdio'
    ? mcpEl('label', {
      style: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        marginTop: '10px',
        padding: '10px 12px',
        borderRadius: '9px',
        fontSize: '12px',
        color: MCP_THEME.text,
        background: mcpTint(MCP_THEME.warn, 8),
        border: '1px solid ' + mcpTint(MCP_THEME.warn, 30),
      },
    },
    mcpEl('input', { type: 'checkbox', checked: trusted, onChange: event => setTrusted(event.target.checked), style: { marginTop: '2px' } }),
    mcpEl('span', null,
      'I understand this command runs on this machine with my user account: ',
      mcpEl('code', { style: { fontFamily: MCP_FONT_MONO, fontSize: '11.5px' } },
        [draft.command ?? '', ...(Array.isArray(draft.args) ? draft.args : String(draft.args ?? '').split(' '))].join(' '))))
    : null

  const testLine = testResult === null
    ? null
    : mcpEl('div', {
      style: {
        marginTop: '12px',
        padding: '10px 12px',
        borderRadius: '9px',
        fontSize: '12px',
        color: testResult.ok ? MCP_THEME.ok : MCP_THEME.bad,
        background: mcpTint(testResult.ok ? MCP_THEME.ok : MCP_THEME.bad, 8),
        border: '1px solid ' + mcpTint(testResult.ok ? MCP_THEME.ok : MCP_THEME.bad, 30),
      },
    }, testResult.ok
      ? 'Connected in ' + Math.round((testResult.ms ?? 0) / 100) / 10 + 's - ' + String(testResult.toolCount ?? 0) + ' tools discovered.'
      : 'Test failed: ' + String(testResult.error ?? 'no answer'))

  const secretNote = containsSecretValues(draft)
    ? mcpEl('p', { style: { ...MCP_MUTED, fontSize: '11px', marginTop: '10px' } },
      'Values marked as secrets are stored in the server list on this machine, in plain text, readable only by your user.')
    : null

  const stdioFields = mcpEl('div', null,
    mcpEl(McpField, { label: 'Command', hint: 'Runs on this machine, with the arguments below.' },
      mcpEl('input', { value: draft.command ?? '', placeholder: 'npx', onChange: event => setField('command', event.target.value), style: { ...MCP_INPUT, fontFamily: MCP_FONT_MONO } })),
    mcpEl(McpField, { label: 'Arguments' },
      mcpEl('input', { value: Array.isArray(draft.args) ? draft.args.join(' ') : draft.args ?? '', placeholder: '-y @modelcontextprotocol/server-memory', onChange: event => setField('args', event.target.value), style: { ...MCP_INPUT, fontFamily: MCP_FONT_MONO } })),
    mcpEl(McpField, { label: 'Environment' },
      mcpEl(McpMapEditor, { values: draft.env ?? {}, secret: true, onChange: value => setField('env', value) })),
    mcpEl(McpField, { label: 'Working directory', optional: true },
      mcpEl('input', { value: draft.cwd ?? '', onChange: event => setField('cwd', event.target.value), style: { ...MCP_INPUT, fontFamily: MCP_FONT_MONO } })))

  const httpFields = mcpEl('div', null,
    mcpEl(McpField, { label: 'URL', hint: 'The streamable HTTP endpoint, for example https://mcp.example.com/mcp' },
      mcpEl('input', { value: draft.url ?? '', onChange: event => setField('url', event.target.value), style: { ...MCP_INPUT, fontFamily: MCP_FONT_MONO } })),
    mcpEl(McpField, { label: 'Headers', optional: true },
      mcpEl(McpMapEditor, { values: draft.headers ?? {}, onChange: value => setField('headers', value) })))

  const advanced = mcpEl('details', { style: { marginTop: '4px' } },
    mcpEl('summary', { style: { cursor: 'pointer', fontSize: '12px', color: MCP_THEME.muted } }, 'Advanced'),
    mcpEl('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' } },
      mcpEl(McpField, { label: 'Tool timeout (ms)' },
        mcpEl('input', {
          type: 'number',
          value: String(draft.toolCallTimeoutMs ?? 60000),
          onChange: event => setField('toolCallTimeoutMs', Number(event.target.value)),
          style: MCP_INPUT,
        })),
      mcpEl(McpField, { label: 'Reconnect' },
        mcpEl('label', { style: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px' } },
          mcpEl('input', {
            type: 'checkbox',
            checked: draft.reconnect?.enabled !== false,
            onChange: event => setField('reconnect', { enabled: event.target.checked }),
          }),
          'Retry a dropped connection'))))

  const manualPanel = mcpEl('div', null,
    mcpEl('div', { style: { display: 'flex', gap: '6px', marginBottom: '14px' } },
      [['stdio', 'stdio (a local command)'], ['streamable-http', 'streamable HTTP (a service)']].map(([id, label]) =>
        mcpEl('button', {
          key: id,
          type: 'button',
          onClick: () => setField('transport', id),
          style: {
            ...MCP_BUTTON,
            flex: '1 1 0',
            background: transport === id ? mcpTint(MCP_THEME.brand, 14) : MCP_THEME.surface2,
            borderColor: transport === id ? mcpTint(MCP_THEME.brand, 45) : MCP_THEME.border,
          },
        }, label))),
    mcpEl('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' } },
      mcpEl(McpField, { label: 'Name', hint: 'The tool prefix: mcp__name__tool' },
        mcpEl('input', { value: draft.serverName ?? '', onChange: event => setField('serverName', event.target.value), style: { ...MCP_INPUT, fontFamily: MCP_FONT_MONO } })),
      mcpEl(McpField, { label: 'Label' },
        mcpEl('input', { value: draft.label ?? '', onChange: event => setField('label', event.target.value), style: MCP_INPUT }))),
    transport === 'stdio' ? stdioFields : httpFields,
    advanced,
    secretNote,
    trustLine,
    testLine)

  const panelFor = { catalog: catalogPanel, github: githubPanel, paste: pastePanel, manual: manualPanel }

  return mcpEl('div', { style: { position: 'fixed', inset: 0, zIndex: 60, display: 'flex', justifyContent: 'flex-end' } },
    mcpEl('div', { onClick: props.onClose, style: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.34)' } }),
    mcpEl('div', {
      style: {
        position: 'relative',
        width: 'min(620px, 100vw)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: MCP_THEME.surface,
        borderLeft: '1px solid ' + MCP_THEME.borderStrong,
        boxShadow: '-24px 0 60px rgba(0,0,0,0.24)',
      },
    },
    mcpEl('div', { style: { padding: '16px 18px 12px', borderBottom: '1px solid ' + MCP_THEME.border } },
      mcpEl('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' } },
        mcpEl('div', null,
          mcpEl('div', { style: MCP_EYEBROW }, props.mode === 'edit' ? 'Edit server' : 'Add server'),
          mcpEl('h2', { style: { margin: 0, fontSize: '19px', fontWeight: 680, letterSpacing: '-0.02em', color: MCP_THEME.text } },
            draft.label || draft.serverName || (props.mode === 'edit' ? 'MCP server' : 'New MCP server'))),
        mcpEl('button', { type: 'button', onClick: props.onClose, style: { ...MCP_BUTTON, padding: '5px 10px' } }, 'Esc')),
      mcpEl('div', { style: { display: 'flex', gap: '2px', marginTop: '12px' } },
        tabs.map(([id, label]) => mcpEl('button', {
          key: id,
          type: 'button',
          onClick: () => setTab(id),
          style: {
            font: 'inherit',
            fontSize: '12.5px',
            fontWeight: 600,
            background: 'transparent',
            border: 'none',
            borderBottom: tab === id ? '2px solid ' + MCP_THEME.brand : '2px solid transparent',
            color: tab === id ? MCP_THEME.text : MCP_THEME.muted,
            padding: '7px 10px',
            cursor: 'pointer',
          },
        }, label)))),
    mcpEl('div', { style: { flex: '1 1 auto', overflowY: 'auto', padding: '16px 18px' } },
      error === '' ? null : mcpEl('div', {
        style: { marginBottom: '12px', padding: '9px 11px', borderRadius: '9px', fontSize: '12px', color: MCP_THEME.bad, background: mcpTint(MCP_THEME.bad, 8), border: '1px solid ' + mcpTint(MCP_THEME.bad, 30) },
      }, error),
      panelFor[tab]),
    tab !== 'manual' ? null : mcpEl('div', { style: { padding: '12px 18px', borderTop: '1px solid ' + MCP_THEME.border, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' } },
      mcpEl('span', { style: { ...MCP_MUTED, fontSize: '11px' } }, needsTrust ? 'Confirm the command to continue.' : ''),
      mcpEl('div', { style: { display: 'flex', gap: '8px' } },
        mcpEl('button', {
          type: 'button',
          onClick: () => void test(),
          disabled: testing || needsTrust,
          style: { ...MCP_BUTTON, opacity: testing ? 0.6 : 1 },
        }, testing ? 'Testing...' : 'Test'),
        mcpEl('button', {
          type: 'button',
          onClick: () => void save(),
          disabled: saving || needsTrust,
          style: { ...MCP_BUTTON_PRIMARY, opacity: saving || needsTrust ? 0.5 : 1 },
        }, saving ? 'Saving...' : props.mode === 'edit' ? 'Save changes' : 'Add server')))))
}


/** Whether any current value looks like a secret, so the page can warn once. */
function containsSecretValues(draft) {
  const maps = [draft.env ?? {}, draft.headers ?? {}]
  return maps.some(map => Object.entries(map).some(([key, value]) => /token|key|secret|pass|auth/i.test(key) && typeof value === 'string' && value !== ''))
}

/** The read-only detail panel. */
function McpDrawer(props) {
  const [tab, setTab] = React.useState('overview')
  const server = props.server
  const tools = Array.isArray(server.tools) ? server.tools : []
  const config = {
    serverName: server.serverName,
    transport: server.transport,
    ...(server.transport === 'stdio' ? { command: server.command, args: server.args } : { url: server.url }),
  }
  return mcpEl('div', { style: { position: 'fixed', inset: 0, zIndex: 60, display: 'flex', justifyContent: 'flex-end' } },
    mcpEl('div', { onClick: props.onClose, style: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.34)' } }),
    mcpEl('div', {
      style: {
        position: 'relative',
        width: 'min(560px, 100vw)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: MCP_THEME.surface,
        borderLeft: '1px solid ' + MCP_THEME.borderStrong,
        boxShadow: '-24px 0 60px rgba(0,0,0,0.24)',
      },
    },
    mcpEl('div', { style: { padding: '16px 18px 0', borderBottom: '1px solid ' + MCP_THEME.border } },
      mcpEl('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' } },
        mcpEl('div', null,
          mcpEl('div', { style: MCP_EYEBROW }, server.builtin === true ? 'Provided by a plugin' : 'MCP server'),
          mcpEl('h2', { style: { margin: 0, fontSize: '19px', fontWeight: 680, color: MCP_THEME.text } }, server.label || server.serverName),
          mcpEl('div', { style: { marginTop: '6px' } }, McpStatus({ status: server.status }))),
        mcpEl('button', { type: 'button', onClick: props.onClose, style: { ...MCP_BUTTON, padding: '5px 10px' } }, 'Close')),
      mcpEl('div', { style: { display: 'flex', gap: '2px', marginTop: '12px' } },
        [['overview', 'Overview'], ['tools', 'Tools'], ['config', 'Config']].map(([id, label]) => mcpEl('button', {
          key: id,
          type: 'button',
          onClick: () => setTab(id),
          style: {
            font: 'inherit',
            fontSize: '12.5px',
            fontWeight: 600,
            background: 'transparent',
            border: 'none',
            borderBottom: tab === id ? '2px solid ' + MCP_THEME.brand : '2px solid transparent',
            color: tab === id ? MCP_THEME.text : MCP_THEME.muted,
            padding: '7px 10px',
            cursor: 'pointer',
          },
        }, label)))),
    mcpEl('div', { style: { flex: '1 1 auto', overflowY: 'auto', padding: '16px 18px' } },
      tab === 'overview' ? mcpEl('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
        mcpEl('div', { style: MCP_CARD },
          mcpEl('div', { style: MCP_EYEBROW }, 'Endpoint'),
          mcpEl('code', { style: { fontFamily: MCP_FONT_MONO, fontSize: '12px', color: MCP_THEME.text, wordBreak: 'break-all' } }, server.summary || server.serverName),
          mcpEl('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '14px' } },
            mcpKv('Transport', server.transport === 'streamable-http' ? 'streamable HTTP' : 'stdio'),
            mcpKv('Status', server.status),
            mcpKv('Tools', String(tools.length)),
            mcpKv('Server name', 'mcp__' + server.serverName + '__'),
            mcpKv('Source', server.source || 'manual'),
            mcpKv('Timeout', String(server.toolCallTimeoutMs ?? 60000) + ' ms'))),
        server.error === '' || server.error === undefined ? null : mcpEl('div', { style: { ...MCP_CARD, borderColor: mcpTint(MCP_THEME.bad, 40) } },
          mcpEl('div', { style: MCP_EYEBROW }, 'Last error'),
          mcpEl('div', { style: { fontSize: '12px', color: MCP_THEME.bad, wordBreak: 'break-word' } }, server.error)),
        server.builtin === true ? mcpEl('p', { style: MCP_MUTED }, 'This server is mounted by another plugin; its switch lives there.')
          : mcpEl('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
            mcpEl('button', { type: 'button', style: MCP_BUTTON, onClick: () => props.onRestart(server) }, 'Restart'),
            mcpEl('button', { type: 'button', style: MCP_BUTTON, onClick: () => props.onToggle(server) }, server.enabled === false ? 'Enable' : 'Disable'),
            mcpEl('button', { type: 'button', style: { ...MCP_BUTTON, color: MCP_THEME.bad, borderColor: mcpTint(MCP_THEME.bad, 40) }, onClick: () => props.onRemove(server) }, 'Remove')))
        : null,
      tab === 'tools' ? (tools.length === 0
        ? mcpEl('p', { style: MCP_MUTED }, server.builtin === true ? 'This plugin exposes its tools under its own feature switch.' : 'No tools are registered right now - the server may be down.')
        : mcpEl('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
          tools.map(tool => mcpEl('div', { key: tool.name, style: { ...MCP_CARD, padding: '11px 12px' } },
            mcpEl('code', { style: { fontFamily: MCP_FONT_MONO, fontSize: '12px', color: MCP_THEME.text } }, tool.name),
            tool.description === '' ? null : mcpEl('p', { style: { ...MCP_MUTED, fontSize: '11.5px', margin: '4px 0 0' } }, tool.description))))) : null,
      tab === 'config' ? mcpEl('div', null,
        mcpEl('pre', {
          style: { fontFamily: MCP_FONT_MONO, fontSize: '11.5px', lineHeight: 1.6, background: MCP_THEME.surface2, border: '1px solid ' + MCP_THEME.border, borderRadius: '10px', padding: '12px', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
        }, JSON.stringify(config, null, 2)),
        mcpEl('button', {
          type: 'button',
          style: { ...MCP_BUTTON, marginTop: '10px' },
          onClick: () => {
            if (typeof navigator === 'object' && navigator.clipboard !== undefined) void navigator.clipboard.writeText(JSON.stringify(config, null, 2))
          },
        }, 'Copy config')) : null)))
}

/**
 * The Settings page entry.
 * @param {object} props the slot props.
 * @returns {object} the page.
 */
function McpServersPage(props) {
  const [data, setData] = React.useState(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [query, setQuery] = React.useState('')
  const [sheet, setSheet] = React.useState(null)
  const [drawer, setDrawer] = React.useState(null)
  const [toast, setToast] = React.useState('')
  const [confirming, setConfirming] = React.useState(null)
  const [exported, setExported] = React.useState('')

  const notify = message => {
    setToast(message)
    window.setTimeout(() => setToast(''), 3200)
  }

  const load = React.useCallback(async () => {
    const answer = await mcpPost({ action: 'list' })
    if (answer.ok === false) {
      setError(answer.error ?? 'The host did not answer.')
      setLoading(false)
      return
    }
    setError('')
    setData(answer)
    setLoading(false)
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const hasConnecting = data !== null && (data.servers ?? []).some(server => server.status === 'connecting')
  React.useEffect(() => {
    const timer = window.setInterval(() => void load(), hasConnecting ? 2000 : 15000)
    return () => window.clearInterval(timer)
  }, [hasConnecting, load])

  React.useEffect(() => {
    const onKey = event => {
      if (event.key !== 'Escape') return
      if (sheet !== null) setSheet(null)
      else if (drawer !== null) setDrawer(null)
      else if (confirming !== null) setConfirming(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheet, drawer, confirming])

  const act = async (body, message) => {
    const answer = await mcpPost(body)
    if (answer.ok === false) {
      notify(String(answer.error ?? 'That did not work.'))
      return answer
    }
    if (message !== undefined) notify(message)
    await load()
    return answer
  }

  const servers = data?.servers ?? []
  const visible = servers.filter(server => {
    if (query.trim() === '') return true
    const haystack = [server.label, server.serverName, server.summary, server.transport].join(' ').toLowerCase()
    return haystack.includes(query.trim().toLowerCase())
  })
  const counts = {
    ready: servers.filter(server => server.status === 'ready').length,
    error: servers.filter(server => server.status === 'error').length,
    disabled: servers.filter(server => server.status === 'disabled').length,
    external: servers.filter(server => server.status === 'external').length,
  }

  const exportAll = async () => {
    // A panel, not the clipboard: the page cannot rely on clipboard permission,
    // and the JSON should be visible before it is copied anywhere.
    if (exported !== '') {
      setExported('')
      return
    }
    const answer = await mcpPost({ action: 'export' })
    if (answer.ok === false) {
      notify(String(answer.error ?? 'Nothing to export.'))
      return
    }
    setExported(JSON.stringify(answer.store, null, 2))
  }

  const toDraft = server => ({
    id: server.builtin === true ? undefined : server.id,
    serverName: server.serverName,
    label: server.label,
    transport: server.transport === 'external' ? 'stdio' : server.transport,
    command: server.command ?? '',
    args: Array.isArray(server.args) ? server.args : [],
    env: Object.fromEntries(Object.entries(server.env ?? {}).filter(([, value]) => value !== '********')),
    cwd: server.cwd ?? '',
    url: server.url ?? '',
    headers: Object.fromEntries(Object.entries(server.headers ?? {}).filter(([, value]) => value !== '********')),
    toolCallTimeoutMs: server.toolCallTimeoutMs ?? 60000,
    reconnect: server.reconnect ?? { enabled: true },
    enabled: server.enabled !== false,
    category: server.category ?? 'custom',
    note: server.note ?? '',
  })

  const emptyDraft = () => ({
    serverName: '',
    label: '',
    transport: 'stdio',
    command: 'npx',
    args: '',
    env: {},
    cwd: '',
    url: '',
    headers: {},
    toolCallTimeoutMs: 60000,
    reconnect: { enabled: true },
    enabled: true,
    category: 'custom',
  })

  return mcpEl('div', { style: { padding: '4px 2px 24px', maxWidth: '1080px' } },
    mcpEl('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '4px' } },
      mcpEl('div', { style: { minWidth: 0 } },
        mcpEl('div', { style: MCP_EYEBROW }, 'AryaCode'),
        mcpEl('h2', { style: { margin: 0, fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', color: MCP_THEME.text } }, 'MCP servers'),
        mcpEl('p', { style: { ...MCP_MUTED, marginTop: '4px', maxWidth: '620px' } },
          'Tools, resources and prompts from external Model Context Protocol servers, available to every session in this profile. Servers run on this machine; the list lives in ',
          mcpEl('code', { style: { fontFamily: MCP_FONT_MONO, fontSize: '11px' } }, data?.storePath ?? 'mcp-servers.json'),
          '.')),
      mcpEl('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
        mcpEl('button', { type: 'button', style: MCP_BUTTON, onClick: () => void load() }, 'Refresh'),
        mcpEl('button', {
          type: 'button',
          style: MCP_BUTTON,
          title: 'Copy the server list as JSON, secrets included',
          onClick: () => void exportAll(),
        }, 'Export'),
        mcpEl('button', {
          type: 'button',
          style: MCP_BUTTON,
          title: 'Open the Paste tab with an exported list',
          onClick: () => setSheet({ mode: 'add', draft: emptyDraft(), tab: 'paste' }),
        }, 'Import'),
        mcpEl('button', { type: 'button', style: MCP_BUTTON_PRIMARY, onClick: () => setSheet({ mode: 'add', draft: emptyDraft() }) }, '+ Add server'))),

    data?.bridge === false ? mcpEl('div', {
      style: { ...MCP_CARD, marginTop: '12px', borderColor: mcpTint(MCP_THEME.warn, 40) },
    }, mcpEl('div', { style: MCP_EYEBROW }, 'Bridge unavailable'), mcpEl('p', { style: MCP_MUTED }, data.bridgeError)) : null,

    exported === '' ? null : mcpEl('div', { style: { ...MCP_CARD, margin: '2px 0 12px' } },
      mcpEl('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' } },
        mcpEl('div', { style: { ...MCP_EYEBROW, margin: 0 } }, 'Server list (JSON)'),
        mcpEl('button', { type: 'button', style: MCP_BUTTON, onClick: () => setExported('') }, 'Hide')),
      mcpEl('textarea', {
        readOnly: true,
        value: exported,
        rows: 10,
        onFocus: event => event.target.select(),
        style: { ...MCP_INPUT, fontFamily: MCP_FONT_MONO, fontSize: '11px', resize: 'vertical' },
      }),
      mcpEl('p', { style: { ...MCP_MUTED, fontSize: '11px', marginTop: '6px' } },
        'Focus selects everything; the file itself is ' + String(data?.storePath ?? 'mcp-servers.json') + '.')),

    mcpEl('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', margin: '14px 0 12px' } },
      mcpEl('input', {
        value: query,
        placeholder: 'Filter servers...',
        onChange: event => setQuery(event.target.value),
        style: { ...MCP_INPUT, maxWidth: '260px' },
      }),
      counts.ready > 0 ? McpChip(MCP_THEME.ok, String(counts.ready) + ' ready') : null,
      counts.error > 0 ? McpChip(MCP_THEME.bad, String(counts.error) + ' error') : null,
      counts.disabled > 0 ? McpChip(MCP_THEME.muted, String(counts.disabled) + ' disabled') : null,
      counts.external > 0 ? McpChip(MCP_THEME.brand, String(counts.external) + ' from plugins') : null),

    error === '' ? null : mcpEl('div', { style: { ...MCP_CARD, borderColor: mcpTint(MCP_THEME.bad, 40), color: MCP_THEME.bad } }, error),

    loading ? mcpEl('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' } },
      [0, 1, 2].map(index => mcpEl('div', { key: index, style: { ...MCP_CARD, height: '118px', opacity: 0.5 } }))) : null,

    !loading && visible.length === 0 && error === '' ? mcpEl('div', { style: { ...MCP_CARD, padding: '34px 24px', textAlign: 'center' } },
      mcpEl('div', { style: { width: '46px', height: '46px', margin: '0 auto 10px', display: 'grid', placeItems: 'center', borderRadius: '13px', fontSize: '12px', fontWeight: 800, letterSpacing: '0.12em', color: MCP_THEME.brand, background: mcpTint(MCP_THEME.brand, 10), border: '1px solid ' + mcpTint(MCP_THEME.brand, 34) } }, 'MCP'),
      mcpEl('h3', { style: { margin: '0 0 6px', fontSize: '16px', fontWeight: 680, color: MCP_THEME.text } },
        servers.length === 0 ? 'No MCP servers yet' : 'Nothing matches that filter'),
      mcpEl('p', { style: { ...MCP_MUTED, maxWidth: '440px', margin: '0 auto 14px' } },
        servers.length === 0
          ? "Connect GitHub, a database, a browser or anything else that speaks MCP. The model sees each server's tools as mcp__name__tool."
          : 'Clear the filter to see every server in this profile.'),
      mcpEl('div', { style: { display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' } },
        mcpEl('button', { type: 'button', style: MCP_BUTTON_PRIMARY, onClick: () => setSheet({ mode: 'add', draft: emptyDraft(), tab: 'catalog' }) }, 'Browse the catalog'),
        mcpEl('button', { type: 'button', style: MCP_BUTTON, onClick: () => setSheet({ mode: 'add', draft: emptyDraft(), tab: 'paste' }) }, 'Paste a command'))) : null,

    !loading && visible.length > 0 ? mcpEl('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' } },
      visible.map(server => mcpEl(McpCard, {
        key: server.id,
        server,
        onOpen: setDrawer,
        onEdit: value => setSheet({ mode: 'edit', draft: toDraft(value) }),
        onToggle: value => void act({ action: 'toggle', id: value.id, enabled: value.enabled !== true }, value.enabled ? 'Disabled ' + value.serverName + '.' : 'Enabled ' + value.serverName + '.'),
        onRemove: value => setConfirming(value),
      }))) : null,

    sheet === null ? null : mcpEl(McpSheet, {
      mode: sheet.mode,
      draft: sheet.draft,
      onClose: () => setSheet(null),
      onImported: answer => {
        setSheet(null)
        const saved = Array.isArray(answer.saved) ? answer.saved : []
        const failed = Array.isArray(answer.failed) ? answer.failed : []
        notify('Imported ' + String(saved.length) + ' server' + (saved.length === 1 ? '' : 's') + (failed.length > 0 ? ', ' + String(failed.length) + ' failed' : '') + '.')
        void load()
      },
      onSaved: server => {
        setSheet(null)
        notify((sheet.mode === 'edit' ? 'Updated ' : 'Added ') + (server?.serverName ?? 'server') + '.')
        void load()
      },
    }),

    drawer === null ? null : mcpEl(McpDrawer, {
      server: drawer,
      onClose: () => setDrawer(null),
      onRestart: value => void act({ action: 'restart', id: value.id }, 'Restarted ' + value.serverName + '.'),
      onToggle: value => void act({ action: 'toggle', id: value.id, enabled: value.enabled !== true }, value.enabled === false ? 'Enabled ' + value.serverName + '.' : 'Disabled ' + value.serverName + '.'),
      onRemove: value => {
        setDrawer(null)
        setConfirming(value)
      },
    }),

    confirming === null ? null : mcpEl('div', { style: { position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center' } },
      mcpEl('div', { onClick: () => setConfirming(null), style: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' } }),
      mcpEl('div', { style: { position: 'relative', width: 'min(420px, 92vw)', ...MCP_CARD, padding: '20px' } },
        mcpEl('h3', { style: { margin: '0 0 6px', fontSize: '16px', fontWeight: 680, color: MCP_THEME.text } }, 'Remove ' + (confirming.label || confirming.serverName) + '?'),
        mcpEl('p', { style: MCP_MUTED }, 'Its tools disappear from every session and the saved entry is deleted. The server itself is not uninstalled.'),
        mcpEl('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' } },
          mcpEl('button', { type: 'button', style: MCP_BUTTON, onClick: () => setConfirming(null) }, 'Cancel'),
          mcpEl('button', {
            type: 'button',
            style: { ...MCP_BUTTON, color: MCP_THEME.bad, borderColor: mcpTint(MCP_THEME.bad, 45) },
            onClick: () => {
              const target = confirming
              setConfirming(null)
              void act({ action: 'remove', id: target.id }, 'Removed ' + target.serverName + '.')
            },
          }, 'Remove'))),

    toast === '' ? null : mcpEl('div', {
      style: {
        marginTop: '10px',
        padding: '9px 14px',
        borderRadius: '999px',
        fontSize: '12.5px',
        fontWeight: 600,
        color: MCP_THEME.text,
        background: MCP_THEME.surface,
        border: '1px solid ' + MCP_THEME.borderStrong,
        boxShadow: '0 10px 30px rgba(0,0,0,0.24)',
      },
    }, toast)))
}

/**
 * The AryaSearch card in the Plugins page.
 *
 * It is a provider page, not a settings section: the harness keeps web-search
 * configuration in Plugins ("Web search" sits there), so a private search engine
 * belongs beside it. The card owns one host route (`api/polish.websearch`) and
 * never writes the `web` row itself: the host pins `searchProvider` under the
 * mode this card saves, so a switch flip cannot leave the row pointing at a
 * provider that is not registered.
 *
 * The `Mcp*` names it reuses come from `client/mcp.js`, which is inlined earlier
 * in the same bundle factory, so both pages share one set of tokens.
 */

/** The route the host registers; relative so the shell's base URI applies. */
const ARYASEARCH_ROUTE = 'api/polish.websearch'

/**
 * Call the host route.
 * @param {object} body the request payload.
 * @returns {Promise<object>} the JSON answer, or an error answer.
 */
async function aryaSearchPost(body) {
  try {
    const response = await fetch(ARYASEARCH_ROUTE, {
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

/** One labelled control, matching the MCP page's form. */
function AryaSearchField(props) {
  return mcpEl(McpField, { label: props.label, hint: props.hint, optional: props.optional }, props.children)
}

/** The provider pill. */
function AryaSearchProviderPill(props) {
  const id = props.id
  if (id === 'aryasearch') return McpChip(MCP_THEME.ok, 'AryaSearch')
  if (id === 'deepseek-official') return McpChip(MCP_THEME.brand, 'DeepSeek')
  if (id === 'deepseek-search-api') return McpChip(MCP_THEME.brand, 'DeepSeek Search API')
  if (id === undefined || id === '') return McpChip(MCP_THEME.muted, 'not selected')
  return McpChip(MCP_THEME.muted, id)
}

/**
 * The card.
 * @param {object} props the slot props: `view` is `summary` in the collapsed list.
 * @returns {object} the card.
 */
function AryaSearchCard(props) {
  const [status, setStatus] = React.useState(null)
  const [draft, setDraft] = React.useState(null)
  const [errors, setErrors] = React.useState([])
  const [note, setNote] = React.useState('')
  const [testing, setTesting] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [testResult, setTestResult] = React.useState(null)
  const [query, setQuery] = React.useState('arya test')

  const load = React.useCallback(async () => {
    const answer = await aryaSearchPost({ action: 'status' })
    if (answer.ok === false) {
      setErrors([{ field: '', message: String(answer.error ?? 'The host did not answer.') }])
      return
    }
    setStatus(answer)
    setDraft(current => current ?? answer.settings)
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const setField = (key, value) => setDraft(current => ({ ...(current ?? {}), [key]: value }))

  if (props.view === 'summary') {
    const selection = status?.selection?.effective
    const ready = status?.configured === true
    return mcpEl('span', { style: { ...MCP_MUTED, fontSize: '12px' } },
      ready ? 'Private search through your SearXNG instance. ' : 'Add your SearXNG instance to search without a DeepSeek key. ',
      selection === undefined ? '' : 'Currently: ' + (selection === 'aryasearch' ? 'AryaSearch.' : 'not selected.'))
  }

  if (draft === null) {
    if (errors.length > 0) {
      return mcpEl('div', { style: { ...MCP_CARD, borderColor: mcpTint(MCP_THEME.bad, 40) } },
        mcpEl('div', { style: MCP_EYEBROW }, 'AryaSearch'),
        mcpEl('p', { style: { ...MCP_MUTED, color: MCP_THEME.bad } }, errors[0].message))
    }
    return mcpEl('div', { style: { ...MCP_CARD, opacity: 0.6 } }, mcpEl('div', { style: MCP_EYEBROW }, 'AryaSearch'), mcpEl('p', { style: MCP_MUTED }, 'Loading…'))
  }

  const mode = draft.mode ?? 'auto'
  const auth = draft.auth ?? 'none'
  const save = async () => {
    setSaving(true)
    setErrors([])
    setNote('')
    const answer = await aryaSearchPost({ action: 'save', settings: draft })
    setSaving(false)
    if (answer.ok !== true) {
      setErrors(Array.isArray(answer.errors) ? answer.errors : [{ field: '', message: String(answer.error ?? 'The host refused the settings.') }])
      return
    }
    setStatus(answer)
    setDraft(answer.settings)
    setNote(answer.reconcile?.changed === true ? 'Saved. Search is pinned to AryaSearch.' : 'Saved.')
  }

  const test = async () => {
    setTesting(true)
    setTestResult(null)
    const answer = await aryaSearchPost({ action: 'test', query })
    setTesting(false)
    setTestResult(answer)
  }

  const modeHint = mode === 'auto'
    ? 'Pins AryaSearch only while DeepSeek has no API key, so web_search keeps working on local models.'
    : mode === 'always'
      ? 'Always uses AryaSearch for web search, even when a DeepSeek key exists.'
      : 'Never changes the selection. The deployment keeps whatever search provider it was composed with.'

  return mcpEl('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
    mcpEl('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
      mcpEl('span', { style: { ...MCP_MUTED, fontSize: '11px' } }, 'Effective provider'),
      mcpEl(AryaSearchProviderPill, { id: status?.selection?.effective }),
      McpChip(status?.deepseek?.configured === true ? MCP_THEME.brand : MCP_THEME.muted,
        status?.deepseek?.configured === true ? 'DeepSeek key set' : 'no DeepSeek key'),
      status?.configured === true ? McpChip(MCP_THEME.ok, 'AryaSearch set') : McpChip(MCP_THEME.warn, 'no URL yet'),
      status?.readiness === true ? McpChip(MCP_THEME.ok, 'web_search offered') : status?.readiness === false ? McpChip(MCP_THEME.bad, 'web_search unavailable') : null),

    mcpEl('p', { style: { ...MCP_MUTED, fontSize: '11.5px', margin: 0 } },
      'The built-in web_search tool is offered to a model only while the selected provider can authenticate. Without a DeepSeek key, that tool disappears on a local model; this provider answers for every model route.'),

    mcpEl('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
      [['auto', 'Automatic'], ['always', 'Always'], ['off', 'Off']].map(([id, label]) => mcpEl('button', {
        key: id,
        type: 'button',
        onClick: () => setField('mode', id),
        style: {
          ...MCP_BUTTON,
          background: mode === id ? mcpTint(MCP_THEME.brand, 14) : MCP_THEME.surface2,
          borderColor: mode === id ? mcpTint(MCP_THEME.brand, 45) : MCP_THEME.border,
        },
      }, label))),
    mcpEl('p', { style: { ...MCP_MUTED, fontSize: '11px', margin: 0 } }, modeHint),

    mcpEl(AryaSearchField, { label: 'Instance URL', hint: 'The SearXNG base URL, for example https://search.example.ts.net. JSON must be enabled in its search.formats.' },
      mcpEl('input', {
        value: draft.baseURL ?? '',
        placeholder: 'https://your-searxng.example',
        spellCheck: false,
        onChange: event => setField('baseURL', event.target.value),
        style: { ...MCP_INPUT, fontFamily: MCP_FONT_MONO },
      })),

    mcpEl('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' } },
      mcpEl(AryaSearchField, { label: 'Authentication' },
        mcpEl('select', {
          value: auth,
          onChange: event => setField('auth', event.target.value),
          style: MCP_INPUT,
        },
        [['none', 'None'], ['bearer', 'Bearer token'], ['basic', 'Basic auth'], ['header', 'Custom headers']].map(([value, label]) =>
          mcpEl('option', { key: value, value }, label)))),
      mcpEl(AryaSearchField, { label: 'Timeout (ms)', hint: '2 000 - 60 000' },
        mcpEl('input', {
          type: 'number',
          value: String(draft.timeoutMs ?? 20000),
          onChange: event => setField('timeoutMs', Number(event.target.value)),
          style: MCP_INPUT,
        }))),

    auth === 'bearer' ? mcpEl('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' } },
      mcpEl(AryaSearchField, { label: 'Credential reference', hint: 'A name in the harness credential store, for example ARYASEARCH_TOKEN.' },
        mcpEl('input', {
          value: draft.tokenRef ?? '',
          placeholder: 'ARYASEARCH_TOKEN',
          spellCheck: false,
          onChange: event => setField('tokenRef', event.target.value),
          style: { ...MCP_INPUT, fontFamily: MCP_FONT_MONO },
        })),
      mcpEl(AryaSearchField, { label: 'Or a literal token', hint: 'Stored in the local settings file; a credential reference is better.' },
        mcpEl('input', {
          value: draft.token ?? '',
          type: 'password',
          spellCheck: false,
          onChange: event => setField('token', event.target.value),
          style: MCP_INPUT,
        }))) : null,

    auth === 'basic' ? mcpEl('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' } },
      mcpEl(AryaSearchField, { label: 'User' },
        mcpEl('input', { value: draft.basicUser ?? '', onChange: event => setField('basicUser', event.target.value), style: MCP_INPUT })),
      mcpEl(AryaSearchField, { label: 'Password' },
        mcpEl('input', {
          value: draft.basicPass ?? '',
          type: 'password',
          onChange: event => setField('basicPass', event.target.value),
          style: MCP_INPUT,
        }))) : null,

    auth === 'header' ? mcpEl(AryaSearchField, { label: 'Headers', hint: 'Sent with every search request.' },
      mcpEl(McpMapEditor, { values: draft.headers ?? {}, onChange: value => setField('headers', value) })) : null,

    mcpEl('details', null,
      mcpEl('summary', { style: { cursor: 'pointer', fontSize: '12px', color: MCP_THEME.muted } }, 'Search defaults'),
      mcpEl('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' } },
        mcpEl(AryaSearchField, { label: 'Language', optional: true, hint: 'For example en, or empty for the instance default.' },
          mcpEl('input', { value: draft.language ?? '', onChange: event => setField('language', event.target.value), style: MCP_INPUT })),
        mcpEl(AryaSearchField, { label: 'Safe search' },
          mcpEl('select', {
            value: String(draft.safesearch ?? ''),
            onChange: event => setField('safesearch', event.target.value),
            style: MCP_INPUT,
          },
          [['', 'Instance default'], ['0', 'Off'], ['1', 'Moderate'], ['2', 'Strict']].map(([value, label]) =>
            mcpEl('option', { key: value, value }, label)))),
        mcpEl(AryaSearchField, { label: 'Categories', optional: true, hint: 'Comma separated, for example general,news.' },
          mcpEl('input', { value: draft.categories ?? '', onChange: event => setField('categories', event.target.value), style: MCP_INPUT })),
        mcpEl(AryaSearchField, { label: 'Time range' },
          mcpEl('select', {
            value: draft.timeRange ?? '',
            onChange: event => setField('timeRange', event.target.value),
            style: MCP_INPUT,
          },
          [['', 'Any time'], ['day', 'Past day'], ['week', 'Past week'], ['month', 'Past month'], ['year', 'Past year']].map(([value, label]) =>
            mcpEl('option', { key: value, value }, label)))))),

    errors.length > 0 ? mcpEl('div', {
      style: { padding: '9px 11px', borderRadius: '9px', fontSize: '12px', color: MCP_THEME.bad, background: mcpTint(MCP_THEME.bad, 8), border: '1px solid ' + mcpTint(MCP_THEME.bad, 30) },
    }, errors.map((error, index) => mcpEl('div', { key: index }, (error.field === '' ? '' : error.field + ': ') + error.message))) : null,
    note === '' ? null : mcpEl('div', {
      style: { padding: '8px 11px', borderRadius: '9px', fontSize: '12px', color: MCP_THEME.ok, background: mcpTint(MCP_THEME.ok, 8), border: '1px solid ' + mcpTint(MCP_THEME.ok, 30) },
    }, note),

    mcpEl('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } },
      mcpEl('input', {
        value: query,
        onChange: event => setQuery(event.target.value),
        placeholder: 'Test query',
        style: { ...MCP_INPUT, maxWidth: '220px', fontSize: '12px' },
      }),
      mcpEl('button', { type: 'button', onClick: () => void test(), disabled: testing, style: { ...MCP_BUTTON, opacity: testing ? 0.6 : 1 } },
        testing ? 'Testing…' : 'Test'),
      mcpEl('button', { type: 'button', onClick: () => void save(), disabled: saving, style: { ...MCP_BUTTON_PRIMARY, opacity: saving ? 0.6 : 1 } },
        saving ? 'Saving…' : 'Save')),

    testResult === null ? null : mcpEl('div', {
      style: {
        padding: '9px 11px',
        borderRadius: '9px',
        fontSize: '12px',
        color: testResult.ok ? MCP_THEME.ok : MCP_THEME.bad,
        background: mcpTint(testResult.ok ? MCP_THEME.ok : MCP_THEME.bad, 8),
        border: '1px solid ' + mcpTint(testResult.ok ? MCP_THEME.ok : MCP_THEME.bad, 30),
      },
    },
    testResult.ok
      ? String(testResult.count) + ' results in ' + (Math.round((testResult.ms ?? 0) / 100) / 10) + 's' +
        ((testResult.engines ?? []).length > 0 ? ' · engines: ' + testResult.engines.slice(0, 5).join(', ') : '') +
        ((testResult.unresponsive ?? []).length > 0 ? ' · no answer: ' + testResult.unresponsive.map(entry => entry.engine + ' (' + entry.reason + ')').join(', ') : '') +
        (testResult.first?.url === undefined ? '' : ' · first: ' + testResult.first.url)
      : 'Test failed: ' + String(testResult.error ?? 'no answer')),

    mcpEl('p', { style: { ...MCP_MUTED, fontSize: '11px', margin: 0 } },
      'The shipped Web search card writes the same selection; whichever saved last wins, and the effective provider above is always read back from the Host. Settings live in ',
      mcpEl('code', { style: { fontFamily: MCP_FONT_MONO, fontSize: '10.5px' } }, String(status?.path ?? 'web-search.json')),
      '.'))
}

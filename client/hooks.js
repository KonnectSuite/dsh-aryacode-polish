/**
 * Settings → Hooks: the rules in polish/hooks.json and what they did.
 *
 * The panel never edits the file. A hooks file is executable configuration — one
 * rule runs a command — and a half-editor that cannot show quoting or argument
 * boundaries would be worse than a text editor beside it. So the page names the
 * path, validates what is there, and shows the last dispatches.
 * @returns {object} the page.
 */
function AryaHooksPage() {
  const [state, setState] = React.useState(null)
  const [notice, setNotice] = React.useState('')

  const call = async (body) => {
    const answer = await fetch('api/polish.hooks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    return answer.json()
  }

  const adopt = (answer) => {
    if (answer !== null && typeof answer === 'object' && answer.ok === true) setState(answer)
    else setNotice('Could not read the hooks file.')
  }

  React.useEffect(() => {
    call({ action: 'list' }).then(adopt).catch(() => setNotice('Could not read the hooks file.'))
  }, [])

  const validate = async () => {
    try {
      adopt(await call({ action: 'validate' }))
      setNotice('')
    } catch {
      setNotice('Could not read the hooks file.')
    }
  }

  const rules = Array.isArray(state?.rules) ? state.rules : []
  const errors = Array.isArray(state?.errors) ? state.errors : []
  const dispatches = Array.isArray(state?.dispatches) ? state.dispatches : []
  const path = typeof state?.path === 'string' ? state.path : 'polish/hooks.json'

  const header = React.createElement('div', { style: { marginBottom: '12px' } },
    React.createElement('div', { style: ARYA_EYEBROW }, 'Polish'),
    React.createElement('h2', { style: { margin: '0 0 6px', fontSize: '20px', fontWeight: 680, letterSpacing: '-0.02em', color: ARYA_THEME.text } }, 'Hooks'),
    React.createElement('p', { style: { ...ARYA_MUTED, maxWidth: '660px', margin: 0 } },
      'Commands run after something happened: a turn stopped, a session errored, or a checkpoint landed. Hooks are observational — they cannot veto a tool call or block a turn — and the event payload arrives as JSON in POLISH_HOOK_PAYLOAD.'))

  const filesCard = React.createElement('div', { style: ARYA_CARD },
    React.createElement('div', { style: { ...ARYA_ROW, alignItems: 'flex-start', gap: '12px' } },
      React.createElement('div', { style: { minWidth: 0 } },
        React.createElement('div', { style: ARYA_TITLE }, 'Rules file'),
        React.createElement('div', { style: { ...ARYA_MUTED, fontSize: '11px', marginTop: '3px', fontFamily: ARYA_FONT_MONO, wordBreak: 'break-all' } }, path)),
      React.createElement('button', { type: 'button', style: ARYA_BUTTON, onClick: validate }, 'Validate')),
    React.createElement('div', { style: { ...ARYA_MUTED, fontSize: '11px', marginTop: '8px' } },
      'Shape: {"hooks": [{"name": "notify", "on": "turn/stopping", "action": {"kind": "exec", "command": "notify-send", "args": ["done"]}}]}. Events: turn/stopping, agent/error, compaction/summary, compaction/end.'))

  const rulesCard = React.createElement('div', { style: ARYA_CARD },
    React.createElement('div', { style: { ...ARYA_ROW, marginBottom: '8px' } },
      React.createElement('div', { style: ARYA_TITLE }, 'Rules'),
      AryaChip({ tone: errors.length > 0 ? ARYA_THEME.bad : rules.length > 0 ? ARYA_THEME.ok : ARYA_THEME.muted },
        errors.length > 0 ? errors.length + ' invalid' : rules.length + (rules.length === 1 ? ' rule' : ' rules'))),
    rules.length === 0
      ? React.createElement('div', { style: { padding: '16px 0', textAlign: 'center' } },
        React.createElement('p', { style: { ...ARYA_MUTED, fontSize: '12.5px', margin: 0 } }, 'No hooks yet. Add a rule to the file above and press Validate.'))
      : rules.map(rule => React.createElement('div', {
        key: rule.name,
        style: {
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          gap: '10px',
          alignItems: 'center',
          padding: '9px 0',
          borderTop: '1px solid ' + ARYA_THEME.border,
        },
      },
      React.createElement('div', { style: { minWidth: 0 } },
        React.createElement('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } },
          React.createElement('span', { style: { fontSize: '12.5px', fontWeight: 600, color: ARYA_THEME.text } }, rule.name),
          AryaChip({ tone: ARYA_DATA }, rule.on)),
        React.createElement('div', { style: { ...ARYA_MUTED, fontSize: '10.5px', marginTop: '2px', fontFamily: ARYA_FONT_MONO, wordBreak: 'break-all' } },
          rule.command + ' · ' + Math.round(rule.timeoutMs / 1000) + 's timeout')),
      React.createElement('span', { style: { ...ARYA_MUTED, fontSize: '10.5px', fontFamily: ARYA_FONT_MONO } }, rule.kind))),
    errors.map(error => React.createElement('div', {
      key: 'error-' + String(error.index),
      style: {
        marginTop: '8px',
        padding: '8px 10px',
        borderRadius: '9px',
        background: aryaTint(ARYA_THEME.bad, 6),
        border: '1px solid ' + aryaTint(ARYA_THEME.bad, 30),
        fontSize: '11.5px',
        color: ARYA_THEME.text,
      },
    }, (error.index < 0 ? 'File: ' : 'Rule ' + (error.index + 1) + ': ') + error.message)))

  const logCard = React.createElement('div', { style: ARYA_CARD },
    React.createElement('div', { style: { ...ARYA_ROW, marginBottom: '8px' } },
      React.createElement('div', { style: ARYA_TITLE }, 'Recent dispatches'),
      React.createElement('span', { style: { ...ARYA_MUTED, fontSize: '11px' } }, 'newest first, in memory only')),
    dispatches.length === 0
      ? React.createElement('p', { style: { ...ARYA_MUTED, fontSize: '12px', margin: 0 } }, 'Nothing has fired in this session yet.')
      : dispatches.map(entry => React.createElement('div', {
        key: String(entry.at) + entry.hook,
        style: {
          display: 'grid',
          gridTemplateColumns: 'auto minmax(0, 1fr) auto',
          gap: '10px',
          alignItems: 'center',
          padding: '7px 0',
          borderTop: '1px solid ' + ARYA_THEME.border,
          fontSize: '11.5px',
        },
      },
      AryaChip({ tone: entry.ok ? ARYA_THEME.ok : ARYA_THEME.bad }, entry.ok ? 'ok' : 'failed'),
      React.createElement('div', { style: { minWidth: 0 } },
        React.createElement('span', { style: { fontWeight: 600, color: ARYA_THEME.text } }, entry.hook),
        React.createElement('span', { style: { ...ARYA_MUTED } }, ' · ' + entry.event),
        entry.detail.length === 0 ? null : React.createElement('div', { style: { ...ARYA_MUTED, fontSize: '10.5px', fontFamily: ARYA_FONT_MONO, wordBreak: 'break-all' } }, entry.detail)),
      React.createElement('span', { style: { ...ARYA_MUTED, fontSize: '10.5px', fontFamily: ARYA_FONT_MONO } }, entry.ms + ' ms'))))

  return React.createElement('div', { style: { maxWidth: '820px', padding: '4px 2px 8px' } },
    header,
    notice.length === 0 ? null : React.createElement('div', {
      style: {
        ...ARYA_CARD,
        marginBottom: '12px',
        borderColor: aryaTint(ARYA_THEME.warn, 40),
        background: aryaTint(ARYA_THEME.warn, 6),
        fontSize: '12px',
        color: ARYA_THEME.text,
      },
    }, notice),
    filesCard,
    rulesCard,
    logCard)
}

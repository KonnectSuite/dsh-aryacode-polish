/**
 * Settings → Memory: the store the agent carries between sessions.
 *
 * The panel is the only writer on purpose. Notes are short, quoted into the
 * system prompt as recalled context, and never injected as messages, so what the
 * user sees here is exactly what the model is told.
 * @returns {object} the page.
 */
function AryaMemoryPage() {
  const [entries, setEntries] = React.useState(null)
  const [text, setText] = React.useState('')
  const [query, setQuery] = React.useState('')
  const [notice, setNotice] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  const call = async (body) => {
    const answer = await fetch('api/polish.memory', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    return answer.json()
  }

  const adopt = (answer) => {
    if (answer !== null && typeof answer === 'object' && Array.isArray(answer.entries)) setEntries(answer.entries)
  }

  React.useEffect(() => {
    call({ action: 'list' }).then(adopt).catch(() => {
      setEntries([])
      setNotice('Could not read memory.')
    })
  }, [])

  const add = async () => {
    const body = text.trim()
    if (body.length === 0) return
    setBusy(true)
    try {
      const answer = await call({ action: 'add', text: body, scope: 'global' })
      if (answer.ok === true) {
        adopt(answer)
        setText('')
        setNotice('')
      } else {
        setNotice(answer.code === 'memory_too_long' ? 'That note is too long (500 characters).' : 'Could not save the note.')
      }
    } catch {
      setNotice('Could not save the note.')
    } finally {
      setBusy(false)
    }
  }

  const forget = async (id) => {
    try {
      const answer = await call({ action: 'forget', id })
      if (answer.ok === true) adopt(answer)
      else setNotice('Could not forget that note.')
    } catch {
      setNotice('Could not forget that note.')
    }
  }

  const all = Array.isArray(entries) ? entries : []
  const needle = query.trim().toLowerCase()
  const shown = needle.length === 0 ? all : all.filter(entry => entry.text.toLowerCase().includes(needle))

  const header = React.createElement('div', { style: { marginBottom: '12px' } },
    React.createElement('div', { style: ARYA_EYEBROW }, 'Polish'),
    React.createElement('h2', { style: { margin: '0 0 6px', fontSize: '20px', fontWeight: 680, letterSpacing: '-0.02em', color: ARYA_THEME.text } }, 'Memory'),
    React.createElement('p', { style: { ...ARYA_MUTED, maxWidth: '640px', margin: 0 } },
      'Short notes kept across every session in this profile. They are quoted into the system prompt as recalled context — never as instructions — and an empty store contributes nothing at all.'))

  const composer = React.createElement('div', { style: ARYA_CARD },
    React.createElement('div', { style: { ...ARYA_EYEBROW, marginBottom: '8px' } }, 'Remember a note'),
    React.createElement('div', { style: { display: 'flex', gap: '8px' } },
      React.createElement('input', {
        type: 'text',
        value: text,
        placeholder: 'e.g. this workspace builds with pnpm test before every commit',
        onChange: event => setText(event.target.value),
        onKeyDown: event => { if (event.key === 'Enter') add() },
        style: { ...ARYA_INPUT, textAlign: 'left', flex: '1 1 auto' },
      }),
      React.createElement('button', {
        type: 'button',
        disabled: busy || text.trim().length === 0,
        onClick: add,
        style: { ...ARYA_BUTTON_PRIMARY, flex: '0 0 auto', opacity: busy || text.trim().length === 0 ? 0.45 : 1 },
      }, busy ? 'Saving…' : 'Remember')),
    React.createElement('div', { style: { ...ARYA_MUTED, fontSize: '10.5px', marginTop: '6px' } },
      'Up to 500 characters. Stored under the harness home as polish/memory.json.'))

  const list = React.createElement('div', { style: ARYA_CARD },
    React.createElement('div', { style: { ...ARYA_ROW, marginBottom: '8px' } },
      React.createElement('div', { style: ARYA_TITLE }, 'Saved notes'),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        AryaChip({ tone: all.length > 0 ? ARYA_THEME.ok : ARYA_THEME.muted }, all.length + (all.length === 1 ? ' note' : ' notes')),
        React.createElement('input', {
          type: 'text',
          value: query,
          placeholder: 'Filter',
          onChange: event => setQuery(event.target.value),
          style: { ...ARYA_INPUT, textAlign: 'left', width: '150px' },
        }))),
    all.length === 0
      ? React.createElement('div', { style: { padding: '18px 0', textAlign: 'center' } },
        React.createElement('p', { style: { ...ARYA_MUTED, fontSize: '12.5px', margin: 0 } }, 'Nothing remembered yet. Add a note above and it applies from the next session.'))
      : shown.length === 0
        ? React.createElement('p', { style: { ...ARYA_MUTED, fontSize: '12px', margin: 0 } }, 'No note matches that filter.')
        : shown.map(entry => React.createElement('div', {
          key: entry.id,
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
          React.createElement('div', { style: { fontSize: '12.5px', color: ARYA_THEME.text, lineHeight: 1.45 } }, entry.text),
          React.createElement('div', { style: { ...ARYA_MUTED, fontSize: '10.5px', marginTop: '2px', fontFamily: ARYA_FONT_MONO } },
            entry.scope + ' · ' + new Date(entry.at).toLocaleString())),
        React.createElement('button', {
          type: 'button',
          onClick: () => forget(entry.id),
          style: { ...ARYA_BUTTON, padding: '4px 10px', fontSize: '11.5px' },
        }, 'Forget'))))

  return React.createElement('div', { style: { maxWidth: '820px', padding: '4px 2px 8px' } },
    header,
    notice.length === 0 ? null : React.createElement('div', {
      style: {
        ...ARYA_CARD,
        marginBottom: '12px',
        borderColor: aryaTint(ARYA_THEME.warn, 40),
        background: aryaTint(ARYA_THEME.warn, 6),
        color: ARYA_THEME.text,
        fontSize: '12px',
      },
    }, notice),
    composer,
    list)
}

/**
 * The Engineering tab: the five steps of the loop, for one session.
 *
 * It reads the `aryaAutomation` projection, which folds tool events into the loop
 * stages. Nothing here is inferred from prose: a stage is done only because the
 * tool that proves it ran and succeeded, and a failed check stays red until a
 * later attempt replaces it.
 * @returns {object} the tab body.
 */
function AryaEngineeringTab(props) {
  const record = typeof props.useProjection === 'function' ? props.useProjection('aryaAutomation') : undefined
  const view = record !== null && typeof record === 'object' ? record : {}
  const stages = Array.isArray(view.stages) ? view.stages : []
  const artifacts = Array.isArray(view.artifacts) ? view.artifacts : []
  const checks = Array.isArray(view.checks) ? view.checks : []
  const gates = view.gates !== null && typeof view.gates === 'object' ? view.gates : { asked: 0, decided: 0, policy: '' }
  const live = view.live !== null && typeof view.live === 'object' ? view.live : { reads: 0, writes: 0 }
  const failures = Number(view.failures) || 0
  const hasActivity = view.hasActivity === true

  const header = React.createElement('div', { style: { marginBottom: '14px' } },
    React.createElement('div', { style: ARYA_EYEBROW }, 'Automation'),
    React.createElement('div', { style: { display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' } },
      React.createElement('h2', { style: { margin: 0, fontSize: '19px', fontWeight: 680, letterSpacing: '-0.02em', color: ARYA_THEME.text } }, 'Engineering ledger'),
      failures > 0 ? AryaChip({ tone: ARYA_THEME.bad }, failures + (failures === 1 ? ' failing check' : ' failing checks')) : null),
    React.createElement('div', { style: { ...ARYA_MUTED, fontSize: '11.5px', marginTop: '2px' } },
      'Read → Checks → Write → Verify → Live/hand-off, folded from this session’s tool calls.'))

  const stageStrip = React.createElement('div', {
    style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' },
  }, stages.map(stage => React.createElement('div', {
    key: stage.id,
    style: {
      ...ARYA_CARD,
      margin: 0,
      padding: '12px 13px',
      borderColor: stage.done ? aryaTint(ARYA_THEME.ok, 40) : ARYA_THEME.border,
      background: stage.done ? aryaTint(ARYA_THEME.ok, 4) : ARYA_THEME.surface,
    },
  },
  React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
    React.createElement('span', {
      style: {
        width: '7px',
        height: '7px',
        borderRadius: '999px',
        background: stage.done ? ARYA_THEME.ok : aryaTint(ARYA_THEME.muted, 45),
        display: 'inline-block',
      },
    }),
    React.createElement('span', { style: { ...ARYA_EYEBROW, margin: 0 } }, stage.label)),
  React.createElement('div', { style: { marginTop: '6px', fontSize: '12.5px', fontWeight: 600, color: stage.done ? ARYA_THEME.text : ARYA_THEME.muted } }, stage.detail))))

  const artifactCard = React.createElement('div', { style: ARYA_CARD },
    React.createElement('div', { style: { ...ARYA_ROW, marginBottom: '8px' } },
      React.createElement('div', { style: ARYA_TITLE }, 'Artifacts in play'),
      React.createElement('span', { style: { ...ARYA_MUTED, fontSize: '11px' } }, 'newest first')),
    artifacts.length === 0
      ? React.createElement('p', { style: { ...ARYA_MUTED, fontSize: '12px', margin: 0 } }, 'No engineering artifact named yet.')
      : artifacts.map((artifact, index) => React.createElement('div', {
        key: String(artifact.value) + String(index),
        style: {
          display: 'grid',
          gridTemplateColumns: 'auto minmax(0, 1fr)',
          gap: '10px',
          alignItems: 'baseline',
          padding: '7px 0',
          borderTop: '1px solid ' + ARYA_THEME.border,
        },
      },
      AryaChip({ tone: ARYA_THEME.muted }, artifact.kind),
      React.createElement('div', { style: { minWidth: 0 } },
        React.createElement('div', { style: { fontFamily: ARYA_FONT_MONO, fontSize: '11.5px', color: ARYA_THEME.text, wordBreak: 'break-all' } }, artifact.value),
        React.createElement('div', { style: { ...ARYA_MUTED, fontSize: '10.5px', marginTop: '1px' } }, 'named by ' + artifact.tool)))))

  const checkCard = React.createElement('div', { style: ARYA_CARD },
    React.createElement('div', { style: { ...ARYA_ROW, marginBottom: '8px' } },
      React.createElement('div', { style: ARYA_TITLE }, 'Checks and verifications'),
      React.createElement('span', { style: { ...ARYA_MUTED, fontSize: '11px' } }, 'one row per tool, newest result wins')),
    checks.length === 0
      ? React.createElement('p', { style: { ...ARYA_MUTED, fontSize: '12px', margin: 0 } }, 'Nothing has been checked or verified in this session yet.')
      : checks.map((check, index) => React.createElement('div', {
        key: check.name + String(index),
        style: {
          display: 'grid',
          gridTemplateColumns: 'auto minmax(0, 1fr) auto',
          gap: '10px',
          alignItems: 'center',
          padding: '7px 0',
          borderTop: '1px solid ' + ARYA_THEME.border,
          fontSize: '12px',
        },
      },
      AryaChip({ tone: check.ok ? ARYA_THEME.ok : ARYA_THEME.bad }, check.ok ? 'pass' : 'fail'),
      React.createElement('span', { style: { fontFamily: ARYA_FONT_MONO, color: ARYA_THEME.text, overflow: 'hidden', textOverflow: 'ellipsis' } }, check.name),
      React.createElement('span', { style: { ...ARYA_MUTED, fontSize: '10.5px', fontFamily: ARYA_FONT_MONO } },
        new Date(check.at).toLocaleTimeString()))))

  const outcome = React.createElement('div', { style: { ...ARYA_CARD, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px' } },
    React.createElement('div', null,
      React.createElement('div', { style: ARYA_EYEBROW }, 'Approvals'),
      React.createElement('div', { style: { fontSize: '13px', fontWeight: 600, color: ARYA_THEME.text } }, gates.asked + ' asked · ' + gates.decided + ' decided'),
      React.createElement('div', { style: { ...ARYA_MUTED, fontSize: '10.5px' } }, gates.policy.length > 0 ? 'policy: ' + gates.policy : 'no approval policy yet')),
    React.createElement('div', null,
      React.createElement('div', { style: ARYA_EYEBROW }, 'Live controller'),
      React.createElement('div', { style: { fontSize: '13px', fontWeight: 600, color: live.writes > 0 ? ARYA_THEME.warn : ARYA_THEME.text } }, live.reads + ' reads · ' + live.writes + ' writes'),
      React.createElement('div', { style: { ...ARYA_MUTED, fontSize: '10.5px' } }, live.writes > 0 ? 'a live write happened in this session' : 'nothing was written to a live target')),
    React.createElement('div', null,
      React.createElement('div', { style: ARYA_EYEBROW }, 'Last tool'),
      React.createElement('div', { style: { fontSize: '13px', fontWeight: 600, color: ARYA_THEME.text, fontFamily: ARYA_FONT_MONO, overflow: 'hidden', textOverflow: 'ellipsis' } },
        view.last === null || view.last === undefined ? '—' : view.last.name),
      React.createElement('div', { style: { ...ARYA_MUTED, fontSize: '10.5px' } },
        view.last === null || view.last === undefined ? 'no engineering call yet' : view.last.ok ? 'succeeded' : 'failed')))

  const body = hasActivity
    ? React.createElement('div', { style: { display: 'grid', gap: '12px' } }, stageStrip, artifactCard, checkCard, outcome)
    : React.createElement('div', { style: { ...ARYA_CARD, padding: '26px 20px', textAlign: 'center' } },
      React.createElement('div', { style: { ...ARYA_TITLE, marginBottom: '6px' } }, 'No engineering activity yet'),
      React.createElement('p', { style: { ...ARYA_MUTED, fontSize: '12.5px', maxWidth: '460px', margin: '0 auto' } },
        'Open an L5X, a FactoryTalk View ME application, a MotionWorks project or an Optix project and the five steps of the loop will fill in here: what was read, what was checked, what was written, what was verified, and what is still a human step.'))

  return React.createElement('div', { style: { padding: '14px 4px 6px', maxWidth: '1080px' } }, header, body)
}

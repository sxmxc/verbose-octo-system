const runtime = globalThis.__SRE_TOOLKIT_RUNTIME
if (!runtime) {
  throw new Error('SRE Toolkit runtime not found on global scope')
}

const React = runtime.react
const ReactRouterDom = runtime.reactRouterDom
const apiFetch = runtime.apiFetch

if (!React || !ReactRouterDom || !apiFetch) {
  throw new Error('SRE Toolkit runtime is missing required dependencies')
}

const { useState, useCallback } = React
const { NavLink, Navigate, Route, Routes } = ReactRouterDom

const flagOptions = ['IGNORECASE', 'MULTILINE', 'DOTALL', 'VERBOSE', 'UNICODE', 'ASCII']

const layoutStyles = {
  wrapper: {
    background: 'var(--color-surface)',
    borderRadius: 12,
    boxShadow: 'var(--color-shadow)',
    border: '1px solid var(--color-border)',
    padding: '1.5rem',
    display: 'grid',
    gap: '1.5rem',
  },
  navLink: (active) => ({
    padding: '0.5rem 0.9rem',
    borderRadius: 8,
    border: '1px solid var(--color-border)',
    background: active ? 'var(--color-accent)' : 'transparent',
    color: active ? 'var(--color-sidebar-item-active-text)' : 'var(--color-link)',
    fontWeight: 600,
    textDecoration: 'none',
  }),
}

const sectionStyle = {
  border: '1px solid var(--color-border)',
  borderRadius: 10,
  padding: '1.25rem',
  background: 'var(--color-surface-alt)',
  display: 'grid',
  gap: '0.75rem',
}

const matchCardStyle = {
  background: 'var(--color-surface)',
  borderRadius: 10,
  border: '1px solid var(--color-border)',
  padding: '0.85rem 1rem',
}

function Field(props) {
  return React.createElement(
    'label',
    { className: 'tk-label', style: { display: 'grid', gap: '0.3rem', fontSize: '0.9rem' } },
    props.label,
    props.children
  )
}

function MatchCard(props) {
  const match = props.match
  const index = props.index
  return React.createElement(
    'div',
    { style: matchCardStyle },
    React.createElement(
      'div',
      null,
      React.createElement('strong', null, `#${index + 1}`),
      ' – ',
      match.match,
      ' (',
      match.start,
      '–',
      match.end,
      ')'
    ),
    match.groups && match.groups.length > 0
      ? React.createElement(
          'div',
          { style: { marginTop: '0.4rem', fontSize: '0.9rem' } },
          React.createElement('strong', null, 'Groups:'),
          ' ',
          match.groups.map((group, idx) =>
            React.createElement(
              'span',
              { key: `group-${idx}`, style: { marginRight: '0.5rem' } },
              '#',
              idx + 1,
              ': ',
              group ?? '∅'
            )
          )
        )
      : null,
    match.groupdict && Object.keys(match.groupdict).length > 0
      ? React.createElement(
          'div',
          { style: { marginTop: '0.4rem', fontSize: '0.9rem' } },
          React.createElement('strong', null, 'Named groups:'),
          ' ',
          Object.entries(match.groupdict).map(([key, value]) =>
            React.createElement(
              'span',
              { key: key, style: { marginRight: '0.5rem' } },
              key,
              ': ',
              value ?? '∅'
            )
          )
        )
      : null
  )
}

function RegexResult(props) {
  const result = props.result
  if (!result.ok) {
    return React.createElement(
      'section',
      { style: sectionStyle },
      React.createElement('h4', { style: { marginTop: 0 } }, 'Result'),
      React.createElement('p', { style: { color: 'var(--color-danger-border)' } }, result.error)
    )
  }

  if (!result.matches || result.matches.length === 0) {
    return React.createElement(
      'section',
      { style: sectionStyle },
      React.createElement('h4', { style: { marginTop: 0 } }, 'Result'),
      React.createElement('p', null, 'No matches found.')
    )
  }

  return React.createElement(
    'section',
    { style: sectionStyle },
    React.createElement('h4', { style: { marginTop: 0 } }, 'Matches'),
    React.createElement(
      'div',
      { style: { display: 'grid', gap: '0.75rem' } },
      result.matches.map((match, idx) =>
        React.createElement(MatchCard, { key: `match-${idx}`, match, index: idx })
      )
    )
  )
}

function RegexTesterPage() {
  const [pattern, setPattern] = useState('^host-(?P<id>\\d+)$')
  const [testString, setTestString] = useState('host-01\nhost-abc\nhost-22')
  const [flags, setFlags] = useState(['MULTILINE'])
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const toggleFlag = useCallback((flag) => {
    setFlags((prev) => (prev.includes(flag) ? prev.filter((item) => item !== flag) : [...prev, flag]))
  }, [])

  const submit = useCallback(
    async (event) => {
      event.preventDefault()
      setError(null)
      setLoading(true)
      try {
        const response = await apiFetch('/toolkits/regex/test', {
          method: 'POST',
          body: JSON.stringify({ pattern, test_string: testString, flags }),
        })
        setResult(response)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    },
    [pattern, testString, flags]
  )

  return React.createElement(
    'div',
    { style: { display: 'grid', gap: '1.5rem' } },
    React.createElement(
      'form',
      { onSubmit: submit, style: sectionStyle },
      React.createElement('h4', { style: { marginTop: 0 } }, 'Evaluate expression'),
      React.createElement(
        Field,
        { label: 'Pattern' },
        React.createElement('input', {
          className: 'tk-input',
          value: pattern,
          onChange: (event) => setPattern(event.target.value),
          required: true,
        })
      ),
      React.createElement(
        Field,
        { label: 'Test string' },
        React.createElement('textarea', {
          className: 'tk-input',
          value: testString,
          onChange: (event) => setTestString(event.target.value),
          rows: 6,
          required: true,
        })
      ),
      React.createElement(
        'fieldset',
        { className: 'tk-fieldset' },
        React.createElement('legend', { className: 'tk-legend' }, 'Flags'),
        React.createElement(
          'div',
          { style: { display: 'flex', flexWrap: 'wrap', gap: '0.75rem' } },
          flagOptions.map((flag) =>
            React.createElement(
              'label',
              { key: flag, style: { display: 'flex', gap: '0.4rem', alignItems: 'center' } },
              React.createElement('input', {
                type: 'checkbox',
                checked: flags.includes(flag),
                onChange: () => toggleFlag(flag),
              }),
              flag
            )
          )
        )
      ),
      React.createElement(
        'button',
        {
          type: 'submit',
          className: 'tk-button tk-button--primary',
          style: { width: 'fit-content' },
          disabled: loading,
        },
        loading ? 'Evaluating…' : 'Evaluate'
      )
    ),
    error ? React.createElement('p', { style: { color: 'var(--color-danger-border)' } }, error) : null,
    result ? React.createElement(RegexResult, { result }) : null
  )
}

export default function RegexToolkitLayout() {
  return React.createElement(
    'div',
    { style: layoutStyles.wrapper },
    React.createElement(
      'header',
      null,
      React.createElement('h3', { style: { margin: 0 } }, 'Regex Toolkit'),
      React.createElement(
        'p',
        { style: { margin: '0.3rem 0 0', color: 'var(--color-text-secondary)' } },
        'Evaluate expressions, toggle flags, and inspect capture groups.'
      ),
      React.createElement(
        'aside',
        {
          style: {
            marginTop: '0.75rem',
            padding: '0.75rem 1rem',
            borderRadius: 10,
            border: '1px solid var(--color-warning-border)',
            background: 'var(--color-warning-bg)',
            color: 'var(--color-warning-text)',
            fontSize: '0.9rem',
            lineHeight: 1.45,
          },
        },
        React.createElement('strong', null, 'Named groups:'),
        ' patterns run on Python\'s ',
        React.createElement('code', null, 're'),
        ' engine. Use ',
        React.createElement('code', null, '(?P<name>...)'),
        ' for named captures—the JavaScript-style ',
        React.createElement('code', null, '(?<name>...)'),
        ' syntax is not supported.'
      )
    ),
    React.createElement(
      'nav',
      { style: { display: 'flex', gap: '0.5rem' } },
      React.createElement(
        NavLink,
        { end: true, to: '', style: ({ isActive }) => layoutStyles.navLink(isActive) },
        'Playground'
      )
    ),
    React.createElement(
      'section',
      null,
      React.createElement(
        Routes,
        null,
        React.createElement(Route, { index: true, element: React.createElement(RegexTesterPage) }),
        React.createElement(Route, {
          path: '*',
          element: React.createElement(Navigate, { to: '.', replace: true }),
        })
      )
    )
  )
}

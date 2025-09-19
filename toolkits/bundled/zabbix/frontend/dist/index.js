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

const {
  useState,
  useEffect,
  useMemo,
  useCallback,
} = React

const { NavLink, Navigate, Route, Routes } = ReactRouterDom

const layoutStyles = {
  wrapper: {
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
    padding: '1.5rem',
    display: 'grid',
    gap: '1.5rem',
  },
  nav: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  navLink: (active) => ({
    padding: '0.5rem 0.9rem',
    borderRadius: 8,
    border: '1px solid #0ea5e9',
    background: active ? '#0ea5e9' : 'transparent',
    color: active ? '#0f172a' : '#0ea5e9',
    fontWeight: 600,
    textDecoration: 'none',
  }),
}

const sectionStyle = {
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  padding: '1.25rem',
  background: '#f8fafc',
  display: 'grid',
  gap: '0.75rem',
}

const rowCardStyle = {
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  padding: '1rem',
  background: '#f8fafc',
  display: 'grid',
  gap: '0.75rem',
}

const resultStyle = {
  background: '#fff',
  padding: '0.75rem 1rem',
  borderRadius: 8,
  fontSize: '0.85rem',
  fontFamily: 'Source Code Pro, monospace',
  marginTop: '0.4rem',
  overflowX: 'auto',
}

const instanceCardStyle = {
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  padding: '0.9rem 1.1rem',
  background: '#f8fafc',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}

const initialBulkRow = () => ({
  host: 'demo-host-1',
  ip: '10.0.0.10',
  groups: '',
  templates: '',
  macros: '',
})

const splitCsv = (value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const parseKeyValue = (value) => {
  const result = {}
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const [key, ...rest] = line.split('=')
      if (!key) return
      result[key.trim()] = rest.join('=').trim()
    })
  return result
}

function Field(props) {
  return React.createElement(
    'label',
    { className: 'tk-label', style: { display: 'grid', gap: '0.3rem', fontSize: '0.9rem' } },
    props.label,
    props.children
  )
}

function ZabbixBulkHostsPage() {
  const [instances, setInstances] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [hostRows, setHostRows] = useState([initialBulkRow()])
  const [resultText, setResultText] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadInstances = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch('/toolkits/zabbix/instances')
      setInstances(data)
      if (data.length > 0) {
        setSelectedId((prev) => prev || data[0].id)
      }
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadInstances()
  }, [loadInstances])

  const selectedInstance = useMemo(
    () => instances.find((instance) => instance.id === selectedId) || null,
    [instances, selectedId]
  )

  const updateHostRow = (index, field, value) => {
    setHostRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))
  }

  const addHostRow = () => setHostRows((prev) => [...prev, initialBulkRow()])

  const removeHostRow = (index) => setHostRows((prev) => prev.filter((_, idx) => idx !== index))

  const buildRowsPayload = () =>
    hostRows.map((row) => ({
      host: row.host,
      ip: row.ip,
      groups: splitCsv(row.groups),
      templates: splitCsv(row.templates),
      macros: parseKeyValue(row.macros),
    }))

  const performDryRun = async () => {
    if (!selectedInstance) {
      setFeedback('Select an instance first.')
      return
    }
    setFeedback(null)
    try {
      const payload = { rows: buildRowsPayload(), dry_run: true }
      const response = await apiFetch(`/toolkits/zabbix/instances/${selectedInstance.id}/actions/bulk-add-hosts/dry-run`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setResultText(JSON.stringify(response, null, 2))
    } catch (err) {
      setResultText(err instanceof Error ? err.message : String(err))
    }
  }

  const performExecute = async () => {
    if (!selectedInstance) {
      setFeedback('Select an instance first.')
      return
    }
    setFeedback(null)
    try {
      const payload = { rows: buildRowsPayload(), dry_run: false }
      const response = await apiFetch(`/toolkits/zabbix/instances/${selectedInstance.id}/actions/bulk-add-hosts/execute`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setResultText(`Job queued with id ${response.job.id}`)
    } catch (err) {
      setResultText(err instanceof Error ? err.message : String(err))
    }
  }

  return React.createElement(
    'div',
    { style: { display: 'grid', gap: '1.5rem' } },
    React.createElement(
      'section',
      { style: sectionStyle },
      React.createElement('h4', { style: { marginTop: 0 } }, 'Bulk host creation'),
      React.createElement(
        'p',
        { style: { margin: '0.25rem 0 1rem', color: '#64748b' } },
        'Compose host rows, preview via dry run, or enqueue a job for asynchronous execution.'
      ),
      loading ? React.createElement('p', null, 'Loading instances…') : null,
      !loading && instances.length === 0
        ? React.createElement('p', null, 'Add an instance in Settings before running actions.')
        : null,
      instances.length > 0
        ? React.createElement(
            'div',
            { style: { display: 'grid', gap: '1.25rem' } },
            React.createElement(
              'label',
              {
                className: 'tk-label',
                style: { display: 'grid', gap: '0.3rem', fontSize: '0.9rem', maxWidth: 320 },
              },
              'Target instance',
              React.createElement(
                'select',
                {
                  className: 'tk-input',
                  value: selectedId,
                  onChange: (event) => setSelectedId(event.target.value),
                },
                instances.map((instance) =>
                  React.createElement(
                    'option',
                    { value: instance.id, key: instance.id },
                    instance.name
                  )
                )
              )
            ),
            React.createElement(
              'div',
              { style: { display: 'grid', gap: '0.75rem' } },
              hostRows.map((row, idx) =>
                React.createElement(
                  'div',
                  { key: `row-${idx}`, style: rowCardStyle },
                  React.createElement(
                    'div',
                    { style: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' } },
                    React.createElement(
                      Field,
                      { label: 'Host' },
                      React.createElement('input', {
                        className: 'tk-input',
                        value: row.host,
                        onChange: (event) => updateHostRow(idx, 'host', event.target.value),
                      })
                    ),
                    React.createElement(
                      Field,
                      { label: 'IP' },
                      React.createElement('input', {
                        className: 'tk-input',
                        value: row.ip,
                        onChange: (event) => updateHostRow(idx, 'ip', event.target.value),
                      })
                    )
                  ),
                  React.createElement(
                    Field,
                    { label: 'Groups (comma separated)' },
                    React.createElement('input', {
                      className: 'tk-input',
                      value: row.groups,
                      onChange: (event) => updateHostRow(idx, 'groups', event.target.value),
                    })
                  ),
                  React.createElement(
                    Field,
                    { label: 'Templates (comma separated)' },
                    React.createElement('input', {
                      className: 'tk-input',
                      value: row.templates,
                      onChange: (event) => updateHostRow(idx, 'templates', event.target.value),
                    })
                  ),
                  React.createElement(
                    Field,
                    { label: 'Macros (key=value per line)' },
                    React.createElement('textarea', {
                      className: 'tk-input',
                      value: row.macros,
                      rows: 2,
                      onChange: (event) => updateHostRow(idx, 'macros', event.target.value),
                    })
                  ),
                  hostRows.length > 1
                    ? React.createElement(
                        'button',
                        {
                          type: 'button',
                          onClick: () => removeHostRow(idx),
                          className: 'tk-button tk-button--danger',
                          style: { width: 'fit-content', background: '#fee2e2', border: '1px solid #f87171' },
                        },
                        'Remove host'
                      )
                    : null
                )
              ),
              React.createElement(
                'button',
                {
                  type: 'button',
                  onClick: addHostRow,
                  className: 'tk-button',
                  style: { width: 'fit-content' },
                },
                'Add host'
              )
            ),
            React.createElement(
              'div',
              { style: { display: 'flex', gap: '0.75rem' } },
              React.createElement(
                'button',
                { type: 'button', onClick: performDryRun, className: 'tk-button' },
                'Dry run'
              ),
              React.createElement(
                'button',
                { type: 'button', onClick: performExecute, className: 'tk-button tk-button--primary' },
                'Execute'
              )
            ),
            feedback ? React.createElement('p', { style: { color: '#0284c7' } }, feedback) : null
          )
        : null
    ),
    resultText
      ? React.createElement(
          'section',
          { style: sectionStyle },
          React.createElement('h4', { style: { marginTop: 0 } }, 'Result'),
          React.createElement('pre', { style: resultStyle }, resultText)
        )
      : null
  )
}

function ZabbixOverviewPage() {
  const [instances, setInstances] = useState([])
  const [recentJobs, setRecentJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [instancesRes, jobsRes] = await Promise.all([
          apiFetch('/toolkits/zabbix/instances'),
          apiFetch('/jobs?toolkit=zabbix'),
        ])
        if (!cancelled) {
          setInstances(instancesRes)
          const jobs = Array.isArray(jobsRes?.jobs) ? jobsRes.jobs : []
          setRecentJobs(jobs.slice(0, 5))
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return React.createElement(
    'div',
    { style: { display: 'grid', gap: '1.5rem' } },
    loading ? React.createElement('p', null, 'Loading overview…') : null,
    error ? React.createElement('p', { style: { color: '#dc2626' } }, error) : null,
    React.createElement(
      'section',
      null,
      React.createElement('h4', { style: { margin: 0 } }, 'Configured Instances'),
      React.createElement(
        'p',
        { style: { margin: '0.25rem 0 1rem', color: '#64748b' } },
        `${instances.length} active instance${instances.length === 1 ? '' : 's'}.`
      ),
      instances.length === 0
        ? React.createElement('p', null, 'No instances defined. Add one in the Settings tab.')
        : React.createElement(
            'ul',
            { style: { listStyle: 'none', padding: 0, display: 'grid', gap: '0.75rem' } },
            instances.map((instance) =>
              React.createElement(
                'li',
                { key: instance.id, style: instanceCardStyle },
                React.createElement(
                  'div',
                  null,
                  React.createElement('strong', null, instance.name),
                  React.createElement(
                    'div',
                    { style: { color: '#64748b', fontSize: '0.85rem' } },
                    instance.base_url
                  )
                ),
                React.createElement(
                  'div',
                  { style: { textAlign: 'right', fontSize: '0.8rem', color: '#64748b' } },
                  React.createElement(
                    'div',
                    null,
                    'Created: ',
                    instance.created_at ? new Date(instance.created_at).toLocaleString() : '—'
                  ),
                  React.createElement(
                    'div',
                    null,
                    'Updated: ',
                    instance.updated_at ? new Date(instance.updated_at).toLocaleString() : '—'
                  )
                )
              )
            )
          )
    ),
    React.createElement(
      'section',
      null,
      React.createElement('h4', { style: { margin: 0 } }, 'Recent Jobs'),
      React.createElement(
        'p',
        { style: { margin: '0.25rem 0 1rem', color: '#64748b' } },
        'Last 5 Zabbix job executions.'
      ),
      recentJobs.length === 0
        ? React.createElement('p', null, 'No recent jobs.')
        : React.createElement(
            'table',
            { style: { width: '100%', borderCollapse: 'collapse' } },
            React.createElement(
              'thead',
              null,
              React.createElement(
                'tr',
                { style: { textAlign: 'left', background: '#f8fafc' } },
                React.createElement('th', { style: { padding: '0.5rem' } }, 'Operation'),
                React.createElement('th', null, 'Status'),
                React.createElement('th', null, 'Progress'),
                React.createElement('th', null, 'Updated')
              )
            ),
            React.createElement(
              'tbody',
              null,
              recentJobs.map((job) =>
                React.createElement(
                  'tr',
                  { key: job.id, style: { borderTop: '1px solid #e2e8f0' } },
                  React.createElement('td', { style: { padding: '0.5rem' } }, job.operation),
                  React.createElement('td', { style: { textTransform: 'capitalize' } }, job.status),
                  React.createElement('td', null, `${job.progress}%`),
                  React.createElement(
                    'td',
                    null,
                    job.updated_at ? new Date(job.updated_at).toLocaleString() : '—'
                  )
                )
              )
            )
          )
    )
  )
}

function ZabbixAdministrationPage() {
  const [instances, setInstances] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [createForm, setCreateForm] = useState({ name: '', base_url: '', token: '', verify_tls: true, description: '' })
  const [editForm, setEditForm] = useState({ name: '', base_url: '', token: '', verify_tls: true, description: '' })
  const [feedback, setFeedback] = useState(null)
  const [error, setError] = useState(null)
  const [actionOutput, setActionOutput] = useState('')
  const [busy, setBusy] = useState(false)

  const loadInstances = useCallback(async () => {
    setError(null)
    try {
      const response = await apiFetch('/toolkits/zabbix/instances')
      setInstances(response)
      if (response.length > 0 && !selectedId) {
        setSelectedId(response[0].id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [selectedId])

  useEffect(() => {
    loadInstances()
  }, [loadInstances])

  const selectedInstance = useMemo(
    () => instances.find((instance) => instance.id === selectedId) || null,
    [instances, selectedId]
  )

  useEffect(() => {
    if (selectedInstance) {
      setEditForm({
        name: selectedInstance.name,
        base_url: selectedInstance.base_url,
        token: '',
        verify_tls: selectedInstance.verify_tls,
        description: selectedInstance.description || '',
      })
    } else {
      setEditForm({ name: '', base_url: '', token: '', verify_tls: true, description: '' })
    }
  }, [selectedInstance])

  const handleCreateChange = (event) => {
    const { name, value, type, checked } = event.target
    setCreateForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleEditChange = (event) => {
    const { name, value, type, checked } = event.target
    setEditForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const createInstance = async (event) => {
    event.preventDefault()
    setFeedback(null)
    setActionOutput('')
    setBusy(true)
    try {
      if (!createForm.name || !createForm.base_url || !createForm.token) {
        throw new Error('Name, base URL, and token are required.')
      }
      const payload = {
        name: createForm.name,
        base_url: createForm.base_url,
        token: createForm.token,
        verify_tls: createForm.verify_tls,
        description: createForm.description || undefined,
      }
      const created = await apiFetch('/toolkits/zabbix/instances', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setFeedback(`Instance "${created.name}" created.`)
      setCreateForm({ name: '', base_url: '', token: '', verify_tls: true, description: '' })
      setSelectedId(created.id)
      await loadInstances()
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const updateInstance = async (event) => {
    event.preventDefault()
    if (!selectedInstance) return
    setFeedback(null)
    setActionOutput('')
    setBusy(true)
    try {
      const payload = {
        name: editForm.name,
        base_url: editForm.base_url,
        verify_tls: editForm.verify_tls,
        description: editForm.description,
      }
      if (editForm.token.trim()) {
        payload.token = editForm.token.trim()
      }
      const updated = await apiFetch(`/toolkits/zabbix/instances/${selectedInstance.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      setFeedback(`Instance "${updated.name}" updated.`)
      setEditForm((prev) => ({ ...prev, token: '' }))
      await loadInstances()
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const deleteInstance = async () => {
    if (!selectedInstance) return
    if (!globalThis.confirm || !globalThis.confirm(`Delete instance "${selectedInstance.name}"?`)) {
      return
    }
    setBusy(true)
    setFeedback(null)
    setActionOutput('')
    try {
      await apiFetch(`/toolkits/zabbix/instances/${selectedInstance.id}`, {
        method: 'DELETE',
        skipJson: true,
      })
      setFeedback(`Instance "${selectedInstance.name}" deleted.`)
      setSelectedId(null)
      await loadInstances()
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const testInstance = async () => {
    if (!selectedInstance) return
    setActionOutput('Testing connection…')
    try {
      const response = await apiFetch(`/toolkits/zabbix/instances/${selectedInstance.id}/test`, {
        method: 'POST',
      })
      setActionOutput(response.ok ? `OK — version ${response.version}` : `Failed: ${response.error}`)
    } catch (err) {
      setActionOutput(err instanceof Error ? err.message : String(err))
    }
  }

  return React.createElement(
    'div',
    { style: { display: 'grid', gap: '1.5rem' } },
    React.createElement(
      'section',
      { style: sectionStyle },
      React.createElement('h4', { style: { marginTop: 0 } }, 'Instance registry'),
      error ? React.createElement('p', { style: { color: '#dc2626' } }, error) : null,
      React.createElement(
        'div',
        { style: { display: 'flex', gap: '1rem', flexWrap: 'wrap' } },
        React.createElement(
          'div',
          { style: { flex: '1 1 240px' } },
          React.createElement('h5', { style: { margin: '0 0 0.5rem' } }, 'Registered'),
          instances.length === 0 ? React.createElement('p', null, 'No instances yet.') : null,
          React.createElement(
            'ul',
            {
              style: {
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'grid',
                gap: '0.5rem',
              },
            },
            instances.map((instance) =>
              React.createElement(
                'li',
                { key: instance.id },
                React.createElement(
                  'button',
                  {
                    onClick: () => setSelectedId(instance.id),
                    style: {
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.75rem 1rem',
                      borderRadius: 8,
                      border: '1px solid',
                      borderColor: selectedId === instance.id ? '#0ea5e9' : '#e2e8f0',
                      background: selectedId === instance.id ? '#f0f9ff' : '#fff',
                    },
                  },
                  React.createElement('strong', null, instance.name),
                  React.createElement(
                    'div',
                    { style: { fontSize: '0.8rem', color: '#64748b' } },
                    instance.base_url
                  )
                )
              )
            )
          )
        ),
        React.createElement(
          'form',
          { style: { flex: '1 1 320px' }, onSubmit: createInstance },
          React.createElement('h5', { style: { margin: '0 0 0.5rem' } }, 'Add instance'),
          React.createElement(
            Field,
            { label: 'Name' },
            React.createElement('input', {
              className: 'tk-input',
              name: 'name',
              value: createForm.name,
              onChange: handleCreateChange,
              required: true,
            })
          ),
          React.createElement(
            Field,
            { label: 'Base URL' },
            React.createElement('input', {
              className: 'tk-input',
              name: 'base_url',
              value: createForm.base_url,
              onChange: handleCreateChange,
              placeholder: 'https://zabbix.example.com',
              required: true,
            })
          ),
          React.createElement(
            Field,
            { label: 'API Token' },
            React.createElement('input', {
              className: 'tk-input',
              name: 'token',
              value: createForm.token,
              onChange: handleCreateChange,
              required: true,
            })
          ),
          React.createElement(
            Field,
            { label: 'Description' },
            React.createElement('textarea', {
              className: 'tk-input',
              name: 'description',
              value: createForm.description,
              onChange: handleCreateChange,
              rows: 2,
            })
          ),
          React.createElement(
            'label',
            { style: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' } },
            React.createElement('input', {
              type: 'checkbox',
              name: 'verify_tls',
              checked: createForm.verify_tls,
              onChange: handleCreateChange,
            }),
            'Verify TLS certificates'
          ),
          React.createElement(
            'button',
            {
              type: 'submit',
              className: 'tk-button tk-button--primary',
              style: { marginTop: '1rem' },
              disabled: busy,
            },
            'Create'
          )
        )
      ),
      feedback ? React.createElement('p', { style: { marginTop: '1rem', color: '#0284c7' } }, feedback) : null
    ),
    selectedInstance
      ? React.createElement(
          'section',
          { style: sectionStyle },
          React.createElement(
            'div',
            { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
            React.createElement(
              'div',
              null,
              React.createElement('h4', { style: { margin: 0 } }, selectedInstance.name),
              React.createElement(
                'p',
                { style: { margin: '0.3rem 0 0', color: '#64748b' } },
                selectedInstance.base_url
              )
            ),
          React.createElement(
            'button',
            {
              onClick: deleteInstance,
              disabled: busy,
              className: 'tk-button tk-button--danger',
              style: { background: '#fee2e2', border: '1px solid #f87171' },
            },
            'Delete'
          )
        ),
          React.createElement('h5', { style: { margin: '1rem 0 0.5rem' } }, 'Instance configuration'),
          React.createElement(
            'form',
            { style: { display: 'grid', gap: '0.75rem', maxWidth: 420 }, onSubmit: updateInstance },
            React.createElement(
              Field,
              { label: 'Name' },
              React.createElement('input', {
                className: 'tk-input',
                name: 'name',
                value: editForm.name,
                onChange: handleEditChange,
                required: true,
              })
            ),
            React.createElement(
              Field,
              { label: 'Base URL' },
              React.createElement('input', {
                className: 'tk-input',
                name: 'base_url',
                value: editForm.base_url,
                onChange: handleEditChange,
                required: true,
              })
            ),
            React.createElement(
              Field,
              { label: 'Description' },
              React.createElement('textarea', {
                className: 'tk-input',
                name: 'description',
                value: editForm.description,
                onChange: handleEditChange,
                rows: 2,
              })
            ),
            React.createElement(
              Field,
              { label: 'Update token (optional)' },
              React.createElement('input', {
                className: 'tk-input',
                name: 'token',
                value: editForm.token,
                onChange: handleEditChange,
                placeholder: 'Leave blank to keep',
              })
            ),
            React.createElement(
              'label',
              { style: { display: 'flex', alignItems: 'center', gap: '0.5rem' } },
              React.createElement('input', {
                type: 'checkbox',
                name: 'verify_tls',
                checked: editForm.verify_tls,
                onChange: handleEditChange,
              }),
              'Verify TLS certificates'
            ),
            React.createElement(
              'button',
              {
                type: 'submit',
                className: 'tk-button tk-button--primary',
                style: { width: 'fit-content' },
                disabled: busy,
              },
              'Save changes'
            )
          ),
          React.createElement(
            'div',
            { style: { marginTop: '1.5rem', display: 'flex', gap: '0.75rem' } },
            React.createElement(
              'button',
              { type: 'button', onClick: testInstance, disabled: busy, className: 'tk-button' },
              'Test connection'
            )
          ),
          actionOutput
            ? React.createElement(
                'div',
                { style: { marginTop: '1.25rem' } },
                React.createElement('strong', null, 'Result'),
                React.createElement('pre', { style: resultStyle }, actionOutput)
              )
            : null
        )
      : null
  )
}

const subNav = [
  { label: 'Overview', to: '' },
  { label: 'Administration', to: 'administration' },
  { label: 'Bulk Host Actions', to: 'actions/bulk-hosts' },
]

export default function ZabbixToolkitLayout() {
  return React.createElement(
    'div',
    { style: layoutStyles.wrapper },
    React.createElement(
      'header',
      null,
      React.createElement('h3', { style: { margin: 0 } }, 'Zabbix Toolkit'),
      React.createElement(
        'p',
        { style: { margin: '0.3rem 0 0', color: '#64748b' } },
        'Manage Zabbix API endpoints, toolkit settings, and automation actions.'
      )
    ),
    React.createElement(
      'nav',
      { style: layoutStyles.nav },
      subNav.map((item) =>
        React.createElement(
          NavLink,
          {
            key: item.label,
            to: item.to,
            end: item.to === '',
            style: ({ isActive }) => layoutStyles.navLink(isActive),
          },
          item.label
        )
      )
    ),
    React.createElement(
      'section',
      null,
      React.createElement(
        Routes,
        null,
        React.createElement(Route, { index: true, element: React.createElement(ZabbixOverviewPage) }),
        React.createElement(Route, {
          path: 'administration',
          element: React.createElement(ZabbixAdministrationPage),
        }),
        React.createElement(Route, {
          path: 'actions/bulk-hosts',
          element: React.createElement(ZabbixBulkHostsPage),
        }),
        React.createElement(Route, {
          path: '*',
          element: React.createElement(Navigate, { to: '.', replace: true }),
        })
      )
    )
  )
}

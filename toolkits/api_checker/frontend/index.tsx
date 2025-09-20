import type { ChangeEvent, CSSProperties } from 'react'

import { apiFetch, getReactRuntime } from './runtime'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
type BodyMode = 'none' | 'raw' | 'json'
type AuthType = 'none' | 'basic' | 'bearer' | 'apiKey'

type KeyValueRow = {
  id: string
  name: string
  value: string
  enabled: boolean
}

type KeyValuePayload = {
  name: string
  value: string
  enabled: boolean
}

type RequestBodyPayload = {
  mode: BodyMode
  content: string | null
  content_type: string | null
}

type AuthPayload = {
  type: AuthType
  username: string | null
  password: string | null
  token: string | null
  header_name: string | null
  header_value: string | null
}

type ApiRequestPayload = {
  method: HttpMethod
  url: string
  query_params: KeyValuePayload[]
  headers: KeyValuePayload[]
  body: RequestBodyPayload
  auth: AuthPayload
  follow_redirects: boolean
  timeout: number
}

type ResponseHeader = {
  name: string
  value: string
}

type ApiResponsePayload = {
  status_code: number
  reason_phrase: string | null
  http_version: string | null
  url: string
  method: HttpMethod
  duration_ms: number
  size_bytes: number
  content_type: string | null
  body: string
  body_truncated: boolean
  is_binary: boolean
  json_body: unknown
  headers: ResponseHeader[]
  request_headers: ResponseHeader[]
}

type HistoryEntry = {
  id: string
  startedAt: string
  request: ApiRequestPayload
  response?: ApiResponsePayload
  error?: string
}

const React = getReactRuntime()
const { useCallback, useEffect, useMemo, useState } = React

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
const RAW_CONTENT_TYPES = [
  'text/plain',
  'application/json',
  'application/xml',
  'application/x-www-form-urlencoded',
  'application/octet-stream',
]

const HISTORY_STORAGE_KEY = 'toolkits.api-checker.history.v1'
const MAX_HISTORY_ENTRIES = 25

const layoutStyles: Record<string, CSSProperties> = {
  wrapper: {
    display: 'grid',
    gap: '1.5rem',
    color: 'var(--color-text-primary)',
    padding: '1.5rem',
  },
  main: {
    display: 'grid',
    gap: '1.5rem',
    alignItems: 'flex-start',
  },
  split: {
    display: 'grid',
    gap: '1.5rem',
    alignItems: 'flex-start',
    gridTemplateColumns: 'minmax(0, 1fr)',
  },
  splitWide: {
    display: 'grid',
    gap: '1.5rem',
    alignItems: 'flex-start',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 340px)',
  },
  section: {
    background: 'var(--color-surface-alt)',
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    padding: '1.25rem',
    display: 'grid',
    gap: '0.9rem',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    fontSize: '1rem',
    margin: 0,
  },
  icon: {
    fontSize: '1.2rem',
    color: 'var(--color-link)',
    lineHeight: 1,
  },
  mutedText: {
    color: 'var(--color-text-secondary)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.95rem',
  },
  tableHeadCell: {
    textAlign: 'left',
    color: 'var(--color-text-secondary)',
    fontWeight: 500,
    paddingBottom: '0.35rem',
  },
  badge: {
    borderRadius: 999,
    padding: '0.15rem 0.5rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
  },
}

function uniqueId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`
}

function createRow(overrides: Partial<KeyValueRow> = {}): KeyValueRow {
  return {
    id: uniqueId('row'),
    name: '',
    value: '',
    enabled: true,
    ...overrides,
  }
}

function ensureTrailingBlank(rows: KeyValueRow[]): KeyValueRow[] {
  const filled = rows.filter((row) => row.name.trim() !== '' || row.value.trim() !== '')
  const blanks = rows.filter((row) => row.name.trim() === '' && row.value.trim() === '')
  const trailingBlank = blanks.length > 0 ? blanks[blanks.length - 1] : createRow()
  return [...filled, trailingBlank]
}

function toPayloadPairs(rows: KeyValueRow[]): KeyValuePayload[] {
  return rows
    .filter((row) => row.name.trim() !== '' || row.value.trim() !== '')
    .map((row) => ({
      name: row.name.trim(),
      value: row.value,
      enabled: row.enabled,
    }))
}

function rowsFromPayload(pairs: KeyValuePayload[]): KeyValueRow[] {
  if (!pairs.length) {
    return ensureTrailingBlank([createRow()])
  }
  const mapped = pairs.map((pair) =>
    createRow({
      name: pair.name,
      value: pair.value,
      enabled: pair.enabled,
    }),
  )
  return ensureTrailingBlank(mapped)
}

function cloneRequest(payload: ApiRequestPayload): ApiRequestPayload {
  return JSON.parse(JSON.stringify(payload)) as ApiRequestPayload
}

function cloneResponse(payload: ApiResponsePayload): ApiResponsePayload {
  return JSON.parse(JSON.stringify(payload)) as ApiResponsePayload
}

function formatDuration(durationMs: number) {
  if (Number.isNaN(durationMs)) {
    return '—'
  }
  if (durationMs >= 1000) {
    return `${(durationMs / 1000).toFixed(2)} s`
  }
  return `${durationMs.toFixed(1)} ms`
}

function formatSize(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`
  }
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
}

function statusTone(statusCode: number) {
  if (statusCode >= 500) {
    return { background: 'rgba(226, 67, 67, 0.18)', color: 'var(--color-danger-text)' }
  }
  if (statusCode >= 400) {
    return { background: 'rgba(255, 193, 7, 0.18)', color: '#c77700' }
  }
  if (statusCode >= 200) {
    return { background: 'rgba(72, 199, 142, 0.18)', color: '#1f8a53' }
  }
  return { background: 'var(--color-surface)', color: 'var(--color-text-secondary)' }
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
export default function ApiCheckerApp() {
  const [method, setMethod] = useState<HttpMethod>('GET')
  const [url, setUrl] = useState('')
  const [queryParams, setQueryParams] = useState<KeyValueRow[]>(() => ensureTrailingBlank([createRow()]))
  const [headers, setHeaders] = useState<KeyValueRow[]>(() => ensureTrailingBlank([createRow()]))
  const [bodyMode, setBodyMode] = useState<BodyMode>('none')
  const [bodyContent, setBodyContent] = useState('')
  const [rawContentType, setRawContentType] = useState('text/plain')
  const [authType, setAuthType] = useState<AuthType>('none')
  const [basicAuth, setBasicAuth] = useState({ username: '', password: '' })
  const [bearerToken, setBearerToken] = useState('')
  const [apiKeyAuth, setApiKeyAuth] = useState({ headerName: 'Authorization', headerValue: '' })
  const [followRedirects, setFollowRedirects] = useState(true)
  const [timeoutSeconds, setTimeoutSeconds] = useState(30)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [response, setResponse] = useState<ApiResponsePayload | null>(null)
  const [bodyError, setBodyError] = useState<string | null>(null)
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    if (typeof window === 'undefined') {
      return []
    }
    try {
      const stored = window.sessionStorage.getItem(HISTORY_STORAGE_KEY)
      if (!stored) {
        return []
      }
      const parsed = JSON.parse(stored)
      if (!Array.isArray(parsed)) {
        return []
      }
      const entries = parsed.slice(0, MAX_HISTORY_ENTRIES) as HistoryEntry[]
      return entries.map((entry) => ({
        ...entry,
        response: entry.response
          ? {
              ...entry.response,
              method: (entry.response as ApiResponsePayload).method || entry.request.method,
            }
          : undefined,
      }))
    } catch (err) {
      console.warn('Failed to restore API Checker history:', err)
      return []
    }
  })

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    try {
      window.sessionStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, MAX_HISTORY_ENTRIES)))
    } catch (err) {
      console.warn('Failed to persist API Checker history:', err)
    }
  }, [history])

  const methodSupportsBody = method !== 'GET' && method !== 'HEAD'

  useEffect(() => {
    if (!methodSupportsBody) {
      setBodyMode('none')
    }
  }, [methodSupportsBody])

  const buildRequestPayload = useCallback((): ApiRequestPayload => {
    const trimmedUrl = url.trim()
    const payload: ApiRequestPayload = {
      method,
      url: trimmedUrl,
      query_params: toPayloadPairs(queryParams),
      headers: toPayloadPairs(headers),
      body: {
        mode: bodyMode,
        content: bodyMode === 'none' ? null : bodyContent,
        content_type:
          bodyMode === 'json'
            ? 'application/json'
            : bodyMode === 'raw'
              ? rawContentType
              : null,
      },
      auth: {
        type: authType,
        username: authType === 'basic' ? basicAuth.username || null : null,
        password: authType === 'basic' ? basicAuth.password || null : null,
        token: authType === 'bearer' ? bearerToken || null : null,
        header_name: authType === 'apiKey' ? apiKeyAuth.headerName || null : null,
        header_value: authType === 'apiKey' ? apiKeyAuth.headerValue || null : null,
      },
      follow_redirects: followRedirects,
      timeout: timeoutSeconds,
    }
    return payload
  }, [
    method,
    url,
    queryParams,
    headers,
    bodyMode,
    bodyContent,
    rawContentType,
    authType,
    basicAuth.username,
    basicAuth.password,
    bearerToken,
    apiKeyAuth.headerName,
    apiKeyAuth.headerValue,
    followRedirects,
    timeoutSeconds,
  ])

  const handleSend = useCallback(async () => {
    if (sending) {
      return
    }
    const trimmedUrl = url.trim()
    if (!trimmedUrl) {
      setError('Provide a target URL to send the request.')
      return
    }
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      setError('Requests must start with http:// or https://.')
      return
    }
    setError(null)
    setBodyError(null)
    const payload = buildRequestPayload()
    const historyId = uniqueId('history')
    const startedAt = new Date().toISOString()
    const requestSnapshot = cloneRequest(payload)
    setHistory((prev) => {
      const next = [{ id: historyId, startedAt, request: requestSnapshot }, ...prev]
      return next.slice(0, MAX_HISTORY_ENTRIES)
    })
    setActiveHistoryId(historyId)
    setSending(true)
    try {
      const result = await apiFetch<ApiResponsePayload>('/toolkits/api-checker/requests', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setResponse(result)
      setHistory((prev) =>
        prev.map((entry) => (entry.id === historyId ? { ...entry, response: cloneResponse(result) } : entry)),
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Request failed.'
      setResponse(null)
      setError(message)
      setHistory((prev) =>
        prev.map((entry) => (entry.id === historyId ? { ...entry, error: message } : entry)),
      )
    } finally {
      setSending(false)
    }
  }, [buildRequestPayload, sending, url])

  const handleFormatJson = useCallback(() => {
    if (!bodyContent.trim()) {
      setBodyError('Add JSON content before formatting.')
      return
    }
    try {
      const parsed = JSON.parse(bodyContent)
      setBodyContent(JSON.stringify(parsed, null, 2))
      setBodyError(null)
    } catch (err) {
      setBodyError(err instanceof Error ? err.message : 'Unable to format JSON payload.')
    }
  }, [bodyContent])

  const selectHistoryEntry = useCallback(
    (entry: HistoryEntry) => {
      setActiveHistoryId(entry.id)
      setMethod(entry.request.method)
      setUrl(entry.request.url)
      setQueryParams(rowsFromPayload(entry.request.query_params))
      setHeaders(rowsFromPayload(entry.request.headers))
      setBodyMode(entry.request.body.mode)
      setBodyContent(entry.request.body.content ?? '')
      if (entry.request.body.mode === 'raw' && entry.request.body.content_type) {
        setRawContentType(entry.request.body.content_type)
      }
      setAuthType(entry.request.auth.type)
      setBasicAuth({
        username: entry.request.auth.username ?? '',
        password: entry.request.auth.password ?? '',
      })
      setBearerToken(entry.request.auth.token ?? '')
      setApiKeyAuth({
        headerName: entry.request.auth.header_name ?? 'Authorization',
        headerValue: entry.request.auth.header_value ?? '',
      })
      setFollowRedirects(entry.request.follow_redirects)
      setTimeoutSeconds(entry.request.timeout)
      setResponse(entry.response ? cloneResponse({ ...entry.response, method: entry.response.method || entry.request.method }) : null)
      setError(entry.error ?? null)
    },
    [],
  )

  const clearHistory = useCallback(() => {
    setHistory([])
    setActiveHistoryId(null)
  }, [])

  const requestSummary = useMemo(() => {
    return `${method} ${url || '—'}`
  }, [method, url])

  const requestBuilderSplitStyle = useMemo(() => {
    if (history.length === 0) {
      return layoutStyles.split
    }
    return layoutStyles.splitWide
  }, [history.length])

  return (
    <div className="tk-card" style={layoutStyles.wrapper}>
      <header style={{ display: 'grid', gap: '0.35rem' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <span className="material-symbols-outlined" style={layoutStyles.icon} aria-hidden>
            api
          </span>
          API Checker
        </h3>
        <p style={{ ...layoutStyles.mutedText, margin: 0 }}>
          Compose HTTP requests, inspect responses, and replay calls with history — all inside the toolbox shell.
        </p>
        <div style={{ ...layoutStyles.mutedText, fontSize: '0.9rem' }}>{requestSummary}</div>
      </header>

      <div style={requestBuilderSplitStyle}>
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          <section style={{ ...layoutStyles.section, gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label className="tk-label" style={{ display: 'grid', gap: '0.35rem', minWidth: 120 }}>
                Method
                <select
                  className="tk-select"
                  value={method}
                  onChange={(event) => setMethod(event.target.value as HttpMethod)}
                  style={{ minWidth: 120 }}
                >
                  {HTTP_METHODS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="tk-label" style={{ flex: 1, display: 'grid', gap: '0.35rem', minWidth: 220 }}>
                Request URL
                <input
                  className="tk-input"
                  placeholder="https://api.example.com/v1/resources"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="tk-button tk-button--primary"
                onClick={handleSend}
                disabled={sending}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', height: 40 }}
              >
                <span className="material-symbols-outlined" aria-hidden>
                  play_arrow
                </span>
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
            {error && <p style={{ color: 'var(--color-danger-text)', margin: 0 }}>{error}</p>}
          </section>

          <section style={layoutStyles.section}>
            <div style={layoutStyles.sectionHeader}>
              <h4 style={layoutStyles.sectionTitle}>
                <span className="material-symbols-outlined" style={layoutStyles.icon} aria-hidden>
                  tune
                </span>
                Query parameters
              </h4>
              <button
                type="button"
                className="tk-button tk-button--ghost"
                onClick={() => setQueryParams((rows) => ensureTrailingBlank([...rows, createRow()]))}
              >
                Add row
              </button>
            </div>
            <KeyValueEditor rows={queryParams} onRowsChange={setQueryParams} namePlaceholder="name" valuePlaceholder="value" />
          </section>

          <section style={layoutStyles.section}>
            <div style={layoutStyles.sectionHeader}>
              <h4 style={layoutStyles.sectionTitle}>
                <span className="material-symbols-outlined" style={layoutStyles.icon} aria-hidden>
                  mail
                </span>
                Headers
              </h4>
              <button
                type="button"
                className="tk-button tk-button--ghost"
                onClick={() => setHeaders((rows) => ensureTrailingBlank([...rows, createRow()]))}
              >
                Add header
              </button>
            </div>
            <KeyValueEditor rows={headers} onRowsChange={setHeaders} namePlaceholder="Header name" valuePlaceholder="Header value" />
          </section>

          <section style={layoutStyles.section}>
            <div style={layoutStyles.sectionHeader}>
              <h4 style={layoutStyles.sectionTitle}>
                <span className="material-symbols-outlined" style={layoutStyles.icon} aria-hidden>
                  dataset
                </span>
                Body
              </h4>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  className="tk-select"
                  value={bodyMode}
                  onChange={(event) => setBodyMode(event.target.value as BodyMode)}
                  disabled={!methodSupportsBody}
                >
                  <option value="none">None</option>
                  <option value="raw">Raw text</option>
                  <option value="json">JSON</option>
                </select>
                {bodyMode === 'raw' && (
                  <select
                    className="tk-select"
                    value={rawContentType}
                    onChange={(event) => setRawContentType(event.target.value)}
                    style={{ minWidth: 200 }}
                  >
                    {RAW_CONTENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                )}
                {bodyMode === 'json' && (
                  <button type="button" className="tk-button tk-button--ghost" onClick={handleFormatJson}>
                    Format JSON
                  </button>
                )}
              </div>
            </div>
            {bodyMode === 'none' ? (
              <p style={{ ...layoutStyles.mutedText, margin: 0 }}>This request will be sent without a body.</p>
            ) : (
              <textarea
                className="tk-input"
                rows={bodyMode === 'json' ? 12 : 8}
                value={bodyContent}
                onChange={(event) => setBodyContent(event.target.value)}
                placeholder={bodyMode === 'json' ? '{\n  "example": true\n}' : 'Request payload'}
                style={{ fontFamily: 'var(--font-family-mono)', fontSize: '0.95rem' }}
              />
            )}
            {bodyError && <p style={{ color: 'var(--color-danger-text)', margin: 0 }}>{bodyError}</p>}
          </section>

          <section style={layoutStyles.section}>
            <div style={layoutStyles.sectionHeader}>
              <h4 style={layoutStyles.sectionTitle}>
                <span className="material-symbols-outlined" style={layoutStyles.icon} aria-hidden>
                  vpn_key
                </span>
                Authentication
              </h4>
            </div>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <select
                className="tk-select"
                value={authType}
                onChange={(event) => setAuthType(event.target.value as AuthType)}
                style={{ maxWidth: 260 }}
              >
                <option value="none">No authentication</option>
                <option value="basic">Basic auth</option>
                <option value="bearer">Bearer token</option>
                <option value="apiKey">Custom header</option>
              </select>

              {authType === 'basic' && (
                <div style={{ display: 'grid', gap: '0.6rem', maxWidth: 420 }}>
                  <label className="tk-label" style={{ display: 'grid', gap: '0.25rem' }}>
                    Username
                    <input
                      className="tk-input"
                      value={basicAuth.username}
                      onChange={(event) => setBasicAuth((prev) => ({ ...prev, username: event.target.value }))}
                    />
                  </label>
                  <label className="tk-label" style={{ display: 'grid', gap: '0.25rem' }}>
                    Password
                    <input
                      className="tk-input"
                      type="password"
                      value={basicAuth.password}
                      onChange={(event) => setBasicAuth((prev) => ({ ...prev, password: event.target.value }))}
                    />
                  </label>
                  <p style={{ ...layoutStyles.mutedText, margin: 0 }}>
                    Credentials are sent over HTTPS only; ensure you trust the target endpoint before sharing secrets.
                  </p>
                </div>
              )}

              {authType === 'bearer' && (
                <div style={{ display: 'grid', gap: '0.6rem', maxWidth: 420 }}>
                  <label className="tk-label" style={{ display: 'grid', gap: '0.25rem' }}>
                    Token
                    <textarea
                      className="tk-input"
                      rows={3}
                      value={bearerToken}
                      onChange={(event) => setBearerToken(event.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…"
                    />
                  </label>
                  <p style={{ ...layoutStyles.mutedText, margin: 0 }}>
                    A header of the form <code>Authorization: Bearer &lt;token&gt;</code> is added to the request.
                  </p>
                </div>
              )}

              {authType === 'apiKey' and (
              {authType === 'apiKey' && (
                <div style={{ display: 'grid', gap: '0.6rem', maxWidth: 420 }}>
                  <label className="tk-label" style={{ display: 'grid', gap: '0.25rem' }}>
                    Header name
                    <input
                      className="tk-input"
                      value={apiKeyAuth.headerName}
                      onChange={(event) => setApiKeyAuth((prev) => ({ ...prev, headerName: event.target.value }))}
                      placeholder="X-API-Key"
                    />
                  </label>
                  <label className="tk-label" style={{ display: 'grid', gap: '0.25rem' }}>
                    Header value
                    <input
                      className="tk-input"
                      value={apiKeyAuth.headerValue}
                      onChange={(event) => setApiKeyAuth((prev) => ({ ...prev, headerValue: event.target.value }))}
                      placeholder="secret-token"
                    />
                  </label>
                  <p style={{ ...layoutStyles.mutedText, margin: 0 }}>
                    Use this to inject API keys or custom auth headers without editing the headers table manually.
                  </p>
                </div>
              )}
            </div>
          </section>

          <section style={layoutStyles.section}>
            <div style={layoutStyles.sectionHeader}>
              <h4 style={layoutStyles.sectionTitle}>
                <span className="material-symbols-outlined" style={layoutStyles.icon} aria-hidden>
                  settings
                </span>
                Request options
              </h4>
            </div>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <label className="tk-label" style={{ display: 'grid', gap: '0.25rem', width: 160 }}>
                Timeout (seconds)
                <input
                  className="tk-input"
                  type="number"
                  min={1}
                  max={120}
                  value={timeoutSeconds}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    const value = Number(event.target.value)
                    if (Number.isNaN(value)) {
                      setTimeoutSeconds(30)
                    } else {
                      setTimeoutSeconds(Math.min(120, Math.max(1, Math.round(value))))
                    }
                  }}
                />
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={followRedirects}
                  onChange={(event) => setFollowRedirects(event.target.checked)}
                />
                Follow redirects
              </label>
            </div>
          </section>

          <ResponsePanel response={response} sending={sending} error={error} />
        </div>

        {history.length > 0 && (
          <aside style={{ display: 'grid', gap: '1rem' }}>
            <section style={layoutStyles.section}>
              <div style={layoutStyles.sectionHeader}>
                <h4 style={layoutStyles.sectionTitle}>
                  <span className="material-symbols-outlined" style={layoutStyles.icon} aria-hidden>
                    history
                  </span>
                  History
                </h4>
                <button type="button" className="tk-button tk-button--ghost" onClick={clearHistory}>
                  Clear
                </button>
              </div>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {history.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => selectHistoryEntry(entry)}
                    className="tk-button tk-button--ghost"
                    style={{
                      justifyContent: 'flex-start',
                      display: 'grid',
                      gap: '0.15rem',
                      textAlign: 'left',
                      border: entry.id === activeHistoryId ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                      background: entry.id === activeHistoryId ? 'rgba(79, 111, 255, 0.1)' : 'transparent',
                      padding: '0.75rem',
                    }}
                  >
                    <span style={{ fontWeight: 600, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: '0.85rem' }}>{entry.request.method}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.request.url}</span>
                    </span>
                    <span style={{ ...layoutStyles.mutedText, fontSize: '0.85rem', display: 'flex', gap: '0.5rem' }}>
                      <span>{formatTimestamp(entry.startedAt)}</span>
                      {entry.response && (
                        <>
                          <span aria-hidden>•</span>
                          <span>
                            {entry.response.status_code} {entry.response.reason_phrase || ''}
                          </span>
                          <span aria-hidden>•</span>
                          <span>{formatDuration(entry.response.duration_ms)}</span>
                        </>
                      )}
                      {entry.error && (
                        <>
                          <span aria-hidden>•</span>
                          <span style={{ color: 'var(--color-danger-text)' }}>Error</span>
                        </>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </aside>
        )}
      </div>
    </div>
  )
}

function KeyValueEditor({
  rows,
  onRowsChange,
  namePlaceholder,
  valuePlaceholder,
}: {
  rows: KeyValueRow[]
  onRowsChange: (rows: KeyValueRow[]) => void
  namePlaceholder: string
  valuePlaceholder: string
}) {
  const handleNameChange = (rowId: string, value: string) => {
    onRowsChange(ensureTrailingBlank(rows.map((row) => (row.id === rowId ? { ...row, name: value } : row))))
  }

  const handleValueChange = (rowId: string, value: string) => {
    onRowsChange(ensureTrailingBlank(rows.map((row) => (row.id === rowId ? { ...row, value } : row))))
  }

  const handleToggle = (rowId: string, enabled: boolean) => {
    onRowsChange(rows.map((row) => (row.id === rowId ? { ...row, enabled } : row)))
  }

  const handleRemove = (rowId: string) => {
    const remaining = rows.filter((row) => row.id !== rowId)
    onRowsChange(ensureTrailingBlank(remaining.length ? remaining : [createRow()]))
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={layoutStyles.table}>
        <thead>
          <tr>
            <th style={{ ...layoutStyles.tableHeadCell, width: 60 }}>Send</th>
            <th style={{ ...layoutStyles.tableHeadCell, minWidth: 160 }}>{namePlaceholder}</th>
            <th style={{ ...layoutStyles.tableHeadCell, minWidth: 200 }}>{valuePlaceholder}</th>
            <th style={{ ...layoutStyles.tableHeadCell, width: 40 }} aria-label="Remove row" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const isBlank = row.name.trim() === '' && row.value.trim() === ''
            const allowRemove = rows.length > 1 && (index !== rows.length - 1 || !isBlank)
            return (
              <tr key={row.id}>
                <td style={{ padding: '0.3rem 0.4rem' }}>
                  <input type="checkbox" checked={row.enabled} onChange={(event) => handleToggle(row.id, event.target.checked)} />
                </td>
                <td style={{ padding: '0.3rem 0.4rem' }}>
                  <input
                    className="tk-input"
                    value={row.name}
                    onChange={(event) => handleNameChange(row.id, event.target.value)}
                    placeholder={namePlaceholder}
                  />
                </td>
                <td style={{ padding: '0.3rem 0.4rem' }}>
                  <input
                    className="tk-input"
                    value={row.value}
                    onChange={(event) => handleValueChange(row.id, event.target.value)}
                    placeholder={valuePlaceholder}
                  />
                </td>
                <td style={{ padding: '0.3rem 0.4rem', textAlign: 'center' }}>
                  {allowRemove && (
                    <button
                      type="button"
                      className="tk-button tk-button--ghost"
                      onClick={() => handleRemove(row.id)}
                      aria-label="Remove row"
                    >
                      <span className="material-symbols-outlined" aria-hidden>
                        close
                      </span>
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ResponsePanel({
  response,
  sending,
  error,
}: {
  response: ApiResponsePayload | null
  sending: boolean
  error: string | null
}) {
  const [activeTab, setActiveTab] = useState<'body' | 'headers' | 'request'>('body')

  useEffect(() => {
    setActiveTab('body')
  }, [response?.status_code, error])

  return (
    <section style={layoutStyles.section}>
      <div style={layoutStyles.sectionHeader}>
        <h4 style={layoutStyles.sectionTitle}>
          <span className="material-symbols-outlined" style={layoutStyles.icon} aria-hidden>
            terminal
          </span>
          Response
        </h4>
      </div>
      {sending && <p style={{ ...layoutStyles.mutedText, margin: 0 }}>Awaiting response…</p>}
      {!sending && !response && !error && <p style={{ ...layoutStyles.mutedText, margin: 0 }}>Send a request to see the response details.</p>}
      {error && <p style={{ color: 'var(--color-danger-text)', margin: 0 }}>{error}</p>}
      {response && (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
            <span style={{ ...layoutStyles.badge, ...statusTone(response.status_code) }}>
              <strong>{response.status_code}</strong>
              <span>{response.reason_phrase || '—'}</span>
            </span>
            <span style={layoutStyles.mutedText}>{response.http_version || ''}</span>
            <span aria-hidden style={layoutStyles.mutedText}>
              •
            </span>
            <span style={layoutStyles.mutedText}>{formatDuration(response.duration_ms)}</span>
            <span aria-hidden style={layoutStyles.mutedText}>
              •
            </span>
            <span style={layoutStyles.mutedText}>{formatSize(response.size_bytes)}</span>
          </div>
          <div style={{ ...layoutStyles.mutedText, wordBreak: 'break-all' }}>{response.url}</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`tk-button tk-button--ghost${activeTab === 'body' ? ' tk-button--active' : ''}`}
              onClick={() => setActiveTab('body')}
            >
              Body
            </button>
            <button
              type="button"
              className={`tk-button tk-button--ghost${activeTab === 'headers' ? ' tk-button--active' : ''}`}
              onClick={() => setActiveTab('headers')}
            >
              Headers
            </button>
            <button
              type="button"
              className={`tk-button tk-button--ghost${activeTab === 'request' ? ' tk-button--active' : ''}`}
              onClick={() => setActiveTab('request')}
            >
              Request
            </button>
          </div>

          {activeTab === 'body' && <ResponseBodyView response={response} />}
          {activeTab === 'headers' && <ResponseHeadersView response={response} />}
          {activeTab === 'request' && <RequestSummaryView response={response} />}
        </div>
      )}
    </section>
  )
}

function ResponseBodyView({ response }: { response: ApiResponsePayload }) {
  const bodyText = useMemo(() => {
    if (response.json_body !== null && response.json_body !== undefined) {
      try {
        return JSON.stringify(response.json_body, null, 2)
      } catch (err) {
        console.warn('Failed to stringify JSON body:', err)
      }
    }
    return response.body
  }, [response.body, response.json_body])

  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      {response.is_binary && (
        <p style={{ ...layoutStyles.mutedText, margin: 0 }}>
          Response appears to be binary. Showing decoded preview — characters may look garbled.
        </p>
      )}
      {response.body_truncated && (
        <p style={{ ...layoutStyles.mutedText, margin: 0 }}>
          Preview truncated to 64 KB. Download the resource directly for the complete payload.
        </p>
      )}
      <pre
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 10,
          padding: '0.9rem',
          maxHeight: 320,
          overflow: 'auto',
          fontFamily: 'var(--font-family-mono)',
          fontSize: '0.9rem',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          margin: 0,
        }}
      >
        {bodyText || '(empty body)'}
      </pre>
    </div>
  )
}

function ResponseHeadersView({ response }: { response: ApiResponsePayload }) {
  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      <h5 style={{ margin: '0 0 0.25rem', fontSize: '0.9rem' }}>Response headers</h5>
      <HeaderList headers={response.headers} />
      <h5 style={{ margin: '0.75rem 0 0.25rem', fontSize: '0.9rem' }}>Request headers</h5>
      <HeaderList headers={response.request_headers} />
    </div>
  )
}

function HeaderList({ headers }: { headers: ResponseHeader[] }) {
  if (!headers.length) {
    return <p style={{ ...layoutStyles.mutedText, margin: 0 }}>No headers recorded.</p>
  }
  return (
    <div
      style={{
        display: 'grid',
        gap: '0.35rem',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        padding: '0.75rem',
      }}
    >
      {headers.map((header, index) => (
        <div key={`${header.name}:${index}`} style={{ display: 'grid', gap: '0.15rem' }}>
          <span style={{ fontWeight: 600 }}>{header.name}</span>
          <code style={{ fontFamily: 'var(--font-family-mono)', fontSize: '0.85rem' }}>{header.value}</code>
        </div>
      ))}
    </div>
  )
}

function RequestSummaryView({ response }: { response: ApiResponsePayload }) {
  return (
    <div style={{ display: 'grid', gap: '0.6rem' }}>
      <div>
        <strong>Method</strong>
        <div style={layoutStyles.mutedText}>{response.method}</div>
      </div>
      <div>
        <strong>URL</strong>
        <div style={{ ...layoutStyles.mutedText, wordBreak: 'break-all' }}>{response.url}</div>
      </div>
      <div>
        <strong>Request headers</strong>
        <HeaderList headers={response.request_headers} />
      </div>
    </div>
  )
}

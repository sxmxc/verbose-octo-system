import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { apiFetch } from '../api'
import { useAuth } from '../AuthContext'
import { MaterialIcon } from '../components/MaterialIcon'
import { ToolkitRecord, useToolkits } from '../ToolkitContext'
import './AdminToolkitsPage.css'

type ToolkitDocs = {
  overview?: string
  bundle_format?: { contents?: string[] }
  upload?: { endpoint?: string; form_fields?: Record<string, string>; post_install?: string }
  job_queue?: { enqueue?: string; tracking?: string; handlers?: string }
  dashboard?: string
}

type CommunityToolkitEntry = {
  slug: string
  name: string
  description?: string
  version?: string
  bundle_url?: string | null
  homepage?: string | null
  maintainer?: string | null
  tags?: string[]
}

type CommunityCatalogResponse = {
  catalog_url: string | null
  toolkits: CommunityToolkitEntry[]
}

const DEFAULT_CATALOG_URL = 'https://raw.githubusercontent.com/sxmxc/ideal-octo-engine/main/catalog/toolkits.json'

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="admin-toolkits__field">
    <span>{label}</span>
    {children}
  </label>
)


export default function AdminToolkitsPage() {
  const { toolkits, updateLocal, refresh } = useToolkits()
  const { user, hasRole } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [busySlug, setBusySlug] = useState<string | null>(null)
  const [uploadSlug, setUploadSlug] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [docs, setDocs] = useState<ToolkitDocs | null>(null)
  const canToggle = hasRole('toolkit.curator')
  const canInstall = user?.is_superuser ?? false
  const [catalogEntries, setCatalogEntries] = useState<CommunityToolkitEntry[]>([])
  const [catalogUrl, setCatalogUrl] = useState('')
  const [catalogUrlDraft, setCatalogUrlDraft] = useState('')
  const [catalogLoading, setCatalogLoading] = useState<boolean>(true)
  const [catalogSaving, setCatalogSaving] = useState(false)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [catalogNotice, setCatalogNotice] = useState<string | null>(null)
  const [installingSlug, setInstallingSlug] = useState<string | null>(null)
  const effectiveCatalogUrl = useMemo(() => catalogUrl || DEFAULT_CATALOG_URL, [catalogUrl])
  const catalogUrlChanged = useMemo(
    () => catalogUrlDraft.trim() !== (catalogUrl || '').trim(),
    [catalogUrlDraft, catalogUrl],
  )

  useEffect(() => {
    ;(async () => {
      try {
        const response = await apiFetch<ToolkitDocs>('/toolkits/docs/getting-started')
        setDocs(response)
      } catch (err) {
        console.warn('Failed to load toolkit docs', err)
      }
    })()
  }, [])

  const loadCatalog = useCallback(async () => {
    if (!canToggle) {
      setCatalogEntries([])
      setCatalogUrl('')
      setCatalogUrlDraft('')
      setCatalogLoading(false)
      return
    }

    setCatalogLoading(true)
    setCatalogError(null)
    setCatalogNotice(null)
    try {
      const response = await apiFetch<CommunityCatalogResponse>('/toolkits/community')
      const effectiveUrl = response.catalog_url ?? ''
      setCatalogEntries(response.toolkits)
      setCatalogUrl(effectiveUrl)
      setCatalogUrlDraft(effectiveUrl)
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : String(err))
      setCatalogEntries([])
    } finally {
      setCatalogLoading(false)
    }
  }, [canToggle])

  useEffect(() => {
    loadCatalog()
  }, [loadCatalog])

  const saveCatalogUrl = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canInstall) return
    setCatalogError(null)
    setCatalogNotice(null)
    const trimmed = catalogUrlDraft.trim()
    setCatalogSaving(true)
    try {
      const response = await apiFetch<CommunityCatalogResponse>('/toolkits/community/catalog', {
        method: 'POST',
        body: { url: trimmed ? trimmed : null },
      })
      const effectiveUrl = response.catalog_url ?? ''
      setCatalogEntries(response.toolkits)
      setCatalogUrl(effectiveUrl)
      setCatalogUrlDraft(effectiveUrl)
      setCatalogNotice(trimmed ? 'Catalog URL saved.' : 'Catalog URL reset to default.')
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : String(err))
    } finally {
      setCatalogSaving(false)
    }
  }

  const installFromCatalog = async (entry: CommunityToolkitEntry) => {
    if (!canInstall || !entry.bundle_url) return
    setError(null)
    setCatalogError(null)
    setCatalogNotice(null)
    setInstallingSlug(entry.slug)
    try {
      const record = await apiFetch<ToolkitRecord>(`/toolkits/community/install`, {
        method: 'POST',
        body: { slug: entry.slug },
      })
      setCatalogNotice(`${record.name} imported. Enable it from Installed toolkits.`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setInstallingSlug(null)
    }
  }

  const toggleToolkit = async (toolkit: ToolkitRecord) => {
    if (!canToggle) return
    setError(null)
    setBusySlug(toolkit.slug)
    try {
      const response = await apiFetch<ToolkitRecord>(`/toolkits/${toolkit.slug}`, {
        method: 'PUT',
        body: { enabled: !toolkit.enabled },
      })
      updateLocal(toolkit.slug, () => response)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusySlug(null)
    }
  }

  return (
    <div className="admin-toolkits">
      <header>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-primary)' }}>
          <MaterialIcon name="engineering" style={{ color: 'var(--color-link)' }} />
          Toolkit administration
        </h3>
        <p style={{ margin: '0.3rem 0 0', color: 'var(--color-text-secondary)' }}>
          Upload, enable, disable, or remove toolkits for the SRE Toolbox runtime.
        </p>
      </header>

      {docs && (
        <section className="admin-toolkits__docs">
          <h4 style={{ margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <MaterialIcon name="lightbulb" style={{ color: 'var(--color-warning-text)' }} />
            Getting started
          </h4>
          {docs.overview && <p className="admin-toolkits__docs-intro">{docs.overview}</p>}
          {docs.bundle_format?.contents && (
            <ul>
              {docs.bundle_format.contents.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {docs.upload?.post_install && <p>{docs.upload.post_install}</p>}
          {docs.job_queue?.handlers && <p>{docs.job_queue.handlers}</p>}
          {docs.dashboard && <p>{docs.dashboard}</p>}
          <p>
            Upload bundles via <code>/toolkits/install</code> or the form below. After staging, enable the toolkit; SRE Toolbox will auto-load its
            backend routes, worker tasks, and dashboard contributions.
          </p>
        </section>
      )}

      {error && <p style={{ color: 'var(--color-danger-border)' }}>{error}</p>}

      <section className="admin-toolkits__section">
        <h4 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <MaterialIcon name="extension" style={{ color: 'var(--color-link)' }} />
          Installed toolkits
        </h4>
        <div className="admin-toolkits__list">
          {toolkits.length === 0 && <p className="admin-toolkits__empty">No toolkits registered yet.</p>}
          {toolkits.map((toolkit) => (
            <div key={toolkit.slug} className="admin-toolkits__item">
              <div className="admin-toolkits__item-details">
                <strong>{toolkit.name}</strong>
                <div className="admin-toolkits__item-description">{toolkit.description}</div>
                <div className="admin-toolkits__item-meta">Slug: {toolkit.slug} · Path: {toolkit.base_path}
                  {toolkit.origin !== 'builtin' ? ' · Custom upload' : ' · Built-in'}</div>
              </div>
              <div className="admin-toolkits__item-actions">
                <button
                  type="button"
                  onClick={() => toggleToolkit(toolkit)}
                  disabled={busySlug === toolkit.slug}
                  className={[
                    'admin-toolkits__icon-button',
                    toolkit.enabled ? 'is-active' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-pressed={toolkit.enabled}
                  title={toolkit.enabled ? 'Disable toolkit' : 'Enable toolkit'}
                >
                  <MaterialIcon
                    name={toolkit.enabled ? 'toggle_on' : 'toggle_off'}
                    style={{ fontSize: '1.8rem', color: 'inherit' }}
                  />
                </button>
                {toolkit.origin !== 'builtin' && (
                  <button
                    type="button"
                    onClick={async () => {
                      setError(null)
                      setBusySlug(toolkit.slug)
                      try {
                        await apiFetch(`/toolkits/${toolkit.slug}`, { method: 'DELETE', skipJson: true })
                        await refresh()
                      } catch (err) {
                        setError(err instanceof Error ? err.message : String(err))
                      } finally {
                        setBusySlug(null)
                      }
                    }}
                    className="admin-toolkits__icon-button admin-toolkits__icon-button--danger"
                    title="Uninstall toolkit"
                  >
                    <MaterialIcon name="delete" style={{ fontSize: '1.5rem', color: 'inherit' }} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-toolkits__section admin-toolkits__community">
        <h4 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <MaterialIcon name="public" style={{ color: 'var(--color-link)' }} />
          Community catalog
        </h4>
        <p className="admin-toolkits__helper">
          Discover toolkits published to the community repository. The catalog currently resolves from{' '}
          <code>{effectiveCatalogUrl}</code>.
        </p>
        {catalogNotice && <p className="admin-toolkits__notice">{catalogNotice}</p>}
        {catalogError && <p className="admin-toolkits__error">{catalogError}</p>}
        <div className="admin-toolkits__community-controls">
          <button
            type="button"
            className="tk-button"
            onClick={() => loadCatalog()}
            disabled={catalogLoading}
          >
            <MaterialIcon
              name={catalogLoading ? 'hourglass_top' : 'refresh'}
              style={{ fontSize: '1.1rem', color: 'inherit' }}
            />
            {catalogLoading ? 'Refreshing…' : 'Refresh catalog'}
          </button>
        </div>
        {canInstall && (
          <form onSubmit={saveCatalogUrl} className="admin-toolkits__community-form">
            <Field label="Catalog URL">
              <input
                value={catalogUrlDraft}
                onChange={(event) => setCatalogUrlDraft(event.target.value)}
                placeholder={DEFAULT_CATALOG_URL}
              />
            </Field>
            <div className="admin-toolkits__community-buttons">
              <button
                type="button"
                className="tk-button tk-button--subtle"
                onClick={() => setCatalogUrlDraft(catalogUrl)}
                disabled={catalogSaving || catalogUrlDraft === catalogUrl}
              >
                Reset draft
              </button>
              <button
                type="submit"
                className="tk-button tk-button--primary"
                disabled={catalogSaving || !catalogUrlChanged}
              >
                <MaterialIcon
                  name={catalogSaving ? 'hourglass_top' : 'save'}
                  style={{ fontSize: '1.1rem', color: 'inherit' }}
                />
                {catalogSaving ? 'Saving…' : 'Save catalog URL'}
              </button>
            </div>
          </form>
        )}
        <div className="admin-toolkits__community-list">
          {catalogLoading && <p className="admin-toolkits__helper">Loading community catalog…</p>}
          {!catalogLoading && catalogEntries.length === 0 && !catalogError && (
            <p className="admin-toolkits__helper">No community toolkits published yet.</p>
          )}
          {!catalogLoading &&
            catalogEntries.map((entry) => {
              const hasBundle = Boolean(entry.bundle_url)
              return (
                <div key={entry.slug} className="admin-toolkits__community-item">
                  <div className="admin-toolkits__community-details">
                    <strong>{entry.name}</strong>
                    <div className="admin-toolkits__community-meta">
                      <span>Slug: {entry.slug}</span>
                      {entry.version && <span>Version: {entry.version}</span>}
                      {entry.maintainer && <span>Maintainer: {entry.maintainer}</span>}
                    </div>
                    {entry.description && <p>{entry.description}</p>}
                    {entry.tags?.length ? (
                      <div className="admin-toolkits__tags">
                        {entry.tags.map((tag) => (
                          <span key={tag} className="admin-toolkits__tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {entry.homepage && (
                      <a href={entry.homepage} target="_blank" rel="noreferrer" className="admin-toolkits__link">
                        Project page
                      </a>
                    )}
                  </div>
                  {canInstall && (
                    <button
                      type="button"
                      className="tk-button tk-button--primary"
                      onClick={() => installFromCatalog(entry)}
                      disabled={!hasBundle || installingSlug === entry.slug}
                      title={hasBundle ? 'Install toolkit' : 'Bundle pending publication'}
                    >
                      <MaterialIcon
                        name={installingSlug === entry.slug ? 'hourglass_top' : 'download'}
                        style={{ fontSize: '1.1rem', color: 'inherit' }}
                      />
                      {installingSlug === entry.slug
                        ? 'Installing…'
                        : hasBundle
                        ? 'Install toolkit'
                        : 'Bundle pending'}
                    </button>
                  )}
                </div>
              )
            })}
        </div>
      </section>

      {canInstall && (
        <section className="admin-toolkits__section">
          <h4 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <MaterialIcon name="cloud_upload" style={{ color: 'var(--color-link)' }} />
            Install toolkit bundle (.zip)
          </h4>
          <p className="admin-toolkits__helper">
            Uploads store the bundle on the server and auto-register the toolkit if it does not already exist. Newly uploaded toolkits remain
            disabled until you review them.
          </p>
          <form
            onSubmit={async (event) => {
              event.preventDefault()
              setError(null)
              if (!uploadFile) {
                setError('Choose a .zip bundle to upload')
              return
            }
            const body = new FormData()
            if (uploadSlug.trim()) {
              body.append('slug', uploadSlug.trim())
            }
            body.append('file', uploadFile)
            setUploading(true)
            try {
              await apiFetch<{ toolkit: ToolkitRecord }>(`/toolkits/install`, {
                method: 'POST',
                body,
              })
              setUploadFile(null)
              setUploadSlug('')
              ;(event.target as HTMLFormElement).reset()
              await refresh()
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err))
            } finally {
              setUploading(false)
            }
          }}
          className="admin-toolkits__form"
        >
          <Field label="Slug (optional)">
            <input value={uploadSlug} onChange={(event) => setUploadSlug(event.target.value)} placeholder="Leave blank to use bundle slug" />
          </Field>
          <Field label="Bundle (.zip)">
            <input
              type="file"
              accept=".zip"
              onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
            />
          </Field>
          <button type="submit" className="tk-button tk-button--primary" disabled={uploading}>
            <MaterialIcon
              name={uploading ? 'hourglass_top' : 'publish'}
              style={{ fontSize: '1.1rem', color: 'inherit' }}
            />
            {uploading ? 'Uploading…' : 'Upload toolkit'}
          </button>
          </form>
        </section>
      )}
    </div>
  )
}

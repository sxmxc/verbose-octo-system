import React, { useEffect, useState } from 'react'

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

import React, { useEffect, useState } from 'react'

import { apiFetch } from '../api'
import { MaterialIcon } from '../components/MaterialIcon'
import { ToolkitRecord, useToolkits } from '../ToolkitContext'

type ToolkitDocs = {
  overview?: string
  bundle_format?: { contents?: string[] }
  upload?: { endpoint?: string; form_fields?: Record<string, string>; post_install?: string }
  job_queue?: { enqueue?: string; tracking?: string; handlers?: string }
  dashboard?: string
}

const cardStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  borderRadius: 12,
  boxShadow: 'var(--color-shadow)',
  border: '1px solid var(--color-border)',
  padding: '1.5rem',
  display: 'grid',
  gap: '1.25rem',
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label style={{ display: 'grid', gap: '0.3rem', fontSize: '0.9rem' }}>
    {label}
    {children}
  </label>
)


export default function AdminToolkitsPage() {
  const { toolkits, updateLocal, refresh } = useToolkits()
  const [error, setError] = useState<string | null>(null)
  const [busySlug, setBusySlug] = useState<string | null>(null)
  const [uploadSlug, setUploadSlug] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [docs, setDocs] = useState<ToolkitDocs | null>(null)

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
    setError(null)
    setBusySlug(toolkit.slug)
    try {
      const payload = { enabled: !toolkit.enabled }
      const response = await apiFetch<ToolkitRecord>(`/toolkits/${toolkit.slug}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      updateLocal(toolkit.slug, () => response)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusySlug(null)
    }
  }

  return (
    <div style={cardStyle}>
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
        <section style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: '1rem', background: 'var(--color-surface-alt)' }}>
          <h4 style={{ margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <MaterialIcon name="lightbulb" style={{ color: 'var(--color-warning-text)' }} />
            Getting started
          </h4>
          {docs.overview && (
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>{docs.overview}</p>
          )}
          {docs.bundle_format?.contents && (
            <ul style={{ margin: '0.75rem 0 0', paddingLeft: '1.25rem', color: 'var(--color-text-primary)', fontSize: '0.9rem' }}>
              {docs.bundle_format.contents.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {docs.upload?.post_install && (
            <p style={{ margin: '0.75rem 0 0', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{docs.upload.post_install}</p>
          )}
          {docs.job_queue?.handlers && (
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{docs.job_queue.handlers}</p>
          )}
          {docs.dashboard && (
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{docs.dashboard}</p>
          )}
          <p style={{ margin: '0.75rem 0 0', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
            Upload bundles via <code>/toolkits/install</code> or the form below. After staging, enable the toolkit; SRE Toolbox will auto-load its
            backend routes, worker tasks, and dashboard contributions.
          </p>
        </section>
      )}

      {error && <p style={{ color: 'var(--color-danger-border)' }}>{error}</p>}

      <section>
        <h4 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <MaterialIcon name="extension" style={{ color: 'var(--color-link)' }} />
          Installed toolkits
        </h4>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {toolkits.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>No toolkits registered yet.</p>}
          {toolkits.map((toolkit) => (
            <div key={toolkit.slug} style={toolkitCardStyle}>
              <div style={{ display: 'grid', gap: '0.35rem' }}>
                <strong>{toolkit.name}</strong>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{toolkit.description}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  Slug: {toolkit.slug} · Path: {toolkit.base_path}
                  {toolkit.origin !== 'builtin' ? ' · Custom upload' : ' · Built-in'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => toggleToolkit(toolkit)}
                  disabled={busySlug === toolkit.slug}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 38,
                    height: 38,
                    border: '0px',
                    background: 'transparent',
                    color: toolkit.enabled ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    cursor: busySlug === toolkit.slug ? 'wait' : 'pointer',
                  }}
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
                    style={{
                      background: 'transparent',
                      border: '0px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 38,
                      height: 38,
                      color: 'var(--color-danger-border)',
                    }}
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

      <section>
        <h4 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <MaterialIcon name="cloud_upload" style={{ color: 'var(--color-link)' }} />
          Install toolkit bundle (.zip)
        </h4>
        <p style={{ margin: '0.25rem 0 1rem', color: 'var(--color-text-secondary)' }}>
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
          style={{ display: 'grid', gap: '0.75rem', maxWidth: 420 }}
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
          <button
            type="submit"
            style={{ width: 'fit-content', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            disabled={uploading}
          >
            <MaterialIcon name={uploading ? 'hourglass_top' : 'publish'} style={{ fontSize: '1.1rem', color: 'var(--color-text-primary)' }} />
            {uploading ? 'Uploading…' : 'Upload toolkit'}
          </button>
        </form>
      </section>
    </div>
  )
}


const toolkitCardStyle: React.CSSProperties = {
  border: '1px solid var(--color-border)',
  borderRadius: 10,
  padding: '0.95rem 1.1rem',
  background: 'var(--color-surface-alt)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '1rem',
}

import React, { useEffect, useRef, useState } from 'react'

import { apiFetch } from '../../../api'
import { useAuth } from '../../../AuthContext'
import { MaterialIcon } from '../../../components/MaterialIcon'
import { Skeleton } from '../../../components/Skeleton'
import { ToolkitRecord, useToolkits } from '../../../ToolkitContext'

export type ToolkitDocs = {
  overview?: string
  bundle_format?: { contents?: string[] }
  upload?: { endpoint?: string; form_fields?: Record<string, string>; post_install?: string }
  job_queue?: { enqueue?: string; tracking?: string; handlers?: string }
  dashboard?: string
}

export default function AdminToolkitsOverviewPage() {
  const { toolkits, updateLocal, refresh, loading } = useToolkits()
  const { hasRole } = useAuth()
  const [docs, setDocs] = useState<ToolkitDocs | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busySlug, setBusySlug] = useState<string | null>(null)
  const [errorSlug, setErrorSlug] = useState<string | null>(null)
  const canToggle = hasRole('toolkit.curator')
  const errorRef = useRef<HTMLParagraphElement | null>(null)

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
    setErrorSlug(null)
    setBusySlug(toolkit.slug)
    try {
      const response = await apiFetch<ToolkitRecord>(`/toolkits/${toolkit.slug}`, {
        method: 'PUT',
        body: { enabled: !toolkit.enabled },
      })
      updateLocal(toolkit.slug, () => response)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setErrorSlug(toolkit.slug)
    } finally {
      setBusySlug(null)
    }
  }

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
      if (typeof errorRef.current.focus === 'function') {
        errorRef.current.focus({ preventScroll: true })
      }
    }
  }, [error])

  useEffect(() => {
    if (!errorSlug) return
    const timeout = window.setTimeout(() => setErrorSlug(null), 700)
    return () => window.clearTimeout(timeout)
  }, [errorSlug])

  return (
    <div className="admin-toolkits__stack">
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

      {error && (
        <p
          ref={errorRef}
          tabIndex={-1}
          className="admin-toolkits__error"
          role="alert"
          aria-live="assertive"
        >
          {error}
        </p>
      )}

      <section className="admin-toolkits__section">
        <h4 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <MaterialIcon name="extension" style={{ color: 'var(--color-link)' }} />
          Installed toolkits
        </h4>
        <div className="admin-toolkits__list">
          {loading && (
            <>
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="admin-toolkits__item is-loading">
                  <div className="admin-toolkits__item-details">
                    <Skeleton height="1.1rem" width="55%" />
                    <Skeleton height="0.85rem" width="80%" />
                    <Skeleton height="0.75rem" width="60%" />
                  </div>
                  <div className="admin-toolkits__item-actions">
                    <Skeleton height="2.4rem" width="2.4rem" radius="12px" />
                    <Skeleton height="2.4rem" width="2.4rem" radius="12px" />
                  </div>
                </div>
              ))}
            </>
          )}
          {!loading && toolkits.length === 0 && <p className="admin-toolkits__empty">No toolkits registered yet.</p>}
          {!loading &&
            toolkits.map((toolkit) => (
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
                    disabled={busySlug === toolkit.slug || loading}
                    className={[
                      'admin-toolkits__icon-button',
                      toolkit.enabled ? 'is-active' : '',
                      errorSlug === toolkit.slug ? 'is-error' : '',
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
                        setErrorSlug(null)
                        setBusySlug(toolkit.slug)
                        try {
                          const confirmed = window.confirm(
                            `Uninstall ${toolkit.name}? This removes its files from the Toolbox.`
                          )
                          if (!confirmed) {
                            return
                          }
                          await apiFetch(`/toolkits/${toolkit.slug}`, { method: 'DELETE', skipJson: true })
                          await refresh()
                        } catch (err) {
                          setError(err instanceof Error ? err.message : String(err))
                          setErrorSlug(toolkit.slug)
                        } finally {
                          setBusySlug(null)
                        }
                      }}
                      className={[
                        'admin-toolkits__icon-button',
                        'admin-toolkits__icon-button--danger',
                        errorSlug === toolkit.slug ? 'is-error' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
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
    </div>
  )
}

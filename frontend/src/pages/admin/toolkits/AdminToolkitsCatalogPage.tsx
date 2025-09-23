import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { apiFetch } from '../../../api'
import { useAuth } from '../../../AuthContext'
import { MaterialIcon } from '../../../components/MaterialIcon'
import { Skeleton, SkeletonText } from '../../../components/Skeleton'
import { ToolkitRecord, useToolkits } from '../../../ToolkitContext'
import { DEFAULT_CATALOG_URL } from './common'

type CommunityToolkitEntry = {
  slug: string
  name: string
  description?: string
  version?: string
  bundle_url?: string | null
  resolved_bundle_url?: string | null
  homepage?: string | null
  maintainer?: string | null
  maintainers?: string[]
  categories?: string[]
  tags?: string[]
}

type CommunityCatalogResponse = {
  catalog_url: string | null
  configured_url: string | null
  toolkits: CommunityToolkitEntry[]
}

type CatalogMessage = {
  type: 'error' | 'notice'
  message: string
}

const PAGE_SIZE = 8
const OFFICIAL_MAINTAINERS = ['toolbox-maintainers@example.com']

export default function AdminToolkitsCatalogPage() {
  const { refresh, toolkits: installedToolkits } = useToolkits()
  const { user, hasRole } = useAuth()
  const [catalogEntries, setCatalogEntries] = useState<CommunityToolkitEntry[]>([])
  const [catalogUrl, setCatalogUrl] = useState('')
  const [configuredUrl, setConfiguredUrl] = useState('')
  const [catalogLoading, setCatalogLoading] = useState<boolean>(true)
  const [message, setMessage] = useState<CatalogMessage | null>(null)
  const [installingSlug, setInstallingSlug] = useState<string | null>(null)
  const [activatingSlug, setActivatingSlug] = useState<string | null>(null)
  const [failedAction, setFailedAction] = useState<{ slug: string; action: 'install' | 'enable' } | null>(null)
  const [page, setPage] = useState(1)
  const canToggle = hasRole('toolkit.curator')
  const canInstall = user?.is_superuser ?? false
  const messageRef = useRef<HTMLParagraphElement | null>(null)

  const effectiveCatalogUrl = useMemo(() => catalogUrl || DEFAULT_CATALOG_URL, [catalogUrl])
  const totalPages = Math.max(1, Math.ceil(catalogEntries.length / PAGE_SIZE))

  const installedMap = useMemo(() => {
    const map = new Map<string, ToolkitRecord>()
    installedToolkits.forEach((toolkit) => map.set(toolkit.slug, toolkit))
    return map
  }, [installedToolkits])

  const pagedEntries = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return catalogEntries.slice(start, start + PAGE_SIZE)
  }, [catalogEntries, page])

  const loadCatalog = useCallback(async () => {
    if (!canToggle) {
      setCatalogEntries([])
      setCatalogUrl('')
      setConfiguredUrl('')
      setCatalogLoading(false)
      return
    }

    setCatalogLoading(true)
    setMessage(null)
    try {
      const response = await apiFetch<CommunityCatalogResponse>('/toolkits/community')
      const effectiveUrl = response.catalog_url ?? ''
      const storedUrl = response.configured_url ?? ''
      setCatalogEntries(response.toolkits)
      setCatalogUrl(effectiveUrl)
      setConfiguredUrl(storedUrl)
      setPage(1)
    } catch (err) {
      setMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) })
      setCatalogEntries([])
    } finally {
      setCatalogLoading(false)
    }
  }, [canToggle])

  useEffect(() => {
    loadCatalog()
  }, [loadCatalog])

  useEffect(() => {
    if (message && messageRef.current) {
      messageRef.current.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
      if (typeof messageRef.current.focus === 'function') {
        messageRef.current.focus({ preventScroll: true })
      }
    }
  }, [message])

  useEffect(() => {
    if (!failedAction) return
    const timeout = window.setTimeout(() => setFailedAction(null), 700)
    return () => window.clearTimeout(timeout)
  }, [failedAction])

  const installFromCatalog = async (entry: CommunityToolkitEntry) => {
    const resolvedBundle = entry.resolved_bundle_url || entry.bundle_url
    if (!canInstall || !resolvedBundle) return
    setMessage(null)
    setFailedAction(null)
    setInstallingSlug(entry.slug)
    try {
      const record = await apiFetch<ToolkitRecord>(`/toolkits/community/install`, {
        method: 'POST',
        body: { slug: entry.slug },
      })
      setMessage({
        type: 'notice',
        message: record.enabled
          ? `${record.name} imported and enabled.`
          : `${record.name} imported. Enable it here when you're ready.`,
      })
      await refresh()
    } catch (err) {
      setMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) })
      setFailedAction({ slug: entry.slug, action: 'install' })
    } finally {
      setInstallingSlug(null)
    }
  }

  const enableToolkit = async (toolkit: ToolkitRecord) => {
    if (!canToggle) return
    setMessage(null)
    setFailedAction(null)
    setActivatingSlug(toolkit.slug)
    try {
      const response = await apiFetch<ToolkitRecord>(`/toolkits/${toolkit.slug}`, {
        method: 'PUT',
        body: { enabled: true },
      })
      setMessage({ type: 'notice', message: `${response.name} enabled.` })
      await refresh()
    } catch (err) {
      setMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) })
      setFailedAction({ slug: toolkit.slug, action: 'enable' })
    } finally {
      setActivatingSlug(null)
    }
  }

  const renderSkeletonGrid = () => (
    <div className="admin-toolkits__catalog-grid">
      {Array.from({ length: PAGE_SIZE }).map((_, index) => (
        <div key={index} className="admin-toolkits__catalog-card is-loading">
          <Skeleton height="1.25rem" width="60%" />
          <Skeleton height="0.9rem" width="40%" style={{ marginTop: '0.6rem' }} />
          <SkeletonText lines={3} />
          <div className="admin-toolkits__tags" style={{ marginTop: '0.75rem' }}>
            <Skeleton height="0.9rem" width="4rem" radius="999px" />
            <Skeleton height="0.9rem" width="3rem" radius="999px" />
          </div>
        </div>
      ))}
    </div>
  )

  const renderBadges = (entry: CommunityToolkitEntry) => {
    const installed = installedMap.get(entry.slug)
    const badges: Array<{ label: string; variant: string }> = []
    const addBadge = (variant: string, label: string) => {
      if (!badges.find((badge) => badge.variant === variant && badge.label === label)) {
        badges.push({ label, variant })
      }
    }

    if (installed) {
      addBadge('installed', 'Installed')
      if (installed.origin === 'builtin') {
        addBadge('bundled', 'Bundled')
      }
    }

    const maintainers = entry.maintainers ?? (entry.maintainer ? [entry.maintainer] : [])
    if (maintainers.some((maintainer) => OFFICIAL_MAINTAINERS.includes(maintainer))) {
      addBadge('official', 'Official')
    }

    const categories = entry.categories || []
    if (categories.some((category) => category.toLowerCase() === 'bundled')) {
      addBadge('bundled', 'Bundled')
    }

    categories
      .filter((category) => category.toLowerCase() !== 'bundled')
      .forEach((category) => addBadge('category', category))

    return badges.length ? (
      <div className="admin-toolkits__badge-row">
        {badges.map((badge) => (
          <span key={`${entry.slug}-${badge.label}`} className={`admin-toolkits__badge admin-toolkits__badge--${badge.variant}`}>
            {badge.label}
          </span>
        ))}
      </div>
    ) : null
  }

  return (
    <div className="admin-toolkits__stack">
      <section className="admin-toolkits__section admin-toolkits__community">
        <h4 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <MaterialIcon name="public" style={{ color: 'var(--color-link)' }} />
          Community catalog
        </h4>
        <p className="admin-toolkits__helper">
          Discover toolkits published to the community repository. The catalog currently resolves from{' '}
          <code>{effectiveCatalogUrl}</code>.
        </p>
        {configuredUrl && (
          <p className="admin-toolkits__helper">Configured override: {configuredUrl}</p>
        )}
        {message && (
          <p
            ref={messageRef}
            tabIndex={-1}
            className={message.type === 'error' ? 'admin-toolkits__error' : 'admin-toolkits__notice'}
            role={message.type === 'error' ? 'alert' : 'status'}
            aria-live="assertive"
          >
            {message.message}
          </p>
        )}
        <div className="admin-toolkits__community-controls">
          <button type="button" className="tk-button" onClick={() => loadCatalog()} disabled={catalogLoading}>
            <MaterialIcon
              name={catalogLoading ? 'hourglass_top' : 'refresh'}
              style={{ fontSize: '1.1rem', color: 'inherit' }}
            />
            {catalogLoading ? 'Refreshing…' : 'Refresh catalog'}
          </button>
        </div>

        {catalogLoading ? (
          renderSkeletonGrid()
        ) : catalogEntries.length === 0 ? (
          <p className="admin-toolkits__helper">No community toolkits published yet.</p>
        ) : (
          <>
            <div className="admin-toolkits__catalog-grid">
              {pagedEntries.map((entry) => {
                const installed = installedMap.get(entry.slug)
                const resolvedBundle = entry.resolved_bundle_url || entry.bundle_url
                const maintainers = entry.maintainers ?? (entry.maintainer ? [entry.maintainer] : [])
                const isInstalling = installingSlug === entry.slug
                const isActivating = activatingSlug === entry.slug
                const isBusy = isInstalling || isActivating
                return (
                  <div
                    key={entry.slug}
                    className={["admin-toolkits__catalog-card", isBusy ? "is-busy" : ""].filter(Boolean).join(" ")}
                  >
                    <div className="admin-toolkits__catalog-header">
                      <div>
                        <strong>{entry.name}</strong>
                        <div className="admin-toolkits__catalog-meta">
                          <span>Slug: {entry.slug}</span>
                          {entry.version && <span>Version: {entry.version}</span>}
                        </div>
                      </div>
                      {canInstall && (
                        <button
                          type="button"
                          className={[
                            'tk-button',
                            'tk-button--primary',
                            'admin-toolkits__action-button',
                            failedAction?.slug === entry.slug && failedAction.action === 'install'
                              ? 'is-error'
                              : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          onClick={() => installFromCatalog(entry)}
                          disabled={isBusy || Boolean(installed) || !resolvedBundle}
                          title={
                            installed
                              ? 'Toolkit already installed'
                              : resolvedBundle
                              ? 'Install toolkit'
                              : 'Bundle pending publication'
                          }
                        >
                          <MaterialIcon
                            name={isInstalling ? 'hourglass_top' : installed ? 'check' : 'download'}
                            style={{ fontSize: '1.1rem', color: 'inherit' }}
                          />
                          {isInstalling
                            ? 'Installing…'
                            : installed
                            ? 'Installed'
                            : resolvedBundle
                            ? 'Install toolkit'
                            : 'Bundle pending'}
                        </button>
                      )}
                    </div>
                    {renderBadges(entry)}
                    {entry.description && <p className="admin-toolkits__catalog-description">{entry.description}</p>}
                    {entry.tags?.length ? (
                      <div className="admin-toolkits__tags">
                        {entry.tags.map((tag) => (
                          <span key={tag} className="admin-toolkits__tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {maintainers.length > 0 && (
                      <div className="admin-toolkits__catalog-meta" style={{ marginTop: '0.4rem' }}>
                        <span>Maintainers: {maintainers.join(', ')}</span>
                      </div>
                    )}
                    <div className="admin-toolkits__catalog-footer">
                      {entry.homepage && (
                        <a href={entry.homepage} target="_blank" rel="noreferrer" className="admin-toolkits__link">
                          Documentation
                        </a>
                      )}
                      {resolvedBundle && !installed && (
                        <span className="admin-toolkits__helper" style={{ fontSize: '0.75rem' }}>
                          Bundle: {resolvedBundle}
                        </span>
                      )}
                    </div>
                    {installed && !installed.enabled && canToggle && (
                      <button
                        type="button"
                        className={[
                          'tk-button',
                          'tk-button--primary',
                          'admin-toolkits__action-button',
                          'admin-toolkits__action-button--inline',
                          failedAction?.slug === installed.slug && failedAction.action === 'enable'
                            ? 'is-error'
                            : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onClick={() => enableToolkit(installed)}
                        disabled={isBusy}
                      >
                        <MaterialIcon
                          name={isActivating ? 'hourglass_top' : 'toggle_on'}
                          style={{ fontSize: '1.1rem', color: 'inherit' }}
                        />
                        {isActivating ? 'Enabling…' : 'Enable toolkit'}
                      </button>
                    )}
                    {isBusy && (
                      <div className="admin-toolkits__card-overlay" aria-hidden>
                        <div className="admin-toolkits__spinner" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {totalPages > 1 && (
              <div className="admin-toolkits__pagination">
                <button
                  type="button"
                  className="tk-button tk-button--subtle"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page === 1}
                >
                  Previous
                </button>
                <span>
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  className="tk-button tk-button--subtle"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}

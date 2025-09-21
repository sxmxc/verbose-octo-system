import React, { useCallback, useEffect, useRef, useState } from 'react'

import { apiFetch } from '../api'
import { Job } from '../types'


type DashboardCardMetric = {
  label: string
  value: string | number
  description?: string
}

type DashboardCard = {
  toolkit: string
  title: string
  body: string
  link_text?: string
  link_href?: string
  icon?: string
  metrics?: DashboardCardMetric[]
}

type ExpandedDashboardCard = DashboardCard & { metrics: DashboardCardMetric[] }

type DashboardData = {
  jobs: {
    recent: Job[]
    totals: {
      count: number
      by_status: Record<string, number>
    }
  }
  cards?: DashboardCard[]
}


const cardStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  borderRadius: 12,
  boxShadow: 'var(--color-shadow)',
  border: '1px solid var(--color-border)',
  padding: '1.5rem',
  color: 'var(--color-text-primary)',
}

const summaryPillStyle = (accent: string): React.CSSProperties => ({
  minWidth: '160px',
  padding: '0.75rem 1rem',
  borderRadius: 10,
  background: accent,
  color: '#fff',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  boxShadow: '0 10px 20px rgba(4, 7, 18, 0.25)',
})

const CARD_HEIGHT = 252

const skeletonBaseStyle: React.CSSProperties = {
  background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.065) 25%, rgba(255, 255, 255, 0.12) 37%, rgba(255, 255, 255, 0.065) 63%)',
  backgroundSize: '400% 100%',
  animation: 'dashboard-skeleton 1.6s ease-in-out infinite',
}

const buildSkeletonStyle = (style: React.CSSProperties): React.CSSProperties => ({
  ...skeletonBaseStyle,
  borderRadius: 8,
  ...style,
})


export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedCard, setExpandedCard] = useState<ExpandedDashboardCard | null>(null)
  const modalRef = useRef<HTMLDivElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const lastFocusedElementRef = useRef<HTMLElement | null>(null)
  const hasInsertedSkeletonKeyframesRef = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiFetch<DashboardData>('/dashboard')
      setData(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (hasInsertedSkeletonKeyframesRef.current) {
      return
    }
    const styleId = 'dashboard-skeleton-keyframes'
    if (document.getElementById(styleId)) {
      hasInsertedSkeletonKeyframesRef.current = true
      return
    }
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `@keyframes dashboard-skeleton { 0% { background-position: 100% 50%; } 50% { background-position: 0% 50%; } 100% { background-position: 100% 50%; } }`
    document.head.appendChild(style)
    hasInsertedSkeletonKeyframesRef.current = true
  }, [])

  useEffect(() => {
    const body = document.body
    if (!expandedCard) {
      return
    }

    lastFocusedElementRef.current = document.activeElement as HTMLElement | null
    const previousOverflow = body.style.overflow
    body.style.overflow = 'hidden'

    const focusModal = () => {
      if (closeButtonRef.current) {
        closeButtonRef.current.focus()
        return
      }
      if (modalRef.current) {
        modalRef.current.focus()
      }
    }

    const focusTimer = window.setTimeout(focusModal, 0)

    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!modalRef.current) {
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        setExpandedCard(null)
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const focusableElements = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter(
        (element) =>
          element.getAttribute('aria-hidden') !== 'true' &&
          !element.hasAttribute('hidden') &&
          !element.hasAttribute('disabled') &&
          element.getAttribute('aria-disabled') !== 'true' &&
          element.getAttribute('tabindex') !== '-1',
      )

      if (focusableElements.length === 0) {
        event.preventDefault()
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]
      const activeElement = document.activeElement as HTMLElement | null

      if (!activeElement || !modalRef.current.contains(activeElement)) {
        event.preventDefault()
        if (event.shiftKey) {
          lastElement.focus()
        } else {
          firstElement.focus()
        }
        return
      }

      if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      } else if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', handleKeyDown)
      body.style.overflow = previousOverflow
      const lastFocused = lastFocusedElementRef.current
      if (lastFocused && typeof lastFocused.focus === 'function') {
        lastFocused.focus()
      }
      lastFocusedElementRef.current = null
    }
  }, [expandedCard, setExpandedCard])

  const renderCardSkeletons = (count: number) =>
    Array.from({ length: count }).map((_, index) => (
      <div
        key={`card-skeleton-${index}`}
        style={{
          border: '1px solid var(--color-border)',
          borderRadius: 12,
          padding: '0.8rem 0.9rem',
          background: 'var(--color-surface-alt)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.55rem',
          height: CARD_HEIGHT,
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1 }}>
            <div style={buildSkeletonStyle({ height: 10, width: '45%', borderRadius: 4 })} />
            <div style={buildSkeletonStyle({ height: 16, width: '70%', borderRadius: 6 })} />
          </div>
          <div style={buildSkeletonStyle({ height: 26, width: 66, borderRadius: 6 })} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={buildSkeletonStyle({ height: 12, width: '92%', borderRadius: 4 })} />
          <div style={buildSkeletonStyle({ height: 12, width: '70%', borderRadius: 4 })} />
        </div>

        <div
          style={{
            display: 'grid',
            gap: '0.5rem',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            background: 'var(--color-surface)',
            borderRadius: 8,
            padding: '0.45rem 0.55rem',
            border: '1px solid var(--color-border)',
            flexGrow: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {Array.from({ length: 4 }).map((__, metricIndex) => (
            <div
              key={`card-skeleton-metric-${index}-${metricIndex}`}
              style={{ display: 'flex', flexDirection: 'column', gap: '0.28rem' }}
            >
              <div style={buildSkeletonStyle({ height: 10, width: '60%', borderRadius: 4 })} />
              <div style={buildSkeletonStyle({ height: 16, width: '80%', borderRadius: 6 })} />
              <div style={buildSkeletonStyle({ height: 10, width: '90%', borderRadius: 4 })} />
            </div>
          ))}
        </div>

        <div style={buildSkeletonStyle({ height: 12, width: '48%', borderRadius: 4 })} />
      </div>
    ))

  const renderJobSkeletonRows = (count: number) =>
    Array.from({ length: count }).map((_, index) => (
      <tr key={`job-skeleton-${index}`} style={{ borderTop: '1px solid var(--color-border)' }}>
        <td style={{ padding: '0.5rem' }}>
          <div style={buildSkeletonStyle({ height: 14, width: '60%', borderRadius: 4, marginBottom: 8 })} />
          <div style={buildSkeletonStyle({ height: 12, width: '80%', borderRadius: 4 })} />
        </td>
        <td style={{ padding: '0.5rem' }}>
          <div style={buildSkeletonStyle({ height: 12, width: '70%', borderRadius: 4 })} />
        </td>
        <td style={{ padding: '0.5rem' }}>
          <div style={buildSkeletonStyle({ height: 12, width: '50%', borderRadius: 4 })} />
        </td>
        <td style={{ padding: '0.5rem' }}>
          <div style={buildSkeletonStyle({ height: 12, width: '80%', borderRadius: 4 })} />
        </td>
      </tr>
    ))

  const renderJobTotalsSkeleton = (count: number) =>
    Array.from({ length: count }).map((_, index) => (
      <div
        key={`totals-skeleton-${index}`}
        style={{
          minWidth: '160px',
          padding: '0.75rem 1rem',
          borderRadius: 10,
          background: 'var(--color-surface-alt)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          pointerEvents: 'none',
        }}
      >
        <div style={buildSkeletonStyle({ height: 12, width: '60%', borderRadius: 4 })} />
        <div style={buildSkeletonStyle({ height: 20, width: '40%', borderRadius: 6 })} />
      </div>
    ))

  const cards = data?.cards ?? []
  const recentJobs = data?.jobs?.recent ?? []
  const jobTotals = data?.jobs?.totals
  const jobStatusEntries = jobTotals ? Object.entries(jobTotals.by_status) : []

  const showCardSkeletons = loading
  const showJobSkeletons = loading
  const showTotalsSkeletons = loading

  const skeletonCardCount = Math.max(cards.length, 4)
  const skeletonJobRowCount = Math.max(recentJobs.length, 5)
  const skeletonTotalsCount = Math.max(jobStatusEntries.length + 1, 3)

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Dashboard</h3>
        <button
          onClick={load}
          disabled={loading}
          style={{
            padding: '0.4rem 0.9rem',
            background: 'var(--color-sidebar-button-bg)',
            border: '1px solid transparent',
            borderRadius: 8,
            opacity: loading ? 0.7 : 1,
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      {error && (
        <p style={{ color: 'var(--color-danger-border)', marginTop: '0.75rem' }}>{error}</p>
      )}

      {(data || loading) && (
        <div style={{ display: 'grid', gap: '1.5rem', marginTop: '1.5rem' }}>
          {(showCardSkeletons || cards.length > 0) && (
            <section>
              <h4 style={{ margin: '0 0 0.75rem' }}>Toolkit highlights</h4>
              <div
                style={{
                  display: 'grid',
                  gap: '0.9rem',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  alignItems: 'stretch',
                }}
              >
                {showCardSkeletons
                  ? renderCardSkeletons(skeletonCardCount)
                  : cards.map((card, idx) => {
                      const metrics = card.metrics || []
                      const maxMetrics = 4
                      const metricsToShow = metrics.slice(0, maxMetrics)
                      const remainingMetrics = metrics.length - metricsToShow.length
                      const showExpand = metrics.length > 0 && (remainingMetrics > 0 || metrics.some((metric) => metric.description))
                      const isCurrentCardExpanded =
                        expandedCard?.toolkit === card.toolkit && expandedCard?.title === card.title

                      return (
                        <div
                          key={`${card.toolkit}-${idx}`}
                          style={{
                            border: '1px solid var(--color-border)',
                            borderRadius: 12,
                            padding: '0.8rem 0.9rem',
                            background: 'var(--color-surface-alt)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.55rem',
                            height: CARD_HEIGHT,
                            overflow: 'hidden',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                            <div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                {card.toolkit}
                              </div>
                              <strong style={{ display: 'block', marginTop: '0.15rem', fontSize: '1rem' }}>{card.title}</strong>
                            </div>
                            {card.link_href && (
                              <a
                                href={card.link_href}
                                style={{
                                  color: 'var(--color-link)',
                                  fontSize: '0.85rem',
                                  textDecoration: 'none',
                                  padding: '0.3rem 0.55rem',
                                  borderRadius: 6,
                                  background: 'var(--color-accent-soft)',
                                  fontWeight: 600,
                                }}
                              >
                                {card.link_text || 'Open toolkit'}
                              </a>
                            )}
                          </div>

                          {card.body && (
                            <p
                              style={{
                                margin: 0,
                                fontSize: '0.8rem',
                                color: 'var(--color-text-secondary)',
                                lineHeight: 1.4,
                                overflow: 'hidden',
                                display: '-webkit-box',
                                WebkitBoxOrient: 'vertical',
                                WebkitLineClamp: 2,
                              }}
                            >
                              {card.body}
                            </p>
                          )}

                          {metricsToShow.length > 0 && (
                            <div
                              style={{
                                display: 'grid',
                                gap: '0.5rem',
                                gridTemplateColumns:
                                  metricsToShow.length > 1
                                    ? 'repeat(2, minmax(0, 1fr))'
                                    : 'repeat(1, minmax(0, 1fr))',
                                background: 'var(--color-surface)',
                                borderRadius: 8,
                                padding: '0.45rem 0.55rem',
                                border: '1px solid var(--color-border)',
                                flexGrow: 1,
                                minHeight: 0,
                                overflow: 'hidden',
                              }}
                            >
                              {metricsToShow.map((metric, metricIdx) => (
                                <div
                                  key={`${metric.label}-${metricIdx}`}
                                  style={{ display: 'flex', flexDirection: 'column', gap: '0.18rem', minWidth: 0 }}
                                >
                                  <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {metric.label}
                                  </span>
                                  <strong
                                    style={{
                                      fontSize: '1rem',
                                      color: 'var(--color-text-primary)',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {metric.value}
                                  </strong>
                                  {metric.description && (
                                    <span
                                      style={{
                                        fontSize: '0.74rem',
                                        color: 'var(--color-text-secondary)',
                                        lineHeight: 1.35,
                                        overflow: 'hidden',
                                        display: '-webkit-box',
                                        WebkitBoxOrient: 'vertical',
                                        WebkitLineClamp: '2',
                                      }}
                                    >
                                      {metric.description}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {showExpand && (
                            <button
                              type="button"
                              onClick={() => setExpandedCard({ ...card, metrics })}
                              aria-haspopup="dialog"
                              aria-expanded={isCurrentCardExpanded}
                              style={{
                                background: 'transparent',
                                color: 'var(--color-link)',
                                border: 'none',
                                padding: 0,
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                alignSelf: 'flex-start',
                              }}
                            >
                              Expand metrics{remainingMetrics > 0 ? ` (+${remainingMetrics})` : ''}
                            </button>
                          )}
                        </div>
                      )
                    })}
              </div>
            </section>
          )}

          <section>
            <h4 style={{ margin: '0 0 0.75rem' }}>Recent Jobs</h4>
            {showJobSkeletons ? (
              <div style={{ overflowX: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--color-text-primary)' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', background: 'var(--color-surface-alt)' }}>
                      <th style={{ padding: '0.5rem' }}>Toolkit</th>
                      <th>Status</th>
                      <th>Progress</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>{renderJobSkeletonRows(skeletonJobRowCount)}</tbody>
                </table>
              </div>
            ) : recentJobs.length === 0 ? (
              <p style={{ margin: 0 }}>No jobs in the last window.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--color-text-primary)' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', background: 'var(--color-surface-alt)' }}>
                      <th style={{ padding: '0.5rem' }}>Toolkit</th>
                      <th>Status</th>
                      <th>Progress</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentJobs.map((job) => {
                      const toolkitLabel = job.toolkit || job.module || 'unknown'
                      return (
                        <tr key={job.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '0.5rem' }}>
                            <strong>{toolkitLabel}</strong>
                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{job.operation}</div>
                          </td>
                          <td style={{ textTransform: 'capitalize' }}>{job.status}</td>
                          <td>{job.progress ?? 0}%</td>
                          <td>{job.updated_at ? new Date(job.updated_at).toLocaleString() : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h4 style={{ margin: '0 0 0.75rem' }}>Job Totals</h4>
            {showTotalsSkeletons || !jobTotals ? (
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {renderJobTotalsSkeleton(skeletonTotalsCount)}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={summaryPillStyle('var(--color-link)')}>
                  <span>Total</span>
                  <strong>{jobTotals.count}</strong>
                </div>
                {jobStatusEntries.map(([status, count]) => (
                  <div key={status} style={summaryPillStyle('var(--color-accent)')}>
                    <span style={{ textTransform: 'capitalize' }}>{status}</span>
                    <strong>{count}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {expandedCard && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${expandedCard.title} metrics`}
          onClick={() => setExpandedCard(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(4, 7, 18, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            zIndex: 30,
          }}
        >
          <div
            ref={modalRef}
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
            style={{
              background: 'var(--color-surface)',
              borderRadius: 16,
              border: '1px solid var(--color-border)',
              boxShadow: '0 24px 48px rgba(4, 7, 18, 0.45)',
              width: 'min(520px, 100%)',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem 1.25rem',
                borderBottom: '1px solid var(--color-border)',
                gap: '1rem',
              }}
            >
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {expandedCard.toolkit}
                </div>
                <strong style={{ display: 'block', marginTop: '0.15rem', fontSize: '1.05rem' }}>{expandedCard.title}</strong>
              </div>
              <button
                type="button"
                onClick={() => setExpandedCard(null)}
                ref={closeButtonRef}
                style={{
                  background: 'var(--color-sidebar-button-bg)',
                  border: '1px solid transparent',
                  color: 'var(--color-text-primary)',
                  borderRadius: 8,
                  padding: '0.35rem 0.8rem',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                }}
              >
                Close
              </button>
            </div>

            <div
              style={{
                padding: '1.1rem 1.25rem 1.35rem',
                overflowY: 'auto',
                display: 'grid',
                gap: '0.9rem',
              }}
            >
              {expandedCard.body && (
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  {expandedCard.body}
                </p>
              )}

              <div
                style={{
                  display: 'grid',
                  gap: '0.75rem',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                }}
              >
                {expandedCard.metrics.map((metric, expandedMetricIdx) => (
                  <div
                    key={`${metric.label}-${expandedMetricIdx}`}
                    style={{
                      border: '1px solid var(--color-border)',
                      borderRadius: 10,
                      padding: '0.75rem 0.85rem',
                      background: 'var(--color-surface-alt)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem',
                    }}
                  >
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {metric.label}
                    </span>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--color-text-primary)' }}>{metric.value}</strong>
                    {metric.description && (
                      <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                        {metric.description}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

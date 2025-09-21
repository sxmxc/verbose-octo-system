import { getReactRuntime } from '../runtime'
import type { ComponentStatus } from '../pages/types'

const statusConfig: Record<
  ComponentStatus,
  { label: string; icon: string; color: string; background: string; textColor: string }
> = {
  healthy: {
    label: 'Healthy',
    icon: 'check_circle',
    color: 'var(--color-success-border)',
    background: 'var(--color-success-bg)',
    textColor: 'var(--color-success-text)',
  },
  degraded: {
    label: 'Degraded',
    icon: 'error',
    color: 'var(--color-warning-border)',
    background: 'var(--color-warning-bg)',
    textColor: 'var(--color-warning-text)',
  },
  down: {
    label: 'Down',
    icon: 'cancel',
    color: 'var(--color-danger-border)',
    background: 'var(--color-danger-bg)',
    textColor: 'var(--color-danger-text)',
  },
  unknown: {
    label: 'Unknown',
    icon: 'help',
    color: 'var(--color-border)',
    background: 'var(--color-surface-alt)',
    textColor: 'var(--color-text-secondary)',
  },
}

const React = getReactRuntime()

export function getStatusConfig(status: ComponentStatus) {
  return statusConfig[status] ?? statusConfig.unknown
}

export default function StatusIndicator({ status }: { status: ComponentStatus }) {
  const config = React.useMemo(() => getStatusConfig(status), [status])
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.2rem 0.55rem',
        borderRadius: 999,
        border: `1px solid ${config.color}`,
        background: config.background,
        color: config.textColor,
        fontWeight: 600,
        fontSize: '0.85rem',
      }}
    >
      <span className="material-symbols-outlined" aria-hidden style={{ fontSize: '1rem', lineHeight: 1 }}>
        {config.icon}
      </span>
      {config.label}
    </span>
  )
}

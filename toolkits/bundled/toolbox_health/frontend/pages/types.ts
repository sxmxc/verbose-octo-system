export type ComponentStatus = 'healthy' | 'degraded' | 'down' | 'unknown'

export type ComponentName = 'frontend' | 'backend' | 'worker'

export type ComponentHealth = {
  component: ComponentName
  status: ComponentStatus
  message: string
  checked_at: string
  latency_ms?: number | null
}

export type HealthSummary = {
  overall_status: ComponentStatus
  checked_at: string
  components: ComponentHealth[]
  notes?: string | null
}


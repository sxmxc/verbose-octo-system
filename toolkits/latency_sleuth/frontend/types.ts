export type NotificationChannel = 'slack' | 'pagerduty' | 'email' | 'webhook'
export type NotificationThreshold = 'always' | 'breach' | 'recovery'

export type NotificationRule = {
  channel: NotificationChannel
  target: string
  threshold: NotificationThreshold
}

export type ProbeTemplate = {
  id: string
  name: string
  description?: string | null
  url: string
  method: 'GET' | 'HEAD' | 'POST'
  sla_ms: number
  interval_seconds: number
  notification_rules: NotificationRule[]
  tags: string[]
  created_at: string
  updated_at: string
  next_run_at?: string | null
}

export type ProbeTemplateCreate = {
  name: string
  description?: string | null
  url: string
  method?: 'GET' | 'HEAD' | 'POST'
  sla_ms: number
  interval_seconds?: number
  notification_rules?: NotificationRule[]
  tags?: string[]
}

export type ProbeExecutionSample = {
  attempt: number
  timestamp: string
  latency_ms: number
  breach: boolean
  message?: string | null
}

export type ProbeExecutionSummary = {
  template_id: string
  template_name: string
  sla_ms: number
  samples: ProbeExecutionSample[]
  average_latency_ms: number
  breach_count: number
  met_sla: boolean
  notified_channels: NotificationChannel[]
}

export type HeatmapCell = {
  timestamp: string
  latency_ms: number
  breach: boolean
}

export type LatencyHeatmap = {
  template_id: string
  columns: number
  rows: HeatmapCell[][]
}

export type JobRecord = {
  id: string
  status: string
  progress: number
  logs: { ts: string; message: string }[]
  operation?: string
  toolkit?: string
  type?: string
  result?: unknown
  error?: string | null
  payload?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type Job = {
  id: string
  toolkit: string
  operation: string
  status: string
  progress: number
  updated_at?: string
}

export type ZabbixInstance = {
  id: string
  name: string
  base_url: string
  verify_tls: boolean
  description?: string | null
  created_at: string
  updated_at: string
  has_token: boolean
}

export type BulkExportTarget = 'hosts' | 'templates' | 'hostgroups'
export type BulkExportFormat = 'json' | 'csv'

export type ZabbixBulkExportCatalogEntry = {
  target: BulkExportTarget
  label: string
  description: string
  supported_formats: BulkExportFormat[]
  default_format: BulkExportFormat
  filter_hint?: string
  default_filters?: Record<string, unknown>
  notes?: string
}

export type ZabbixBulkExportSummary = {
  target: BulkExportTarget
  format: BulkExportFormat
  estimated_records: number
  sample_fields: string[]
  sample_rows: Array<Record<string, unknown>>
  filters_applied?: Record<string, unknown>
  notes?: string
}

export type ZabbixDbScriptInputOption = {
  value: string
  label: string
}

export type ZabbixDbScriptInput = {
  name: string
  label: string
  type: 'text' | 'textarea' | 'select'
  required?: boolean
  placeholder?: string
  help_text?: string
  options?: ZabbixDbScriptInputOption[]
  default?: string
}

export type ZabbixDbScript = {
  key: string
  name: string
  description: string
  category: 'maintenance' | 'cleanup' | 'diagnostic'
  danger_level: 'info' | 'warning' | 'danger'
  inputs: ZabbixDbScriptInput[]
  documentation?: string
}

export type ZabbixDbScriptExecutionPreview = {
  ok: boolean
  summary: string
  statements: string[]
}

export type ZabbixDbScriptExecutionResponse = {
  job?: Job
  preview?: ZabbixDbScriptExecutionPreview
  message?: string
  ok: boolean
}

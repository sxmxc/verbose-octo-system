export type Job = {
  id: string
  toolkit: string
  operation: string
  status: string
  progress: number
  updated_at?: string
}

export type ProbePort = {
  port: number
  protocol: 'tcp' | 'udp'
}

export type ProbeEndpoint = {
  host: string
  ports: ProbePort[]
}

export type ConnectivityTarget = {
  id: string
  name: string
  description?: string | null
  endpoints: ProbeEndpoint[]
  endpoint_count: number
  created_at: string
  updated_at: string
}

export type ProbeResult = {
  host: string
  port: number
  protocol: 'tcp' | 'udp'
  status: 'reachable' | 'unreachable'
  latency_ms: number
  message?: string | null
  attempt: number
}

export type ConnectivitySummary = {
  ok: boolean
  total_probes: number
  failures: number
  results: ProbeResult[]
  repetitions: number
}

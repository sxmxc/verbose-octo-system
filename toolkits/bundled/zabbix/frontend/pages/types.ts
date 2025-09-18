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

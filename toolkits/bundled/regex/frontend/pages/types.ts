export type RegexMatch = {
  match: string
  start: number
  end: number
  groups: (string | null)[]
  groupdict: Record<string, string | null>
}

export type RegexTestResponse = {
  ok: boolean
  pattern: string
  flags: string[]
  matches: RegexMatch[]
  error?: string
}

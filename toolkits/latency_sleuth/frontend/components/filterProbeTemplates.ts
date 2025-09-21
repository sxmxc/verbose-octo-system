import type { ProbeTemplate } from '../types'

type FilterResult = {
  availableTags: string[]
  filteredTemplates: ProbeTemplate[]
}

type NormalizeOptions = {
  searchText?: string
  selectedTags?: string[]
}

function normalizeSearch(searchText?: string): string {
  return (searchText ?? '').trim().toLowerCase()
}

function normalizeTags(selectedTags?: string[]): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []

  for (const raw of selectedTags ?? []) {
    const tag = raw.trim()
    if (!tag) continue
    const lower = tag.toLowerCase()
    if (seen.has(lower)) continue
    seen.add(lower)
    normalized.push(lower)
  }

  return normalized
}

function collectAvailableTags(templates: ProbeTemplate[]): string[] {
  const unique = new Set<string>()

  for (const template of templates) {
    for (const tag of template.tags ?? []) {
      const normalized = tag.trim()
      if (!normalized) continue
      unique.add(normalized)
    }
  }

  return Array.from(unique).sort((a, b) => a.localeCompare(b))
}

function matchesSearch(template: ProbeTemplate, search: string): boolean {
  if (!search) return true
  const haystack = `${template.name}\n${template.url}`.toLowerCase()
  return haystack.includes(search)
}

function matchesTags(template: ProbeTemplate, normalizedTags: string[]): boolean {
  if (normalizedTags.length === 0) return true
  const templateTags = new Set((template.tags ?? []).map((tag) => tag.toLowerCase()))

  for (const tag of normalizedTags) {
    if (!templateTags.has(tag)) {
      return false
    }
  }

  return true
}

export function filterProbeTemplates(
  templates: ProbeTemplate[],
  options: NormalizeOptions = {},
): FilterResult {
  const search = normalizeSearch(options.searchText)
  const normalizedTags = normalizeTags(options.selectedTags)
  const availableTags = collectAvailableTags(templates)

  const filteredTemplates = templates.filter(
    (template) => matchesSearch(template, search) && matchesTags(template, normalizedTags),
  )

  return { availableTags, filteredTemplates }
}


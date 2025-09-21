import { describe, expect, it } from 'vitest'

import type { ProbeTemplate } from '../../types'
import { filterProbeTemplates } from '../filterProbeTemplates'

const baseTemplate: ProbeTemplate = {
  id: 'base',
  name: 'Base Template',
  description: null,
  url: 'https://example.com/base',
  method: 'GET',
  sla_ms: 100,
  interval_seconds: 60,
  notification_rules: [],
  tags: [],
  created_at: new Date('2025-01-01T00:00:00Z').toISOString(),
  updated_at: new Date('2025-01-01T00:00:00Z').toISOString(),
}

describe('filterProbeTemplates', () => {
  const templates: ProbeTemplate[] = [
    {
      ...baseTemplate,
      id: 'checkout',
      name: 'Checkout Flow',
      url: 'https://shop.example.com/pay',
      tags: ['checkout', 'critical'],
    },
    {
      ...baseTemplate,
      id: 'auth',
      name: 'Auth Service',
      url: 'https://auth.example.com/login',
      tags: ['auth', 'critical'],
    },
    {
      ...baseTemplate,
      id: 'docs',
      name: 'Docs Portal',
      url: 'https://example.com/docs',
      tags: ['docs'],
    },
  ]

  it('derives alphabetised available tags', () => {
    const { availableTags } = filterProbeTemplates(templates)
    expect(availableTags).toEqual(['auth', 'checkout', 'critical', 'docs'])
  })

  it('filters by search string across name and url', () => {
    const { filteredTemplates } = filterProbeTemplates(templates, { searchText: 'checkout' })
    expect(filteredTemplates).toHaveLength(1)
    expect(filteredTemplates[0].id).toBe('checkout')

    const { filteredTemplates: urlFiltered } = filterProbeTemplates(templates, {
      searchText: 'auth.example.com',
    })
    expect(urlFiltered).toHaveLength(1)
    expect(urlFiltered[0].id).toBe('auth')
  })

  it('requires templates to contain all selected tags', () => {
    const { filteredTemplates } = filterProbeTemplates(templates, {
      selectedTags: ['critical', 'checkout'],
    })
    expect(filteredTemplates).toHaveLength(1)
    expect(filteredTemplates[0].id).toBe('checkout')
  })

  it('ignores duplicate and empty tag filters', () => {
    const { filteredTemplates } = filterProbeTemplates(templates, {
      selectedTags: [' critical ', 'CRITICAL', '', 'auth'],
    })
    expect(filteredTemplates).toHaveLength(1)
    expect(filteredTemplates[0].id).toBe('auth')
  })

  it('combines search and tag filters using logical AND', () => {
    const { filteredTemplates } = filterProbeTemplates(templates, {
      searchText: 'Portal',
      selectedTags: ['docs'],
    })
    expect(filteredTemplates).toHaveLength(1)
    expect(filteredTemplates[0].id).toBe('docs')

    const none = filterProbeTemplates(templates, {
      searchText: 'Portal',
      selectedTags: ['auth'],
    })
    expect(none.filteredTemplates).toHaveLength(0)
  })
})


import { describe, expect, it } from 'vitest'

import { formatApiError } from '../errorUtils'

describe('formatApiError', () => {
  it('surfaces detail from JSON response bodies', () => {
    const error = new Error('Request failed (400): {"detail":"Invalid JSON body: Unexpected token"}')

    expect(formatApiError(error)).toBe('HTTP 400: Invalid JSON body: Unexpected token')
  })

  it('falls back to the raw body when JSON parsing fails', () => {
    const error = new Error('Request failed (422): <!DOCTYPE html><p>Bad payload</p>')

    expect(formatApiError(error)).toBe('HTTP 422: <!DOCTYPE html><p>Bad payload</p>')
  })

  it('returns permission guidance for 403 responses without bodies', () => {
    const error = new Error('Request failed (403): ')

    expect(formatApiError(error)).toBe('You do not have permission to perform that request.')
  })

  it('handles detail arrays by using the first available message', () => {
    const error = new Error(
      'Request failed (422): {"detail":[{"msg":"body -> name is required"}]}'
    )

    expect(formatApiError(error)).toBe('HTTP 422: body -> name is required')
  })

  it('handles nested detail objects', () => {
    const error = new Error(
      'Request failed (409): {"error":{"message":"Probe already exists"}}'
    )

    expect(formatApiError(error)).toBe('HTTP 409: Probe already exists')
  })

  it('detects network failures from TypeError instances', () => {
    const error = new TypeError('Failed to fetch')

    expect(formatApiError(error)).toBe(
      'Network request failed. Check your connection or proxy settings and try again.'
    )
  })

  it('accepts string errors directly', () => {
    expect(formatApiError('Custom validation failed.')).toBe('Custom validation failed.')
  })

  it('falls back to a generic message for unknown errors', () => {
    expect(formatApiError({})).toBe('An unexpected error occurred. Check the console for details.')
  })
})

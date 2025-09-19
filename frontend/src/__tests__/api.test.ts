import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('../authStore', () => {
  return {
    getAccessToken: vi.fn(() => 'token-123'),
    refreshAccessToken: vi.fn(() => Promise.resolve('token-456')),
    clearAccessToken: vi.fn(),
  }
})

import { apiFetch } from '../api'
import { clearAccessToken, getAccessToken, refreshAccessToken } from '../authStore'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  ;(globalThis as any).fetch = fetchMock
})

describe('apiFetch', () => {
  test('attaches authorization header and stringifies JSON bodies', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: vi.fn().mockResolvedValue({ ok: true }),
    })

    const result = await apiFetch<{ ok: boolean }>('/demo', { method: 'POST', body: { hello: 'world' } })

    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, options] = fetchMock.mock.calls[0]
    const headers = options.headers as Headers
    expect(headers.get('Authorization')).toBe(`Bearer ${getAccessToken()}`)
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(options.credentials).toBe('include')
    expect(options.body).toBe(JSON.stringify({ hello: 'world' }))
  })

  test('retries once on 401 and clears token when refresh fails', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: vi.fn().mockResolvedValue({}),
        text: vi.fn().mockResolvedValue(''),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: vi.fn().mockResolvedValue({ ok: true }),
      })

    const result = await apiFetch<{ ok: boolean }>('/demo')

    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(refreshAccessToken).toHaveBeenCalledTimes(1)
    expect(clearAccessToken).not.toHaveBeenCalled()
  })
})

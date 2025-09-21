import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

let getAccessToken: typeof import('../authStore').getAccessToken
let setAccessToken: typeof import('../authStore').setAccessToken
let clearAccessToken: typeof import('../authStore').clearAccessToken
let subscribe: typeof import('../authStore').subscribe
let refreshAccessToken: typeof import('../authStore').refreshAccessToken
let warnSpy: ReturnType<typeof vi.spyOn> | undefined

function createMockStorage(): Storage {
  const store = new Map<string, string>()
  return {
    getItem(key) {
      return store.get(key) ?? null
    },
    setItem(key, value) {
      store.set(key, value)
    },
    removeItem(key) {
      store.delete(key)
    },
    clear() {
      store.clear()
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null
    },
    get length() {
      return store.size
    },
  }
}

beforeEach(async () => {
  vi.resetModules()
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const storage = createMockStorage()
  vi.stubGlobal('localStorage', storage)
  vi.stubGlobal(
    'window',
    {
      localStorage: storage,
      location: { href: 'http://localhost/' } as Location,
    } as Window
  )
  localStorage.clear()
  ;({ getAccessToken, setAccessToken, clearAccessToken, subscribe, refreshAccessToken } = await import('../authStore'))
})

afterEach(() => {
  warnSpy?.mockRestore()
  warnSpy = undefined
  vi.unstubAllGlobals()
})

describe('authStore', () => {
  test('setAccessToken persists token and notifies subscribers', () => {
    const listener = vi.fn()
    const unsubscribe = subscribe(listener)

    setAccessToken('abc123')

    expect(getAccessToken()).toBe('abc123')
    expect(localStorage.getItem('sre-toolbox.accessToken')).toBe('abc123')
    expect(listener).toHaveBeenCalledWith('abc123')

    unsubscribe()
    setAccessToken(null)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  test('refreshAccessToken updates token on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: vi.fn().mockResolvedValue({ access_token: 'xyz789' }),
    })
    ;(globalThis as any).fetch = fetchMock
    setAccessToken('old-token')

    const result = await refreshAccessToken()

    expect(result).toBe('xyz789')
    expect(getAccessToken()).toBe('xyz789')
  })

  test('refreshAccessToken clears token on failure', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network'))
    ;(globalThis as any).fetch = fetchMock
    setAccessToken('stale')

    const result = await refreshAccessToken()

    expect(result).toBeNull()
    expect(getAccessToken()).toBeNull()
    expect(localStorage.getItem('sre-toolbox.accessToken')).toBeNull()
  })
})
